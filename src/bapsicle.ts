import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Dispatch, Middleware } from "redux";
import { TimeslotItem } from "./api";
import { load, pause, play, seek, stop } from "./mixer/state";
import { RootState } from "./rootReducer";
import { PlanItem, removeItem } from "./showplanner/state";
import { AppThunk } from "./store";

interface Connection {
  connectionState: string;
}

const initialState: Connection = {
  connectionState: "Not Connected",
};

const connection = createSlice({
  name: "connection",
  initialState: initialState,
  reducers: {
    setConnectionState(state, action: PayloadAction<string>): void {
      console.log("updating" + action.payload);
      state.connectionState = action.payload;
    },
  },
});

export default connection.reducer;

export var BAPSicleWS: WebSocket | null = null;

export const bapsicleMiddleware: Middleware<{}, RootState, Dispatch<any>> = (
  store
) => (next) => (action) => {
  if (BAPSicleWS) {
    BAPSicleWS!.onmessage = (event) => {
      var message = JSON.parse(event.data);
      if ("channel" in message) {
        switch (message.command) {
          case "PLAY":
            console.log("play channel" + message.channel);
            store.dispatch(play(message.channel));
            break;
          case "PAUSE":
            store.dispatch(pause(message.channel));
            break;
          case "UNPAUSE":
            store.dispatch(play(message.channel));
            break;
          case "STOP":
            store.dispatch(stop(message.channel));
            break;
          case "SEEK":
            store.dispatch(seek(message.channel, message.time));
            break;
          case "LOAD":
            console.log(store.getState().showplan);
            var itemToLoad: PlanItem;
            store.getState().showplan.plan?.forEach((item) => {
              if (
                item.channel === message.channel &&
                item.weight === message.weight
              ) {
                itemToLoad = item;
              }
            });
            store.dispatch(load(message.channel, itemToLoad!));
            break;
          case "REMOVE":
            var itemToRemove: PlanItem;
            store.getState().showplan.plan?.forEach((item) => {
              if (
                item.channel === message.channel &&
                item.weight === message.weight
              ) {
                itemToRemove = item;
              }
            });
            store.dispatch(
              removeItem(
                store.getState().session.currentTimeslot!.timeslot_id,
                (itemToRemove! as TimeslotItem).timeslotitemid
              )
            );
            break;
        }
      } else if ("message" in message) {
        if (message.message === "Hello") {
          store.dispatch(
            connection.actions.setConnectionState(message.serverName)
          );
        }
      }
    };
  }
  return next(action);
};

export function sendBAPSicleChannel(message: any): void {
  if (BAPSicleWS) {
    BAPSicleWS.send(JSON.stringify(message));
  }
}

export const connectBAPSicle = (path: string): AppThunk => async (
  dispatch,
  getState
) => {
  BAPSicleWS = new WebSocket(path);
  dispatch(connection.actions.setConnectionState("Connecting..."));
  BAPSicleWS.onopen = () =>
    dispatch(
      connection.actions.setConnectionState("Connected to BAPSicle Server")
    );
  BAPSicleWS.onclose = () =>
    dispatch(connection.actions.setConnectionState("Disconnected"));
};

export const disconnectBAPSicle = () => {
  BAPSicleWS!.close();
};
