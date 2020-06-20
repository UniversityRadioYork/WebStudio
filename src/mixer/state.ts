import {
  createSlice,
  PayloadAction,
  Dispatch,
  Middleware,
} from "@reduxjs/toolkit";
import fetchProgress, { FetchProgressData } from "fetch-progress";
import Between from "between.js";
import { itemId, PlanItem } from "../showplanner/state";
import * as BroadcastState from "../broadcast/state";
import Keys from "keymaster";
import { Track, MYRADIO_NON_API_BASE, AuxItem } from "../api";
import { AppThunk } from "../store";
import { RootState } from "../rootReducer";
import { audioEngine } from "./audio";
import * as TheNews from "./the_news";

const playerGainTweens: Array<{
  target: VolumePresetEnum;
  tweens: Between[];
}> = [];
const loadAbortControllers: AbortController[] = [];
const lastObjectURLs: string[] = [];

type PlayerStateEnum = "playing" | "paused" | "stopped";
type PlayerRepeatEnum = "none" | "one" | "all";
type VolumePresetEnum = "off" | "bed" | "full";
type MicVolumePresetEnum = "off" | "full";
export type MicErrorEnum = "NO_PERMISSION" | "NOT_SECURE_CONTEXT" | "UNKNOWN";

const defaultTrimDB = -6; // The default trim applied to channel players.

interface PlayerState {
  loadedItem: PlanItem | Track | AuxItem | null;
  loading: number;
  loadError: boolean;
  state: PlayerStateEnum;
  volume: number;
  gain: number;
  trim: number;
  timeCurrent: number;
  timeRemaining: number;
  timeLength: number;
  playOnLoad: Boolean;
  autoAdvance: Boolean;
  repeat: PlayerRepeatEnum;
  tracklistItemID: number;
}

interface MicState {
  open: boolean;
  openError: null | MicErrorEnum;
  volume: 1 | 0;
  baseGain: number;
  id: string | null;
}

interface MixerState {
  players: PlayerState[];
  mic: MicState;
}

const BasePlayerState: PlayerState = {
  loadedItem: null,
  loading: -1,
  state: "stopped",
  volume: 1,
  gain: 0,
  trim: defaultTrimDB,
  timeCurrent: 0,
  timeRemaining: 0,
  timeLength: 0,
  playOnLoad: false,
  autoAdvance: true,
  repeat: "none",
  tracklistItemID: -1,
  loadError: false,
};

