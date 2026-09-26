// prepack/postpack: ship ../../bob-kit inside the tarball as <pkg>/bob-kit (findKitDir looks there first).
import { cpSync, rmSync } from 'node:fs';

const dest = new URL('../bob-kit', import.meta.url);
if (process.argv[2] === 'copy') cpSync(new URL('../../../bob-kit', import.meta.url), dest, { recursive: true });
else rmSync(dest, { recursive: true, force: true });
