# tarely — digital inventory demo

A grocery inventory dashboard with four independent virtual weighing platforms. All readings, alerts, and purchasing requests are simulated. No hardware, account, backend, secrets, external inventory integration, email, or real ordering is required.

## Try it

- Drag any circular gross-weight dial, use the adjacent number field, or use + / −.
- On a focused dial, arrow keys change gross weight by 0.1 kg; Page Up/Down changes it by 1 kg; Home/End selects its bounds.
- Net inventory is `max(gross weight − saved empty-bin tare, 0)`. Gross weight is bounded by zero and tare plus net capacity.
- A bin is low when net inventory is **at or below** its low-stock threshold. There is one alert for each transition into low stock, with no repeated alerts while it stays low.
- Enable **Simulate auto-reorder**, then choose **Busy afternoon**, to create DEMO top-up requests. This never places an actual order. A pending request for a bin is deduplicated until a simulated refill fulfills it.
- **Simulate refill** fills a bin to net capacity, clears its low state, and logs the refill. **Refill all** provides the fully stocked presentation preset. Repeated clicks at the same state are idempotent.
- Configure each item's name, empty-bin tare, net capacity, low-stock threshold, and monthly stock weight. Saving immediately recalculates stock state. Monthly stock is a user-set reference amount, never treated as consumption or a forecast.
- **Reset demo** restores all defaults, activity, requests, and settings. Refreshing the page also starts a new session. State exists only in the current tab's memory.

The dashboard follows the grocery direction of the supplied Tarely pitch. It uses the brand's ivory, teal, green, and sage palette with system font fallbacks; no private deck, script, proprietary fonts, pricing, or unvalidated hardware performance claims are included.

## Run locally

Requires Node.js 22 or newer.

```sh
npm ci
npm run build
npm run dev
```

Open `http://localhost:4173`. The production build copies the static application into `dist/`; it has no runtime dependencies.

## Verify

```sh
npm test
npx playwright install chromium
npm run test:e2e
```

When Chromium is already installed, set `CHROMIUM_PATH=/path/to/chromium` instead of downloading a browser. For a deployed site, set `BASE_URL` to its URL; the same browser tests will run against it without starting a local server.

The tests cover tare math, input bounds, inclusive threshold crossings, settings changes, independent dials, simulated request deduplication, repeated actions, refills, reset, mobile layouts, keyboard interaction, and automated WCAG A/AA accessibility checks. Automated accessibility checks complement, rather than replace, manual visual and keyboard review.

## Deploy

Host `dist/` as static files. On Vercel, use `npm run build`, output directory `dist`, and Framework Preset `Other`. There are no environment variables or paid service requirements.

Source files: `src/inventory.js` holds the inventory rules; `src/app.js` connects controls to the dashboard; `src/styles.css` defines responsive styling. No user or supplier data is transmitted by the demo.
