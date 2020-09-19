import raygun from "raygun4js";
import { configureStore, Action, getDefaultMiddleware, Middleware, Dispatch } from "@reduxjs/toolkit";
import rootReducer, { RootState } from "./rootReducer";
import { ThunkAction } from "redux-thunk";
import {
  mixerMiddleware,
  mixerKeyboardShortcutsMiddleware,
  startNewsTimer,
} from "./mixer/state";
import {
  persistStore,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER
} from "redux-persist";

const raygunMiddleware: Middleware < {}, RootState, Dispatch < any >> = (store) => (next) => (action) => {
  raygun("recordBreadcrumb", "redux-action", action);
  return next(action);
}

// See https://github.com/rt2zz/redux-persist/issues/988 for getDefaultMiddleware tweak.
const store = configureStore({
  reducer: rootReducer,
  middleware: [
    mixerMiddleware,
    mixerKeyboardShortcutsMiddleware,
    raygunMiddleware,
    ...getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER]
      }
    })
  ],
});

if (process.env.NODE_ENV === "development" && module.hot) {
  module.hot.accept("./rootReducer", () => {
    const newRootReducer = require("./rootReducer").default;
    store.replaceReducer(newRootReducer);
  });
}

export const persistor = persistStore(store);

export type AppDispatch = typeof store.dispatch;
export type AppThunk = ThunkAction<void, RootState, null, Action<string>>;

store.dispatch(startNewsTimer() as any);

export default store;
