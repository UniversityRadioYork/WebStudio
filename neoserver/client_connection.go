package main

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/pion/webrtc/v3"
	"go.uber.org/zap"
	"sync"
	"time"
)

type CCCallback func(connection *ClientConnection)

type ClientConnection struct {
	id         uuid.UUID
	logger     *zap.Logger
	me         *webrtc.MediaEngine
	pc         *webrtc.PeerConnection
	iceServers []webrtc.ICEServer
	ws         *websocket.Conn
	shutdown   context.Context
	stateMux   sync.Mutex
	payloads   chan<- AudioPayload
	ready      CCCallback
	done       CCCallback
}

type AudioPayload struct {
	Codec     webrtc.RTPCodecParameters
	Data      []byte
	Timestamp uint32
}

func createClientConnection(logger *zap.Logger, id uuid.UUID, ws *websocket.Conn, ctx context.Context, getICE func() ([]webrtc.ICEServer, error)) (*ClientConnection, error) {
	ice, err := getICE()
	if err != nil {
		return nil, fmt.Errorf("failed to get ICE: %w", err)
	}
	cc := &ClientConnection{
		logger:     logger,
		id:         id,
		iceServers: ice,
		ws:         ws,
		shutdown:   ctx,
	}
	go cc.handle()
	go func() {
		<-ctx.Done()
		cc.Close(ctx.Err())
	}()
	return cc, nil
}

type baseMessage struct {
	Kind string `json:"kind"`
}

type helloMessage struct {
	baseMessage
	ConnectionID string             `json:"connectionID"`
	ICEServers   []webrtc.ICEServer `json:"iceServers"`
}

type offerMessage struct {
	baseMessage
	webrtc.SessionDescription
}

type answerMessage struct {
	baseMessage
	webrtc.SessionDescription
}

type errorMessage struct {
	baseMessage
	Error string `json:"error"`
}

func (c *ClientConnection) handle() {
	err := c.ws.WriteJSON(helloMessage{
		baseMessage:  baseMessage{Kind: "HELLO"},
		ConnectionID: c.id.String(),
		ICEServers:   c.iceServers,
	})
	if err != nil {
		c.logger.Error("Failed to send HELLO", zap.Error(err))
		c.Close(err)
		return
	}
	c.logger.Info("HELLO")
	for {
		typ, msg, err := c.ws.ReadMessage()
		if err != nil {
			c.logger.Error("Failed to read", zap.Error(err))
			return
		}
		if typ != websocket.TextMessage {
			c.logger.Warn("Unexpected message type", zap.Int("type", typ))
			return
		}
		var base baseMessage
		if err = json.Unmarshal(msg, &base); err != nil {
			c.logger.Error("Failed to unmarshal message", zap.Error(err))
			return
		}
		switch base.Kind {
		case "OFFER":
			c.handleOffer(msg)
		default:
			c.logger.Info("Got unknown kind", zap.String("kind", base.Kind))
			c.ws.WriteJSON(errorMessage{
				baseMessage: baseMessage{Kind: "ERROR"},
				Error:       "unknown_kind",
			})
		}
	}
}

func (c *ClientConnection) Close(err error) error {
	c.stateMux.Lock()
	defer c.stateMux.Unlock()
	if c.done != nil {
		c.done(c)
	}
	if c.ws != nil {
		if err != nil {
			c.ws.WriteJSON(errorMessage{baseMessage: baseMessage{Kind: "ERROR"}, Error: err.Error()})
		} else {
			c.ws.WriteJSON(baseMessage{Kind: "DIED"})
		}
		c.ws.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(1000, "DIED"), time.Now().Add(time.Second))
		c.ws.Close()
		c.ws = nil
	}
	return nil
}

