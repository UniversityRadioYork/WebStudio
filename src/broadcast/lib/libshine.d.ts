interface ShineOptions {
  samplerate?: number;
  bitrate?: number;
  channels?: number;
  mode: ShineChannelMode;
}

enum ShineChannelMode {
  STEREO = 0,
  JOINT_STEREO = 1,
  DUAL_CHANNEL = 2,
  MONO = 3,
}

declare class Shine {
  constructor(options: ShineOptions);
  static STEREO = ShineChannelMode.STEREO;
  static JOINT_STEREO = ShineChannelMode.JOINT_STEREO;
  static DUAL_CHANNEL = ShineChannelMode.DUAL_CHANNEL;
  static MONO = ShineChannelMode.MONO;

  encode(data: Array<Float32Array | Int16Array>): Uint8Array;
  close(): Uint8Array;
}
