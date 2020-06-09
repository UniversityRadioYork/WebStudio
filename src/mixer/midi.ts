import webmidi from "webmidi";
import { AppThunk } from "../store";
import { pause, setChannelTrim, setPlayerGain, setPlayerVolume } from "./state";

export const startMidi = (): AppThunk => (dispatch, getState) => {
  webmidi.enable(function (err) {
    if (err) {
      console.log("WebMidi could not be enabled.", err);
      return;
    } else {
      console.log("WebMidi enabled!");
    }

    console.log(webmidi.inputs);
    console.log(webmidi.outputs);

    if (webmidi.inputs.length === 0) {
      return;
    }
    var input = webmidi.inputs[0];

    input.addListener("noteon", "all", function (e) {
      console.log(e);
      dispatch(pause(e.note.number - 1));
    });
    input.addListener("controlchange", "all", function (e) {
      console.log(e.controller.number);
      console.log(e.value);
      var midi_fader_maps = [3, 11, 34];
      var midi_trim_maps = [6, 7, 8];
      var fader_channel = midi_fader_maps.indexOf(e.controller.number)
      var trim_channel = midi_trim_maps.indexOf(e.controller.number);


      if (fader_channel > -1) {
        let level = e.value / 127;
        let gainDB = Math.max(-36, 20 * Math.log(level));
        dispatch(
          setPlayerVolume({ player: fader_channel, volume: level })
        );
        dispatch(
          setPlayerGain({ player: fader_channel, gain: gainDB })
        );
      }
      if (trim_channel > -1) {
        let knob_sensitivity = 1;
        let level = ((e.value / 127) - 0.5) * knob_sensitivity;
        let gainDB = Math.max(-12, 20 * Math.log(1 - Math.abs(level)));
        let step = 0.2;
        gainDB = Math.round(gainDB * 1 / step) / (1 / step);
        if (level > 0) {
          gainDB = -gainDB;
        }
        dispatch(
          setChannelTrim(trim_channel, gainDB)
        );
      }
    });
  });
};
