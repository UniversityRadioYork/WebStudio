import {
  createSlice,
  PayloadAction,
  Dispatch,
  Middleware,
} from "@reduxjs/toolkit";
import fetchProgress, { FetchProgressData } from "fetch-progress";
import Between from "between.js";
import { itemId, PlanItem, setItemPlayed } from "../showplanner/state";
import * as BroadcastState from "../broadcast/state";
import Keys from "keymaster";
import { Track, MYRADIO_NON_API_BASE, AuxItem } from "../api";
import { AppThunk } from "../store";
import { RootState } from "../rootReducer";
import { audioEngine, ChannelMapping } from "./audio";
import * as audioActions from "./audio/actions";
import * as audioTypes from "./audio/types";
import * as TheNews from "./the_news";

const playerGainTweens: Array<{
  target: audioTypes.VolumePresetEnum;
  tweens: Between[];
}> = [];
const loadAbortControllers: AbortController[] = [];
const lastObjectURLs: string[] = [];

const defaultTrimDB = -6; // The default trim applied to channel players.

interface PlayerState {
  loadedItem: PlanItem | Track | AuxItem | null;
  loadedItemUrl: string | null;
  loading: number;
  loadError: boolean;
  state: audioTypes.PlayerStateEnum;
  volume: number;
  gain: number;
  trim: number;
  timeCurrent: number;
  timeRemaining: number;
  timeLength: number;
  shouldSeekOnTimeCurrentChange: boolean;
  playOnLoad: boolean;
  autoAdvance: boolean;
  repeat: audioTypes.PlayerRepeatEnum;
  tracklistItemID: number;
}

interface MicState {
  open: boolean;
  openError: null | audioTypes.MicErrorEnum;
  volume: 1 | 0;
  baseGain: number;
  id: string | null;
  processing: boolean;
}

interface MixerState {
  players: PlayerState[];
  mic: MicState;
}

