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
      <div className="row m-0 p-1 card-header channelButtons proMode">
        {(activeButton === null || activeButton === "trim") && (
          <button className="btn btn-warning" title="Trim">
            <FaTachometerAlt
              onClick={() =>
                setActiveButton(activeButton === "trim" ? null : "trim")
              }
            />
          </button>
        )}
        {activeButton === "trim" && (
          <>
            <input
              type="range"
              min={-12}
              max={12}
              step={0.2}
              value={trimVal.toFixed(1)}
              onChange={(e) =>
                dispatch(setChannelTrim(channel, parseFloat(e.target.value)))
              }
            />
            <b>{trimVal}</b>
          </>
        )}
      </div>
    </>
  );
}
