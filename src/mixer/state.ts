import {
  createSlice,
  PayloadAction,
  Dispatch,
  Middleware,
} from "@reduxjs/toolkit";
import fetchProgress, { FetchProgressData } from "fetch-progress";
import Between from "between.js";
import { itemId, PlanItem, setItemPlayed } from "../showplanner/state";
import Keys from "keymaster";
import { Track, MYRADIO_NON_API_BASE, AuxItem } from "../api";
import { AppThunk } from "../store";
import { RootState } from "../rootReducer";
import { audioEngine, ChannelMapping } from "./audio";
import { sendBAPSicleChannel } from "../bapsicle";

const playerGainTweens: Array<{
  target: VolumePresetEnum;
  tweens: Between[];
}> = [];
const loadAbortControllers: AbortController[] = [];
const lastObjectURLs: string[] = [];

type PlayerStateEnum = "playing" | "paused" | "stopped";
type PlayerRepeatEnum = "none" | "one" | "all";
type VolumePresetEnum = "off" | "bed" | "full";

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

interface MixerState {
  players: PlayerState[];
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
  } as MixerState,
  reducers: {
    loadItem(
      state,
      action: PayloadAction<{
        player: number;
        item: PlanItem | Track | AuxItem | null;
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

export const setLoadedItemIntro = (
  player: number,
  secs: number
): AppThunk => async (dispatch) => {
  dispatch(mixerState.actions.setLoadedItemIntro({ player, secs }));
  const playerInstance = audioEngine.getPlayer(player);
  if (playerInstance) {
    playerInstance.setIntro(secs);
  }
};

export const setLoadedItemCue = (
  player: number,
  secs: number
): AppThunk => async (dispatch) => {
  dispatch(mixerState.actions.setLoadedItemCue({ player, secs }));
  const playerInstance = audioEngine.getPlayer(player);
  if (playerInstance) {
    playerInstance.setCue(secs);
  }
};

export const setLoadedItemOutro = (
  player: number,
  secs: number
): AppThunk => async (dispatch) => {
  dispatch(mixerState.actions.setLoadedItemOutro({ player, secs }));
  const playerInstance = audioEngine.getPlayer(player);
  if (playerInstance) {
    playerInstance.setOutro(secs);
  }
};

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

  dispatch(
    mixerState.actions.loadItem({
      player,
      item,
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
      if (state.loadedItem && "cue" in state.loadedItem) {
        playerInstance.setCue(state.loadedItem.cue);
        playerInstance.setCurrentTime(state.loadedItem.cue);
      }
      if (state.loadedItem && "outro" in state.loadedItem) {
        playerInstance.setOutro(state.loadedItem.outro);
      }
    });

    playerInstance.on("play", () => {
      dispatch(mixerState.actions.setPlayerState({ player, state: "playing" }));

      const state = getState().mixer.players[player];
      if (state.loadedItem != null) {
        dispatch(
          setItemPlayed({ itemId: itemId(state.loadedItem), played: true })
        );
      }
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
    playerInstance.on("timeChangeSeek", (time) => {
      if (Math.abs(time - getState().mixer.players[player].timeCurrent) > 0.5) {
        sendBAPSicleChannel({ channel: player, command: "SEEK", time: time });
      }
    });
    playerInstance.on("finish", () => {
      dispatch(mixerState.actions.setPlayerState({ player, state: "stopped" }));
      const state = getState().mixer.players[player];
      if (state.tracklistItemID !== -1) {
        // dispatch(BroadcastState.tracklistEnd(state.tracklistItemID));
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
      // dispatch(BroadcastState.tracklistStart(player, state.loadedItem.trackid));
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
  const playerInstance = audioEngine.players[player];
  if (typeof playerInstance === "undefined") {
    console.log("nothing loaded");
    return;
  }
  var state = getState().mixer.players[player];
  if (state.loading !== -1) {
    console.log("not ready");
    return;
  }

  let cueTime = 0;

  if (
    state.loadedItem &&
    "cue" in state.loadedItem &&
    Math.round(playerInstance.currentTime) !== Math.round(state.loadedItem.cue)
  ) {
    cueTime = state.loadedItem.cue;
  }

  playerInstance.stop();

  dispatch(mixerState.actions.setTimeCurrent({ player, time: cueTime }));
  playerInstance.setCurrentTime(cueTime);

  // Incase wavesurver wasn't playing, it won't 'finish', so just make sure the UI is stopped.
  dispatch(mixerState.actions.setPlayerState({ player, state: "stopped" }));

  if (state.tracklistItemID !== -1) {
    // dispatch(BroadcastState.tracklistEnd(state.tracklistItemID));
  }
};

export const seek = (player: number, time: number): AppThunk => async (
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
  audioEngine.players[player]?.setCurrentTime(time);
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
export const setVolume = (player: number): AppThunk => (dispatch, getState) => {
  var volume = 0;

  const state = getState().mixer.players[player];

  const currentLevel = state.volume;
  let currentGain = state.gain;

  // If we can, use the engine's 'real' volume gain.
  // This helps when we've interupted a previous fade, so the state gain won't be correct.
  if (typeof audioEngine.players[player] !== "undefined") {
    currentGain = audioEngine.players[player]!.getVolume();
  }

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
    target: "full",
    tweens: [gainTween, gainTween],
  };
};

export const setChannelTrim = (player: number, val: number): AppThunk => async (
  dispatch
) => {
  dispatch(mixerState.actions.setPlayerTrim({ player, trim: val }));
  audioEngine.players[player]?.setTrim(val);
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

  return result;
};

export const mixerKeyboardShortcutsMiddleware: Middleware<
  {},
  RootState,
  Dispatch<any>
> = (store) => {
  Keys("q", () => {
    sendBAPSicleChannel({ channel: 0, command: "PLAY" });
  });
  Keys("w", () => {
    sendBAPSicleChannel({ channel: 0, command: "PAUSE" });
  });
  Keys("e", () => {
    sendBAPSicleChannel({ channel: 0, command: "STOP" });
  });
  Keys("r", () => {
    sendBAPSicleChannel({ channel: 1, command: "PLAY" });
  });
  Keys("t", () => {
    sendBAPSicleChannel({ channel: 1, command: "PAUSE" });
  });
  Keys("y", () => {
    sendBAPSicleChannel({ channel: 1, command: "STOP" });
  });
  Keys("u", () => {
    sendBAPSicleChannel({ channel: 2, command: "PLAY" });
  });
  Keys("i", () => {
    sendBAPSicleChannel({ channel: 2, command: "PAUSE" });
  });
  Keys("o", () => {
    sendBAPSicleChannel({ channel: 2, command: "STOP" });
  });

  return (next) => (action) => next(action);
};
