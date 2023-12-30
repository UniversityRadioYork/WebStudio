import { combineReducers } from "@reduxjs/toolkit";

import {
  persistReducer,
  PersistConfig,
  createMigrate,
  PersistedState,
} from "redux-persist";
import webStorage from "redux-persist/lib/storage";
import autoMergeLevel2 from "redux-persist/lib/stateReconciler/autoMergeLevel2";

import ShowplanReducer from "./showplanner/state";
import MixerReducer from "./mixer/state";
import BroadcastReducer from "./broadcast/state";
import sessionReducer from "./session/state";
import NavbarReducer from "./navbar/state";
import OptionsMenuReducer from "./optionsMenu/state";
import SettingsState from "./optionsMenu/settingsState";
import produce from "immer";

import BAPSSessionReducer from "./bapsiclesession/state";

const rootReducer = combineReducers({
  showplan: ShowplanReducer,
  mixer: MixerReducer,
  broadcast: BroadcastReducer,
  session: sessionReducer,
  navbar: NavbarReducer,
  optionsMenu: OptionsMenuReducer,
  settings: SettingsState,
  bapsSession: BAPSSessionReducer,
});

const persistMigrations = createMigrate({
  0: (state) =>
    produce(
      state,
      (x: PersistedState & Pick<_InternalRootState, "settings">) => {
        x.settings.saveShowPlanChanges = true;
      }
    ),
});

type _InternalRootState = ReturnType<typeof rootReducer>;

const persistenceConfig: PersistConfig<_InternalRootState> = {
  key: "root",
  storage: webStorage,
  whitelist: ["settings"],
  stateReconciler: autoMergeLevel2,
  version: 0,
  migrate: persistMigrations,
};

const persistedReducer = persistReducer(persistenceConfig, rootReducer);

export type RootState = ReturnType<typeof persistedReducer>;
export default persistedReducer;
