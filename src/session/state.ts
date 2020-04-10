import {
  createSlice,
  PayloadAction
} from "@reduxjs/toolkit";
import { AppThunk } from "../store";
import { User, getCurrentApiUser, Timeslot, getCurrentApiTimeslot, doesCurrentUserHavePermission } from "../api";
import { timestampToDateTime } from "../lib/utils";

import raygun from "raygun4js";

const BROADCAST_PERMISSION_ID = 340;

interface sessionState {
  currentUser: User | null;
  currentTimeslot: Timeslot | null;
  userCanBroadcast: boolean;
  userLoading: boolean;
  userLoadError: string | null;
  timeslotLoading: boolean;
  timeslotLoadError: string | null;
}

const sessionState = createSlice({
  name: "Session",
  initialState: {
    currentUser: null,
    currentTimeslot: null,
    userCanBroadcast: false,
    userLoading: false,
    userLoadError: null,
    timeslotLoading: false,
    timeslotLoadError: null
  } as sessionState,
  reducers: {
    setCurrentUser(
      state,
      action: PayloadAction<{ user: User | null, canBroadcast: boolean }>
    ) {
      state.userLoading = false;
      state.userLoadError = null;
      state.currentUser = action.payload.user;
      state.userCanBroadcast = action.payload.canBroadcast;
    },
    getUserStarting(state) {
      state.userLoadError = null;
      state.userLoading = true;
    },
    getUserError(state, action: PayloadAction<string>) {
      state.userLoading = false;
      state.userLoadError = action.payload;
    },
    getTimeslotStarting(state) {
      state.timeslotLoadError = null;
      state.timeslotLoading = true;
    },
    getTimeslotSuccess(state, action: PayloadAction<Timeslot>) {
      console.log("Getting timeslot succeeded.")
      state.timeslotLoading = false;
      state.timeslotLoadError = null;
      state.currentTimeslot = action.payload;
    },
    getTimeslotError(state, action: PayloadAction<string>) {
      state.timeslotLoading = false;
      state.timeslotLoadError = action.payload;
    },
    getState(state) {
      return state;
    }
  }
});

export default sessionState.reducer;

export const getCurrentUser = (
): AppThunk => async (dispatch, getState) => {
  return getState().session.currentUser;
};

export const getUser = (): AppThunk => async dispatch => {
  dispatch(sessionState.actions.getUserStarting());
  try {
    const [user, canBroadcast] = await Promise.all([ getCurrentApiUser(), doesCurrentUserHavePermission(BROADCAST_PERMISSION_ID) ]);
    raygun("setUser", {
      identifier: user.memberid.toString(10),
      firstName: user.fname,
      fullName: user.fname + " " + user.sname
    });
    dispatch(sessionState.actions.setCurrentUser({user, canBroadcast}));
  } catch (e) {
    console.log("failed to get user. " + e.toString())
    dispatch(sessionState.actions.getUserError(e.toString()));
  }
}

export const getTimeslot = (): AppThunk => async dispatch => {
  dispatch(sessionState.actions.getTimeslotStarting());
  try {
    const timeslot = await getCurrentApiTimeslot();
    dispatch(sessionState.actions.getTimeslotSuccess(timeslot));
  } catch (e) {
    console.log("failed to get selected timeslot. " + e.toString())
    dispatch(sessionState.actions.getTimeslotError(e.toString()));
  }
}
