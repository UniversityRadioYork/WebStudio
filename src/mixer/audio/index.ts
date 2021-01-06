import EventEmitter from "eventemitter3";
import StrictEmitter from "strict-event-emitter-types";
import { Action, Dispatch, Middleware } from "@reduxjs/toolkit";

import WaveSurfer from "wavesurfer.js";
import CursorPlugin from "wavesurfer.js/dist/plugin/wavesurfer.cursor.min.js";
import RegionsPlugin from "wavesurfer.js/dist/plugin/wavesurfer.regions.min.js";

import StereoAnalyserNode from "stereo-analyser-node";
import { RootState } from "../../rootReducer";
import * as AudioActions from "./actions";

import NewsEndCountdown from "../assets/audio/NewsEndCountdown.wav";
import NewsIntro from "../assets/audio/NewsIntro.wav";
import { MicErrorEnum as MicOpenErrorEnum, PlayerStateEnum } from "./types";

// I'd really quite like to do this, and TypeScript understands it,
// but Prettier doesn't! Argh!
// export * as actions from "./actions";
// export * as types from "./types";

interface PlayerState {
  /**
   * This should only be null when the player hasn't had anything loaded into it.
   * If you set this null *after* initialising a Player, bad things will happen!
   */
  loadedUrl: string | null;
  state: PlayerStateEnum;
  volume: number;
  trim: number;
  timeCurrent: number;
  /**
   * If we only had timeCurrent, the player would seek every time
   * its position changed. Instead, it only seeks when this flag is set.
   */
  timeCurrentSeek: boolean;
  intro?: number;
  cue?: number;
  outro?: number;
  sinkID: string | null;
}

class Player {
  private volume = 0;
  private trim = 0;
  loadedUrl!: string;
  private constructor(
    private readonly engine: AudioEngine,
    private readonly idx: number,
    private wavesurfer: WaveSurfer,
    private readonly waveform: HTMLElement,
    private readonly customOutput: boolean
  ) {}

  get isPlaying() {
    return this.wavesurfer.isPlaying();
  }

  get currentTime() {
    return this.wavesurfer.getCurrentTime();
  }

  private play() {
    return this.wavesurfer.play();
  }

  private pause() {
    return this.wavesurfer.pause();
  }

  private stop() {
    return this.wavesurfer.stop();
  }

  redraw() {
    this.wavesurfer.drawBuffer();
  }

  private setCurrentTime(secs: number) {
    this.wavesurfer.setCurrentTime(secs);
  }

  private setIntro(duration: number) {
    if ("intro" in this.wavesurfer.regions.list) {
      this.wavesurfer.regions.list.intro.end = duration;
      this.redraw();
      return;
    }

    this.wavesurfer.addRegion({
      id: "intro",
      resize: false,
      drag: false,
      start: 0,
      end: duration,
      color: "rgba(125,0,255, 0.3)",
    });
  }

  private setCue(startTime: number) {
    const duration = this.wavesurfer.getDuration();
    const cueWidth = 0.01 * duration; // Cue region marker to be 1% of track length
    if ("cue" in this.wavesurfer.regions.list) {
      this.wavesurfer.regions.list.cue.start = startTime;
      this.wavesurfer.regions.list.cue.end = startTime + cueWidth;
      this.redraw();
      return;
    }

    this.wavesurfer.addRegion({
      id: "cue",
      resize: false,
      drag: false,
      start: startTime,
      end: startTime + cueWidth,
      color: "rgba(0,100,0, 0.8)",
    });
  }

  private setOutro(startTime: number) {
    if ("outro" in this.wavesurfer.regions.list) {
      // If the outro is set to 0, we assume that's no outro.
      if (startTime === 0) {
        // Can't just delete the outro, so set it to the end of the track to hide it.
        this.wavesurfer.regions.list.outro.start = this.wavesurfer.regions.list.outro.end;
      } else {
        this.wavesurfer.regions.list.outro.start = startTime;
      }

      this.redraw();
      return;
    }

    // Again, only show a region if it's not the whole song with default of 0.
    if (startTime !== 0) {
      this.wavesurfer.addRegion({
        id: "outro",
        resize: false,
        drag: false,
        start: startTime,
        end: this.wavesurfer.getDuration(),
        color: "rgba(255, 0, 0, 0.2)",
      });
    }
  }

