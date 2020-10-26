import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../rootReducer";
import { changeSetting } from "./settingsState";

export function ProModeTab() {
  const settings = useSelector((state: RootState) => state.settings);
  const dispatch = useDispatch();
  return (
    <>
      <div className="form-check">
        <input
          className="form-check-input"
          type="checkbox"
          checked={settings.proMode}
          onChange={(e) =>
            dispatch(
              changeSetting({
                key: "proMode",
                val: e.target.checked,
              })
            )
          }
        />
        <label className="form-check-label">
          Enable WebStudio Pro Mode&trade;
          <br />
          This mode enables some advanced features. Don't enable it unless you
          know what you're doing!
        </label>
      </div>
      <div className="form-check">
        <input
          className="form-check-input"
          type="checkbox"
          disabled={!settings.proMode}
          checked={settings.resetTrimOnLoad}
          onChange={(e) =>
            dispatch(
              changeSetting({
                key: "resetTrimOnLoad",
                val: e.target.checked,
              })
            )
          }
        />
        <label className="form-check-label">
          Reset trim when loading a new file
        </label>
      </div>
      <hr />
      <h2>Metering</h2>
      <p>Turn down these options if suffering from performance issues.</p>
      <div className="form-check">
        <input
          className="form-check-input"
          type="checkbox"
          disabled={!settings.proMode}
          checked={settings.channelVUs}
          onChange={(e) =>
            dispatch(
              changeSetting({
                key: "channelVUs",
                val: e.target.checked,
              })
            )
          }
        />
        <label className="form-check-label">Enable meters per channel</label>
      </div>
      <div className="form-check">
        <input
          className="form-check-input"
          type="checkbox"
          disabled={!settings.proMode}
          checked={settings.channelVUsStereo}
          onChange={(e) =>
            dispatch(
              changeSetting({
                key: "channelVUsStereo",
                val: e.target.checked,
              })
            )
          }
        />
        <label className="form-check-label">Use stereo metering</label>
      </div>
    </>
  );
}
