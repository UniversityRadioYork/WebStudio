import React, { useRef, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Clock from "react-live-clock";

import { FaCompactDisc } from "react-icons/fa";

import { RootState } from "../rootReducer";

import logo from "../assets/images/navbarlogo.png";
import "./navbar.scss";
import { closeAlert } from "./state";
import { BAPSicleModal } from "./BAPSicleModal";

export function NavBarMain() {
  const [showBAPSicleModal, setShowBAPSicleModal] = useState(false);

  return (
    <>
      <ul className="nav navbar-nav navbar-left">
        <li
          className="btn rounded-0 py-1 nav-link nav-item"
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
          <img src={logo} className="mr-2" height={32} alt="Logo" />
          <Clock
            format={"HH:mm:ss"}
            ticking={true}
            timezone={"europe/london"}
          />
        </li>
      </ul>

      <div>
        <ul className="nav navbar-nav navbar-right mr-0 pr-0">
          <li
            className="btn btn-outline-light rounded-0 pt-2 pb-2 nav-item nav-link"
            style={{ color: "white" }}
            onClick={() => {
              setShowBAPSicleModal(true);
            }}
          >
            <FaCompactDisc size={16} className="mr-2" />
            <b>Load Show</b>
          </li>
        </ul>
      </div>
      <BAPSicleModal
        close={() => setShowBAPSicleModal(false)}
        isOpen={showBAPSicleModal}
      />
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
