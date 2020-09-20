
declare module 'react-stopwatch' {
  import * as React from "react";

  class Stopwatch extends React.Component<StopwatchProps, any> {}

  interface StopwatchProps {
    hours: number;
    minutes: number;
    seconds: number;
    render ( args: {
      formatted?: string;
      hours?: number;
      minutes?: number;
      seconds?: number;
    }): React.ReactNode
  };

  export default Stopwatch;
};
