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


interface BroadcastState {
  tracklisting: boolean;
}

const broadcastState = createSlice({
  name: "Broadcast",
  initialState: {
    tracklisting: false
  } as BroadcastState,
  reducers: {
    setTracklisting(
      state
    ) {
      state.tracklisting = !state.tracklisting;
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
    return myradioApiRequest("/TracklistItem", "POST", { trackid: trackid, source: 'w', state: 'c' });
  }
};

export const tracklistEnd = (tracklistitemid: number): AppThunk => (dispatch, getState) => {
  console.log("Attempting to end tracklistitem: " + tracklistitemid);
  if (getState().broadcast.tracklisting) {
    myradioApiRequest("/TracklistItem/" + tracklistitemid + "/endtime", "PUT", { });
  }
};
