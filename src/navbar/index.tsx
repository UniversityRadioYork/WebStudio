import React, { useRef, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Clock from "react-live-clock";
import Stopwatch from "react-stopwatch";

import {
  FaCircle,
  FaRegClock,
  FaRegUser,
  FaBroadcastTower,
  FaSpinner,
  FaExclamationTriangle,
  FaCog,
  FaHeadphonesAlt,
} from "react-icons/fa";

import { RootState } from "../rootReducer";

import * as BroadcastState from "../broadcast/state";
import appLogo from "../assets/images/webstudio.svg";
import myradioLogo from "../assets/images/myradio.svg";
import { MYRADIO_NON_API_BASE } from "../api";
import "./navbar.scss";
import { closeAlert } from "./state";
import { ConnectionStateEnum } from "../broadcast/streamer";
import { VUMeter } from "../optionsMenu/helpers/VUMeter";
import { getShowplan, setItemPlayed } from "../showplanner/state";

import * as OptionsMenuState from "../optionsMenu/state";
import { setChannelPFL } from "../mixer/state";

function nicifyConnectionState(state: ConnectionStateEnum): string {
  switch (state) {
    case "CONNECTED":
      return "Connected!";
    case "CONNECTING":
      return "Connecting to server...";
    case "CONNECTION_LOST":
      return "Connection lost!";
    case "CONNECTION_LOST_RECONNECTING":
      return "Connection lost. Reconnecting...";
    case "NOT_CONNECTED":
      return "Not Connected";
    case "LIVE":
      return "Live!";
    default:
      console.warn("unhandled", state);
      return state as string;
  }
}

export function NavBarMyRadio() {
  const dispatch = useDispatch();
  const sessionState = useSelector((state: RootState) => state.session);
  const redirect_url = encodeURIComponent(window.location.toString());

  return (
    <>
      <div className="navbar-nav navbar-left">
        <a className="navbar-brand" href="/">
          <img
            src="//ury.org.uk/myradio/img/URY.svg"
            height="30"
            alt="University Radio York Logo"
          />
        </a>
        <span className="navbar-brand divider"></span>
        <a
          className="navbar-brand logo-hover"
          href={MYRADIO_NON_API_BASE}
          title="Back to MyRadio"
        >
          <img className="logo-webstudio" src={appLogo} alt="Web Studio Logo" />
          <img className="logo-myradio" src={myradioLogo} alt="MyRadio Logo" />
        </a>
      </div>

      <ul className="nav navbar-nav navbar-right">
        <li className="nav-item dropdown">
          <a
            className="nav-link dropdown-toggle"
            href={
              MYRADIO_NON_API_BASE + "/MyRadio/timeslot/?next=" + redirect_url
            }
            id="timeslotDropdown"
            data-toggle="dropdown"
            aria-expanded="false"
          >
            <FaRegClock />
            &nbsp;
            {sessionState.currentTimeslot &&
              sessionState.currentTimeslot.start_time}
          </a>
          <div className="dropdown-menu" aria-labelledby="timeslotDropdown">
            <a
              className="dropdown-item"
              href={
                MYRADIO_NON_API_BASE + "/MyRadio/timeslot/?next=" + redirect_url
              }
            >
              Switch Timeslot
            </a>
            <button
              className="dropdown-item"
              onClick={() =>
                sessionState.currentTimeslot !== null &&
                dispatch(getShowplan(sessionState.currentTimeslot.timeslot_id))
              }
            >
              Reload Show Plan
            </button>
            <button
              className="dropdown-item"
              onClick={() =>
                sessionState.currentTimeslot !== null &&
                dispatch(setItemPlayed({ itemId: "all", played: false }))
              }
            >
              Mark All Items Unplayed
            </button>
            <h6 className="dropdown-header">
              {sessionState.currentTimeslot?.title}
            </h6>
            <h6 className="dropdown-header">
              ID: {sessionState.currentTimeslot?.timeslot_id}
            </h6>
          </div>
        </li>
        <li className="nav-item navbar-profile dropdown">
          <a
            className="nav-link dropdown-toggle"
            href={MYRADIO_NON_API_BASE + "/Profile/default/"}
            id="dropdown07"
            data-toggle="dropdown"
            aria-expanded="false"
          >
            <FaRegUser />
            &nbsp;
            {sessionState.currentUser?.fname} {sessionState.currentUser?.sname}
          </a>
          <div className="dropdown-menu" aria-labelledby="dropdown07">
            <a
              className="dropdown-item"
              target="_blank"
              rel="noopener noreferrer"
              href={MYRADIO_NON_API_BASE + "/Profile/default/"}
            >
              My Profile
            </a>
            <a
              className="dropdown-item"
              href={MYRADIO_NON_API_BASE + "/MyRadio/logout/"}
            >
              Logout
            </a>
          </div>
        </li>
      </ul>
    </>
  );
}

export function NavBarMain() {
  const dispatch = useDispatch();
  const broadcastState = useSelector((state: RootState) => state.broadcast);
  const settings = useSelector((state: RootState) => state.settings);
  const playerState = useSelector((state: RootState) => state.mixer.players);

  let playerPFLs: boolean[] = [];
  playerState.forEach((player) => {
    playerPFLs.push(player.pfl);
  });
  const isPFL = useSelector((state) => playerPFLs).some((x) => x === true);

  const [connectButtonAnimating, setConnectButtonAnimating] = useState(false);

  const prevRegistrationStage = useRef(broadcastState.stage);
  useEffect(() => {
    if (broadcastState.stage !== prevRegistrationStage.current) {
      setConnectButtonAnimating(false);
    }
    prevRegistrationStage.current = broadcastState.stage;
  }, [broadcastState.stage]);

  const { planSaveError, planSaving } = useSelector(
    (state: RootState) => state.showplan
  );

  return (
    <>
      <ul className="nav navbar-nav navbar-left">
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
          <Clock
            format={"HH:mm:ss"}
            ticking={true}
            timezone={"europe/london"}
          />
        </li>
        {planSaving && (
          <li className="btn rounded-0 py-2 nav-item alert-info">
            <FaSpinner className="nav-spin mb-1" /> Saving show plan...
          </li>
        )}
        {planSaveError && (
          <li className="btn rounded-0 py-2 nav-item alert-danger">
            <FaExclamationTriangle className="p-0 mr-1" />
            {planSaveError}
          </li>
        )}
      </ul>

      <ul className="nav navbar-nav navbar-right mr-0 pr-0">
        <li className="nav-item" style={{ color: "white" }}>
          <div className="nav-link">
            <b>{nicifyConnectionState(broadcastState.connectionState)}</b>
          </div>
        </li>
        <li
          className="btn btn-outline-light rounded-0 pt-2 pb-1 nav-item nav-link connect"
          onClick={() => {
            setConnectButtonAnimating(true);
            switch (broadcastState.stage) {
              case "NOT_REGISTERED":
                dispatch(BroadcastState.goOnAir());
                break;
              case "REGISTERED":
                dispatch(BroadcastState.cancelTimeslot());
                break;
            }
          }}
        >
          {connectButtonAnimating ? (
            <>
              <FaBroadcastTower size={17} className="mr-2" />
              <FaSpinner size={17} className="nav-spin mr-2" />
            </>
          ) : (
            <>
              <FaBroadcastTower size={17} className="mr-2" />
              {broadcastState.stage === "NOT_REGISTERED" && "Register"}
              {broadcastState.stage === "REGISTERED" && "Stop"}
            </>
          )}
        </li>
        {settings.enableRecording && (
          <li
            className={
              "btn rounded-0 pt-2 pb-1 nav-item nav-link " +
              (broadcastState.recordingState === "CONNECTED"
                ? "btn-outline-danger active"
                : "btn-outline-light")
            }
            onClick={() =>
              dispatch(
                broadcastState.recordingState === "NOT_CONNECTED"
                  ? BroadcastState.startRecording()
                  : BroadcastState.stopRecording()
              )
            }
          >
            <FaCircle
              size={17}
              className={
                broadcastState.recordingState === "CONNECTED"
                  ? "rec-blink"
                  : "rec-stop"
              }
            />{" "}
            {broadcastState.recordingState === "CONNECTED" ? (
              <Stopwatch
                seconds={0}
                minutes={0}
                hours={0}
                render={({ formatted }) => {
                  return <span>{formatted}</span>;
                }}
              />
            ) : (
              "Record"
            )}
          </li>
        )}
        <li
          className="btn btn-outline-light rounded-0 pt-2 pb-1 nav-item nav-link"
          onClick={() => dispatch(OptionsMenuState.open())}
        >
          <FaCog size={17} /> Options
        </li>
        {settings.proMode && isPFL && (
          <li
            className="btn btn-danger rounded-0 pt-2 pb-1 nav-item nav-link clear-pfl"
            onClick={() => dispatch(setChannelPFL(-1, false))}
          >
            <FaHeadphonesAlt size={17} /> Clear PFL
          </li>
        )}

        <li className={"nav-item px-2 nav-vu" + (isPFL ? " pfl-live" : "")}>
          <VUMeter
            width={235}
            height={isPFL ? 34 : 40}
            source={isPFL ? "pfl" : "master"}
            range={[-40, 3]}
            stereo={true}
          />
        </li>
      </ul>
    </>
  );
}

function AlertBar() {
  const state = useSelector((state: RootState) => state.navbar.currentAlert);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dispatch = useDispatch();
  useEffect(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
    }
    if (typeof state?.closure === "number") {
      timeoutRef.current = setTimeout(() => {
        dispatch(closeAlert());
      }, state.closure);
    }
  }, [dispatch, state]);
  return (
    <div
      className={`alertbar alert alert-${state?.color} ${
        state !== null ? "visible" : ""
      }`}
    >
      {state?.content}
      {state?.closure !== null && (
        <button
          className="close"
          aria-label="Dismiss"
          onClick={() => dispatch(closeAlert())}
        >
          <span aria-hidden>&times;</span>
        </button>
      )}
    </div>
  );
}

export function CombinedNavAlertBar() {
  return (
    <>
      <AlertBar />
      <header className="navbar navbar-myradio navbar-expand-sm hover-menu p-0 bd-navbar">
        <span className="hover-label hover-label-hide text-light text-center">
          Hover for MyRadio Menu
        </span>
        <nav className="container-fluid px-0">
          <NavBarMyRadio />
        </nav>
      </header>
      <header className="navbar navbar-main navbar-expand-sm p-0 bd-navbar">
        <nav className="container-fluid px-0">
          <NavBarMain />
        </nav>
      </header>
    </>
  );
}
