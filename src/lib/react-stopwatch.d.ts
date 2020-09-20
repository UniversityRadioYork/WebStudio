
declare module 'react-stopwatch' {
  import * as React from "react";
  class Stopwatch extends React.Component<StopwatchProps, any> {}
  interface StopwatchProps {
    render: {
      text?: string;
      hours?: number;
      minutes?: number;
      seconds?: number;
    }

  }
  interface RenderProps {

  }
  export default Stopwatch;
};


//  export default function Stopwatch(): React.PureComponent
//};
