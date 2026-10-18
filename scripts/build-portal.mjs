import './prepare-portal.mjs';
import {spawnSync} from 'node:child_process';
const r=spawnSync(process.execPath,['scripts/run-framework.mjs','build'],{stdio:'inherit',env:process.env});
process.exit(r.status??1);
