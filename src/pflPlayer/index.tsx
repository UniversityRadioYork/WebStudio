import React, { useState } from "react";

export function PflPlayer() {
  return (
    <div id="pfl-player">
      <div
        className={"m-0 graph" + (playerState.loading !== -1 ? " loading" : "")}
        id={"waveform-pfl"}
        style={
          playerState.loading !== -1
            ? {
                width: playerState.loading * 100 + "%",
              }
            : {}
        }
      ></div>
    </div>
  );
}
