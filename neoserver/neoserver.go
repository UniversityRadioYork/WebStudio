package main

import (
	"context"
	"fmt"
	"github.com/UniversityRadioYork/WebStudio/neoserver/config"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/pion/webrtc/v3"
	"github.com/spf13/pflag"
	"github.com/twilio/twilio-go"
	"go.uber.org/zap"
	"net"
	"net/http"
	_ "net/http/pprof"
	"os"
	"os/signal"
	"sync"
)

var flagConfigPath = pflag.String("config-path", ".", "path to look for config")

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func main() {
	pflag.Parse()
	cfg, err := config.LoadConfig(*flagConfigPath)
	if err != nil {
		panic(err)
	}

	var logConfig zap.Config
	if cfg.Server.DevelopmentMode {
		logConfig = zap.NewDevelopmentConfig()
	} else {
		logConfig = zap.NewProductionConfig()
	}
	logConfig.Level = zap.NewAtomicLevelAt(cfg.Server.LogLevel)
	baseLogger, err := logConfig.Build(zap.AddCaller())
	if err != nil {
		panic(err)
	}
	defer baseLogger.Sync()
	logger := baseLogger.Named("main").Sugar()
	logger.Infow("Started and loaded config", "cfg", cfg)

	twilioClient := twilio.NewRestClientWithParams(twilio.RestClientParams{
		Username: cfg.Twilio.AccountSID,
		Password: cfg.Twilio.AuthToken,
	})

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	decoder, err := NewOpusDecoder(baseLogger.Named("OpusDecoder"), 48000, 2)
	if err != nil {
		logger.Fatalw("Failed to create Opus decoder", "err", err)
	}
	defer decoder.Close()
	go decoder.Work(ctx)

	jackSink, err := CreateJackSink(baseLogger.Named("JackSink"), "webstudio", "webstudio", 2)
	if err != nil {
		logger.Fatalw("Failed to create Jack sink", "err", err)
	}
	defer jackSink.Close()
	if err := jackSink.Start(); err != nil {
		logger.Fatalw("Failed to start Jack sink", "err", err)
	}

	decoder.SetOut(jackSink.In())

	ccs := make(map[uuid.UUID]*ClientConnection)
	ccsMux := sync.RWMutex{}

	httpLogger := baseLogger.Named("http").Sugar()
	http.HandleFunc("/stream", func(w http.ResponseWriter, r *http.Request) {
		ws, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			httpLogger.Errorw("Upgrade failed", "err", err)
			w.WriteHeader(500)
			return
		}

		connId := uuid.Must(uuid.NewRandom())
		ccLogger := baseLogger.Named("cc").With(zap.String("id", connId.String()))
		cc, err := createClientConnection(ccLogger, connId, ws, ctx, func() ([]webrtc.ICEServer, error) {
			tok, err := twilioClient.ApiV2010.CreateToken(nil)
			if err != nil {
				return nil, err
			}
			creds := make([]webrtc.ICEServer, len(*tok.IceServers))
			for i, srv := range *tok.IceServers {
				creds[i] = webrtc.ICEServer{
					URLs:           []string{srv.Url},
					Username:       srv.Username,
					Credential:     srv.Credential,
					CredentialType: webrtc.ICECredentialTypePassword,
				}
			}
			return creds, nil
		})
		if err != nil {
			logger.Errorw("Failed to create client connection", "err", err)
		}
		cc.SetReadyCallback(func(c *ClientConnection) {
			c.SetPayloadReader(decoder.In())
		})
		ccsMux.Lock()
		ccs[connId] = cc
		ccsMux.Unlock()
	})

	addr := fmt.Sprintf(":%d", cfg.Server.WebsocketPort)
	l, err := net.Listen("tcp", addr)
	if err != nil {
		logger.Fatalw("Failed to listen", "addr", addr, "err", err)
	}
	logger.Infow("Listening", "addr", addr)

	server := &http.Server{Addr: addr}
	go func() {
		err := server.Serve(l)
		if err != nil {
			httpLogger.Errorw("Failed to serve", "err", err)
		}
	}()

	<-ctx.Done()
	logger.Infow("Received shutdown signal, shutting down")
	server.Shutdown(ctx)
}
