const endpoint = `${process.env.INTERNAL_APP_URL || 'http://web:3000'}/api/jobs/run`;
if (!process.env.JOBS_SECRET || process.env.JOBS_SECRET.length < 24) throw new Error('Set JOBS_SECRET to at least 24 random characters.');
let stopped = false;
process.on('SIGTERM', () => { stopped = true; });
while (!stopped) {
  try {
    const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${process.env.JOBS_SECRET}` }, signal: AbortSignal.timeout(65000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    console.log(JSON.stringify({ event: 'worker.heartbeat', time: new Date().toISOString(), ...await response.json() }));
  } catch (error) { console.error(JSON.stringify({ event: 'worker.failure', message: error.message })); }
  await new Promise(resolve => setTimeout(resolve, 30000));
}
