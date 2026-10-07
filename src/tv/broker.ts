// Trading Platform's Broker API on the paper account. The library's order ticket, chart order lines, account
// manager and DOM call this; it places, modifies and cancels through the store, so every pre-trade check (risk
// limits, kill switch, cool-off, F&O disclosure, lot size, price band, margin, 3:20 pm intraday cut-off,
// freeze-quantity slicing) applies exactly as it does in chat and on our own chart. State flows back to the
// library through the host's update calls on every store change.
//
// Mapping:
//   symbol      the datafeed ticker: "RELIANCE", or an option key "NIFTY|24500|CE|13 OCT"
//   qty         shares; options step in whole lots (InstrumentInfo.qty.step = lot size)
//   order type  Market → MARKET, Limit → LIMIT, Stop → SL-M (trigger), StopLimit → SL (trigger + limit)
//   product     custom ticket field: Intraday (MIS) or Delivery (CNC); options are always NRML
//   brackets    stop loss, take profit and trailing stop map to the position's exit plan (OCO), shown to the
//               library as bracket orders on the position; trailing distance is in rupees (pipSize = 1)
import { useStore, legsMargin, type Order, type Position } from '../store'
import { bySym, charges, labelOf, parseKey, nextExpiries, FREEZE, SQUARE_OFF, secOfDay, sessionDay } from '../market'
import { parseSymbol } from './datafeed'
import {
  ConnectionStatus, NotificationType, OrderStatus, OrderType, ParentType, Side,
  type AccountManagerColumn, type AccountManagerInfo, type Brackets, type Execution, type IBrokerConnectionAdapterHost, type IBrokerTerminal,
  type IDelegate, type InstrumentInfo, type IWatchedValue, type OrderPreviewResult, type PreOrder, type TVOrder, type TVPosition,
} from './types'

type Product = 'MIS' | 'CNC' | 'NRML'
const ACCOUNT = 'paper'
const TICK = 0.05
/** Snap to the ₹0.05 tick, without float noise (416.20000000000005). */
const round = (v: number) => +(Math.round(v / TICK) * TICK).toFixed(2)

/** Library configuration to pass as `broker_config` next to `broker_factory`. */
export const BROKER_CONFIG = {
  configFlags: {
    supportClosePosition: true, supportPartialClosePosition: true, supportReversePosition: true, supportNativeReversePosition: true,
    supportPositionBrackets: true, supportOrderBrackets: true, supportMarketBrackets: true, supportTrailingStop: true,
    supportModifyOrderPrice: true, supportEditAmount: true, supportStopOrders: true, supportStopLimitOrders: true,
    supportPLUpdate: true, supportExecutions: true, supportOrdersHistory: true, supportPlaceOrderPreview: true,
    supportLevel2Data: false, showQuantityInsteadOfAmount: true, supportCustomBrackets: false,
  },
  durations: [{ name: 'DAY', value: 'DAY' }],
}

// ---- conversions

const STATUS: Record<Order['status'], TVOrder['status']> = { OPEN: OrderStatus.Working, TRIGGER_PENDING: OrderStatus.Working, COMPLETE: OrderStatus.Filled, CANCELLED: OrderStatus.Canceled, REJECTED: OrderStatus.Rejected }
const TYPE: Record<Order['otype'], TVOrder['type']> = { MARKET: OrderType.Market, LIMIT: OrderType.Limit, 'SL-M': OrderType.Stop, SL: OrderType.StopLimit }
const side = (s: 'BUY' | 'SELL') => (s === 'BUY' ? Side.Buy : Side.Sell)

function toTVOrder(o: Order): TVOrder {
  return {
    id: String(o.id), symbol: o.key, type: TYPE[o.otype], side: side(o.side), qty: o.qty, status: STATUS[o.status],
    limitPrice: o.otype === 'LIMIT' || o.otype === 'SL' ? o.price : undefined, stopPrice: o.trigger,
    avgPrice: o.fill, filledQty: o.status === 'COMPLETE' ? o.qty : 0, duration: { type: 'DAY' },
    stopLoss: o.sl, takeProfit: o.tgt, trailingStopPips: o.trail, updateTime: o.ts,
    message: o.note ? { text: o.note, type: o.status === 'REJECTED' ? 'error' : 'message' } : undefined,
  }
}
function toTVPosition(p: Position): TVPosition {
  const b = useStore.getState().brackets[p.key]
  return { id: p.key, symbol: p.key, qty: Math.abs(p.qty), side: p.qty > 0 ? Side.Buy : Side.Sell, avgPrice: p.avg, stopLoss: b?.sl, takeProfit: b?.tgt, trailingStopPips: b?.trail }
}
/**
 * The position's exit plan as the bracket orders the library draws and lets you drag: a stop and a target on the
 * opposite side, parented to the position. Ids are "<position>#sl" and "<position>#tp".
 */
