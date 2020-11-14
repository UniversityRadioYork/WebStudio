import { Dispatch, Middleware } from "redux";
import { load, pause, play, seek, stop } from "./mixer/state";
import { RootState } from "./rootReducer";
import { PlanItem } from "./showplanner/state";

const SECS_REMAINING_WARNING = 20;

export const BAPSicle = process.env.REACT_APP_BAPSICLE_INTERFACE === "true";
export var BAPSicleConnection = "None";
var BAPSicleWS: WebSocket | null = null;

export const bapsicleMiddleware: Middleware<{}, RootState, Dispatch<any>> = (
  store
) => (next) => (action) => {
  console.log("updated");
  if (BAPSicleWS) {
    BAPSicleWS!.onmessage = (event) => {
      var message = JSON.parse(event.data);
      console.log(message);
      if ("channel" in message) {
        switch (message.command) {
          case "PLAY":
            console.log("play channel" + message.channel);
            store.dispatch(play(message.channel));
            break;
          case "PAUSE":
            store.dispatch(pause(message.channel));
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
                item.channel == message.channel &&
                item.weight == message.planItem
              ) {
                itemToLoad = item;
              }
            });
            store.dispatch(load(message.channel, itemToLoad!));
            break;
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

export function connectBAPSicle(path: string): void {
  BAPSicleWS = new WebSocket(path);
  BAPSicleConnection = "Connecting...";
  BAPSicleWS.onopen = () =>
    (BAPSicleConnection = "Connected to BAPSicle Server");
  BAPSicleWS.onclose = () => (BAPSicleConnection = "Disconnected");
}
