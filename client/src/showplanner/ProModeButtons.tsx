import React, { useState } from "react";
import { FaTachometerAlt } from "react-icons/fa";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../rootReducer";
import { setChannelTrim } from "../mixer/state";

type ButtonIds = "trim";

export default function ProModeButtons({ channel }: { channel: number }) {
  const [activeButton, setActiveButton] = useState<ButtonIds | null>(null);
  const trimVal = useSelector(
    (state: RootState) => state.mixer.players[channel]?.trim
  );
  const dispatch = useDispatch();

  return (
    <>
      <div className="row m-0 p-1 card-header channelButtons proMode hover-menu">
        <span className="hover-label">Pro Mode&trade;</span>
        {(activeButton === null || activeButton === "trim") && (
          <button
            className="btn btn-warning"
            title="Trim"
            onClick={() =>
              setActiveButton(activeButton === "trim" ? null : "trim")
            }
          >
            <FaTachometerAlt />
          </button>
        )}
        {activeButton === "trim" && (
          <>
            <input
              className="mx-2"
              type="range"
              min={-12}
              max={12}
              step={0.2}
              value={trimVal.toFixed(1)}
              onChange={(e) => {
                dispatch(setChannelTrim(channel, parseFloat(e.target.value)));
                e.target.blur(); // Stop dragging from disabling the keyboard triggers.
              }}
            />
            <b>{trimVal} dB</b>
          </>
        )}
      </div>
    </>
  );
}