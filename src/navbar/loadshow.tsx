import React, { useState, useEffect } from "react";
import { getTimeslots, Timeslot } from "../api";

import {
  FaCircleNotch,
  FaCog,
  FaDownload,
  FaKeyboard,
  FaSearch,
  FaTimesCircle,
  FaTrashAlt,
} from "react-icons/fa";
import { sendBAPSicleChannel } from "../bapsicle";

type searchingStateEnum = "searching" | "results" | "no-results" | "error";

export function LoadShowDialogue({ close }: { close: () => any }) {
  const [items, setItems] = useState<Timeslot[]>([]);

  const [state, setState] = useState<searchingStateEnum>("searching");

  useEffect(() => {
    getTimeslots().then((timeslots) => {
      if (!timeslots) {
        setState("error");
        return;
      }
      if (timeslots.length === 0) {
        setState("no-results");
        setItems([]);
        return;
      }
      console.log(state);
      console.log(timeslots);
      setItems(timeslots);
      setState("results");
    });
  }, [state]);
  return (
    <>
      <div
        className="btn btn-outline-danger outline float-right"
        onClick={() => {
          sendBAPSicleChannel({
            command: "CLEAR",
          });
          close();
        }}
      >
        <FaTrashAlt size={15} /> Clear All Channels
      </div>
      <div
        className="btn btn-outline-dark outline float-right mr-1"
        onClick={() => {
          sendBAPSicleChannel({
            command: "RESETPLAYED",
            weight: -1,
          });
        }}
      >
        <FaCircleNotch size={15} /> Mark All Unplayed
      </div>
      <div
        className="btn btn-outline-dark outline float-right mr-1"
        onClick={() => {
          sendBAPSicleChannel({
            command: "GETPLAN",
            timeslotId: window.prompt("Enter timeslot ID"),
          });
        }}
      >
        <FaKeyboard size={15} /> Enter Show ID
      </div>

      <h2>Load Show</h2>
      <ResultsPlaceholder state={state} />

      <div className="loadshow-list">
        {items.map((item, index) => (
          <div className="loadshow-result card text-dark" key={index}>
            <div className="card-body">
              <span
                className="btn btn-outline-primary float-right"
                onClick={() => {
                  sendBAPSicleChannel({
                    command: "GETPLAN",
                    timeslotId: item.timeslot_id,
                  });
                }}
              >
                <FaDownload size={15} /> Load Show Plan
              </span>

              <h5 className="card-title">{item.title}</h5>
              <h6 className="card-subtitle mb-2 text-muted">
                {item.start_time} - Duration: {item.duration}
              </h6>
              <p className="card-text">
                <i>with {item.credits_string}</i>
              </p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
// <Item key={itemId(item)} item={item} index={index} column={-1} />
export function ResultsPlaceholder({ state }: { state: string }) {
  return (
    <div
      className={
        "loading " + (state !== "results" ? "text-center text-muted" : "d-none")
      }
    >
      {state === "not-searching" && <FaSearch size={56} />}
      {state === "searching" && <FaCog size={56} className="fa-spin" />}
      {state === "no-results" && <FaTimesCircle size={56} />}
      <br />
      <span className="ml-3">
        {state === "not-searching"
          ? ""
          : state === "searching"
          ? "Searching..."
          : state === "no-results"
          ? "No results."
          : "An error has occurred while getting shows."}
      </span>
    </div>
  );
}
