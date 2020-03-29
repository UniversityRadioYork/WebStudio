import React, { useState, useReducer, useEffect, memo } from "react";
import { ContextMenu, MenuItem } from "react-contextmenu";
import { useBeforeunload } from "react-beforeunload";
import * as SessionState from "./state";
import { MYRADIO_NON_API_BASE } from "../api"


import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../rootReducer";

const SessionHandler: React.FC<{ }> = function () {

  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(SessionState.getUser());
  }, [dispatch]);

  useEffect(() => {
    dispatch(SessionState.getTimeslot());
  }, [dispatch]);

  function redirectToLogin() {
    window.location.replace(MYRADIO_NON_API_BASE + "/MyRadio/login/?next=" + redirect_url);
  }

  function redirectToTimeslotSelect() {
    window.location.replace(MYRADIO_NON_API_BASE + "/MyRadio/timeslot/?next=" + redirect_url);
  }

  const {
    currentUser,
    currentTimeslot,
    userLoading,
    userLoadError,
    timeslotLoading,
    timeslotLoadError
  } = useSelector((state: RootState) => state.session);

  var redirect_url = encodeURIComponent(window.location.toString());
  if (currentUser === null) {
    return (
      <div className="sp-container">
        <h1>Getting user data...</h1>
        {(userLoading) && (
          <b>Your data is loading, please wait just a second...</b>
        )}
        {userLoadError !== null && userLoadError !== undefined && !userLoading && (
          redirectToLogin()
        )}
      </div>
    );
  };

  if (currentTimeslot === null) {
    return (
      <div className="sp-container">
        <h1>Getting User Data...</h1>
        {(timeslotLoading) && (
          <b>Your data is loading, please wait just a second...</b>
        )}
        {currentTimeslot === null && timeslotLoadError == null && timeslotLoadError !== undefined && !timeslotLoading && (
          redirectToTimeslotSelect()
        )}
      </div>
    );
  }

  return (null);
};

export default SessionHandler;
