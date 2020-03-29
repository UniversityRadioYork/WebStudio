import {
  createSlice,
  PayloadAction
} from "@reduxjs/toolkit";
import { AppThunk } from "../store";
import { myradioApiRequest } from "../api";
import { WebRTCStreamer } from "./rtc_streamer";
import * as MixerState from "../mixer/state";
import { ConnectionStateEnum, Streamer } from "./streamer";
import { RecordingStreamer } from "./recording_streamer";

let streamer: Streamer | null = null;

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


export interface TrackListItem {
  audiologid: number
}


export const toggleTracklisting = (): AppThunk => dispatch => {
  console.log("Toggled tracklisting.");
  dispatch(broadcastState.actions.setTracklisting());
};

export const tracklistStart = (player: number, trackid: number): AppThunk =>async (dispatch, getState) => {
  if (getState().broadcast.tracklisting) {
    console.log("Attempting to tracklist: " + trackid);
    var tracklistitemid = (await sendTracklistStart(trackid)).audiologid;
    dispatch(MixerState.setTracklistItemID(player, tracklistitemid))
  }
};

export const tracklistEnd = (tracklistitemid: number): AppThunk => async (dispatch, getState) => {
  if (getState().broadcast.tracklisting) {
    console.log("Attempting to end tracklistitem: " + tracklistitemid);
    myradioApiRequest("/tracklistItem/" + tracklistitemid + "/endtime", "PUT", {});
  }
};

export function sendTracklistStart(
  trackid: number
): Promise<TrackListItem> {
  return myradioApiRequest("/tracklistItem", "POST",
  {
    trackid: trackid,
    source: 'w',
    state: 'c'
  })
};

export const connect = (): AppThunk => async dispatch => {
  streamer = new WebRTCStreamer(MixerState.destination.stream);
  streamer.addConnectionStateListener(state => {
    dispatch(broadcastState.actions.setConnectionState(state));
  });
  await streamer.start();
};

export const disconnect = (): AppThunk => async dispatch => {
  if (streamer) {
    await streamer.stop();
  } else {
    console.warn("disconnect called with no streamer!");
  }
}
