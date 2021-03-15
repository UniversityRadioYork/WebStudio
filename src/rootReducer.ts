import { combineReducers } from "@reduxjs/toolkit";

import { persistReducer, PersistConfig } from "redux-persist";
import webStorage from "redux-persist/lib/storage";
import autoMergeLevel2 from "redux-persist/lib/stateReconciler/autoMergeLevel2";

import ShowplanReducer from "./showplanner/state";
import MixerReducer from "./mixer/state";
//import sessionReducer from "./session/state";
import sessionReducer from "./bapiclesession/state";
import NavbarReducer from "./navbar/state";

const rootReducer = combineReducers({
  showplan: ShowplanReducer,
  mixer: MixerReducer,
  session: sessionReducer,
  navbar: NavbarReducer,
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