function bracketOrders(p: Position): TVOrder[] {
  const b = useStore.getState().brackets[p.key]; if (!b || !p.qty) return []
  const exit = p.qty > 0 ? Side.Sell : Side.Buy; const base = { symbol: p.key, side: exit, qty: Math.abs(p.qty), status: OrderStatus.Working, parentId: p.key, parentType: ParentType.Position, duration: { type: 'DAY' } }
  const out: TVOrder[] = []
  if (b.sl != null) out.push({ ...base, id: `${p.key}#sl`, type: OrderType.Stop, stopPrice: b.sl, trailingStopPips: b.trail })
  if (b.tgt != null) out.push({ ...base, id: `${p.key}#tp`, type: OrderType.Limit, limitPrice: b.tgt })
  return out
}
const isBracketId = (id: string) => /#(sl|tp)$/.test(id)

/** Product from the ticket's custom field; options always carry overnight as NRML. */
function productOf(o: PreOrder): Product {
  if (parseKey(o.symbol).strike) return 'NRML'
  const v = o.customFields?.product
  if (v === 'CNC' || v === 'MIS') return v
  return secOfDay() >= SQUARE_OFF || useStore.getState().misClosed === sessionDay() ? 'CNC' : 'MIS'
}

/** Place through the store and report the outcome the way the library expects: an order id, or a thrown reason. */
function place(o: PreOrder, via: 'chart' = 'chart'): string {
  const st = useStore.getState(); const key = parseSymbol(o.symbol)?.key; if (!key) throw new Error(`Unknown symbol ${o.symbol}`)
  const sd = o.side === Side.Buy ? 'BUY' : 'SELL'
  const otype = o.type === OrderType.Market ? 'MARKET' : o.type === OrderType.Limit ? 'LIMIT' : o.type === OrderType.Stop ? 'SL-M' : 'SL'
  const before = new Set(st.orders.map((x) => x.id))
  const msg = st.place(key, sd, o.qty, otype, o.limitPrice ?? 0, productOf(o), { trigger: o.stopPrice, sl: o.stopLoss, tgt: o.takeProfit, trail: o.trailingStopPips, via, tag: 'TradingView ticket' })
  const placed = useStore.getState().orders.filter((x) => !before.has(x.id))
  const rejected = placed.find((x) => x.status === 'REJECTED')
  if (rejected || !placed.length) throw new Error(rejected?.note ?? msg)
  // Keep the conversation the record of every trade, wherever it was placed.
  // Your own action, so a plain note rather than an agent event; the live position card only once it has filled.
  const filled = placed.some((x) => useStore.getState().orders.find((y) => y.id === x.id)?.status === 'COMPLETE')
  st.addMsg({ role: 'ai', text: `**You placed this from the TradingView ticket:** ${msg}.`, cards: filled && useStore.getState().positions[key]?.qty ? [{ k: 'position', key }] : undefined })
  return String(placed[placed.length - 1].id)
}

