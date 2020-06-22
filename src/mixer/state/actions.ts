import {mixerState} from "./state";
import {itemId, PlanItem} from "../../showplanner/state";
import {AuxItem, MYRADIO_NON_API_BASE, Track} from "../../api";
import {AppThunk} from "../../store";
import {audioEngine} from "../audio";
import fetchProgress, {FetchProgressData} from "fetch-progress";
import * as BroadcastState from "../../broadcast/state";
import Between from "between.js";
import {MicVolumePresetEnum, VolumePresetEnum} from "./types";

const playerGainTweens: Array<{
  target: VolumePresetEnum;
  tweens: Between[];
}> = [];
const loadAbortControllers: AbortController[] = [];
const lastObjectURLs: string[] = [];

export const load = (
  player: number,
  item: PlanItem | Track | AuxItem
): AppThunk => async (dispatch, getState) => {
  if (typeof audioEngine.players[player] !== "undefined") {
    if (audioEngine.players[player]?.isPlaying) {
      // already playing, don't kill playback
      return;
    }
  }
  // If this is already the currently loaded item, don't bother
  const currentItem = getState().mixer.players[player].loadedItem;
  if (currentItem !== null && itemId(currentItem) === itemId(item)) {
    return;
  }
  // If we're already loading something, abort it
  if (typeof loadAbortControllers[player] !== "undefined") {
    loadAbortControllers[player].abort();
  }
  loadAbortControllers[player] = new AbortController();

  const shouldResetTrim = getState().settings.resetTrimOnLoad;

  dispatch(
    mixerState.actions.loadItem({ player, item, resetTrim: shouldResetTrim })
  );

  let url;

  if ("album" in item) {
    // track
    url =
      MYRADIO_NON_API_BASE +
      "/NIPSWeb/secure_play?recordid=" +
      item.album.recordid +
      "&trackid=" +
      item.trackid;
  } else if ("managedid" in item) {
    url =
      MYRADIO_NON_API_BASE +
      "/NIPSWeb/managed_play?managedid=" +
      item.managedid;
  } else {
    throw new Error(
      "Unsure how to handle this!\r\n\r\n" + JSON.stringify(item)
    );
  }

  console.log("loading");

  let waveform = document.getElementById("waveform-" + player.toString());
  if (waveform == null) {
    throw new Error();
  }
  audioEngine.destroyPlayerIfExists(player); // clear previous (ghost) wavesurfer and it's media elements.
  // wavesurfer also sets the background white, remove for progress bar to work.
  waveform.style.removeProperty("background");

  try {
    const signal = loadAbortControllers[player].signal; // hang on to the signal, even if its controller gets replaced
    const result = await fetch(url, {
      credentials: "include",
      signal,
    }).then(
      fetchProgress({
        // implement onProgress method
        onProgress(progress: FetchProgressData) {
          const percent = progress.transferred / progress.total;
          if (percent !== 1) {
            dispatch(
              mixerState.actions.itemLoadPercentage({ player, percent })
            );
          }
        },
      })
    );
    const rawData = await result.arrayBuffer();
    const blob = new Blob([rawData]);
    const objectUrl = URL.createObjectURL(blob);

    const playerInstance = await audioEngine.createPlayer(player, objectUrl);

    // Clear the last one out from memory
    if (typeof lastObjectURLs[player] === "string") {
      URL.revokeObjectURL(lastObjectURLs[player]);
    }
    lastObjectURLs[player] = objectUrl;

    playerInstance.on("loadComplete", (duration) => {
      console.log("loadComplete");
      dispatch(mixerState.actions.itemLoadComplete({ player }));
      dispatch(
        mixerState.actions.setTimeLength({
          player,
          time: duration,
        })
      );
      dispatch(
        mixerState.actions.setTimeCurrent({
          player,
          time: 0,
        })
      );
      const state = getState().mixer.players[player];
      if (state.playOnLoad) {
        playerInstance.play();
      }
      if (state.loadedItem && "intro" in state.loadedItem) {
        playerInstance.setIntro(state.loadedItem.intro);
      }
    });

    playerInstance.on("play", () => {
      dispatch(mixerState.actions.setPlayerState({ player, state: "playing" }));
    });
    playerInstance.on("pause", () => {
      dispatch(
        mixerState.actions.setPlayerState({
          player,
          state: playerInstance.currentTime === 0 ? "stopped" : "paused",
        })
      );
    });
    playerInstance.on("timeChange", (time) => {
      if (Math.abs(time - getState().mixer.players[player].timeCurrent) > 0.5) {
        dispatch(
          mixerState.actions.setTimeCurrent({
            player,
            time,
          })
        );
      }
    });
    playerInstance.on("finish", () => {
      dispatch(mixerState.actions.setPlayerState({ player, state: "stopped" }));
      const state = getState().mixer.players[player];
      if (state.tracklistItemID !== -1) {
        dispatch(BroadcastState.tracklistEnd(state.tracklistItemID));
      }
      if (state.repeat === "one") {
        playerInstance.play();
      } else if (state.repeat === "all") {
        if ("channel" in item) {
          // it's not in the CML/libraries "column"
          const itsChannel = getState()
            .showplan.plan!.filter((x) => x.channel === item.channel)
            .sort((x, y) => x.weight - y.weight);
          const itsIndex = itsChannel.indexOf(item);
          if (itsIndex === itsChannel.length - 1) {
            dispatch(load(player, itsChannel[0]));
          }
        }
      } else if (state.autoAdvance) {
        if ("channel" in item) {
          // it's not in the CML/libraries "column"
          const itsChannel = getState()
            .showplan.plan!.filter((x) => x.channel === item.channel)
            .sort((x, y) => x.weight - y.weight);
          const itsIndex = itsChannel.indexOf(item);
          if (itsIndex > -1 && itsIndex !== itsChannel.length - 1) {
            dispatch(load(player, itsChannel[itsIndex + 1]));
          }
        }
      }
    });

    // Double-check we haven't been aborted since
    if (signal.aborted) {
      // noinspection ExceptionCaughtLocallyJS
      throw new DOMException("abort load", "AbortError");
    }

    playerInstance.setVolume(getState().mixer.players[player].gain);
    playerInstance.setTrim(getState().mixer.players[player].trim);
    delete loadAbortControllers[player];
  } catch (e) {
    if ("name" in e && e.name === "AbortError") {
      // load was aborted, ignore the error
    } else {
      console.error(e);
      dispatch(mixerState.actions.itemLoadError({ player }));
    }
  }
};

