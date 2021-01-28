import React, { useState } from "react";
import LiveClock from "react-live-clock";
import { myradioApiRequest } from "../api";
import { useInterval } from "../lib/utils";
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
    if (sourceNames[studio - 1]) {
      sourceName = sourceNames[studio - 1];
    }

    return { id: studio, name: sourceName };
  }

  const [source, setSource] = useState({ id: 0, name: "Unknown" });

  useInterval(async () => {
    setSource(await getSource());
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
      <span className="source">
        <span className={"studio studio" + source.id}>{source.name}</span> is On
        Air
      </span>
    </li>
  );
}
