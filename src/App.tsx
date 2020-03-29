import React, { useReducer, useState, Suspense, useEffect, } from "react";
import { useSelector, useDispatch } from "react-redux";
import qs from "qs";
import "./App.css";
import Showplanner from "./showplanner";
import SessionHandler from "./session";
import { RootState } from "./rootReducer";


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
      if (key === 'Enter'){
        cont()
      }
  }

  const q = qs.parse(window.location.search, { ignoreQueryPrefix: true });

  const {
    currentUser,
    userLoading,
    currentTimeslot,
    timeslotLoading
  } = useSelector((state: RootState) => state.session);

  if (currentUser == null || userLoading || currentTimeslot == null || timeslotLoading) {
    return (
    <Suspense fallback={<div>Loading...</div>}>
      <SessionHandler />
    </Suspense>
    );
  } else {
    var timeslotid = null;
    if ("timeslot_id" in q) {
      timeslotid = q.timeslot_id;
    } else if (currentTimeslot.timeslotid != null) {
      timeslotid = currentTimeslot.timeslotid;
    }
    if (timeslotid !== null) {
      return (
        <Suspense fallback={<div>Loading...</div>}>
          <Showplanner timeslotId={timeslotid} />
        </Suspense>
      );
    } else {
      return (
        <div style={{marginLeft:"1.5%"}}>
          <h1>Welcome to Web Studio</h1>
          <input
            type="text"
            placeholder="enter a timeslot id"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyPress={e=>enterKeyCont(e.key)}
            autoFocus
          />
          <button onClick={cont}>Continue</button>
        </div>
      );
    }
  }
};

export default App;
