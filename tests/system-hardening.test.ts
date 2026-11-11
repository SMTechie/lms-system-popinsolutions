import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PrismaClient } from '@prisma/client';
import { createAuthToken, hashPassword } from '../src/server/auth';
import { defaultPortalData } from '../src/server/portalData';
import { getOperationsData } from '../src/server/operations';
import { digest } from '../src/server/accountSecurity';

test('production foundations enforce ownership and preserve concurrent writes', async t => {
  assert.ok(new URL(process.env.DATABASE_URL || '').pathname.endsWith('_test'));
  const db = new PrismaClient(); t.after(() => db.$disconnect());
  const accounts: Record<string, any> = {};
  for (const [name, role] of [['admin', 'ADMIN'], ['parent1', 'PARENT'], ['parent2', 'PARENT'], ['teacher', 'TEACHER']]) {
    const email = `hardening-${name}@example.test`;
    const user = await db.user.upsert({ where: { email }, update: {}, create: { email, role, passwordHash: await hashPassword('test-password-123'), name } });
    accounts[name] = { ...user, token: await createAuthToken({ sub: user.id, email, role }) };
  }
  const request = async (name: string, path: string, method = 'GET', body?: unknown) => {
    const response = await fetch(`${process.env.PORTAL_TEST_URL || 'http://127.0.0.1:3100'}/api${path}`, { method, headers: { Authorization: `Bearer ${accounts[name].token}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: (response.headers.get('content-type') || '').includes('json') ? await response.json() : await response.text() };
  };
  const portal = defaultPortalData(); portal.parent.guardianEmail = accounts.parent1.email;
  await db.setting.upsert({ where: { key: 'portal-data' }, create: { key: 'portal-data', value: portal }, update: { value: portal } });

  await t.test('private settings and operational routes deny all non-admin roles', async () => {
    for (const role of ['parent1', 'teacher']) for (const path of ['/settings', '/settings/portal-data', '/inventory/items', '/tickets', '/integrations/marketing']) {
      assert.ok([401, 403].includes((await request(role, path)).status), `${role} ${path}`);
    }
    assert.ok([401, 403].includes((await request('parent1', '/settings/portal-data', 'PUT', {})).status));
    assert.equal((await request('admin', '/settings')).status, 200);
  });
  await t.test('ticket and profile ownership is enforced', async () => {
    const created = await request('parent1', '/parent/tickets', 'POST', { title: 'Private question', description: 'Only this parent' });
    assert.equal(created.status, 201);
    assert.ok(!(await request('parent2', '/parent/tickets')).body.some((item: any) => item.id === created.body.id));
    assert.equal((await request('parent2', `/parent/tickets/${created.body.id}/replies`, 'POST', { message: 'forbidden' })).status, 404);
    await request('parent1', '/parent/profile', 'PATCH', { profile: { phone: '111' } });
    await request('parent2', '/parent/profile', 'PATCH', { profile: { phone: '222' } });
    assert.equal((await request('parent1', '/parent/profile')).body.profile.phone, '111');
  });
  await t.test('simultaneous replies both persist', async () => {
    const ticket = (await request('parent1', '/parent/tickets', 'POST', { title: 'Concurrent' })).body;
    const replies = await Promise.all(['one', 'two'].map(message => request('parent1', `/parent/tickets/${ticket.id}/replies`, 'POST', { message })));
    assert.ok(replies.every(r => r.status === 201));
    const saved = (await request('parent1', '/parent/tickets')).body.find((item: any) => item.id === ticket.id);
    assert.ok(saved.replies.some((r: any) => r.message === 'one') && saved.replies.some((r: any) => r.message === 'two'));
  });
  await t.test('checkout cannot oversell and follows one fulfilment workflow', async () => {
    const operations = await getOperationsData();
    const product = operations.store.products[0]; product.stockQuantity = 1; product.isActive = true; product.allowOnlinePurchase = true; product.basePrice = 50;
    await db.setting.upsert({ where: { key: 'operations' }, create: { key: 'operations', value: operations as any }, update: { value: operations as any } });
    const responses = await Promise.all(['parent1', 'parent2'].map(name => request(name, '/store/orders', 'POST', { paymentMethod: 'eft', items: [{ productId: product.id, quantity: 1 }] })));
    assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
    const winner = responses[0].status === 200 ? 'parent1' : 'parent2'; const loser = winner === 'parent1' ? 'parent2' : 'parent1';
    const order = responses.find(r => r.status === 200)!.body;
    assert.ok((await request(winner, '/parent/orders')).body.some((o: any) => o.id === order.id));
    assert.equal((await request(loser, `/store/orders/${order.id}`, 'PATCH', { status: 'CANCELLED' })).status, 409);
    assert.notEqual((await request(winner, `/parent/orders/${order.id}`, 'PATCH', { status: 'COLLECTED' })).status, 200);
    for (const status of ['PAID', 'PREPARING', 'READY_FOR_COLLECTION']) assert.equal((await request('admin', `/store/orders/${order.id}`, 'PATCH', { status, reference: `test-${order.id}` })).status, 200);
    assert.equal((await request(winner, `/parent/orders/${order.id}`, 'PATCH', { status: 'COLLECTED' })).status, 200);
    assert.equal((await request('admin', `/store/orders/${order.id}`, 'PATCH', { status: 'REFUNDED', reference: `refund-${order.id}` })).status, 200);
    assert.equal((await request('admin', `/store/orders/${order.id}`, 'PATCH', { status: 'REFUNDED', reference: 'again' })).status, 409);
    assert.equal((await getOperationsData()).store.products[0].stockQuantity, 1);
  });
  await t.test('documents validate content and require ownership', async () => {
    assert.equal((await request('parent1', '/documents', 'POST', { name: 'bad.pdf', contentBase64: Buffer.from('<script>bad</script>').toString('base64') })).status, 400);
    const upload = await request('parent1', '/documents', 'POST', { name: 'proof.pdf', contentBase64: Buffer.from('%PDF-1.4\n%%EOF').toString('base64') });
    assert.equal(upload.status, 201);
    assert.equal((await request('parent1', `/documents/${upload.body.id}`)).status, 200);
    assert.equal((await request('parent2', `/documents/${upload.body.id}`)).status, 404);
    assert.equal((await request('admin', `/documents/${upload.body.id}`)).status, 200);
  });
  await t.test('logout revokes the token at the server', async () => {
    assert.equal((await request('teacher', '/auth/me')).status, 200);
    assert.equal((await request('teacher', '/auth/logout', 'POST')).status, 200);
    assert.equal((await request('teacher', '/auth/me')).status, 401);
  });
  await t.test('scheduled delivery runs once and rejects an invalid worker secret', async () => {
    const audiences = (await request('admin', '/admin/communications')).body.audiences;
    const audience = audiences.find((item: any) => item.id === 'audience-all-families');
    const campaign = await request('admin', '/admin/communications/campaigns', 'POST', { title: 'Scheduled test', content: 'A scheduled notice', audienceId: audience.id, channels: ['APP'], scheduledFor: new Date(Date.now() - 60000).toISOString() });
    assert.equal(campaign.status, 201);
    const base = process.env.PORTAL_TEST_URL || 'http://127.0.0.1:3100';
    assert.equal((await fetch(`${base}/api/jobs/run`, { method: 'POST', headers: { Authorization: 'Bearer incorrect' } })).status, 401);
    const run = () => fetch(`${base}/api/jobs/run`, { method: 'POST', headers: { Authorization: `Bearer ${process.env.JOBS_SECRET}` } });
    assert.equal((await run()).status, 200);
    assert.equal((await (await run()).json()).processed, 0);
    const saved = (await request('admin', '/admin/communications')).body.campaigns.find((item: any) => item.id === campaign.body.id);
    assert.equal(saved.status, 'SENT'); assert.equal(saved.metrics.opened, 0);
  });
  await t.test('manual marking requires review, limits marks and gates publication', async () => {
    const assessment = await request('admin', '/teacher-assistant/assessments', 'POST', { name: 'Manual review', classIds: ['class-8a'], totalMarks: 5, questions: [{ questionNumber: '1', questionType: 'NUMERICAL', expectedAnswers: ['42'], marks: 5 }] });
    assert.equal(assessment.status, 201);
    const created = await request('admin', `/teacher-assistant/assessments/${assessment.body.id}/scripts`, 'POST', { scripts: [{ learnerId: 'learner-1', extractedText: '1. 42' }] });
    assert.equal(created.status, 201);
    const script = created.body.scripts[0]; assert.equal(script.suggestedTotal, 5); assert.equal(script.ocrConfidence, null);
    assert.equal((await request('admin', `/teacher-assistant/assessments/${assessment.body.id}/publish`, 'POST', { scriptIds: [script.id] })).status, 409);
    assert.equal((await request('admin', `/teacher-assistant/scripts/${script.id}/results`, 'PATCH', { results: [{ resultId: script.results[0].id, finalMarks: 6 }] })).status, 400);
    assert.equal((await request('admin', `/teacher-assistant/assessments/${assessment.body.id}/approve`, 'POST', { scriptIds: [script.id] })).status, 200);
    assert.equal((await request('admin', `/teacher-assistant/assessments/${assessment.body.id}/publish`, 'POST', { scriptIds: [script.id] })).status, 200);
  });
  await t.test('supplier records persist and require administration', async () => {
    assert.equal((await request('parent1', '/suppliers', 'POST', { name: 'Forbidden' })).status, 403);
    const created = await request('admin', '/suppliers', 'POST', { name: 'Test supplier', email: 'supplier@example.test' }); assert.equal(created.status, 200);
    assert.ok((await request('admin', '/suppliers')).body.some((row: any) => row.id === created.body.id));
    assert.equal((await request('admin', '/suppliers', 'POST', { ...created.body, active: false })).body.active, false);
  });
  await t.test('login uses a protected cookie and rate limits persist after failed requests', async () => {
    const base = process.env.PORTAL_TEST_URL || 'http://127.0.0.1:3100';
    const login = (password: string) => fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: accounts.parent2.email, password }) });
    const signedIn = await login('test-password-123'); assert.equal(signedIn.status, 200);
    assert.equal((await signedIn.json()).token, 'cookie');
    const cookieHeader = signedIn.headers.get('set-cookie') || '';
    assert.ok(cookieHeader.toLowerCase().includes('httponly'));
    const cookie = cookieHeader.split(';')[0];
    assert.equal((await fetch(`${base}/api/auth/me`, { headers: { Cookie: cookie } })).status, 200);
    assert.equal((await fetch(`${base}/api/parent/profile`, { method: 'PATCH', headers: { Cookie: cookie, Origin: 'https://untrusted.example', 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
    for (let i = 0; i < 14; i++) assert.equal((await login('incorrect')).status, 401);
    assert.equal((await login('incorrect')).status, 429);
  });
  await t.test('password reset tokens are one-use and revoke old sessions', async () => {
    const token = 'test-only-reset-token';
    await db.authChallenge.create({ data: { userId: accounts.parent1.id, purpose: 'RESET', tokenHash: digest(`${accounts.parent1.id}:RESET:${token}`), expiresAt: new Date(Date.now() + 60000) } });
    const payload = { email: accounts.parent1.email, token, password: 'new-test-password-123' };
    assert.equal((await request('parent1', '/auth/recovery', 'POST', payload)).status, 200);
    assert.equal((await request('parent1', '/auth/me')).status, 401);
    assert.equal((await request('parent1', '/auth/recovery', 'POST', payload)).status, 400);
  });
  await t.test('MFA codes are checked before a session is issued', async () => {
    await db.setting.upsert({ where: { key: 'authentication' }, create: { key: 'authentication', value: { mfaRequired: true } }, update: { value: { mfaRequired: true } } });
    const user = accounts.teacher; const code = '345678';
    await db.authChallenge.create({ data: { userId: user.id, purpose: 'MFA', tokenHash: digest(`${user.id}:MFA:${code}`), expiresAt: new Date(Date.now() + 60000) } });
    const base = process.env.PORTAL_TEST_URL || 'http://127.0.0.1:3100';
    const login = (value: string) => fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user.email, password: 'test-password-123', code: value }) });
    assert.equal((await login('000000')).status, 401);
    assert.equal((await login(code)).status, 200);
    assert.equal((await login(code)).status, 401);
    await db.setting.update({ where: { key: 'authentication' }, data: { value: {} } });
  });
  await t.test('public admissions store validated attachments and ignore supplied workflow status', async () => {
    const submission = await request('admin', '/applications/new', 'POST', { applicantName: 'Test Applicant', guardianEmail: 'guardian@example.test', status: 'APPROVED', files: [{ fieldKey: 'certificate', originalFilename: 'certificate.pdf', mimeType: 'application/pdf', contentBase64: Buffer.from('%PDF-1.4\n%%EOF').toString('base64') }] });
    assert.equal(submission.status, 201); assert.equal(submission.body.status, 'SUBMITTED');
    assert.ok(submission.body.files[0].id); assert.equal(submission.body.files[0].contentBase64, undefined);
    assert.equal((await request('admin', `/documents/${submission.body.files[0].id}`)).status, 200);
  });
});

