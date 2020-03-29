import React, { useState, useEffect } from "react";
import Modal from "react-modal";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../rootReducer";

import * as MixerState from "./state";
import { VUMeter } from "./VUMeter";

export function MicCalibrationModal() {
	const state = useSelector(
		(state: RootState) => state.mixer.mic.calibration
	);
	const [peak, setPeak] = useState(-Infinity);

	const animate = () => {
		if (state) {
			const result = MixerState.getMicAnalysis();
			console.log(result);
			setPeak(result);
			requestAnimationFrame(animate);
		}
	};

	useEffect(() => {
		requestAnimationFrame(animate);
	}, [state]);
	const dispatch = useDispatch();
	return (
		<Modal
			isOpen={state}
			onRequestClose={() => dispatch(MixerState.stopMicCalibration())}
		>
			{state !== null && (
				<>
					<b>
						Speak into the microphone at a normal volume. Adjust the
						gain slider until the bar below is green when you're speaking.
					</b>
					<VUMeter
						width={400}
						height={40}
						value={peak}
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
