import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { AppThunk } from "../store";
import { Timeslot } from "../api";
import { connectBAPSicle } from "../bapsicle";

interface bapsServer {
  hostname: String | null;
  port: Number | null;
  name: String | null;
}

interface sessionState {
  currentServer: bapsServer | null; // Connection Failed, Disconnected
  connectionState: "CONNECTED" | "CONNECTING" | "FAILED" | "DISCONNECTED";
  currentTimeslot: Timeslot | null;
  timeslotLoading: boolean;
  timeslotLoadError: string | null;
}

const sessionState = createSlice({
  name: "Session",
  initialState: {
    currentServer: null,
    connectionState: "DISCONNECTED",
    currentTimeslot: null,
    timeslotLoading: false,
    timeslotLoadError: null,
  } as sessionState,
  reducers: {
    setCurrentServer(state, action: PayloadAction<{ server: bapsServer }>) {
      state.currentServer = action.payload.server;
      state.connectionState = "CONNECTING";
    },
    setServerState(
      state,
      action: PayloadAction<sessionState["connectionState"]>
    ) {
      state.connectionState = action.payload;
    },
    getState(state) {
      return state;
    },
  },
});

export default sessionState.reducer;

export const { setServerState } = sessionState.actions;

export const getCurrentServer = (): AppThunk => async (dispatch, getState) => {
  return getState().bapsSession.currentServer;
};

export const getServer = (): AppThunk => async (dispatch) => {
  // TODO Server Details Configurable
  let bapsServer: bapsServer = {
    hostname: window.location.hostname,
    port: 13501,
    name: "Connecting...",
  };
  dispatch(sessionState.actions.setCurrentServer({ server: bapsServer }));
  dispatch(connectBAPSicle("ws://" + window.location.hostname + ":13501"));
};
