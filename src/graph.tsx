import React, {useEffect, useState} from 'react';
import axios from 'axios';

export type GraphType =
    | 'ACTIVITY_HR_SAMPLES'
    | 'ACTIVITY_POWER_SAMPLES'
    | 'BODY_GLUCOSE_SUMMARY'
    | 'BODY_GLUCOSE_SAMPLES'
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

interface RequiredProps {
    type: GraphType;
    token: string;
};

interface OptionalProps {
    loadingComponent?: JSX.Element;
    styles?: React.CSSProperties;
    className?: string;
    test?: boolean;
    startDate?: string;
    endDate?: string;
    timePeriod?: string;
    displayValueBottom?: boolean;
    enableTitle?: boolean;
    titleContent?: string;
    getImg?: boolean;
    getReactNative?: boolean;
};

interface GraphProps extends RequiredProps, OptionalProps {}

function Graph(props:GraphProps) {
    const [loading, setLoading] = useState(true);
    const [_response, setResponse] = useState('');
    const makeRequest = async () => {
        const params = {
            startDate: props.startDate,
            endDate: props.endDate,
            timePeriod: props.timePeriod,
            displayValueBottom: props.displayValueBottom,
            enableTitle: props.enableTitle,
            titleContent: props.titleContent,
            getImg: props.getImg,
            getReactNative: props.getReactNative,
        };
        try {
            const response = await axios.get(`http://127.0.0.1:8080/graphs/${props.test ?'test':'render'}?`, { params });
            const responseOK = response && response.status === 200 && response.statusText === 'OK';
            setLoading(false);
            setResponse(response.data);
            if (!responseOK) {
                throw Error(response.statusText);
            }
        } catch (error) {
            // tslint:disable-next-line:no-console
            console.error(error);
        }
    };
    useEffect(() => {makeRequest()}, [])


    return (
        <div style={props.styles ? props.styles : {}} className={props.className}>
            {loading && props.loadingComponent}
            <iframe
                srcDoc={_response}
                frameBorder="0"
                height="100%"
                width="100%"
            ></iframe>
        </div>
    );
}

export default Graph;
