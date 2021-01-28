import React from "react";
import LiveClock from "react-live-clock";
import "./timelord.scss";

export function Timelord() {
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
    </li>
  );
}
