const fs = require('node:fs');
const crypto = require('node:crypto');
let env = fs.readFileSync('.env', 'utf8');
if (!/^JOBS_SECRET=.+$/m.test(env)) env += '\nJOBS_SECRET=' + crypto.randomBytes(32).toString('hex') + '\n';
if (!/^ENABLE_EXTERNAL_IDENTITY=/m.test(env)) env += 'ENABLE_EXTERNAL_IDENTITY=false\n';
fs.writeFileSync('.env', env);
console.log('Local worker secret configured; external identity remains disabled.');