const mixerState = createSlice({
  name: "Player",
  initialState: {
    players: [BasePlayerState, BasePlayerState, BasePlayerState],
    mic: {
      open: false,
      volume: 1,
      gain: 1,
      baseGain: 0,
      openError: null,
      id: "None",
    },
  } as MixerState,
  reducers: {
    loadItem(
      state,
      action: PayloadAction<{
        player: number;
        item: PlanItem | Track | AuxItem;
        resetTrim?: boolean;
      }>
    ) {
      state.players[action.payload.player].loadedItem = action.payload.item;
      state.players[action.payload.player].loading = 0;
      state.players[action.payload.player].timeCurrent = 0;
      state.players[action.payload.player].timeRemaining = 0;
      state.players[action.payload.player].timeLength = 0;
      state.players[action.payload.player].tracklistItemID = -1;
      state.players[action.payload.player].loadError = false;
      if (action.payload.resetTrim) {
        state.players[action.payload.player].trim = defaultTrimDB;
      }
    },
    itemLoadPercentage(
      state,
      action: PayloadAction<{ player: number; percent: number }>
    ) {
      state.players[action.payload.player].loading = action.payload.percent;
    },
    itemLoadComplete(state, action: PayloadAction<{ player: number }>) {
      state.players[action.payload.player].loading = -1;
    },
    itemLoadError(state, action: PayloadAction<{ player: number }>) {
      state.players[action.payload.player].loading = -1;
      state.players[action.payload.player].loadError = true;
    },
    setPlayerState(
      state,
      action: PayloadAction<{ player: number; state: PlayerStateEnum }>
    ) {
      state.players[action.payload.player].state = action.payload.state;
    },
    setPlayerVolume(
      state,
      action: PayloadAction<{
        player: number;
        volume: number;
      }>
    ) {
      state.players[action.payload.player].volume = action.payload.volume;
    },
    setPlayerGain(
      state,
      action: PayloadAction<{
        player: number;
        gain: number;
      }>
    ) {
      state.players[action.payload.player].gain = action.payload.gain;
    },
    setPlayerTrim(
      state,
      action: PayloadAction<{
        player: number;
        trim: number;
      }>
    ) {
      state.players[action.payload.player].trim = action.payload.trim;
    },
    setMicError(state, action: PayloadAction<null | MicErrorEnum>) {
      state.mic.openError = action.payload;
    },
    micOpen(state, action) {
      state.mic.open = true;
      state.mic.id = action.payload;
    },
    setMicLevels(state, action: PayloadAction<{ volume: 1 | 0 }>) {
      state.mic.volume = action.payload.volume;
    },
    setMicBaseGain(state, action: PayloadAction<number>) {
      state.mic.baseGain = action.payload;
    },
    setTimeCurrent(
      state,
      action: PayloadAction<{
        player: number;
        time: number;
      }>
    ) {
      state.players[action.payload.player].timeCurrent = action.payload.time;
      let timeRemaining =
        state.players[action.payload.player].timeLength - action.payload.time;
      state.players[action.payload.player].timeRemaining = timeRemaining;
    },
    setTimeLength(
      state,
      action: PayloadAction<{
        player: number;
        time: number;
      }>
    ) {
      state.players[action.payload.player].timeLength = action.payload.time;
    },
    toggleAutoAdvance(
      state,
      action: PayloadAction<{
        player: number;
      }>
    ) {
      state.players[action.payload.player].autoAdvance = !state.players[
        action.payload.player
      ].autoAdvance;
    },
    togglePlayOnLoad(
      state,
      action: PayloadAction<{
        player: number;
      }>
    ) {
      state.players[action.payload.player].playOnLoad = !state.players[
        action.payload.player
      ].playOnLoad;
    },
    toggleRepeat(
      state,
      action: PayloadAction<{
        player: number;
      }>
    ) {
      var playVal = state.players[action.payload.player].repeat;
      switch (playVal) {
        case "none":
          playVal = "one";
          break;
        case "one":
          playVal = "all";
          break;
        case "all":
          playVal = "none";
          break;
      }
      state.players[action.payload.player].repeat = playVal;
    },
    setTracklistItemID(
      state,
      action: PayloadAction<{
        player: number;
        id: number;
      }>
    ) {
      state.players[action.payload.player].tracklistItemID = action.payload.id;
    },
  },
});

export default mixerState.reducer;

export const { setMicBaseGain } = mixerState.actions;

