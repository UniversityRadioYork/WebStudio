import React, { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../rootReducer";

import * as MixerState from "../mixer/state";
import { VUMeter } from "./helpers/VUMeter";
import { ChannelMapping } from "../mixer/audio";

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
  const [nextMicMapping, setNextMicMapping] = useState<ChannelMapping>(
    "mono-both"
  );
  const [openError, setOpenError] = useState<null | MicErrorEnum>(null);

  async function fetchMicNames() {
    if (!("mediaDevices" in navigator)) {
      setOpenError("NOT_SECURE_CONTEXT");
      return;
    }
    // Because Chrome, we have to call getUserMedia() before enumerateDevices()
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      console.warn(e);
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
      console.log(devices);
      setMicList(reduceToInputs(devices));
    } catch (e) {
      setOpenError("UNKNOWN_ENUM");
    }
  }

  function setMicSource(sourceId: string) {
    setNextMicSource(sourceId);
    dispatch(MixerState.openMicrophone(sourceId, nextMicMapping));
  }

  function setMicMapping(mapping: ChannelMapping) {
    setNextMicMapping(mapping);
    dispatch(MixerState.openMicrophone(nextMicSource, mapping));
  }

  return (
    <>
      <h3>Mic Selection</h3>
      <p>
        Click the "<b>Find Microphones</b>" button, then choose the microphone
        you want from the dropdown.
      </p>
      <button
        onClick={fetchMicNames}
        disabled={micList !== null}
        className="btn btn-outline-dark"
      >
        Find Microphones
      </button>
      <select
        className="form-control my-2"
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
      {(state.openError !== null || openError !== null) && (
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

      <select
        className="form-control my-2"
        value={nextMicMapping}
        onChange={(e) => setMicMapping(e.target.value as ChannelMapping)}
        disabled={nextMicSource === "$NONE"}
      >
        <option value={"mono-both"} label="Mono (Default)" />
        <option value={"mono-left"} label="Mono - Left Channel" />
        <option value={"mono-right"} label="Mono - Right Channel" />
        <option value={"stereo-normal"} label="Stereo" />
        <option value={"stereo-flipped"} label="Stereo - Flipped" />
      </select>
      <div className="form-check">
        <input
          className="form-check-input"
          type="checkbox"
          checked={state.processing}
          onChange={(e) => {
            dispatch(MixerState.setMicProcessingEnabled(e.target.checked));
          }}
        />
        <label className="form-check-label">
          Apply Mic Processing (Default: On)
        </label>
      </div>
      <hr />
      <div style={{ opacity: state.open ? 1 : 0.5 }}>
        <h3>Calibration</h3>
        <p>
          Speak into the microphone at your <b>normal presenting volume</b>.
          Adjust the gain slider until the bar below is <b>green</b> when you're
          speaking.
        </p>
        <div>
          <VUMeter
            width={400}
            height={40}
            source="mic-precomp"
            range={[-70, 0]}
            greenRange={state.processing ? [-16, -6] : [-32, -5]}
            stereo={true}
          />
        </div>
        <div>
          <input
            className="mr-2"
            type="range"
            min={-24}
            max={24}
            step={0.2}
            value={state.baseGain}
            onChange={(e) =>
              dispatch(MixerState.setMicBaseGain(parseFloat(e.target.value)))
            }
          />
          <b>{state.baseGain.toFixed(1)} dB</b>
        </div>
      </div>
    </>
  );
}
