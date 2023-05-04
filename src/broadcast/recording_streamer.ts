import { Streamer } from "./streamer";

export class RecordingStreamer extends Streamer {
  recorder: MediaRecorder;
  chunks: Blob[];

  constructor(stream: MediaStream) {
    super();
    this.recorder = new MediaRecorder(stream);
    this.chunks = [];
    this.recorder.ondataavailable = (e) => {
      this.chunks.push(e.data);
    };
    this.recorder.onstart = () => {
      this.onStateChange("CONNECTED");
    };
    this.recorder.onstop = () => {
      this.onStateChange("NOT_CONNECTED");
      const finalData = new Blob(this.chunks, {
        type: "audio/ogg; codecs=opus",
      });
      const url = URL.createObjectURL(finalData);

      const a = document.createElement("a");
      a.href = url;
      a.download = "recorded.ogg";
      a.click();
    };
    this.recorder.onerror = (e) => {
      console.error(e);
      this.onStateChange("CONNECTION_LOST");
    };
  }

  async start(): Promise<void> {
    this.chunks = [];
    this.recorder.start();
  }
  async stop(): Promise<void> {
    this.recorder.stop();
  }
}
