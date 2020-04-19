import React, { useRef, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import Clock from "react-live-clock";

import { FaClock, FaUser } from "react-icons/fa";

import { RootState } from "../rootReducer";

import * as BroadcastState from "../broadcast/state";
import appLogo from "../assets/images/webstudio.svg";
import { MYRADIO_NON_API_BASE } from "../api";
import "./navbar.scss";
import { closeAlert } from "./state";
import { ConnectionStateEnum } from "../broadcast/streamer";

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

export function NavBar() {
  const dispatch = useDispatch();
  const sessionState = useSelector((state: RootState) => state.session);
  const broadcastState = useSelector((state: RootState) => state.broadcast);
  const settings = useSelector((state: RootState) => state.settings);
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
        <a className="navbar-brand" href="/">
          <img src={appLogo} height="28" alt="Web Studio Logo" />
        </a>
        <div className="nav-item nav-link" id="timelord">
          <div className="time">
            <Clock
              format={"HH:mm:ss"}
              ticking={true}
              timezone={"europe/london"}
            />
          </div>
        </div>
      </div>

      <ul className="nav navbar-nav navbar-right">
        <li className="nav-item" style={{ color: "white" }}>
          <div className="nav-link">
            <b>{nicifyConnectionState(broadcastState.connectionState)}</b>
          </div>
        </li>
        <li className="nav-item nav-link">
          <button
            onClick={() => {
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
            {broadcastState.stage === "NOT_REGISTERED" && "Register for show"}
            {broadcastState.stage === "REGISTERED" && "Cancel registration"}
          </button>
        </li>
        {settings.enableRecording && (
          <li className="nav-item nav-link">
            <button
              className=""
              onClick={() =>
                dispatch(
                  broadcastState.recordingState === "NOT_CONNECTED"
                    ? BroadcastState.startRecording()
                    : BroadcastState.stopRecording()
                )
              }
            >
              R: {broadcastState.recordingState}
            </button>
          </li>
        )}
        <li className="nav-item dropdown">
          <a
            className="nav-link dropdown-toggle"
            href={
              MYRADIO_NON_API_BASE + "/MyRadio/timeslot/?next=" + redirect_url
            }
            id="timeslotDropdown"
            data-toggle="dropdown"
            aria-haspopup="true"
            aria-expanded="false"
          >
            <FaClock />
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
            <h6 className="dropdown-header">
              {sessionState.currentTimeslot?.title}
            </h6>
            <h6 className="dropdown-header">
              ID: {sessionState.currentTimeslot?.timeslot_id}
            </h6>
          </div>
        </li>
        <li className="nav-item dropdown">
          <a
            className="nav-link dropdown-toggle"
            href={MYRADIO_NON_API_BASE + "/Profile/default/"}
            id="dropdown07"
            data-toggle="dropdown"
            aria-haspopup="true"
            aria-expanded="false"
          >
            <FaUser />
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
  // TODO
  return (
    <>
      <AlertBar />
      <header className="navbar navbar-ury navbar-expand-md p-0 bd-navbar">
        <nav className="container-fluid">
          <button
            className="navbar-toggler"
            type="button"
            data-toggle="collapse"
            data-target="#collapsed"
            aria-controls="collapsed"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon"></span>
          </button>
          <NavBar />
        </nav>
      </header>
    </>
  );
}
