import rootReducer, { RootState } from "./rootReducer";
import { configureStore, Action, getDefaultMiddleware } from "@reduxjs/toolkit";
import { ThunkAction } from "redux-thunk";
import {
	mixerMiddleware,
	mixerKeyboardShortcutsMiddleware,
} from "./mixer/state";
import { tabSyncMiddleware } from "./optionsMenu/state";

const store = configureStore({
	reducer: rootReducer,
	middleware: [
		mixerMiddleware,
		mixerKeyboardShortcutsMiddleware,
		tabSyncMiddleware,
		...getDefaultMiddleware(),
	],
});

if (process.env.NODE_ENV === "development" && module.hot) {
	module.hot.accept("./rootReducer", () => {
		const newRootReducer = require("./rootReducer").default;
		store.replaceReducer(newRootReducer);
	});
}

export type AppDispatch = typeof store.dispatch;
export type AppThunk = ThunkAction<void, RootState, null, Action<string>>;
export default store;
