import EventEmitter from "eventemitter3";
import StrictEmitter from "strict-event-emitter-types";

import WaveSurfer from "wavesurfer.js";
import CursorPlugin from "wavesurfer.js/dist/plugin/wavesurfer.cursor.min.js";
import RegionsPlugin from "wavesurfer.js/dist/plugin/wavesurfer.regions.min.js";
import NewsEndCountdown from "../assets/audio/NewsEndCountdown.wav";
import NewsIntro from "../assets/audio/NewsIntro.wav";

interface PlayerEvents {
  loadComplete: (duration: number) => void;
  timeChange: (time: number) => void;
  play: () => void;
  pause: () => void;
  finish: () => void;
}

const PlayerEmitter: StrictEmitter<
  EventEmitter,
  PlayerEvents
> = EventEmitter as any;

class Player extends ((PlayerEmitter as unknown) as { new (): EventEmitter }) {
  private constructor(
    private readonly engine: AudioEngine,
    private wavesurfer: WaveSurfer,
    private readonly waveform: HTMLElement
  ) {
    super();
  }

  get isPlaying() {
    return this.wavesurfer.isPlaying();
  }

  get currentTime() {
    return this.wavesurfer.getCurrentTime();
  }

  play() {
    return this.wavesurfer.play();
  }

  pause() {
    return this.wavesurfer.pause();
  }

  stop() {
    return this.wavesurfer.stop();
  }

  redraw() {
    this.wavesurfer.drawBuffer();
  }

  setIntro(duration: number) {
    this.wavesurfer.addRegion({
      id: "intro",
      resize: false,
      start: 0,
      end: duration,
      color: "rgba(125,0,255, 0.12)",
    });
  }

  setVolume(val: number) {
    this.wavesurfer.setVolume(val);
  }

  public static create(engine: AudioEngine, player: number, url: string) {
    let waveform = document.getElementById("waveform-" + player.toString());
    if (waveform == null) {
      throw new Error();
    }
    waveform.innerHTML = "";
    const wavesurfer = WaveSurfer.create({
      audioContext: engine.audioContext,
      container: "#waveform-" + player.toString(),
      waveColor: "#CCCCFF",
      progressColor: "#9999FF",
      backend: "MediaElementWebAudio",
      responsive: true,
      xhr: {
        credentials: "include",
      } as any,
      plugins: [
        CursorPlugin.create({
          showTime: true,
          opacity: 1,
          customShowTimeStyle: {
            "background-color": "#000",
            color: "#fff",
            padding: "2px",
            "font-size": "10px",
          },
        }),
        RegionsPlugin.create({}),
      ],
    });

    const instance = new this(engine, wavesurfer, waveform);

    wavesurfer.on("ready", () => {
      console.log("ready");
      instance.emit("loadComplete", wavesurfer.getDuration());
    });
    wavesurfer.on("play", () => {
      instance.emit("play");
    });
    wavesurfer.on("pause", () => {
      instance.emit("pause");
    });
    wavesurfer.on("seek", () => {
      instance.emit("timeChange", wavesurfer.getCurrentTime());
    });
    wavesurfer.on("finish", () => {
      instance.emit("finish");
    });
    wavesurfer.on("audioprocess", () => {
      instance.emit("timeChange", wavesurfer.getCurrentTime());
    });

    (wavesurfer as any).backend.gainNode.disconnect();
    (wavesurfer as any).backend.gainNode.connect(engine.finalCompressor);
    (wavesurfer as any).backend.gainNode.connect(
      engine.audioContext.destination
    );

    wavesurfer.load(url);

    return instance;
  }
}

export class AudioEngine {
  public audioContext: AudioContext;
  public players: (Player | undefined)[] = [];

  micMedia: MediaStream | null = null;
  micSource: MediaStreamAudioSourceNode | null = null;
  micCalibrationGain: GainNode;
  micAnalyser: AnalyserNode;
  micCompressor: DynamicsCompressorNode;
  micMixGain: GainNode;

