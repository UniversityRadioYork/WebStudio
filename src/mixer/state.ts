import {
  createSlice,
  PayloadAction,
  Dispatch,
  Middleware,
} from "@reduxjs/toolkit";
import fetchProgress, { FetchProgressData } from "fetch-progress";
import { itemId, PlanItem } from "../showplanner/state";
import Keys from "keymaster";
import { Track, AuxItem } from "../api";
import { AppThunk } from "../store";
import { RootState } from "../rootReducer";
import { audioEngine } from "./audio";
import { sendBAPSicleChannel } from "../bapsicle";

const loadAbortControllers: AbortController[] = [];
const lastObjectURLs: string[] = [];

export type PlayerStateEnum = "playing" | "paused" | "stopped";
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
    setAutoAdvance(
      state,
      action: PayloadAction<{
        player: number;
        enabled: boolean;
      }>
    ) {
      state.players[action.payload.player].autoAdvance = action.payload.enabled;
    },
    setPlayOnLoad(
      state,
      action: PayloadAction<{
        player: number;
        enabled: boolean;
      }>
    ) {
      state.players[action.payload.player].playOnLoad = action.payload.enabled;
    },
    setRepeat(
      state,
      action: PayloadAction<{
        player: number;
        mode: PlayerRepeatEnum;
      }>
    ) {
      state.players[action.payload.player].repeat = action.payload.mode;
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

export const seek = (player: number, time_s: number): AppThunk => async () => {
  const playerInstance = await audioEngine.getPlayer(player);

  if (playerInstance) {
    playerInstance.setCurrentTime(time_s);
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
    // The cue/intro/outro point(s) have changed.
    if ("cue" in currentItem && "cue" in item && currentItem.cue !== item.cue) {
      dispatch(setLoadedItemCue(player, item.cue));
    }
    if (
      "intro" in currentItem &&
      "intro" in item &&
      currentItem.intro !== item.intro
    ) {
      dispatch(setLoadedItemIntro(player, item.intro));
    }
    if (
      "outro" in currentItem &&
      "outro" in item &&
      currentItem.outro !== item.outro
    ) {
      dispatch(setLoadedItemOutro(player, item.outro));
    }
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
      "http://" +
      getState().session.currentServer?.hostname +
      ":13500/audiofile/track/" +
      item.trackid;
    //url = MYRADIO_NON_API_BASE + "/NIPSWeb/secure_play?trackid=" + item.trackid;
  } else if ("managedid" in item) {
    //url =
    //  MYRADIO_NON_API_BASE +
    //  "/NIPSWeb/managed_play?managedid=" +
    //  item.managedid;
    url =
      "http://" +
      getState().session.currentServer?.hostname +
      ":13500/audiofile/managed/" +
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
    });

    // Add the audio marker regions
    const state = getState().mixer.players[player];

    // TODO: This needs to happen without wavesurfer

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
    playerInstance.on("timeChangeSeek", (time) => {
      if (Math.abs(time - getState().mixer.players[player].timeCurrent) > 0.5) {
        sendBAPSicleChannel({ channel: player, command: "SEEK", time: time });
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
  sendBAPSicleChannel({ channel: player, command: "PLAY" });
};

export const pause = (player: number): AppThunk => (dispatch, getState) => {
  sendBAPSicleChannel({ channel: player, command: "PAUSE" });
};

export const stop = (player: number): AppThunk => (dispatch, getState) => {
  sendBAPSicleChannel({ channel: player, command: "STOP" });
};

export const {
  loadItem,
  setTimeLength,
  setTimeCurrent,
  setPlayerState,
  setAutoAdvance,
  itemLoadComplete,
  itemLoadPercentage,
  setPlayOnLoad,
  setRepeat,
} = mixerState.actions;

export const toggleAutoAdvance = (player: number): AppThunk => (
  dispatch,
  getState
) => {
  sendBAPSicleChannel({
    channel: player,
    command: "AUTOADVANCE",
    enabled: !getState().mixer.players[player].autoAdvance,
  });
};

export const togglePlayOnLoad = (player: number): AppThunk => (
  dispatch,
  getState
) => {
  sendBAPSicleChannel({
    channel: player,
    command: "PLAYONLOAD",
    enabled: !getState().mixer.players[player].playOnLoad,
  });
};

export const toggleRepeat = (player: number): AppThunk => (
  dispatch,
  getState
) => {
  var playVal = getState().mixer.players[player].repeat;
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
  sendBAPSicleChannel({ channel: player, command: "REPEAT", mode: playVal });
};

export const redrawWavesurfers = (): AppThunk => () => {
  audioEngine.players.forEach(function(item) {
    item?.redraw();
  });
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
