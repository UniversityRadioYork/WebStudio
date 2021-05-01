import React, { useState, useEffect } from "react";
import { getTimeslots, Timeslot } from "../api";

import {
  FaCog,
  FaDownload,
  FaSearch,
  FaTimesCircle,
  FaTrashAlt,
} from "react-icons/fa";
import { sendBAPSicleChannel } from "../bapsicle";

type searchingStateEnum = "searching" | "results" | "no-results" | "error";

export function LoadShowDialogue(close: any) {
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
      <ResultsPlaceholder state={state} />
      {state !== "searching" && (
        <div
          className="btn btn-outline-danger outline float-right"
          onClick={() => {
            sendBAPSicleChannel({
              command: "CLEAR",
            });
          }}
        >
          <FaTrashAlt size={16} /> Clear All Channels
        </div>
      )}
      <h2>Load Show</h2>
      <div className="loadshow-list">
        {items.map((item, index) => (
          <div className="loadshow-result card text-dark" key={index}>
            <div className="card-body">
              <span
                className="btn btn-outline-primary float-right"
                onClick={() => {
                  sendBAPSicleChannel({
                    command: "GET_PLAN",
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
