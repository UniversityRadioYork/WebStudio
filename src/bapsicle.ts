import { Dispatch, Middleware } from "redux";

import { RootState } from "./rootReducer";
import { PlanItem, getShowplanSuccessChannel } from "./showplanner/state";
import { AppThunk } from "./store";
import * as MixerState from "./mixer/state";
import * as SessionState from "./bapsiclesession/state";

export var BAPSicleWS: WebSocket | null = null;

export const bapsicleMiddleware: Middleware<{}, RootState, Dispatch<any>> = (
  store
) => (next) => (action) => {
  if (BAPSicleWS) {
    BAPSicleWS!.onmessage = (event) => {
      var message = JSON.parse(event.data);
      if ("channel" in message) {
        switch (message.command) {
          case "POS":
            store.dispatch(
              MixerState.setTimeCurrent({
                player: message.channel,
                time: parseInt(message.data),
              })
            );
            store.dispatch(MixerState.seek(message.channel, message.data));
            break;
          case "STATUS":
            // Bapsicle is telling us it's full state on this channel. Let's update the UI.

            // TODO: This hangs the state of timers etc for a second or two, maybe do stuff more selectively
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
                timeslotitemid: raw_planitem.timeslotItemId,
                channel: message.channel,
                type: raw_planitem.trackId ? "central" : "aux",
                trackid: raw_planitem.trackId,
                managedid: raw_planitem.managedId,
                auxid: raw_planitem.managedId,
                ...raw_planitem,
              };
              if (bapsicle_state.loaded) {
                store.dispatch(MixerState.load(channel, loadedItem));
              } else {
                store.dispatch(
                  MixerState.itemLoadPercentage({ player: channel, percent: 0 })
                );
              }
            } else {
              store.dispatch(MixerState.load(channel, null));
            }

            if (
              !bapsicle_state.initialised ||
              (bapsicle_state.loaded_item && !bapsicle_state.loaded)
            ) {
              store.dispatch(MixerState.itemLoadError({ player: channel }));
            }

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
                playedAt: raw_planitem.played_at,
                playCount: raw_planitem.play_count,
                type: raw_planitem.trackId ? "central" : "aux",
                trackid: raw_planitem.trackId,
                managedid: raw_planitem.managedId,
                auxid: raw_planitem.managedId,
                ...raw_planitem,
              };
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
        // BAPSicle says hello with it's server name.
        if (message.message === "Hello") {
          store.dispatch(SessionState.setServerName(message.serverName));
        }
      } else {
        console.log("Unhandled: ", message);
      }
    };
  }
  return next(action);
};

export function sendBAPSicleChannel(message: any): void {
  if (BAPSicleWS) {
    message = JSON.stringify(message);
    console.log("Sending message to BAPSicle:", message);
    BAPSicleWS.send(message);
  } else {
    console.warn(
      "Trying to send message without BAPSicle WS connection:",
      message
    );
  }
}

export const connectBAPSicle = (path: string): AppThunk => async (
  dispatch,
  getState
) => {
  BAPSicleWS = new WebSocket(path);
  dispatch(SessionState.setServerState("CONNECTING"));
  BAPSicleWS.onopen = () => dispatch(SessionState.setServerState("CONNECTED"));
  BAPSicleWS.onclose = () => dispatch(SessionState.setServerState("FAILED"));
  BAPSicleWS.onerror = () => dispatch(SessionState.setServerState("FAILED"));
};

export const disconnectBAPSicle = () => {
  BAPSicleWS!.close();
};
