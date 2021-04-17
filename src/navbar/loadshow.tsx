import React, { useState, useEffect } from "react";
import { getTimeslots, Timeslot } from "../api";

import { FaCog, FaSearch, FaTimesCircle } from "react-icons/fa";
import { sendBAPSicleChannel } from "../bapsicle";

//import "./libraries.scss";

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
    <div className="">
      <div className="border-top mt-2"></div>
      <ResultsPlaceholder state={state} />
      <div className="timeslot-item-list">
        <ul>
          {items.map((item, index) => (
            <li
              key={index}
              onClick={() => {
                sendBAPSicleChannel({
                  command: "GET_PLAN",
                  timeslotId: item.timeslot_id,
                });
              }}
            >
              {item.start_time} - {item.title}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
// <Item key={itemId(item)} item={item} index={index} column={-1} />
export function ResultsPlaceholder({ state }: { state: string }) {
  return (
    <span
      className={state !== "results" ? "mt-5 text-center text-muted" : "d-none"}
    >
      {state === "not-searching" && <FaSearch size={56} />}
      {state === "searching" && <FaCog size={56} className="fa-spin" />}
      {state === "no-results" && <FaTimesCircle size={56} />}
      <br />
      {state === "not-searching"
        ? "Enter a search term."
        : state === "searching"
        ? "Searching..."
        : state === "no-results"
        ? "No results."
        : "An error has occurred while getting shows."}
    </span>
  );
}
