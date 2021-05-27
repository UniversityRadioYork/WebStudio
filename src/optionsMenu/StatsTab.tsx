import React, { useState, useRef, useEffect, useCallback } from "react";
import { streamer } from "../broadcast/state";
import { WebRTCStreamer } from "../broadcast/rtc_streamer";

export function StatsTab() {
  const [stats, setStats] = useState<RTCStatsReport | null>(null);
  const intervalRef = useRef<number>();

  const update = useCallback(async () => {
    if (streamer instanceof WebRTCStreamer) {
      const statsVal = await streamer.getStatistics();
      if (statsVal !== null) {
        setStats(statsVal);
        console.log(statsVal);
      }
    }
    intervalRef.current = window.setTimeout(update, 5000);
  }, []);

  useEffect(() => {
    intervalRef.current = window.setTimeout(update, 5000);
    return () => {
      if (typeof intervalRef.current === "number") {
        window.clearTimeout(intervalRef.current);
      }
    };
  }, [update]);

  if (!(streamer instanceof WebRTCStreamer)) {
    return <b>Not connected to server</b>;
  }
  if (stats === null) {
    return <b>Loading stats, please wait...</b>;
  }
  return (
    <>
      {Array.from(stats).map((stat) => (
        <div key={stat[1].id}>
          <h2>Report: {stat[1].type}</h2>
          <div>
            <strong>ID:</strong> {stat[1].id}
          </div>
          {Object.keys(stat[1])
            .filter((x) => x !== "id" && x !== "type" && x !== "timestamp")
            .map((key) => (
              <div key={key}>
                <strong>{key}</strong>: {stat[1][key]}
              </div>
            ))}
        </div>
      ))}
    </>
  );
}
