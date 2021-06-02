import React, { useState } from "react";
import LiveClock from "react-live-clock";
import { useSelector } from "react-redux";
import { myradioApiRequest } from "../api";
import { useInterval } from "../lib/utils";
import { RootState } from "../rootReducer";
import "./timelord.scss";

const SILENCE_WARN_SECS = 5;

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

    return silence >= SILENCE_WARN_SECS;
  }

  const broadcastStage = useSelector(
    (state: RootState) => state.broadcast.stage
  );
  const broadcastConnection = useSelector(
    (state: RootState) => state.broadcast.connectionState
  );
  const [source, setSource] = useState({ id: -1, name: "Loading" });
  const [isSilence, setSilence] = useState(false);

  useInterval(
    async () => {
      setSource(await getSource());
    },
    broadcastStage === "REGISTERED" ? 3000 : 10000
  );

  useInterval(async () => {
    broadcastStage === "REGISTERED"
      ? setSilence(await getSilence())
      : setSilence(false);
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
      {broadcastStage === "REGISTERED" &&
      ["LIVE", "CONNECTED"].indexOf(broadcastConnection) === -1 ? (
        <span className="error">Streaming Error!</span>
      ) : isSilence ? (
        <span className="error">SILENCE DETECTED</span>
      ) : (
        source.id > -1 && (
          <span className="source">
            <span className={"studio studio" + source.id}>{source.name}</span>
            &nbsp;is On Air
          </span>
        )
      )}
    </li>
  );
}
