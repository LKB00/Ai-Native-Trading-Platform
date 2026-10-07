import type { Leg, TF } from './market'

export type OrderAction = {
  t: 'order'; und: string; strike?: number; ot?: 'CE' | 'PE'; side: 'BUY' | 'SELL'
  /** Lots for options, shares for equity. */
  qty: number
  otype: 'MARKET' | 'LIMIT' | 'SL' | 'SL-M'; price?: number; trigger?: number
  product: 'MIS' | 'CNC' | 'NRML'; expiryIdx?: number
  /** Exit plan attached at entry: absolute prices, and a trailing distance in points. */
  sl?: number; tgt?: number; trail?: number
}

/** One scanner condition. Field names are the scanner's columns. */
export type Filter = { field: string; op: '>' | '<' | '>=' | '<=' | '=' | 'in'; value: number | string | string[] }

export type ViewName = 'chart' | 'chain' | 'strategy' | 'scanner' | 'markets' | 'portfolio' | 'journal'

export type Action =
  | OrderAction
  | { t: 'legs'; und: string; legs: Leg[]; expiryIdx: number; name?: string }
  | { t: 'squareoff'; key?: string }
  | { t: 'nav'; view?: ViewName; sym?: string; expiryIdx?: number }
  | { t: 'watch'; op: 'add' | 'remove'; sym: string }
  | { t: 'trigger'; sym: string; dir: 'above' | 'below'; price: number; then?: OrderAction }
  | { t: 'bracket'; key: string; sl?: number; tgt?: number; trail?: number }
  | { t: 'risk'; maxLoss?: number; maxProfit?: number; maxTrades?: number; kill?: boolean }
  | { t: 'scan'; filters: Filter[]; name?: string; sort?: string }
  | { t: 'chart'; sym?: string; tf?: TF; indicators?: string[]; levels?: boolean }
  | { t: 'sip'; sym: string; amount: number; day?: number }

/**
 * A live, interactive block inside a chat message. Cards read from the store, so prices, P&L and
 * order status update in place. Trades never come from a card directly: they become drafts to approve.
 */
export type Card =
  | { k: 'quote'; sym: string }
  | { k: 'chart'; sym: string; tf?: TF; levels?: boolean }
  | { k: 'brief' }
  | { k: 'positions' }
  | { k: 'position'; key: string }
  | { k: 'scan'; filters: Filter[]; name?: string }
  | { k: 'chain'; und: string; expiryIdx: number }
  | { k: 'ideas'; und: string; expiryIdx: number; view: string; maxLoss?: number; picks: string[] }
  | { k: 'alerts' }
  | { k: 'journal' }
  | { k: 'risk' }
  | { k: 'funds' }

export type AIResult = { reply: string; actions: Action[]; cards?: Card[]; follow?: string[] }
