import EventEmitter from "eventemitter3";
import StrictEmitter from "strict-event-emitter-types";

import WaveSurfer from "wavesurfer.js";
import CursorPlugin from "wavesurfer.js/dist/plugin/wavesurfer.cursor.min.js";
import RegionsPlugin from "wavesurfer.js/dist/plugin/wavesurfer.regions.min.js";
import NewsEndCountdown from "../../assets/audio/NewsEndCountdown.wav";
import NewsIntro from "../../assets/audio/NewsIntro.wav";
import {Store} from "redux";
import {RootState} from "../../rootReducer";
import {mixerState} from "./state";
import * as BroadcastState from "../../broadcast/state";
import {load} from "./actions";

class Player {
  private volume = 0;
  private trim = 0;

  private constructor(
    private readonly store: Store<RootState>,
    private readonly engine: AudioEngine,
    private readonly player: number,
    private wavesurfer: WaveSurfer,
    private readonly waveform: HTMLElement
  ) {
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

  private handleEvents() {
    this.wavesurfer.on("ready", () => {
      console.log("ready");
      this.store.dispatch(mixerState.actions.itemLoadComplete({
        player: this.player,
        duration: this.wavesurfer.getDuration()
      }));
      const state = this.store.getState().mixer.players[this.player];
      if (state) {
        if (state.playOnLoad) {
          this.wavesurfer.play();
        }
        if (state.loadedItem && "intro" in state.loadedItem) {
          this.wavesurfer.addRegion({
            id: "intro",
            resize: false,
            start: 0,
            end: state.loadedItem.intro,
            color: "rgba(125,0,255, 0.12)",
          });
        }
      }
    });

    this.wavesurfer.on("play", () => {
      this.store.dispatch(mixerState.actions.setPlayerState({player: this.player, state: "playing"}));
    });

    this.wavesurfer.on("pause", () => {
      this.store.dispatch(
        mixerState.actions.setPlayerState({
          player: this.player,
          state: this.wavesurfer.getCurrentTime() === 0 ? "stopped" : "paused",
        })
      );
    });

    this.wavesurfer.on("seek", () => {
      this.handleTimeChange();
    });

    this.wavesurfer.on("finish", () => {
      this.handleFinish();
    });

    this.wavesurfer.on("audioprocess", () => {
      this.handleTimeChange();
    });
  }

  private handleFinish() {
    this.store.dispatch(mixerState.actions.setPlayerState({ player: this.player, state: "stopped" }));
    const state = this.store.getState().mixer.players[this.player];
    const item = state.loadedItem!;
    if (state.tracklistItemID !== -1) {
      this.store.dispatch(BroadcastState.tracklistEnd(state.tracklistItemID) as any); // TODO should probably not be in here
    }
    if (state.repeat === "one") {
      this.play();
    } else if (state.repeat === "all") {
      if ("channel" in item) {
        // it's not in the CML/libraries "column"
        const itsChannel = this.store.getState()
          .showplan.plan!.filter((x) => x.channel === item.channel)
          .sort((x, y) => x.weight - y.weight);
        const itsIndex = itsChannel.indexOf(item);
        if (itsIndex === itsChannel.length - 1) {
          this.store.dispatch(load(this.player, itsChannel[0]) as any); // TODO should probably not be in here
        }
      }
    } else if (state.autoAdvance) {
      if ("channel" in item) {
        // it's not in the CML/libraries "column"
        const itsChannel = this.store.getState()
          .showplan.plan!.filter((x) => x.channel === item.channel)
          .sort((x, y) => x.weight - y.weight);
        const itsIndex = itsChannel.indexOf(item);
        if (itsIndex > -1 && itsIndex !== itsChannel.length - 1) {
          this.store.dispatch(load(this.player, itsChannel[itsIndex + 1]) as any); // TODO should probably not be in here
        }
      }
    }
  }

  private handleTimeChange() {
    const time = this.wavesurfer.getCurrentTime();
    if (Math.abs(time - this.store.getState().mixer.players[this.player].timeCurrent) > 0.5) {
      this.store.dispatch(
        mixerState.actions.setTimeCurrent({
          player: this.player,
          time,
        })
      );
    }
  }

  public static create(store: Store<RootState>, engine: AudioEngine, player: number, url: string) {
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

    const instance = new this(store, engine, player, wavesurfer, waveform);

    instance.handleEvents();

    (wavesurfer as any).backend.gainNode.disconnect();
    (wavesurfer as any).backend.gainNode.connect(engine.finalCompressor);

    wavesurfer.load(url);

    return instance;
  }

  cleanup() {
    // Let wavesurfer remove the old media, otherwise ram leak!
    this.wavesurfer.destroy();
  }
}

export type LevelsSource = "mic-precomp" | "mic-final" | "master";

const ANALYSIS_FFT_SIZE = 8192;

interface EngineEvents {
  micOpen: () => void;
}

const EngineEmitter: StrictEmitter<EventEmitter,
  EngineEvents> = EventEmitter as any;

export class AudioEngine extends ((EngineEmitter as unknown) as {
  new (): EventEmitter;
}) {
  public audioContext: AudioContext;
  public players: (Player | undefined)[] = [];

  micMedia: MediaStream | null = null;
  micSource: MediaStreamAudioSourceNode | null = null;
  micCalibrationGain: GainNode;
  micPrecompAnalyser: AnalyserNode;
  micCompressor: DynamicsCompressorNode;
  micMixGain: GainNode;
  micFinalAnalyser: AnalyserNode;

  finalCompressor: DynamicsCompressorNode;
  streamingDestination: MediaStreamAudioDestinationNode;

  streamingAnalyser: AnalyserNode;

  newsStartCountdownEl: HTMLAudioElement;
  newsStartCountdownNode: MediaElementAudioSourceNode;

  newsEndCountdownEl: HTMLAudioElement;
  newsEndCountdownNode: MediaElementAudioSourceNode;

  analysisBuffer: Float32Array;

  constructor(private readonly store: Store<RootState>) {
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

    this.streamingAnalyser = this.audioContext.createAnalyser();
    this.streamingAnalyser.fftSize = ANALYSIS_FFT_SIZE;
    // this.streamingAnalyser.maxDecibels = 0;

    this.streamingDestination = this.audioContext.createMediaStreamDestination();

    this.finalCompressor.connect(this.audioContext.destination);

    this.finalCompressor
      .connect(this.streamingAnalyser)
      .connect(this.streamingDestination);

    this.micCalibrationGain = this.audioContext.createGain();

    this.micPrecompAnalyser = this.audioContext.createAnalyser();
    this.micPrecompAnalyser.fftSize = ANALYSIS_FFT_SIZE;
    this.micPrecompAnalyser.maxDecibels = 0;

    this.micFinalAnalyser = this.audioContext.createAnalyser();
    this.micFinalAnalyser.fftSize = ANALYSIS_FFT_SIZE;
    this.micFinalAnalyser.maxDecibels = 0;

    this.analysisBuffer = new Float32Array(ANALYSIS_FFT_SIZE);

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
    const player = Player.create(this.store, this, number, url);
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
        deviceId: {exact: deviceId},
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

  getLevel(source: LevelsSource) {
    switch (source) {
      case "mic-precomp":
        this.micPrecompAnalyser.getFloatTimeDomainData(this.analysisBuffer);
        break;
      case "mic-final":
        this.micFinalAnalyser.getFloatTimeDomainData(this.analysisBuffer);
        break;
      case "master":
        this.streamingAnalyser.getFloatTimeDomainData(this.analysisBuffer);
        break;
      default:
        throw new Error("can't getLevel " + source);
    }
    let peak = 0;
    for (let i = 0; i < this.analysisBuffer.length; i++) {
      peak = Math.max(peak, Math.abs(this.analysisBuffer[i]));
    }
    return 20 * Math.log10(peak);
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
