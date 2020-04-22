import {
  createSlice,
  PayloadAction,
  Middleware,
  Dispatch,
} from "@reduxjs/toolkit";
import { RootState } from "../rootReducer";

import * as MixerState from "../mixer/state";

export type OptionsTabIDsEnum = "mic" | "about" | "advanced" | "stats";

const optionsMenuState = createSlice({
  name: "optionsMenu",
  initialState: {
    open: false,
    currentTab: "mic" as OptionsTabIDsEnum,
  },
  reducers: {
    open(state) {
      state.open = true;
    },
    openToTab(state, action: PayloadAction<OptionsTabIDsEnum>) {
      state.open = true;
      state.currentTab = action.payload;
    },
    close(state) {
      state.open = false;
    },
    changeTab(state, action: PayloadAction<OptionsTabIDsEnum>) {
      state.currentTab = action.payload;
    },
  },
});

export default optionsMenuState.reducer;

export const { open, openToTab, close, changeTab } = optionsMenuState.actions;

export const tabSyncMiddleware: Middleware<{}, RootState, Dispatch> = (
  store
) => (next) => (action) => {
  const oldState = store.getState();
  const result = next(action);
  const newState = store.getState();
  return result;
};
