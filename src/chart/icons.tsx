// Chart icons. Drawing tools and their toolbar (lines, Fibonacci, shapes, magnet, lock, hide, remove)
// use the TradingView-style set from KLineChart Pro. Tools that set has no icon for, and the top
// toolbar actions, use Lucide like the rest of the product. Names describe the tool, not the glyph.
import {
  ChartArea, ChartCandlestick, ChartColumn, ChartLine, ChartSpline, ChevronDown, Copy, Bell, Camera,
  History, Maximize, Minimize, Plus, Redo2, Settings,
  SquareFunction, Undo2,
} from 'lucide-react'
import type { SVGProps } from 'react'
import { lucide } from '../ds/lib/icons'
import { KL, type KLName } from './klicons'

// 1.25 stroke so Lucide glyphs carry the same line weight as the TradingView-style set beside them.
const L = (i: Parameters<typeof lucide>[0]) => lucide(i, 18, 1.25)
/** The tools the KLineChart set has no icon for, drawn the same way: 22px grid, thin round-capped lines, no fills, so
 *  the whole rail shares one weight and one visual size (Lucide's heavier strokes looked foreign beside it). */
const G = (d: string) => `<g fill="none" stroke="currentColor" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round">${d}</g>`
const EXTRA = {
  cross: G('<path d="M11 3.5v5.5M11 13v5.5M3.5 11H9M13 11h5.5"/>'),
  dot: '<circle cx="11" cy="11" r="2.4" fill="currentColor"/>',
  arrow: G('<path d="M6 4.5 17 9.4l-4.8 1.7-1.9 4.9z"/>'),
  text: G('<path d="M5 6h12M11 6v10.5M8.5 16.5h5"/>'),
  long: G('<rect x="4.5" y="4.5" width="13" height="6.5" rx=".8"/><rect x="4.5" y="11" width="13" height="4" rx=".8"/>'),
  short: G('<rect x="4.5" y="6.5" width="13" height="4" rx=".8"/><rect x="4.5" y="10.5" width="13" height="6.5" rx=".8"/>'),
  measure: G('<path d="M5 17 17 5M5 12.5V17h4.5M12.5 5H17v4.5"/>'),
  keep: G('<path d="m13.5 4.8 3.7 3.7L8.4 17.3 4.6 17.4l.1-3.8zM12 6.3l3.7 3.7M12.5 18.6H18"/>'),
}
/** A TradingView-style drawing icon (KLineChart Pro set, filled outlines on a 22px grid). The grid has
 *  more padding than Lucide's, so it renders 22/18 larger to sit at the same optical size. */
const K = (n: KLName | keyof typeof EXTRA) => {
  const C = ({ width = 18, height: _h, ...p }: SVGProps<SVGSVGElement>) => {
    const s = Math.round((Number(width) * 22) / 18)
    return <svg width={s} height={s} viewBox="0 0 22 22" fill="currentColor" aria-hidden focusable="false" {...p} dangerouslySetInnerHTML={{ __html: n in EXTRA ? EXTRA[n as keyof typeof EXTRA] : KL[n as KLName] }} />
  }
  return C
}

/* Cursors */
export const CursorCrossIcon = K('cross')
export const CursorDotIcon = K('dot')
export const CursorArrowIcon = K('arrow')

/* Lines */
export const TrendLineIcon = K('segment')
export const RayIcon = K('rayLine')
export const ExtendedLineIcon = K('straightLine')
export const HorizontalLineIcon = K('horizontalStraightLine')
export const HorizontalRayIcon = K('horizontalRayLine')
export const VerticalLineIcon = K('verticalStraightLine')
export const ChannelIcon = K('parallelStraightLine')

/* Fibonacci, shapes, annotation */
export const FibIcon = K('fibonacciLine')
export const RectangleIcon = K('rect')
export const TextIcon = K('text')

/* Forecasting and measuring */
export const LongPositionIcon = K('long')
export const ShortPositionIcon = K('short')
export const MeasureIcon = K('measure')

/* Toolbar actions */
export const MagnetIcon = K('weak_magnet')
export const LockIcon = K('lock')
export const UnlockIcon = K('unlock')
export const EyeIcon = K('visible')
export const EyeOffIcon = K('invisible')
export const TrashIcon = K('remove')
export const UndoIcon = L(Undo2)
export const RedoIcon = L(Redo2)
export const CameraIcon = L(Camera)
export const FullscreenIcon = L(Maximize)
export const ExitFullscreenIcon = L(Minimize)
export const BellIcon = L(Bell)
export const IndicatorsIcon = L(SquareFunction)
export const SettingsGearIcon = L(Settings)
export const CloneIcon = L(Copy)
export const PlusIcon2 = L(Plus)
export const KeepDrawingIcon = K('keep')
export const ChevronDownIcon = L(ChevronDown)
export const ReplayIcon = L(History)

/* Chart types. Lucide has one candlestick glyph, so the three candle styles fill its bodies
   differently: solid for candles, outline for hollow, and half-tone for Heikin Ashi. */
const Candle = L(ChartCandlestick)
export const CandlesIcon = (p: React.SVGProps<SVGSVGElement>) => <Candle {...p} className={`${p.className ?? ''} [&_rect]:fill-current`} />
export const HollowCandlesIcon = Candle
export const HeikinIcon = (p: React.SVGProps<SVGSVGElement>) => <Candle {...p} className={`${p.className ?? ''} [&_rect]:fill-current [&_rect]:[fill-opacity:.35]`} />
export const BarsIcon = L(ChartColumn)
export const LineChartIcon = L(ChartLine)
export const AreaChartIcon = L(ChartArea)
export const BaselineIcon = L(ChartSpline)
