const base = process.env.INTERNAL_APP_URL || 'http://web:3000';
let failures = 0;
let alerted = false;
while (true) {
  try {
    const response = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Health check returned ${response.status}`);
    if (failures) console.log(JSON.stringify({ event: 'service.recovered', time: new Date().toISOString() }));
    failures = 0; alerted = false;
  } catch (error) {
    failures++;
    const event = { event: 'service.unhealthy', failures, message: error.message, time: new Date().toISOString() };
    console.error(JSON.stringify(event));
    if (failures >= 3 && !alerted && process.env.ALERT_WEBHOOK_URL) {
      try { const response = await fetch(process.env.ALERT_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event), signal: AbortSignal.timeout(10000) }); alerted = response.ok; }
      catch { console.error('Alert delivery failed'); }
    }
  }
  await new Promise(resolve => setTimeout(resolve, 30000));
}
