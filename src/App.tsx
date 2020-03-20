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

  function enterKeyCont(key: string) {
      if (key == 'Enter'){
        cont()
      }
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
      <div style={{marginLeft:"1.5%"}}>
        <h1>Welcome to BAPS3</h1>
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
};

export default App;
