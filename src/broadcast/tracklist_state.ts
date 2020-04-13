import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { AppThunk } from "../store";
import * as MixerState from "../mixer/state";
import { myradioApiRequest } from "../api";
import { TrackListItem } from "./state";

const tracklistState = createSlice({
  name: "tracklist",
  initialState: {
    isTracklisting: false,
    itemIds: [-1, -1, -1] as number[]
  },
  reducers: {
    setTracklisting(state, action: PayloadAction<boolean>) {
      state.isTracklisting = action.payload;
    },
    toggleTracklisting(state) {
      state.isTracklisting = !state.isTracklisting;
    },
    setTracklistItemId(
      state,
      action: PayloadAction<{ id: number; player: number }>
    ) {
      state.itemIds[action.payload.player] = action.payload.id;
    }
  }
});

export default tracklistState.reducer;

export const {
  setTracklisting,
  setTracklistItemId,
  toggleTracklisting
} = tracklistState.actions;

export const tracklistStart = (
  player: number,
  trackid: number
): AppThunk => async (dispatch, getState) => {
  if (getState().tracklist.isTracklisting) {
    console.log("Attempting to tracklist: " + trackid);
    var id = (await sendTracklistStart(trackid)).audiologid;
    dispatch(tracklistState.actions.setTracklistItemId({ player, id }));
  }
};

export const tracklistEnd = (tracklistitemid: number): AppThunk => async (
  dispatch,
  getState
) => {
  if (getState().tracklist.isTracklisting) {
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
    state: "c"
  });
}
