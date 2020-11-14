import React, { useRef, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Clock from "react-live-clock";

import {
  FaCircle,
  FaRegClock,
  FaRegUser,
  FaBroadcastTower,
  FaSpinner,
  FaExclamationTriangle,
  FaCog,
} from "react-icons/fa";

import { RootState } from "../rootReducer";

import "./navbar.scss";
import { closeAlert } from "./state";
import { getShowplan, setItemPlayed } from "../showplanner/state";
import { BAPSicleConnection } from "../bapsicle";
import { BAPSicleModal } from "./BAPSicleModal";

export function NavBarMain() {
  const dispatch = useDispatch();

  const [connectButtonAnimating, setConnectButtonAnimating] = useState(false);
  const [showBAPSicleModal, setShowBAPSicleModal] = useState(false);

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

      <div>
        <BAPSicleModal
          close={() => setShowBAPSicleModal(false)}
          isOpen={showBAPSicleModal}
        />
        <ul className="nav navbar-nav navbar-right mr-0 pr-0">
          <li className="nav-item" style={{ color: "white" }}>
            <div
              className="nav-link"
              onContextMenu={() => {
                setShowBAPSicleModal(true);
              }}
            >
              <b>{BAPSicleConnection}</b>
            </div>
          </li>
        </ul>
      </div>
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
      <header className="navbar navbar-main navbar-expand-sm p-0 bd-navbar">
        <nav className="container-fluid px-0">
          <NavBarMain />
        </nav>
      </header>
    </>
  );
}