const BasePlayerState: PlayerState = {
  loadedItem: null,
  loadedItemUrl: null,
  loading: -1,
  state: "stopped",
  volume: 1,
  gain: 0,
  trim: defaultTrimDB,
  timeCurrent: 0,
  timeRemaining: 0,
  timeLength: 0,
  shouldSeekOnTimeCurrentChange: false,
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
      processing: true,
    },
  } as MixerState,
  reducers: {
    loadItem(
      state,
      action: PayloadAction<{
        player: number;
        item: PlanItem | Track | AuxItem | null;
        customOutput: boolean;
        resetTrim?: boolean;
      }>
    ) {
      state.players[action.payload.player].loadedItem = action.payload.item;
      if (action.payload.item !== null) {
        state.players[action.payload.player].loading = 0;
      } else {
        // Unloaded player, No media selected.
        state.players[action.payload.player].loading = -1;
      }
      state.players[action.payload.player].timeCurrent = 0;
      state.players[action.payload.player].timeRemaining = 0;
      state.players[action.payload.player].timeLength = 0;
      state.players[action.payload.player].tracklistItemID = -1;
      state.players[action.payload.player].loadError = false;

      if (action.payload.customOutput) {
        state.players[action.payload.player].trim = 0;
      } else if (action.payload.resetTrim) {
        state.players[action.payload.player].trim = defaultTrimDB;
      }
    },
    itemLoadPercentage(
      state,
      action: PayloadAction<{ player: number; percent: number }>
    ) {
      state.players[action.payload.player].loading = action.payload.percent;
    },
    itemDownloaded(
      state,
      action: PayloadAction<{ player: number; url: string }>
    ) {
      state.players[action.payload.player].loadedItemUrl = action.payload.url;
    },
    itemLoadComplete(state, action: PayloadAction<{ player: number }>) {
      state.players[action.payload.player].loading = -1;
    },
    itemLoadError(state, action: PayloadAction<{ player: number }>) {
      state.players[action.payload.player].loading = -1;
      state.players[action.payload.player].loadError = true;
    },
    // setPlayerState(
    //   state,
    //   action: PayloadAction<{ player: number; state: PlayerStateEnum }>
    // ) {
    //   state.players[action.payload.player].state = action.payload.state;
    // },
    play(state, action: PayloadAction<{ player: number }>) {
      const playerState = state.players[action.payload.player];
      if (playerState.loadedItemUrl === null) {
        console.log("nothing loaded");
        return;
      }
      if (playerState.loading !== -1) {
        console.log("not ready");
        return;
      }

      state.players[action.payload.player].state = "playing";

      // TODO: this needs to move to showplan state as an extraAction
      /*
      dispatch(
        setItemPlayed({ itemId: itemId(state.loadedItem), played: true })
      );
      */
    },
    pause(state, action: PayloadAction<{ player: number }>) {
      const playerState = state.players[action.payload.player];
      if (playerState.loadedItemUrl === null) {
        console.log("nothing loaded");
        return;
      }
      if (playerState.loading !== -1) {
        console.log("not ready");
        return;
      }

      state.players[action.payload.player].state =
        playerState.timeCurrent === 0 ? "stopped" : "paused";
    },
    stop(state, action: PayloadAction<{ player: number }>) {
      const player = action.payload.player;
      const playerState = state.players[player];
      if (playerState.loadedItemUrl === null) {
        console.log("nothing loaded");
        return;
      }
      if (playerState.loading !== -1) {
        console.log("not ready");
        return;
      }

      state.players[player].state = "stopped";

      let cueTime = 0;

      if (
        playerState.loadedItem &&
        "cue" in playerState.loadedItem &&
        Math.round(playerState.timeCurrent) !==
          Math.round(playerState.loadedItem.cue)
      ) {
        cueTime = playerState.loadedItem.cue;
      }

      state.players[player].timeCurrent = cueTime;
      state.players[player].shouldSeekOnTimeCurrentChange = true;
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
    setLoadedItemIntro(
      state,
      action: PayloadAction<{
        player: number;
        secs: number;
      }>
    ) {
      const loadedItem = state.players[action.payload.player].loadedItem;
      if (loadedItem?.type === "central") {
        loadedItem.intro = action.payload.secs;
      }
    },
    setLoadedItemCue(
      state,
      action: PayloadAction<{
        player: number;
        secs: number;
      }>
    ) {
      const loadedItem = state.players[action.payload.player].loadedItem;
      if (loadedItem && "cue" in loadedItem) {
        loadedItem.cue = action.payload.secs;
      }
    },
    setLoadedItemOutro(
      state,
      action: PayloadAction<{
        player: number;
        secs: number;
      }>
    ) {
      const loadedItem = state.players[action.payload.player].loadedItem;
      if (loadedItem?.type === "central") {
        loadedItem.outro = action.payload.secs;
      }
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
    setMicProcessingEnabled(state, action: PayloadAction<boolean>) {
      state.mic.processing = action.payload;
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
  extraReducers: (builder) =>
    builder
      .addCase(audioActions.itemLoadComplete, (state, action) => {
        const player = action.payload.player;
        const loadedItem = state.players[player].loadedItem;
        state.players[player].loading = -1;
        state.players[player].timeLength = action.payload.duration;
        if (
          loadedItem !== null &&
          "cue" in loadedItem &&
          loadedItem.cue !== 0
        ) {
          state.players[player].timeCurrent = loadedItem.cue;
        } else {
          state.players[player].timeCurrent = 0;
        }
        state.players[player].timeRemaining =
          action.payload.duration - state.players[player].timeCurrent;
        if (state.players[player].playOnLoad) {
          state.players[player].state = "playing";
        } else {
          state.players[player].state = "stopped";
        }
      })
      .addCase(audioActions.timeChange, (state, action) => {
        const player = action.payload.player;
        state.players[player].timeCurrent = action.payload.currentTime;
        state.players[player].shouldSeekOnTimeCurrentChange = false;
      })
      .addCase(audioActions.finished, (state, action) => {
        const player = action.payload.player;
        const playerState = state.players[player];
        if (playerState.repeat === "one") {
          // Right back round you go!
          state.players[player].timeCurrent = 0;
          state.players[player].shouldSeekOnTimeCurrentChange = true;
        }
        // TODO: this needs to move to showplan state as an extraAction
        /*
        if (state.repeat === "all") {
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
            // Sadly, we can't just do .indexOf() item directly,
            // since the player's idea of an item may be changed over it's lifecycle (setting played,intro/cue/outro etc.)
            // Therefore we'll find the updated item from the plan and match that.
            const itsIndex = itsChannel.findIndex(
              (x) => itemId(x) === itemId(item)
            );
            if (itsIndex > -1 && itsIndex !== itsChannel.length - 1) {
              dispatch(load(player, itsChannel[itsIndex + 1]));
            }
          }
        }
      });
      */
      })
      .addCase(audioActions.micOpenError, (state, action) => {
        state.mic.openError = action.payload.code;
      }),
});

export default mixerState.reducer;

export const {
  setMicBaseGain,
  setLoadedItemIntro,
  setLoadedItemCue,
  setLoadedItemOutro,
  setPlayerTrim,
  toggleAutoAdvance,
  togglePlayOnLoad,
  toggleRepeat,
  setMicProcessingEnabled,
  play,
  pause,
  stop,
  setPlayerVolume,
} = mixerState.actions;

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

  // Can't really load a ghost, it'll break setting cues etc. Do nothing.
  if (item.type === "ghost") {
    return;
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
  const customOutput =
    getState().settings.channelOutputIds[player] !== "internal";

  dispatch(
    mixerState.actions.loadItem({
      player,
      item,
      customOutput,
      resetTrim: shouldResetTrim,
    })
  );

  let url;

  if (item.type === "central") {
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
    // Clear the last one out from memory
    if (typeof lastObjectURLs[player] === "string") {
      URL.revokeObjectURL(lastObjectURLs[player]);
    }

    // Double-check we haven't been aborted since
    if (signal.aborted) {
      // noinspection ExceptionCaughtLocallyJS
      throw new DOMException("abort load", "AbortError");
    }
    delete loadAbortControllers[player];

    const rawData = await result.arrayBuffer();
    const blob = new Blob([rawData]);
    const objectUrl = URL.createObjectURL(blob);

    dispatch(mixerState.actions.itemDownloaded({ player, url: objectUrl }));
    lastObjectURLs[player] = objectUrl;
  } catch (e) {
    if ("name" in e && e.name === "AbortError") {
      // load was aborted, ignore the error
    } else {
      console.error(e);
      dispatch(mixerState.actions.itemLoadError({ player }));
    }
  }
};

export const redrawWavesurfers = (): AppThunk => () => {
  audioEngine.players.forEach(function(item) {
    item?.redraw();
  });
};

export const { setTracklistItemID } = mixerState.actions;

const FADE_TIME_SECONDS = 1;
export const setVolume = (
  player: number,
  level: audioTypes.VolumePresetEnum
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
    // If we've just hit the button/key to go to the same value as that fade
    // (read: double-tapped it),
    // stop it and immediately cut to the target value.
    // Otherwise, stop it and start a new fade.
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
  let currentGain = state.gain;

  // If we can, use the engine's 'real' volume gain.
  // This helps when we've interupted a previous fade, so the state gain won't be correct.
  if (typeof audioEngine.players[player] !== "undefined") {
    currentGain = audioEngine.players[player]!.getVolume();
  }

  const volumeTween = new Between(currentLevel, uiLevel)
    .time(FADE_TIME_SECONDS * 1000)
    .on("update", (val: number) => {
      dispatch(mixerState.actions.setPlayerVolume({ player, volume: val }));
    });
  const gainTween = new Between(currentGain, volume)
    .time(FADE_TIME_SECONDS * 1000)
    .on("update", (val: number) => {
      dispatch(mixerState.actions.setPlayerGain({ player, gain: val }));
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

export const setMicVolume = (
  level: audioTypes.MicVolumePresetEnum
): AppThunk => (dispatch) => {
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

export const mixerKeyboardShortcutsMiddleware: Middleware<
  {},
  RootState,
  Dispatch<any>
> = (store) => {
  const play = (player: number) => mixerState.actions.play({ player });
  const pause = (player: number) => mixerState.actions.pause({ player });
  const stop = (player: number) => mixerState.actions.stop({ player });

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
