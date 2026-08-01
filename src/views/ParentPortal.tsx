import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  BedDouble,
  Bell,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  FileText,
  Gavel,
  LifeBuoy,
  LockKeyhole,
  MessageSquare,
  Receipt,
  ScrollText,
  Settings2,
  ShoppingBag,
  UserRound,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import Modal from '../components/Modal';
import ParentHostel from '../components/ParentHostel';
import PortalLoader from '../components/PortalLoader';
import { apiRequest } from '../lib/api';
import { notifyAction } from '../lib/notify';
import { useBranding } from '../settings/BrandingContext';

type SectionDefinition = {
  key: string;
  label: string;
  icon: any;
  permission?: string;
};

const sections: readonly SectionDefinition[] = [
  { key: 'homework', label: 'Homework', icon: BookOpen, permission: 'viewHomework' },
  { key: 'attendance', label: 'Attendance', icon: ClipboardCheck },
  { key: 'discipline', label: 'Disciplinary', icon: Gavel },
  { key: 'announcements', label: 'Announcements', icon: MessageSquare, permission: 'receiveAnnouncements' },
  { key: 'fees', label: 'School Fees', icon: BadgeCheck, permission: 'viewFees' },
  { key: 'applications', label: 'Applications', icon: FileText, permission: 'submitApplications' },
  { key: 'hostel', label: 'Hostel', icon: BedDouble, permission: 'viewHostel' },
  { key: 'appointments', label: 'Appointments', icon: CalendarDays, permission: 'bookAppointments' },
  { key: 'messages', label: 'Messages', icon: MessageSquare, permission: 'messageTeachers' },
  { key: 'reports', label: 'Reports', icon: ScrollText, permission: 'viewReports' },
  { key: 'orders', label: 'Orders', icon: Receipt },
  { key: 'store', label: 'School Store', icon: ShoppingBag },
  { key: 'tickets', label: 'Support', icon: LifeBuoy },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'account', label: 'Account', icon: Settings2 },
] as const;

type SectionKey = SectionDefinition['key'];

const learnerRequiredSections = new Set<SectionKey>([
  'homework',
  'attendance',
  'discipline',
  'announcements',
  'fees',
  'applications',
  'hostel',
  'appointments',
  'messages',
  'reports',
]);

const inputClass =
  'w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10';

