import React, {useState} from 'react';

export type GraphType =
    | 'ACTIVITY_HR_SAMPLES'
    | 'ACTIVITY_POWER_SAMPLES'
    | 'BODY_GLUCOSE_SUMMARY'
    | 'BODY_GLUCOSE_AGP'
    | 'DAILY_STEPS_SUMMARY'
    | 'DAILY_RHR_SUMMARY'
    | 'SLEEP_HR_SUMMARY'
    | 'SLEEP_HRV_SUMMARY'
    | 'SLEEP_ASLEEP_SUMMARY'
    | 'SLEEP_RHR_SUMMARY'
    | 'SLEEP_RESPIRATORY_RATE_SUMMARY'
    | 'SLEEP_REM_SUMMARY'
    | 'SLEEP_LIGHT_SUMMARY'
    | 'SLEEP_DEEP_SUMMARY'
    | 'SLEEP_REM_LIGHT_DEEP_PIE_SUMMARY';

function Graph(props: {
    type: GraphType;
    token: string;
    loadingComponent?: JSX.Element;
    styles?: React.CSSProperties;
    className?: string;
    test?: boolean;
    startDate?: string;
    endDate?: string;
    timePeriod?: string;
    getImg?: boolean;
    imgWidth?: bigint;
    imgHeight?: bigint;
    getSmallTemplate?: boolean;

}) {

    const [loading, setLoading] = useState(true);
    const start = props.startDate ? `&start_date=${props.startDate}` : '';
    const end = props.endDate ? `&end_date=${props.endDate}` : '';
    const period = props.timePeriod ? `&timeperiod=${props.timePeriod}` : '';
    const getImg = props.getImg ? `&get_img=${props.getImg}` : '';
    const imgWidth = props.imgWidth ? `&get_img=${props.imgWidth}` : '';
    const imgHeight = props.imgHeight ? `&get_img=${props.imgHeight}` : '';
    const getSmallTemplate = props.getSmallTemplate ? `&get_img=${props.getSmallTemplate}` : '';

        return (
            <div style={props.styles ? props.styles : {}} className={props.className}>
                {loading && props.loadingComponent}
                <iframe
                    src={`http://127.0.0.1:8080/graphs/${props.test ? 'test' : 'render'}?type=${props.type}&token=${
                        props.token}${start}${end}${period}${getImg}${imgWidth}${imgHeight}${getSmallTemplate}`}
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
