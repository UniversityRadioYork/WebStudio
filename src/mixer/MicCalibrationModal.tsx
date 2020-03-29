import React from "react";
import Modal from "react-modal";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../rootReducer";

import * as MixerState from "./state";
import { VUMeter } from "./VUMeter";

export function MicCalibrationModal() {
	const state = useSelector(
		(state: RootState) => state.mixer.mic.calibration
	);
	const dispatch = useDispatch();
	return (
		<Modal
			isOpen={state !== null}
			onRequestClose={() => dispatch(MixerState.stopMicCalibration())}
		>
			{state !== null && (
				<>
					<h3>Peak: {state.peak}</h3>
					<b>
						Speak into the microphone at a normal volume. Adjust the
						gain slider until the bar below is green when you're speaking.
					</b>
					<VUMeter
						width={400}
						height={40}
						value={state.peak}
						range={[-70, 0]}
						greenRange={[-3.5, -1.5]}
					/>
					<button
						onClick={() =>
							dispatch(MixerState.stopMicCalibration())
						}
					>
						Stop
					</button>
				</>
			)}
		</Modal>
	);
}
