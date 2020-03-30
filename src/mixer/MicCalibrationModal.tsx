import React, { useState, useEffect, useRef } from "react";
import Modal from "react-modal";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../rootReducer";

import * as MixerState from "./state";
import { VUMeter } from "./VUMeter";

export function MicCalibrationModal() {
	const state = useSelector((state: RootState) => state.mixer.mic);
	const rafRef = useRef<number | null>(null);
	const [peak, setPeak] = useState(-Infinity);

	const animate = () => {
		if (state.calibration) {
			const result = MixerState.getMicAnalysis();
			setPeak(result);
			rafRef.current = requestAnimationFrame(animate);
		} else if (rafRef.current !== null) {
			cancelAnimationFrame(rafRef.current);
			rafRef.current = null;
		}
	};

	useEffect(() => {
		if (state.calibration) {
			rafRef.current = requestAnimationFrame(animate);
		} else if (rafRef.current !== null) {
			cancelAnimationFrame(rafRef.current);
			rafRef.current = null;
		}
	}, [state.calibration]);
	const dispatch = useDispatch();
	return (
		<Modal
			isOpen={state.calibration}
			onRequestClose={() => dispatch(MixerState.stopMicCalibration())}
		>
			{state.calibration && (
				<>
					<b>
						Speak into the microphone at a normal volume. Adjust the
						gain slider until the bar below is green when you're
						speaking.
					</b>
					<div>
						<VUMeter
							width={400}
							height={40}
							value={peak}
							range={[-70, 0]}
							greenRange={[-20, -7]}
						/>
					</div>
					<div>
						<input
							type="range"
							min={1 / 10}
							max={3}
							step={0.05}
							value={state.gain}
							onChange={e =>
								dispatch(
									MixerState.setMicBaseGain(
										parseFloat(e.target.value)
									)
								)
							}
						/>
						<b>{state.baseGain.toFixed(1)}</b>
					</div>
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
