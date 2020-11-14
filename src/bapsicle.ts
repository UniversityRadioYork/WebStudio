import { omit } from "lodash";
import { shallowEqual, useSelector } from "react-redux";
import { RootState } from "./rootReducer";

const SECS_REMAINING_WARNING = 20;

const playerState = (id: number) =>
  useSelector(
    (state: RootState) => state.mixer.players[id],
    (a, b) =>
      !(
        a.timeRemaining <= SECS_REMAINING_WARNING &&
        b.timeRemaining > SECS_REMAINING_WARNING
      ) &&
      shallowEqual(
        omit(a, "timeCurrent", "timeRemaining"),
        omit(b, "timeCurrent", "timeRemaining")
      )
  );

const players = [playerState(0), playerState(1), playerState(2)];

export const BAPSicle = process.env.REACT_APP_BAPSICLE_INTERFACE === "true";
export var BAPSicleConnection = "None";
var BAPSicleWS = null;

export function connectBAPSicle(path: string): void {
  BAPSicleWS = new WebSocket(path);
  BAPSicleConnection = "Connecting...";
  BAPSicleWS.onopen = () => (BAPSicleConnection = "Connected");
  BAPSicleWS.onclose = () => (BAPSicleConnection = "Disconnected");

  BAPSicleWS.onmessage = (event) => {
    var message = JSON.parse(event.data);
    if (message.channel) {
      switch (message.command) {
        case "PLAY":
          players[message.channel].state = "playing";
          break;
        case "PAUSE":
          players[message.channel].state = "paused";
          break;
        case "STOP":
          players[message.channel].state = "stopped";
          break;
      }
    }
  };
}
