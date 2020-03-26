import { combineReducers } from "@reduxjs/toolkit";

import ShowplanReducer from "./showplanner/state";
import MixerReducer from "./mixer/state";
import BroadcastReducer from "./broadcast/state";

const rootReducer = combineReducers({
    showplan: ShowplanReducer,
    mixer: MixerReducer,
    broadcast: BroadcastReducer
});

export type RootState = ReturnType<typeof rootReducer>;

export default rootReducer;
