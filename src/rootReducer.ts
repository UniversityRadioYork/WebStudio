import { combineReducers } from "@reduxjs/toolkit";

import ShowplanReducer from "./showplanner/state";
import PlayerReducer from "./showplanner/player/state";

const rootReducer = combineReducers({
    showplan: ShowplanReducer,
    player: PlayerReducer
});

export type RootState = ReturnType<typeof rootReducer>;

export default rootReducer;
