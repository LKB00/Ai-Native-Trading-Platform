# Research summary: what Indian traders and investors need (Oct 2026)

Three research passes fed this product: trader and investor personas, charting and chart trading, and AI-native UX together with SEBI rules. The full source lists are in the session that produced this file. The key URLs are listed at the end.

## The big insight
Traders juggle **3 to 9 separate apps**: a broker, Sensibull or Opstra for options, Chartink for scans, Streak for algos, Screener.in for fundamentals, and a journal. **SEBI's FY25 study found that 91% of individual F&O traders lost money**, and loss rates were worse for experienced traders. The opportunity is one terminal that combines execution, options analytics, scans, risk controls and a journal, with an AI that is grounded in real data and only ever drafts actions.

## Personas and what each needs
| Persona | Daily loop | Must-haves |
|---|---|---|
| Intraday / scalper | CPR and previous-day high/low before the open → scalp from chart and option chain → review charges | Chart trading, SL and target attached at entry, trailing SL, hotkeys, one-click exit all, daily max-loss kill switch, position sizing |
| Swing trader | Evening scans, sector rotation and relative strength → set GTTs → weekend review | End-of-day scans (52-week high, breakouts, volume shockers), sector heatmap, relative strength vs Nifty, GTT/OCO with trailing, portfolio heat |
| Options seller and buyer | IV and OI before the open → build strategy → adjust legs → review Greeks | Option chain with Greeks, PCR, max pain and OI build-up; strategy builder with what-if by date and IV; basket with hedges first; expiry-day ELM warning |
| Long-term investor | Monthly SIP, quarterly results, screens | Fundamental screener (PE, ROE, growth, debt), holdings with allocation and P&L, stock/ETF SIP |
| Chart trader | Charts all day | Timeframes, indicators (VWAP, EMA 9/20/50/200, SuperTrend, RSI, MACD, Bollinger Bands, pivots/CPR), drawings, price alerts on the chart, shortcuts |
| Algo / rules trader | Build rule → backtest → paper → live | Rule scans, paper mode, kill switch; static-IP and algo-ID compliance (SEBI framework, Apr 2026) |
| Everyone | — | An auto-journal with charges, win rate, expectancy, a calendar heatmap and behaviour flags (overtrading, revenge trading) |

## Rules this product follows
- **NSE weekly expiry is NIFTY only, on Tuesday.** SENSEX weekly is on BSE, on Thursday. BANKNIFTY and FINNIFTY are monthly only, expiring on the last Tuesday. Lots: NIFTY 65, BANKNIFTY 30.
- Option premium is collected upfront. Short options carry an extra 2% ELM on expiry day. The calendar-spread margin benefit is removed on expiry day.
- Freeze quantity: NIFTY 1,800, BANKNIFTY 600. Larger orders are sliced automatically.
- STT from 1 Apr 2026: futures 0.05% and options 0.15% of premium, both on the sell side. Equity delivery 0.1% on both sides. Equity intraday 0.025% on the sell side. Plus exchange fees, SEBI fee, stamp duty and 18% GST.
- Market hours are 9:15 to 15:30 IST, with pre-open at 9:00. MIS auto square-off is around 15:25.
- **The AI gives educational and analytical output only. It never makes personalised buy or sell recommendations**, because that requires SEBI RIA or RA registration. AI content is labelled. Every AI action is logged.
- Every number comes from the data engine and is never invented by the model. The AI produces structured actions or filters that are validated, previewed and confirmed.

## Chart trading patterns adopted
These come from Kite Trade From Charts, TradingView, Dhan and Sahi:
- Order, SL and target lines that you drag to modify.
- A position line showing live P&L, with exit and reverse.
- Live R:R while dragging.
- Fill markers on the candles.
- A price alert line.
- Shortcuts: B/S, Shift+B/S, Alt+A, Alt+H, digits change the timeframe, "/" opens the copilot, ⌘K.

## Key sources
- SEBI FY25 F&O study: https://www.business-standard.com/amp/markets/news/net-losses-of-traders-in-fo-widens-in-fy25-sebi-study-125070701221_1.html
- Kite Trade From Charts: https://zerodha.com/z-connect/featured/introducing-trade-from-charts-tfc-at-zerodha
- TradingView brackets from the chart: https://www.tradingview.com/blog/en/brackets-from-the-chart-28634
- Dhan P&L Exit and Kill Switch: https://dhan.co/support/orders-and-positions/pandl-exit/how-does-set-p-and-l-exit-work/
- SEBI F&O measures: https://zerodha.com/z-connect/business-updates/sebis-new-rules-for-index-derivatives-heres-whats-changing
- Retail algo framework: https://fyers.in/notice-board/new-sebi-framework-for-retail-algo-trading-from-april-01-2026/
- STT 2026: https://www.incorpx.io/blog/stt-rate-hike-options-futures-2026
- Expiry day swap: https://www.business-standard.com/amp/markets/news/nse-bids-adieu-to-thursday-expiry-as-dates-swap-come-into-effect-explained-125082800635_1.html
- Zerodha square-off times: https://zerodha.com/z-connect/updates/changes-to-the-auto-square-off-timings-for-equity-and-fo
- Composer "trade with AI" (DSL pattern): https://help.composer.trade/article/108-create-with-ai
- Robinhood Cortex Digests: https://robinhood.com/us/en/newsroom/digests-by-robinhood-cortex-uk
- Lightweight Charts v5 panes: https://tradingview.github.io/lightweight-charts/tutorials/how_to/panes

Caveats: some 2026 facts come from secondary sources. These are the Budget 2026 STT rates, the exact square-off times and the freeze limits. Check them against SEBI and NSE circulars before treating them as compliance specifications.
