import React from "react";
import * as SessionState from "./state";

import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../rootReducer";
import Showplanner from "../showplanner";

import serverLogo from "../assets/images/serverlogo.png";
import appLogo from "../assets/images/presenterlogo.png";

export function ConnectionDialogue({ error }: { error: String | null }) {
  return (
    <div className="loading-dialogue">
      <div className="logo-container">
        <img className="logo-big-bapsicle mb-2" src={appLogo} alt="BAPS Logo" />
      </div>

      <span className="inner">
        <h1>BAPS3</h1>
        <p>
          <strong>Broadcast And Presenting Suite</strong>
        </p>
        <hr />
        <span className="my-2 text-center">
          {error == null && <strong>Connecting...</strong>}
          {error != null && (
            <>
              <strong>Disconnected!</strong> <code>{error}</code>
            </>
          )}
        </span>
        <form className="my-3">
          <input className="btn btn-primary" type="submit" value="Reconnect" />
        </form>
      </span>
      <hr />
      <div className="logo-container">
        Powered by
        <br />
        <a href={"http://" + window.location.hostname + ":13500"}>
          <img className="logo mb-5" src={serverLogo} alt="BAPSicle" />
        </a>
      </div>
    </div>
  );
}
const SessionHandler: React.FC = function() {
  const dispatch = useDispatch();

  const { connectionState } = useSelector(
    (state: RootState) => state.bapsSession
  );

  switch (connectionState) {
    case "CONNECTED":
      return <Showplanner timeslotId={null} />;
    case "CONNECTING":
      return <ConnectionDialogue error={null} />;
    case "FAILED":
      return <ConnectionDialogue error={"Couldn't connect to server."} />;
    case "DISCONNECTED":
      dispatch(SessionState.getServer());
      return null;
  }
};

export default SessionHandler;
