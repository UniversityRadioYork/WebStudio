import {
  createSlice,
  PayloadAction,
  Store,
  Dispatch,
  Action,
  Middleware
} from "@reduxjs/toolkit";
import { AppThunk } from "../store";
import { Track, myradioApiRequest } from "../api";
import { WebRTCStreamer, ConnectionStateEnum } from "./rtc_streamer";
import { destination } from "../mixer/state";

let streamer: WebRTCStreamer | null = null;

interface BroadcastState {
  tracklisting: boolean;
  connectionState: ConnectionStateEnum;
}

const broadcastState = createSlice({
  name: "Broadcast",
  initialState: {
    tracklisting: false,
    connectionState: "NOT_CONNECTED"
  } as BroadcastState,
  reducers: {
    setTracklisting(
      state
    ) {
      state.tracklisting = !state.tracklisting;
    },
    setConnectionState(state, action: PayloadAction<ConnectionStateEnum>) {
      state.connectionState = action.payload;
    }
  }
});

export default broadcastState.reducer;



export const toggleTracklisting = (): AppThunk => dispatch => {
  console.log("Toggled tracklisting.");
  dispatch(broadcastState.actions.setTracklisting());
};

export const tracklistStart = (trackid: number): AppThunk =>(dispatch, getState) => {
  console.log("Attempting to tracklist: " + trackid);
  if (getState().broadcast.tracklisting) {
    console.log(myradioApiRequest("/TracklistItem", "POST", { trackid: trackid, source: 'w', state: 'c' }));
  }
};

export const tracklistEnd = (trackid: number): AppThunk => (dispatch, getState) => {
  console.log("Attempting to tracklist: " + trackid);
  if (getState().broadcast.tracklisting) {
    myradioApiRequest("/TracklistItem", "POST", { trackid: trackid, source: 'w', state: 'c' });
  }
};

export const connect = (): AppThunk => dispatch => {
  streamer = new WebRTCStreamer(destination.stream);
  streamer.addConnectionStateListener(state => {
    dispatch(broadcastState.actions.setConnectionState(state));
  });
};
