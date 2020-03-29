// the rest of this is shamelessly stolen from
// https://github.com/BrechtDeMan/WebAudioEvaluationTool/blob/master/js/loudness.js

// @ts-ignore
class LoudnessProcessor extends AudioWorkletProcessor {
    process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>) {
        const sampleData = inputs[0];
        let peak = -Infinity;
        for (let channel = 0; channel < sampleData.length; channel++) {
            const buf = sampleData[channel];
            for (let i = 0; i < buf.length; i++) {
                const dbFS = 20 * Math.log10(Math.abs(buf[i]));
                if (dbFS > peak) {
                    peak = dbFS;
                }
            }
        }
        this.port.postMessage({
            peak,
            loudness: -Infinity // TODO
        });
        return true;
    }
}

// @ts-ignore
registerProcessor("loudness-processor", LoudnessProcessor);

function calculateMeanSquared(buffer: AudioBuffer, frame_dur: number, frame_overlap: number) {
    var frame_size = Math.floor(buffer.sampleRate * frame_dur);
    var step_size = Math.floor(frame_size * (1.0 - frame_overlap));
    var num_frames = Math.floor((buffer.length - frame_size) / step_size);
    num_frames = Math.max(num_frames, 1);

    var MS = Array(buffer.numberOfChannels);
    for (var c = 0; c < buffer.numberOfChannels; c++) {
        MS[c] = new Float32Array(num_frames);
        var data = buffer.getChannelData(c);
        for (var no = 0; no < num_frames; no++) {
            MS[c][no] = 0.0;
            for (var ptr = 0; ptr < frame_size; ptr++) {
                var i = no * step_size + ptr;
                if (i >= buffer.length) {
                    break;
                }
                var sample = data[i];
                MS[c][no] += sample * sample;
            }
            MS[c][no] /= frame_size;
        }
    }
    return MS;
}

function calculateLoudnessFromBlocks(blocks: number[][]) {
    var num_frames = blocks[0].length;
    var num_channels = blocks.length;
    var MSL = Array(num_frames);
    for (var n = 0; n < num_frames; n++) {
        var sum = 0;
        for (var c = 0; c < num_channels; c++) {
            var G = 1.0;
            if (G >= 3) {
                G = 1.41;
            }
            sum += blocks[c][n] * G;
        }
        MSL[n] = -0.691 + 10 * Math.log10(sum);
    }
    return MSL;
}

function loudnessGate(blocks: number[], source: number[][], threshold: number) {
    var num_frames = source[0].length;
    var num_channels = source.length;
    var LK = Array(num_channels);
    var n, c;
    for (c = 0; c < num_channels; c++) {
        LK[c] = [];
    }

    for (n = 0; n < num_frames; n++) {
        if (blocks[n] > threshold) {
            for (c = 0; c < num_channels; c++) {
                LK[c].push(source[c][n]);
            }
        }
    }
    return LK;
}

function loudnessOfBlocks(blocks: number[][]) {
    var num_frames = blocks[0].length;
    var num_channels = blocks.length;
    var loudness = 0.0;
    for (var n = 0; n < num_frames; n++) {
        var sum = 0;
        for (var c = 0; c < num_channels; c++) {
            var G = 1.0;
            if (G >= 3) {
                G = 1.41;
            }
            sum += blocks[c][n] * G;
        }
        sum /= num_frames;
        loudness += sum;
    }
    loudness = -0.691 + 10 * Math.log10(loudness);
    return loudness;
}