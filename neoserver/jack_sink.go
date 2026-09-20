package main

import (
	"fmt"
	"github.com/xthexder/go-jack"
	"go.uber.org/zap"
)

type JackSink struct {
	logger    *zap.Logger
	client    *jack.Client
	ports     []*jack.Port
	in        chan []float32
	leftovers chan []float32
}

const (
	jackBufferSize         = 512
	jackLeftoverBufferSize = 64
)

func CreateJackSink(logger *zap.Logger, clientName string, portNamePrefix string, channels uint) (*JackSink, error) {
	jc, err := jack.ClientOpen(clientName, jack.NoStartServer)
	if jc == nil {
		return nil, fmt.Errorf("could not open Jack client: %w", jack.StrError(err))
	}
	js := &JackSink{
		logger:    logger,
		client:    jc,
		ports:     make([]*jack.Port, int(channels)),
		in:        make(chan []float32, jackBufferSize),
		leftovers: make(chan []float32, jackLeftoverBufferSize),
	}
	jc.SetProcessCallback(js.process)
	for i := 0; i < int(channels); i++ {
		port := jc.PortRegister(fmt.Sprintf("%s:out_%d", portNamePrefix, i), jack.DEFAULT_AUDIO_TYPE, jack.PortIsOutput, 0)
		js.ports[i] = port
	}
	return js, nil
}

func (j *JackSink) Start() error {
	err := j.client.Activate()
	if err > 0 {
		return jack.StrError(err)
	}
	return nil
}

func (j *JackSink) process(frames uint32) int {
	processed := uint32(0)
	channels := len(j.ports)
	bufs := make([][]jack.AudioSample, channels)
	for i := 0; i < channels; i++ {
		bufs[i] = j.ports[i].GetBuffer(frames)
	}
	select {
	case payload := <-j.leftovers:
		leftover := j.flushPayload(payload, 0, frames, bufs)
		if leftover > 0 {
			select {
			case j.leftovers <- payload[len(payload)-leftover:]:
			default:
				j.logger.Warn("Leftovers buffer full, flushing!")
				j.leftovers = make(chan []float32, jackLeftoverBufferSize)
			}
		}
		return 0
	case payload, ok := <-j.in:
		if !ok {
			j.logger.Warn("In channel closed, shutting down")
			return 1
		}
		leftover := j.flushPayload(payload, 0, frames, bufs)
		if leftover > 0 {
			select {
			case j.leftovers <- payload[len(payload)-leftover:]:
			default:
				j.logger.Warn("Leftovers buffer full, flushing!")
				j.leftovers = make(chan []float32, jackLeftoverBufferSize)
			}
		}
		return 0
	default:
		for i := processed; i < frames; i++ {
			for ch := 0; ch < channels; ch++ {
				bufs[ch][i] = 0
			}
		}
		return 0
	}
}

// flushPayload writes the audio data from payload into Jack, accounting for the space remaining
// in this callback's buffers. It returns how many frames were not written because it ran out of space,
// or 0 if the entire payload was written.
func (j *JackSink) flushPayload(payload []float32, offset int, frames uint32, bufs [][]jack.AudioSample) int {
	channels := len(bufs)
	samples := (len(payload) - 1) / channels
	leftover := 0
	if offset+samples > int(frames) {
		leftover = int(frames) - (samples - offset)
		samples = int(frames)
	}
	for i := offset; i < samples; i++ {
		for ch := 0; ch < channels; ch++ {
			sample := jack.AudioSample(payload[(i*channels)+ch])
			bufs[ch][i] = sample
		}
	}
	return leftover
}

func (j *JackSink) Close() error {
	close(j.in)
	err := j.client.Close()
	if err > 0 {
		return jack.StrError(err)
	}
	return nil
}

func (j *JackSink) In() chan<- []float32 {
	return j.in
}
