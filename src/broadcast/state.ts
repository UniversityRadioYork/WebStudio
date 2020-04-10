import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { AppThunk } from "../store";
import { myradioApiRequest } from "../api";
import { WebRTCStreamer } from "./rtc_streamer";
import * as MixerState from "../mixer/state";
import * as NavbarState from "../navbar/state";
import { ConnectionStateEnum, Streamer } from "./streamer";
import { RecordingStreamer } from "./recording_streamer";

export let streamer: WebRTCStreamer | null = null;

interface BroadcastState {
  tracklisting: boolean;
  connectionState: ConnectionStateEnum;
  recordingState: ConnectionStateEnum;
}

const broadcastState = createSlice({
  name: "Broadcast",
  initialState: {
    tracklisting: false,
    connectionState: "NOT_CONNECTED",
    recordingState: "NOT_CONNECTED"
  } as BroadcastState,
  reducers: {
    toggleTracklisting(state) {
      state.tracklisting = !state.tracklisting;
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
    dispatch(broadcastState.actions.setConnectionState(state));
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
