# Edgebook

A personal forecasting desk for Polymarket prediction markets, built on the Nansen API.

Live app: https://edgebook-mauve.vercel.app

Most tools around prediction markets show you a market. Edgebook scores whether you beat it. You log the probability you believe before a market resolves, Edgebook freezes the market price and the onchain crowd at that exact moment through the Nansen API, and later it measures your Brier score against the market's over the same calls. A positive edge means you were righter than the price.

The distinction matters. A market's own portfolio page tells you your profit. It cannot tell you whether your profit came from skill or from luck, and it cannot tell you the price you were beating at the moment you decided. Edgebook captures that second, then keeps score.

## Why this is not just a viewer

The app owns state that exists nowhere else: your calls, the reasoning behind each one, and an immutable snapshot of the market at the instant you committed. Nansen shows a market. Polymarket shows your profit. Neither shows whether your forecasts beat the price. That report is the output Edgebook produces, and it is built from data you generate by using it.

The core loop: open a live market, log a probability, come back to see whether you had an edge.

## Features

### Markets

Live Polymarket markets from the Nansen prediction-market screener, with the implied probability, 24h volume, and trader counts. A live-fact strip highlights the biggest 24h move, your open calls, and the busiest category. Category chips filter the table client side, and the page has real loading, empty, and error states.

### Market detail

The one-hour candle price history, a snapshot of the current market state, and the Log a Call form. When you commit a call, Edgebook freezes the implied price, liquidity, volume, trader count, and the top holder sides to your browser alongside your stated probability. That snapshot is what makes later scoring honest, because a moving market cannot rewrite your history.

### Journal

Every call you have logged, with the market at commit, your call, the gap between them, and the outcome once you record it. Open calls sort first. You mark outcomes yourself with a Yes or No control, and any mistake is reversible with Reopen.

### Edge report

The calibration curve, the Brier scorecard, and your edge versus the market. Lower Brier is better. Your edge is the market's Brier score minus yours across the same settled calls. The calibration chart plots what you predicted against what actually happened, so overconfidence at the high end of your range is visible rather than hidden.

## What the data means

- **Implied probability**: the mean of the best bid and best ask for a market, or the last trade price when a book is not available. It is the market's own forecast.
- **Your call**: the probability you entered, 0 to 100.
- **Gap**: your call minus the market at commit, in points.
- **Brier score**: the mean squared error of a set of forecasts against the outcomes. Lower is better. 0 is perfect.
- **Edge**: the market's Brier score minus yours. Positive means your calls were more accurate than the price.

## Stack

- Next.js 16, App Router
- React 19
- Tailwind v4
- TypeScript 5
- vitest
- lucide-react
- Deployed on Vercel

No database, no accounts, no wallet. Calls are stored in your browser only.

## Running it locally in under 10 minutes

1. Clone the repository and open the folder.

2. Install dependencies:

   ```
   npm install
   ```

3. Create a file named `.env.local` in the project root, with this single line, using your own Nansen API key:

   ```
   NANSEN_API_KEY=your_key_here
   ```

   Get a free key at https://app.nansen.ai/api. The free tier covers the calls this app makes.

4. Start the development server:

   ```
   npm run dev
   ```

5. Open http://localhost:3000.

The root route redirects to `/markets`.

## Environment variables

| Name | Required | Where it is used |
| --- | --- | --- |
| `NANSEN_API_KEY` | Yes | Server routes only, under `app/api`. Never exposed to the browser. |

The key is read only inside server routes and is never returned in a response body or bundled into client JavaScript. No `NEXT_PUBLIC_` variable is used anywhere.

## Available scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run build` | Create a production build |
| `npm run start` | Serve the production build |
| `npm test` | Run the unit test suites with vitest |
| `npm run lint` | Run ESLint |

## Project structure

```
app/
  page.tsx                    Root route, redirects to /markets
  layout.tsx                  Shell: fonts, background, side rail
  globals.css                 Design tokens and background layer
  markets/page.tsx            Discover surface: fact strip, chips, table
  market/[id]/page.tsx        Detail and the Log a Call form
  journal/page.tsx            The call record with manual settle
  profile/page.tsx            The edge report
  components/
    app-rail.tsx              Primary navigation
    app-background.tsx        The design background layer
  api/
    markets/route.ts          Server route for the screener
    market/[id]/route.ts      Server route for one market, its candles, and its holders
lib/
  calls.ts                    The browser calls store
  scoring.ts                  Brier, edge, and calibration math
  format.ts                   Formatting helpers
  *.test.ts                   Unit tests
DESIGN.md                     The design source of truth
design-system/LEDGER.md       The project design history
```

## Testing

```
npm test
```

The suites cover the formatting helpers, the calls store (including malformed data and the settle and reopen paths), and the scoring math. All functions that consume market or call data tolerate missing and malformed fields rather than throwing.

## Attribution

Market data in this app comes from the Nansen API. Powered by Nansen API.

## Notes

- Calls are stored in `localStorage` under the key `edgebook.calls`.
- Outcomes are recorded manually in the Journal. There is no automatic settlement detection.
- The design system and its tokens are documented in `DESIGN.md`.
