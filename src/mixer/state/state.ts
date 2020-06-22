import {
  createSlice,
  PayloadAction,
} from "@reduxjs/toolkit";
import { PlanItem } from "../../showplanner/state";
import { Track, AuxItem } from "../../api";
import {MicErrorEnum, PlayerRepeatEnum, PlayerStateEnum} from "./types";

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

export const mixerState = createSlice({
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