export const play = (player: number): AppThunk => async (
  dispatch,
  getState
) => {
  if (typeof audioEngine.players[player] === "undefined") {
    console.log("nothing loaded");
    return;
  }
  if (audioEngine.audioContext.state !== "running") {
    console.log("Resuming AudioContext because Chrome bad");
    await audioEngine.audioContext.resume();
  }
  const state = getState().mixer.players[player];
  if (state.loading !== -1) {
    console.log("not ready");
    return;
  }
  audioEngine.players[player]?.play();

  if (state.loadedItem && "album" in state.loadedItem) {
    //track
    console.log("potentially tracklisting", state.loadedItem);
    if (getState().mixer.players[player].tracklistItemID === -1) {
      dispatch(BroadcastState.tracklistStart(player, state.loadedItem.trackid));
    } else {
      console.log("not tracklisting because already tracklisted");
    }
  }
};

export const pause = (player: number): AppThunk => (dispatch, getState) => {
  if (typeof audioEngine.players[player] === "undefined") {
    console.log("nothing loaded");
    return;
  }
  if (getState().mixer.players[player].loading !== -1) {
    console.log("not ready");
    return;
  }
  if (audioEngine.players[player]?.isPlaying) {
    audioEngine.players[player]?.pause();
  } else {
    audioEngine.players[player]?.play();
  }
};

export const stop = (player: number): AppThunk => (dispatch, getState) => {
  if (typeof audioEngine.players[player] === "undefined") {
    console.log("nothing loaded");
    return;
  }
  var state = getState().mixer.players[player];
  if (state.loading !== -1) {
    console.log("not ready");
    return;
  }
  audioEngine.players[player]?.stop();
  // Incase wavesurver wasn't playing, it won't 'finish', so just make sure the UI is stopped.
  dispatch(mixerState.actions.setPlayerState({ player, state: "stopped" }));

  if (state.tracklistItemID !== -1) {
    dispatch(BroadcastState.tracklistEnd(state.tracklistItemID));
  }
};

export const {
  toggleAutoAdvance,
  togglePlayOnLoad,
  toggleRepeat,
} = mixerState.actions;

export const redrawWavesurfers = (): AppThunk => () => {
  audioEngine.players.forEach(function(item) {
    item?.redraw();
  });
};

export const { setTracklistItemID } = mixerState.actions;

