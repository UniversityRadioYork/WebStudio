import React, { useReducer, useState } from "react";
import { useSelector } from "react-redux";
import qs from "qs";
import "./App.css";
import Showplanner from "./showplanner";

//import SessionHandler from "./session";
import SessionHandler from "./bapiclesession";

import { RootState } from "./rootReducer";
import "./light-theme.scss";
import "./App.scss";

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

  /*const {
    currentUser,
    userLoading,
    currentTimeslot,
    timeslotLoading,
  } = useSelector((state: RootState) => state.session); */
  const connectionState = useSelector(
    (state: RootState) => state.session.connectionState
  );

  if (connectionState !== "CONNECTED") {
    return <SessionHandler />;
  } else {
    return <Showplanner />;
  }
};

export default App;
