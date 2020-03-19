import { combineReducers } from "@reduxjs/toolkit";

import ShowplanReducer from "./showplanner/state";
import MixerReducer from "./mixer/state";

const rootReducer = combineReducers({
    showplan: ShowplanReducer,
    mixer: MixerReducer
});

export type RootState = ReturnType<typeof rootReducer>;

export default rootReducer;
