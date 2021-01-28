import React, { useEffect, useState } from "react";
import { RootState } from "../rootReducer";
import { useSelector, useDispatch } from "react-redux";
import { changeSetting } from "./settingsState";
import { changeBroadcastSetting } from "../broadcast/state";
import { INTERNAL_OUTPUT_ID } from "../mixer/audio";

type ErrorEnum =
  | "NO_PERMISSION"
  | "NOT_SECURE_CONTEXT"
  | "UNKNOWN"
  | "UNKNOWN_ENUM";

function reduceToOutputs(devices: MediaDeviceInfo[]) {
  var temp: MediaDeviceInfo[] = [];
  devices.forEach((device) => {
    if (device.kind === "audiooutput") {
      temp.push(device);
    }
  });
  return temp;
}

function ChannelOutputSelect({
  outputList,
  channel,
}: {
  outputList: MediaDeviceInfo[] | null;
  channel: number;
}) {
  const outputIds = useSelector(
    (state: RootState) => state.settings.channelOutputIds
  );
  const outputId = outputIds[channel];
  const dispatch = useDispatch();
  return (
    <div className="form-group">
      <label>Channel {channel + 1}</label>
      <select
        className="form-control"
        id="broadcastSourceSelect"
        value={outputId}
        onChange={(e) => {
          let channelOutputIds = { ...outputIds };
          channelOutputIds[channel] = e.target.value;
          dispatch(
            changeSetting({
              key: "channelOutputIds",
              // @ts-ignore
              val: channelOutputIds,
            })
          );
        }}
      >
        {outputId !== INTERNAL_OUTPUT_ID &&
          !outputList?.some((id) => id.deviceId === outputId) && (
            <option value={outputId} disabled>
              Missing Device ({outputId})
            </option>
          )}
        <option value={INTERNAL_OUTPUT_ID}>
          Internal (Direct to Stream/Headphones)
        </option>
        {(outputList || []).map(function(e, i) {
          return (
            <option value={e.deviceId} key={i}>
              {e.label !== "" ? e.label : e.deviceId}
            </option>
          );
        })}
      </select>
    </div>
  );
}
export function AdvancedTab() {
  const settings = useSelector((state: RootState) => state.settings);
  const [outputList, setOutputList] = useState<null | MediaDeviceInfo[]>(null);
  const broadcastState = useSelector((state: RootState) => state.broadcast);
  const [openError, setOpenError] = useState<null | ErrorEnum>(null);

  const dispatch = useDispatch();

  async function fetchOutputNames() {
    if (!("mediaDevices" in navigator)) {
      setOpenError("NOT_SECURE_CONTEXT");
      return;
    }
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
      setOutputList(reduceToOutputs(devices));
    } catch (e) {
      setOpenError("UNKNOWN_ENUM");
    }
  }

  useEffect(() => {
    fetchOutputNames();
  }, []);

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
          onChange={(e) =>
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
          onChange={(e) =>
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
          onChange={(e) =>
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
          onChange={(e) =>
            dispatch(changeBroadcastSetting("autoNewsEnd", e.target.checked))
          }
        />
        <label className="form-check-label">End of Show</label>
      </div>

      <hr />
      <h2>Channel Outputs</h2>
      <p>
        Select a sound output for each channel. <code>Internal</code> routes
        directly to the WebStudio stream/recorder. Other outputs will disable
        ProMode &trade; features.{" "}
        <strong>Routing will apply upon loading a new item.</strong>
      </p>
      {openError !== null && (
        <div className="sp-alert">
          {openError === "NO_PERMISSION"
            ? "Please grant this page permission to use your outputs/microphone and try again."
            : openError === "NOT_SECURE_CONTEXT"
            ? "We can't open the outputs. Please make sure the address bar has a https:// at the start and try again."
            : openError === "UNKNOWN_ENUM"
            ? "An error occurred when enumerating output devices. Please try again."
            : "An error occurred when opening the output devices. Please try again."}
        </div>
      )}
      <ChannelOutputSelect outputList={outputList} channel={0} />
      <ChannelOutputSelect outputList={outputList} channel={1} />
      <ChannelOutputSelect outputList={outputList} channel={2} />
      <ChannelOutputSelect outputList={outputList} channel={3} />

      <hr />
      <h2>Misc</h2>
      <div className="form-check">
        <input
          className="form-check-input"
          type="checkbox"
          checked={settings.saveShowPlanChanges}
          onChange={(e) =>
            dispatch(
              changeSetting({
                key: "saveShowPlanChanges",
                val: e.target.checked,
              })
            )
          }
        />
        <label>Save show plan changes to server.</label>
      </div>
      <div className="form-group">
        <label>
          Tracklist (Don't change this unless you know what you're doing!)
        </label>
        <select
          className="form-control"
          id="broadcastSourceSelect"
          value={settings.tracklist}
          onChange={(e) =>
            dispatch(
              changeSetting({
                key: "tracklist",
                // @ts-ignore
                val: e.target.value,
              })
            )
          }
        >
          <option value="always">Always</option>
          <option value="while_live">While Live</option>
          <option value="never">Never</option>
        </select>
      </div>
      <div className="form-group">
        <label>Play news countdown</label>
        <select
          className="form-control"
          id="broadcastSourceSelect"
          value={settings.doTheNews}
          onChange={(e) =>
            dispatch(
              changeSetting({
                key: "doTheNews",
                // @ts-ignore
                val: e.target.value,
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
        <label className="form-check-label">Enable recording</label>
      </div>
    </>
  );
}
