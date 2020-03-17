import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { PlanItem } from "../state";
import { Track, MYRADIO_NON_API_BASE } from "../../api";
import { AppThunk } from "../../store";

const audioContext = new AudioContext();
const playerSources: MediaElementAudioSourceNode[] = [];
const playerGains: GainNode[] = [];
const destination = audioContext.createMediaStreamDestination();

interface SinglePlayerState {
	loadedItem: PlanItem  | Track | null
	loading: boolean;
}

interface PlayerState {
	players: SinglePlayerState[];
}

const playerState = createSlice({
	name: "Player",
	initialState: {
		players: [{
			loadedItem: null,
			loading: false
		}, {
			loadedItem: null,
			loading: false
		}, {
			loadedItem: null,
			loading: false
		}]
	} as PlayerState,
	reducers: {
		loadItem(state, action: PayloadAction<{ player: number, item: PlanItem | Track }>) {
			state.players[action.payload.player].loadedItem = action.payload.item
			state.players[action.payload.player].loading = true;
		},
		itemLoadComplete(state, action: PayloadAction<{ player: number}>) {
			state.players[action.payload.player].loading = false;
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
	gain.connect(audioContext.destination);
	gain.connect(destination);
	playerSources[player] = sauce;
	playerGains[player] = gain;
}

export const play = (player: number): AppThunk => dispatch => {
	playerSources[player].mediaElement.play();
};

export const pause = (player: number): AppThunk => dispatch => {
	if (playerSources[player].mediaElement.paused) {
		playerSources[player].mediaElement.play();
	} else {
		playerSources[player].mediaElement.pause();
	}
};

export const stop = (player: number): AppThunk => dispatch => {
	playerSources[player].mediaElement.pause();
	playerSources[player].mediaElement.currentTime = 0;
};