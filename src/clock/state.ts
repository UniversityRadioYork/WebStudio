import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {AppThunk} from "../store";
import {calculateOffset} from "./time";

interface ClockState {
  offset: number | null;
}

const clockState = createSlice({
  name: "clock",
  initialState: {
    offset: null
  } as ClockState,
  reducers: {
    setOffset(state, action: PayloadAction<number>) {
      state.offset = action.payload
    }
  }
});

export default clockState.reducer;

export const synchronise = (): AppThunk => async (dispatch) => {
  const offset = await calculateOffset();
  dispatch(clockState.actions.setOffset(offset));
}

const SYNC_INTERVAL = 60 * 1000;

export const periodicallySynchroniseClock = (): AppThunk => dispatch => {
  dispatch(synchronise());
  window.setInterval(() => dispatch(synchronise()), SYNC_INTERVAL);
}
