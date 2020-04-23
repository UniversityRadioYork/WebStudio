import React, { useEffect, useRef, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  FaLevelDownAlt,
  FaPlayCircle,
  FaRedo,
  FaPlay,
  FaPause,
  FaStop,
} from "react-icons/fa";
import { RootState } from "../rootReducer";
import * as MixerState from "../mixer/state";
import { secToHHMM, timestampToHHMM } from "../lib/utils";

export const USE_REAL_GAIN_VALUE = false;

export function Player({ id }: { id: number }) {
  const playerState = useSelector(
    (state: RootState) => state.mixer.players[id]
  );
  const dispatch = useDispatch();

  const [now, setNow] = useState<Date>(new Date());
  const tickerRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    tickerRef.current = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(tickerRef.current);
  }, []);

  return (
    <div
      className={
        playerState.loadedItem !== null && playerState.loading === -1
          ? "player loaded"
          : "player"
      }
    >
      <div className="card text-center">
        <div className="row m-0 p-1 card-header channelButtons">
          <button
            className={
              (playerState.autoAdvance
                ? "btn-primary"
                : "btn-outline-secondary") + " btn btn-sm col-4 sp-play-on-load"
            }
            onClick={() =>
              dispatch(MixerState.toggleAutoAdvance({ player: id }))
            }
          >
            <FaLevelDownAlt />
            &nbsp; Auto Advance
          </button>
          <button
            className={
              (playerState.playOnLoad
                ? "btn-primary"
                : "btn-outline-secondary") + " btn btn-sm col-4 sp-play-on-load"
            }
            onClick={() =>
              dispatch(MixerState.togglePlayOnLoad({ player: id }))
            }
          >
            <FaPlayCircle />
            &nbsp; Play on Load
          </button>
          <button
            className={
              (playerState.repeat !== "none"
                ? "btn-primary"
                : "btn-outline-secondary") + " btn btn-sm col-4 sp-play-on-load"
            }
            onClick={() => dispatch(MixerState.toggleRepeat({ player: id }))}
          >
            <FaRedo />
            &nbsp; Repeat {playerState.repeat}
          </button>
        </div>
        <div className="card-body p-0">
          <span className="card-title">
            <strong>
              {playerState.loadedItem !== null && playerState.loading === -1
                ? playerState.loadedItem.title
                : playerState.loading !== -1
                ? `LOADING`
                : playerState.loadError
                ? "LOAD FAILED"
                : "No Media Selected"}
            </strong>
            <small
              className={
                "border rounded border-danger text-danger p-1 m-1" +
                (playerState.loadedItem !== null &&
                playerState.loading === -1 &&
                "clean" in playerState.loadedItem &&
                !playerState.loadedItem.clean
                  ? ""
                  : " d-none")
              }
            >
              Explicit
            </small>
          </span>
          <br />
          <span className="text-muted">
            {playerState.loadedItem !== null && playerState.loading === -1
              ? "artist" in playerState.loadedItem &&
                playerState.loadedItem.artist
              : ""}
            &nbsp;
          </span>
          <div className="mediaButtons">
            <button
              onClick={() => dispatch(MixerState.play(id))}
              className={
                playerState.state === "playing"
                  ? playerState.timeRemaining <= 15
                    ? "sp-state-playing sp-ending-soon"
                    : "sp-state-playing"
                  : ""
              }
            >
              <FaPlay />
            </button>
            <button
              onClick={() => dispatch(MixerState.pause(id))}
              className={
                playerState.state === "paused" ? "sp-state-paused" : ""
              }
            >
              <FaPause />
            </button>
            <button
              onClick={() => dispatch(MixerState.stop(id))}
              className={
                playerState.state === "stopped" ? "sp-state-stopped" : ""
              }
            >
              <FaStop />
            </button>
          </div>
        </div>

        <div className="p-0 card-footer waveform">
          <span id={"current-" + id} className="m-0 current bypass-click">
            {secToHHMM(playerState.timeCurrent)}
          </span>
          <span id={"length-" + id} className="m-0 length bypass-click">
            {secToHHMM(playerState.timeLength)}
          </span>
          <span id={"remaining-" + id} className="m-0 remaining bypass-click">
            {secToHHMM(playerState.timeRemaining)}
          </span>
          <span id={"ends-" + id} className="m-0 outro bypass-click">
            End -{" "}
            {timestampToHHMM(now.valueOf() / 1000 + playerState.timeRemaining)}
          </span>
          {playerState.loadedItem !== null &&
            "intro" in playerState.loadedItem && (
              <span className="m-0 intro bypass-click">
                {playerState.loadedItem !== null
                  ? secToHHMM(
                      playerState.loadedItem.intro
                        ? playerState.loadedItem.intro
                        : 0
                    )
                  : "00:00:00"}{" "}
                - In
              </span>
            )}
          <div
            className={
              "m-0 graph" + (playerState.loading !== -1 ? " loading" : "")
            }
            id={"waveform-" + id}
            style={
              playerState.loading !== -1
                ? {
                    width: playerState.loading * 100 + "%",
                  }
                : {}
            }
          ></div>
        </div>
      </div>
      <div
        className={
          "mixer-buttons " +
          (playerState.state === "playing" && playerState.volume === 0
            ? "error-animation"
            : "")
        }
      >
        <div
          className="mixer-buttons-backdrop"
          style={{
            width:
              (USE_REAL_GAIN_VALUE ? playerState.gain : playerState.volume) *
                100 +
              "%",
          }}
        ></div>
        <button onClick={() => dispatch(MixerState.setVolume(id, "off"))}>
          Off
        </button>
        <button onClick={() => dispatch(MixerState.setVolume(id, "bed"))}>
          Bed
        </button>
        <button onClick={() => dispatch(MixerState.setVolume(id, "full"))}>
          Full
        </button>
      </div>
    </div>
  );
}
