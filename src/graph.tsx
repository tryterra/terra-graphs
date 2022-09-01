import React, { useState } from 'react';

export type GraphType =
  | 'SLEEP_HR_SUMMARY'
  | 'SLEEP_HRV_SUMMARY'
  | 'SLEEP_ASLEEP_DURATION'
  | 'DAILY_STEPS_SUMMARY'
  | 'ACTIVITY_HR_SAMPLES'
  | 'ACTIVITY_POWER_SAMPLES';

function Graph(props: {
  type: GraphType;
  token: string;
  loadingComponent?: JSX.Element;
  styles?: React.CSSProperties;
  className?: string;
  test?: boolean;
}) {
  const [loading, setLoading] = useState(true);

  return (
    <div style={props.styles ? props.styles : {}} className={props.className}>
      {loading && props.loadingComponent}
      <iframe
        src={`https://api.tryterra.co/v2/graphs/${props.test ? 'test' : 'render'}?type=${props.type}&token=${
          props.token
        }`}
        frameBorder="0"
        height="100%"
        width="100%"
        onLoad={() => {
          setLoading(false);
        }}
      ></iframe>
    </div>
  );
}

export default Graph;
