// @ts-ignore
import workletUrl from "./loudness.worklet.ts";

export async function createLoudnessMeasurement(
  input: AudioNode,
  callback: (data: { peak: number; loudness: number }) => any
) {
  // const shelf = input.context.createBiquadFilter();
  // shelf.type = "highshelf";
  // shelf.frequency.value = 1500;
  // shelf.gain.value = 4;
  // input.connect(shelf);
  // const highpass = input.context.createBiquadFilter();
  // highpass.type = "highpass";
  // highpass.frequency.value = 38;
  // highpass.Q.value = 0.5;
  // shelf.connect(highpass);

  console.log(workletUrl);
  await input.context.audioWorklet.addModule(workletUrl);
  const processor = new AudioWorkletNode(input.context, "loudness-processor", {
    numberOfInputs: 1,
    numberOfOutputs: 0,
  });
  processor.port.onmessage = (evt) => {
    callback(evt.data);
  };
  input.connect(processor);
  return () => {
    input.disconnect(processor);
  };
}
