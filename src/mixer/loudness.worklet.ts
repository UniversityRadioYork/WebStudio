// @ts-ignore
const LOCK_ON_FACTOR = 1.0 - 0.6;
const LOCK_ON_TIME = 0.0025;
const DROP_FACTOR = 10.0 ** (-24.0 / 20.0);
const DROP_TIME = 2.8;
const CLIP_PPM = 8.5;
const SAMPLE_LIMIT = 1;
const DB_PER_PPM = 4.0;
const DB_CONST = 20.0;

declare const sampleRate: number;

type StereoModeEnum = "M3" | "M6" | "AB";
class DBFSPeakProcessor extends AudioWorkletProcessor {
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ) {
    const sampleData = inputs[0];
    let peak = -Infinity;
    for (let channel = 0; channel < sampleData.length; channel++) {
      const buf = sampleData[channel];
      for (let i = 0; i < buf.length; i++) {
        if (Math.random() * 128 < 1) {
          console.log(buf[i]);
        }
        const dbFS = 20 * Math.log10(Math.abs(buf[i]));
        if (dbFS > peak) {
          peak = dbFS;
        }
      }
    }
    this.port.postMessage({
      peak,
      loudness: -Infinity, // TODO
    });
    return true;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
class PPMPeakProcessor extends AudioWorkletProcessor {
  intermediateValue: number[] = [0.0, 0.0];
  lockonfract = (1.0 - LOCK_ON_FACTOR) ** (1.0 / (sampleRate * LOCK_ON_TIME));
  drop = DROP_FACTOR ** (1.0 / (sampleRate / DROP_TIME));

  calcIntermediate(input: Float32Array[]) {
    // Source of fun: the libbaptools implementation takes audio as a short
    // while we get it as a float.
    input.forEach((chData, chIndex) => {
      let tempPpm = this.intermediateValue[chIndex];

      chData.forEach((value, sa) => {
        if (Math.abs(value) > tempPpm) {
          tempPpm += this.lockonfract * (Math.abs(value) - tempPpm);
        }
      });

      tempPpm *= this.drop;
      this.intermediateValue[chIndex] = tempPpm;
    });
  }

  convert(intermediate: number): number {
    if (intermediate < 0.001) {
      return 0;
    }
    let ppmVal =
      CLIP_PPM -
      (DB_CONST / DB_PER_PPM) * Math.log10(SAMPLE_LIMIT / intermediate);
    if (ppmVal < 1.0) {
      ppmVal =
        1.0 - 1.0 / (24.0 / DB_PER_PPM) + (1.0 / (24.0 / DB_PER_PPM)) * ppmVal;
    }
    return ppmVal < 0.0 ? 0.0 : ppmVal;
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ) {
    this.calcIntermediate(inputs[0]);
    this.port.postMessage({
      peak: this.convert(this.intermediateValue[0]),
      loudness: this.intermediateValue[0],
    });
    return true;
  }
}

// @ts-ignore
registerProcessor("loudness-processor", DBFSPeakProcessor);
