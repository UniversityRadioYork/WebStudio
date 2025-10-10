import React, { useEffect } from "react";
import * as SessionState from "./state";
import { MYRADIO_NON_API_BASE } from "../api";

import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../rootReducer";
import { LoadingDialogue } from "../showplanner";

const SessionHandler: React.FC = function() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(SessionState.getUser());
  }, [dispatch]);

  useEffect(() => {
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
  if (currentUser === null) {
    return (
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
    );
  }

  if (currentTimeslot === null) {
    return (
      <div>
        <LoadingDialogue
          title="Getting Timeslot..."
          subtitle={timeslotLoading ? "Hang on a sec..." : ""}
          error={userLoadError}
          percent={71}
        />
        {timeslotLoadError !== null &&
          timeslotLoadError !== undefined &&
          !timeslotLoading &&
          redirectToTimeslotSelect()}
      </div>
    );
  }

  return <></>;
};

export default SessionHandler;
