import EventEmitter from "eventemitter3";
import StrictEmitter from "strict-event-emitter-types";

import WaveSurfer from "wavesurfer.js";
import CursorPlugin from "wavesurfer.js/dist/plugin/wavesurfer.cursor.min.js";
import RegionsPlugin from "wavesurfer.js/dist/plugin/wavesurfer.regions.min.js";

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
  private ignore_next_seek: boolean = false;
  private constructor(
    private readonly engine: AudioEngine,
    private readonly player: Number,
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

  redraw() {
    this.wavesurfer.drawBuffer();
  }

  setCurrentTime(secs: number) {
    // Only trouble wavesurfer if we've actually moved
    if (
      secs >= 0 &&
      this.wavesurfer.getDuration() > 0 &&
      Math.abs(this.wavesurfer.getCurrentTime() - secs) >= 0.1
    ) {
      this.ignore_next_seek = true;
      this.wavesurfer.setCurrentTime(secs);
    }
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
      // Just in case the outro end was incorrect before (possibly 0, so would be at beginning and not work)
      this.wavesurfer.regions.list.outro.end = this.wavesurfer.getDuration();
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

  public static create(engine: AudioEngine, player: number, url: string) {
    // If we want to output to a custom audio device, we're gonna need to do things differently.
    const customOutput = false;

    let waveform = document.getElementById("waveform-" + player.toString());
    if (waveform == null) {
      throw new Error();
    }
    waveform.innerHTML = "";
    const wavesurfer = WaveSurfer.create({
      container: "#waveform-" + player.toString(),
      cursorColor: "#777",
      cursorWidth: 3,
      waveColor: "#CCCCFF",
      backgroundColor: "#FFFFFF",
      progressColor: "#9999FF",
      backend: "MediaElementWebAudio",
      barWidth: 1,
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
      if (instance.ignore_next_seek) {
        instance.ignore_next_seek = false;
      } else {
        instance.emit("timeChangeSeek", wavesurfer.getCurrentTime());
      }
      instance.emit("timeChange", wavesurfer.getCurrentTime());
    });
    wavesurfer.on("finish", () => {
      instance.emit("finish");
    });
    wavesurfer.on("audioprocess", () => {
      instance.emit("timeChange", wavesurfer.getCurrentTime());
    });

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
  // Players
  public players: (Player | undefined)[] = [];

  public createPlayer(number: number, url: string) {
    const player = Player.create(this, number, url);
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
}

export const audioEngine = new AudioEngine();
(window as any).AE = audioEngine;