  getVolume() {
    return this.volume;
  }

  private _applyVolume() {
    const level = this.volume + this.trim;
    const linear = Math.pow(10, level / 20);
    if (linear < 1) {
      this.wavesurfer.setVolume(linear);
      if (!this.customOutput) {
        (this.wavesurfer as any).backend.gainNode.gain.value = 1;
      }
    } else {
      this.wavesurfer.setVolume(1);
      if (!this.customOutput) {
        (this.wavesurfer as any).backend.gainNode.gain.value = linear;
      }
    }
  }

  private setOutputDevice(sinkId: string) {
    if (!this.customOutput) {
      throw Error(
        "Can't set sinkId when player is not in customOutput mode. Please reinit player."
      );
    }
    try {
      (this.wavesurfer as any).setSinkId(sinkId);
    } catch (e) {
      throw Error("Tried to setSinkId " + sinkId + ", failed due to: " + e);
    }
  }

  public onStateChange(state: PlayerState) {
    if (state.loadedUrl !== this.loadedUrl) {
      throw new Error(
        "PlayerState.loadedUrl changed. This can't be done via onStateChanged, please recreate the player!"
      );
    }
    switch (state.state) {
      case "stopped":
        if (this.isPlaying) {
          this.stop();
        }
        break;
      case "paused":
        if (this.isPlaying) {
          this.pause();
        }
        break;
      case "playing":
        if (!this.isPlaying) {
          this.play();
        }
        break;
    }

    this.volume = state.volume;
    this.trim = state.trim;
    this._applyVolume();

    if (state.timeCurrentSeek) {
      this.setCurrentTime(state.timeCurrent);
    }

    if (state.intro) {
      this.setIntro(state.intro);
    }

    if (state.cue) {
      this.setCue(state.cue);
    }

    if (state.outro) {
      this.setOutro(state.outro);
    }

    if (state.sinkID) {
      this.setOutputDevice(state.sinkID);
    }
  }

