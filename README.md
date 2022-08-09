# Terra Graphs Wrapper

This is a wrapper for the Terra Graphs API endpoint.

There is a single available component, `<TerraGraph />`.

| Property         | Type           | Description                                                                                                                                               |
| ---------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| type             | TerraGraphType | The graph type desired. See valid types on https://docs.tryterra.co/reference/using-graphs#graph-types                                                    |
| token            | string         | An access token for a particular user to enable data access and graph rendering. Generate a token using https://docs.tryterra.co/reference/generate-token |
| styles           | CSSProperties  | Custom css properties for the graph container                                                                                                             |
| className        | string         | Classname for the graph container                                                                                                                         |
| test             | boolean        | Whether to use a test graph. Test graphs don't require a valid token as they are intended to test the UI / UX                                             |
| loadingComponent | JSX.Element    | Custom element displayed when the graph is loading. Default is null                                                                                       |

## Example

```tsx
import { TerraGraph } from 'terra-graphs';
import { BarLoader } from 'react-spinners';

function App() {
  const token = 'valid_token';
  return (
    <div className="p-12 bg-sky-100">
      <div className="text-3xl font-bold mb-10">Sample Dashboard</div>
      <div className="flex flex-row flex-wrap justify-start">
        {['SLEEP_HR_SUMMARY', 'SLEEP_HRV_SUMMARY', 'SLEEP_ASLEEP_DURATION', 'DAILY_STEPS_SUMMARY'].map((t, i) => (
          <TerraGraph
            key={i}
            type={t}
            token={token}
            test={i === 0}
            className="md:w-1/3 h-[350px] w-full"
            loadingComponent={
              <div className="w-full h-full flex flex-col">
                <div className="m-auto">
                  <BarLoader />
                </div>
              </div>
            }
          />
        ))}
      </div>
    </div>
  );
}
```
