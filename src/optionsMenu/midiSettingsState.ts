import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { List } from "lodash";
import { startMidi } from "../mixer/midi";
import { AppThunk } from "../store";



interface MIDIkeyMapping {
  volume: List<Number>;
  trim: List<Number>;
  play: List<Number>;
  pause: List<Number>;
  stop: List<Number>;
  pfl: List<Number>;
}
interface MIDISettings {
  enabled: boolean;
  selectedDeviceName: String | null;
  keyMapping: string;
  currentMapping: MIDIkeyMapping | null;
}

const none = [-1,-1,-1];

var custom: MIDIkeyMapping = {
  volume: none,
  trim: none,
  play: none,
  pause: none,
  stop: none,
  pfl: none,
}

var behringerXTouchCompact: MIDIkeyMapping = {
  volume: [6,7,8],
  trim: [15,16,17],
  play: none,
  pause: [45,46,47],
  stop: [21,22,23],
  pfl: [37,38,39],
}

var mattsDJController: MIDIkeyMapping = {
  volume: [3, 11, 34],
  trim:  [6, 7, 8],
  play: none,
  pause: [1, 2, 3],
  stop: none,
  pfl: none,
}

var midiKeyMaps = {
  "custom": custom,
  "xTouchCompact": behringerXTouchCompact,
  "mattsDJController": mattsDJController
}


const midiSettingsState = createSlice({
  name: "midiSettings",
  initialState: {
    enabled: false,
    selectedDeviceName: null,
    keyMapping: "custom",
    currentMapping: midiKeyMaps["custom"]
  } as MIDISettings,
  reducers: {
    changeMIDISetting<K extends keyof MIDISettings>(
      state: MIDISettings,
      action: PayloadAction<{ key: K; val: MIDISettings[K] }>
    ) {
      state[action.payload.key] = action.payload.val;
      if (midiKeyMaps.hasOwnProperty(state.keyMapping)) {
        state.currentMapping = midiKeyMaps[state.keyMapping];
      }

    },
  },
});

export const changeMIDISetting = <K extends keyof MIDISettings>(key: K, val: MIDISettings[K]): AppThunk => (dispatch, getState) => {
  dispatch(midiSettingsState.actions.changeMIDISetting({key, val}))
  dispatch(startMidi);
}


export default midiSettingsState.reducer;

