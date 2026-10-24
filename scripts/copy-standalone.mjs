import { copyFileSync, statSync } from 'node:fs';

const source = 'dist/index.html';
const target = 'discvault_stage3.html';

copyFileSync(source, target);

const { size } = statSync(target);
console.log(`Standalone build: ${target} (${(size / 1024).toFixed(1)} kB)`);
