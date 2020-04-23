import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { AppThunk } from "../store";
import { myradioApiRequest, broadcastApiRequest, ApiException } from "../api";
import { WebRTCStreamer } from "./rtc_streamer";
import * as MixerState from "../mixer/state";
import * as NavbarState from "../navbar/state";
import { ConnectionStateEnum } from "./streamer";
import { RecordingStreamer } from "./recording_streamer";
import { audioEngine } from "../mixer/audio";

export let streamer: WebRTCStreamer | null = null;

export type BroadcastStageEnum =
  | "NOT_REGISTERED"
  | "REGISTERED"
  | "FAILED_REGISTRATION";

interface BroadcastState {
  stage: BroadcastStageEnum;
  connID: number | null;
  wsID: string | null;
  sourceID: number;
  autoNewsBeginning: boolean;
  autoNewsMiddle: boolean;
  autoNewsEnd: boolean;
  liveForThePurposesOfTracklisting: boolean;
  connectionState: ConnectionStateEnum;
  recordingState: ConnectionStateEnum;
}

/* Overall states:
hasn't registered
registered
on air

*/
const broadcastState = createSlice({
  name: "Broadcast",
  initialState: {
    stage: "NOT_REGISTERED",
    connID: null,
    wsID: null,
    sourceID: 5,
    autoNewsBeginning: true,
    autoNewsMiddle: true,
    autoNewsEnd: true,
    liveForThePurposesOfTracklisting: false,
    connectionState: "NOT_CONNECTED",
    recordingState: "NOT_CONNECTED",
  } as BroadcastState,
  reducers: {
    changeSetting<K extends keyof BroadcastState>(
      state: BroadcastState,
      action: PayloadAction<{ key: K; val: BroadcastState[K] }>
    ) {
      state[action.payload.key] = action.payload.val;
    },
    toggleTracklisting(state) {
      state.liveForThePurposesOfTracklisting = !state.liveForThePurposesOfTracklisting;
    },
    setTracklisting(state, action: PayloadAction<boolean>) {
      state.liveForThePurposesOfTracklisting = action.payload;
    },
    setConnID(state, action: PayloadAction<number | null>) {
      state.connID = action.payload;
      if (action.payload != null) {
        state.stage = "REGISTERED";
      } else {
        state.stage = "NOT_REGISTERED";
      }
    },
    setWsID(state, action: PayloadAction<string | null>) {
      state.wsID = action.payload;
    },
    setConnectionState(state, action: PayloadAction<ConnectionStateEnum>) {
      state.connectionState = action.payload;
    },
    setRecordingState(state, action: PayloadAction<ConnectionStateEnum>) {
      state.recordingState = action.payload;
    },
  },
});

export default broadcastState.reducer;

export const {
  toggleTracklisting,
  setTracklisting,
  setWsID,
} = broadcastState.actions;

export interface TrackListItem {
  audiologid: number;
}

export const changeBroadcastSetting = <K extends keyof BroadcastState>(
  key: K,
  val: BroadcastState[K]
): AppThunk => async (dispatch, getState) => {
  dispatch(broadcastState.actions.changeSetting({ key: key, val: val }));
  dispatch(changeTimeslot());
};

// intentionally renamed to break all existing callsites
export const registerForShow = (): AppThunk => async (dispatch, getState) => {
  if (!getState().session.userCanBroadcast) {
    dispatch(
      NavbarState.showAlert({
        color: "warning",
        content: "You are not WebStudio Trained and cannot go live.",
        closure: 7000,
      })
    );
    return;
  }
  if (getState().broadcast.stage === "NOT_REGISTERED") {
    var state = getState().session;
    const memberid = state.currentUser?.memberid;
    const timeslotid = state.currentTimeslot?.timeslot_id;
    const wsId = getState().broadcast.wsID;
    if (wsId === null) {
      throw new Error("Tried to register for broadcast with no wsID");
    }
    console.log("Attempting to Register for Broadcast.");
    var sourceid = getState().broadcast.sourceID;
    try {
      var connID = await sendBroadcastRegister(
        timeslotid,
        memberid,
        sourceid,
        wsId
      );
      console.log(connID);
      if (connID !== undefined) {
        dispatch(broadcastState.actions.setConnID(connID["connid"]));
      }
    } catch (e) {
      if (e instanceof ApiException) {
        dispatch(
          NavbarState.showAlert({
            content: e.message,
            color: "danger",
            closure: 10000,
          })
        );
        if (streamer) {
          await streamer.stop();
        }
      } else {
        // let raygun handle it
        throw e;
      }
    }
  }
};

