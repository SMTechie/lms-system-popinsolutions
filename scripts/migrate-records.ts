import { prisma, withWriteTransaction } from '../src/server/prisma';
import { getPortalData, savePortalData } from '../src/server/portalData';
import { getOperationsData, saveOperationsData } from '../src/server/operations';
import { storeDocument } from '../src/server/documents';

const migrate = withWriteTransaction(async () => {
  const portal = await getPortalData();
  const operations = await getOperationsData();
  for (const form of portal.applications.forms as any[]) for (const submission of form.submissions || []) {
    for (const file of submission.files || []) {
      if (!file.contentBase64) continue;
      const document = await storeDocument(submission.id, { name: file.originalFilename || file.name, mimeType: file.mimeType, contentBase64: file.contentBase64 });
      Object.assign(file, document); delete file.contentBase64;
    }
  }
  let migratedOrders = 0;
  const remainingStore: typeof operations.store.orders = [];
  for (const order of operations.store.orders) {
    const user = await prisma.user.findUnique({ where: { id: order.userId } });
    if (!user) { remainingStore.push(order); continue; }
    await prisma.storeOrder.upsert({ where: { id: order.id }, update: {}, create: { id: order.id, userId: user.id, email: user.email, status: order.status, paymentStatus: ['PAID', 'PREPARING', 'READY_FOR_COLLECTION', 'COLLECTED'].includes(order.status) ? 'PAID' : 'PENDING', paymentMethod: order.paymentMethod || 'eft', totalAmount: order.totalAmount, items: order.items, createdAt: new Date(order.createdAt) } });
    migratedOrders++;
  }
  operations.store.orders = remainingStore;
  const remainingParent: typeof portal.parent.orders = [];
  for (const order of portal.parent.orders) {
    const email = (order as any).parentEmail || portal.parent.guardianEmail;
    const user = email ? await prisma.user.findUnique({ where: { email: email.toLowerCase() } }) : null;
    if (!user) { remainingParent.push(order); continue; }
    await prisma.storeOrder.upsert({ where: { id: order.id }, update: {}, create: { id: order.id, userId: user.id, email: user.email, status: order.status, paymentStatus: ['PAID', 'PREPARING', 'READY_FOR_COLLECTION', 'COLLECTED'].includes(order.status) ? 'PAID' : 'PENDING', paymentMethod: 'eft', totalAmount: order.totalAmount, items: order.items, createdAt: new Date(order.createdAt), collectionLocation: order.collectionLocation || 'School reception' } });
    migratedOrders++;
  }
  portal.parent.orders = remainingParent;
  await savePortalData(portal);
  await saveOperationsData(operations);
  return Response.json({ migratedOrders, records: await prisma.dataRecord.count() });
});

migrate().then(async result => {
  if (!result.ok) throw new Error('Record migration failed; transaction rolled back.');
  console.log(await result.text());
}).catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
