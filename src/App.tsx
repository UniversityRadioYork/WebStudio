import React, { useReducer, useState } from "react";
import { useSelector } from "react-redux";
import qs from "qs";
import "./App.css";
import Showplanner from "./showplanner";
import SessionHandler from "./session";
import { RootState } from "./rootReducer";
import './light-theme.scss';
import './App.scss';

const forceReducer = (state: boolean) => !state;
function useForceUpdate() {
  const [, action] = useReducer(forceReducer, false);
  return () => action(null);
}

const App: React.FC = () => {
  const [inputVal, setInputVal] = useState("");
  const force = useForceUpdate();

  function cont() {
    window.location.search = `?timeslot_id=${inputVal}`;
    force();
  }

  function enterKeyCont(key: string) {
    if (key === "Enter") {
      cont();
    }
  }

  const q = qs.parse(window.location.search, { ignoreQueryPrefix: true });

  const {
    currentUser,
    userLoading,
    currentTimeslot,
    timeslotLoading,
  } = useSelector((state: RootState) => state.session);

  if (
    currentUser == null ||
    userLoading ||
    currentTimeslot == null ||
    timeslotLoading
  ) {
    return <SessionHandler />;
  } else {
    var timeslotid = null;
    if ("timeslot_id" in q) {
      timeslotid = q.timeslot_id;
    } else if (currentTimeslot.timeslot_id != null) {
      timeslotid = currentTimeslot.timeslot_id;
    }
    if (timeslotid !== null) {
      return <Showplanner timeslotId={timeslotid} />;
    } else {
      return (
        <div style={{ marginLeft: "1.5%" }}>
          <h1>Welcome to WebStudio</h1>
          <input
            type="text"
            placeholder="enter a timeslot id"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyPress={(e) => enterKeyCont(e.key)}
            autoFocus
          />
          <button onClick={cont}>Continue</button>
        </div>
      );
    }
  }
};

export default App;
