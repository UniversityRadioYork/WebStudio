import {
	createSlice,
	PayloadAction,
	Dispatch,
	Middleware
} from "@reduxjs/toolkit";
import Between from "between.js";
import { PlanItem } from "../showplanner/state";
import * as BroadcastState from "../broadcast/state";
import Keys from "keymaster";
import { Track, MYRADIO_NON_API_BASE, AuxItem } from "../api";
import { AppThunk } from "../store";
import { RootState } from "../rootReducer";
import WaveSurfer from "wavesurfer.js";
import { createLoudnessMeasurement } from "./loudness";

const audioContext = new AudioContext();
const wavesurfers: WaveSurfer[] = [];
const playerGainTweens: Array<{
	target: VolumePresetEnum;
	tweens: Between[];
}> = [];
const loadAbortControllers: AbortController[] = [];

let micMedia: MediaStream | null = null;
let micSource: MediaStreamAudioSourceNode | null = null;
let micGain: GainNode | null = null;
let micCompressor: DynamicsCompressorNode | null = null;

const finalCompressor = audioContext.createDynamicsCompressor();
finalCompressor.ratio.value = 20; //brickwall destination comressor
finalCompressor.threshold.value = -0.5;
finalCompressor.attack.value = 0;
finalCompressor.release.value = 0.2;

export const destination = audioContext.createMediaStreamDestination();
console.log("final destination", destination);
finalCompressor.connect(destination);

type PlayerStateEnum = "playing" | "paused" | "stopped";
type PlayerRepeatEnum = "none" | "one" | "all";
type VolumePresetEnum = "off" | "bed" | "full";
type MicVolumePresetEnum = "off" | "full";
type MicErrorEnum = "NO_PERMISSION" | "NOT_SECURE_CONTEXT" | "UNKNOWN";

interface PlayerState {
	loadedItem: PlanItem | Track | AuxItem | null;
	loading: boolean;
	loadError: boolean;
	state: PlayerStateEnum;
	volume: number;
	gain: number;
	wavesurfer: WaveSurfer | null;
	timeCurrent: number;
	timeRemaining: number;
	timeLength: number;
	playOnLoad: Boolean;
	autoAdvance: Boolean;
	repeat: PlayerRepeatEnum;
	tracklistItemID: number;
}

interface MicState {
	open: boolean;
	openError: null | MicErrorEnum;
	volume: number;
	gain: number;
	baseGain: number;
	id: string | null;
	calibration: boolean;
}

