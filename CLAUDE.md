# Service Cost Model

Browser-only React app: build a cost formula on a node canvas, test it, and export it to Excel as a live formula.
No backend. Owner is new to GitHub, so explain git and GitHub steps in plain language.

- User docs: `docs/USER_GUIDE.md`. Decisions and their reasons: `docs/DESIGN_NOTES.md`. Read the design notes
  before changing calculation, export or storage behaviour.
- Repo: https://github.com/tkdaymond/service-cost-model (public). Default branch `main`.

## Commands

```bash
npm install            # first time only
npm run dev            # dev server (Vite)
npm test               # Vitest unit tests
npx tsc -p .           # type-check
npm run build:share    # single self-contained file: share/Service Cost Model.html
```

Write a sample workbook for checking in Excel: `EXPORT_PATH=<short path>.xlsx npx vitest run scripts`.

## Code map

| File | Role |
|---|---|
| `src/compiler.ts` | Graph → expression tree; validation; formula printing (readable/Excel); evaluation; `excelRound`. |
| `src/nodeSpec.ts` | Input handle ids per node type. Shared contract with the compiler and saved files. |
| `src/excelNames.ts` | Display name → legal, unique Excel defined name. |
| `src/exportXlsx.ts` | Builds the workbook (ExcelJS). Lazy-loaded in the normal build. |
| `src/modelFile.ts` | `.costmodel.json` import/export and validation. |
| `src/store.ts` | Zustand store: model, selection, undo/redo, save (localStorage), toasts. |
| `src/diagnostics.ts` | Compiles on every change; per-node errors/values; `formatValue`. |
| `src/defaults.ts` | Default fields and the default graph. |
| `src/components/` | Header, LeftPanel, Canvas, CanvasNodes, RightPanel, inputs. |

## Rules

- All model changes go through store actions that call `commit` (records undo). Pass an edit key for text inputs
  so typing coalesces into one undo step.
- Displayed numbers must match Excel: format through `formatValue`, which rounds with `excelRound`.
- Changing handle ids or the model shape affects saved `.costmodel.json` files. Bump `VERSION` in
  `src/modelFile.ts` and keep older files loading.
- Add or update tests in `src/*.test.ts` for compiler, naming, export or file-format changes.
- Match the existing style: plain CSS in `src/styles.css` with the variables at the top, short comments that
  explain *why*.

## Releasing

1. Commit and push to `main`. Git identity is set in this repo's config (tkdaymond).
2. Bump `version` in `package.json`: `npm version X.Y.Z --no-git-tag-version`. Commit and push.
3. `npm run build:share`, then copy the output to `share/Service-Cost-Model.html` (a hyphenated name, because
   GitHub turns spaces in asset names into dots).
4. `gh release create vX.Y.Z share/Service-Cost-Model.html --target main --title "Service Cost Model vX.Y.Z"`,
   with notes that include how to open the file. Delete the hyphenated copy afterwards.
5. Check the upload with `gh release download` and a checksum comparison.

The README's download link points at `/releases/latest`, so it needs no change per release.

## Verification gotchas (Windows)

- Excel COM (`New-Object -ComObject Excel.Application`) can't open paths over 218 characters, and Windows
  PowerShell can't use paths over 260. Write test files to a short temp path.
- The Claude browser pane can't open `file://` pages. To test the single-file build as users run it, drive Edge
  with `playwright-core` (`chromium.launch({ channel: 'msedge' })`), installed in a temp folder, not the project.
- After headless Edge runs, stop only the Edge processes started with your own `--user-data-dir`, not the
  user's browser.
