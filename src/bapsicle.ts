import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { any } from "prop-types";
import { Dispatch, Middleware } from "redux";
import { TimeslotItem, Track } from "./api";

import { RootState } from "./rootReducer";
import {
  addItem,
  PlanItem,
  removeItem,
  getShowplanSuccessChannel,
} from "./showplanner/state";
import { AppThunk } from "./store";
import * as MixerState from "./mixer/state";
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
    const timeslotId = store.getState().session.currentTimeslot!.timeslot_id;
    BAPSicleWS!.onmessage = (event) => {
      var message = JSON.parse(event.data);
      console.log(message);
      if ("channel" in message) {
        switch (message.command) {
          case "PLAY":
            console.log("play channel" + message.channel);
            //store.dispatch(play(message.channel));
            break;
          case "PAUSE":
            //store.dispatch(pause(message.channel));
            break;
          case "UNPAUSE":
            //store.dispatch(play(message.channel));
            break;
          case "STOP":
            //store.dispatch(stop(message.channel));
            break;
          case "SEEK":
            //store.dispatch(seek(message.channel, message.time));
            break;
          case "LOAD":
            break;
            //console.log(store.getState().showplan);
            var itemToLoad: PlanItem;
            store.getState().showplan.plan?.forEach((item) => {
              if (
                item.channel === message.channel &&
                item.weight === message.weight
              ) {
                itemToLoad = item;
              }
            });
            //console.log(itemToLoad!);
            //store.dispatch(load(message.channel, itemToLoad!));
            break;
          case "REMOVE":
            break;
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
                timeslotId,
                (itemToRemove! as TimeslotItem).timeslotitemid
              )
            );
            break;
          case "ADD":
            break;
            store.dispatch(addItem(timeslotId, message.newItem));

          case "POS":
            store.dispatch(
              MixerState.setTimeCurrent({
                player: message.channel,
                time: parseInt(message.data),
              })
            );
            break;
          case "STATUS":
            // Bapsicle is telling us it's full state on this channel. Let's update the UI.
            console.log("STATUS");
            console.log(message.data);

            const channel = message.channel;
            // Update the player state
            const bapsicle_state = message.data;

            const playerState: MixerState.PlayerStateEnum = bapsicle_state.paused
              ? "paused"
              : bapsicle_state.playing
              ? "playing"
              : "stopped";
            store.dispatch(
              MixerState.setPlayerState({ player: channel, state: playerState })
            );

            if (bapsicle_state.loaded_item) {
              const raw_planitem = bapsicle_state.loaded_item;
              var loadedItem: PlanItem = {
                timeslotitemid: String(raw_planitem.timeslotItemId),
                channel: message.channel,
                played: false,
                type: raw_planitem.trackId ? "central" : "aux",
                trackid: raw_planitem.trackId,
                managedid: raw_planitem.managedId,
                ...raw_planitem,
              };
              store.dispatch(
                MixerState.loadItem({ player: channel, item: loadedItem })
              );
              store.dispatch(MixerState.itemLoadComplete({ player: channel }));
              store.dispatch(
                MixerState.setTimeLength({
                  player: channel,
                  time: bapsicle_state.length,
                })
              );
              store.dispatch(
                MixerState.setTimeCurrent({
                  player: channel,
                  time: bapsicle_state.pos_true,
                })
              );
              store.dispatch(
                MixerState.setAutoAdvance({
                  player: channel,
                  enabled: bapsicle_state.auto_advance,
                })
              );
              store.dispatch(
                MixerState.setPlayOnLoad({
                  player: channel,
                  enabled: bapsicle_state.play_on_load,
                })
              );
              store.dispatch(
                MixerState.setRepeat({
                  player: channel,
                  mode: bapsicle_state.repeat.toLowerCase(),
                })
              );
            }

            if (!("show_plan" in message.data)) {
              console.error("Show plan data missing from status");
              console.error(message.data);
            }
            // Update the list of plan items
            var raw_planitems: [any] = message.data.show_plan;
            var planItems: Array<PlanItem> = [];
            raw_planitems.forEach((raw_planitem) => {
              var planItem: PlanItem = {
                timeslotitemid: String(raw_planitem.timeslotItemId),
                channel: message.channel,
                played: false,
                type: raw_planitem.trackId ? "central" : "aux",
                trackid: raw_planitem.trackId,
                managedid: raw_planitem.managedId,
                ...raw_planitem,
              };
              //planItem.draggableId = planItem.timeslotitemid.toString()
              planItem = planItem as PlanItem;
              planItems.push(planItem);
            });
            store.dispatch(
              getShowplanSuccessChannel({
                channel: message.channel,
                planItems: planItems,
              })
            );
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