  finalCompressor: DynamicsCompressorNode;
  streamingDestination: MediaStreamAudioDestinationNode;

  newsStartCountdownEl: HTMLAudioElement;
  newsStartCountdownNode: MediaElementAudioSourceNode;

  newsEndCountdownEl: HTMLAudioElement;
  newsEndCountdownNode: MediaElementAudioSourceNode;

  analysisBuffer: Float32Array;

  constructor() {
    this.audioContext = new AudioContext({
      sampleRate: 44100,
      latencyHint: "interactive",
    });

    this.finalCompressor = this.audioContext.createDynamicsCompressor();
    this.finalCompressor.ratio.value = 20; //brickwall destination comressor
    this.finalCompressor.threshold.value = -0.5;
    this.finalCompressor.attack.value = 0;
    this.finalCompressor.release.value = 0.2;
    this.finalCompressor.connect(this.audioContext.destination);

    this.streamingDestination = this.audioContext.createMediaStreamDestination();
    this.finalCompressor.connect(this.streamingDestination);

    this.micCalibrationGain = this.audioContext.createGain();

    this.micAnalyser = this.audioContext.createAnalyser();
    this.micAnalyser.fftSize = 8192;

    this.analysisBuffer = new Float32Array(this.micAnalyser.fftSize);

    this.micCompressor = this.audioContext.createDynamicsCompressor();
    this.micCompressor.ratio.value = 3; // mic compressor - fairly gentle, can be upped
    this.micCompressor.threshold.value = -18;
    this.micCompressor.attack.value = 0.01;
    this.micCompressor.release.value = 0.1;

    this.micMixGain = this.audioContext.createGain();
    this.micMixGain.gain.value = 1;

    this.micCalibrationGain.connect(this.micAnalyser);
    this.micCalibrationGain
      .connect(this.micCompressor)
      .connect(this.micMixGain)
      .connect(this.streamingDestination);

    this.newsEndCountdownEl = new Audio(NewsEndCountdown);
    this.newsEndCountdownEl.preload = "auto";
    this.newsEndCountdownEl.volume = 0.5;
    this.newsEndCountdownNode = this.audioContext.createMediaElementSource(
      this.newsEndCountdownEl
    );
    this.newsEndCountdownNode.connect(this.audioContext.destination);

    this.newsStartCountdownEl = new Audio(NewsIntro);
    this.newsStartCountdownEl.preload = "auto";
    this.newsStartCountdownEl.volume = 0.5;
    this.newsStartCountdownNode = this.audioContext.createMediaElementSource(
      this.newsStartCountdownEl
    );
    this.newsStartCountdownNode.connect(this.audioContext.destination);
  }

  public createPlayer(number: number, url: string) {
    const player = Player.create(this, number, url);
    this.players[number] = player;
    return player;
  }

  async openMic(deviceId: string) {
    this.micMedia = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: { exact: deviceId },
        echoCancellation: false,
        autoGainControl: false,
        noiseSuppression: false,
        latency: 0.01,
      },
    });

    this.micSource = this.audioContext.createMediaStreamSource(this.micMedia);

    this.micSource.connect(this.micMixGain);
  }

  setMicCalibrationGain(value: number) {
    this.micCalibrationGain.gain.value = value;
  }

  setMicVolume(value: number) {
    this.micMixGain.gain.value = value;
  }

  getMicLevel() {
    this.micAnalyser.getFloatTimeDomainData(this.analysisBuffer);
    let peak = 0;
    for (let i = 0; i < this.analysisBuffer.length; i++) {
      peak = Math.max(peak, this.analysisBuffer[i] ** 2);
    }
    return 10 * Math.log10(peak);
  }

  async playNewsEnd() {
    this.newsEndCountdownEl.currentTime = 0;
    await this.newsEndCountdownEl.play();
  }

  async playNewsIntro() {
    this.newsStartCountdownEl.currentTime = 0;
    await this.newsStartCountdownEl.play();
  }
}

export const engine = new AudioEngine();
