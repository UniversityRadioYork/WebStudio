import EventEmitter from "eventemitter3";
import StrictEmitter from "strict-event-emitter-types";

import WaveSurfer from "wavesurfer.js";
import CursorPlugin from "wavesurfer.js/dist/plugin/wavesurfer.cursor.min.js";
import RegionsPlugin from "wavesurfer.js/dist/plugin/wavesurfer.regions.min.js";
import NewsEndCountdown from "../assets/audio/NewsEndCountdown.wav";
import NewsIntro from "../assets/audio/NewsIntro.wav";

import StereoAnalyserNode from "stereo-analyser-node";


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
  private volume = 0;
  private trim = 0;
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
    this.volume = val;
    this._applyVolume();
  }

  setTrim(val: number) {
    this.trim = val;
    this._applyVolume();
  }

  _applyVolume() {
    const level = this.volume + this.trim;
    const linear = Math.pow(10, level / 20);
    if (linear < 1) {
      this.wavesurfer.setVolume(linear);
      (this.wavesurfer as any).backend.gainNode.gain.value = 1;
    } else {
      this.wavesurfer.setVolume(1);
      (this.wavesurfer as any).backend.gainNode.gain.value = linear;
    }
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
      backgroundColor: "#FFFFFF",
      progressColor: "#9999FF",
      backend: "MediaElementWebAudio",
      barWidth: 2,
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
            padding: "4px",
            "font-size": "14px",
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
    (wavesurfer as any).backend.gainNode.connect(engine.playerAnalysers[player])

    wavesurfer.load(url);

    return instance;
  }

  cleanup() {
    // Unsubscribe from events.
    this.wavesurfer.unAll();
    // Let wavesurfer remove the old media, otherwise ram leak!
    // See https://github.com/katspaugh/wavesurfer.js/issues/1940.
    delete (this.wavesurfer as any).backend.buffer;
    this.wavesurfer.destroy();
  }
}

export type LevelsSource = "mic-precomp" | "mic-final" | "master" | "player-0" | "player-1" | "player-2";

const ANALYSIS_FFT_SIZE = 8192;

interface EngineEvents {
  micOpen: () => void;
}

const EngineEmitter: StrictEmitter<
  EventEmitter,
  EngineEvents
> = EventEmitter as any;

