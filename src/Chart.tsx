// The chart engine. TradingView's Advanced Charts library is used when its files are deployed in
// public/charting_library/ (see src/tv/); otherwise the Lightweight Charts workspace in ./chart.
import { useEffect, useState } from 'react'
import Workspace from './chart/Workspace'
import AdvancedChart, { advancedChartsAvailable } from './tv/AdvancedChart'

let known: boolean | undefined
export default function Chart() {
  const [advanced, setAdvanced] = useState(known)
  useEffect(() => { if (known === undefined) void advancedChartsAvailable().then((v) => { known = v; setAdvanced(v) }) }, [])
  return advanced ? <AdvancedChart /> : <Workspace />
}
export { spotAndAtm } from './chart/Workspace'
export { patterns } from './chart/Pane'
export { labelOf } from './market'