  public static create(
    engine: AudioEngine,
    player: number,
    state: PlayerState
  ) {
    if (state.loadedUrl === null) {
      throw new Error(
        "Tried to create a player with PlayerState.loadedUrl null"
      );
    }

    // If we want to output to a custom audio device, we're gonna need to do things differently.
    const customOutput = state.sinkID !== null && state.sinkID !== "internal";

    let waveform = document.getElementById("waveform-" + player.toString());
    if (waveform == null) {
      throw new Error();
    }
    waveform.innerHTML = "";
    const wavesurfer = WaveSurfer.create({
      audioContext: engine.audioContext,
      container: "#waveform-" + player.toString(),
      cursorColor: "#777",
      cursorWidth: 3,
      waveColor: "#CCCCFF",
      backgroundColor: "#FFFFFF",
      progressColor: "#9999FF",
      backend: customOutput ? "MediaElement" : "MediaElementWebAudio",
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

    const instance = new this(
      engine,
      player,
      wavesurfer,
      waveform,
      customOutput
    );
    instance.loadedUrl = state.loadedUrl;

    wavesurfer.on("ready", () => {
      console.log("ready");
      engine.dispatch(
        AudioActions.itemLoadComplete({
          player,
          duration: wavesurfer.getDuration(),
        })
      );
    });
    wavesurfer.on("seek", () => {
      engine.dispatch(
        AudioActions.timeChange({
          player,
          currentTime: wavesurfer.getCurrentTime(),
        })
      );
    });
    wavesurfer.on("finish", () => {
      engine.dispatch(AudioActions.finished({ player }));
    });
    wavesurfer.on("audioprocess", () => {
      engine.dispatch(
        AudioActions.timeChange({
          player,
          currentTime: wavesurfer.getCurrentTime(),
        })
      );
    });

    wavesurfer.load(state.loadedUrl);

    if (customOutput) {
      try {
        instance.setOutputDevice(state.sinkID!);
      } catch (e) {
        console.error("Failed to set channel " + player + " output. " + e);
      }
    } else {
      (wavesurfer as any).backend.gainNode.disconnect();
      (wavesurfer as any).backend.gainNode.connect(engine.finalCompressor);
      (wavesurfer as any).backend.gainNode.connect(
        engine.playerAnalysers[player]
      );
    }

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

export type LevelsSource =
  | "mic-precomp"
  | "mic-final"
  | "master"
  | "player-0"
  | "player-1"
  | "player-2";

export type ChannelMapping =
  | "stereo-normal"
  | "stereo-flipped"
  | "mono-left"
  | "mono-right"
  | "mono-both";

// Setting this directly affects the performance of .getFloatTimeDomainData()
// Must be a power of 2.
const ANALYSIS_FFT_SIZE = 2048;

interface AudioEngineState {
  micDeviceId: string | null;
  micChannelMapping: ChannelMapping;
  micCalibrationGain: number;
  micVolume: number;
  micProcessingEnabled: boolean;
  players: PlayerState[];
}

function rootStateToAudioEngineState(state: RootState): AudioEngineState {
  return {
    micDeviceId: state.mixer.mic.id,
    micChannelMapping: "mono-both", // TODO
    micCalibrationGain: state.mixer.mic.baseGain,
    micVolume: state.mixer.mic.volume,
    micProcessingEnabled: state.mixer.mic.processing,
    players: state.mixer.players.map<PlayerState>((p, idx) => {
      const result: PlayerState = {
        loadedUrl: p.loadedItemUrl, // TODO
        state: p.state,
        timeCurrent: p.timeCurrent,
        timeCurrentSeek: false, // TODO
        volume: p.volume,
        trim: p.trim,
        sinkID: state.settings.channelOutputIds[idx],
        intro: undefined,
        cue: undefined,
        outro: undefined,
      };

      const loadedItem = p.loadedItem;
      if (loadedItem) {
        if ("intro" in loadedItem) {
          result.intro = loadedItem.intro;
        }
        if ("outro" in loadedItem) {
          result.outro = loadedItem.outro;
        }
        if ("cue" in loadedItem) {
          result.cue = loadedItem.cue;
        }
      }

      return result;
    }),
  };
}

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
  // The ! is to avoid a chicken-and-egg problem - the middleware needs the engine, while the engine
  // needs dispatch from the middleware.
  // Don't mess with this.
  dispatch!: Dispatch;

  // Multipurpose Bits
  public audioContext: AudioContext;
  analysisBuffer: Float32Array;
  analysisBuffer2: Float32Array;

  // Mic Input

  micDeviceId: string | null = null;
  micChannelMapping: ChannelMapping | null = null;

  micMedia: MediaStream | null = null;
  micSource: MediaStreamAudioSourceNode | null = null;

  micCalibrationGainValDb: number;
  micCalibrationGain: GainNode;

  micProcessingEnabled: boolean = true;
  micPrecompAnalyser: typeof StereoAnalyserNode;
  micCompressor: DynamicsCompressorNode;

  micMixGainValLinear: number;
  micMixGain: GainNode;

  micFinalAnalyser: typeof StereoAnalyserNode;

  // Player Inputs
  public players: (Player | undefined)[] = [];
  playerAnalysers: typeof StereoAnalyserNode[];

  // Final Processing
  finalCompressor: DynamicsCompressorNode;

  // Streaming / Recording
  streamingAnalyser: typeof StereoAnalyserNode;
  streamingDestination: MediaStreamAudioDestinationNode;

  // News In/Out Reminders
  newsStartCountdownEl: HTMLAudioElement;
  newsStartCountdownNode: MediaElementAudioSourceNode;

  newsEndCountdownEl: HTMLAudioElement;
  newsEndCountdownNode: MediaElementAudioSourceNode;

  constructor() {
    super();

    // Multipurpose Bits
    this.audioContext = new AudioContext({
      sampleRate: 44100,
      latencyHint: "interactive",
    });

    this.analysisBuffer = new Float32Array(ANALYSIS_FFT_SIZE);
    this.analysisBuffer2 = new Float32Array(ANALYSIS_FFT_SIZE);

    // Mic Input

    this.micCalibrationGain = this.audioContext.createGain();
    this.micCalibrationGainValDb = 0;

    this.micPrecompAnalyser = new StereoAnalyserNode(this.audioContext);
    this.micPrecompAnalyser.fftSize = ANALYSIS_FFT_SIZE;
    this.micPrecompAnalyser.maxDecibels = 0;

    this.micCompressor = this.audioContext.createDynamicsCompressor();
    this.micCompressor.ratio.value = 3; // mic compressor - fairly gentle, can be upped
    this.micCompressor.threshold.value = -18;
    this.micCompressor.attack.value = 0.01;
    this.micCompressor.release.value = 0.1;
    this.micCompressor.knee.value = 1;

    this.micMixGain = this.audioContext.createGain();
    this.micMixGain.gain.value = 1;
    this.micMixGainValLinear = 1;

    this.micFinalAnalyser = new StereoAnalyserNode(this.audioContext);
    this.micFinalAnalyser.fftSize = ANALYSIS_FFT_SIZE;
    this.micFinalAnalyser.maxDecibels = 0;

    // Player Input

    this.playerAnalysers = [];
    for (let i = 0; i < 3; i++) {
      let analyser = new StereoAnalyserNode(this.audioContext);
      analyser.fftSize = ANALYSIS_FFT_SIZE;
      this.playerAnalysers.push(analyser);
    }

    // Final Processing

    this.finalCompressor = this.audioContext.createDynamicsCompressor();
    this.finalCompressor.ratio.value = 20; //brickwall destination comressor
    this.finalCompressor.threshold.value = -0.5;
    this.finalCompressor.attack.value = 0;
    this.finalCompressor.release.value = 0.2;
    this.finalCompressor.knee.value = 0;

    // Streaming/Recording

    this.streamingAnalyser = new StereoAnalyserNode(this.audioContext);
    this.streamingAnalyser.fftSize = ANALYSIS_FFT_SIZE;

    this.streamingDestination = this.audioContext.createMediaStreamDestination();

    // News In/Out Reminders

    this.newsEndCountdownEl = new Audio(NewsEndCountdown);
    this.newsEndCountdownEl.preload = "auto";
    this.newsEndCountdownEl.volume = 0.5;
    this.newsEndCountdownNode = this.audioContext.createMediaElementSource(
      this.newsEndCountdownEl
    );

    this.newsStartCountdownEl = new Audio(NewsIntro);
    this.newsStartCountdownEl.preload = "auto";
    this.newsStartCountdownEl.volume = 0.5;
    this.newsStartCountdownNode = this.audioContext.createMediaElementSource(
      this.newsStartCountdownEl
    );

    // Routing the above bits together

    // Mic Source gets routed to micCompressor or micMixGain.
    // We run setMicProcessingEnabled() later to either patch to the compressor, or bypass it to the mixGain node.
    this.micCompressor.connect(this.micMixGain);

    // Send the final mic feed to the VU meter and Stream.
    // We bypass the finalCompressor to ensure it doesn't go to audioContext.destination
    // since this will cause delayed mic monitoring. Speech jam central!
    this.micMixGain
      .connect(this.micFinalAnalyser)
      .connect(this.streamingAnalyser);

    // Send the final compressor (all players and guests) to the headphones.
    this.finalCompressor.connect(this.audioContext.destination);

    // Also send the final compressor to the streaming analyser on to the stream.
    this.finalCompressor.connect(this.streamingAnalyser);

    // Send the streaming analyser to the Streamer!
    this.streamingAnalyser.connect(this.streamingDestination);

    // Feed the news in/out reminders to the headphones too.
    this.newsStartCountdownNode.connect(this.audioContext.destination);
    this.newsEndCountdownNode.connect(this.audioContext.destination);
  }

  private createPlayer(number: number, state: PlayerState) {
    const player = Player.create(this, number, state);
    this.players[number] = player;
    return player;
  }

  public getPlayer(number: number) {
    if (number < this.players.length) {
      return this.players[number];
    }
    return null;
  }

  // Wavesurfer needs cleanup to remove the old audio mediaelements. Memory leak!
  private destroyPlayerIfExists(number: number) {
    const existingPlayer = this.players[number];
    if (existingPlayer !== undefined) {
      // already a player setup. Clean it.
      existingPlayer.cleanup();
    }
    this.players[number] = undefined;
  }

  private async openMic(deviceId: string, channelMapping: ChannelMapping) {
    if (this.micSource !== null && this.micMedia !== null) {
      this.micMedia.getAudioTracks()[0].stop();
      this.micSource.disconnect();
      this.micSource = null;
      this.micMedia = null;
    }
    if (this.audioContext.state !== "running") {
      console.log("Resuming AudioContext because Chrome bad");
      await this.audioContext.resume();
    }
    console.log("opening mic", deviceId, channelMapping);
    this.micDeviceId = deviceId;
    this.micChannelMapping = channelMapping;

    if (!("mediaDevices" in navigator)) {
      // mediaDevices is not there - we're probably not in a secure context
      this.dispatch(AudioActions.micOpenError({ code: "NOT_SECURE_CONTEXT" }));
      return;
    }

    try {
      this.micMedia = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: deviceId },
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false,
          latency: 0.01,
        },
      });
    } catch (e) {
      let error: MicOpenErrorEnum;
      if (e instanceof DOMException) {
        switch (e.message) {
          case "Permission denied":
            error = "NO_PERMISSION";
            break;
          default:
            error = "UNKNOWN";
        }
      } else {
        error = "UNKNOWN";
      }
      this.dispatch(AudioActions.micOpenError({ code: error }));
      return;
    }

