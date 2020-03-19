import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import * as Between from "between.js";
import { PlanItem } from "../showplanner/state";
import { Track, MYRADIO_NON_API_BASE } from "../api";
import { AppThunk } from "../store";

console.log(Between);

const audioContext = new AudioContext();
const playerSources: MediaElementAudioSourceNode[] = [];
const playerGains: GainNode[] = [];
const playerGainTweens: Between.Between[] = [];
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
				volume: 1
			},
			{
				loadedItem: null,
				loading: false,
				state: "stopped",
				volume: 1
			},
			{
				loadedItem: null,
				loading: false,
				state: "stopped",
				volume: 1
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
			action: PayloadAction<{ player: number; volume: number }>
		) {
			state.players[action.payload.player].volume = action.payload.volume;
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
		dispatch(mixerState.actions.itemLoadComplete({ player }));
	};
	el.load();
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

export const setVolume = (
	player: number,
	level: VolumePresetEnum
): AppThunk => (dispatch, getState) => {
	let volume: number;
	switch (level) {
		case "off":
			volume = 0;
			break;
		case "bed":
			volume = 0.25;
			break;
		case "full":
			volume = 1;
			break;
	}
	const currentLevel = getState().mixer.players[player].volume;
	playerGainTweens[player] = new (Between as any)(currentLevel, volume)
		.on("update", (value: number) => {
			dispatch(mixerState.actions.setPlayerVolume({ player, volume }));
			if (playerGains[player]) {
				playerGains[player].gain.value = value;
			}
		})
		.time(1000);
};