/** Order value, margin, charges and the checks a trader should see before sending. Same numbers as the chat ticket. */
function preview(o: PreOrder): OrderPreviewResult {
  const st = useStore.getState(); const p = parseSymbol(o.symbol); if (!p) return { sections: [], errors: [`Unknown symbol ${o.symbol}`] }
  const k = parseKey(p.key); const inst = bySym(k.und)!; const prod = productOf(o)
  const ltp = st.ltp(p.key); const ref = o.type === OrderType.Limit || o.type === OrderType.StopLimit ? o.limitPrice ?? ltp : o.type === OrderType.Stop ? o.stopPrice ?? ltp : ltp
  const value = ref * o.qty; const long = o.side === Side.Buy
  const margin = k.strike ? (long ? value : legsMargin(k.und, [{ side: 'SELL', type: k.type!, strike: k.strike, lots: o.qty / inst.lot }], Math.max(0, nextExpiries(k.und).findIndex((e) => e.label === k.exp)))) : prod === 'CNC' ? value : value * 0.2
  const kind = k.strike ? 'OPTION' : prod === 'CNC' ? 'DELIVERY' : 'INTRADAY'
  const fees = charges(kind, long ? 'BUY' : 'SELL', value).total + charges(kind, long ? 'SELL' : 'BUY', value).total
  const inr = (v: number) => '₹' + Math.round(v).toLocaleString('en-IN')
  const rows = [
    { title: 'Product', value: prod === 'MIS' ? 'Intraday (MIS)' : prod === 'CNC' ? 'Delivery (CNC)' : 'F&O carry (NRML)' },
    { title: 'Order value', value: inr(value) }, { title: 'Margin needed', value: inr(margin) }, { title: 'Free funds', value: inr(st.pnl().avail) },
    { title: 'Charges, round trip', value: inr(fees) },
  ]
  if (o.stopLoss != null) rows.push({ title: 'Risk to stop', value: inr(Math.abs(ref - o.stopLoss) * o.qty) })
  if (o.stopLoss != null && o.takeProfit != null) rows.push({ title: 'Reward : risk', value: `${(Math.abs(o.takeProfit - ref) / Math.abs(ref - o.stopLoss)).toFixed(1)} : 1` })
  const warnings: string[] = []; const errors: string[] = []
  if (!k.strike && inst.seg === 'IDX') errors.push('Indices trade through options. Pick a strike from the option chain.')
  if (margin > st.pnl().avail) errors.push(`Needs ${inr(margin - st.pnl().avail)} more than your free funds.`)
  if (k.strike && o.qty % inst.lot) errors.push(`Quantity must be a multiple of the lot size, ${inst.lot}.`)
  if (prod === 'MIS' && (secOfDay() >= SQUARE_OFF || st.misClosed === sessionDay())) errors.push('Intraday entries stop at 3:20 pm. Choose Delivery.')
  if (st.risk.killed) errors.push(`Trading is locked: ${st.risk.reason ?? 'kill switch on'}. Exits still work.`)
  if (o.stopLoss == null && !k.strike) warnings.push('No stop loss. Add one in the ticket to cap the loss.')
  if (k.strike && !long) warnings.push('Selling an option has unlimited risk. A hedged spread caps it.')
  if (k.strike && FREEZE[k.und] && o.qty > FREEZE[k.und]) warnings.push(`Above the ${FREEZE[k.und]} freeze quantity: it will be sliced into ${Math.ceil(o.qty / FREEZE[k.und])} orders.`)
  if (prod === 'MIS') warnings.push('Intraday positions close automatically at 3:20 pm.')
  return { sections: [{ header: `${long ? 'Buy' : 'Sell'} ${o.qty} ${labelOf(p.key)}`, rows }], warnings, errors, confirmId: errors.length ? undefined : `pv-${Date.now()}` }
}

// ---- account manager columns (formatter names are the library's standard ones)

const col = (id: string, label: string, dataFields: string[], formatter?: string, alignment: 'left' | 'right' = 'right'): AccountManagerColumn => ({ id, label, dataFields, formatter, alignment })
const ORDER_COLS = [col('symbol', 'Symbol', ['symbol'], 'symbol', 'left'), col('side', 'Side', ['side'], 'side', 'left'), col('type', 'Type', ['type', 'parentId', 'stopType'], 'type', 'left'), col('qty', 'Qty', ['qty'], 'formatQuantity'), col('limitPrice', 'Limit', ['limitPrice'], 'formatPrice'), col('stopPrice', 'Trigger', ['stopPrice'], 'formatPrice'), col('avgPrice', 'Avg fill', ['avgPrice'], 'formatPrice'), col('status', 'Status', ['status'], 'status', 'left'), col('id', 'Order id', ['id'])]
const POSITION_COLS = [col('symbol', 'Symbol', ['symbol'], 'symbol', 'left'), col('side', 'Side', ['side'], 'side', 'left'), col('qty', 'Qty', ['qty'], 'formatQuantity'), col('avgPrice', 'Avg price', ['avgPrice'], 'formatPrice'), col('stopLoss', 'Stop', ['stopLoss'], 'formatPrice'), col('takeProfit', 'Target', ['takeProfit'], 'formatPrice'), col('pl', 'P&L', ['pl'], 'profit')]
const TRADE_COLS = [col('symbol', 'Symbol', ['symbol'], undefined, 'left'), col('side', 'Side', ['side'], undefined, 'left'), col('qty', 'Qty', ['qty']), col('entry', 'Entry', ['entry'], 'formatPrice'), col('exit', 'Exit', ['exit'], 'formatPrice'), col('net', 'Net P&L', ['net'], 'profit'), col('reason', 'Exit reason', ['reason'], undefined, 'left'), col('closed', 'Closed', ['closed'], 'date')]

