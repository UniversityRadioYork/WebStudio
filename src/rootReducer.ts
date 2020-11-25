import { combineReducers } from "@reduxjs/toolkit";

import { persistReducer, PersistConfig } from "redux-persist";
import webStorage from "redux-persist/lib/storage";
import autoMergeLevel2 from "redux-persist/lib/stateReconciler/autoMergeLevel2";

import ShowplanReducer from "./showplanner/state";
import MixerReducer from "./mixer/state";
import BroadcastReducer from "./broadcast/state";
import sessionReducer from "./session/state";
import NavbarReducer from "./navbar/state";
import OptionsMenuReducer from "./optionsMenu/state";
import SettingsState from "./optionsMenu/settingsState";
import ClockState from "./clock/state";

const rootReducer = combineReducers({
  showplan: ShowplanReducer,
  mixer: MixerReducer,
  broadcast: BroadcastReducer,
  session: sessionReducer,
  navbar: NavbarReducer,
  optionsMenu: OptionsMenuReducer,
  settings: SettingsState,
  clock: ClockState
});

export type RootState = ReturnType<typeof rootReducer>;

const persistenceConfig: PersistConfig<RootState> = {
  key: "root",
  storage: webStorage,
  whitelist: ["settings"],
  stateReconciler: autoMergeLevel2,
};

const persistedReducer = persistReducer(persistenceConfig, rootReducer);

export default persistedReducer;
