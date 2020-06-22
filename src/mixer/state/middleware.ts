import {AppThunk} from "../../store";
import * as TheNews from "../the_news";
import {Dispatch, Middleware} from "@reduxjs/toolkit";
import {RootState} from "../../rootReducer";
import Keys from "keymaster";
import {pause, play, setMicVolume, setVolume, stop} from "./actions";
import {AudioEngine} from "./audio";

export const startNewsTimer = (): AppThunk => (_, getState) => {
  TheNews.butNowItsTimeFor(getState);
};

export const mixerMiddleware: Middleware<{}, RootState, Dispatch<any>> = (
  store
) => {
  const audioEngine: AudioEngine = window.AE; // TODO
  return (next) => (action) => {
    const oldState = store.getState().mixer;
    const result = next(action);
    const newState = store.getState().mixer;

    newState.players.forEach((state, index) => {
      if (oldState.players[index].gain !== newState.players[index].gain) {
        audioEngine.players[index]?.setVolume(state.gain);
      }
    });

    if (newState.mic.baseGain !== oldState.mic.baseGain) {
      audioEngine.setMicCalibrationGain(newState.mic.baseGain);
    }
    if (newState.mic.volume !== oldState.mic.volume) {
      audioEngine.setMicVolume(newState.mic.volume);
    }
    return result;
  };
};

export const mixerKeyboardShortcutsMiddleware: Middleware<
  {},
  RootState,
  Dispatch<any>
  > = (store) => {
  Keys("q", () => {
    store.dispatch(play(0));
  });
  Keys("w", () => {
    store.dispatch(pause(0));
  });
  Keys("e", () => {
    store.dispatch(stop(0));
  });
  Keys("r", () => {
    store.dispatch(play(1));
  });
  Keys("t", () => {
    store.dispatch(pause(1));
  });
  Keys("y", () => {
    store.dispatch(stop(1));
  });
  Keys("u", () => {
    store.dispatch(play(2));
  });
  Keys("i", () => {
    store.dispatch(pause(2));
  });
  Keys("o", () => {
    store.dispatch(stop(2));
  });

  Keys("a", () => {
    store.dispatch(setVolume(0, "off"));
  });
  Keys("s", () => {
    store.dispatch(setVolume(0, "bed"));
  });
  Keys("d", () => {
    store.dispatch(setVolume(0, "full"));
  });
  Keys("f", () => {
    store.dispatch(setVolume(1, "off"));
  });
  Keys("g", () => {
    store.dispatch(setVolume(1, "bed"));
  });
  Keys("h", () => {
    store.dispatch(setVolume(1, "full"));
  });
  Keys("j", () => {
    store.dispatch(setVolume(2, "off"));
  });
  Keys("k", () => {
    store.dispatch(setVolume(2, "bed"));
  });
  Keys("l", () => {
    store.dispatch(setVolume(2, "full"));
  });

  Keys("x", () => {
    const state = store.getState().mixer.mic;
    store.dispatch(setMicVolume(state.volume === 1 ? "off" : "full"));
  });

  return (next) => (action) => next(action);
};