// ---- the broker

export class PaperBroker implements IBrokerTerminal {
  private host: IBrokerConnectionAdapterHost
  private sent = new Map<string, string>() // what the library last saw, per order/position id, to send only changes
  private realtime = new Set<string>()
  private wv: Record<'balance' | 'equity' | 'pl' | 'used' | 'avail', IWatchedValue<number>>
  private tradesChanged: IDelegate<object>
  private unsub: () => void

  constructor(host: IBrokerConnectionAdapterHost) {
    this.host = host
    const f = host.factory; const pnl = useStore.getState().pnl()
    this.wv = { balance: f.createWatchedValue(useStore.getState().cash), equity: f.createWatchedValue(this.equity()), pl: f.createWatchedValue(pnl.net), used: f.createWatchedValue(pnl.used), avail: f.createWatchedValue(pnl.avail) }
    this.tradesChanged = f.createDelegate<object>()
    // Seed what the library will fetch through orders()/positions(), so the first store change sends only real changes.
    for (const o of this.allOrders()) this.sent.set(o.id, JSON.stringify(o))
    for (const p of this.openPositions()) this.sent.set('P:' + p.id, JSON.stringify(p))
    let last = useStore.getState()
    this.unsub = useStore.subscribe((s) => { const prev = last; last = s; this.sync(s, prev) })
  }

  /** Tell the library what changed in the store: orders, positions, fills, P&L, account values and quotes. */
  private sync(s: ReturnType<typeof useStore.getState>, prev: ReturnType<typeof useStore.getState>) {
    if (s.orders !== prev.orders || s.brackets !== prev.brackets || s.positions !== prev.positions) {
      const live = new Set<string>()
      for (const o of this.allOrders()) { live.add(o.id); const j = JSON.stringify(o); if (this.sent.get(o.id) !== j) { this.sent.set(o.id, j); this.host.orderUpdate(o) } }
      // A bracket that disappeared (hit, cancelled, or its position closed) is reported as cancelled.
      for (const [id, j] of this.sent) if (isBracketId(id) && !live.has(id)) { this.sent.delete(id); this.host.orderUpdate({ ...JSON.parse(j), status: OrderStatus.Canceled }) }
      const open = new Map(this.openPositions().map((p) => [p.id, p]))
      for (const [id, p] of open) { const j = JSON.stringify(p); if (this.sent.get('P:' + id) !== j) { this.sent.set('P:' + id, j); this.host.positionUpdate(p) } }
      for (const id of [...this.sent.keys()].filter((x) => x.startsWith('P:'))) if (!open.has(id.slice(2))) { const p = JSON.parse(this.sent.get(id)!); this.sent.delete(id); this.host.positionUpdate({ ...p, qty: 0 }) }
      const before = new Set(prev.orders.filter((o) => o.status === 'COMPLETE').map((o) => o.id))
      for (const o of s.orders) if (o.status === 'COMPLETE' && !before.has(o.id)) this.host.executionUpdate({ symbol: o.key, price: o.fill ?? o.price, qty: o.qty, side: side(o.side), time: o.ts })
      if (s.trades !== prev.trades) this.tradesChanged.fire({})
    }
    if (s.prices !== prev.prices) {
      for (const p of Object.values(s.positions)) if (p.qty) this.host.plUpdate(p.key, (s.ltp(p.key) - p.avg) * p.qty)
      for (const sym of this.realtime) { const l = s.ltp(sym); this.host.realtimeUpdate(sym, { trade: +l.toFixed(2), bid: round(l - TICK), ask: round(l + TICK), spread: +(2 * TICK).toFixed(2) }) }
    }
    const pnl = s.pnl(); const eq = this.equity()
    this.wv.balance.setValue(s.cash); this.wv.equity.setValue(eq); this.wv.pl.setValue(pnl.net); this.wv.used.setValue(pnl.used); this.wv.avail.setValue(pnl.avail)
    this.host.equityUpdate(eq)
  }
  private equity() { const s = useStore.getState(); return s.cash + Object.values(s.positions).reduce((a, p) => a + p.qty * s.ltp(p.key), 0) }
  private allOrders(): TVOrder[] {
    const s = useStore.getState(); const today = new Date().toDateString()
    return [...s.orders.filter((o) => new Date(o.ts).toDateString() === today).map(toTVOrder), ...Object.values(s.positions).flatMap(bracketOrders)]
  }
  private openPositions(): TVPosition[] { return Object.values(useStore.getState().positions).filter((p) => p.qty).map(toTVPosition) }

