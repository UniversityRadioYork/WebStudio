import React, { useReducer, useState, Suspense } from "react";
import qs from "qs";
import "./App.css";
import Showplanner from "./showplanner";

const forceReducer = (state: boolean) => !state;
function useForceUpdate() {
  const [_, action] = useReducer(forceReducer, false);
  return () => action(null);
}

const App: React.FC = () => {
  const [inputVal, setInputVal] = useState("");
  const force = useForceUpdate();

  function cont() {
    window.location.search = `?timeslot_id=${inputVal}`;
    force();
  }

  const q = qs.parse(window.location.search, { ignoreQueryPrefix: true });
  if ("timeslot_id" in q) {
    return (
      <Suspense fallback={<div>Loading...</div>}>
        <Showplanner timeslotId={q.timeslot_id} />
      </Suspense>
    );
  } else {
    return (
      <div>
        <h1>Welcome to showplanner2</h1>
        <input
          type="text"
          placeholder="enter a timeslot id"
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
        />
        <button onClick={cont}>Continue</button>
      </div>
    );
  }
};

export default App;
