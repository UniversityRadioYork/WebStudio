import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { AppThunk } from "../store";
import { Timeslot } from "../api";
import { connectBAPSicle } from "../bapsicle";

interface bapsServer {
  hostname: String | null;
  ui_port: Number | null;
  ui_protocol: String | null;
  ws_port: Number | null;
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
  // Since BAPS Presenter is served by the BAPSicle web server, use the current window path unless custom defined.
  let bapsServer: bapsServer = {
    hostname: process.env.REACT_APP_BAPSICLE_HOST
      ? process.env.REACT_APP_BAPSICLE_HOST
      : window.location.hostname,
    ws_port: process.env.REACT_APP_WEBSOCKET_PORT
      ? parseInt(process.env.REACT_APP_WEBSOCKET_PORT)
      : 13501,
    ui_protocol: process.env.REACT_APP_BAPSICLE_PROTOCOL
      ? process.env.REACT_APP_BAPSICLE_PROTOCOL
      : "http",
    ui_port: process.env.REACT_APP_BAPSICLE_PORT
      ? parseInt(process.env.REACT_APP_BAPSICLE_PORT)
      : parseInt(window.location.port),
    name: "Connecting...",
  };
  dispatch(sessionState.actions.setCurrentServer({ server: bapsServer }));
  dispatch(
    connectBAPSicle("ws://" + bapsServer.hostname + ":" + bapsServer.ws_port)
  );
};
