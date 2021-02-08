import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { INTERNAL_OUTPUT_ID, PLAYER_COUNT } from "../mixer/audio";

interface Settings {
  showDebugInfo: boolean;
  enableRecording: boolean;
  tracklist: "always" | "while_live" | "never";
  doTheNews: "always" | "while_live" | "never";
  proMode: boolean;
  channelVUs: boolean;
  channelVUsStereo: boolean;
  channelOutputIds: string[];
  resetTrimOnLoad: boolean;
  saveShowPlanChanges: boolean;
}

const settingsState = createSlice({
  name: "settings",
  initialState: {
    showDebugInfo: false,
    enableRecording: false,
    tracklist: "while_live",
    doTheNews: "while_live",
    proMode: false,
    channelVUs: true,
    channelVUsStereo: true,
    channelOutputIds: Array(PLAYER_COUNT).fill(INTERNAL_OUTPUT_ID),
    resetTrimOnLoad: true,
    saveShowPlanChanges: true,
  } as Settings,
  reducers: {
    changeSetting<K extends keyof Settings>(
      state: Settings,
      action: PayloadAction<{ key: K; val: Settings[K] }>
    ) {
      state[action.payload.key] = action.payload.val;
    },
  },
});

export default settingsState.reducer;

export const { changeSetting } = settingsState.actions;