export class AudioEngine extends ((EngineEmitter as unknown) as {
  new (): EventEmitter;
}) {
  public audioContext: AudioContext;
  public players: (Player | undefined)[] = [];

  micMedia: MediaStream | null = null;
  micSource: MediaStreamAudioSourceNode | null = null;
  micCalibrationGain: GainNode;
  micPrecompAnalyser: StereoAnalyserNode;
  micCompressor: DynamicsCompressorNode;
  micMixGain: GainNode;
  micFinalAnalyser: StereoAnalyserNode;

  finalCompressor: DynamicsCompressorNode;
  streamingDestination: MediaStreamAudioDestinationNode;

  player0Analyser: StereoAnalyserNode;
  player1Analyser: StereoAnalyserNode;
  player2Analyser: StereoAnalyserNode;
  playerAnalysers: StereoAnalyserNode[];

  streamingAnalyser: StereoAnalyserNode;

  newsStartCountdownEl: HTMLAudioElement;
  newsStartCountdownNode: MediaElementAudioSourceNode;

  newsEndCountdownEl: HTMLAudioElement;
  newsEndCountdownNode: MediaElementAudioSourceNode;


  constructor() {
    super();
    this.audioContext = new AudioContext({
      sampleRate: 44100,
      latencyHint: "interactive",
    });

    this.finalCompressor = this.audioContext.createDynamicsCompressor();
    this.finalCompressor.ratio.value = 20; //brickwall destination comressor
    this.finalCompressor.threshold.value = -0.5;
    this.finalCompressor.attack.value = 0;
    this.finalCompressor.release.value = 0.2;
    this.finalCompressor.knee.value = 0;

    this.player0Analyser = new StereoAnalyserNode(this.audioContext);
    this.player0Analyser.fftSize = ANALYSIS_FFT_SIZE;
    this.player1Analyser = new StereoAnalyserNode(this.audioContext);
    this.player1Analyser.fftSize = ANALYSIS_FFT_SIZE;
    this.player2Analyser = new StereoAnalyserNode(this.audioContext);
    this.player2Analyser.fftSize = ANALYSIS_FFT_SIZE;




    this.playerAnalysers = [this.player0Analyser, this.player1Analyser, this.player2Analyser];

    this.streamingAnalyser = new StereoAnalyserNode(this.audioContext);
    this.streamingAnalyser.fftSize = ANALYSIS_FFT_SIZE;

    // this.streamingAnalyser.maxDecibels = 0;

    this.streamingDestination = this.audioContext.createMediaStreamDestination();

    this.finalCompressor.connect(this.audioContext.destination);

    this.finalCompressor
      .connect(this.streamingAnalyser)
      .connect(this.streamingDestination);

    this.micCalibrationGain = this.audioContext.createGain();

    this.micPrecompAnalyser = new StereoAnalyserNode(this.audioContext);
    this.micPrecompAnalyser.fftSize = ANALYSIS_FFT_SIZE;
    this.micPrecompAnalyser.maxDecibels = 0;

    this.micFinalAnalyser = new StereoAnalyserNode(this.audioContext);
    this.micFinalAnalyser.fftSize = ANALYSIS_FFT_SIZE;
    this.micFinalAnalyser.maxDecibels = 0;

    this.micCompressor = this.audioContext.createDynamicsCompressor();
    this.micCompressor.ratio.value = 3; // mic compressor - fairly gentle, can be upped
    this.micCompressor.threshold.value = -18;
    this.micCompressor.attack.value = 0.01;
    this.micCompressor.release.value = 0.1;
    this.micCompressor.knee.value = 1;

    this.micMixGain = this.audioContext.createGain();
    this.micMixGain.gain.value = 1;

    this.micCalibrationGain
      .connect(this.micPrecompAnalyser)
    this.micCalibrationGain
      .connect(this.micCompressor)
      .connect(this.micMixGain)
      .connect(this.micFinalAnalyser)
      // we don't run the mic into masterAnalyser to ensure it doesn't go to audioContext.destination
      .connect(this.streamingAnalyser);

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

  // Wavesurfer needs cleanup to remove the old audio mediaelements. Memory leak!
  public destroyPlayerIfExists(number: number) {
    const existingPlayer = this.players[number];
    if (existingPlayer !== undefined) {
      // already a player setup. Clean it.
      existingPlayer.cleanup();
    }
    this.players[number] = undefined;
  }

  async openMic(deviceId: string) {
    if (this.micSource !== null && this.micMedia !== null) {
      this.micMedia.getAudioTracks()[0].stop();
      this.micSource.disconnect();
      this.micSource = null;
      this.micMedia = null;
    }
    console.log("opening mic", deviceId);
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

    this.micSource.connect(this.micCalibrationGain);

    this.emit("micOpen");
  }

  setMicCalibrationGain(value: number) {
    this.micCalibrationGain.gain.value =
      value === 0 ? 1 : Math.pow(10, value / 20);
  }

  setMicVolume(value: number) {
    this.micMixGain.gain.value = value;
  }

  getLevels(source: LevelsSource, stereo: boolean) {
    let analysisBuffer = new Float32Array(ANALYSIS_FFT_SIZE);
    let analysisBuffer2 = new Float32Array(ANALYSIS_FFT_SIZE);
    switch (source) {
      case "mic-precomp":
        this.micPrecompAnalyser.getFloatTimeDomainData(analysisBuffer, analysisBuffer2);
        break;
      case "mic-final":
        this.micFinalAnalyser.getFloatTimeDomainData(analysisBuffer, analysisBuffer2);
        break;
      case "master":
        this.streamingAnalyser.getFloatTimeDomainData(analysisBuffer, analysisBuffer2);
        break;
      case "player-0":
        this.player0Analyser.getFloatTimeDomainData(analysisBuffer, analysisBuffer2);
        break;
      case "player-1":
        this.player1Analyser.getFloatTimeDomainData(analysisBuffer, analysisBuffer2);
        break;
      case "player-2":
        this.player2Analyser.getFloatTimeDomainData(analysisBuffer, analysisBuffer2);
        break;
      default:
        throw new Error("can't getLevel " + source);
    }
    let peakL = 0;
    for (let i = 0; i < analysisBuffer.length; i++) {
      peakL = Math.max(peakL, Math.abs(analysisBuffer[i]));
    }
    peakL = 20 * Math.log10(peakL);

    if (stereo) {
      let peakR = 0;
      for (let i = 0; i < analysisBuffer2.length; i++) {
        peakR = Math.max(peakR, Math.abs(analysisBuffer2[i]));
      }
      peakR = 20 * Math.log10(peakR);
      return [peakL, peakR]
    }
    return [peakL];
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

export const audioEngine = new AudioEngine();
(window as any).AE = audioEngine;
