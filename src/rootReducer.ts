import { combineReducers } from "@reduxjs/toolkit";

import ShowplanReducer from "./showplanner/state";
import MixerReducer from "./mixer/state";
import BroadcastReducer from "./broadcast/state";
import sessionReducer from "./session/state";
import NavbarReducer from "./navbar/state";
import OptionsMenuReducer from "./optionsMenu/state";
import SettingsState from "./optionsMenu/settingsState";

const rootReducer = combineReducers({
    showplan: ShowplanReducer,
    mixer: MixerReducer,
    broadcast: BroadcastReducer,
    session: sessionReducer,
    navbar: NavbarReducer,
    optionsMenu: OptionsMenuReducer,
    settings: SettingsState,
});

export type RootState = ReturnType<typeof rootReducer>;

export default rootReducer;
