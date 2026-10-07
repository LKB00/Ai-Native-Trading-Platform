// Chart icons. Drawing tools and their toolbar (lines, Fibonacci, shapes, magnet, lock, hide, remove)
// use the TradingView-style set from KLineChart Pro. Tools that set has no icon for, and the top
// toolbar actions, use Lucide like the rest of the product. Names describe the tool, not the glyph.
import {
  ChartArea, ChartCandlestick, ChartColumn, ChartLine, ChartSpline, ChevronDown, CircleDot, Copy, Bell, Camera,
  History, Maximize, Minimize, MousePointer2, PencilLine, Plus, Redo2, RulerDimensionLine, Settings, SquareArrowDown,
  SquareArrowUp, SquareFunction, Type, Undo2,
} from 'lucide-react'
import type { SVGProps } from 'react'
import { lucide } from '../ds/lib/icons'
import { KL, type KLName } from './klicons'

// 1.25 stroke so Lucide glyphs carry the same line weight as the TradingView-style set beside them.
const L = (i: Parameters<typeof lucide>[0]) => lucide(i, 18, 1.25)
/** A TradingView-style drawing icon (KLineChart Pro set, filled outlines on a 22px grid). The grid has
 *  more padding than Lucide's, so it renders 22/18 larger to sit at the same optical size. */
const K = (n: KLName) => {
  const C = ({ width = 18, height: _h, ...p }: SVGProps<SVGSVGElement>) => {
    const s = Math.round((Number(width) * 22) / 18)
    return <svg width={s} height={s} viewBox="0 0 22 22" fill="currentColor" aria-hidden focusable="false" {...p} dangerouslySetInnerHTML={{ __html: KL[n] }} />
  }
  return C
}

/* Cursors */
export const CursorCrossIcon = L(Plus)
export const CursorDotIcon = L(CircleDot)
export const CursorArrowIcon = L(MousePointer2)

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
export const TextIcon = L(Type)

/* Forecasting and measuring */
export const LongPositionIcon = L(SquareArrowUp)
export const ShortPositionIcon = L(SquareArrowDown)
export const MeasureIcon = L(RulerDimensionLine)

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
export const KeepDrawingIcon = L(PencilLine)
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
