import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { AppThunk } from "../store";
import { myradioApiRequest, broadcastApiRequest } from "../api";
import { WebRTCStreamer } from "./rtc_streamer";
import * as MixerState from "../mixer/state";
import * as NavbarState from "../navbar/state";
import { ConnectionStateEnum, Streamer } from "./streamer";
import { RecordingStreamer } from "./recording_streamer";

export let streamer: WebRTCStreamer | null = null;

export type BroadcastStageEnum =
| "NOT_REGISTERED"
| "REGISTERED"
| "FAILED_REGISTRATION";


interface BroadcastState {
  stage: BroadcastStageEnum;
  connID: number | null;
  tracklisting: boolean;
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
    tracklisting: false,
    connectionState: "NOT_CONNECTED",
    recordingState: "NOT_CONNECTED"
  } as BroadcastState,
  reducers: {
    toggleTracklisting(state) {
      state.tracklisting = !state.tracklisting;
    },
    setConnID(state, action: PayloadAction<number | null>) {
      state.connID = action.payload;
      if (action.payload != null) {
        state.stage = "REGISTERED"
      } else {
        state.stage = "NOT_REGISTERED"
      }
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

export interface TrackListItem {
  audiologid: number;
}






export const registerTimeslot = (): AppThunk => async (dispatch, getState) => {
  if (getState().broadcast.stage === "NOT_REGISTERED") {
    var state = getState().session;
    const memberid = state.currentUser?.memberid;
    const timeslotid = state.currentTimeslot?.timeslot_id;
    console.log("Attempting to Register for Broadcast.");
    var sourceid = 4; // TODO: make UI for this.
    var connID = (await sendBroadcastRegister(timeslotid, memberid, sourceid));
    if (connID !== undefined) {
      dispatch(broadcastState.actions.setConnID(connID["connid"]));
      dispatch(startStreaming());
    }

  }
};

export const cancelTimeslot = (): AppThunk => async (dispatch, getState) => {
  if (getState().broadcast.stage === "REGISTERED") {
    console.log("Attempting to Cancel Broadcast.");
    var response = (await sendBroadcastCancel(getState().broadcast.connID));
    dispatch(stopStreaming());
    if (response != null) {
      dispatch(broadcastState.actions.setConnID(null));
    }

  }
};

export function sendBroadcastRegister(timeslotid: number | undefined, memberid: number | undefined, sourceid: number): Promise<any> {
  return broadcastApiRequest("/registerTimeslot", "POST", {
    memberid: memberid,
    timeslotid: timeslotid,
    sourceid: sourceid
  });
}
export function sendBroadcastCancel(connid: number | null): Promise<string | null> {
  return broadcastApiRequest("/cancelTimeslot", "POST", {
    connid: connid
  });
}









export const { toggleTracklisting } = broadcastState.actions;

export const tracklistStart = (
  player: number,
  trackid: number
): AppThunk => async (dispatch, getState) => {
  if (getState().broadcast.tracklisting) {
    console.log("Attempting to tracklist: " + trackid);
    var id = (await sendTracklistStart(trackid)).audiologid;
    dispatch(MixerState.setTracklistItemID({ player, id }));
  }
};

export const tracklistEnd = (tracklistitemid: number): AppThunk => async (
  dispatch,
  getState
) => {
  if (getState().broadcast.tracklisting) {
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
    source: "w",
    state: "c",
  });
}

export const startStreaming = (): AppThunk => async (dispatch, getState) => {
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
  streamer = new WebRTCStreamer(MixerState.destination.stream);
  streamer.addConnectionStateListener((state) => {
    dispatch(broadcastState.actions.setConnectionState(state));
  });
  await streamer.start();
};

export const stopStreaming = (): AppThunk => async (dispatch) => {
  if (streamer) {
    await streamer.stop();
  } else {
    console.warn("disconnect called with no streamer!");
  }
};

let recorder: RecordingStreamer;

export const startRecording = (): AppThunk => async dispatch => {
  recorder = new RecordingStreamer(MixerState.destination.stream);
  recorder.addConnectionStateListener((state) => {
    dispatch(broadcastState.actions.setRecordingState(state));
  });
  await recorder.start();
}

export const stopRecording = (): AppThunk => async dispatch => {
  if (recorder) {
    await recorder.stop();
  } else {
    console.warn("stopRecording called with no recorder!");
  }
}
