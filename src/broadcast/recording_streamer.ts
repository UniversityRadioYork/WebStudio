import { Streamer } from "./streamer";

export class RecordingStreamer extends Streamer {
  recorder: MediaRecorder;
  chunks: Blob[];
  url: string;
  modalCallback: () => void;

  constructor(stream: MediaStream) {
    super();
    this.recorder = new MediaRecorder(stream);
    this.chunks = [];
    this.url = "";
    this.modalCallback = () => {};

    this.recorder.ondataavailable = (e) => {
      this.chunks.push(e.data);
    };
    this.recorder.onstart = () => {
      this.onStateChange("CONNECTED");
    };
    this.recorder.onstop = () => {
      this.onStateChange("NOT_CONNECTED");
      const finalData = new Blob(this.chunks, {
        type: "audio/mp3; codecs=mpeg",
      });
      this.url = URL.createObjectURL(finalData);
      this.modalCallback();
    };
    this.recorder.onerror = (e) => {
      console.error(e.error);
      this.onStateChange("CONNECTION_LOST");
    };
  }

  async start(): Promise<void> {
    this.chunks = [];
    this.recorder.start();
  }
  async stop(callback?: () => void): Promise<void> {
    if (callback) {
      this.modalCallback = callback;
    }
    this.recorder.stop();
  }
}