  /** Stop listening to the store, e.g. when the widget is removed. */
  destroy() { this.unsub() }

  connectionStatus() { return ConnectionStatus.Connected }
  chartContextMenuActions(context: unknown, options?: unknown) { return this.host.defaultContextMenuActions(context, options) }
  async isTradable(symbol: string) {
    const p = parseSymbol(symbol); if (!p) return { tradable: false, reason: 'Unknown symbol' }
    if (!p.opt && bySym(p.und)!.seg === 'IDX') return { tradable: false, reason: 'Indices trade through options. Pick a strike from the option chain.' }
    return true
  }
  accountsMetainfo() { return Promise.resolve([{ id: ACCOUNT, name: 'Paper account' }]) }
  currentAccount() { return ACCOUNT }
  accountManagerInfo(): AccountManagerInfo {
    return {
      accountTitle: 'Paper account',
      summary: [
        { text: 'Today, after charges', wValue: this.wv.pl, formatter: 'profit', isDefault: true },
        { text: 'Equity', wValue: this.wv.equity, formatter: 'fixed' }, { text: 'Cash', wValue: this.wv.balance, formatter: 'fixed' },
        { text: 'Margin used', wValue: this.wv.used, formatter: 'fixed' }, { text: 'Free funds', wValue: this.wv.avail, formatter: 'fixed' },
      ],
      orderColumns: ORDER_COLS, positionColumns: POSITION_COLS, historyColumns: ORDER_COLS,
      pages: [{ id: 'trades', title: 'Closed trades', tables: [{ id: 'trades', columns: TRADE_COLS, changeDelegate: this.tradesChanged,
        getData: async () => useStore.getState().trades.slice(0, 200).map((t) => ({ id: t.id, symbol: labelOf(t.key), side: t.side === 'LONG' ? 'Long' : 'Short', qty: t.qty, entry: t.entry, exit: t.exit, net: t.pnl - t.charges, reason: t.exitReason ?? 'manual', closed: t.close })) }] }],
    }
  }
  async symbolInfo(symbol: string): Promise<InstrumentInfo> {
    const p = parseSymbol(symbol); if (!p) throw new Error(`Unknown symbol ${symbol}`)
    const inst = bySym(p.und)!; const lot = p.opt ? inst.lot : 1
    return { qty: { min: lot, max: p.opt ? lot * 200 : 100000, step: lot, default: lot }, pipValue: 1, pipSize: 1, minTick: TICK, description: p.opt ? labelOf(p.key) : inst.name, type: p.opt ? 'option' : 'stock', currency: 'INR', lotSize: p.opt ? lot : undefined }
  }
  async getOrderDialogOptions(symbol: string) {
    if (parseSymbol(symbol)?.opt) return undefined
    const late = secOfDay() >= SQUARE_OFF || useStore.getState().misClosed === sessionDay()
    return { customFields: [{ inputType: 'ComboBox' as const, id: 'product', title: 'Product', items: [{ text: 'Intraday (MIS)', value: 'MIS' }, { text: 'Delivery (CNC)', value: 'CNC' }], value: late ? 'CNC' : 'MIS', saveToSettings: true }] }
  }
  async previewOrder(order: PreOrder) { return preview(order) }
  async placeOrder(order: PreOrder) { return { orderId: place(order) } }

