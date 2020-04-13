import React from "react";
import { RootState } from "../rootReducer";
import { useSelector, useDispatch } from "react-redux";
import { changeSetting } from "./settingsState";
import { changeBroadcastSetting } from "../broadcast/state";

export function AdvancedTab() {
  const settings = useSelector((state: RootState) => state.settings);
  const broadcastState = useSelector((state: RootState) => state.broadcast);
  const dispatch = useDispatch();

  // @ts-ignore
  return (
    <>
      <h2>Selector Options</h2>

      <div className="form-group">
        <label>
          Selector Source (Don't change this unless you know what you're doing!)
        </label>
        <select
          className="form-control"
          id="broadcastSourceSelect"
          value={broadcastState.sourceID}
          onChange={e =>
            dispatch(
              changeBroadcastSetting("sourceID", parseInt(e.target.value))
            )
          }
        >
          <option value="4">4 (OB-Line)</option>
          <option value="5">5 (WebStudio Direct)</option>
        </select>
      </div>
      <h3>Automatic News</h3>

      <div className="form-check">
        <input
          className="form-check-input"
          type="checkbox"
          checked={broadcastState.autoNewsBeginning}
          onChange={e =>
            dispatch(
              changeBroadcastSetting("autoNewsBeginning", e.target.checked)
            )
          }
        />
        <label className="form-check-label">Beginning of Show</label>
      </div>
      <div className="form-check">
        <input
          className="form-check-input"
          type="checkbox"
          checked={broadcastState.autoNewsMiddle}
          onChange={e =>
            dispatch(changeBroadcastSetting("autoNewsMiddle", e.target.checked))
          }
        />
        <label className="form-check-label">
          Middle of Show (2+ hour shows only)
        </label>
      </div>
      <div className="form-check">
        <input
          className="form-check-input"
          type="checkbox"
          checked={broadcastState.autoNewsEnd}
          onChange={e =>
            dispatch(changeBroadcastSetting("autoNewsEnd", e.target.checked))
          }
        />
        <label className="form-check-label">End of Show</label>
      </div>
      <hr />
      <h2>Misc</h2>
      <div className="form-group">
        <label>
          Tracklist (Don't change this unless you know what you're doing!)
        </label>
        <select
          className="form-control"
          id="broadcastSourceSelect"
          value={settings.tracklist}
          onChange={e =>
            dispatch(
              changeSetting({
                key: "tracklist",
                // @ts-ignore
                val: e.target.value
              })
            )
          }
        >
          <option value="always">Always</option>
          <option value="while_live">While Live</option>
          <option value="never">Never</option>
        </select>
      </div>
      <div className="form-check">
        <input
          className="form-check-input"
          type="checkbox"
          checked={settings.showDebugInfo}
          onChange={e =>
            dispatch(
              changeSetting({
                key: "showDebugInfo",
                val: e.target.checked
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
          onChange={e =>
            dispatch(
              changeSetting({
                key: "enableRecording",
                val: e.target.checked
              })
            )
          }
        />
        <label className="form-check-label">Enable recording</label>
      </div>
    </>
  );
}