export const load = (
  player: number,
  item: PlanItem | Track | AuxItem
): AppThunk => async (dispatch, getState) => {
  if (typeof audioEngine.players[player] !== "undefined") {
    if (audioEngine.players[player]?.isPlaying) {
      // already playing, don't kill playback
      return;
    }
  }
  // If this is already the currently loaded item, don't bother
  const currentItem = getState().mixer.players[player].loadedItem;
  if (currentItem !== null && itemId(currentItem) === itemId(item)) {
    return;
  }
  // If we're already loading something, abort it
  if (typeof loadAbortControllers[player] !== "undefined") {
    loadAbortControllers[player].abort();
  }
  loadAbortControllers[player] = new AbortController();

  const shouldResetTrim = getState().settings.resetTrimOnLoad;

  dispatch(
    mixerState.actions.loadItem({ player, item, resetTrim: shouldResetTrim })
  );

  let url;

  if ("album" in item) {
    // track
    url =
      MYRADIO_NON_API_BASE +
      "/NIPSWeb/secure_play?recordid=" +
      item.album.recordid +
      "&trackid=" +
      item.trackid;
  } else if ("managedid" in item) {
    url =
      MYRADIO_NON_API_BASE +
      "/NIPSWeb/managed_play?managedid=" +
      item.managedid;
  } else {
    throw new Error(
      "Unsure how to handle this!\r\n\r\n" + JSON.stringify(item)
    );
  }

  console.log("loading");

  let waveform = document.getElementById("waveform-" + player.toString());
  if (waveform == null) {
    throw new Error();
  }
  audioEngine.destroyPlayerIfExists(player); // clear previous (ghost) wavesurfer and it's media elements.
  // wavesurfer also sets the background white, remove for progress bar to work.
  waveform.style.removeProperty("background");

  try {
    const signal = loadAbortControllers[player].signal; // hang on to the signal, even if its controller gets replaced
    const result = await fetch(url, {
      credentials: "include",
      signal,
    }).then(
      fetchProgress({
        // implement onProgress method
        onProgress(progress: FetchProgressData) {
          const percent = progress.transferred / progress.total;
          if (percent !== 1) {
            dispatch(
              mixerState.actions.itemLoadPercentage({ player, percent })
            );
          }
        },
      })
    );
    const rawData = await result.arrayBuffer();
    const blob = new Blob([rawData]);
    const objectUrl = URL.createObjectURL(blob);

    const playerInstance = await audioEngine.createPlayer(player, objectUrl);

    // Clear the last one out from memory
    if (typeof lastObjectURLs[player] === "string") {
      URL.revokeObjectURL(lastObjectURLs[player]);
    }
    lastObjectURLs[player] = objectUrl;

    playerInstance.on("loadComplete", (duration) => {
      console.log("loadComplete");
      dispatch(mixerState.actions.itemLoadComplete({ player }));
      dispatch(
        mixerState.actions.setTimeLength({
          player,
          time: duration,
        })
      );
      dispatch(
        mixerState.actions.setTimeCurrent({
          player,
          time: 0,
        })
      );
      const state = getState().mixer.players[player];
      if (state.playOnLoad) {
        playerInstance.play();
      }
      if (state.loadedItem && "intro" in state.loadedItem) {
        playerInstance.setIntro(state.loadedItem.intro);
      }
    });

    playerInstance.on("play", () => {
      dispatch(mixerState.actions.setPlayerState({ player, state: "playing" }));
    });
    playerInstance.on("pause", () => {
      dispatch(
        mixerState.actions.setPlayerState({
          player,
          state: playerInstance.currentTime === 0 ? "stopped" : "paused",
        })
      );
    });
    playerInstance.on("timeChange", (time) => {
      if (Math.abs(time - getState().mixer.players[player].timeCurrent) > 0.5) {
        dispatch(
          mixerState.actions.setTimeCurrent({
            player,
            time,
          })
        );
      }
    });
    playerInstance.on("finish", () => {
      dispatch(mixerState.actions.setPlayerState({ player, state: "stopped" }));
      const state = getState().mixer.players[player];
      if (state.tracklistItemID !== -1) {
        dispatch(BroadcastState.tracklistEnd(state.tracklistItemID));
      }
      if (state.repeat === "one") {
        playerInstance.play();
      } else if (state.repeat === "all") {
        if ("channel" in item) {
          // it's not in the CML/libraries "column"
          const itsChannel = getState()
            .showplan.plan!.filter((x) => x.channel === item.channel)
            .sort((x, y) => x.weight - y.weight);
          const itsIndex = itsChannel.indexOf(item);
          if (itsIndex === itsChannel.length - 1) {
            dispatch(load(player, itsChannel[0]));
          }
        }
      } else if (state.autoAdvance) {
        if ("channel" in item) {
          // it's not in the CML/libraries "column"
          const itsChannel = getState()
            .showplan.plan!.filter((x) => x.channel === item.channel)
            .sort((x, y) => x.weight - y.weight);
          const itsIndex = itsChannel.indexOf(item);
          if (itsIndex > -1 && itsIndex !== itsChannel.length - 1) {
            dispatch(load(player, itsChannel[itsIndex + 1]));
          }
        }
      }
    });

    // Double-check we haven't been aborted since
    if (signal.aborted) {
      // noinspection ExceptionCaughtLocallyJS
      throw new DOMException("abort load", "AbortError");
    }

    playerInstance.setVolume(getState().mixer.players[player].gain);
    playerInstance.setTrim(getState().mixer.players[player].trim);
    delete loadAbortControllers[player];
  } catch (e) {
    if ("name" in e && e.name === "AbortError") {
      // load was aborted, ignore the error
    } else {
      console.error(e);
      dispatch(mixerState.actions.itemLoadError({ player }));
    }
  }
};

export const play = (player: number): AppThunk => async (
  dispatch,
  getState
) => {
  if (typeof audioEngine.players[player] === "undefined") {
    console.log("nothing loaded");
    return;
  }
  if (audioEngine.audioContext.state !== "running") {
    console.log("Resuming AudioContext because Chrome bad");
    await audioEngine.audioContext.resume();
  }
  const state = getState().mixer.players[player];
  if (state.loading !== -1) {
    console.log("not ready");
    return;
  }
  audioEngine.players[player]?.play();

  if (state.loadedItem && "album" in state.loadedItem) {
    //track
    console.log("potentially tracklisting", state.loadedItem);
    if (getState().mixer.players[player].tracklistItemID === -1) {
      dispatch(BroadcastState.tracklistStart(player, state.loadedItem.trackid));
    } else {
      console.log("not tracklisting because already tracklisted");
    }
  }
};

