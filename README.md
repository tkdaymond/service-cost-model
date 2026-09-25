# Service Cost Model

A browser app for building a cost formula visually and exporting it to Excel as a live formula.

## Run

```bash
npm install
npm run dev
```

Then open http://localhost:5173. `npm test` runs the formula compiler tests; `npm run build` creates a static site in `dist/`.

## Share with colleagues

```bash
npm run build:share
```

This creates `share/Service Cost Model.html`, a single self-contained file. Send it by email or put it on a shared
drive; colleagues double-click it to open it in Chrome or Edge. No install or internet connection is needed
(offline, it uses the system font instead of Inter).

To pass a model back and forth, use the header buttons: **Download model** saves a `.costmodel.json` file and
**Open** loads one. Save only keeps a model in the current browser.

## How it works

- **Canvas** (`src/components/Canvas.tsx`): React Flow graph of fields, operators, functions and one result node.
- **Compiler** (`src/compiler.ts`): walks the graph back from the result node into an expression tree, validates it
  (missing inputs, loops, single-input handles), prints it as readable text or an Excel formula, and evaluates it.
- **Percentages**: *Markup* is `Base × (1 + Rate)` (overhead); *Margin* is `Base ÷ (1 − Rate)` (profit as a share of price).
- **Excel names** (`src/excelNames.ts`): field names become legal, unique Excel defined names (`Hourly Rate` → `Hourly_Rate`),
  avoiding names Excel would read as cell references.
- **Export** (`src/exportXlsx.ts`): one "Model" sheet with a named, yellow input cell per field used, and the result cell
  containing the live formula. Margin-rate inputs get a 0–<100% validation rule.
- **Save** stores the model in the browser's localStorage.

To regenerate a sample workbook for checking in Excel: `EXPORT_PATH=sample.xlsx npx vitest run scripts`.
