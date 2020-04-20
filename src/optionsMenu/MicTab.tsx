import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../rootReducer";

import * as MixerState from "../mixer/state";
import { VUMeter } from "./helpers/VUMeter";

type MicErrorEnum =
  | "NO_PERMISSION"
  | "NOT_SECURE_CONTEXT"
  | "UNKNOWN"
  | "UNKNOWN_ENUM";

function reduceToInputs(devices: MediaDeviceInfo[]) {
  var temp: MediaDeviceInfo[] = [];
  devices.forEach((device) => {
    if (device.kind === "audioinput") {
      temp.push(device);
    }
  });
  return temp;
}

export function MicTab() {
  const state = useSelector((state: RootState) => state.mixer.mic);
  const [micList, setMicList] = useState<null | MediaDeviceInfo[]>(null);
  const dispatch = useDispatch();
  const [nextMicSource, setNextMicSource] = useState("$NONE");
  const [openError, setOpenError] = useState<null | MicErrorEnum>(null);

  async function fetchMicNames() {
    // Because Chrome, we have to call getUserMedia() before enumerateDevices()
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      if (e instanceof DOMException) {
        switch (e.message) {
          case "Permission denied":
            setOpenError("NO_PERMISSION");
            break;
          default:
            setOpenError("UNKNOWN");
        }
      } else {
        setOpenError("UNKNOWN");
      }
      return;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setMicList(reduceToInputs(devices));
    } catch (e) {
      setOpenError("UNKNOWN_ENUM");
    }
  }

  function setMicSource(sourceId: string) {
    setNextMicSource(sourceId);
    dispatch(MixerState.openMicrophone(sourceId));
  }

  const rafRef = useRef<number | null>(null);
  const [peak, setPeak] = useState(-Infinity);

  const animate = useCallback(() => {
    if (state.calibration) {
      const result = MixerState.getMicAnalysis();
      setPeak(result);
      rafRef.current = requestAnimationFrame(animate);
    } else if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, [state.calibration]);

  useEffect(() => {
    if (state.calibration) {
      rafRef.current = requestAnimationFrame(animate);
    } else if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, [animate, state.calibration]);

  return (
    <>
      <button onClick={fetchMicNames} disabled={micList !== null}>
        Open
      </button>
      <select
        className="form-control"
        style={{ width: "100%" }}
        value={nextMicSource}
        onChange={(e) => setMicSource(e.target.value)}
        disabled={micList === null}
      >
        <option value={"$NONE"} disabled label="Choose a microphone" />
        {(micList || []).map(function(e, i) {
          return (
            <option value={e.deviceId} key={i}>
              {e.label !== "" ? e.label : e.deviceId}
            </option>
          );
        })}
      </select>
      {state.openError !== null && (
        <div className="sp-alert">
          {state.openError === "NO_PERMISSION" || openError === "NO_PERMISSION"
            ? "Please grant this page permission to use your microphone and try again."
            : state.openError === "NOT_SECURE_CONTEXT" ||
              openError === "NOT_SECURE_CONTEXT"
            ? "We can't open the microphone. Please make sure the address bar has a https:// at the start and try again."
            : openError === "UNKNOWN_ENUM"
            ? "An error occurred when enumerating input devices. Please try again."
            : "An error occurred when opening the microphone. Please try again."}
        </div>
      )}

      <div style={{ opacity: state.open ? 1 : 0.5 }}>
        <h3>Calibration</h3>
        <b>
          Speak into the microphone at a normal volume. Adjust the gain slider
          until the bar below is green when you're speaking.
        </b>
        <div>
          <VUMeter
            width={400}
            height={40}
            value={peak}
            range={[-70, 0]}
            greenRange={[-14, -3]}
          />
        </div>
        <div>
          <input
            type="range"
            min={1.0 / 10}
            max={3}
            step={0.05}
            value={state.baseGain}
            onChange={(e) =>
              dispatch(MixerState.setMicBaseGain(parseFloat(e.target.value)))
            }
          />
          <b>{state.baseGain.toFixed(1)}</b>
        </div>
      </div>
    </>
  );
}
