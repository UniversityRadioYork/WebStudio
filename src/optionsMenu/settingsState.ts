import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface Settings {
	showDebugInfo: boolean;
}

const settingsState = createSlice({
	name: "settings",
	initialState: {} as Settings,
	reducers: {
		changeSetting<K extends keyof Settings>(state: Settings, action: PayloadAction<{ key: K, val: Settings[K] }>) {
			state[action.payload.key] = action.payload.val;
		}
	}
});

export default settingsState.reducer;

export const { changeSetting } = settingsState.actions;
