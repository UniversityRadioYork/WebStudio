import { configureStore, getDefaultMiddleware } from "@reduxjs/toolkit";
import { multiServerMiddleware } from "./multi/state";
import rootReducer from "./rootReducer";

const store = configureStore({
    reducer: rootReducer,
    middleware: [
        multiServerMiddleware,
        ...getDefaultMiddleware()
    ]
});

export default store;
