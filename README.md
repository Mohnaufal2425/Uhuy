# GOLDLOG — Capital Simulation Studio

A pure "what-if" capital growth simulator. No trade history, no account
data — just scenarios you define, run, and compare.
Plain HTML/CSS/JavaScript. No build step, no framework.

## Run

1. Open this folder in VS Code.
2. Right-click `index.html` → **Open with Live Server**.
3. Needs internet once to load Google Fonts and Chart.js from CDN.

## Structure

```
index.html          Page markup
css/style.css        Styling (dark trading-terminal theme, gold accent)
js/simulation.js      Core simulation logic + format helpers + rendering
js/app.js             Scenario builder UI: add/remove cards, run, wiring
```

## How it works

1. **Scenario Builder** — add as many scenarios as you want (e.g.
   "Conservative", "Aggressive"). Each has its own starting capital,
   number of days, win rate, and daily profit/loss ranges.
2. Click **Run All Simulations** — each scenario runs one day-by-day
   random walk (compounding: each day's result is applied to the current
   balance, not the starting capital).
3. **Comparison** — a table and an overlaid chart show every scenario's
   final balance, net change, growth %, and lowest balance reached side
   by side.
4. **Day-by-Day Detail** — pick any scenario from the dropdown to see its
   full daily table.

Re-running generates new random outcomes each time (win/loss days and
exact amounts are randomized within the ranges you set), so results will
differ between runs — that's expected. Run it a few times to get a feel
for the range of outcomes your assumptions produce.

## Notes

- This is a what-if projection tool based on the numbers you provide, not
  a prediction of actual trading results or financial advice.
- Up to 6 scenarios get distinct chart colors; adding more will reuse
  colors.
- Nothing is saved between page reloads — it's a scratch pad, not a
  tracker. If you want persistence later (e.g. saving named scenario
  presets), that's a natural next step to add.
