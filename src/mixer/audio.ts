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
  private pfl = false;
  private constructor(
    private readonly engine: AudioEngine,
    private wavesurfer: WaveSurfer,
    private readonly waveform: HTMLElement,
    private readonly customOutput: boolean
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

  setCurrentTime(secs: number) {
    this.wavesurfer.setCurrentTime(secs);
  }

  setIntro(duration: number) {
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

  setCue(startTime: number) {
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

  setOutro(startTime: number) {
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

  getPFL() {
    return this.pfl;
  }

  setVolume(val: number) {
    this.volume = val;
    this._applyVolume();
  }

  setTrim(val: number) {
    this.trim = val;
    this._applyVolume();
  }

  setPFL(enabled: boolean) {
    this.pfl = enabled;
    this._connectPFL();
  }

  setOutputDevice(sinkId: string) {
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

  _applyVolume() {
    const level = this.volume + this.trim;
    const linear = Math.pow(10, level / 20);

    // Actually adjust the wavesurfer gain node gain instead, so we can tap off analyser for PFL.
    this.wavesurfer.setVolume(1);
    if (!this.customOutput) {
      (this.wavesurfer as any).backend.gainNode.gain.value = linear;
    }
  }

  _connectPFL() {
    if (this.pfl) {
      console.log("Connecting PFL");

      // In this case, we just want to route the player output to the headphones direct.
      // Tap it from analyser to avoid the player volume.
      (this.wavesurfer as any).backend.analyser.connect(
        this.engine.headphonesNode
      );
    } else {
      try {
        (this.wavesurfer as any).backend.analyser.disconnect(
          this.engine.headphonesNode
        );
      } catch (e) {
        console.log("Didn't disconnect.");
      }
    }
  }

  public static create(
    engine: AudioEngine,
    player: number,
    outputId: string,
    pfl: boolean,
    url: string
  ) {
    // If we want to output to a custom audio device, we're gonna need to do things differently.
    const customOutput = outputId !== "internal";

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

    const instance = new this(engine, wavesurfer, waveform, customOutput);

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

    wavesurfer.load(url);

    if (customOutput) {
      try {
        instance.setOutputDevice(outputId);
      } catch (e) {
        console.error("Failed to set channel " + player + " output. " + e);
      }
    } else {
      (wavesurfer as any).backend.gainNode.disconnect();
      (wavesurfer as any).backend.gainNode.connect(engine.finalCompressor);
      (wavesurfer as any).backend.gainNode.connect(
        engine.playerAnalysers[player]
      );
      instance.setPFL(pfl);
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
  | "pfl"
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
  // Multipurpose Bits
  public audioContext: AudioContext;
  analysisBuffer: Float32Array;
  analysisBuffer2: Float32Array;

  // Mic Input

  micMedia: MediaStream | null = null;
  micSource: MediaStreamAudioSourceNode | null = null;
  micCalibrationGain: GainNode;
  micPrecompAnalyser: typeof StereoAnalyserNode;
  micCompressor: DynamicsCompressorNode;
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

  // Headphones
  headphonesNode: GainNode;
  pflAnalyser: typeof StereoAnalyserNode;

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

    // Headphones (for PFL / Monitoring)
    this.headphonesNode = this.audioContext.createGain();
    this.pflAnalyser = new StereoAnalyserNode(this.audioContext);
    this.pflAnalyser.fftSize = ANALYSIS_FFT_SIZE;
    this.pflAnalyser.maxDecibels = 0;

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

    this._connectFinalCompressor(true);

    // Send the streaming analyser to the Streamer!
    this.streamingAnalyser.connect(this.streamingDestination);

    // Feed the news in/out reminders to the headphones too.
    this.newsStartCountdownNode.connect(this.audioContext.destination);
    this.newsEndCountdownNode.connect(this.audioContext.destination);

    // Send the headphones feed to the headphones.
    const db = -12; // DB gain on headphones (-6 to match default trim)
    this.headphonesNode.gain.value = Math.pow(10, db / 20);
    this.headphonesNode.connect(this.audioContext.destination);
    this.headphonesNode.connect(this.pflAnalyser);
  }

  _connectFinalCompressor(headphones: boolean) {
    this.finalCompressor.disconnect();

    if (headphones) {
      // Send the final compressor (all players and guests) to the headphones.
      this.finalCompressor.connect(this.headphonesNode);
    }

    // Also send the final compressor to the streaming analyser on to the stream.
    this.finalCompressor.connect(this.streamingAnalyser);
  }

  public createPlayer(
    number: number,
    outputId: string,
    pfl: boolean,
    url: string
  ) {
    const player = Player.create(this, number, outputId, pfl, url);
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
  public destroyPlayerIfExists(number: number) {
    const existingPlayer = this.players[number];
    if (existingPlayer !== undefined) {
      // already a player setup. Clean it.
      existingPlayer.cleanup();
    }
    this.players[number] = undefined;
  }

  public setPFL(number: number, enabled: boolean) {
    var routeMainOut = true;
    var player = this.getPlayer(number);

    if (player) {
      player.setPFL(enabled);
    }

    for (let i = 0; i < this.players.length; i++) {
      player = this.getPlayer(i);
      if (player?.getPFL()) {
        // PFL is enabled on this channel, so we're not routing the regular output to H/Ps.
        routeMainOut = false;
        console.log("Player", i, "is PFL'd.");
      } else {
        console.log("Player", i, "isn't PFL'd.");
      }
    }
    console.log("Routing main out?", routeMainOut);

    this._connectFinalCompressor(routeMainOut);
  }

  async openMic(deviceId: string, channelMapping: ChannelMapping) {
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

  setMicCalibrationGain(value: number) {
    this.micCalibrationGain.gain.value =
      value === 0 ? 1 : Math.pow(10, value / 20);
  }

  setMicVolume(value: number) {
    this.micMixGain.gain.value = value;
  }

  setMicProcessingEnabled(value: boolean) {
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
      case "pfl":
        this.pflAnalyser.getFloatTimeDomainData(
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

export const audioEngine = new AudioEngine();
(window as any).AE = audioEngine;
