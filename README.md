# PromptTerminal — an AI-native trading terminal for Indian markets (paper trading)

You can do everything by typing (or speaking) a prompt. The AI drafts each action, shows you a **review card**, and runs it only after you click **Confirm**.

```
cd terminal && npm install && npm run dev
```

## The cockpit: a trading screen you drive by talking

One screen, laid out like a broker's terminal, with the AI agent as the main way you act:

- **Top:** workspace tabs, the risk limits with day P&L, the AI engine setting and the theme. Under it, a **ticker tape** of indices, your watchlist and the day's biggest movers (pauses on hover), with the IST market clock and session state.
- **Left: live watchlist.** Indices are pinned above your list. Each row shows an intraday sparkline against the previous close, a price that flashes green or red on every tick, the day's change and your position size (+68). Hover a row for quick B and S.
- **Centre: the stage.** The TradingView-style chart, or the option chain, strategy builder, scanner, markets, portfolio or journal from the tabs, for whatever symbol is in focus. Below it, the **positions, orders, alerts and activity panel** stays in view, with live P&L, exit plans and one-click exit.
- **Right: the AI agent.** Ask in plain words; it answers with live cards and drafts every trade for your approval. Anything you name becomes the focus symbol, so the chart and watchlist follow the conversation.
- **Chat | Terminal switch** (top bar, next to the logo; also in ⌘K): **Chat** makes the conversation the whole screen, with the ticker above and the positions panel below. **Terminal** is the cockpit described here. The switch crossfades while the top bar holds still, and your choice is remembered. Picking a workspace tab from Chat switches to Terminal on that tab.
- **Phones:** one pane at a time with a tab bar (Agent, Chart, Watchlist, Positions), opening on the agent.
- **Dark by default.** The theme button switches, and your choice is remembered. Below 1360px wide, the side panels slim down so the chart keeps its width; drag the edges to resize, `[` and `]` fold them, `\` folds the positions panel, `/` jumps to the agent.

**How the agent works:**
- **Answers are live cards, not text.** Quotes with a chart, an option chain you trade by tapping a price, scan results with Buy on each row, strategy ideas with payoffs, positions, alerts, limits and the journal. Cards keep updating while they sit in the thread.
- **Every trade is a draft you edit in place.** The order ticket in the reply has side, quantity, type, product, stop, target and trail, with live margin, charges, risk and reward. One-click "Add stop and target" sizes them from volatility. Nothing is sent until you press Place order.
- **The draft becomes the tracker.** After you approve, the same card shows fills, then the live position with Exit, Edit exit plan and Move stop to cost. Multi-leg strategies track as one position with one exit.
- **The agent speaks first.** Limit fills, stop or target hits, GTTs, alerts and nearing the daily loss limit arrive as messages with the next action attached (for example a quote card and "buy reliance" when an alert fires).
- **Composer:** `@` to pick a symbol with live prices, `/` for commands, follow-up suggestions after every reply, voice input, and a focus symbol, so "buy 10 of it" works.
- **History:** the conversation (last 200 messages) and the paper book (orders, positions, exit plans, alerts, trades, holdings, SIPs, cash and the day's prices) are saved in this browser, so a reload carries on where you left off, with a divider in the thread. Prices restart on a new trading day. **New conversation** (top bar or ⌘K) clears the chat; **Reset paper account** (⌘K) starts the money over.
- **Intraday rules, like a broker:** ten minutes before 3:20 pm IST the agent warns about open intraday (MIS) positions; at 3:20 pm it squares them off at market, cancels working intraday orders and posts what it closed. New intraday entries are refused for the rest of the session, and chat drafts default to Delivery. If you come back on a later day, the saved book is settled overnight at that day's last prices: intraday positions close, delivery buys move into holdings, options past expiry settle at intrinsic value, unfilled day orders expire, F&O positions carry forward, and the daily risk lock lifts. A "New session" message lists what changed.

Code: `src/App.tsx` (cockpit layout, watchlist, positions panel), `src/cockpit/live.tsx` (flashing prices, sparklines, ticker tape, market clock), `src/chat/Chat.tsx` (agent panel, thread, composer) and `src/chat/cards.tsx` (cards and drafts).

## Who it is for and what it does
Built from research on Indian traders and investors (see [RESEARCH.md](RESEARCH.md)). One terminal replaces the 3 to 9 apps traders juggle today.

| Workspace | For | Highlights |
|---|---|---|
| **Trade** (chart) | Intraday, swing, chart traders | Six timeframes (1m to 1W). Candles, Heikin Ashi and line. VWAP, EMA 9/20/50/200, SuperTrend, Bollinger, volume, RSI and MACD panes, pivots and CPR. **Chart trading**: B/S or the "+" on the price axis opens a ticket. Stop and target are lines you drag, quantity comes from the rupees you risk, and live R:R is shown. Position line with live P&L, orders, stops, targets, alerts and drawn lines are all draggable, each with a × button. Fill markers. AI support and resistance levels and candlestick patterns. Shortcuts. |
| **Options** | Options buyers and sellers | Per-index expiry calendar (NIFTY weekly on Tuesday, BANKNIFTY monthly, SENSEX on Thursday). Option chain with OI, OI change, IV, delta, PCR, max pain and ATM straddle. Strategy builder with 10 templates, payoff at expiry and today, **what-if sliders for days and IV**, max profit and loss, breakevens, chance of profit, Greeks and SPAN-like margin with hedge benefit and expiry-day ELM. |
| **Scanner** | Swing traders and investors | 15 ready-made scans (volume shockers, gaps, 52-week high, 20-day breakout, uptrend, pullback, NR7, relative strength, quality, growth, value). Custom conditions, sector filter, sortable results. **Plain-English scans** from the copilot show as editable filter chips. |
| **Markets** | Everyone, before the open | Index cards, breadth, % of stocks above the 200 EMA, sector heatmap and 3-month relative strength ranking, movers, expiries, FII/DII and VIX (simulated), events, AI briefing. |
| **Portfolio** | Investors | Holdings with long-term and short-term gains tags, sector allocation, indicative tax with tax-loss harvesting candidates, SIPs. |
| **Journal** | Every trader | Auto-logged trades with charges, win rate, profit factor, expectancy, P&L calendar, equity curve, breakdowns by weekday, setup, source and exit reason, and behaviour insights. |

**Risk engine** (top bar, shield icon):
- Daily max loss and profit lock with auto square-off.
- Max trades a day.
- Cool-off after N losses in a row.
- **Kill switch**.
- Exits are never blocked.

**Pre-trade checks:**
- Funds and margin.
- Lot multiples.
- Price band.
- F&O risk disclosure (SEBI).
- Auto-slicing above the freeze quantity.

**Order types:**
- Market, limit and stop-entry (SL-M).
- Exit plan attached at entry: stop, target (OCO) and trailing stop.
- GTT.

**Charges:** full Indian charges (brokerage, STT at 2026 rates, exchange fee, SEBI fee, stamp duty, GST). P&L is shown net of charges.

**Audit log:** every AI suggestion, approval and order goes into the Activity tab.

## Charts: a TradingView-style workspace
The charts run on TradingView's open-source engine (Lightweight Charts v5), with a TradingView-style interface built around it (`src/chart/`).

- **Top toolbar:**
  - Symbol search. Typing any letter on the chart opens it.
  - 11 intervals, from 1m to 1M. Typing a number then Enter changes the interval: 5, 15, 60, 240, then D/W/M.
  - 7 chart types: bars, candles, hollow candles, Heikin Ashi, line, area and baseline.
  - The other buttons: Indicators, Alert, AI levels, Undo and Redo, Layout, Settings, Snapshot (PNG) and Fullscreen.
  - Buy and Sell buttons with the spread.
- **Left drawing toolbar:** grouped tools with flyouts.
  - Tools: cursors, trend line, ray, extended line, horizontal line, horizontal ray, vertical line, parallel channel, Fib retracement, rectangle, text, Long position, Short position and Measure.
  - Settings below them: magnet (snap to OHLC), stay in drawing mode, lock all, hide all, remove all.
- **Drawings:**
  - Drawn on an SVG layer synced to the chart, so they can extend into the future and keep working when you change timeframe.
  - Select a drawing to get a floating toolbar for colour, width, style and extend-right, plus text editing, alert, clone, lock and delete.
  - Drag a handle or the whole drawing. ⌘Z / ⇧⌘Z undo and redo.
  - **Long/Short position** shows target and stop zones with R:R. **Trade this** opens the order ticket with that entry, stop and target.
- **Indicators:** 19 of them in a searchable dialog.
  - Price overlays: SMA, EMA, WMA, VWAP, Bollinger Bands, SuperTrend, Keltner, Donchian, Parabolic SAR, Volume.
  - Their own panes: RSI, MACD, Stochastic, ATR, ADX, CCI, OBV, Williams %R, MFI.
  - You can add the same indicator more than once (EMA 20 and EMA 50).
  - The legend shows live values. Hover to hide, edit inputs and colour, or remove. Indicator panes can be resized.
- **Bottom bar:**
  - Date ranges: 1D, 5D, 1M, 3M, 6M, YTD, 1Y, 5Y, All.
  - IST exchange clock, with a market-open or simulated-session badge.
  - Percent, log and auto scale.
- **NSE session:**
  - Intraday bars exist only from 09:15 to 15:30 IST on weekdays, with no overnight bars, and times show in IST.
  - Outside market hours the simulator replays a session, starting at 12:15 on the last trading day.
- **Right-click menu:** buy limit or stop at the price, alert, horizontal line, reset view (Alt+R), hide or remove drawings, copy price.
- **Multi-chart:** 5 layouts, and a spot plus ATM call/put preset. Each chart has its own symbol and interval.
- **Shortcuts:**
  - Drawing: Alt+T trend, Alt+H horizontal, Alt+J horizontal ray, Alt+V vertical, Alt+F fib, Alt+A alert.
  - View: Alt+R reset, Alt+L log, Alt+P percent.
  - Trading and editing: B/S ticket, Delete, Esc.

**Why not TradingView's own product?** TradingView's full Charting Library needs a licence application to TradingView, and its free embed widget doesn't support NSE/BSE symbols or our orders and positions. If you get Charting Library access, the drawing and indicator UI can be replaced, while orders, positions, alerts and the AI keep working through the same store.

## TradingView Advanced Charts: ready to switch on

TradingView's Advanced Charts library is free for companies with a public web product, but it isn't on npm: you apply on [tradingview.com](https://in.tradingview.com/free-charting-libraries/) and get access to a private repository. The adapter is already built:

- `src/tv/datafeed.ts` implements the library's Datafeed API and Quotes API on the terminal's data:
  - symbol search, including option contracts ("NIFTY 24500 CE")
  - symbol info: NSE/BSE/NFO/BFO, 09:15–15:30 IST Monday to Friday, ₹0.05 tick
  - history for 1, 3, 5, 15, 30, 60, 120 and 240 minutes and 1D/1W/1M, with paging back to the end of history
  - live bar updates and live quotes for the watchlist and order ticket
  - your fills as chart markers
  - server time
- `src/tv/AdvancedChart.tsx` mounts the widget, follows the terminal's focus symbol and theme, and passes a symbol picked in the chart back to chat and the book.
- `src/Chart.tsx` uses Advanced Charts when the library files are deployed and the Lightweight Charts workspace otherwise.

**To switch on:** copy the library's `charting_library/` folder into `public/charting_library/` and reload. Optionally replace `src/tv/types.ts` with imports from the library's own typings; the field names match.

**Trading Platform's order system runs on the paper account** (`src/tv/broker.ts`, its Broker API):
- **Order ticket:** market, limit, stop (SL-M) and stop-limit (SL) orders, with a Product field (Intraday or Delivery). Before you send, a preview shows margin, charges, risk and reward, and warnings.
- **On the chart:** order and position lines; drag a working order to modify it. The position's stop and target show as bracket orders you can drag.
- **Positions:** close in full or in part, reverse, and edit the stop and target.
- **Account manager:** P&L, equity, margin and free funds, plus a Closed trades page.
- **Fills:** each fill also appears as a marker on the chart.
- **Same checks everywhere:** every order goes through the paper account's pre-trade checks, exactly as in chat and on our own chart, and each order is noted in the conversation.

**Our layer on its chart** (`src/tv/overlays.ts`, through its chart API):
- **With Advanced Charts:**
  - Working orders as order lines: drag to change the price, × to cancel.
  - The open position as a position line with live P&L: × exits at market.
  - The stop and target as dashed lines showing their rupee outcome. Drag to move them; a stop or target on the wrong side of the price snaps back.
- **With Trading Platform,** the broker draws orders and positions, so the overlay adds only the next two items.
- **Alerts and GTTs:** drag to move, × to remove.
- **AI levels:** support and resistance from daily swings, plus candlestick patterns for the current timeframe. Switch them on with the "AI levels" button in the chart header or by asking in chat ("draw levels on reliance").
- **Notes in chat:** moves, cancels and exits made on the chart are also noted in the conversation.

**Still to check when the library arrives:** compare the chart, drawing and Broker API names against the library's own typings.

## Layout behaviour (fold, expand, resize)
| Area | Folded state | How to fold or open | Resize |
|---|---|---|---|
| Watchlist | A 48 px rail with a vertical "Watchlist" label. Hover or click it to peek the full list over the chart without moving the layout; "Keep open" pins it | `[`, the chevron, or double-click its edge | Drag the right edge (200–400 px) |
| Copilot | A 48 px rail on the right, mirroring the watchlist (AI mark and a vertical "Copilot" label). An **amber count** appears when trades are waiting for approval, and a pulsing dot while it is thinking | `]`, the chevron, or `/` (opens it and focuses the input) | Drag the left edge (320–560 px) |
| Copilot on screens narrower than 1,100 px | Stays a rail; opening it slides a drawer over the chart so the chart never gets squeezed. Esc closes it | as above | — |
| Positions, orders, alerts and activity panel | Only its tab bar shows (44 px). Clicking a tab reopens it on that tab | `\`, the chevron, or double-click its top edge | Drag the top edge (120 px to 70% of the height) |
| Focus mode | Hides the watchlist, copilot and positions panel at once. Turning it off restores whatever was open before | Shift+F, or the eye icon in the top bar | — |
| Copilot suggestion chips | Hidden behind "Show suggestions" | the link under the chips | — |
| Sections inside Markets, Portfolio, Journal, Scanner and Strategy | The heading plus a **one-line summary** of the key number (e.g. "30 up · 15 down") | Click the heading | — |

- **Always visible:** headers, KPI rows, the top bar with P&L and the risk shield, and the order buttons.
- **Secondary detail starts folded:** FII/DII flows, upcoming events, sector strength, journal breakdowns and the trade log.
- **Saved and resettable:** every choice is saved in the browser. "Reset layout" in ⌘K restores the defaults.
- **Accessible splitters:** each one is a focusable separator. Arrow keys resize it (Shift for bigger steps) and Enter folds the panel.

## What you can say to the copilot
| Intent | Example prompts |
|---|---|
| Brief | `brief me` · `how's the market` |
| Trade with an exit plan | `buy 50 sbi with sl 850 target 900` · `buy 20 tcs sl 3050 target 3250 trail 15` · `sell 1 lot nifty atm ce` |
| Protect | `add stop 1400 to reliance` · `square off all` · `kill switch` · `set max loss 5000` |
| Strategy from a view | `mildly bullish on nifty, max loss 10000` · `iron condor on banknifty 2 lots` |
| Scan | `stocks near 52 week high with volume 2x in banks` · `quality stocks with low debt` · `pharma above 200 ema with rsi over 60` |
| Analyse | `analyse hdfc bank` · `draw levels on reliance` · `why is bel up` |
| Size | `how many shares of tcs if i risk 2000 with stop 3050` |
| Review | `explain my pnl` · `review my trades` |
| Invest | `sip 5000 in niftybees` · `show my holdings` |

