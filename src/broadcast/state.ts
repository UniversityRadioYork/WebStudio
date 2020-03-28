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


export interface TrackListItem {
  audiologid: number
}


export const toggleTracklisting = (): AppThunk => dispatch => {
  console.log("Toggled tracklisting.");
  dispatch(broadcastState.actions.setTracklisting());
};

export const tracklistStart = (player: number, trackid: number): AppThunk =>async (dispatch, getState) => {
  console.log("Attempting to tracklist: " + trackid);
  if (getState().broadcast.tracklisting) {
    getState().mixer.players[player].tracklistItemID = (await sendTracklistStart(trackid)).audiologid;
  }
};

export const tracklistEnd = (tracklistitemid: number): AppThunk => async (dispatch, getState) => {
  console.log("Attempting to end tracklistitem: " + tracklistitemid);
  if (getState().broadcast.tracklisting) {
    myradioApiRequest("/tracklistItem/" + tracklistitemid + "/endtime", "PUT", null);
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
