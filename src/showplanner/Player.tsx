import React, { useEffect, useRef, useState } from "react";
import { useSelector, useDispatch, shallowEqual, useStore } from "react-redux";
import {
  FaLevelDownAlt,
  FaPlayCircle,
  FaRedo,
  FaPlay,
  FaPause,
  FaStop,
  FaTrash,
} from "react-icons/fa";
import { omit } from "lodash";
import { RootState } from "../rootReducer";
import * as MixerState from "../mixer/state";
import * as ShowPlanState from "../showplanner/state";
import { HHMMTosec, secToHHMM, timestampToHHMM } from "../lib/utils";
import ProModeButtons from "./ProModeButtons";
import { VUMeter } from "../optionsMenu/helpers/VUMeter";
import * as BroadcastState from "../broadcast/state";
import * as api from "../api";
import { AppThunk } from "../store";
import {
  INTERNAL_OUTPUT_ID,
  LevelsSource,
  PLAYER_COUNT,
  PLAYER_ID_PREVIEW,
} from "../mixer/audio";
import { useBeforeunload } from "react-beforeunload";
import { selPlayedTrackAggregates } from "../showplanner/state";
import "./player.scss";

export const USE_REAL_GAIN_VALUE = false;

export const PLAYER_COUNTER_UPDATE_PERIOD_MS = 200;

const ONE_HOUR_MS = 1000 * 60 * 60;

function PlayerNumbers({ id, pfl }: { id: number; pfl: boolean }) {
  const store = useStore<RootState, any>();
  const [
    [timeCurrent, timeLength, timeRemaining, endTime],
    setTimings,
  ] = useState([0, 0, 0, 0]);
  const tickerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    tickerRef.current = window.setInterval(() => {
      const now = new Date();
      const state = store.getState().mixer.players[id];
      setTimings([
        state.timeCurrent,
        state.timeLength,
        state.timeRemaining,
        now.valueOf() / 1000 + state.timeRemaining,
      ]);
    }, PLAYER_COUNTER_UPDATE_PERIOD_MS);
    return () => window.clearInterval(tickerRef.current);
  });

  return (
    <>
      <span id={"current-" + id} className="current bypass-click">
        {secToHHMM(timeCurrent)}
      </span>
      <span id={"length-" + id} className="length bypass-click">
        {secToHHMM(timeLength)}
      </span>
      <span id={"remaining-" + id} className="remaining bypass-click">
        {secToHHMM(timeRemaining)}
      </span>
      {!pfl && (
        <span id={"ends-" + id} className="outro bypass-click">
          End - {timestampToHHMM(endTime)}
        </span>
      )}
    </>
  );
}

const setTrackIntro = (
  track: api.Track,
  secs: number,
  player: number
): AppThunk => async (dispatch, getState) => {
  try {
    // Api only deals with whole seconds.
    secs = Math.round(secs);
    dispatch(MixerState.setLoadedItemIntro(player, secs));
    if (getState().settings.saveShowPlanChanges) {
      await api.setTrackIntro(track.trackid, secs);
    }
    dispatch(ShowPlanState.setItemTimings({ item: track, intro: secs }));
  } catch (e) {
    dispatch(ShowPlanState.planSaveError("Failed saving track intro."));
    console.error("Failed to set track intro: " + e);
  }
};

const setTrackOutro = (
  track: api.Track,
  secs: number,
  player: number
): AppThunk => async (dispatch, getState) => {
  try {
    // Api only deals with whole seconds.
    secs = Math.round(secs);
    dispatch(MixerState.setLoadedItemOutro(player, secs));
    if (getState().settings.saveShowPlanChanges) {
      await api.setTrackOutro(track.trackid, secs);
    }
    dispatch(ShowPlanState.setItemTimings({ item: track, outro: secs }));
  } catch (e) {
    dispatch(ShowPlanState.planSaveError("Failed saving track outro."));
    console.error("Failed to set track outro: " + e);
  }
};

const setTrackCue = (
  item: api.TimeslotItem,
  secs: number,
  player: number
): AppThunk => async (dispatch, getState) => {
  try {
    // Api only deals with whole seconds.
    secs = Math.round(secs);
    dispatch(MixerState.setLoadedItemCue(player, secs));
    if (getState().settings.saveShowPlanChanges) {
      await api.setTimeslotItemCue(item.timeslotitemid, secs);
    }
    dispatch(ShowPlanState.setItemTimings({ item, cue: secs }));
  } catch (e) {
    dispatch(ShowPlanState.planSaveError("Failed saving track cue."));
    console.error("Failed to set track cue: " + e);
  }
};