interface MixerState {
	players: PlayerState[];
	mic: MicState;
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
				gain: 1,
				wavesurfer: null,
				timeCurrent: 0,
				timeRemaining: 0,
				timeLength: 0,
				playOnLoad: false,
				autoAdvance: true,
				repeat: "none",
				tracklistItemID: -1,
				loadError: false
			},
			{
				loadedItem: null,
				loading: false,
				state: "stopped",
				volume: 1,
				gain: 1,
				wavesurfer: null,
				timeCurrent: 0,
				timeRemaining: 0,
				timeLength: 0,
				playOnLoad: false,
				autoAdvance: true,
				repeat: "none",
				tracklistItemID: -1,
				loadError: false
			},
			{
				loadedItem: null,
				loading: false,
				state: "stopped",
				volume: 1,
				gain: 1,
				wavesurfer: null,
				timeCurrent: 0,
				timeRemaining: 0,
				timeLength: 0,
				playOnLoad: false,
				autoAdvance: true,
				repeat: "none",
				tracklistItemID: -1,
				loadError: false
			}
		],
		mic: {
			open: false,
			volume: 1,
			gain: 1,
			baseGain: 1,
			openError: null,
			id: "None",
			calibration: false
		}
	} as MixerState,
	reducers: {
		loadItem(
			state,
			action: PayloadAction<{
				player: number;
				item: PlanItem | Track | AuxItem;
			}>
		) {
			state.players[action.payload.player].loadedItem =
				action.payload.item;
			state.players[action.payload.player].loading = true;
			state.players[action.payload.player].timeCurrent = 0;
			state.players[action.payload.player].timeLength = 0;
			state.players[action.payload.player].tracklistItemID = -1;
			state.players[action.payload.player].loadError = false;
		},
		itemLoadComplete(state, action: PayloadAction<{ player: number }>) {
			state.players[action.payload.player].loading = false;
		},
		itemLoadError(state, action: PayloadAction<{ player: number }>) {
			state.players[action.payload.player].loading = false;
			state.players[action.payload.player].loadError = true;
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
		},
		setMicError(state, action: PayloadAction<null | MicErrorEnum>) {
			state.mic.openError = action.payload;
		},
		micOpen(state, action) {
			state.mic.open = true;
			state.mic.id = action.payload;
		},
		setMicLevels(
			state,
			action: PayloadAction<{ volume: number; gain: number }>
		) {
			state.mic.volume = action.payload.volume;
			state.mic.gain = action.payload.gain;
		},
		setMicBaseGain(state, action: PayloadAction<number>) {
			state.mic.baseGain = action.payload;
		},
		setTimeCurrent(
			state,
			action: PayloadAction<{
				player: number;
				time: number;
			}>
		) {
			state.players[action.payload.player].timeCurrent =
				action.payload.time;
			state.players[action.payload.player].timeRemaining =
				state.players[action.payload.player].timeLength -
				action.payload.time;
		},
		setTimeLength(
			state,
			action: PayloadAction<{
				player: number;
				time: number;
			}>
		) {
			state.players[action.payload.player].timeLength =
				action.payload.time;
		},
		toggleAutoAdvance(
			state,
			action: PayloadAction<{
				player: number;
			}>
		) {
			state.players[action.payload.player].autoAdvance = !state.players[
				action.payload.player
			].autoAdvance;
		},
		togglePlayOnLoad(
			state,
			action: PayloadAction<{
				player: number;
			}>
		) {
			state.players[action.payload.player].playOnLoad = !state.players[
				action.payload.player
			].playOnLoad;
		},
		toggleRepeat(
			state,
			action: PayloadAction<{
				player: number;
			}>
		) {
			var playVal = state.players[action.payload.player].repeat;
			switch (playVal) {
				case "none":
					playVal = "one";
					break;
				case "one":
					playVal = "all";
					break;
				case "all":
					playVal = "none";
					break;
			}
			state.players[action.payload.player].repeat = playVal;
		},
		setTracklistItemID(
			state,
			action: PayloadAction<{
				player: number;
				id: number;
			}>
		) {
			state.players[action.payload.player].tracklistItemID =
				action.payload.id;
		},
		startMicCalibration(state) {
			state.mic.calibration = true;
		},
		stopMicCalibration(state) {
			state.mic.calibration = false;
		}
	}
});

export default mixerState.reducer;

export const { setMicBaseGain } = mixerState.actions;

