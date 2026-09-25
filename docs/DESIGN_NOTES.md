# Design Notes

The decisions behind Service Cost Model, and why they were made. Read this before changing how the app
calculates, exports or stores models. For how to use the app, see the [User Guide](USER_GUIDE.md).

## Goal

Recreate a mockup of a visual "Service Cost Model" editor (fields on the left, a node canvas in the middle,
settings on the right) as a simple app that turns the canvas into a formula and exports it to Excel.
The mockup's formula is the default model:

```
Total = (Hours × Hourly Rate + Material Cost) × (1 + Overhead Rate) ÷ (1 − Profit Margin)
```

## Decisions

### 1. Browser-only, no server

The app is static HTML and JavaScript. There is no backend, login or database.

- **Why:** nothing needs to be shared live between users, and it keeps running and sharing trivial.
- **Consequence:** storage is per browser (see decision 9), and models move between people as files.

### 2. Technology

| Need | Choice | Why |
|---|---|---|
| UI | React 19 + TypeScript | Standard, typed. |
| Canvas | `@xyflow/react` (React Flow 12) | Dragging, connecting, zoom and pan out of the box; most of the canvas work. |
| State | `zustand` | Small store with easy access outside React (keyboard shortcuts, drag handlers). |
| Excel | `exceljs` | Writes real formulas, defined names, number formats and data validation. |
| Icons | `lucide-react` | Consistent icon set that covers the mockup's icons. |
| Build and tests | Vite 8, Vitest | Fast; the single-file build uses `vite-plugin-singlefile`. |

The React Flow attribution link on the canvas is left visible, as its authors request.

### 3. XLSX only, no CSV

CSV was considered and dropped. CSV can't hold named cells, number formats or validation, so the formula
would have to use raw cell addresses like `B2*B3`, and it would lose its currency and percent formatting.

### 4. Percentages: markup vs margin

The mockup had one "Apply Percentage" node fed by both Overhead Rate and Profit Margin. That is ambiguous and,
in the most obvious readings, wrong for pricing:

| Method on a $1,000 cost, 15% overhead, 20% profit | Result | Profit share of price |
|---|---|---|
| Additive: 1000 × (1 + 0.15 + 0.20) | $1,350.00 | about 15% |
| Compounding markup: 1000 × 1.15 × 1.20 | $1,380.00 | 16.7% |
| **Compounding, profit as true margin: 1000 × 1.15 ÷ 0.80** | **$1,437.50** | **20%** |

Decision:

- **Compound, in canvas order.** Overhead is charged on direct cost, and profit is earned on the fully loaded
  cost.
- **Split the node in two** (Apply Markup, then Apply Margin), so the order is visible on the canvas.
- **Each percentage node has a mode:** *Markup* is `Base × (1 + Rate)`, *Margin* is `Base ÷ (1 − Rate)`.
  "Profit Margin" in finance means a share of the price, so it defaults to margin.
- **Guard margins of 100% or more**: they divide by zero or give a negative price. The app flags them, and the
  exported workbook adds a data-validation rule of 0 to 0.9999 on cells that feed a margin directly.

### 5. Custom fields, preloaded with the mockup's

Estimated at about +25–35% effort over a fixed list, and chosen because the app's purpose is *defining*
calculations. With fixed fields it could only build variations of one formula. The nine mockup fields are
loaded as the default template.

### 6. Service Level is a number

The mockup describes Service Level as "e.g. Standard, Premium", a pick-list. Pick-lists need lookup logic
(IF or XLOOKUP) in the formula, which is out of scope for the MVP. It is a number used as a multiplier instead
(1.0 Standard, 1.25 Premium).

### 7. Extra building blocks beyond the mockup

Min, Max, Round and Constant were added because they were cheap and cover common pricing needs: a minimum
charge (`MAX`), a price cap (`MIN`), and rounding a quote.

## How the formula is built

1. **Compile** (`src/compiler.ts`): starting from the result node, walk connections backwards into an expression
   tree. Errors are collected per node rather than stopping at the first, so the canvas can highlight all of them.
2. **Input order:** for Add, Multiply, Min and Max, inputs are ordered by their node's position on the canvas,
   left to right, so the formula text matches what you see. Order doesn't change the answer for these. For
   operations where order matters (Subtract, Divide, percentages) there are separate labelled handles (A/B,
   Base/Rate) instead of relying on position.