function TimingButtons({ id }: { id: number }) {
  const dispatch = useDispatch();
  const state = useSelector((state: RootState) => state.mixer.players[id]);
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);

  return (
    <div
      className={
        "timing-buttons " +
        (state.loadedItem && state.loadedItem.type !== "central"
          ? "not-central"
          : "") +
        (showDeleteMenu ? " bg-dark text-light" : "")
      }
    >
      <div className="label">{showDeleteMenu ? "Delete:" : "Set"} Marker:</div>
      <div
        className="intro btn btn-sm btn-outline-secondary rounded-0"
        onClick={() => {
          if (state.loadedItem?.type === "central") {
            dispatch(
              setTrackIntro(
                state.loadedItem,
                showDeleteMenu ? 0 : state.timeCurrent,
                id
              )
            );
          }
        }}
      >
        Intro
      </div>
      <div
        className="cue btn btn-sm btn-outline-secondary rounded-0"
        onClick={() => {
          if (state.loadedItem && "timeslotitemid" in state.loadedItem) {
            dispatch(
              setTrackCue(
                state.loadedItem,
                showDeleteMenu ? 0 : state.timeCurrent,
                id
              )
            );
          }
        }}
      >
        Cue
      </div>
      <div
        className="outro btn btn-sm btn-outline-secondary rounded-0"
        onClick={() => {
          if (state.loadedItem?.type === "central") {
            dispatch(
              setTrackOutro(
                state.loadedItem,
                showDeleteMenu ? 0 : state.timeCurrent,
                id
              )
            );
          }
        }}
      >
        Outro
      </div>
      <div
        className={
          "delete btn btn-sm btn-outline-secondary rounded-0" +
          (showDeleteMenu ? " active" : "")
        }
        onClick={() => {
          setShowDeleteMenu(!showDeleteMenu);
        }}
      >
        <FaTrash />
      </div>
    </div>
  );
}

function LoadedTrackInfo({ id }: { id: number }) {
  const loadedItem = useSelector(
    (state: RootState) => state.mixer.players[id].loadedItem
  );
  const loading = useSelector(
    (state: RootState) => state.mixer.players[id].loading
  );
  const loadError = useSelector(
    (state: RootState) => state.mixer.players[id].loadError
  );

  const partyMode = useSelector((state: RootState) => state.settings.partyMode);
  const showName =
    !partyMode ||
    loadedItem === null ||
    !ShowPlanState.isTrack(loadedItem) ||
    ("playedAt" in loadedItem && loadedItem.playedAt);

  // TODO: this is a duplicate of the logic in Item.tsx
  // if this becomes more complicated, we should refactor this
  const {
    artists: playedArtists,
    recordIds: playedRecordids,
    trackIds: playedTracks,
  } = useSelector(selPlayedTrackAggregates)!;
  const now = new Date().valueOf();
  let alreadyPlayedTrack = false,
    alreadyPlayedArtist = false,
    alreadyPlayedAlbum = false;
  if (loadedItem !== null && ShowPlanState.isTrack(loadedItem)) {
    if (now - (playedTracks.get(loadedItem.trackid) || 0) < ONE_HOUR_MS) {
      alreadyPlayedTrack = true;
    }
    if (now - (playedArtists.get(loadedItem.artist) || 0) < ONE_HOUR_MS) {
      alreadyPlayedArtist = true;
    }
    if (
      now - (playedRecordids.get(loadedItem.album.recordid) || 0) <
      ONE_HOUR_MS
    ) {
      alreadyPlayedAlbum = true;
    }
  }
  const alreadyPlayedClass = alreadyPlayedTrack
    ? "warn-red"
    : alreadyPlayedArtist || alreadyPlayedAlbum
    ? "warn-orange"
    : "";

  return (
    <span className={"card-title " + alreadyPlayedClass}>
      <strong>
        {loadedItem !== null && loading === -1
          ? showName
            ? loadedItem.title
            : ""
          : loading !== -1
          ? `LOADING`
          : loadError
          ? "LOAD FAILED"
          : "No Media Selected"}
      </strong>
      <small
        className={
          "border rounded border-danger text-danger p-1 m-1" +
          (loadedItem !== null &&
          loading === -1 &&
          "clean" in loadedItem &&
          !loadedItem.clean
            ? ""
            : " d-none")
        }
      >
        Explicit
      </small>
    </span>
  );
}

