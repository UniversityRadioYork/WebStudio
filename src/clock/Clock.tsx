import React, {useCallback, useState} from "react";
import RLClock from "react-live-clock";
import {useSelector} from "react-redux";
import {RootState} from "../rootReducer";
import {useInterval} from "../lib/useInterval";

export function Clock() {
    const offset = useSelector((state: RootState) => state.clock.offset);
    const [time, setTime] = useState(new Date().valueOf());

    const timerCallback = useCallback(() => {
        let newTime = new Date().valueOf();
        if (offset !== null) {
            newTime += offset;
        }
        if (newTime - time > 500) {
            setTime(newTime)
        }
    }, [offset, time]);

    useInterval(timerCallback, 200);

    return (
        <RLClock
            format={"HH:mm:ss"}
            ticking={true}
            timezone={"europe/london"}
            date={time}
        />
    );
}