export const pause = (player: number): AppThunk => (dispatch, getState) => {
  if (typeof audioEngine.players[player] === "undefined") {
    console.log("nothing loaded");
    return;
  }
  if (getState().mixer.players[player].loading !== -1) {
    console.log("not ready");
    return;
  }
  if (audioEngine.players[player]?.isPlaying) {
    audioEngine.players[player]?.pause();
  } else {
    audioEngine.players[player]?.play();
  }
};

export const stop = (player: number): AppThunk => (dispatch, getState) => {
  if (typeof audioEngine.players[player] === "undefined") {
    console.log("nothing loaded");
    return;
  }
  var state = getState().mixer.players[player];
  if (state.loading !== -1) {
    console.log("not ready");
    return;
  }
  audioEngine.players[player]?.stop();
  // Incase wavesurver wasn't playing, it won't 'finish', so just make sure the UI is stopped.
  dispatch(mixerState.actions.setPlayerState({ player, state: "stopped" }));

  if (state.tracklistItemID !== -1) {
    dispatch(BroadcastState.tracklistEnd(state.tracklistItemID));
  }
};

export const {
  toggleAutoAdvance,
  togglePlayOnLoad,
  toggleRepeat,
} = mixerState.actions;

export const redrawWavesurfers = (): AppThunk => () => {
  audioEngine.players.forEach(function(item) {
    item?.redraw();
  });
};

export const { setTracklistItemID } = mixerState.actions;

const FADE_TIME_SECONDS = 1;
export const setVolume = (
  player: number,
  level: VolumePresetEnum
): AppThunk => (dispatch, getState) => {
  let volume: number;
  let uiLevel: number;
  switch (level) {
    case "off":
      volume = -40;
      uiLevel = 0;
      break;
    case "bed":
      volume = -13;
      uiLevel = 0.5;
      break;
    case "full":
      volume = 0;
      uiLevel = 1;
      break;
  }

  // Right, okay, big fun is happen.
  // To make the fade sound natural, we need to ramp it exponentially.
  // To make the UI look sensible, we need to ramp it linearly.
  // Time for cheating!

  if (typeof playerGainTweens[player] !== "undefined") {
    // We've interrupted a previous fade.
    // If we've just hit the button/key to go to the same value as that fade,
    // stop it and immediately cut to the target value.
    // Otherwise, stop id and start a new fade.
    playerGainTweens[player].tweens.forEach((tween) => tween.pause());
    if (playerGainTweens[player].target === level) {
      delete playerGainTweens[player];
      dispatch(mixerState.actions.setPlayerVolume({ player, volume: uiLevel }));
      dispatch(mixerState.actions.setPlayerGain({ player, gain: volume }));
      return;
    }
  }

  const state = getState().mixer.players[player];

  const currentLevel = state.volume;
  const currentGain = state.gain;
  const volumeTween = new Between(currentLevel, uiLevel)
    .time(FADE_TIME_SECONDS * 1000)
    .on("update", (val: number) => {
      dispatch(mixerState.actions.setPlayerVolume({ player, volume: val }));
    });
  const gainTween = new Between(currentGain, volume)
    .time(FADE_TIME_SECONDS * 1000)
    .on("update", (val: number) => {
      if (typeof audioEngine.players[player] !== "undefined") {
        audioEngine.players[player]?.setVolume(val);
      }
    })
    .on("complete", () => {
      dispatch(mixerState.actions.setPlayerGain({ player, gain: volume }));
      // clean up when done
      delete playerGainTweens[player];
    });

  playerGainTweens[player] = {
    target: level,
    tweens: [volumeTween, gainTween],
  };
};

export const setChannelTrim = (player: number, val: number): AppThunk => async (
  dispatch
) => {
  dispatch(mixerState.actions.setPlayerTrim({ player, trim: val }));
  audioEngine.players[player]?.setTrim(val);
};

