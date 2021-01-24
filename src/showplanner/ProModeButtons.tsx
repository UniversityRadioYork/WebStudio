import React, { useState } from "react";
import { FaHeadphonesAlt, FaTachometerAlt } from "react-icons/fa";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../rootReducer";
import { setChannelTrim, setChannelPFL } from "../mixer/state";

type ButtonIds = "trim" | "pfl";

export default function ProModeButtons({ channel }: { channel: number }) {
  const [activeButton, setActiveButton] = useState<ButtonIds | null>(null);
  const trimVal = useSelector(
    (state: RootState) => state.mixer.players[channel]?.trim
  );
  const pflState = useSelector(
    (state: RootState) => state.mixer.players[channel]?.pfl
  );
  const dispatch = useDispatch();

  return (
    <>
      <div className="row m-0 p-1 card-header channelButtons proMode hover-menu">
        <span className="hover-label">Pro Mode&trade;</span>
        <button
          className="mr-1 btn btn-warning"
          title="Trim"
          onClick={() =>
            setActiveButton(activeButton === "trim" ? null : "trim")
          }
        >
          <FaTachometerAlt />
        </button>
        <button
          className={
            "mr-1 btn " + (pflState ? "btn-danger" : "btn-outline-dark")
          }
          title="PFL Channel"
          onClick={() => {
            dispatch(setChannelPFL(channel, !pflState));
            setActiveButton("pfl");
          }}
        >
          <FaHeadphonesAlt />
        </button>
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
            <strong className="mt-2">{trimVal} dB</strong>
          </>
        )}
        {activeButton === "pfl" && (
          <span className="mt-2 ml-2">
            Pre Fader Listen:&nbsp;<strong>{pflState ? "Yes" : "No"}</strong>
          </span>
        )}
      </div>
    </>
  );
}
