import "../../lib/webcast";

import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { PlanItem } from "../state";
import { Track, MYRADIO_NON_API_BASE } from "../../api";
import { AppThunk } from "../../store";

/// <reference path="webcast.d.ts" />

const audioContext = new AudioContext();
const playerSources: MediaElementAudioSourceNode[] = [];
const playerGains: GainNode[] = [];
// TODO
// const destination = audioContext.createWebcastSource(4096, 2);
const destination = audioContext.createDynamicsCompressor();
destination.connect(audioContext.destination);

type PlayerStateEnum = "playing" | "paused" | "stopped";

interface SinglePlayerState {
	loadedItem: PlanItem  | Track | null
	loading: boolean;
	state: PlayerStateEnum;
}

interface PlayerState {
	players: SinglePlayerState[];
}

const playerState = createSlice({
	name: "Player",
	initialState: {
		players: [{
			loadedItem: null,
			loading: false,
			state: "stopped"
		}, {
			loadedItem: null,
			loading: false,
			state: "stopped"
		}, {
			loadedItem: null,
			loading: false,
			state: "stopped"
		}]
	} as PlayerState,
	reducers: {
		loadItem(state, action: PayloadAction<{ player: number, item: PlanItem | Track }>) {
			state.players[action.payload.player].loadedItem = action.payload.item
			state.players[action.payload.player].loading = true;
		},
		itemLoadComplete(state, action: PayloadAction<{ player: number}>) {
			state.players[action.payload.player].loading = false;
		},
		setPlayerState(state, action: PayloadAction<{ player: number, state: PlayerStateEnum }>) {
			state.players[action.payload.player].state = action.payload.state;
		}
	}
});

export default playerState.reducer;

export const load = (player: number, item: PlanItem | Track): AppThunk => dispatch => {
	if (typeof playerSources[player] !== "undefined") {
		if (!playerSources[player].mediaElement.paused) {
			// already playing, don't kill playback
			return;
		}
	}
	dispatch(playerState.actions.loadItem({ player, item }));
	const el = new Audio();
	el.crossOrigin = "use-credentials";
	if ("album" in item) {
		// track
		el.src = MYRADIO_NON_API_BASE + "/NIPSWeb/secure_play?recordid=" + item.album.recordid + "&trackid=" + item.trackid;
	} else if ("type" in item && item.type == "aux") {
		el.src = MYRADIO_NON_API_BASE + "/NIPSWeb/managed_play?managedid=" + item.managedid;
	} else {
		throw new Error("Unsure how to handle this!\r\n\r\n" + JSON.stringify(item));
	}
	el.oncanplay = () => {
		dispatch(playerState.actions.itemLoadComplete({ player }));
	}
	el.load();
	const sauce = audioContext.createMediaElementSource(el);
	const gain = audioContext.createGain();
	sauce.connect(gain);
	gain.connect(destination);
	console.log("Connected to", destination);
	playerSources[player] = sauce;
	playerGains[player] = gain;
}

export const play = (player: number): AppThunk => dispatch => {
	try{
		playerSources[player].mediaElement.play();
		dispatch(playerState.actions.setPlayerState({ player, state: "playing" }));
		playerSources[player].mediaElement.addEventListener("ended", function(){dispatch(playerState.actions.setPlayerState({ player, state: "stopped" }));})
	} catch {
		console.log("nothing selected/loaded");
	}
};

export const pause = (player: number): AppThunk => dispatch => {
	try{
		if (playerSources[player].mediaElement.paused) {
			playerSources[player].mediaElement.play();
			dispatch(playerState.actions.setPlayerState({ player, state: "playing" }));
		} else {
			playerSources[player].mediaElement.pause();
			dispatch(playerState.actions.setPlayerState({ player, state: "paused" }));
		}
	} catch {
		console.log("nothing selected/loaded");
	}
};

export const stop = (player: number): AppThunk => dispatch => {
	try{
		playerSources[player].mediaElement.pause();
		playerSources[player].mediaElement.currentTime = 0;
		dispatch(playerState.actions.setPlayerState({ player, state: "stopped" }));
	} catch {
		console.log("nothing selected/loaded");
	}
};