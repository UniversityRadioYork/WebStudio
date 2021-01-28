import React, { useState } from "react";
import LiveClock from "react-live-clock";
import { useSelector } from "react-redux";
import { myradioApiRequest } from "../api";
import { useInterval } from "../lib/utils";
import { RootState } from "../rootReducer";
import "./timelord.scss";

export function Timelord() {
  async function getSource() {
    let studio = await myradioApiRequest("/selector/studioattime", "GET", null);

    const sourceNames = [
      "Studio Red",
      "Studio Blue",
      "Jukebox",
      "OB",
      "WebStudio",
      "Unknown",
      "Sine Wave",
      "Off Air",
    ];

    let sourceName = "Unknown";
    if (studio > 0 && studio < sourceNames.length) {
      sourceName = sourceNames[studio - 1];
    }

    return { id: studio, name: sourceName };
  }

  async function getSilence() {
    let silence = await myradioApiRequest("/selector/issilence", "GET", null);

    return silence;
  }

  const broadcastState = useSelector((state: RootState) => state.broadcast);
  const [source, setSource] = useState({ id: 0, name: "Unknown" });
  const [isSilence, setSilence] = useState(false);

  useInterval(async () => {
    setSource(await getSource());
  }, 3000);

  useInterval(async () => {
    setSilence(await getSilence());
  }, 3000);

  return (
    <li
      className="btn rounded-0 py-2 nav-link nav-item"
      id="timelord"
      onClick={(e) => {
        e.preventDefault();
        window.open(
          "http://ury.org.uk/timelord/",
          "URY - Timelord",
          "resizable,status"
        );
      }}
    >
      <LiveClock
        format={"HH:mm:ss"}
        ticking={true}
        timezone={"europe/london"}
      />
      {broadcastState.stage === "REGISTERED" &&
      !(
        broadcastState.connectionState in ["LIVE", "CONNECTED", "NOT_CONNECTED"]
      ) ? (
        <span className="error">Streaming Error!</span>
      ) : isSilence ? (
        <span className="error">SILENCE DETECTED</span>
      ) : (
        <span className="source">
          <span className={"studio studio" + source.id}>{source.name}</span>
          &nbsp;is On Air
        </span>
      )}
    </li>
  );
}
