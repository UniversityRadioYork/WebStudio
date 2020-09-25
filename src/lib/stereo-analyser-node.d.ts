declare module "stereo-analyser-node" {

declare interface StereoAnalyserNode {
  StereoAnalyserNode(
    audioContext: AudioContext,
    opts: Object | undefined
  ): {
    fftSize: number;
    frequencyBinCount: number;
    minDecibels: number;
    maxDecibels: number;
    smoothingTimeConstant: number;
    connect(destination: AudioNode | AudioParam): void;
    disconnect(): void;
    getFloatFrequencyData(arrayL: Float32Array, arrayR: Float32Array): void;
    getByteFrequencyData(arrayL: Uint8Array, arrayR: Uint8Array): void;
    getFloatTimeDomainData(arrayL: Float32Array, arrayR: Float32Array): void;
    getByteTimeDomainData(arrayL: Uint8Array, arrayR: Uint8Array): void;
  }
}
export default StereoAnalyserNode.StereoAnalyserNode();
}
