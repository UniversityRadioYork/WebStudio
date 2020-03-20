import {
	createSlice,
	PayloadAction,
	Store,
	Dispatch,
	Action,
	Middleware
} from "@reduxjs/toolkit";
import Between from "between.js";
import { PlanItem } from "../showplanner/state";
import Keys from "keymaster";
import { Track, MYRADIO_NON_API_BASE } from "../api";
import { AppThunk } from "../store";
import { RootState } from "../rootReducer";

console.log(Between);

const audioContext = new AudioContext();
const playerSources: MediaElementAudioSourceNode[] = [];
const playerGains: GainNode[] = [];
const playerGainTweens: Array<{
	target: VolumePresetEnum;
	tweens: Between[];
}> = [];
// TODO
// const destination = audioContext.createWebcastSource(4096, 2);
const destination = audioContext.createDynamicsCompressor();
destination.connect(audioContext.destination);

type PlayerStateEnum = "playing" | "paused" | "stopped";
type VolumePresetEnum = "off" | "bed" | "full";

interface PlayerState {
	loadedItem: PlanItem | Track | null;
	loading: boolean;
	state: PlayerStateEnum;
	volume: number;
	gain: number;
}

interface MixerState {
	players: PlayerState[];
}

const mixerState = createSlice({
	name: "Player",
	initialState: {
		players: [
			{
				loadedItem: null,
				loading: false,
				state: "stopped",
				volume: 1,
				gain: 1
			},
			{
				loadedItem: null,
				loading: false,
				state: "stopped",
				volume: 1,
				gain: 1
			},
			{
				loadedItem: null,
				loading: false,
				state: "stopped",
				volume: 1,
				gain: 1
			}
		]
	} as MixerState,
	reducers: {
		loadItem(
			state,
			action: PayloadAction<{ player: number; item: PlanItem | Track }>
		) {
			state.players[action.payload.player].loadedItem =
				action.payload.item;
			state.players[action.payload.player].loading = true;
		},
		itemLoadComplete(state, action: PayloadAction<{ player: number }>) {
			state.players[action.payload.player].loading = false;
		},
		setPlayerState(
			state,
			action: PayloadAction<{ player: number; state: PlayerStateEnum }>
		) {
			state.players[action.payload.player].state = action.payload.state;
		},
		setPlayerVolume(
			state,
			action: PayloadAction<{
				player: number;
				volume: number;
			}>
		) {
			state.players[action.payload.player].volume = action.payload.volume;
		},
		setPlayerGain(
			state,
			action: PayloadAction<{
				player: number;
				gain: number;
			}>
		) {
			state.players[action.payload.player].gain = action.payload.gain;
		}
	}
});

export default mixerState.reducer;

export const load = (player: number, item: PlanItem | Track): AppThunk => (
	dispatch,
	getState
) => {
	if (typeof playerSources[player] !== "undefined") {
		if (!playerSources[player].mediaElement.paused) {
			// already playing, don't kill playback
			return;
		}
	}
	dispatch(mixerState.actions.loadItem({ player, item }));
	const el = new Audio();
	el.crossOrigin = "use-credentials";
	if ("album" in item) {
		// track
		el.src =
			MYRADIO_NON_API_BASE +
			"/NIPSWeb/secure_play?recordid=" +
			item.album.recordid +
			"&trackid=" +
			item.trackid;
	} else if ("type" in item && item.type == "aux") {
		el.src =
			MYRADIO_NON_API_BASE +
			"/NIPSWeb/managed_play?managedid=" +
			item.managedid;
	} else {
		throw new Error(
			"Unsure how to handle this!\r\n\r\n" + JSON.stringify(item)
		);
	}
	el.oncanplay = () => {
		console.log("can play");
	};
	el.oncanplaythrough = () => {
		console.log("can play through");
		dispatch(mixerState.actions.itemLoadComplete({ player }));
	};
	el.load();
	console.log("loading");
	const sauce = audioContext.createMediaElementSource(el);
	const gain = audioContext.createGain();
	gain.gain.value = getState().mixer.players[player].volume;
	sauce.connect(gain);
	gain.connect(destination);
	console.log("Connected to", destination);
	playerSources[player] = sauce;
	playerGains[player] = gain;
};

