// Gives the single-file build a friendly name for sending to colleagues.
import { renameSync, rmSync } from 'node:fs';

const target = 'share/Service Cost Model.html';
rmSync(target, { force: true });
renameSync('share/index.html', target);
console.log(`Created ${target}`);
