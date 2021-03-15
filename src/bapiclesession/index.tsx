import React, { useEffect } from "react";
import * as SessionState from "./state";
import { MYRADIO_NON_API_BASE } from "../api";

import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../rootReducer";
import Showplanner, { LoadingDialogue } from "../showplanner";

import BAPSicleLogo from "../assets/images/bapsicle.png";
import appLogo from "../assets/images/bapsicle.png";

export function ConnectionDialogue({ error }: { error: String | null }) {
  return (
    <div className="loading-dialogue">
      <div className="logo-container">
        <img className="logo mb-5" src={appLogo} alt="BAPS Logo" />
      </div>

      <span className="inner">
        <h1>BAPS3</h1>
        <p>
          <strong>Broadcast &amp; Presenting Suite</strong>
        </p>
        <hr />
        {error !== null && (
          <>
            <span>
              <strong>Failed!</strong> <code>{error}</code>
            </span>
            <form>
              <div>
                <label htmlFor="hostname">Hostname: </label>
                <input
                  name="hostname"
                  type="text"
                  placeholder="localhost"
                ></input>
              </div>
              <div>
                <label htmlFor="port">Port: </label>
                <input name="port" type="text" placeholder="13501"></input>
              </div>
              <div>
                <input type="submit" value="Connect" />
              </div>
            </form>
            <hr />
          </>
        )}
        {error == null && <p>Connecting...</p>}
      </span>
      <hr />
      <div className="logo-container">
        Powered by
        <img className="logo mb-5" src={BAPSicleLogo} alt="BAPSicle Logo" />
      </div>
    </div>
  );
}
const SessionHandler: React.FC = function() {
  const dispatch = useDispatch();

  /* useEffect(() => {
    dispatch(SessionState.getTimeslot());
  }, [dispatch]);

  function redirectToLogin() {
    return window.location.replace(
      MYRADIO_NON_API_BASE +
        "/MyRadio/login/?next=" +
        encodeURIComponent(
          MYRADIO_NON_API_BASE + "/MyRadio/timeslot/?next=" + redirect_url
        )
    );
  }

  function redirectToTimeslotSelect() {
    return window.location.replace(
      MYRADIO_NON_API_BASE + "/MyRadio/timeslot/?next=" + redirect_url
    );
  }

  const {
    currentUser,
    currentTimeslot,
    userLoading,
    userLoadError,
    timeslotLoading,
    timeslotLoadError,
  } = useSelector((state: RootState) => state.session);

  var redirect_url = encodeURIComponent(window.location.toString());
  */

  const { connectionState, currentServer, currentTimeslot } = useSelector(
    (state: RootState) => state.session
  );

  switch (connectionState) {
    case "CONNECTED":
      return <Showplanner />;
    case "CONNECTING":
      return <ConnectionDialogue error={null} />;
    case "FAILED":
      return <ConnectionDialogue error={"Couldn't connect to server."} />;
    case "DISCONNECTED":
      dispatch(SessionState.getServer());
      return null;
  }
  /* return (
      <div>
        <LoadingDialogue
          title="Getting User..."
          subtitle={userLoading ? "Hang on a sec..." : ""}
          error={userLoadError}
          percent={39}
        />
        {userLoadError !== null &&
          userLoadError !== undefined &&
          !userLoading &&
          redirectToLogin()}
      </div>
    ); */

  /*
  if (currentTimeslot === null) {
    return (
      <div>
        <LoadingDialogue
          title="Getting Timeslot..."
          subtitle={timeslotLoading ? "Hang on a sec..." : ""}
          error={userLoadError}
          percent={71}
        />
        {currentTimeslot === null &&
          timeslotLoadError == null &&
          timeslotLoadError !== undefined &&
          !timeslotLoading &&
          redirectToTimeslotSelect()}
      </div>
    );
  }
  */

  return <p></p>;
};

export default SessionHandler;