func (c *ClientConnection) createPeerConnectionUNLOCKED() error {
	if c.pc != nil {
		return fmt.Errorf("PC already exists (bug!)")
	}
	me := &webrtc.MediaEngine{}
	err := me.RegisterCodec(webrtc.RTPCodecParameters{
		RTPCodecCapability: webrtc.RTPCodecCapability{
			MimeType:     webrtc.MimeTypeOpus,
			ClockRate:    48000,
			Channels:     2,
			SDPFmtpLine:  "minptime=10;useinbandfec=0;maxaveragebitrate=262144;stereo=1;sprop-stereo=1;cbr=1",
			RTCPFeedback: nil,
		},
		PayloadType: 111,
	}, webrtc.RTPCodecTypeAudio)
	if err != nil {
		return fmt.Errorf("could not register codec: %w", err)
	}
	api := webrtc.NewAPI(webrtc.WithMediaEngine(me))
	if err != nil {
		return fmt.Errorf("failed to get ICE: %w", err)
	}
	pc, err := api.NewPeerConnection(webrtc.Configuration{
		SDPSemantics: webrtc.SDPSemanticsUnifiedPlan,
		ICEServers:   c.iceServers,
	})
	if err != nil {
		return fmt.Errorf("failed to create PeerConnection: %w", err)
	}
	_, err = pc.AddTransceiverFromKind(webrtc.RTPCodecTypeAudio)
	if err != nil {
		return fmt.Errorf("could not add transceiver: %w", err)
	}
	pc.OnTrack(c.handleNewTrack)
	c.pc = pc
	return nil
}

func (c *ClientConnection) handleOffer(msg []byte) {
	var payload offerMessage
	err := json.Unmarshal(msg, &payload)
	if err != nil {
		c.logger.Error("Failed to unmarshal SDP offer", zap.Error(err))
		c.Close(err)
		return
	}

	c.stateMux.Lock()
	defer c.stateMux.Unlock()

	err = c.createPeerConnectionUNLOCKED()
	if err != nil {
		c.logger.Error("Failed to create peer connection", zap.Error(err))
		c.Close(fmt.Errorf("failed to create PC: %w", err))
		return
	}

	err = c.pc.SetRemoteDescription(payload.SessionDescription)
	if err != nil {
		c.logger.Error("Failed to set session description", zap.Error(err))
		c.Close(err)
		return
	}
	answer, err := c.pc.CreateAnswer(nil)
	if err != nil {
		c.logger.Error("Failed to create answer", zap.Error(err))
		c.Close(fmt.Errorf("failed to create answer: %w", err))
		return
	}
	err = c.pc.SetLocalDescription(answer)
	if err != nil {
		c.logger.Error("Failed to set local description", zap.Error(err))
		c.Close(err)
		return
	}
	err = c.ws.WriteJSON(answerMessage{
		baseMessage:        baseMessage{Kind: "ANSWER"},
		SessionDescription: answer,
	})
	if err != nil {
		c.logger.Error("Failed to send answer", zap.Error(err))
		c.Close(err)
		return
	}
}

func (c *ClientConnection) handleNewTrack(remote *webrtc.TrackRemote, receiver *webrtc.RTPReceiver) {
	if remote.Kind() != webrtc.RTPCodecTypeAudio {
		c.logger.Warn("Got non-audio track", zap.String("kind", remote.Kind().String()), zap.String("id", remote.ID()), zap.String("sid", remote.StreamID()))
		return
	}
	go func() {
		logger := c.logger.Named("TrackHandler")
		for {
			select {
			case <-c.shutdown.Done():
				logger.Error("Shutting down", zap.Error(c.shutdown.Err()))
				c.Close(c.shutdown.Err())
				return
			default:
			}
			packet, _, err := remote.ReadRTP()
			if err != nil {
				logger.Error("Failed to read RTP", zap.Error(err))
				c.Close(err)
				return
			}
			// We're going to assume this is Opus
			if c.payloads != nil {
				select {
				case c.payloads <- AudioPayload{
					Codec:     remote.Codec(),
					Data:      packet.Payload,
					Timestamp: packet.Timestamp,
				}:
				default:
					logger.Warn("Payload reader blocked, dropping packet!")
				}
			} else {
				logger.Debug("No payload reader, dropping packet")
			}
		}
	}()
	if c.ready != nil {
		c.ready(c)
	}
}

func (c *ClientConnection) SetPayloadReader(reader chan<- AudioPayload) {
	c.stateMux.Lock()
	defer c.stateMux.Unlock()
	c.payloads = reader
	c.logger.Debug("Set payload reader")
}

func (c *ClientConnection) SetReadyCallback(cb CCCallback) {
	c.stateMux.Lock()
	defer c.stateMux.Unlock()
	c.ready = cb
	c.logger.Debug("Set ready callback")
}

func (c *ClientConnection) SetDoneCallback(cb CCCallback) {
	c.stateMux.Lock()
	defer c.stateMux.Unlock()
	c.done = cb
	c.logger.Debug("Set done callback")
}
