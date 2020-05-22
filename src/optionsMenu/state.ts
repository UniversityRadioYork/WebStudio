import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type OptionsTabIDsEnum =
  | "mic"
  | "about"
  | "pro"
  | "midi"
  | "advanced"
  | "stats";

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
