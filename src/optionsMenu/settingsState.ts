import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface Settings {
  showDebugInfo: boolean;
  enableRecording: boolean;
  tracklist: "always" | "while_live" | "never";
  doTheNews: "always" | "while_live" | "never";
  proMode: boolean;
  channelVUs: boolean;
  channelVUsStereo: boolean;
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
    resetTrimOnLoad: true,
    saveShowPlanChanges: false,
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
