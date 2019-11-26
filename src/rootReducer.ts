import { combineReducers } from "@reduxjs/toolkit";

import ShowplanReducer from "./showplanner/state";

const rootReducer = combineReducers({
    showplan: ShowplanReducer
});

export type RootState = ReturnType<typeof rootReducer>;

export default rootReducer;
