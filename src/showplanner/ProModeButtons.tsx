import React, { useState } from "react";
import { FaMicrophoneAlt, FaTachometerAlt } from "react-icons/fa";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../rootReducer";
import { setChannelTrim, setPlayerMicAutoDuck } from "../mixer/state";

type ButtonIds = "trim" | "autoDuck";

export default function ProModeButtons({ channel }: { channel: number }) {
  const [activeButton, setActiveButton] = useState<ButtonIds | null>(null);
  const trimVal = useSelector(
    (state: RootState) => state.mixer.players[channel]?.trim
  );
  const micAutoDuck = useSelector(
    (state: RootState) => state.mixer.players[channel]?.micAutoDuck
  );
  const dispatch = useDispatch();

  return (
    <>
      <div className="row m-0 p-1 card-header channelButtons proMode hover-menu">
        <span className="hover-label">Pro Mode&trade;</span>
        <button className="mr-1 btn btn-warning" title="Trim">
          <FaTachometerAlt onClick={() => setActiveButton("trim")} />
        </button>
        <button
          className={
            "mr-1 btn " + (micAutoDuck ? "btn-info" : "btn-outline-dark")
          }
          title="Auto Duck on Mic Live"
          onClick={() => {
            dispatch(
              setPlayerMicAutoDuck({ player: channel, enabled: !micAutoDuck })
            );
            setActiveButton("autoDuck");
          }}
        >
          <FaMicrophoneAlt />
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
              onChange={(e) =>
                dispatch(setChannelTrim(channel, parseFloat(e.target.value)))
              }
            />
            <strong className="mt-2">{trimVal} dB</strong>
          </>
        )}
        {activeButton === "autoDuck" && (
          <span className="mt-2 ml-2">
            Duck on Mic:&nbsp;<strong>{micAutoDuck ? "Yes" : "No"}</strong>
          </span>
        )}
      </div>
    </>
  );
}
