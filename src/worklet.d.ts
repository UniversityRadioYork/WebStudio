declare module "*.worklet.ts" {
  const exportString: string;
  export default exportString;
}

interface AudioWorkletProcessor {
    readonly port: MessagePort;
    process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): void;
}

declare var AudioWorkletProcessor: {
    prototype: AudioWorkletProcessor;
    new(options?: AudioWorkletNodeOptions): AudioWorkletProcessor;
}

declare function registerProcessor(name: string, processor: AudioWorkletProcessor);