export const play = (player: number): AppThunk => dispatch => {
	try {
		playerSources[player].mediaElement.play();
		dispatch(
			mixerState.actions.setPlayerState({ player, state: "playing" })
		);
		playerSources[player].mediaElement.addEventListener(
			"ended",
			function() {
				dispatch(
					mixerState.actions.setPlayerState({
						player,
						state: "stopped"
					})
				);
			}
		);
	} catch {
		console.log("nothing selected/loaded");
	}
};

export const pause = (player: number): AppThunk => dispatch => {
	try {
		if (playerSources[player].mediaElement.paused) {
			playerSources[player].mediaElement.play();
			dispatch(
				mixerState.actions.setPlayerState({ player, state: "playing" })
			);
		} else {
			playerSources[player].mediaElement.pause();
			dispatch(
				mixerState.actions.setPlayerState({ player, state: "paused" })
			);
		}
	} catch {
		console.log("nothing selected/loaded");
	}
};

export const stop = (player: number): AppThunk => dispatch => {
	try {
		playerSources[player].mediaElement.pause();
		playerSources[player].mediaElement.currentTime = 0;
		dispatch(
			mixerState.actions.setPlayerState({ player, state: "stopped" })
		);
	} catch {
		console.log("nothing selected/loaded");
	}
};

const FADE_TIME_SECONDS = 1;
export const setVolume = (
	player: number,
	level: VolumePresetEnum
): AppThunk => (dispatch, getState) => {
	let volume: number;
	let uiLevel: number;
	switch (level) {
		case "off":
			volume = 0;
			uiLevel = 0;
			break;
		case "bed":
			volume = 0.125;
			uiLevel = 0.5;
			break;
		case "full":
			volume = uiLevel = 1;
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
		playerGainTweens[player].tweens.forEach(tween => tween.pause());
		if (playerGainTweens[player].target === level) {
			delete playerGainTweens[player];
			dispatch(
				mixerState.actions.setPlayerVolume({ player, volume: uiLevel })
			);
			dispatch(
				mixerState.actions.setPlayerGain({ player, gain: volume })
			);
			return;
		}
	}

	const state = getState().mixer.players[player];

	const currentLevel = state.volume;
	const currentGain = state.gain;
	const volumeTween = new Between(currentLevel, uiLevel)
		.time(FADE_TIME_SECONDS * 1000)
		.on("update", (val: number) => {
			console.log(val);
			dispatch(
				mixerState.actions.setPlayerVolume({ player, volume: val })
			);
		});
	const gainTween = new Between(currentGain, volume)
		.time(FADE_TIME_SECONDS * 1000)
		.easing((Between as any).Easing.Exponential.InOut)
		.on("update", (val: number) => {
			console.log(val);
			dispatch(mixerState.actions.setPlayerGain({ player, gain: val }));
		})
		.on("complete", () => {
			// clean up when done
			delete playerGainTweens[player];
		});

	playerGainTweens[player] = {
		target: level,
		tweens: [volumeTween, gainTween]
	};
};

export const mixerMiddleware: Middleware<
	{},
	RootState,
	Dispatch<any>
> = store => next => action => {
	const oldState = store.getState().mixer;
	const result = next(action);
	const newState = store.getState().mixer;
	newState.players.forEach((state, index) => {
		if (typeof playerGains[index] !== "undefined") {
			if (oldState.players[index].gain !== newState.players[index].gain) {
				playerGains[index].gain.value = state.gain;
			}
		}
	});
	return result;
};

export const mixerKeyboardShortcutsMiddleware: Middleware<
	{},
	RootState,
	Dispatch<any>
> = store => {
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

	return next => action => next(action);
};
