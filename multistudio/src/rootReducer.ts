import { combineReducers } from "@reduxjs/toolkit";
import multiReducer from "./multi/state";

const rootReducer = combineReducers({
    multi: multiReducer
});

export default rootReducer;
export type RootState = ReturnType<typeof rootReducer>;
