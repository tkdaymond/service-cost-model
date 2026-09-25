// Writes the default model to an .xlsx so it can be checked in real Excel.
// Run with: EXPORT_PATH=out.xlsx npx vitest run scripts
import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { defaultModel } from '../src/defaults';
import { buildWorkbook } from '../src/exportXlsx';

it.runIf(process.env.EXPORT_PATH)('writes sample workbook', async () => {
  const buffer = await buildWorkbook(defaultModel()).xlsx.writeBuffer();
  writeFileSync(process.env.EXPORT_PATH!, Buffer.from(buffer));
});
