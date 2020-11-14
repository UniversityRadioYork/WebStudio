import {
  configureStore,
  Action,
  getDefaultMiddleware,
  Middleware,
  Dispatch,
} from "@reduxjs/toolkit";
import rootReducer, { RootState } from "./rootReducer";
import { ThunkAction } from "redux-thunk";
import {
  mixerMiddleware,
  mixerKeyboardShortcutsMiddleware,
} from "./mixer/state";
import {
  persistStore,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from "redux-persist";
import { bapsicleMiddleware } from "./bapsicle";

const ACTION_HISTORY_MAX_SIZE = 20;

const actionHistory: Array<Action> = [];

const actionHistoryMiddleware: Middleware<{}, RootState, Dispatch<any>> = (
  store
) => (next) => (action) => {
  while (actionHistory.length > ACTION_HISTORY_MAX_SIZE) {
    actionHistory.shift();
  }
  actionHistory.push({
    ...action,
    _timestamp: new Date().toString(),
  });
  return next(action);
};

export function getActionHistory() {
  return actionHistory;
}

// See https://github.com/rt2zz/redux-persist/issues/988 for getDefaultMiddleware tweak.
const store = configureStore({
  reducer: rootReducer,
  middleware: [
    mixerMiddleware,
    mixerKeyboardShortcutsMiddleware,
    bapsicleMiddleware,
    actionHistoryMiddleware,
    ...getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
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

export default store;