const FADE_TIME_SECONDS = 1;
export const setVolume = (
  player: number,
  level: VolumePresetEnum
): AppThunk => (dispatch, getState) => {
  let volume: number;
  let uiLevel: number;
  switch (level) {
    case "off":
      volume = -36;
      uiLevel = 0;
      break;
    case "bed":
      volume = -7;
      uiLevel = 0.5;
      break;
    case "full":
      volume = 0;
      uiLevel = 1;
      break;
  }

  // Right, okay, big fun is happen.
  // To make the fade sound natural, we need to ramp it exponentially.
  // To make the UI look sensible, we need to ramp it linearly.
  // Time for cheating!

  if (typeof playerGainTweens[player] !== "undefined") {
    // We've interrupted a previous fade.
    // If we've just hit the button/key to go to the same value as that fade,
    // stop it and immediately cut to the target value.
    // Otherwise, stop id and start a new fade.
    playerGainTweens[player].tweens.forEach((tween) => tween.pause());
    if (playerGainTweens[player].target === level) {
      delete playerGainTweens[player];
      dispatch(mixerState.actions.setPlayerVolume({ player, volume: uiLevel }));
      dispatch(mixerState.actions.setPlayerGain({ player, gain: volume }));
      return;
    }
  }

  const state = getState().mixer.players[player];

  const currentLevel = state.volume;
  const currentGain = state.gain;
  const volumeTween = new Between(currentLevel, uiLevel)
    .time(FADE_TIME_SECONDS * 1000)
    .on("update", (val: number) => {
      dispatch(mixerState.actions.setPlayerVolume({ player, volume: val }));
    });
  const gainTween = new Between(currentGain, volume)
    .time(FADE_TIME_SECONDS * 1000)
    .on("update", (val: number) => {
      if (typeof audioEngine.players[player] !== "undefined") {
        audioEngine.players[player]?.setVolume(val);
      }
    })
    .on("complete", () => {
      dispatch(mixerState.actions.setPlayerGain({ player, gain: volume }));
      // clean up when done
      delete playerGainTweens[player];
    });

  playerGainTweens[player] = {
    target: level,
    tweens: [volumeTween, gainTween],
  };
};

export const setChannelTrim = (player: number, val: number): AppThunk => async (
  dispatch
) => {
  dispatch(mixerState.actions.setPlayerTrim({ player, trim: val }));
  audioEngine.players[player]?.setTrim(val);
};

export const openMicrophone = (micID: string): AppThunk => async (
  dispatch,
  getState
) => {
  // TODO: not sure why this is here, and I have a hunch it may break shit, so disabling
  // File a ticket if it breaks stuff. -Marks
  // if (getState().mixer.mic.open) {
  // 	micSource?.disconnect();
  // }
  if (audioEngine.audioContext.state !== "running") {
    console.log("Resuming AudioContext because Chrome bad");
    await audioEngine.audioContext.resume();
  }
  dispatch(mixerState.actions.setMicError(null));
  if (!("mediaDevices" in navigator)) {
    // mediaDevices is not there - we're probably not in a secure context
    dispatch(mixerState.actions.setMicError("NOT_SECURE_CONTEXT"));
    return;
  }
  try {
    await audioEngine.openMic(micID);
  } catch (e) {
    if (e instanceof DOMException) {
      switch (e.message) {
        case "Permission denied":
          dispatch(mixerState.actions.setMicError("NO_PERMISSION"));
          break;
        default:
          dispatch(mixerState.actions.setMicError("UNKNOWN"));
      }
    } else {
      dispatch(mixerState.actions.setMicError("UNKNOWN"));
    }
    return;
  }

  const state = getState().mixer.mic;
  audioEngine.setMicCalibrationGain(state.baseGain);
  audioEngine.setMicVolume(state.volume);

  dispatch(mixerState.actions.micOpen(micID));
};

export const setMicVolume = (level: MicVolumePresetEnum): AppThunk => (
  dispatch
) => {
  // no tween fuckery here, just cut the level
  const levelVal = level === "full" ? 1 : 0;
  // actually, that's a lie - if we're turning it off we delay it a little to compensate for
  // processing latency
  if (levelVal !== 0) {
    dispatch(mixerState.actions.setMicLevels({ volume: levelVal }));
  } else {
    window.setTimeout(() => {
      dispatch(mixerState.actions.setMicLevels({ volume: levelVal }));
      // latency, plus a little buffer
    }, audioEngine.audioContext.baseLatency * 1000 + 150);
  }
};

