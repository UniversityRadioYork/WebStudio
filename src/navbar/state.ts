import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface Alert {
	content: string;
	color: "primary" | "secondary" | "success" | "warning" | "danger" | "info" | "light" | "dark";
	closure: "manual" | number | null;
}

interface NavbarState {
	currentAlert: Alert | null;
}

const navbarState = createSlice({
	name: "navbar",
	initialState: {
		currentAlert: null
	} as NavbarState,
	reducers: {
		showAlert(state, action: PayloadAction<Alert>) {
			state.currentAlert = action.payload;
		},
		closeAlert(state) {
			state.currentAlert = null;
		}
	}
})

export default navbarState.reducer;

export const { showAlert, closeAlert } = navbarState.actions;
