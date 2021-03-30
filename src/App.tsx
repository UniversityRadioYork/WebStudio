import React from "react";
import { useSelector } from "react-redux";
import "./App.css";
import Showplanner from "./showplanner";

//import SessionHandler from "./session";
import SessionHandler from "./bapiclesession";

import { RootState } from "./rootReducer";
import "./light-theme.scss";
import "./App.scss";

const App: React.FC = () => {
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
