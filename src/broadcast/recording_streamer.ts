import { Streamer } from "./streamer";
// @ts-ignore
import RecordMp3Worker from "./record_mp3.worker";

export class RecordingStreamer extends Streamer {
  ac: AudioContext;
  processor: ScriptProcessorNode;
  chunks: Uint8Array[];
  worker: Worker;
  sourceNode: AudioNode;
  stupidZeroGain: GainNode;

  constructor(ac: AudioContext, node: AudioNode) {
    super();
    this.ac = ac;
    this.onStateChange("CONNECTING");
    this.sourceNode = node;
    this.stupidZeroGain = ac.createGain();
    this.stupidZeroGain.gain.value = 0;
    this.worker = new RecordMp3Worker();
    this.chunks = [];
    this.processor = ac.createScriptProcessor(2048, 2, 2);
    this.worker.onmessage = (evt) => {
      switch (evt.data.kind) {
        case "finished":
          this.worker.postMessage({
            kind: "export",
          });
          break;
        case "exported":
          const blob: Blob = evt.data.data;
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "webstudio.mp3";
          a.click();
          break;
      }
    };
  }

  async start(): Promise<void> {
    this.chunks = [];
    this.processor.onaudioprocess = (evt) => {
      const input = evt.inputBuffer;
      const chanData = [];
      for (let chan = 0; chan < input.numberOfChannels; chan++) {
        const data = input.getChannelData(chan);
        chanData[chan] = data;
      }
      this.worker.postMessage({
        kind: "data",
        data: chanData,
      });
    };
    this.worker.postMessage({
      kind: "start",
    });
    // console.log("Source:", this.sourceNode, this.sourceNode.connect);
    this.sourceNode.connect(this.processor);
    this.processor.connect(this.stupidZeroGain).connect(this.ac.destination);
    console.log("Connected", this.sourceNode, "to", this.processor);
    this.onStateChange("CONNECTED");
  }

  async stop(): Promise<void> {
    this.onStateChange("NOT_CONNECTED");
    this.sourceNode.disconnect(this.processor);

    await new Promise<void>((resolve) => {
      setTimeout(() => {
        this.worker.postMessage({
          kind: "flush",
        });
        this.processor.onaudioprocess = () => {};
        resolve();
      }, 1);
    });
  }
}
