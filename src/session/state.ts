import {
  createSlice,
  PayloadAction
} from "@reduxjs/toolkit";
import { AppThunk } from "../store";
import { User, getCurrentApiUser, Timeslot, getCurrentApiTimeslot } from "../api";
import { timestampToDateTime } from "../lib/utils";


interface sessionState {
  currentUser: User | null;
  currentTimeslot: Timeslot | null;
  userLoading: boolean;
  userLoadError: string | null;
  timeslotLoading: boolean;
  timeslotLoadError: string | null;
}

const sessionState = createSlice({
  name: "Session",
  initialState: {
    currentUser: null
  } as sessionState,
  reducers: {
    setCurrentUser(
      state,
      action: PayloadAction<{ user: User | null }>
    ) {
      state.currentUser = action.payload.user;
      console.log("state")
    },
    getUserStarting(state) {
      state.userLoadError = null;
      state.userLoading = true;
    },
    getUserSuccess(state, action: PayloadAction<User>) {
      console.log("Getting user succeeded.")
      state.userLoading = false;
      state.userLoadError = null;
      state.currentUser = action.payload;
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

export const updateCurrentUser = (
  user: User | null
): AppThunk => async (dispatch, getState) => {
  dispatch(sessionState.actions.setCurrentUser({user}));
};

export const getCurrentUser = (
): AppThunk => async (dispatch, getState) => {
  return getState().session.currentUser;
};

export const getUser = (): AppThunk => async dispatch => {
  dispatch(sessionState.actions.getUserStarting());
  try {
    const user = await getCurrentApiUser();
    dispatch(sessionState.actions.getUserSuccess(user));
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
