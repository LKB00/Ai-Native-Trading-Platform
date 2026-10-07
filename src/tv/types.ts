// The parts of TradingView's Charting Library datafeed interface (Datafeed API + Quotes API) that the adapter
// implements, written from the public docs (tradingview.com/charting-library-docs). The library ships its own
// typings in charting_library.d.ts; once you have repository access, delete this file and import the types
// from the library instead. Field names and callback shapes match it, so nothing else needs to change.

export type ResolutionString = string & { readonly __resolution?: unique symbol }

export type DatafeedConfiguration = {
  supported_resolutions: ResolutionString[]
  exchanges: { value: string; name: string; desc: string }[]
  symbols_types: { name: string; value: string }[]
  supports_marks: boolean
  supports_timescale_marks: boolean
  supports_time: boolean
  currency_codes?: string[]
}

export type SearchSymbolResultItem = {
  symbol: string; full_name: string; description: string; exchange: string; ticker: string; type: string
}

export type LibrarySymbolInfo = {
  name: string; ticker: string; full_name: string; description: string; type: string
  /** Trading hours in the exchange timezone, e.g. "0915-1530". */
  session: string; timezone: string; exchange: string; listed_exchange: string; format: 'price' | 'volume'
  /** Tick size is minmov / pricescale: 5 / 100 = ₹0.05, NSE's tick. */
  pricescale: number; minmov: number
  has_intraday: boolean; has_daily: boolean; has_weekly_and_monthly: boolean
  supported_resolutions: ResolutionString[]; intraday_multipliers: string[]
  volume_precision: number; data_status: 'streaming' | 'endofday' | 'delayed_streaming'
  visible_plots_set: 'ohlcv' | 'ohlc' | 'c'
  currency_code?: string; sector?: string; industry?: string
}

/** Times are UTC milliseconds. Daily, weekly and monthly bars sit at 00:00 UTC of their trading date. */
export type Bar = { time: number; open: number; high: number; low: number; close: number; volume?: number }
export type PeriodParams = { from: number; to: number; countBack: number; firstDataRequest: boolean }
export type HistoryMetadata = { noData?: boolean; nextTime?: number }

export type Mark = {
  id: string | number; time: number; color: 'red' | 'green' | 'blue' | 'yellow' | { border: string; background: string }
  text: string; label: string; labelFontColor: string; minSize: number
}

export type QuoteData =
  | { s: 'ok'; n: string; v: { ch: number; chp: number; short_name: string; exchange: string; description: string; lp: number; ask: number; bid: number; spread: number; open_price: number; high_price: number; low_price: number; prev_close_price: number; volume: number } }
  | { s: 'error'; n: string; v: object }

export type ErrorCallback = (reason: string) => void

export interface IBasicDataFeed {
  onReady(callback: (config: DatafeedConfiguration) => void): void
  searchSymbols(userInput: string, exchange: string, symbolType: string, onResult: (items: SearchSymbolResultItem[]) => void): void
  resolveSymbol(symbolName: string, onResolve: (info: LibrarySymbolInfo) => void, onError: ErrorCallback): void
  getBars(symbolInfo: LibrarySymbolInfo, resolution: ResolutionString, periodParams: PeriodParams, onResult: (bars: Bar[], meta: HistoryMetadata) => void, onError: ErrorCallback): void
  subscribeBars(symbolInfo: LibrarySymbolInfo, resolution: ResolutionString, onTick: (bar: Bar) => void, listenerGuid: string, onResetCacheNeeded: () => void): void
  unsubscribeBars(listenerGuid: string): void
  getServerTime?(callback: (unixSeconds: number) => void): void
  getMarks?(symbolInfo: LibrarySymbolInfo, from: number, to: number, onData: (marks: Mark[]) => void, resolution: ResolutionString): void
}

export interface IDatafeedQuotesApi {
  getQuotes(symbols: string[], onData: (data: QuoteData[]) => void, onError: ErrorCallback): void
  subscribeQuotes(symbols: string[], fastSymbols: string[], onRealtime: (data: QuoteData[]) => void, listenerGUID: string): void
  unsubscribeQuotes(listenerGUID: string): void
}

// ---------------------------------------------------------------- Trading Platform: Broker API
// The subset of IBrokerTerminal / IBrokerConnectionAdapterHost the paper broker uses, from the public docs.
// Enum values match the library's (OrderType, Side, OrderStatus, ParentType, ConnectionStatus).

export const OrderType = { Limit: 1, Market: 2, Stop: 3, StopLimit: 4 } as const
export const Side = { Buy: 1, Sell: -1 } as const
export const OrderStatus = { Canceled: 1, Filled: 2, Inactive: 3, Placing: 4, Rejected: 5, Working: 6 } as const
export const ParentType = { Order: 1, Position: 2, IndividualPosition: 3 } as const
export const ConnectionStatus = { Connected: 1, Connecting: 2, Disconnected: 3, Error: 4 } as const
export const NotificationType = { Error: 0, Success: 1 } as const