3. **Print:** the tree is printed as readable text (`×`, `÷`, display names) or as an Excel formula (Excel
   names). Parentheses are added only where precedence requires them (for example `a-(b-c)` but `a-b-c`).
   Markup and margin are rewritten to plain arithmetic before printing.
4. **Evaluate:** the same tree is evaluated in JavaScript for Test mode and the Preview.

**The handle ids are a contract** between the canvas and the compiler. They are defined once in
`src/nodeSpec.ts` (`in`, `a`, `b`, `base`, `rate`; sources `out` and `out-right`). Change them only there, and
note that saved model files contain them.

An operator's kind can't be changed after it is placed (for example Add to Subtract), because the handles differ
and existing connections would point at handles that no longer exist.

## Excel export

(`src/exportXlsx.ts`)

- **Named cells, not addresses.** Each input value cell is an Excel *defined name*, so the exported formula is
  readable (`Hours*Hourly_Rate`) and survives rows being moved.
- **Only fields the formula uses** are exported, so the sheet stays short.
- **Name rules** (`src/excelNames.ts`): spaces and symbols become `_`, `%` becomes `Pct`, a leading digit gets a
  `_` prefix, and names Excel would read as a cell reference get a `_` suffix. That covers A1-style (`ABC1`,
  `Tax2024`, since TAX is a real column) and R1C1-style (`R`, `C`, `R1C1`), plus TRUE and FALSE. Names are unique
  ignoring case (`Rate`, `rate_2`).
- The result cell stores both the formula and its computed value, and the workbook is flagged to recalculate
  fully on open. Viewers that don't calculate still see a number, and Excel always recalculates.

### Rounding must match Excel

Excel's ROUND rounds halves away from zero, and it treats values like 1.005 as exact halves even though they
aren't exact in binary. `excelRound` in `src/compiler.ts` reproduces this with a tiny nudge (`+1e-9` on the
scaled value).

The same function is used for **display**. Before this, the app showed 7,834.375 as **$7,834.37** (the
browser's own formatting) while Excel showed **$7,834.38**. A test pins this down.

## State, undo and storage

(`src/store.ts`)

- **Undo history** stores whole model snapshots (up to 100).
- **Consecutive edits to the same input share one undo step**, using an "edit key" such as
  `field:<id>:name`. Without this, every keystroke would be its own undo step.
- Canvas moves record one undo step when a drag starts, not one per frame.
- The **result node can't be deleted** (`deletable: false`). This is also enforced when importing files.
- **Save** writes to `localStorage` (key `service-cost-model:v1`). That is per browser and per origin: the same
  HTML file opened in another browser, or from another folder or URL, won't see it.
- **Model files** (`src/modelFile.ts`) wrap the model as `{ format: "service-cost-model", version: 1, model }`.
  Import checks the structure and rejects files with a *newer* version number. Graph problems in an imported
  model (such as missing inputs) are left for the normal validation to show.

## Sharing and distribution

- **Single HTML file.** A normal Vite build can't be opened by double-clicking, because browsers block its
  separate script files on `file://` pages. `npm run build:share` inlines everything into one ~1.4 MB file.
- In the normal build, the Excel library (about two-thirds of the code) is loaded only when you click Export.
  The single-file build inlines it.
- The only external reference is the Inter web font from Google Fonts. Offline, the system font is used instead.
- **Public GitHub repository.** On a personal GitHub account, the only way to give everyone read-only access is a
  public repository; collaborators on a personal account's private repo always get write access. The owner chose
  public, with commits authored under their personal email (visible in the history).
- **Releases** carry the HTML file as `Service-Cost-Model.html`, hyphenated because GitHub turns spaces in asset
  names into dots.

## How it was verified

- **Unit tests** (Vitest) cover the compiler, precedence and parentheses, rounding, Excel naming, and model files.
- **Real Excel:** exported workbooks were opened in Excel through COM automation to confirm the defined names
  resolve, the formula calculates ($6,612.50 for the default model), it recalculates when an input changes, and
  the margin validation is present.
- **Real browser, opened from disk:** the single-file build was driven in Microsoft Edge with Playwright: export
  an XLSX, download a model, import an edited model, reject an invalid file, and check that saving survives a reload.

## Known limitations and ideas

- One saved model per browser; there is no model library.
- No pick-list (text) fields or lookup tables (see decision 6).
- An operator's kind can't be changed after placing it.
- Desktop only (minimum width 1100 px). No dark mode.
- Numbers are displayed in US format and currency is USD only.
