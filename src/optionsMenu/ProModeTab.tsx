import React, { useState, useRef, useEffect, useCallback } from "react";
import { streamer } from "../broadcast/state";
import { WebRTCStreamer } from "../broadcast/rtc_streamer";
import {useDispatch, useSelector} from "react-redux";
import {RootState} from "../rootReducer";
import {changeSetting} from "./settingsState";

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
          This mode enables some advanced features. Don't enable it unless you know what you're doing!
      </label>
      </div>
    </>
  );
}