export default function ParentPortal() {
  const { branding } = useBranding();
  const navigate = useNavigate();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [active, setActive] = useState<SectionKey | null>(null);
  const [context, setContext] = useState<any>(null);
  const [moduleData, setModuleData] = useState<any>(null);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [loadingContext, setLoadingContext] = useState(false);
  const [loadingModule, setLoadingModule] = useState(false);
  const [startingCheckout, setStartingCheckout] = useState(false);
  const [paymentDraft, setPaymentDraft] = useState({ feeId: '', amount: '', method: 'EFT', reference: '', proofFileName: '' });
  const [appointmentDraft, setAppointmentDraft] = useState({
    title: '',
    teacherName: 'Assigned Teacher',
    teacherEmail: 'teacher@popin.school',
    startsAt: '',
    endsAt: '',
    location: 'School campus',
    notes: '',
  });
  const [messageDraft, setMessageDraft] = useState({ subject: '', message: '' });
  const [ticketDraft, setTicketDraft] = useState({ title: '', category: 'General', priority: 'MEDIUM', description: '' });
  const [accountDraft, setAccountDraft] = useState<any>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [excuseDrafts, setExcuseDrafts] = useState<Record<string, string>>({});

  const selected = children.find((item) => item?.learner?.id === selectedId);
  const currentSection = sections.find((section) => section.key === active) || null;
  const currentSectionLabel = currentSection?.label || 'Portal';

  const visibleSections = useMemo(
    () =>
      sections.filter((section) => {
        if (!section.permission) return true;
        return Boolean(selected?.permissions?.[section.permission]);
      }),
    [selected],
  );

  const readOverview = async (learnerId: string) => {
    if (!learnerId) {
      setContext(null);
      return;
    }
    setLoadingContext(true);
    try {
      const overview = await apiRequest(`/parent/children/${learnerId}/overview`);
      setContext(overview);
    } catch (error: any) {
      notifyAction(error.message || 'Could not load learner overview.', 'error');
    } finally {
      setLoadingContext(false);
    }
  };

  useEffect(() => {
    apiRequest<any[]>('/parent/children')
      .then((items) => {
        const list = Array.isArray(items) ? items : [];
        setChildren(list);
        setSelectedId(list[0]?.learner?.id || '');
      })
      .catch((error) => notifyAction(error.message, 'error'))
      .finally(() => setLoadingChildren(false));
  }, []);

  useEffect(() => {
    void readOverview(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (!active) {
      setModuleData(null);
      return;
    }
    if (learnerRequiredSections.has(active) && !selectedId) {
      setModuleData(null);
      return;
    }

    const load = async () => {
      setLoadingModule(true);
      try {
        let payload: any = null;
        if (active === 'attendance') payload = await apiRequest(`/parent/children/${selectedId}/attendance`);
        else if (active === 'discipline') payload = await apiRequest(`/parent/children/${selectedId}/discipline`);
        else if (active === 'fees') payload = await apiRequest(`/parent/children/${selectedId}/fees`);
        else if (active === 'applications') payload = await apiRequest(`/parent/children/${selectedId}/applications`);
        else if (active === 'appointments') payload = await apiRequest(`/parent/children/${selectedId}/appointments`);
        else if (active === 'messages') payload = await apiRequest(`/parent/children/${selectedId}/messages`);
        else if (active === 'reports') payload = await apiRequest(`/parent/children/${selectedId}/reports`);
        else if (active === 'orders') payload = await apiRequest('/parent/orders');
        else if (active === 'tickets') payload = await apiRequest('/parent/tickets');
        else if (active === 'notifications') payload = await apiRequest('/parent/notifications');
        else if (active === 'account') payload = await apiRequest('/parent/profile');
        setModuleData(payload);
        if (active === 'account') setAccountDraft(payload);
      } catch (error: any) {
        notifyAction(error.message || `Could not load ${currentSectionLabel.toLowerCase()}.`, 'error');
        setModuleData(null);
      } finally {
        setLoadingModule(false);
      }
    };

    if (['homework', 'announcements', 'hostel', 'store'].includes(active)) {
      setLoadingModule(false);
      setModuleData(null);
      return;
    }

    void load();
  }, [active, currentSectionLabel, selectedId]);

  const pendingAcknowledgements = useMemo(
    () =>
      Array.isArray(moduleData)
        ? moduleData.filter((item: any) => item.requiresAcknowledgement && !item.parentAcknowledgedAt)
        : [],
    [moduleData],
  );

  const closeModule = () => {
    setActive(null);
    setModuleData(null);
  };

  const refreshActive = async () => {
    if (!active) return;
    if (selectedId) await readOverview(selectedId);
    if (['homework', 'announcements', 'hostel', 'store'].includes(active)) return;
    setActive((value) => value);
    const section = active;
    setLoadingModule(true);
    try {
      let payload: any = null;
      if (section === 'attendance') payload = await apiRequest(`/parent/children/${selectedId}/attendance`);
      else if (section === 'discipline') payload = await apiRequest(`/parent/children/${selectedId}/discipline`);
      else if (section === 'fees') payload = await apiRequest(`/parent/children/${selectedId}/fees`);
      else if (section === 'applications') payload = await apiRequest(`/parent/children/${selectedId}/applications`);
      else if (section === 'appointments') payload = await apiRequest(`/parent/children/${selectedId}/appointments`);
      else if (section === 'messages') payload = await apiRequest(`/parent/children/${selectedId}/messages`);
      else if (section === 'reports') payload = await apiRequest(`/parent/children/${selectedId}/reports`);
      else if (section === 'orders') payload = await apiRequest('/parent/orders');
      else if (section === 'tickets') payload = await apiRequest('/parent/tickets');
      else if (section === 'notifications') payload = await apiRequest('/parent/notifications');
      else if (section === 'account') payload = await apiRequest('/parent/profile');
      setModuleData(payload);
      if (section === 'account') setAccountDraft(payload);
    } finally {
      setLoadingModule(false);
    }
  };

  const acknowledgeDiscipline = async (recordId: string) => {
    if (!selectedId) return;
    try {
      await apiRequest(`/parent/children/${selectedId}/discipline/${recordId}/acknowledge`, { method: 'POST' });
      notifyAction('Disciplinary acknowledgement recorded.', 'success');
      await refreshActive();
    } catch (error: any) {
      notifyAction(error.message || 'Could not acknowledge disciplinary item.', 'error');
    }
  };

  const submitAttendanceExcuse = async (date: string) => {
    if (!selectedId) return;
    const reason = excuseDrafts[date];
    if (!reason?.trim()) {
      notifyAction('Enter a reason before submitting the excuse.', 'error');
      return;
    }
    try {
      await apiRequest(`/parent/children/${selectedId}/attendance/excuse`, {
        method: 'POST',
        body: JSON.stringify({ date, reason }),
      });
      notifyAction('Attendance excuse submitted to the school.', 'success');
      setExcuseDrafts((current) => ({ ...current, [date]: '' }));
      await refreshActive();
    } catch (error: any) {
      notifyAction(error.message || 'Could not submit the attendance excuse.', 'error');
    }
  };

  const submitPayment = async () => {
    if (!selectedId) return;
    if (!paymentDraft.feeId || !paymentDraft.amount) {
      notifyAction('Choose a fee record and enter the payment amount.', 'error');
      return;
    }
    if (paymentDraft.method === 'PAYSTACK') {
      setStartingCheckout(true);
      try {
        const response = await apiRequest<{ authorizationUrl?: string }>(`/parent/children/${selectedId}/fees/payments/checkout`, {
          method: 'POST',
          body: JSON.stringify({
            ...paymentDraft,
            amount: Number(paymentDraft.amount),
          }),
        });
        if (!response.authorizationUrl) {
          throw new Error('The payment gateway did not return a checkout URL.');
        }
        window.location.href = response.authorizationUrl;
        return;
      } catch (error: any) {
        notifyAction(error.message || 'Could not start online checkout.', 'error');
      } finally {
        setStartingCheckout(false);
      }
      return;
    }
    try {
      await apiRequest(`/parent/children/${selectedId}/fees/payments`, {
        method: 'POST',
        body: JSON.stringify({
          ...paymentDraft,
          amount: Number(paymentDraft.amount),
        }),
      });
      notifyAction('Payment submitted for verification.', 'success');
      setPaymentDraft({ feeId: '', amount: '', method: 'EFT', reference: '', proofFileName: '' });
      await refreshActive();
    } catch (error: any) {
      notifyAction(error.message || 'Could not submit the payment.', 'error');
    }
  };

  const requestAppointment = async () => {
    if (!selectedId || !appointmentDraft.startsAt || !appointmentDraft.title.trim()) {
      notifyAction('Complete the appointment title and time.', 'error');
      return;
    }
    try {
      await apiRequest(`/parent/children/${selectedId}/appointments`, {
        method: 'POST',
        body: JSON.stringify(appointmentDraft),
      });
      notifyAction('Appointment request submitted.', 'success');
      setAppointmentDraft({
        title: '',
        teacherName: 'Assigned Teacher',
        teacherEmail: 'teacher@popin.school',
        startsAt: '',
        endsAt: '',
        location: 'School campus',
        notes: '',
      });
      await refreshActive();
    } catch (error: any) {
      notifyAction(error.message || 'Could not create the appointment request.', 'error');
    }
  };

  const updateAppointment = async (appointmentId: string, status: string) => {
    if (!selectedId) return;
    try {
      await apiRequest(`/parent/children/${selectedId}/appointments/${appointmentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      notifyAction('Appointment updated.', 'success');
      await refreshActive();
    } catch (error: any) {
      notifyAction(error.message || 'Could not update the appointment.', 'error');
    }
  };

  const createMessageThread = async () => {
    if (!selectedId || !messageDraft.subject.trim() || !messageDraft.message.trim()) {
      notifyAction('Enter a subject and message.', 'error');
      return;
    }
    try {
      await apiRequest(`/parent/children/${selectedId}/messages`, {
        method: 'POST',
        body: JSON.stringify(messageDraft),
      });
      notifyAction('Message sent to the teaching team.', 'success');
      setMessageDraft({ subject: '', message: '' });
      await refreshActive();
    } catch (error: any) {
      notifyAction(error.message || 'Could not start the message thread.', 'error');
    }
  };

  const replyToThread = async (threadId: string) => {
    if (!selectedId) return;
    const message = replyDrafts[threadId];
    if (!message?.trim()) {
      notifyAction('Enter a reply before sending.', 'error');
      return;
    }
    try {
      await apiRequest(`/parent/children/${selectedId}/messages/${threadId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
      notifyAction('Reply sent.', 'success');
      setReplyDrafts((current) => ({ ...current, [threadId]: '' }));
      await refreshActive();
    } catch (error: any) {
      notifyAction(error.message || 'Could not send the reply.', 'error');
    }
  };

  const createTicket = async () => {
    if (!ticketDraft.title.trim() || !ticketDraft.description.trim()) {
      notifyAction('Enter a title and description for the support request.', 'error');
      return;
    }
    try {
      await apiRequest('/parent/tickets', {
        method: 'POST',
        body: JSON.stringify({ ...ticketDraft, learnerId: selectedId || null }),
      });
      notifyAction('Support request created.', 'success');
      setTicketDraft({ title: '', category: 'General', priority: 'MEDIUM', description: '' });
      await refreshActive();
    } catch (error: any) {
      notifyAction(error.message || 'Could not create the support request.', 'error');
    }
  };

  const replyToTicket = async (ticketId: string) => {
    const message = replyDrafts[ticketId];
    if (!message?.trim()) {
      notifyAction('Enter a reply before sending.', 'error');
      return;
    }
    try {
      await apiRequest(`/parent/tickets/${ticketId}/replies`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
      notifyAction('Support reply sent.', 'success');
      setReplyDrafts((current) => ({ ...current, [ticketId]: '' }));
      await refreshActive();
    } catch (error: any) {
      notifyAction(error.message || 'Could not send the support reply.', 'error');
    }
  };

  const closeTicket = async (ticketId: string) => {
    try {
      await apiRequest(`/parent/tickets/${ticketId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'CLOSED' }),
      });
      notifyAction('Support request closed.', 'success');
      await refreshActive();
    } catch (error: any) {
      notifyAction(error.message || 'Could not close the support request.', 'error');
    }
  };

  const markOrderCollected = async (orderId: string) => {
    try {
      await apiRequest(`/parent/orders/${orderId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'COLLECTED' }),
      });
      notifyAction('Order updated.', 'success');
      await refreshActive();
    } catch (error: any) {
      notifyAction(error.message || 'Could not update the order.', 'error');
    }
  };

  const markNotificationRead = async (notificationId: string) => {
    try {
      await apiRequest(`/parent/notifications/${notificationId}/read`, { method: 'POST' });
      await refreshActive();
    } catch (error: any) {
      notifyAction(error.message || 'Could not mark the notification as read.', 'error');
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await apiRequest('/parent/notifications/read-all', { method: 'POST' });
      notifyAction('Notifications marked as read.', 'success');
      await refreshActive();
    } catch (error: any) {
      notifyAction(error.message || 'Could not update notifications.', 'error');
    }
  };

  const saveAccount = async () => {
    try {
      await apiRequest('/parent/profile', {
        method: 'PATCH',
        body: JSON.stringify(accountDraft),
      });
      notifyAction('Account details updated.', 'success');
      await refreshActive();
    } catch (error: any) {
      notifyAction(error.message || 'Could not save account settings.', 'error');
    }
  };

  const renderActiveModule = () => {
    if (!active) return null;

    if (loadingContext || loadingModule) {
      return <PortalLoader label={`Loading ${currentSectionLabel.toLowerCase()}...`} className="border-0 p-0 shadow-none" />;
    }

    if (learnerRequiredSections.has(active) && !selected) {
      return <EmptyState text="Select a learner to open this module." />;
    }

    if (active === 'homework') {
      return <SimpleItems items={context?.homework || []} empty="No homework is available for this learner." />;
    }

    if (active === 'announcements') {
      return <SimpleItems items={context?.announcements || []} empty="No announcements are available right now." />;
    }

    if (active === 'discipline') {
      return (
        <div className="space-y-4">
          {pendingAcknowledgements.length > 0 && (
            <Banner text={`${pendingAcknowledgements.length} disciplinary item(s) need your acknowledgement.`} tone="amber" />
          )}
          <DisciplineItems items={Array.isArray(moduleData) ? moduleData : []} onAcknowledge={acknowledgeDiscipline} />
        </div>
      );
    }

    if (active === 'attendance') {
      return (
        <div className="space-y-4">
          <Banner text="Track submitted registers and send an excuse for late or absent attendance records." tone="blue" />
          {Array.isArray(moduleData) && moduleData.length ? (
            <div className="space-y-3">
              {moduleData.map((item: any) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{new Date(item.date).toLocaleDateString()}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.status} / {item.capturedBy || 'School register'}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                      {item.excuseStatus || 'No excuse'}
                    </span>
                  </div>
                  {item.note && <p className="mt-3 text-sm text-slate-600">{item.note}</p>}
                  {item.parentNote && <p className="mt-2 text-xs text-slate-500">Parent note: {item.parentNote}</p>}
                  {['ABSENT', 'LATE'].includes(item.status) && item.excuseStatus !== 'SUBMITTED' && (
                    <div className="mt-4 space-y-2">
                      <textarea
                        rows={3}
                        className={inputClass}
                        placeholder="Add the parent explanation for this attendance record"
                        value={excuseDrafts[item.date] || ''}
                        onChange={(event) => setExcuseDrafts((current) => ({ ...current, [item.date]: event.target.value }))}
                      />
                      <button
                        onClick={() => void submitAttendanceExcuse(item.date)}
                        className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                      >
                        Submit excuse
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="No attendance history is available yet." />
          )}
        </div>
      );
    }

    if (active === 'fees') {
      const summary = moduleData?.summary || { total: 0, paid: 0, outstanding: 0 };
      const items = Array.isArray(moduleData?.items) ? moduleData.items : [];
      const payments = Array.isArray(moduleData?.payments) ? moduleData.payments : [];
      const gateway = moduleData?.gateway || null;
      return (
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            <MetricCard label="Total billed" value={`R ${Number(summary.total || 0).toFixed(2)}`} />
            <MetricCard label="Paid" value={`R ${Number(summary.paid || 0).toFixed(2)}`} />
            <MetricCard label="Outstanding" value={`R ${Number(summary.outstanding || 0).toFixed(2)}`} />
          </div>
          <SectionCard title="Payment options">
            <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Collections summary</p>
                <h4 className="mt-2 text-lg font-bold text-slate-950">Choose the payment route that fits this family</h4>
                <p className="mt-2 text-sm text-slate-600">
                  Manual payments remain available for EFT and cash proof, while live checkout can redirect to the school's online gateway when enabled.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {['Manual EFT', 'Card reference', 'Cash office capture', ...(gateway?.enabled && gateway?.provider === 'PAYSTACK' ? ['Online checkout'] : [])].map((label) => (
                    <span key={label} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
              <div className={`rounded-2xl border p-4 ${gateway?.enabled ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Gateway status</p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold text-slate-950">{gateway?.provider || 'Manual only'}</p>
                    <p className="text-sm text-slate-600">
                      {gateway?.enabled ? `${String(gateway?.mode || 'manual').toUpperCase()} mode` : 'Online payments are currently disabled'}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${gateway?.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                    {gateway?.enabled ? 'Ready' : 'Offline'}
                  </span>
                </div>
                <p className="mt-4 text-xs text-slate-500">
                  {gateway?.enabled && gateway?.provider === 'PAYSTACK'
                    ? 'Paystack checkout will open in a secure payment page and return here automatically.'
                    : 'Use the manual submission flow below and wait for school verification.'}
                </p>
              </div>
            </div>
          </SectionCard>
          <SectionCard title="Fee items">
            {items.length ? (
              <div className="space-y-3">
                {items.map((item: any) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {item.term} / {item.category}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Due {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'No due date'} / {item.reference}
                        </p>
                      </div>
                      <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">{item.status}</span>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">
                      R {Number(item.amount).toFixed(2)} billed / R {Number(item.paidAmount).toFixed(2)} received
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState text="No fee items are available for this learner." />
            )}
          </SectionCard>
          <SectionCard title="Submit a payment">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Fee item">
                <select className={inputClass} value={paymentDraft.feeId} onChange={(event) => setPaymentDraft((current) => ({ ...current, feeId: event.target.value }))}>
                  <option value="">Select fee item</option>
                  {items.map((item: any) => (
                    <option key={item.id} value={item.id}>
                      {item.term} / {item.category}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Amount">
                <input className={inputClass} value={paymentDraft.amount} onChange={(event) => setPaymentDraft((current) => ({ ...current, amount: event.target.value }))} />
              </Field>
              <Field label="Method">
                <select className={inputClass} value={paymentDraft.method} onChange={(event) => setPaymentDraft((current) => ({ ...current, method: event.target.value }))}>
                  {[
                    'EFT',
                    'CARD',
                    'CASH',
                    ...(moduleData?.gateway?.enabled && moduleData?.gateway?.provider === 'PAYSTACK' ? ['PAYSTACK'] : []),
                  ].map((method) => (
                    <option key={method}>{method}</option>
                  ))}
                </select>
              </Field>
              <Field label="Reference">
                <input className={inputClass} value={paymentDraft.reference} onChange={(event) => setPaymentDraft((current) => ({ ...current, reference: event.target.value }))} />
              </Field>
              {paymentDraft.method !== 'PAYSTACK' ? (
                <Field label="Proof file name">
                  <input className={inputClass} value={paymentDraft.proofFileName} onChange={(event) => setPaymentDraft((current) => ({ ...current, proofFileName: event.target.value }))} placeholder="proof-july.pdf" />
                </Field>
              ) : (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 md:col-span-2">
                  You will be redirected to Paystack to complete this payment securely. Once the transaction succeeds, the portal will verify it and update the learner record automatically.
                </div>
              )}
            </div>
            <button onClick={() => void submitPayment()} disabled={startingCheckout} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
              {paymentDraft.method === 'PAYSTACK' ? (startingCheckout ? 'Opening checkout...' : 'Pay online') : 'Submit payment'}
            </button>
          </SectionCard>
          <SectionCard title="Payment history">
            {payments.length ? <PaymentList items={payments} /> : <EmptyState text="No payment history has been submitted yet." />}
          </SectionCard>
        </div>
      );
    }

    if (active === 'applications') {
      return <SimpleItems items={Array.isArray(moduleData) ? moduleData : []} empty="No applications are linked to this learner or parent account." />;
    }

    if (active === 'hostel') {
      return <ParentHostel learnerId={selectedId} permissions={selected?.permissions} />;
    }

    if (active === 'appointments') {
      const items = Array.isArray(moduleData) ? moduleData : [];
      return (
        <div className="space-y-5">
          <SectionCard title="Book an appointment">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Title">
                <input className={inputClass} value={appointmentDraft.title} onChange={(event) => setAppointmentDraft((current) => ({ ...current, title: event.target.value }))} />
              </Field>
              <Field label="Teacher">
                <input className={inputClass} value={appointmentDraft.teacherName} onChange={(event) => setAppointmentDraft((current) => ({ ...current, teacherName: event.target.value }))} />
              </Field>
              <Field label="Start">
                <input type="datetime-local" className={inputClass} value={appointmentDraft.startsAt} onChange={(event) => setAppointmentDraft((current) => ({ ...current, startsAt: event.target.value }))} />
              </Field>
              <Field label="End">
                <input type="datetime-local" className={inputClass} value={appointmentDraft.endsAt} onChange={(event) => setAppointmentDraft((current) => ({ ...current, endsAt: event.target.value }))} />
              </Field>
              <Field label="Location">
                <input className={inputClass} value={appointmentDraft.location} onChange={(event) => setAppointmentDraft((current) => ({ ...current, location: event.target.value }))} />
              </Field>
              <Field label="Notes">
                <textarea rows={3} className={inputClass} value={appointmentDraft.notes} onChange={(event) => setAppointmentDraft((current) => ({ ...current, notes: event.target.value }))} />
              </Field>
            </div>
            <button onClick={() => void requestAppointment()} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
              Request appointment
            </button>
          </SectionCard>
          <SectionCard title="Upcoming appointments">
            {items.length ? (
              <div className="space-y-3">
                {items.map((item: any) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.teacherName} / {new Date(item.startsAt).toLocaleString()}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{item.status}</span>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">{item.notes || item.location}</p>
                    {item.status !== 'CANCELLED' && (
                      <button onClick={() => void updateAppointment(item.id, 'CANCELLED')} className="mt-3 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
                        Cancel appointment
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState text="No appointments have been booked yet." />
            )}
          </SectionCard>
        </div>
      );
    }

    if (active === 'messages') {
      const threads = Array.isArray(moduleData) ? moduleData : [];
      return (
        <div className="space-y-5">
          <SectionCard title="Start a teacher conversation">
            <div className="space-y-3">
              <Field label="Subject">
                <input className={inputClass} value={messageDraft.subject} onChange={(event) => setMessageDraft((current) => ({ ...current, subject: event.target.value }))} />
              </Field>
              <Field label="Message">
                <textarea rows={4} className={inputClass} value={messageDraft.message} onChange={(event) => setMessageDraft((current) => ({ ...current, message: event.target.value }))} />
              </Field>
            </div>
            <button onClick={() => void createMessageThread()} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
              Send message
            </button>
          </SectionCard>
          <SectionCard title="Conversation history">
            {threads.length ? (
              <div className="space-y-4">
                {threads.map((thread: any) => (
                  <div key={thread.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{thread.subject}</p>
                        <p className="mt-1 text-xs text-slate-500">Updated {new Date(thread.updatedAt).toLocaleString()}</p>
                      </div>
                      <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">{thread.status}</span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {(thread.messages || []).map((message: any) => (
                        <div key={message.id} className="rounded-2xl bg-slate-50 p-3">
                          <div className="flex justify-between gap-3">
                            <b className="text-xs text-slate-800">{message.authorName}</b>
                            <span className="text-[11px] text-slate-400">{new Date(message.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="mt-2 text-sm text-slate-600">{message.message}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 space-y-2">
                      <textarea
                        rows={3}
                        className={inputClass}
                        placeholder="Reply to this thread"
                        value={replyDrafts[thread.id] || ''}
                        onChange={(event) => setReplyDrafts((current) => ({ ...current, [thread.id]: event.target.value }))}
                      />
                      <button onClick={() => void replyToThread(thread.id)} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                        Send reply
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState text="No messages have been started yet." />
            )}
          </SectionCard>
        </div>
      );
    }

    if (active === 'reports') {
      const reports = Array.isArray(moduleData) ? moduleData : [];
      return reports.length ? (
        <div className="space-y-4">
          {reports.map((report: any) => (
            <div key={report.id} className="rounded-2xl border border-slate-200 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-slate-900">{report.term} report</p>
                  <p className="mt-1 text-xs text-slate-500">Published {new Date(report.publishedAt).toLocaleDateString()}</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">{report.average}% average</span>
              </div>
              <p className="mt-4 text-sm text-slate-600">{report.teacherComment}</p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {(report.subjects || []).map((subject: any) => (
                  <div key={subject.name} className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{subject.name}</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">{subject.mark}%</p>
                    <p className="text-xs text-slate-500">Grade {subject.grade}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState text="No reports have been published for this learner yet." />
      );
    }

    if (active === 'orders') {
      const orders = Array.isArray(moduleData) ? moduleData : [];
      return orders.length ? (
        <div className="space-y-3">
          {orders.map((order: any) => (
            <div key={order.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{order.id}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(order.createdAt).toLocaleDateString()} / {order.collectionLocation || 'Collection details pending'}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{order.status}</span>
              </div>
              <p className="mt-3 text-sm text-slate-600">Total: R {Number(order.totalAmount || 0).toFixed(2)}</p>
              <div className="mt-3 text-xs text-slate-500">
                {(order.items || []).map((item: any) => `${item.quantity} x ${item.name}`).join(', ')}
              </div>
              {order.status === 'READY_FOR_COLLECTION' && (
                <button onClick={() => void markOrderCollected(order.id)} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
                  Mark collected
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState text="No orders are linked to this account." />
      );
    }

    if (active === 'store') {
      return (
        <div className="space-y-4">
          <Banner text="Open the full school store experience to place new orders and manage your cart." tone="blue" />
          <button
            onClick={() => {
              navigate('/store');
              closeModule();
            }}
            className="inline-flex rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            Open school store
          </button>
        </div>
      );
    }

    if (active === 'tickets') {
      const tickets = Array.isArray(moduleData) ? moduleData : [];
      return (
        <div className="space-y-5">
          <SectionCard title="Create a support request">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Title">
                <input className={inputClass} value={ticketDraft.title} onChange={(event) => setTicketDraft((current) => ({ ...current, title: event.target.value }))} />
              </Field>
              <Field label="Category">
                <input className={inputClass} value={ticketDraft.category} onChange={(event) => setTicketDraft((current) => ({ ...current, category: event.target.value }))} />
              </Field>
              <Field label="Priority">
                <select className={inputClass} value={ticketDraft.priority} onChange={(event) => setTicketDraft((current) => ({ ...current, priority: event.target.value }))}>
                  {['LOW', 'MEDIUM', 'HIGH'].map((priority) => (
                    <option key={priority}>{priority}</option>
                  ))}
                </select>
              </Field>
              <Field label="Description">
                <textarea rows={4} className={inputClass} value={ticketDraft.description} onChange={(event) => setTicketDraft((current) => ({ ...current, description: event.target.value }))} />
              </Field>
            </div>
            <button onClick={() => void createTicket()} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
              Create support request
            </button>
          </SectionCard>
          <SectionCard title="Open support history">
            {tickets.length ? (
              <div className="space-y-4">
                {tickets.map((ticket: any) => (
                  <div key={ticket.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{ticket.title}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {ticket.category} / {ticket.priority} / {new Date(ticket.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{ticket.status}</span>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">{ticket.description}</p>
                    <div className="mt-4 space-y-3">
                      {(ticket.replies || []).map((reply: any) => (
                        <div key={reply.id} className="rounded-2xl bg-slate-50 p-3">
                          <div className="flex justify-between gap-3">
                            <b className="text-xs text-slate-800">{reply.authorName}</b>
                            <span className="text-[11px] text-slate-400">{new Date(reply.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="mt-2 text-sm text-slate-600">{reply.message}</p>
                        </div>
                      ))}
                    </div>
                    {ticket.status !== 'CLOSED' && (
                      <div className="mt-4 space-y-2">
                        <textarea
                          rows={3}
                          className={inputClass}
                          placeholder="Reply to support"
                          value={replyDrafts[ticket.id] || ''}
                          onChange={(event) => setReplyDrafts((current) => ({ ...current, [ticket.id]: event.target.value }))}
                        />
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => void replyToTicket(ticket.id)} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                            Send reply
                          </button>
                          <button onClick={() => void closeTicket(ticket.id)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
                            Close request
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState text="No support requests have been logged yet." />
            )}
          </SectionCard>
        </div>
      );
    }

    if (active === 'notifications') {
      const notifications = Array.isArray(moduleData) ? moduleData : [];
      return (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => void markAllNotificationsRead()} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
              Mark all as read
            </button>
          </div>
          {notifications.length ? (
            <div className="space-y-3">
              {notifications.map((item: any) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${item.readAt ? 'bg-slate-100 text-slate-600' : 'bg-blue-50 text-blue-700'}`}>
                      {item.readAt ? 'Read' : 'Unread'}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{item.message}</p>
                  {!item.readAt && (
                    <button onClick={() => void markNotificationRead(item.id)} className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
                      Mark as read
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="No notifications are waiting for you." />
          )}
        </div>
      );
    }

    if (active === 'account') {
      return (
        <div className="space-y-5">
          <SectionCard title="Guardian profile">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Name">
                <input className={inputClass} value={accountDraft?.guardianName || ''} onChange={(event) => setAccountDraft((current: any) => ({ ...current, guardianName: event.target.value }))} />
              </Field>
              <Field label="Email">
                <input className={inputClass} value={accountDraft?.guardianEmail || ''} readOnly />
              </Field>
              <Field label="Phone">
                <input className={inputClass} value={accountDraft?.profile?.phone || ''} onChange={(event) => setAccountDraft((current: any) => ({ ...current, profile: { ...current.profile, phone: event.target.value } }))} />
              </Field>
              <Field label="Alternate phone">
                <input className={inputClass} value={accountDraft?.profile?.alternatePhone || ''} onChange={(event) => setAccountDraft((current: any) => ({ ...current, profile: { ...current.profile, alternatePhone: event.target.value } }))} />
              </Field>
              <Field label="Preferred channel">
                <select className={inputClass} value={accountDraft?.profile?.preferredChannel || 'EMAIL'} onChange={(event) => setAccountDraft((current: any) => ({ ...current, profile: { ...current.profile, preferredChannel: event.target.value } }))}>
                  {['EMAIL', 'SMS', 'PHONE'].map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </Field>
              <Field label="Address line">
                <input className={inputClass} value={accountDraft?.profile?.addressLine1 || ''} onChange={(event) => setAccountDraft((current: any) => ({ ...current, profile: { ...current.profile, addressLine1: event.target.value } }))} />
              </Field>
              <Field label="Suburb">
                <input className={inputClass} value={accountDraft?.profile?.suburb || ''} onChange={(event) => setAccountDraft((current: any) => ({ ...current, profile: { ...current.profile, suburb: event.target.value } }))} />
              </Field>
              <Field label="City">
                <input className={inputClass} value={accountDraft?.profile?.city || ''} onChange={(event) => setAccountDraft((current: any) => ({ ...current, profile: { ...current.profile, city: event.target.value } }))} />
              </Field>
            </div>
          </SectionCard>
          <SectionCard title="Notification settings">
            <div className="grid gap-3 md:grid-cols-2">
              {[
                ['emailNotifications', 'Email notifications'],
                ['smsNotifications', 'SMS notifications'],
                ['pushNotifications', 'Push notifications'],
                ['weeklyDigest', 'Weekly digest'],
                ['absenceAlerts', 'Absence alerts'],
                ['feeReminders', 'Fee reminders'],
                ['disciplineAlerts', 'Discipline alerts'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(accountDraft?.settings?.[key])}
                    onChange={(event) =>
                      setAccountDraft((current: any) => ({
                        ...current,
                        settings: { ...current.settings, [key]: event.target.checked },
                      }))
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
            <button onClick={() => void saveAccount()} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
              Save account changes
            </button>
          </SectionCard>
        </div>
      );
    }

    return <EmptyState text="This module is ready for use." />;
  };

  return (
    <DashboardLayout title="Parent Portal">
      <div className="space-y-6">
        <section className="rounded-3xl bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_52%,#06b6d4_100%)] p-6 text-white shadow-xl shadow-blue-900/15">
          <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
                {branding?.schoolName || 'POPIN School'}
              </p>
              <h2 className="mt-2 text-3xl font-bold">Parent portal</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
                A complete family workspace for homework, attendance, discipline, messages, fees, appointments,
                reports, notifications, and support.
              </p>
            </div>

            <div className="rounded-3xl bg-white/10 p-5 backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">Selected learner</p>
              {selected ? (
                <div className="mt-3 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
                      <UserRound />
                    </div>
                    <div>
                      <p className="text-lg font-bold">
                        {selected.learner.firstName} {selected.learner.lastName}
                      </p>
                      <p className="text-sm text-blue-100">
                        {selected.learner.studentNumber} / {selected.permissions.relationshipType}
                      </p>
                    </div>
                  </div>

                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                      {children.length > 1 ? 'Switch learner' : 'Linked learner'}
                    </span>
                    <select
                      className="w-full rounded-2xl border border-white/15 bg-slate-950/20 px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-white/30"
                      value={selectedId}
                      onChange={(event) => setSelectedId(event.target.value)}
                    >
                      {children.map(({ learner }: any) => (
                        <option key={learner.id} value={learner.id} className="text-slate-900">
                          {learner.firstName} {learner.lastName} / {learner.studentNumber}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : (
                <p className="mt-3 text-sm text-blue-100">No learner linked yet.</p>
              )}
            </div>
          </div>
        </section>

        {!loadingChildren && !children.length && (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center">
            <LockKeyhole className="mx-auto h-10 w-10 text-amber-600" />
            <h3 className="mt-4 text-xl font-bold text-amber-900">Your account is ready, but no learner is linked</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm text-amber-800">
              Parent access appears once the school links your email to a verified guardian record.
            </p>
          </div>
        )}

        {loadingChildren && <PortalLoader label="Loading your family portal..." />}

        {!loadingChildren && !!children.length && (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Portal modules</p>
              <h3 className="mt-1 text-xl font-bold text-slate-950">Choose an area</h3>
              <p className="mt-1 text-sm text-slate-500">
                Open the area you want to manage for the currently selected learner. Cards automatically respect the
                permissions linked to this guardian relationship.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {visibleSections.map(({ key, label, icon: Icon }) => {
                const selectedSection = active === key;
                return (
                  <button
                    key={key}
                    onClick={() => setActive(key)}
                    className={`rounded-2xl border p-4 text-left shadow-sm transition ${
                      selectedSection
                        ? 'border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                          selectedSection ? 'bg-white/15 text-white' : 'bg-blue-50 text-blue-600'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                          selectedSection ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        Open
                      </span>
                    </div>
                    <p className="mt-4 text-sm font-semibold">{label}</p>
                    <p className={`mt-1 text-xs ${selectedSection ? 'text-blue-100' : 'text-slate-500'}`}>
                      {selectedSection ? 'Module open' : `Open ${label.toLowerCase()} for this learner.`}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>

      <Modal
        open={!!active}
        onClose={closeModule}
        title={
          selected && learnerRequiredSections.has(active as SectionKey)
            ? `${currentSectionLabel} - ${selected.learner.firstName} ${selected.learner.lastName}`
            : currentSectionLabel
        }
        wide
      >
        {renderActiveModule()}
      </Modal>
    </DashboardLayout>
  );
}

function Banner({ text, tone }: { text: string; tone: 'blue' | 'amber' }) {
  return (
    <div
      className={`rounded-2xl border p-4 text-sm ${
        tone === 'amber' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-blue-200 bg-blue-50 text-blue-800'
      }`}
    >
      {text}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="mb-4 text-sm font-bold text-slate-950">{title}</h3>
      {children}
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-bold text-slate-950">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold text-slate-600">
      <span className="mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-slate-500">{text}</p>;
}

function SimpleItems({ items, empty }: { items: any[]; empty: string }) {
  if (!items?.length) return <EmptyState text={empty} />;
  return (
    <div className="space-y-3">
      {items.map((item: any, index: number) => (
        <div key={item.id || index} className="rounded-2xl border border-slate-200 p-4">
          <div className="flex justify-between gap-3">
            <b className="text-sm text-slate-900">
              {item.title || item.subject || item.reference || item.term || item.status || 'Record'}
            </b>
            <span className="text-xs text-slate-500">
              {item.dueAt
                ? new Date(item.dueAt).toLocaleDateString()
                : item.startsAt
                  ? new Date(item.startsAt).toLocaleDateString()
                  : item.submittedAt
                    ? new Date(item.submittedAt).toLocaleDateString()
                    : item.status}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            {item.instructions ||
              item.message ||
              item.description ||
              item.notes ||
              (item.amount !== undefined ? `R ${Number(item.amount).toFixed(2)}` : '')}
          </p>
        </div>
      ))}
    </div>
  );
}

function PaymentList({ items }: { items: any[] }) {
  return (
    <div className="space-y-3">
      {items.map((item: any) => (
        <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
          <div className="flex justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                R {Number(item.amount || 0).toFixed(2)} / {item.method}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {item.reference} / {item.proofFileName || 'No proof file name provided'}
              </p>
            </div>
            <span className={`rounded-full px-2 py-1 text-xs font-bold ${item.status === 'VERIFIED' ? 'bg-emerald-50 text-emerald-700' : item.status === 'REJECTED' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{item.status}</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">{new Date(item.paidAt).toLocaleString()}</p>
          <p className="mt-2 text-xs text-slate-600">
            {item.method === 'PAYSTACK' ? 'Processed through online checkout.' : 'Submitted to the school for finance review.'}
          </p>
        </div>
      ))}
    </div>
  );
}

function DisciplineItems({
  items,
  onAcknowledge,
}: {
  items: any[];
  onAcknowledge: (recordId: string) => void;
}) {
  if (!items?.length) return <EmptyState text="No disciplinary records are visible for this learner." />;
  return (
    <div className="space-y-3">
      {items.map((item: any) => (
        <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{item.title}</p>
              <p className="mt-1 text-xs text-slate-500">
                {item.category} / {item.severity} / {item.status}
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
              {new Date(item.occurredAt).toLocaleDateString()}
            </span>
          </div>
          <p className="mt-3 text-sm text-slate-600">{item.description || 'No description provided.'}</p>
          {item.actionTaken && <p className="mt-2 text-xs text-slate-500">Action taken: {item.actionTaken}</p>}
          {item.requiresAcknowledgement && (
            <p className="mt-2 text-xs text-slate-500">
              {item.parentAcknowledgedAt
                ? `Acknowledged on ${new Date(item.parentAcknowledgedAt).toLocaleString()}`
                : 'Awaiting parent acknowledgement'}
            </p>
          )}
          {item.requiresAcknowledgement && !item.parentAcknowledgedAt && (
            <button
              onClick={() => onAcknowledge(item.id)}
              className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Acknowledge
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