export const load = (
	player: number,
	item: PlanItem | Track | AuxItem
): AppThunk => async (dispatch, getState) => {
	if (typeof wavesurfers[player] !== "undefined") {
		if (wavesurfers[player].isPlaying()) {
			// already playing, don't kill playback
			return;
		}
	}
	// If we're already loading something, abort it
	if (typeof loadAbortControllers[player] !== "undefined") {
		loadAbortControllers[player].abort();
	}
	loadAbortControllers[player] = new AbortController();

	dispatch(mixerState.actions.loadItem({ player, item }));

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
	if (waveform != undefined) {
		waveform.innerHTML = "";
	}
	const wavesurfer = WaveSurfer.create({
		audioContext,
		container: "#waveform-" + player.toString(),
		waveColor: "#CCCCFF",
		progressColor: "#9999FF",
		backend: "MediaElementWebAudio",
		responsive: true,
		xhr: {
			credentials: "include"
		} as any
	});

	wavesurfer.on("ready", () => {
		dispatch(mixerState.actions.itemLoadComplete({ player }));
		dispatch(
			mixerState.actions.setTimeCurrent({
				player,
				time: 0
			})
		);
		dispatch(
			mixerState.actions.setTimeLength({
				player,
				time: wavesurfer.getDuration()
			})
		);
		const state = getState().mixer.players[player];
		if (state.playOnLoad) {
			wavesurfer.play();
		}
	});
	wavesurfer.on("play", () => {
		dispatch(
			mixerState.actions.setPlayerState({ player, state: "playing" })
		);
	});
	wavesurfer.on("pause", () => {
		dispatch(
			mixerState.actions.setPlayerState({
				player,
				state: wavesurfer.getCurrentTime() === 0 ? "stopped" : "paused"
			})
		);
	});
	wavesurfer.on("finish", () => {
		dispatch(
			mixerState.actions.setPlayerState({ player, state: "stopped" })
		);
		const state = getState().mixer.players[player];
		if (state.tracklistItemID !== -1) {
			dispatch(BroadcastState.tracklistEnd(state.tracklistItemID));
		}
		if (state.repeat === "one") {
			wavesurfer.play();
		} else if (state.repeat === "all") {
			if ("channel" in item) {
				// it's not in the CML/libraries "column"
				const itsChannel = getState().showplan.plan!.filter(
					x => x.channel === item.channel
				);
				const itsIndex = itsChannel.indexOf(item);
				if (itsIndex === itsChannel.length - 1) {
					dispatch(load(player, itsChannel[0]));
				}
			}
		} else if (state.autoAdvance) {
			if ("channel" in item) {
				// it's not in the CML/libraries "column"
				const itsChannel = getState().showplan.plan!.filter(
					x => x.channel === item.channel
				);
				const itsIndex = itsChannel.indexOf(item);
				if (itsIndex > -1 && itsIndex !== itsChannel.length - 1) {
					dispatch(load(player, itsChannel[itsIndex + 1]));
				}
			}
		}
	});
	wavesurfer.on("audioprocess", () => {
		if (
			Math.abs(
				wavesurfer.getCurrentTime() -
					getState().mixer.players[player].timeCurrent
			) > 0.5
		) {
			dispatch(
				mixerState.actions.setTimeCurrent({
					player,
					time: wavesurfer.getCurrentTime()
				})
			);
		}
	});

	try {
		const signal = loadAbortControllers[player].signal; // hang on to the signal, even if its controller gets replaced
		const result = await fetch(url, {
			credentials: "include",
			signal
		});
		const rawData = await result.arrayBuffer();
		const blob = new Blob([rawData]);
		const objectUrl = URL.createObjectURL(blob);

		const audio = new Audio(objectUrl);

		wavesurfer.load(audio);

		// THIS IS BAD
		(wavesurfer as any).backend.gainNode.disconnect();
		(wavesurfer as any).backend.gainNode.connect(finalCompressor);
		(wavesurfer as any).backend.gainNode.connect(audioContext.destination);

		// Double-check we haven't been aborted since
		if (signal.aborted) {
			throw new DOMException("abort load", "AbortError");
		}

		wavesurfer.setVolume(getState().mixer.players[player].gain);
		wavesurfers[player] = wavesurfer;
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

export const play = (player: number): AppThunk => (dispatch, getState) => {
	if (typeof wavesurfers[player] === "undefined") {
		console.log("nothing loaded");
		return;
	}
	var state = getState().mixer.players[player];
	if (state.loading) {
		console.log("not ready");
		return;
	}
	wavesurfers[player].play();

	if (state.loadedItem && "album" in state.loadedItem) {
		//track
		dispatch(
			BroadcastState.tracklistStart(player, state.loadedItem.trackid)
		);
	}
};

export const pause = (player: number): AppThunk => (dispatch, getState) => {
	if (typeof wavesurfers[player] === "undefined") {
		console.log("nothing loaded");
		return;
	}
	if (getState().mixer.players[player].loading) {
		console.log("not ready");
		return;
	}
	if (wavesurfers[player].isPlaying()) {
		wavesurfers[player].pause();
	} else {
		wavesurfers[player].play();
	}
};

export const stop = (player: number): AppThunk => (dispatch, getState) => {
	if (typeof wavesurfers[player] === "undefined") {
		console.log("nothing loaded");
		return;
	}
	var state = getState().mixer.players[player];
	if (state.loading) {
		console.log("not ready");
		return;
	}
	wavesurfers[player].stop();

	if (state.tracklistItemID !== -1) {
		dispatch(BroadcastState.tracklistEnd(state.tracklistItemID));
	}
};

export const {
	toggleAutoAdvance,
	togglePlayOnLoad,
	toggleRepeat
} = mixerState.actions;

export const redrawWavesurfers = (): AppThunk => () => {
	wavesurfers.forEach(function(item) {
		item.drawBuffer();
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
			volume = 0;
			uiLevel = 0;
			break;
		case "bed":
			volume = 0.185;
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
			dispatch(
				mixerState.actions.setPlayerVolume({ player, volume: val })
			);
		});
	const gainTween = new Between(currentGain, volume)
		.time(FADE_TIME_SECONDS * 1000)
		.easing((Between as any).Easing.Exponential.InOut)
		.on("update", (val: number) => {
			if (typeof wavesurfers[player] !== "undefined") {
				wavesurfers[player].setVolume(val);
			}
		})
		.on("complete", () => {
			dispatch(
				mixerState.actions.setPlayerGain({ player, gain: volume })
			);
			// clean up when done
			delete playerGainTweens[player];
		});

	playerGainTweens[player] = {
		target: level,
		tweens: [volumeTween, gainTween]
	};
};

export const openMicrophone = (micID: string): AppThunk => async (
	dispatch,
	getState
) => {
	if (getState().mixer.mic.open) {
		micSource?.disconnect();
	}
	dispatch(mixerState.actions.setMicError(null));
	if (!("mediaDevices" in navigator)) {
		// mediaDevices is not there - we're probably not in a secure context
		dispatch(mixerState.actions.setMicError("NOT_SECURE_CONTEXT"));
		return;
	}
	try {
		micMedia = await navigator.mediaDevices.getUserMedia({
			audio: {
				deviceId: { exact: micID },
				echoCancellation: false,
				autoGainControl: false,
				noiseSuppression: false,
				latency: 0.01
			}
		});
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
	// Okay, we have a mic stream, time to do some audio nonsense
	micSource = audioContext.createMediaStreamSource(micMedia);
	micGain = audioContext.createGain();
	const state = getState().mixer.mic;
	micGain.gain.value = state.gain * state.baseGain;
	micCompressor = audioContext.createDynamicsCompressor();
	micCompressor.ratio.value = 3; // mic compressor - fairly gentle, can be upped
	micCompressor.threshold.value = -18;
	micCompressor.attack.value = 0.01;
	micCompressor.release.value = 0.1;
	micSource
		.connect(micGain)
		.connect(micCompressor)
		.connect(finalCompressor);
	dispatch(mixerState.actions.micOpen(micID));
};

export const setMicVolume = (
	level: MicVolumePresetEnum
): AppThunk => dispatch => {
	// no tween fuckery here, just cut the level
	const levelVal = level === "full" ? 1 : 0;
	dispatch(
		mixerState.actions.setMicLevels({ volume: levelVal, gain: levelVal })
	);
};

let analyser: AnalyserNode | null = null;

const CALIBRATE_THE_CALIBRATOR = false;

export const startMicCalibration = (): AppThunk => async (
	dispatch,
	getState
) => {
	if (!getState().mixer.mic.open) {
		return;
	}
	dispatch(mixerState.actions.startMicCalibration());
	let input: AudioNode;
	if (CALIBRATE_THE_CALIBRATOR) {
		const sauce = new Audio(
			"https://ury.org.uk/myradio/NIPSWeb/managed_play/?managedid=6489"
		); // URY 1K Sine -2.5dbFS PPM5
		sauce.crossOrigin = "use-credentials";
		sauce.autoplay = true;
		sauce.load();
		input = audioContext.createMediaElementSource(sauce);
	} else {
		input = micCompressor!;
	}
	analyser = audioContext.createAnalyser();
	analyser.fftSize = 8192;
	input.connect(analyser);
};

let float: Float32Array | null = null;

export function getMicAnalysis() {
	if (!analyser) {
		throw new Error();
	}
	if (!float) {
		float = new Float32Array(analyser.fftSize);
	}
	analyser.getFloatTimeDomainData(float);
	let sumOfSquares = 0;
	let peak = 0;
	for (let i = 0; i < float.length; i++) {
		peak = Math.max(peak, float[i] ** 2);
		sumOfSquares += float[i] ** 2;
	}
	return 10 * Math.log10(peak);
}

export const stopMicCalibration = (): AppThunk => (dispatch, getState) => {
	if (getState().mixer.mic.calibration === null) {
		return;
	}
	dispatch(mixerState.actions.stopMicCalibration());
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
		if (typeof wavesurfers[index] !== "undefined") {
			if (oldState.players[index].gain !== newState.players[index].gain) {
				wavesurfers[index].setVolume(state.gain);
			}
		}
	});
	if (
		(newState.mic.gain !== oldState.mic.gain ||
			newState.mic.baseGain !== oldState.mic.baseGain) &&
		micGain !== null
	) {
		micGain.gain.value = newState.mic.gain * newState.mic.baseGain;
	}
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

	Keys("x", () => {
		const state = store.getState().mixer.mic;
		store.dispatch(setMicVolume(state.volume === 1 ? "off" : "full"));
	});

	return next => action => next(action);
};
