import {
  createSlice,
  PayloadAction,
  Dispatch,
  Middleware,
  MiddlewareAPI,
} from "@reduxjs/toolkit";
import fetchProgress, { FetchProgressData } from "fetch-progress";
import Between from "between.js";
import { itemId, PlanItem, setItemPlayed } from "../showplanner/state";
import * as BroadcastState from "../broadcast/state";
import Keys from "keymaster";
import { Track, MYRADIO_NON_API_BASE, AuxItem } from "../api";
import { AppThunk } from "../store";
import { RootState } from "../rootReducer";

import {
  audioEngine,
  ChannelMapping,
  INTERNAL_OUTPUT_ID,
  PLAYER_COUNT,
  PLAYER_ID_PREVIEW,
  DEFAULT_TRIM_DB,
  OFF_LEVEL_DB,
  BED_LEVEL_DB,
  FULL_LEVEL_DB,
} from "./audio";

import * as TheNews from "./the_news";
import { sendBAPSicleChannel } from "../bapsicle";

import { changeSetting } from "../optionsMenu/settingsState";
import { PLAYER_COUNTER_UPDATE_PERIOD_MS } from "../showplanner/Player";

import { changeSetting } from "../optionsMenu/settingsState";
import {
  DEFAULT_TRIM_DB,
  OFF_LEVEL_DB,
  BED_LEVEL_DB,
  FULL_LEVEL_DB,
} from "./audio";
import { PLAYER_COUNTER_UPDATE_PERIOD_MS } from "../showplanner/Player";

const playerGainTweens: Array<{
  target: VolumePresetEnum;
  tweens: Between[];
}> = [];

const loadAbortControllers: AbortController[] = [];
const lastObjectURLs: string[] = [];

export type PlayerStateEnum = "playing" | "paused" | "stopped";
type PlayerRepeatEnum = "none" | "one" | "all";
type VolumePresetEnum = "off" | "bed" | "full";
type MicVolumePresetEnum = "off" | "full";
export type MicErrorEnum = "NO_PERMISSION" | "NOT_SECURE_CONTEXT" | "UNKNOWN";