type V<T> = T[keyof T]
export type Brackets = { stopLoss?: number; takeProfit?: number; trailingStopPips?: number }
export type PreOrder = Brackets & {
  symbol: string; type: V<typeof OrderType>; side: V<typeof Side>; qty: number
  limitPrice?: number; stopPrice?: number; duration?: { type: string }; customFields?: Record<string, unknown>; isClose?: boolean
}
export type TVOrder = PreOrder & {
  id: string; status: V<typeof OrderStatus>; avgPrice?: number; filledQty?: number
  parentId?: string; parentType?: V<typeof ParentType>; message?: { text: string; type: 'error' | 'message' }; updateTime?: number
}
export type TVPosition = Brackets & { id: string; symbol: string; qty: number; side: V<typeof Side>; avgPrice: number }
export type Execution = { symbol: string; price: number; qty: number; side: V<typeof Side>; time: number }
export type InstrumentInfo = {
  qty: { min: number; max: number; step: number; default?: number }
  pipValue: number; pipSize: number; minTick: number; description: string; type?: string; currency?: string; lotSize?: number
}
export type IsTradableResult = { tradable: boolean; reason?: string }
export type OrderPreviewResult = { sections: { header?: string; rows: { title: string; value: string }[] }[]; confirmId?: string; warnings?: string[]; errors?: string[] }
export type OrderDialogOptions = { customFields?: { inputType: 'ComboBox'; id: string; title: string; items: { text: string; value: string }[]; value?: string; saveToSettings?: boolean }[] }
export type AccountManagerColumn = { id: string; label: string; dataFields: string[]; formatter?: string; alignment?: 'left' | 'right'; help?: string }
export type IWatchedValue<T> = { value(): T; setValue(v: T): void }
export type IDelegate<T> = { fire(v: T): void; subscribe(ctx: unknown, cb: (v: T) => void): void; unsubscribe(ctx: unknown, cb: (v: T) => void): void }
export type AccountManagerInfo = {
  accountTitle: string
  summary: { text: string; wValue: IWatchedValue<number>; formatter?: string; isDefault?: boolean }[]
  orderColumns: AccountManagerColumn[]; positionColumns: AccountManagerColumn[]; historyColumns?: AccountManagerColumn[]
  pages: { id: string; title: string; tables: { id: string; title?: string; columns: AccountManagerColumn[]; getData(): Promise<object[]>; changeDelegate: IDelegate<object> }[] }[]
}
export type TradingQuotes = { trade?: number; size?: number; bid?: number; bid_size?: number; ask?: number; ask_size?: number; spread?: number }

export interface IBrokerConnectionAdapterHost {
  orderUpdate(order: TVOrder): void
  positionUpdate(position: TVPosition): void
  executionUpdate(execution: Execution): void
  plUpdate(positionId: string, pl: number): void
  equityUpdate(equity: number): void
  realtimeUpdate(symbol: string, data: TradingQuotes): void
  showNotification(title: string, text: string, type?: V<typeof NotificationType>): void
  defaultContextMenuActions(context: unknown, params?: unknown): Promise<unknown[]>
  connectionStatusUpdate(status: V<typeof ConnectionStatus>, info?: { message?: string }): void
  factory: { createWatchedValue<T>(value: T): IWatchedValue<T>; createDelegate<T>(): IDelegate<T> }
}

export interface IBrokerTerminal {
  connectionStatus(): V<typeof ConnectionStatus>
  chartContextMenuActions(context: unknown, options?: unknown): Promise<unknown[]>
  isTradable(symbol: string): Promise<boolean | IsTradableResult>
  accountManagerInfo(): AccountManagerInfo
  accountsMetainfo(): Promise<{ id: string; name: string }[]>
  currentAccount(): string
  symbolInfo(symbol: string): Promise<InstrumentInfo>
  getOrderDialogOptions?(symbol: string): Promise<OrderDialogOptions | undefined>
  previewOrder?(order: PreOrder): Promise<OrderPreviewResult>
  placeOrder(order: PreOrder, confirmId?: string): Promise<{ orderId?: string }>
  modifyOrder(order: TVOrder, confirmId?: string): Promise<void>
  cancelOrder(orderId: string): Promise<void>
  orders(): Promise<TVOrder[]>
  ordersHistory?(): Promise<TVOrder[]>
  positions(): Promise<TVPosition[]>
  executions(symbol: string): Promise<Execution[]>
  closePosition?(positionId: string, amount?: number): Promise<void>
  reversePosition?(positionId: string): Promise<void>
  editPositionBrackets?(positionId: string, brackets: Brackets): Promise<void>
  subscribeRealtime(symbol: string): void
  unsubscribeRealtime(symbol: string): void
}
