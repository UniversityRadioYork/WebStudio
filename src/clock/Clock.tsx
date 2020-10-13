import React, { useCallback, useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "../rootReducer";
import { useInterval } from "../lib/useInterval";

export function Clock() {
  const offset = useSelector((state: RootState) => state.clock.offset);
  const [time, setTime] = useState(new Date().valueOf());

  function timeConverter(UNIX_timestamp: number) {
    var a = new Date(UNIX_timestamp);
    var hour = "0" + a.getHours();
    var min = "0" + a.getMinutes();
    var sec = "0" + a.getSeconds();
    var time = hour.substr(-2) + ":" + min.substr(-2) + ":" + sec.substr(-2);
    return time;
  }
  const timerCallback = useCallback(() => {
    let newTime = new Date().valueOf();
    if (offset !== null) {
      console.log("setting offset.");
      newTime += offset;
    }
    if (Math.abs(newTime - time) > 500) {
      console.log("Old " + time + "New time " + newTime);
      setTime(newTime);
    }
  }, [offset, time]);

  useInterval(timerCallback, 200);

  return <>{timeConverter(time)}</>;
}