interface PlayerState {
  loadedItem: PlanItem | Track | AuxItem | null;
  loading: number;
  loadError: boolean;
  state: PlayerStateEnum;
  volume: number;
  volumeEnum: VolumePresetEnum;
  gain: number;
  trim: number;
  micAutoDuck: boolean;
  pfl: boolean;
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
  processing: boolean;
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
  volumeEnum: "full",
  gain: 0,
  micAutoDuck: false,
  trim: DEFAULT_TRIM_DB,
  pfl: false,
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
    // Fill the players with channel and preview players.
    players: Array(PLAYER_COUNT).fill(BasePlayerState),
    mic: {
      open: false,
      volume: 1,
      volumeEnum: "full",
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

      if (!process.env.REACT_APP_BAPSICLE_INTERFACE) {
        if (action.payload.customOutput) {
          state.players[action.payload.player].trim = 0;
        } else if (action.payload.resetTrim) {
          state.players[action.payload.player].trim = DEFAULT_TRIM_DB;
        }
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
        volumeEnum: VolumePresetEnum;
      }>
    ) {
      state.players[action.payload.player].volume = action.payload.volume;
      state.players[action.payload.player].volumeEnum =
        action.payload.volumeEnum;
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
    setPlayerMicAutoDuck(
      state,
      action: PayloadAction<{
        player: number;
        enabled: boolean;
      }>
    ) {
      state.players[action.payload.player].micAutoDuck = action.payload.enabled;
    },
    setPlayerPFL(
      state,
      action: PayloadAction<{
        player: number;
        enabled: boolean;
      }>
    ) {
      state.players[action.payload.player].pfl = action.payload.enabled;
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
        mode?: PlayerRepeatEnum;
      }>
    ) {
      if (action.payload.mode) {
        state.players[action.payload.player].repeat = action.payload.mode;
        return;
      }
      // If we don't specify an option, toggle it.
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

export const seek = (player: number, time_s: number): AppThunk => async () => {
  const playerInstance = await audioEngine.getPlayer(player);

  if (playerInstance) {
    playerInstance.setCurrentTime(time_s);
  }
};

export const load = (
  player: number,
  item: PlanItem | Track | AuxItem | null
): AppThunk => async (dispatch, getState) => {
  if (typeof audioEngine.players[player] !== "undefined") {
    if (audioEngine.players[player]?.isPlaying) {
      // already playing, don't kill playback
      return;
    }
  }

  if (!item) {
    // Unload the player.
    dispatch(
      mixerState.actions.loadItem({
        player,
        item,
        customOutput: false,
      })
    );
    return;
  }

  // If somehow we've managed to re-load the channel without ending tracklisting.
  // This could happen if they paused it at the end, or if Wavesurfer forgot somehow.
  if (!process.env.REACT_APP_BAPSICLE_INTERFACE) {
    const tracklistItemID = getState().mixer.players[player].tracklistItemID;
    if (tracklistItemID !== -1) {
      dispatch(BroadcastState.tracklistEnd(tracklistItemID));
    }
  }
  // Can't really load a ghost, it'll break setting cues etc. Do nothing.
  if (item.type === "ghost") {
    return;
  }

  // If this is already the currently loaded item, don't bother reloading the item, short circuit.
  const currentItem = getState().mixer.players[player].loadedItem;
  if (currentItem !== null && itemId(currentItem) === itemId(item)) {
    if (process.env.REACT_APP_BAPSICLE_INTERFACE) {
      // The cue/intro/outro point(s) have changed.
      if (
        "cue" in currentItem &&
        "cue" in item &&
        currentItem.cue !== item.cue
      ) {
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
    }
    return;
  }
  // If we're already loading something, abort it
  if (typeof loadAbortControllers[player] !== "undefined") {
    loadAbortControllers[player].abort();
  }
  loadAbortControllers[player] = new AbortController();

  const shouldResetTrim = getState().settings.resetTrimOnLoad;
  const customOutput =
    getState().settings.channelOutputIds[player] !== INTERNAL_OUTPUT_ID;
  const isPFL = getState().mixer.players[player].pfl;

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

    if (process.env.REACT_APP_BAPSICLE_INTERFACE) {
      url =
        "http://" +
        getState().bapsSession.currentServer?.hostname +
        ":13500/audiofile/track/" +
        item.trackid;
    } else {
      url =
        MYRADIO_NON_API_BASE + "/NIPSWeb/secure_play?trackid=" + item.trackid;
    }
  } else if ("managedid" in item) {
    if (process.env.REACT_APP_BAPSICLE_INTERFACE) {
      url =
        "http://" +
        getState().bapsSession.currentServer?.hostname +
        ":13500/audiofile/managed/" +
        item.managedid;
    } else {
      url =
        MYRADIO_NON_API_BASE +
        "/NIPSWeb/managed_play?managedid=" +
        item.managedid;
    }
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

    let channelOutputId = getState().settings.channelOutputIds[player];
    // If the player setting doesn't exist, reset the settings. (Happens after player count is increased)
    if (!channelOutputId) {
      channelOutputId = INTERNAL_OUTPUT_ID;
      dispatch(
        changeSetting({
          key: "channelOutputIds",
          val: Array(PLAYER_COUNT).fill(channelOutputId),
        })
      );
    }

    const playerInstance = await audioEngine.createPlayer(
      player,
      channelOutputId,
      isPFL,
      objectUrl
    );

    // Clear the last one out from memory
    if (typeof lastObjectURLs[player] === "string") {
      URL.revokeObjectURL(lastObjectURLs[player]);
    }
    lastObjectURLs[player] = objectUrl;

    playerInstance.on("loadComplete", (duration) => {
      console.log("loadComplete");
      dispatch(mixerState.actions.itemLoadComplete({ player }));

      if (!process.env.REACT_APP_BAPSICLE_INTERFACE) {
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
      }

      // Add the audio marker regions, we have to do these after load complete, since otherwise it won't know the end of the file duration!
      const state = getState().mixer.players[player];

      if (!process.env.REACT_APP_BAPSICLE_INTERFACE) {
        if (state.playOnLoad) {
          playerInstance.play();
        }
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

      if (process.env.REACT_APP_BAPSICLE_INTERFACE) {
        playerInstance.on("timeChangeSeek", (time) => {
          if (
            Math.abs(time - getState().mixer.players[player].timeCurrent) > 0.5
          ) {
            sendBAPSicleChannel({
              channel: player,
              command: "SEEK",
              time: time,
            });
          }
        });
      } else {
        playerInstance.on("play", () => {
          dispatch(
            mixerState.actions.setPlayerState({ player, state: "playing" })
          );

      const state = getState().mixer.players[player];
      // Don't set played on Preview Channel
      if (state.loadedItem != null && player !== PLAYER_ID_PREVIEW) {
        dispatch(
          dispatch(setItemPlayed(itemId(state.loadedItem), true));
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
      if (
        Math.abs(time - getState().mixer.players[player].timeCurrent) >
        PLAYER_COUNTER_UPDATE_PERIOD_MS / 1000
      ) {
        dispatch(
          mixerState.actions.setTimeCurrent({
            player,
            time,
          })
        );
      }
    });
    playerInstance.on("finish", () => {
      // If the Preview Player finishes playing, turn off PFL in the UI.
      if (player === PLAYER_ID_PREVIEW) {
        dispatch(setChannelPFL(player, false));
      }
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
  if (process.env.REACT_APP_BAPSICLE_INTERFACE) {
    sendBAPSicleChannel({ channel: player, command: "PLAY" });
    return;
  }

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

  // If it's the Preview player starting, turn on PFL automatically.
  if (player === PLAYER_ID_PREVIEW) {
    dispatch(setChannelPFL(player, true));
  }
  audioEngine.players[player]?.play();

  // If we're starting off audible, try and tracklist.
  if (state.volume > 0) {
    dispatch(attemptTracklist(player));
  }
};

const attemptTracklist = (player: number): AppThunk => async (
  dispatch,
  getState
) => {
  const state = getState().mixer.players[player];
  if (
    state.loadedItem &&
    state.loadedItem.type === "central" &&
    audioEngine.players[player]?.isPlaying &&
    player !== PLAYER_ID_PREVIEW
  ) {
    //track
    console.log("potentially tracklisting", state.loadedItem);
    if (state.tracklistItemID === -1) {
      dispatch(BroadcastState.tracklistStart(player, state.loadedItem.trackid));
    } else {
      console.log("not tracklisting because already tracklisted");
    }
  }
};

export const pause = (player: number): AppThunk => (dispatch, getState) => {
  if (process.env.REACT_APP_BAPSICLE_INTERFACE) {
    sendBAPSicleChannel({ channel: player, command: "PAUSE" });
    return;
  }

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
    // If it's the Preview player starting, turn on PFL automatically.
    if (player === PLAYER_ID_PREVIEW) {
      dispatch(setChannelPFL(player, true));
    }
    audioEngine.players[player]?.play();
  }
};

export const unpause = (player: number): AppThunk => (dispatch, getState) => {
  if (process.env.REACT_APP_BAPSICLE_INTERFACE) {
    sendBAPSicleChannel({ channel: player, command: "UNPAUSE" });
    return;
  }

  // TODO: WEBSTUDIO PAUSE
};

export const stop = (player: number): AppThunk => (dispatch, getState) => {
  if (process.env.REACT_APP_BAPSICLE_INTERFACE) {
    sendBAPSicleChannel({ channel: player, command: "STOP" });
    return;
  }

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

  // If we're stoping the Preview player, turn off PFL in the UI.
  if (player === PLAYER_ID_PREVIEW) {
    dispatch(setChannelPFL(player, false));
  }

  dispatch(mixerState.actions.setTimeCurrent({ player, time: cueTime }));
  playerInstance.setCurrentTime(cueTime);

  // Incase wavesurver wasn't playing, it won't 'finish', so just make sure the UI is stopped.
  dispatch(mixerState.actions.setPlayerState({ player, state: "stopped" }));

  if (state.tracklistItemID !== -1) {
    dispatch(BroadcastState.tracklistEnd(state.tracklistItemID));
  }
};

export const {
  loadItem,
  setTimeLength,
  setTimeCurrent,
  setPlayerState,
  setAutoAdvance,
  itemLoadComplete,
  itemLoadError,
  itemLoadPercentage,
  setPlayOnLoad,
  setRepeat,
  setTracklistItemID,
  setMicBaseGain,
  toggleAutoAdvance,
  togglePlayOnLoad,
  toggleRepeat,
  setPlayerMicAutoDuck,
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

const FADE_TIME_SECONDS = 1;
export const setVolume = (
  player: number,
  level: VolumePresetEnum,
  fade: boolean = true
): AppThunk => (dispatch, getState) => {
  let volume: number;
  let uiLevel: number;
  switch (level) {
    case "off":
      volume = OFF_LEVEL_DB; // The sweet spot for getting below the silence rounding in audio.ts -> _applyVolume()
      uiLevel = 0;
      break;
    case "bed":
      volume = BED_LEVEL_DB;
      uiLevel = 0.5;
      break;
    case "full":
      volume = FULL_LEVEL_DB;
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
      dispatch(
        mixerState.actions.setPlayerVolume({
          player,
          volume: uiLevel,
          volumeEnum: level,
        })
      );
      dispatch(mixerState.actions.setPlayerGain({ player, gain: volume }));
      return;
    }
  }

  if (level !== "off") {
    // If we're fading up the volume, disable the PFL.
    dispatch(setChannelPFL(player, false));
    // Also catch a tracklist if we started with the channel off.
    dispatch(attemptTracklist(player));
  }

  // If not fading, just do it.
  if (!fade) {
    dispatch(
      mixerState.actions.setPlayerVolume({
        player,
        volume: uiLevel,
        volumeEnum: level,
      })
    );
    dispatch(mixerState.actions.setPlayerGain({ player, gain: volume }));
    return;
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
      dispatch(
        mixerState.actions.setPlayerVolume({
          player,
          volume: val,
          volumeEnum: level,
        })
      );
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

export const setChannelPFL = (
  player: number,
  enabled: boolean
): AppThunk => async (dispatch) => {
  if (
    enabled &&
    typeof audioEngine.players[player] !== "undefined" &&
    !audioEngine.players[player]?.isPlaying &&
    player !== PLAYER_ID_PREVIEW // The Preview player is setting PFL itself when it plays.
  ) {
    dispatch(setVolume(player, "off", false)); // This does nothing for Preview player (it's not routed.)
    dispatch(play(player));
  }
  // If the player number is -1, do all channels.
  if (player === -1) {
    if (!enabled) {
      dispatch(stop(PLAYER_ID_PREVIEW)); // Stop the Preview player!
    }
    for (let i = 0; i < audioEngine.players.length; i++) {
      dispatch(mixerState.actions.setPlayerPFL({ player: i, enabled: false }));
      audioEngine.setPFL(i, false);
    }
  } else {
    dispatch(mixerState.actions.setPlayerPFL({ player, enabled }));
    audioEngine.setPFL(player, enabled);
  }
};

export const openMicrophone = (
  micID: string,
  micMapping: ChannelMapping
): AppThunk => async (dispatch, getState) => {
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
    await audioEngine.openMic(micID, micMapping);
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
  // Now to patch in the Mic to the Compressor, or Bypass it.
  audioEngine.setMicProcessingEnabled(state.processing);
  dispatch(mixerState.actions.micOpen(micID));
};

export const setMicProcessingEnabled = (enabled: boolean): AppThunk => async (
  dispatch
) => {
  dispatch(mixerState.actions.setMicProcessingEnabled(enabled));
  audioEngine.setMicProcessingEnabled(enabled);
};

export const setMicVolume = (level: MicVolumePresetEnum): AppThunk => (
  dispatch,
  getState
) => {
  const players = getState().mixer.players;

  // no tween fuckery here, just cut the level
  const levelVal = level === "full" ? 1 : 0;
  // actually, that's a lie - if we're turning it off we delay it a little to compensate for
  // processing latency

  if (levelVal !== 0) {
    dispatch(mixerState.actions.setMicLevels({ volume: levelVal }));
    for (let player = 0; player < players.length; player++) {
      // If we have auto duck enabled on this channel player, tell it to fade down.
      if (
        players[player].micAutoDuck &&
        players[player].volumeEnum === "full"
      ) {
        dispatch(setVolume(player, "bed"));
      }
    }
  } else {
    for (let player = 0; player < players.length; player++) {
      // If we have auto duck enabled on this channel player, tell it to fade back up.
      if (players[player].micAutoDuck && players[player].volumeEnum === "bed") {
        dispatch(setVolume(player, "full"));
      }
    }
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

const handleKeyboardShortcut = (
  store: MiddlewareAPI<Dispatch<any>>,
  channel: number,
  command: string
): AppThunk => () => {
  if (process.env.REACT_APP_BAPSICLE_INTERFACE) {
    sendBAPSicleChannel({ channel: channel, command: command });
    return;
  }
  switch (command) {
    case "PLAY":
      store.dispatch(play(channel));
      break;
    case "PAUSE":
      store.dispatch(pause(channel));
      break;
    case "STOP":
      store.dispatch(stop(channel));
      break;
  }
};

export const mixerKeyboardShortcutsMiddleware: Middleware<
  {},
  RootState,
  Dispatch<any>
> = (store) => {
  if (process.env.REACT_APP_BAPSICLE_INTERFACE) {
    // The F keys will only work in places like Electron (NeutronStudio) where they don't trigger browser functions.
    Keys("f1", () => {
      handleKeyboardShortcut(store, 0, "PLAY");
    });
    Keys("f2", () => {
      handleKeyboardShortcut(store, 0, "PAUSE");
    });
    Keys("f3", () => {
      handleKeyboardShortcut(store, 0, "STOP");
    });
    Keys("f5", () => {
      handleKeyboardShortcut(store, 1, "PLAY");
    });
    Keys("f6", () => {
      handleKeyboardShortcut(store, 1, "PAUSE");
    });
    Keys("f7", () => {
      handleKeyboardShortcut(store, 1, "STOP");
    });
    Keys("f9", () => {
      handleKeyboardShortcut(store, 2, "PLAY");
    });
    Keys("f10", () => {
      handleKeyboardShortcut(store, 2, "PAUSE");
    });
    Keys("f11", () => {
      handleKeyboardShortcut(store, 2, "STOP");
    });
  } else {
    Keys("q", () => {
      handleKeyboardShortcut(store, 0, "PLAY");
    });
    Keys("w", () => {
      handleKeyboardShortcut(store, 0, "PAUSE");
    });
    Keys("e", () => {
      handleKeyboardShortcut(store, 0, "STOP");
    });
    Keys("r", () => {
      handleKeyboardShortcut(store, 1, "PLAY");
    });
    Keys("t", () => {
      handleKeyboardShortcut(store, 1, "PAUSE");
    });
    Keys("y", () => {
      handleKeyboardShortcut(store, 1, "STOP");
    });
    Keys("u", () => {
      handleKeyboardShortcut(store, 2, "PLAY");
    });
    Keys("i", () => {
      handleKeyboardShortcut(store, 2, "PAUSE");
    });
    Keys("o", () => {
      handleKeyboardShortcut(store, 2, "STOP");
    });
  }

  return (next) => (action) => next(action);
};