export const cancelTimeslot = (): AppThunk => async (dispatch, getState) => {
  if (getState().broadcast.stage === "REGISTERED") {
    console.log("Attempting to Cancel Broadcast.");
    try {
      var response = await sendBroadcastCancel(getState().broadcast.connID);
      dispatch(stopStreaming());
      if (response != null) {
        dispatch(broadcastState.actions.setConnID(null));
      }
    } catch (e) {
      if (e instanceof ApiException) {
        dispatch(
          NavbarState.showAlert({
            content: e.message,
            color: "danger",
            closure: 10000,
          })
        );
      } else {
        // let raygun handle it
        throw e;
      }
    }
  }
};

export const changeTimeslot = (): AppThunk => async (dispatch, getState) => {
  var state = getState().broadcast;
  if (state.stage === "REGISTERED") {
    console.log("Attempting to Change Broadcast Options.");
    await sendBroadcastChange(
      state.connID,
      state.sourceID,
      state.autoNewsBeginning,
      state.autoNewsMiddle,
      state.autoNewsEnd
    );
  }
};

export function sendBroadcastRegister(
  timeslotid: number | undefined,
  memberid: number | undefined,
  sourceid: number,
  wsID: string
): Promise<any> {
  const payload = {
    memberid: memberid,
    timeslotid: timeslotid,
    sourceid: sourceid,
    wsid: wsID,
  } as any;
  return broadcastApiRequest("/registerTimeslot", "POST", payload);
}
export function sendBroadcastCancel(
  connid: number | null
): Promise<string | null> {
  return broadcastApiRequest("/cancelTimeslot", "POST", {
    connid: connid,
  });
}

export function sendBroadcastChange(
  connid: number | null,
  sourceid: number,
  beginning: boolean,
  middle: boolean,
  end: boolean
): Promise<any> {
  return broadcastApiRequest("/changeTimeslot", "POST", {
    connid: connid,
    sourceid: sourceid,
    beginning: beginning,
    middle: middle,
    end: end,
  });
}

function shouldTracklist(
  optionValue: "always" | "while_live" | "never",
  stateValue: boolean
) {
  console.log(optionValue, stateValue);
  if (optionValue === "while_live") {
    return stateValue;
  } else {
    return optionValue === "always";
  }
}

export const tracklistStart = (
  player: number,
  trackid: number
): AppThunk => async (dispatch, getState) => {
  const state = getState();
  if (
    shouldTracklist(
      state.settings.tracklist,
      state.broadcast.liveForThePurposesOfTracklisting
    )
  ) {
    console.log("Attempting to tracklist: " + trackid);
    var id = (await sendTracklistStart(trackid)).audiologid;
    dispatch(MixerState.setTracklistItemID({ player, id }));
  } else {
    console.log("not gonna tracklist that one after all");
  }
};

export const tracklistEnd = (tracklistitemid: number): AppThunk => async (
  dispatch,
  getState
) => {
  const state = getState();
  if (
    shouldTracklist(
      state.settings.tracklist,
      state.broadcast.liveForThePurposesOfTracklisting
    )
  ) {
    console.log("Attempting to end tracklistitem: " + tracklistitemid);
    myradioApiRequest(
      "/tracklistItem/" + tracklistitemid + "/endtime",
      "PUT",
      {}
    );
  }
};

export function sendTracklistStart(trackid: number): Promise<TrackListItem> {
  return myradioApiRequest("/tracklistItem", "POST", {
    trackid: trackid,
    sourceid: "w",
    state: "c",
  });
}

export const goOnAir = (): AppThunk => async (dispatch, getState) => {
  if (!getState().session.userCanBroadcast) {
    dispatch(
      NavbarState.showAlert({
        color: "warning",
        content: "You are not WebStudio Trained and cannot go live.",
        closure: 7000,
      })
    );
    return;
  }
  console.log("starting streamer.");
  streamer = new WebRTCStreamer(
    audioEngine.streamingDestination.stream,
    dispatch
  );
  streamer.addConnectionStateListener((state) => {
    dispatch(broadcastState.actions.setConnectionState(state));
    if (state === "CONNECTION_LOST") {
      // un-register if we drop, let the user manually reconnect
      dispatch(broadcastState.actions.setConnID(null));
    } else if (state === "CONNECTED") {
      // okay, we've connected
      dispatch(registerForShow());
    }
  });
  await streamer.start();
};

export const stopStreaming = (): AppThunk => async (dispatch) => {
  if (streamer) {
    await streamer.stop();
    streamer = null;
  } else {
    console.warn("disconnect called with no streamer!");
  }
};

let recorder: RecordingStreamer;

export const startRecording = (): AppThunk => async (dispatch) => {
  recorder = new RecordingStreamer(audioEngine.streamingDestination.stream);
  recorder.addConnectionStateListener((state) => {
    dispatch(broadcastState.actions.setRecordingState(state));
  });
  await recorder.start();
};

export const stopRecording = (): AppThunk => async (dispatch) => {
  if (recorder) {
    await recorder.stop();
  } else {
    console.warn("stopRecording called with no recorder!");
  }
};
