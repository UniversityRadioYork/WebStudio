import React from "react";
import { RootState } from "../rootReducer";
import { useSelector, useDispatch } from "react-redux";
import { changeSetting } from "./settingsState";

export function AdvancedTab() {
	const settings = useSelector((state: RootState) => state.settings);
	const dispatch = useDispatch();

	return (
		<>
			<div className="form-check">
				<input
					className="form-check-input"
					type="checkbox"
					checked={settings.showDebugInfo}
					onChange={(e) =>
						dispatch(
							changeSetting({
								key: "showDebugInfo",
								val: e.target.checked,
							})
						)
					}
				/>
				<label className="form-check-label">
					Show showplan debugging information
				</label>
			</div>
			<div className="form-check">
				<input
					className="form-check-input"
					type="checkbox"
					checked={settings.enableRecording}
					onChange={(e) =>
						dispatch(
							changeSetting({
								key: "enableRecording",
								val: e.target.checked,
							})
						)
					}
				/>
				<label className="form-check-label">
					Enable recording
				</label>
			</div>
		</>
	);
}
