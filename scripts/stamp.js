// Writes the current git commit into src/buildStamp.json so the app can show which version it is running.
// Run automatically by `npm run ota`.
const { execSync } = require('child_process');
const fs = require('fs');
const run = (c) => { try { return execSync(c).toString().trim(); } catch (e) { return ''; } };
const dirty = run('git status --porcelain -- src') ? ' (+edits)' : '';
const stamp = { commit: run('git rev-parse --short HEAD') + dirty, subject: run('git log -1 --pretty=%s'), stampedAt: new Date().toISOString() };
fs.writeFileSync(require('path').join(__dirname, '..', 'src', 'buildStamp.json'), JSON.stringify(stamp, null, 2) + '\n');
console.log('Stamped', stamp.commit, '-', stamp.subject);