Press `/` for the copilot and `⌘K` for the command palette. The AI never gives personal buy or sell advice. It reframes those requests as data and education, as SEBI rules require.

## Design system
The UI uses **Sandstone** ([LKB00/Ai-DS](https://github.com/LKB00/Ai-DS)), copied into `src/ds` (React + Tailwind v4). Import from `./ds`.
- Tokens only: the **Indigo** colour theme (`data-palette="indigo"` on `<html>`), Geist for interface text and headings, Geist Mono for prices and numbers, pill controls, light and dark themes (toggle in the top bar).
- **Amber means a person has to act.** Every AI-drafted trade appears as an `ApprovalPrompt`, with a risk level (low, medium or high) and the exact orders. The copilot header shows how many are waiting.
- **Lime** is kept for the AI mark and one positive action ("Place orders").
- Price direction is never shown by color alone: every change has an arrow and a sign (▲ +0.42%).
- Components used: Message, Markdown, Composer, ApprovalPrompt, SuggestionChips, TypingIndicator, Avatar, SegmentedControl, StatTile, MeterBar, Badge, Button, IconButton, Popover, EmptyState, KeyHint, AIMark.
- Icons: [Lucide](https://lucide.dev) (ISC licence) across the product at a 1.5 stroke, including the AI mark (sparkles). The chart's drawing tools (lines, Fibonacci, rectangle, magnet, lock, hide, remove) use the TradingView-style icon set from [KLineChart Pro](https://github.com/klinecharts/pro) (Apache-2.0, licence in `src/chart/klinecharts-icons.LICENSE.txt`); TradingView's own icons are not licensed for reuse. Lucide icons beside them on the chart drop to a 1.25 stroke so the line weights match.
- Trading roles `--up`/`--down` map to Sandstone's `--success-fg`/`--danger-fg` (`src/index.css`). Chart colors are read from the tokens and redrawn when the theme changes.

## AI engine
- **Built-in (default, offline):** a deterministic intent parser in `src/ai.ts` (`localAI`).
- **Claude:** click **⚙︎ AI** in the top bar and paste an Anthropic API key. Free-form prompts go to Claude (`llmAI`). Claude returns the same typed `Action` JSON (`src/actions.ts`), so it can only *propose* schema-valid actions, and every trade still needs your confirmation. If the API fails, the app falls back to the built-in parser. For production, move this call to a backend proxy so the key never reaches the browser.

## Features (modelled on Kite, Upstox Pro, Dhan, Sensibull, Opstra and Streak)
- Watchlist with search, a quick B/S order ticket, and Intraday (MIS) or Delivery (CNC) product
- Live candlestick chart (lightweight-charts) with a 20-period SMA
- Option chain with expiry selector (NIFTY weekly on Tuesdays), OI and OI-change bars, IV, delta, ITM shading, PCR, and one-click B/S into the strategy builder
- Strategy builder with 10 templates, editable legs, expiry plus T+0 payoff chart, max profit/loss, breakevens, POP, net credit/debit, combined Greeks, and margin estimate
- Orders: market/limit, working limit orders, cancel, rejected orders with reasons
- Positions with live P&L, per-position exit, and square-off-all
- GTT triggers and price alerts
- Heatmap and a top bar showing index tickers, day P&L, available funds, and margin used
- SPAN-like portfolio margin: worst loss across ±8% scenarios plus exposure margin, with a benefit for hedged legs

## Contract specs used (NSE, 2026)
NIFTY lot 65 (step 50), BANKNIFTY lot 30 (step 100, monthly expiry only in reality; weekly here for the demo). Brokerage is ₹20 or 0.03% per order, whichever is lower.

## ⚠️ Simulation
Prices are a random-walk simulator, and options are priced with Black-Scholes using a skewed IV. No real orders are placed. To go live, replace `market.ts` and `store.place()` with a broker API (Zerodha Kite Connect, Upstox, Dhan or Fyers). Every AI action already passes through one typed dispatcher (`store.run`), so that is the single integration point. Not investment advice.

## Files
`src/market.ts` instruments, simulator, Black-Scholes, chain, strategies · `src/store.ts` state, OMS, margin, GTT · `src/ai.ts` prompt → actions · `src/App.tsx` layout, copilot, panels · `Chart.tsx`, `Chain.tsx`, `Strategy.tsx`
