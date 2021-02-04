export {};

(global as any).importScripts("/lib/libshine.js");

const ctx: Worker = self as any;

let shine: Shine;

let buffer: Uint8Array[];

onmessage = (msg) => {
  switch (msg.data.kind) {
    case "start":
      buffer = [];
      shine = new Shine({
        mode: Shine.STEREO,
        bitrate: 320,
        channels: 2,
        samplerate: 44100,
      });
      console.log("[RecordMp3] Shine created.");
      break;
    case "flush":
      const flushed = shine.close();
      buffer.push(flushed);
      ctx.postMessage({
        kind: "finished",
      });
      console.log("[RecordMp3] Finished, buffer", buffer.length);
      break;
    case "data":
      const encoded = shine.encode(msg.data.data);
      buffer.push(encoded);
      break;
    case "export":
      const blob = new Blob(buffer, {
        type: "audio/mp3",
      });
      console.log("[RecordMp3] Exported, blob", blob);
      ctx.postMessage({
        kind: "exported",
        data: blob,
      });
  }
};
