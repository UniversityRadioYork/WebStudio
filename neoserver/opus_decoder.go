package main

import (
	"context"
	"fmt"
	"go.uber.org/zap"
	"gopkg.in/hraban/opus.v2"
)

type OpusDecoder struct {
	logger     *zap.Logger
	dec        *opus.Decoder
	in         chan AudioPayload
	out        chan<- []float32
	channels   uint
	sampleRate uint
}

const OpusDecoderBufferSize = 512

func NewOpusDecoder(logger *zap.Logger, sampleRate uint, channels uint) (*OpusDecoder, error) {
	dec, err := opus.NewDecoder(int(sampleRate), int(channels))
	if err != nil {
		return nil, fmt.Errorf("could not create Opus decoder: %w", err)
	}
	return &OpusDecoder{
		logger:     logger,
		dec:        dec,
		in:         make(chan AudioPayload, OpusDecoderBufferSize),
		out:        make(chan []float32, 0),
		channels:   channels,
		sampleRate: sampleRate,
	}, nil
}

const opusFrameSizeMs = 60

func (o *OpusDecoder) Work(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			o.logger.Warn("Shutting down", zap.Error(ctx.Err()))
			return
		case payload, ok := <-o.in:
			if !ok {
				o.logger.Error("Shutting down due to closed channel")
				return
			}
			if o.out == nil {
				o.logger.Warn("No output channel, dropping packet")
			}
			frameSize := opusFrameSizeMs * o.channels * o.sampleRate / 1000
			buffer := make([]float32, int(frameSize))
			n, err := o.dec.DecodeFloat32(payload.Data, buffer)
			if err != nil {
				o.logger.Error("Failed to decode", zap.Error(err))
				continue
			}
			select {
			case o.out <- buffer[:n*int(o.channels)]:
			default:
				o.logger.Warn("Receiving end blocked, dropping packet")
			}
		}
	}
}

func (o *OpusDecoder) In() chan<- AudioPayload {
	return o.in
}

func (o *OpusDecoder) SetOut(out chan<- []float32) {
	o.out = out
}

func (o *OpusDecoder) Close() error {
	return nil
}
