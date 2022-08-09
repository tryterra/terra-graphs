import { TerraGraph, TerraGraphType } from 'terra-graphs';
import { BarLoader } from 'react-spinners';

function App() {
  const token =
    'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJwYXlsb2FkIjp7ImRldi1pZCI6ImphYWZhciIsInVzZXJfaWQiOiJjOGRmYjNmOS0zMTYxLTQ3MDMtODg5ZS02ZmVjZjgxMzdkOWIiLCJzdGFydF9kYXRlIjoxNjU5NDQ4MTUyLCJlbmRfZGF0ZSI6MTY2MDA1Mjk1Mn0sImV4cGlyZXMiOjE2NjAwNTM4NTIuODE2MTU5fQ.9NLhnrWMtxc-WgTCS0-UgSISYWeSqNmpJYI14ajJGGQ';
  return (
    <div className="p-12 bg-sky-100">
      <div className="text-3xl font-bold mb-10">Sample Dashboard</div>
      <div className="flex flex-row flex-wrap justify-start">
        {['SLEEP_HR_SUMMARY', 'SLEEP_HRV_SUMMARY', 'SLEEP_ASLEEP_DURATION', 'DAILY_STEPS_SUMMARY'].map((t, i) => (
          <TerraGraph
            key={i}
            type={t as TerraGraphType}
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

export default App;
