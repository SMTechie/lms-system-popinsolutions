import React, { useEffect, useState } from 'react';
import { downloadDocument } from '../lib/documents';
import {
  AlertTriangle,
  CheckSquare,
  Clock,
  DollarSign,
  GraduationCap,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Ticket,
  TrendingUp,
  UserCog,
  Users,
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import DashboardCard from '../components/DashboardCard';
import ChartWidget from '../components/ChartWidget';
import ActivityFeed from '../components/ActivityFeed';
import PortalLoader from '../components/PortalLoader';
import { apiRequest } from '../lib/api';
import { notifyAction } from '../lib/notify';
import { useBranding } from '../settings/BrandingContext';

const iconMap = {
  'Open Tasks': <CheckSquare className="h-5 w-5 text-blue-600" />,
  'Open Tickets': <Ticket className="h-5 w-5 text-violet-600" />,
  'Store Sales Today': <ShoppingBag className="h-5 w-5 text-emerald-600" />,
  'Outstanding Fees': <DollarSign className="h-5 w-5 text-amber-600" />,
  'Admissions Pipeline': <GraduationCap className="h-5 w-5 text-cyan-600" />,
  'Pending Approvals': <Clock className="h-5 w-5 text-rose-600" />,
  'Low Stock Alerts': <AlertTriangle className="h-5 w-5 text-orange-600" />,
  'Active Users': <TrendingUp className="h-5 w-5 text-indigo-600" />,
} as const;

const iconBgMap = {
  'Open Tasks': 'bg-blue-50',
  'Open Tickets': 'bg-violet-50',
  'Store Sales Today': 'bg-emerald-50',
  'Outstanding Fees': 'bg-amber-50',
  'Admissions Pipeline': 'bg-cyan-50',
  'Pending Approvals': 'bg-rose-50',
  'Low Stock Alerts': 'bg-orange-50',
  'Active Users': 'bg-indigo-50',
} as const;

export default function Home() {
  const { branding } = useBranding();
  const [dashboard, setDashboard] = useState<any>(null);
  const [audit, setAudit] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [dashboardData, auditData, userData] = await Promise.all([
        apiRequest('/admin/dashboard'),
        apiRequest<any[]>('/admin/audit'),
        apiRequest<any[]>('/admin/users'),
      ]);
      setDashboard(dashboardData);
      setAudit(Array.isArray(auditData) ? auditData : []);
      setUsers(Array.isArray(userData) ? userData : []);
    } catch (error: any) {
      notifyAction(error.message || 'Could not load dashboard.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const runAction = async (key: string, action: () => Promise<void>, success: string) => {
    setBusyKey(key);
    try {
      await action();
      notifyAction(success, 'success');
      await load();
    } catch (error: any) {
      notifyAction(error.message || 'Action failed.', 'error');
    } finally {
      setBusyKey('');
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Dashboard">
        <PortalLoader label="Loading dashboard overview..." />
      </DashboardLayout>
    );
  }

  const schoolName = branding?.schoolName || 'your school';
  const overviewCards = Array.isArray(dashboard?.overviewCards) ? dashboard.overviewCards : [];
  const pipelineCards = Array.isArray(dashboard?.pipelineCards) ? dashboard.pipelineCards : [];
  const admissions = Array.isArray(dashboard?.admissions) ? dashboard.admissions : [];
  const activity = Array.isArray(dashboard?.activity) ? dashboard.activity : [];
  const ticketChart = Array.isArray(dashboard?.ticketChart) ? dashboard.ticketChart : [];
  const revenueChart = Array.isArray(dashboard?.revenueChart) ? dashboard.revenueChart : [];
  const approvalQueue = Array.isArray(dashboard?.approvalQueue) ? dashboard.approvalQueue : [];
  const financeQueue = Array.isArray(dashboard?.financeQueue) ? dashboard.financeQueue : [];
  const communicationQueue = Array.isArray(dashboard?.communicationQueue) ? dashboard.communicationQueue : [];
  const appointmentQueue = Array.isArray(dashboard?.appointmentQueue) ? dashboard.appointmentQueue : [];
  const accessQueue = Array.isArray(dashboard?.accessQueue) ? dashboard.accessQueue : users.filter((item) => item.role !== 'ADMIN');

  return (
    <DashboardLayout title="Dashboard">
      <div className="space-y-6">
        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="grid lg:grid-cols-[1.4fr_0.9fr]">
            <div className="p-6 lg:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  Admin operations hub
                </span>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Friday, July 31, 2026
                </span>
              </div>
              <h2 className="mt-5 max-w-2xl font-heading text-2xl font-bold text-gray-950 sm:text-3xl">
                Leadership command centre for {schoolName}.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-500">
                Approve workflows, verify payments, oversee communication, review appointments, inspect access, and
                keep the full school operation moving from one admin workspace.
              </p>
            </div>
            <div className="border-t border-gray-200 bg-gray-50 p-6 lg:border-l lg:border-t-0 lg:p-8">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Control queue</p>
                <button onClick={() => void load()} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600">
                  <RefreshCw className="mr-1 inline h-3.5 w-3.5" />
                  Refresh
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {[
                  ['Approvals waiting', approvalQueue.length],
                  ['Payments to verify', financeQueue.length],
                  ['Open conversations', communicationQueue.length],
                  ['Appointments scheduled', appointmentQueue.length],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
                    <span className="text-sm text-gray-600">{label}</span>
                    <span className="font-heading text-xl font-bold text-gray-950">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {overviewCards.map((card: any) => (
            <DashboardCard
              key={card.title}
              title={card.title}
              value={card.value}
              subtitle={card.subtitle}
              icon={iconMap[card.title as keyof typeof iconMap] || <TrendingUp className="h-5 w-5 text-blue-600" />}
              iconBg={iconBgMap[card.title as keyof typeof iconBgMap] || 'bg-blue-50'}
            />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pipelineCards.map((card: any) => (
            <DashboardCard
              key={card.title}
              title={card.title}
              value={card.value}
              subtitle={card.subtitle}
              icon={iconMap[card.title as keyof typeof iconMap] || <TrendingUp className="h-5 w-5 text-blue-600" />}
              iconBg={iconBgMap[card.title as keyof typeof iconBgMap] || 'bg-blue-50'}
            />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ChartWidget
              title="Store Revenue Overview"
              subtitle="Recent operating months"
              type="bar"
              data={revenueChart}
              nameKey="month"
              dataKeys={[{ key: 'revenue', color: '#2563EB', name: 'Revenue' }]}
              height={240}
            />
          </div>
          <ChartWidget
            title="Tickets by Category"
            subtitle="Current operational ticket mix"
            type="pie"
            data={ticketChart}
            nameKey="name"
            valueKey="value"
            height={240}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <ActionPanel title="Unified Approvals" icon={CheckSquare}>
            {approvalQueue.length ? (
              approvalQueue.map((item: any) => (
                <QueueRow
                  key={item.type + item.id}
                  title={item.title}
                  subtitle={`${item.owner} / ${item.detail}`}
                  status={item.status}
                  actions={
                    item.type === 'REQUISITION' ? (
                      <button
                        onClick={() =>
                          void runAction(
                            `approve-${item.id}`,
                            () => apiRequest(`/admin/approvals/requisitions/${item.id}/approve`, { method: 'POST' }).then(() => undefined),
                            'Requisition approved.',
                          )
                        }
                        disabled={busyKey === `approve-${item.id}`}
                        className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:bg-slate-300"
                      >
                        Approve
                      </button>
                    ) : (
                      <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">Tracked</span>
                    )
                  }
                />
              ))
            ) : (
              <EmptyPanel text="No approvals are waiting right now." />
            )}
          </ActionPanel>

          <ActionPanel title="Finance Verification" icon={DollarSign}>
            {financeQueue.length ? (
              financeQueue.map((item: any) => (
                <QueueRow
                  key={item.id}
                  title={`${item.learnerName} / R ${Number(item.amount || 0).toFixed(2)}`}
                  subtitle={`${item.method} / ${item.reference} / ${item.proofFileName || 'No proof file name'}`}
                  status={item.status}
                  actions={
                    <div className="flex gap-2">
                      {item.proofDocumentId && <button className="text-sm text-blue-700 underline" onClick={() => void downloadDocument(item.proofDocumentId, item.proofFileName || 'proof.pdf').catch(error => notifyAction(error.message, 'error'))}>View proof</button>}
                      <button
                        onClick={() =>
                          void runAction(
                            `verify-${item.id}`,
                            () => apiRequest(`/admin/finance/payments/${item.id}/verify`, { method: 'POST' }).then(() => undefined),
                            'Payment verified.',
                          )
                        }
                        disabled={busyKey === `verify-${item.id}`}
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:bg-slate-300"
                      >
                        Verify
                      </button>
                      <button
                        onClick={() =>
                          void runAction(
                            `reject-${item.id}`,
                            () => apiRequest(`/admin/finance/payments/${item.id}/reject`, { method: 'POST' }).then(() => undefined),
                            'Payment rejected.',
                          )
                        }
                        disabled={busyKey === `reject-${item.id}`}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:bg-slate-100"
                      >
                        Reject
                      </button>
                    </div>
                  }
                />
              ))
            ) : (
              <EmptyPanel text="No parent payments are waiting for verification." />
            )}
          </ActionPanel>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <ActionPanel title="Communication Hub" icon={Users}>
            {communicationQueue.length ? (
              communicationQueue.map((item: any) => (
                <QueueRow
                  key={item.id}
                  title={item.subject}
                  subtitle={`${item.learnerName} / ${item.latestMessage}`}
                  status={item.status}
                  actions={
                    <button
                      onClick={() =>
                        void runAction(
                          `close-thread-${item.id}`,
                          () => apiRequest(`/admin/communications/threads/${item.id}/close`, { method: 'POST' }).then(() => undefined),
                          'Conversation closed.',
                        )
                      }
                      disabled={busyKey === `close-thread-${item.id}`}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:bg-slate-100"
                    >
                      Close thread
                    </button>
                  }
                />
              ))
            ) : (
              <EmptyPanel text="No live parent communication threads are open." />
            )}
          </ActionPanel>

          <ActionPanel title="Appointment Oversight" icon={Clock}>
            {appointmentQueue.length ? (
              appointmentQueue.map((item: any) => (
                <QueueRow
                  key={item.id}
                  title={item.title}
                  subtitle={`${item.learnerName} / ${new Date(item.startsAt).toLocaleString('en-ZA')}`}
                  status={item.status}
                  actions={
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          void runAction(
                            `confirm-appt-${item.id}`,
                            () => apiRequest(`/admin/appointments/${item.id}/confirm`, { method: 'POST' }).then(() => undefined),
                            'Appointment confirmed.',
                          )
                        }
                        disabled={busyKey === `confirm-appt-${item.id}`}
                        className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:bg-slate-300"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() =>
                          void runAction(
                            `cancel-appt-${item.id}`,
                            () => apiRequest(`/admin/appointments/${item.id}/cancel`, { method: 'POST' }).then(() => undefined),
                            'Appointment cancelled.',
                          )
                        }
                        disabled={busyKey === `cancel-appt-${item.id}`}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:bg-slate-100"
                      >
                        Cancel
                      </button>
                    </div>
                  }
                />
              ))
            ) : (
              <EmptyPanel text="No appointments are currently in the admin queue." />
            )}
          </ActionPanel>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <ActionPanel title="Access Management" icon={UserCog}>
            {accessQueue.length ? (
              accessQueue.slice(0, 8).map((item: any) => (
                <QueueRow
                  key={item.id}
                  title={item.name || item.email}
                  subtitle={item.email}
                  status={item.role}
                  actions={
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          void runAction(
                            `make-admin-${item.id}`,
                            () => apiRequest(`/admin/users/${item.id}`, { method: 'PATCH', body: JSON.stringify({ role: 'ADMIN' }) }).then(() => undefined),
                            'User promoted to admin.',
                          )
                        }
                        disabled={busyKey === `make-admin-${item.id}` || item.role === 'ADMIN'}
                        className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:bg-slate-300"
                      >
                        Make admin
                      </button>
                      <button
                        onClick={() =>
                          void runAction(
                            `make-teacher-${item.id}`,
                            () => apiRequest(`/admin/users/${item.id}`, { method: 'PATCH', body: JSON.stringify({ role: 'TEACHER' }) }).then(() => undefined),
                            'User role updated to teacher.',
                          )
                        }
                        disabled={busyKey === `make-teacher-${item.id}`}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:bg-slate-100"
                      >
                        Make teacher
                      </button>
                    </div>
                  }
                />
              ))
            ) : (
              <EmptyPanel text="No access actions are waiting." />
            )}
          </ActionPanel>

          <ActionPanel title="Audit Trail" icon={ShieldCheck}>
            {audit.length ? (
              <div className="space-y-3">
                {audit.slice(0, 10).map((item: any) => (
                  <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <p className="text-sm font-semibold text-slate-900">{item.action}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.entity} / {item.entityId}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">{new Date(item.createdAt).toLocaleString('en-ZA')}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyPanel text="No audit activity is available yet." />
            )}
          </ActionPanel>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white p-6 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Admissions Pipeline</h3>
              <span className="text-xs font-medium text-blue-600">{admissions.length} submission(s)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Applicant', 'Guardian', 'Reference', 'Date', 'Status'].map((heading) => (
                      <th key={heading} className="pb-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {admissions.map((application: any) => (
                    <tr key={application.id} className="transition hover:bg-gray-50">
                      <td className="py-2.5 text-sm font-medium text-gray-800">{application.applicantName}</td>
                      <td className="py-2.5 text-sm text-gray-500">{application.guardianName}</td>
                      <td className="py-2.5 text-sm text-gray-600">{application.submissionReference}</td>
                      <td className="py-2.5 text-sm text-gray-400">{new Date(application.submittedAt).toLocaleDateString('en-ZA')}</td>
                      <td className="py-2.5">
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                          {application.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {admissions.length === 0 && <p className="py-8 text-center text-sm text-gray-500">No admissions submissions found.</p>}
            </div>
          </div>

          <ActivityFeed items={activity} />
        </div>
      </div>
    </DashboardLayout>
  );
}

function ActionPanel({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-lg bg-blue-50 p-2">
          <Icon className="h-4 w-4 text-blue-600" />
        </div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function QueueRow({
  title,
  subtitle,
  status,
  actions,
}: {
  title: string;
  subtitle: string;
  status: string;
  actions: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-100 p-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">{status}</span>
      </div>
      <div className="shrink-0">{actions}</div>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-gray-500">{text}</p>;
}
