import { combineReducers } from "@reduxjs/toolkit";

import ShowplanReducer from "./showplanner/state";
import MixerReducer from "./mixer/state";
import BroadcastReducer from "./broadcast/state";
import sessionReducer from "./session/state";
import NavbarReducer from "./navbar/state";

const rootReducer = combineReducers({
    showplan: ShowplanReducer,
    mixer: MixerReducer,
    broadcast: BroadcastReducer,
    session: sessionReducer,
    navbar: NavbarReducer
});

export type RootState = ReturnType<typeof rootReducer>;

export default rootReducer;
