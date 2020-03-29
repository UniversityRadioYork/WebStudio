import React from "react";
import Modal from "react-modal";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../rootReducer";

import * as MixerState from "./state";

export function MicCalibrationModal() {
	const state = useSelector(
		(state: RootState) => state.mixer.mic.calibration
	);
	const dispatch = useDispatch();
	return (
		<Modal isOpen={state !== null} onRequestClose={() => dispatch(MixerState.stopMicCalibration())}>
			{state !== null && (
				<>
					<h3>Peak: {state.peak}</h3>
					<h3>Loudness: {state.loudness}</h3>
					<button onClick={() => dispatch(MixerState.stopMicCalibration())}>Stop</button>
				</>
			)}
		</Modal>
	)
}