    this.dispatch(AudioActions.micOpenError({ code: null }));

    this.micSource = this.audioContext.createMediaStreamSource(this.micMedia);

    // Handle stereo mic sources.
    const splitterNode = this.audioContext.createChannelSplitter(2);
    const mergerNode = this.audioContext.createChannelMerger(2);
    this.micSource.connect(splitterNode);
    switch (channelMapping) {
      case "stereo-normal":
        splitterNode.connect(mergerNode, 0, 0);
        splitterNode.connect(mergerNode, 1, 1);
        break;
      case "stereo-flipped":
        splitterNode.connect(mergerNode, 1, 0);
        splitterNode.connect(mergerNode, 0, 1);
        break;
      case "mono-left":
        splitterNode.connect(mergerNode, 0, 0);
        splitterNode.connect(mergerNode, 0, 1);
        break;
      case "mono-right":
        splitterNode.connect(mergerNode, 1, 0);
        splitterNode.connect(mergerNode, 1, 1);
        break;
      case "mono-both":
      default:
        splitterNode.connect(mergerNode, 0, 0);
        splitterNode.connect(mergerNode, 1, 0);
        splitterNode.connect(mergerNode, 0, 1);
        splitterNode.connect(mergerNode, 1, 1);
    }

    mergerNode.connect(this.micCalibrationGain);
    this.emit("micOpen");
  }

  private setMicCalibrationGain(value: number) {
    this.micCalibrationGain.gain.value =
      value === 0 ? 1 : Math.pow(10, value / 20);
    this.micCalibrationGainValDb = value;
  }

  private setMicVolume(value: number) {
    this.micMixGain.gain.value = value;
    this.micMixGainValLinear = value;
  }

  private setMicProcessingEnabled(value: boolean) {
    /*
     * Disconnect whatever was connected before.
     * It's either connected to micCompressor or micMixGain
     * (depending on if we're going from enabled to disabled or vice - versa).
     * Also connected is the micPrecompAnalyser), but you can't disconnect only one node,
     * so you have to disconnect all anyway.
     */
    this.micCalibrationGain.disconnect();
    this.micCalibrationGain.connect(this.micPrecompAnalyser);
    console.log("Setting mic processing to: ", value);
    if (value) {
      this.micCalibrationGain.connect(this.micCompressor);
    } else {
      this.micCalibrationGain.connect(this.micMixGain);
    }
  }

  onStateChange(state: AudioEngineState) {
    if (state.micCalibrationGain !== this.micCalibrationGainValDb) {
      this.setMicCalibrationGain(state.micCalibrationGain);
    }

    if (state.micVolume != this.micMixGainValLinear) {
      this.setMicVolume(state.micVolume);
    }

    if (
      state.micDeviceId != this.micDeviceId ||
      state.micChannelMapping != this.micChannelMapping
    ) {
      if (state.micDeviceId !== null) {
        this.openMic(state.micDeviceId, state.micChannelMapping);
      }
    }

    if (state.micProcessingEnabled != this.micProcessingEnabled) {
      this.setMicProcessingEnabled(state.micProcessingEnabled);
    }

    state.players.forEach((playerState, idx) => {
      const player = this.players[idx];
      if (!player) {
        console.warn(
          `Got a state update for player ${idx} that doesn't exist!`
        );
        return;
      }
      // If we've loaded in a different item, recreate the player
      if (player.loadedUrl != playerState.loadedUrl) {
        this.destroyPlayerIfExists(idx);
        if (playerState.loadedUrl !== null) {
          this.createPlayer(idx, playerState);
        }
      } else {
        // If it's the same thing, updating its state will suffice.
        player.onStateChange(playerState);
      }
    });
  }

  getLevels(source: LevelsSource, stereo: boolean): [number, number] {
    switch (source) {
      case "mic-precomp":
        this.micPrecompAnalyser.getFloatTimeDomainData(
          this.analysisBuffer,
          this.analysisBuffer2
        );
        break;
      case "mic-final":
        this.micFinalAnalyser.getFloatTimeDomainData(
          this.analysisBuffer,
          this.analysisBuffer2
        );
        break;
      case "master":
        this.streamingAnalyser.getFloatTimeDomainData(
          this.analysisBuffer,
          this.analysisBuffer2
        );
        break;
      case "player-0":
        this.playerAnalysers[0].getFloatTimeDomainData(
          this.analysisBuffer,
          this.analysisBuffer2
        );
        break;
      case "player-1":
        this.playerAnalysers[1].getFloatTimeDomainData(
          this.analysisBuffer,
          this.analysisBuffer2
        );
        break;
      case "player-2":
        this.playerAnalysers[2].getFloatTimeDomainData(
          this.analysisBuffer,
          this.analysisBuffer2
        );
        break;
      default:
        throw new Error("can't getLevel " + source);
    }
    let peakL = 0;
    for (let i = 0; i < this.analysisBuffer.length; i++) {
      peakL = Math.max(peakL, Math.abs(this.analysisBuffer[i]));
    }
    peakL = 20 * Math.log10(peakL);

    if (stereo) {
      let peakR = 0;
      for (let i = 0; i < this.analysisBuffer2.length; i++) {
        peakR = Math.max(peakR, Math.abs(this.analysisBuffer2[i]));
      }
      peakR = 20 * Math.log10(peakR);
      return [peakL, peakR];
    }
    return [peakL, 0];
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

function createAudioEngineMiddleware(
  engine: AudioEngine
): Middleware<{}, RootState> {
  return (store) => {
    engine.dispatch = store.dispatch;
    return (next) => (action) => {
      const nextState = next(action);
      const aeState = rootStateToAudioEngineState(nextState);
      engine.onStateChange(aeState);
      return nextState;
    };
  };
}

export const audioEngine = new AudioEngine();
(window as any).AE = audioEngine;
export const audioEngineMiddleware = createAudioEngineMiddleware(audioEngine);
