import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BedDouble, Building2, ClipboardList, CreditCard, Megaphone, QrCode, Soup, UserCheck, Wrench } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { apiRequest } from '../lib/api';
import { notifyAction } from '../lib/notify';
import Modal from './Modal';
import PortalLoader from './PortalLoader';

const input = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm';

export default function ParentHostel({ learnerId, permissions }: { learnerId: string; permissions: any }) {
  const [data, setData] = useState<any>(null);
  const [mode, setMode] = useState('');
  const [form, setForm] = useState<any>({ academicYear: new Date().getFullYear() });
  const [rotatingQr, setRotatingQr] = useState(false);
  const passRef = useRef<HTMLDivElement | null>(null);

  const load = () =>
    apiRequest(`/parent/children/${learnerId}/hostel`)
      .then((value) => setData(value && typeof value === 'object' ? value : null))
      .catch((error) => notifyAction(error.message, 'error'));

  useEffect(() => {
    void load();
  }, [learnerId]);

  const submit = async (path: string) => {
    try {
      await apiRequest(path, { method: 'POST', body: JSON.stringify(form) });
      setMode('');
      setForm({ academicYear: new Date().getFullYear() });
      await load();
      notifyAction('Hostel request submitted', 'success');
    } catch (error: any) {
      notifyAction(error.message, 'error');
    }
  };

  const rotateQr = async () => {
    try {
      setRotatingQr(true);
      const result = await apiRequest(`/parent/children/${learnerId}/hostel/qr/rotate`, { method: 'POST' });
      setData((current: any) => ({
        ...current,
        qrCodeValue: result.qrCodeValue,
        qrCodeLabel: result.qrCodeLabel,
        qrPassVersion: result.qrPassVersion,
        qrIssuedAt: result.qrIssuedAt,
      }));
      notifyAction('A new hostel QR pass has been issued.', 'success');
    } catch (error: any) {
      notifyAction(error.message || 'Could not rotate the hostel QR pass.', 'error');
    } finally {
      setRotatingQr(false);
    }
  };

  const printPass = () => {
    const markup = passRef.current?.innerHTML;
    if (!markup) return;
    const printWindow = window.open('', '_blank', 'width=600,height=800');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Hostel QR Pass</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            .pass { border: 1px solid #cbd5e1; border-radius: 24px; padding: 24px; max-width: 420px; margin: 0 auto; }
          </style>
        </head>
        <body>
          <div class="pass">${markup}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  if (!permissions?.viewHostel) {
    return (
      <Card>
        <p className="text-sm text-amber-700">
          Your guardian link does not include hostel access. Contact the school if you need it enabled.
        </p>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <PortalLoader label="Loading hostel details..." className="border-0 p-0 shadow-none" />
      </Card>
    );
  }

  const charges = Array.isArray(data.charges) ? data.charges : [];
  const notices = Array.isArray(data.notices) ? data.notices : [];
  const movementHistory = Array.isArray(data.movementHistory) ? data.movementHistory : [];
  const place = data.allocation?.bed?.room?.block;
  const qrCodeValue = String(data.qrCodeValue || '');
  const isHostelEnrolled = ['RESERVED', 'CHECKED_IN'].includes(String(data.allocation?.status || ''));
  const mealActivity = useMemo(
    () => movementHistory.filter((movement: any) => String(movement.eventType || '').startsWith('MEAL_')),
    [movementHistory],
  );
  const rollCallActivity = useMemo(
    () => movementHistory.filter((movement: any) => String(movement.eventType || '').startsWith('ROLL_CALL_')),
    [movementHistory],
  );
  const gateActivity = useMemo(
    () =>
      movementHistory.filter((movement: any) =>
        ['CHECKED_IN_GATE', 'CHECKED_OUT_GATE', 'CHECKED_IN_RESIDENCE', 'CHECKED_OUT_RESIDENCE'].includes(
          String(movement.eventType || ''),
        ),
      ),
    [movementHistory],
  );
  const latestMeal = mealActivity[0] || null;
  const latestRollCall = rollCallActivity[0] || null;
  const latestGate = gateActivity[0] || null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-end gap-2">
        {isHostelEnrolled && (
          <>
            <button onClick={printPass} className="rounded-lg border bg-white px-4 py-2 text-sm font-bold text-gray-700">
              Print hostel pass
            </button>
            <button onClick={() => void rotateQr()} disabled={rotatingQr} className="rounded-lg border bg-white px-4 py-2 text-sm font-bold text-gray-700 disabled:opacity-50">
              {rotatingQr ? 'Rotating...' : 'Rotate hostel QR'}
            </button>
          </>
        )}
        {permissions.applyHostel && (
          <button onClick={() => setMode('application')} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white">
            Apply for placement
          </button>
        )}
        {permissions.submitHostelConcerns && (
          <button onClick={() => setMode('concern')} className="rounded-lg border bg-white px-4 py-2 text-sm font-bold text-gray-700">
            <Wrench className="mr-2 inline h-4 w-4" />
            Submit concern
          </button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card icon={QrCode} title="Learner hostel QR">
          {isHostelEnrolled && qrCodeValue ? (
            <div ref={passRef} className="flex flex-col items-center gap-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <QRCodeSVG value={qrCodeValue} size={140} includeMargin />
              </div>
              <div className="text-center">
                <b className="text-sm text-slate-900">{data.qrCodeLabel || 'Hostel pass'}</b>
                <p className="mt-1 text-xs text-gray-500">
                  Use this QR for hostel roll call and hostel in/out scans.
                </p>
                <p className="mt-1 text-[11px] font-semibold text-slate-500">Pass version {data.qrPassVersion || 1}</p>
              </div>
              <div className="w-full rounded-xl bg-slate-50 px-3 py-2 text-center text-[11px] font-semibold text-slate-600">
                {qrCodeValue}
              </div>
            </div>
          ) : (
            <Empty text="Hostel QR will appear once this learner has an active hostel placement." />
          )}
        </Card>
        <Card icon={ClipboardList} title="Application">
          <b className="text-lg">{data.application?.status?.replaceAll('_', ' ') || 'No application'}</b>
          <p className="mt-1 text-xs text-gray-500">
            {data.application ? `Academic year ${data.application.academicYear}` : 'Apply when hostel placement opens.'}
          </p>
        </Card>
        <Card icon={BedDouble} title="Allocation">
          <b className="text-lg">{place ? `${place.building.name} - ${data.allocation.bed.room.roomNumber}` : 'Not allocated'}</b>
          <p className="mt-1 text-xs text-gray-500">
            {data.allocation ? `${data.allocation.bed.label} - ${data.allocation.status.replaceAll('_', ' ')}` : 'Room and bed details will appear after approval.'}
          </p>
        </Card>
        <Card icon={CreditCard} title="Hostel balance">
          <b className="text-lg">
            R {charges.reduce((total: number, charge: any) => total + charge.amount - charge.paidAmount, 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
          </b>
          <p className="mt-1 text-xs text-gray-500">
            {permissions.viewHostelBilling ? 'Child-scoped hostel charges' : 'Billing access is disabled.'}
          </p>
        </Card>
      </div>

      {isHostelEnrolled && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card icon={UserCheck} title="Latest roll call">
            {latestRollCall ? (
              <>
                <b className="text-base text-slate-900">{String(latestRollCall.eventType).replaceAll('_', ' ')}</b>
                <p className="mt-1 text-xs text-gray-500">{latestRollCall.notes || 'Hostel roll call recorded.'}</p>
                <p className="mt-3 text-xs font-semibold text-blue-700">{new Date(latestRollCall.createdAt).toLocaleString()}</p>
              </>
            ) : (
              <Empty text="No roll call scan has been recorded yet." />
            )}
          </Card>
          <Card icon={Building2} title="Latest hostel in / out">
            {latestGate ? (
              <>
                <b className="text-base text-slate-900">{String(latestGate.eventType).replaceAll('_', ' ')}</b>
                <p className="mt-1 text-xs text-gray-500">{latestGate.notes || 'Hostel movement recorded.'}</p>
                <p className="mt-3 text-xs font-semibold text-blue-700">{new Date(latestGate.createdAt).toLocaleString()}</p>
              </>
            ) : (
              <Empty text="No hostel gate or residence movement has been recorded yet." />
            )}
          </Card>
          <Card icon={Soup} title="Latest meal scan">
            {latestMeal ? (
              <>
                <b className="text-base text-slate-900">{String(latestMeal.eventType).replaceAll('_', ' ')}</b>
                <p className="mt-1 text-xs text-gray-500">{latestMeal.notes || 'Meal attendance recorded.'}</p>
                <p className="mt-3 text-xs font-semibold text-blue-700">{new Date(latestMeal.createdAt).toLocaleString()}</p>
              </>
            ) : (
              <Empty text="No hostel meal scan has been recorded yet." />
            )}
          </Card>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card icon={Megaphone} title="Hostel notices">
          {notices.length ? (
            notices.map((notice: any) => (
              <div key={notice.id} className="border-t py-3 first:border-0">
                <b className="text-sm">{notice.title}</b>
                <p className="text-xs text-gray-500">{notice.message}</p>
              </div>
            ))
          ) : (
            <Empty text="No hostel notices." />
          )}
        </Card>
        <Card icon={Building2} title={isHostelEnrolled ? 'Hostel activity history' : 'Hostel status'}>
          {isHostelEnrolled ? (
            permissions.viewHostelMovement && movementHistory.length ? (
              movementHistory.map((movement: any) => (
                <div key={movement.id} className="flex justify-between border-t py-3 text-xs first:border-0">
                  <div>
                    <p className="font-semibold text-slate-800">{String(movement.eventType || movement.status || 'Activity').replaceAll('_', ' ')}</p>
                    <p className="text-gray-500">{movement.notes || movement.source || 'Hostel update recorded.'}</p>
                  </div>
                  <span className="text-right text-gray-500">{new Date(movement.createdAt).toLocaleString()}</span>
                </div>
              ))
            ) : (
              <Empty text="No movement records available." />
            )
          ) : (
            <Empty text="Hostel activity will appear here once the learner has been placed in hostel." />
          )}
        </Card>
      </div>

      <Modal
        title={mode === 'application' ? 'Apply for hostel placement' : 'Submit hostel maintenance / concern request'}
        isOpen={!!mode}
        onClose={() => setMode('')}
      >
        <div className="space-y-4">
          {mode === 'application' ? (
            <>
              <Field label="Academic year">
                <input type="number" className={input} value={form.academicYear || ''} onChange={(event) => setForm({ ...form, academicYear: Number(event.target.value) })} />
              </Field>
              <Field label="Term">
                <input className={input} value={form.term || ''} onChange={(event) => setForm({ ...form, term: event.target.value })} />
              </Field>
              <Field label="Reason">
                <textarea className={input} value={form.reason || ''} onChange={(event) => setForm({ ...form, reason: event.target.value })} />
              </Field>
              <Field label="Medical requirements">
                <textarea className={input} value={form.medicalRequirements || ''} onChange={(event) => setForm({ ...form, medicalRequirements: event.target.value })} />
              </Field>
              <Field label="Dietary requirements">
                <textarea className={input} value={form.dietaryRequirements || ''} onChange={(event) => setForm({ ...form, dietaryRequirements: event.target.value })} />
              </Field>
            </>
          ) : (
            <>
              <Field label="Title">
                <input className={input} value={form.title || ''} onChange={(event) => setForm({ ...form, title: event.target.value })} />
              </Field>
              <Field label="Category">
                <input className={input} value={form.category || ''} onChange={(event) => setForm({ ...form, category: event.target.value })} />
              </Field>
              <Field label="Description">
                <textarea className={input} value={form.description || ''} onChange={(event) => setForm({ ...form, description: event.target.value })} />
              </Field>
            </>
          )}
          <button
            onClick={() => void submit(mode === 'application' ? `/parent/children/${learnerId}/hostel/applications` : `/parent/children/${learnerId}/hostel/concerns`)}
            className="w-full rounded-lg bg-blue-600 py-3 text-sm font-bold text-white"
          >
            Submit to school
          </button>
        </div>
      </Modal>
    </div>
  );
}

function Card({ icon: Icon, title, children }: { icon?: any; title?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      {title && (
        <div className="mb-4 flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-blue-600" />}
          <h3 className="font-bold">{title}</h3>
        </div>
      )}
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-bold text-gray-600">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-gray-500">{text}</p>;
}