export const openMicrophone = (micID: string): AppThunk => async (
  dispatch,
  getState
) => {
  // TODO: not sure why this is here, and I have a hunch it may break shit, so disabling
  // File a ticket if it breaks stuff. -Marks
  // if (getState().mixer.mic.open) {
  // 	micSource?.disconnect();
  // }
  if (audioEngine.audioContext.state !== "running") {
    console.log("Resuming AudioContext because Chrome bad");
    await audioEngine.audioContext.resume();
  }
  dispatch(mixerState.actions.setMicError(null));
  if (!("mediaDevices" in navigator)) {
    // mediaDevices is not there - we're probably not in a secure context
    dispatch(mixerState.actions.setMicError("NOT_SECURE_CONTEXT"));
    return;
  }
  try {
    await audioEngine.openMic(micID);
  } catch (e) {
    if (e instanceof DOMException) {
      switch (e.message) {
        case "Permission denied":
          dispatch(mixerState.actions.setMicError("NO_PERMISSION"));
          break;
        default:
          dispatch(mixerState.actions.setMicError("UNKNOWN"));
      }
    } else {
      dispatch(mixerState.actions.setMicError("UNKNOWN"));
    }
    return;
  }

  const state = getState().mixer.mic;
  audioEngine.setMicCalibrationGain(state.baseGain);
  audioEngine.setMicVolume(state.volume);

  dispatch(mixerState.actions.micOpen(micID));
};

export const setMicVolume = (level: MicVolumePresetEnum): AppThunk => (
  dispatch
) => {
  // no tween fuckery here, just cut the level
  const levelVal = level === "full" ? 1 : 0;
  // actually, that's a lie - if we're turning it off we delay it a little to compensate for
  // processing latency
  if (levelVal !== 0) {
    dispatch(mixerState.actions.setMicLevels({ volume: levelVal }));
  } else {
    window.setTimeout(() => {
      dispatch(mixerState.actions.setMicLevels({ volume: levelVal }));
      // latency, plus a little buffer
    }, audioEngine.audioContext.baseLatency * 1000 + 150);
  }
};

export const startNewsTimer = (): AppThunk => (_, getState) => {
  TheNews.butNowItsTimeFor(getState);
};

export const mixerMiddleware: Middleware<{}, RootState, Dispatch<any>> = (
  store
) => (next) => (action) => {
  const oldState = store.getState().mixer;
  const result = next(action);
  const newState = store.getState().mixer;

  newState.players.forEach((state, index) => {
    if (oldState.players[index].gain !== newState.players[index].gain) {
      audioEngine.players[index]?.setVolume(state.gain);
    }
  });

  if (newState.mic.baseGain !== oldState.mic.baseGain) {
    audioEngine.setMicCalibrationGain(newState.mic.baseGain);
  }
  if (newState.mic.volume !== oldState.mic.volume) {
    audioEngine.setMicVolume(newState.mic.volume);
  }
  return result;
};

export const mixerKeyboardShortcutsMiddleware: Middleware<
  {},
  RootState,
  Dispatch<any>
> = (store) => {
  Keys("q", () => {
    store.dispatch(play(0));
  });
  Keys("w", () => {
    store.dispatch(pause(0));
  });
  Keys("e", () => {
    store.dispatch(stop(0));
  });
  Keys("r", () => {
    store.dispatch(play(1));
  });
  Keys("t", () => {
    store.dispatch(pause(1));
  });
  Keys("y", () => {
    store.dispatch(stop(1));
  });
  Keys("u", () => {
    store.dispatch(play(2));
  });
  Keys("i", () => {
    store.dispatch(pause(2));
  });
  Keys("o", () => {
    store.dispatch(stop(2));
  });

  Keys("a", () => {
    store.dispatch(setVolume(0, "off"));
  });
  Keys("s", () => {
    store.dispatch(setVolume(0, "bed"));
  });
  Keys("d", () => {
    store.dispatch(setVolume(0, "full"));
  });
  Keys("f", () => {
    store.dispatch(setVolume(1, "off"));
  });
  Keys("g", () => {
    store.dispatch(setVolume(1, "bed"));
  });
  Keys("h", () => {
    store.dispatch(setVolume(1, "full"));
  });
  Keys("j", () => {
    store.dispatch(setVolume(2, "off"));
  });
  Keys("k", () => {
    store.dispatch(setVolume(2, "bed"));
  });
  Keys("l", () => {
    store.dispatch(setVolume(2, "full"));
  });

  Keys("x", () => {
    const state = store.getState().mixer.mic;
    store.dispatch(setMicVolume(state.volume === 1 ? "off" : "full"));
  });

  return (next) => (action) => next(action);
};