  async modifyOrder(order: TVOrder) {
    const s = useStore.getState()
    if (isBracketId(order.id)) { // dragging a stop or target line edits the position's exit plan
      const key = order.id.replace(/#(sl|tp)$/, '')
      s.setBracket(key, order.id.endsWith('#sl') ? { sl: order.stopPrice, trail: order.trailingStopPips } : { tgt: order.limitPrice })
      return
    }
    const o = s.orders.find((x) => String(x.id) === order.id); if (!o) throw new Error('Order not found')
    if (o.status !== 'OPEN' && o.status !== 'TRIGGER_PENDING') throw new Error('Only working orders can be modified')
    // A changed quantity or side is a new order in the paper engine: cancel and re-place, so all checks run again.
    if (order.qty !== o.qty || side(o.side) !== order.side) { s.cancel(o.id); place({ ...order, symbol: o.key }); return }
    s.modify(o.id, { price: order.limitPrice, trigger: order.stopPrice })
    if (order.stopLoss !== o.sl || order.takeProfit !== o.tgt || order.trailingStopPips !== o.trail)
      useStore.setState({ orders: useStore.getState().orders.map((x) => (x.id === o.id ? { ...x, sl: order.stopLoss, tgt: order.takeProfit, trail: order.trailingStopPips } : x)) })
  }
  async cancelOrder(orderId: string) {
    const s = useStore.getState()
    if (isBracketId(orderId)) { const key = orderId.replace(/#(sl|tp)$/, ''); s.setBracket(key, orderId.endsWith('#sl') ? { sl: undefined, trail: undefined } : { tgt: undefined }); return }
    s.cancel(+orderId)
  }
  async orders() { return this.allOrders().filter((o) => o.status === OrderStatus.Working) }
  async ordersHistory() { return this.allOrders().filter((o) => o.status !== OrderStatus.Working && !isBracketId(o.id)) }
  async positions() { return this.openPositions() }
  async executions(symbol: string): Promise<Execution[]> {
    const key = parseSymbol(symbol)?.key
    return useStore.getState().orders.filter((o) => o.key === key && o.status === 'COMPLETE').map((o) => ({ symbol: o.key, price: o.fill ?? o.price, qty: o.qty, side: side(o.side), time: o.ts }))
  }
  async closePosition(positionId: string, amount?: number) {
    const s = useStore.getState(); const p = s.positions[positionId]; if (!p?.qty) throw new Error('No open position')
    const qty = Math.min(amount ?? Math.abs(p.qty), Math.abs(p.qty))
    if (qty === Math.abs(p.qty)) { s.squareoff(positionId); return }
    place({ symbol: positionId, type: OrderType.Market, side: p.qty > 0 ? Side.Sell : Side.Buy, qty, customFields: { product: p.product }, isClose: true })
  }
  async reversePosition(positionId: string) {
    const p = useStore.getState().positions[positionId]; if (!p?.qty) throw new Error('No open position')
    place({ symbol: positionId, type: OrderType.Market, side: p.qty > 0 ? Side.Sell : Side.Buy, qty: Math.abs(p.qty) * 2, customFields: { product: p.product } })
  }
  async editPositionBrackets(positionId: string, b: Brackets) {
    const s = useStore.getState(); const p = s.positions[positionId]; if (!p?.qty) throw new Error('No open position')
    const l = s.ltp(positionId); const long = p.qty > 0
    if (b.stopLoss != null && (long ? b.stopLoss >= l : b.stopLoss <= l)) throw new Error(`The stop is on the wrong side of the current price (${l.toFixed(2)})`)
    s.setBracket(positionId, { sl: b.stopLoss, tgt: b.takeProfit, trail: b.trailingStopPips, peak: undefined })
    this.host.showNotification('Exit plan saved', `${labelOf(positionId)}: ${[b.stopLoss != null && `stop ${b.stopLoss}`, b.takeProfit != null && `target ${b.takeProfit}`, b.trailingStopPips && `trail ₹${b.trailingStopPips}`].filter(Boolean).join(', ') || 'removed'}`, NotificationType.Success)
  }
  subscribeRealtime(symbol: string) { const k = parseSymbol(symbol)?.key; if (k) this.realtime.add(k) }
  unsubscribeRealtime(symbol: string) { const k = parseSymbol(symbol)?.key; if (k) this.realtime.delete(k) }
}

/** `broker_factory` for the widget options. */
export const brokerFactory = (host: IBrokerConnectionAdapterHost) => new PaperBroker(host)