export function Player({
  id,
  isPreviewChannel,
}: {
  id: number;
  isPreviewChannel: boolean;
}) {
  // Define time remaining (secs) when the play icon should flash.
  const SECS_REMAINING_WARNING = 20;

  // We want to force update the selector when we pass the SECS_REMAINING_WARNING barrier.
  const playerState = useSelector(
    (state: RootState) => state.mixer.players[id],
    (a, b) =>
      !(
        a.timeRemaining <= SECS_REMAINING_WARNING &&
        b.timeRemaining > SECS_REMAINING_WARNING
      ) &&
      shallowEqual(
        omit(a, "timeCurrent", "timeRemaining"),
        omit(b, "timeCurrent", "timeRemaining")
      )
  );

  const partyMode = useSelector((state: RootState) => state.settings.partyMode);

  useBeforeunload((event) => {
    console.log("Checking player " + id + " for un-ended tracklists.");
    const tracklistItemID = playerState.tracklistItemID;
    if (tracklistItemID !== -1) {
      dispatch(BroadcastState.tracklistEnd(tracklistItemID));
    }
  });

  const settings = useSelector((state: RootState) => state.settings);
  const customOutput = settings.channelOutputIds[id] !== INTERNAL_OUTPUT_ID;
  const dispatch = useDispatch();

  const VUsource = (id: number) => {
    if (id < PLAYER_COUNT) {
      return ("player-" + id) as LevelsSource;
    }
    throw new Error("Unknown Player VUMeter source: " + id);
  };

  let channelDuration = 0;
  let channelUnplayed = 0;
  const plan = useSelector((state: RootState) => state.showplan.plan);
  plan?.forEach((pItem) => {
    if (pItem.channel === id) {
      channelDuration += HHMMTosec(pItem.length);
      if (!pItem.playedAt) {
        channelUnplayed += HHMMTosec(pItem.length);
      }
    }
  });

  return (
    <div
      className={
        playerState.loadedItem !== null && playerState.loading === -1
          ? "player loaded"
          : "player"
      }
    >
      <div className="card text-center">
        {!isPreviewChannel && (
          <>
            <div className="d-inline mx-1">
              <span className="float-left">
                Total: {secToHHMM(channelDuration)}
              </span>
              <span className="float-right">
                Unplayed: {secToHHMM(channelUnplayed)}
              </span>
            </div>

            <div className="row m-0 p-1 card-header channelButtons hover-menu">
              <span className="hover-label">Channel Controls</span>
              <button
                className={
                  (playerState.autoAdvance
                    ? "btn-primary"
                    : "btn-outline-secondary") +
                  " btn btn-sm col-4 sp-play-on-load"
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
                    : "btn-outline-secondary") +
                  " btn btn-sm col-4 sp-play-on-load"
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
                    : "btn-outline-secondary") +
                  " btn btn-sm col-4 sp-play-on-load"
                }
                onClick={() =>
                  dispatch(MixerState.toggleRepeat({ player: id }))
                }
              >
                <FaRedo />
                &nbsp; Repeat {playerState.repeat}
              </button>
            </div>
          </>
        )}
        {!isPreviewChannel && settings.proMode && !customOutput && (
          <ProModeButtons channel={id} />
        )}
        <div className="card-body p-0">
          {!isPreviewChannel && (
            <>
              <LoadedTrackInfo id={id} />
              <br />
              <span className="text-muted">
                {playerState.loadedItem !== null && playerState.loading === -1
                  ? "artist" in playerState.loadedItem &&
                    !partyMode &&
                    playerState.loadedItem.artist
                  : ""}
                &nbsp;
              </span>
            </>
          )}
          <div className="mediaButtons">
            <button
              onClick={() => dispatch(MixerState.play(id))}
              className={
                playerState.state === "playing"
                  ? playerState.timeRemaining <= SECS_REMAINING_WARNING
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

        <div className="p-0 card-footer">
          {!isPreviewChannel && <TimingButtons id={id} />}
          <div className="waveform">
            <PlayerNumbers id={id} pfl={isPreviewChannel} />
            {!isPreviewChannel &&
              playerState.loadedItem !== null &&
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
      </div>
      {!isPreviewChannel && !customOutput && (
        <div
          className={
            "mixer-buttons " +
            (playerState.state === "playing"
              ? playerState.volume === 0 && !playerState.pfl
                ? "error-animation"
                : playerState.pfl && "pfl"
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
      )}
      {!isPreviewChannel && settings.proMode && settings.channelVUs && (
        <div className="channel-vu">
          {customOutput ? (
            <span className="text-muted">
              Custom audio output disables VU meters.
            </span>
          ) : playerState.pfl ? (
            <span className="text-muted">This Player is playing in PFL.</span>
          ) : (
            <VUMeter
              width={300}
              height={40}
              source={VUsource(id)}
              range={[-40, 0]}
              stereo={settings.channelVUsStereo}
            />
          )}
        </div>
      )}
    </div>
  );
}

export function PflPlayer() {
  return (
    <div id="pfl-player" className="hover-menu">
      <span className="mx-1 hover-label always-show">
        Preview Player (Headphones Only)
      </span>
      <Player id={PLAYER_ID_PREVIEW} isPreviewChannel={true} />
    </div>
  );
}
