import React, { useState } from "react";
import { FaMicrophone, FaBars } from "react-icons/fa";
import { useDispatch, useSelector } from "react-redux";
import { secToHHMM, useInterval } from "../lib/utils";
import { VUMeter } from "../optionsMenu/helpers/VUMeter";
import { RootState } from "../rootReducer";
import { LibraryColumn } from "./libraries";

import * as OptionsMenuState from "../optionsMenu/state";
import * as MixerState from "../mixer/state";
import { PflPlayer } from "../pflPlayer";

export function Sidebar() {
  return (
    <div id="sidebar">
      <LibraryColumn />
      <div className="border-top"></div>
      <PflPlayer />
      <div className="border-top"></div>
      <MicControl />
    </div>
  );
}
function MicControl() {
  const state = useSelector((state: RootState) => state.mixer.mic);
  const proMode = useSelector((state: RootState) => state.settings.proMode);
  const stereo = useSelector(
    (state: RootState) => state.settings.channelVUsStereo
  );
  const dispatch = useDispatch();

  const [count, setCount] = useState(0);

  // Make a persistant mic counter.
  useInterval(() => {
    if (state.volume === 0 || !state.open) {
      setCount(0);
    } else {
      setCount((c) => c + 1);
    }
  }, 1000);

  return (
    <div className="mic-control">
      <div data-toggle="collapse" data-target="#mic-control-menu">
        <h2>
          <FaMicrophone className="mx-1" size={28} />
          Microphone
        </h2>
        <FaBars
          className="toggle mx-0 mt-2 text-muted"
          title="Toggle Microphone Menu"
          size={20}
        />
      </div>
      <div id="mic-control-menu" className="collapse show">
        {!state.open && (
          <p className="alert-info p-2 mb-0">
            The microphone has not been setup. Go to{" "}
            <button
              className="btn btn-link m-0 mb-1 p-0"
              onClick={() => dispatch(OptionsMenuState.open())}
            >
              {" "}
              options
            </button>
            .
          </p>
        )}
        {state.open && proMode && (
          <span id="micLiveTimer" className={state.volume > 0 ? "live" : ""}>
            <span className="text">Mic Live: </span>
            {state.volume > 0 ? secToHHMM(count) : "00:00:00"}
          </span>
        )}
        {state.open && (
          <>
            <div id="micMeter">
              <VUMeter
                width={250}
                height={40}
                source="mic-final"
                range={[-40, 3]}
                greenRange={[-16, -6]}
                stereo={proMode && stereo}
              />
            </div>
            <div className={`mixer-buttons ${!state.open && "disabled"}`}>
              <div
                className="mixer-buttons-backdrop"
                style={{
                  width: state.volume * 100 + "%",
                }}
              ></div>
              <button onClick={() => dispatch(MixerState.setMicVolume("off"))}>
                Off
              </button>
              <button onClick={() => dispatch(MixerState.setMicVolume("full"))}>
                Full
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
