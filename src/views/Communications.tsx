import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, FileText, Mail, Megaphone, MessageSquareMore, Plus, Send, Smartphone, Users, XCircle } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import Modal from '../components/Modal';
import PortalLoader from '../components/PortalLoader';
import { apiRequest } from '../lib/api';
import { notifyAction } from '../lib/notify';
import { useAuth } from '../auth/AuthContext';

const inputClass =
  'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10';

export default function Communications() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [savingProviders, setSavingProviders] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [activeModal, setActiveModal] = useState<'campaign' | 'resource' | 'event' | null>(null);
  const [campaign, setCampaign] = useState({
    title: '',
    audienceId: '',
    channels: ['APP', 'EMAIL'],
    subject: '',
    content: '',
    scheduledFor: '',
    status: 'DRAFT',
  });
  const [resource, setResource] = useState({
    title: '',
    type: 'DOCUMENT',
    category: 'General',
    audienceId: '',
    visibility: 'PARENT_STUDENT',
    url: '',
  });
  const [event, setEvent] = useState({
    title: '',
    category: 'Event',
    location: '',
    startsAt: '',
    endsAt: '',
    audienceId: '',
  });
  const [providerForm, setProviderForm] = useState<any>({
    email: { provider: 'RESEND', enabled: true, fromAddress: '' },
    sms: { provider: 'NONE', enabled: false, senderId: 'POPIN', callbackUrl: '' },
    whatsapp: { provider: 'NONE', enabled: false, businessAccountId: '', templateNamespace: '' },
    push: { provider: 'PWA', enabled: true, vapidConfigured: false },
  });
  const [testEmail, setTestEmail] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiRequest('/admin/communications');
      setData(response);
      setProviderForm(
        response?.providers || {
          email: { provider: 'RESEND', enabled: true, fromAddress: '' },
          sms: { provider: 'NONE', enabled: false, senderId: 'POPIN', callbackUrl: '' },
          whatsapp: { provider: 'NONE', enabled: false, businessAccountId: '', templateNamespace: '' },
          push: { provider: 'PWA', enabled: true, vapidConfigured: false },
        },
      );
      setTestEmail(response?.providers?.email?.fromAddress || '');
    } catch (error: any) {
      notifyAction(error.message || 'Could not load communications hub.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const audiences = useMemo(() => (Array.isArray(data?.audiences) ? data.audiences : []), [data]);
  const campaigns = useMemo(() => (Array.isArray(data?.campaigns) ? data.campaigns : []), [data]);
  const resources = useMemo(() => (Array.isArray(data?.resources) ? data.resources : []), [data]);
  const calendar = useMemo(() => (Array.isArray(data?.calendar) ? data.calendar : []), [data]);
  const deliveryLogs = useMemo(() => (Array.isArray(data?.deliveryLogs) ? data.deliveryLogs : []), [data]);
  const providerCards = useMemo(
    () => [
      {
        id: 'email',
        label: 'Email',
        provider: providerForm.email?.provider || 'RESEND',
        description: providerForm.email?.fromAddress || 'No sender address configured',
        active: Boolean(providerForm.email?.enabled),
        icon: Mail,
      },
      {
        id: 'sms',
        label: 'SMS',
        provider: providerForm.sms?.provider || 'NONE',
        description: providerForm.sms?.fromNumber || providerForm.sms?.senderId || 'No sender configured',
        active: Boolean(providerForm.sms?.enabled),
        icon: Smartphone,
      },
      {
        id: 'whatsapp',
        label: 'WhatsApp',
        provider: providerForm.whatsapp?.provider || 'NONE',
        description: providerForm.whatsapp?.fromNumber || 'No sender configured',
        active: Boolean(providerForm.whatsapp?.enabled),
        icon: MessageSquareMore,
      },
      {
        id: 'push',
        label: 'App / Push',
        provider: providerForm.push?.provider || 'PWA',
        description: providerForm.push?.vapidConfigured ? 'Push keys configured' : 'Web app delivery only',
        active: Boolean(providerForm.push?.enabled),
        icon: CheckCircle2,
      },
    ],
    [providerForm],
  );
  const availableChannels = useMemo(
    () => providerCards.filter((item) => item.active && item.provider !== 'NONE').map((item) => ({ id: item.id === 'push' ? 'APP' : item.id.toUpperCase(), label: item.id === 'push' ? 'App / Push' : item.label })),
    [providerCards],
  );

  useEffect(() => {
    setCampaign((current) => ({
      ...current,
      channels: current.channels.filter((channel) => availableChannels.some((item) => item.id === channel)),
    }));
  }, [availableChannels]);

  const createCampaign = async () => {
    try {
      await apiRequest('/admin/communications/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          ...campaign,
          status: campaign.scheduledFor ? 'SCHEDULED' : 'DRAFT',
        }),
      });
      setCampaign({ title: '', audienceId: '', channels: ['APP', 'EMAIL'], subject: '', content: '', scheduledFor: '', status: 'DRAFT' });
      setActiveModal(null);
      notifyAction('Campaign saved.', 'success');
      await load();
    } catch (error: any) {
      notifyAction(error.message || 'Could not save campaign.', 'error');
    }
  };

  const sendCampaign = async (campaignId: string) => {
    try {
      await apiRequest(`/admin/communications/campaigns/${campaignId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'SENT' }),
      });
      notifyAction('Campaign sent.', 'success');
      await load();
    } catch (error: any) {
      notifyAction(error.message || 'Could not send campaign.', 'error');
    }
  };

  const createResource = async () => {
    try {
      await apiRequest('/admin/communications/resources', {
        method: 'POST',
        body: JSON.stringify(resource),
      });
      setResource({ title: '', type: 'DOCUMENT', category: 'General', audienceId: '', visibility: 'PARENT_STUDENT', url: '' });
      setActiveModal(null);
      notifyAction('Resource added.', 'success');
      await load();
    } catch (error: any) {
      notifyAction(error.message || 'Could not add resource.', 'error');
    }
  };

  const createEvent = async () => {
    try {
      await apiRequest('/admin/communications/calendar', {
        method: 'POST',
        body: JSON.stringify(event),
      });
      setEvent({ title: '', category: 'Event', location: '', startsAt: '', endsAt: '', audienceId: '' });
      setActiveModal(null);
      notifyAction('Calendar event created.', 'success');
      await load();
    } catch (error: any) {
      notifyAction(error.message || 'Could not create event.', 'error');
    }
  };

  const saveProviders = async () => {
    setSavingProviders(true);
    try {
      await apiRequest('/admin/communications/providers', {
        method: 'PUT',
        body: JSON.stringify(providerForm),
      });
      notifyAction('Communication providers updated.', 'success');
      await load();
    } catch (error: any) {
      notifyAction(error.message || 'Could not update providers.', 'error');
    } finally {
      setSavingProviders(false);
    }
  };

  const sendTestEmail = async () => {
    setTestingEmail(true);
    try {
      const result = await apiRequest('/admin/communications/providers/test-email', {
        method: 'POST',
        body: JSON.stringify({ email: testEmail }),
      });
      notifyAction(result?.skipped ? 'Test email skipped because email delivery is not configured.' : 'Test email dispatched.', 'success');
      await load();
    } catch (error: any) {
      notifyAction(error.message || 'Could not send test email.', 'error');
    } finally {
      setTestingEmail(false);
    }
  };

  return (
    <DashboardLayout title="Communications">
      <div className="space-y-6">
        <section className="rounded-3xl bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_52%,#06b6d4_100%)] p-6 text-white shadow-xl shadow-blue-900/15">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">School communications</p>
              <h2 className="mt-1 text-3xl font-bold">One publishing desk for families and learners</h2>
              <p className="mt-2 max-w-3xl text-sm text-blue-100">
                Manage campaigns, audience groups, shared resources, and calendar events from one communications hub.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setActiveModal('campaign')} className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20">
                <Megaphone className="mr-2 inline h-4 w-4" />
                New campaign
              </button>
              <button onClick={() => setActiveModal('resource')} className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20">
                <FileText className="mr-2 inline h-4 w-4" />
                Add resource
              </button>
              <button onClick={() => setActiveModal('event')} className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20">
                <CalendarDays className="mr-2 inline h-4 w-4" />
                Add event
              </button>
            </div>
          </div>
        </section>

        {loading && <PortalLoader label="Loading communications hub..." />}

        {!loading && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <Metric label="Campaigns" value={String(data?.summary?.campaigns || 0)} />
              <Metric label="Scheduled" value={String(data?.summary?.scheduled || 0)} />
              <Metric label="Sent" value={String(data?.summary?.sent || 0)} />
              <Metric label="Delivery rate" value={`${data?.summary?.deliveryRate || 0}%`} />
              <Metric label="Provider ready" value={String(data?.summary?.providerReady || 0)} />
            </div>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Delivery command centre</p>
                  <h3 className="mt-1 text-xl font-bold text-slate-950">Integration health across every school channel</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    View which channels are live, which sender details are in use, and how ready the school is for outbound family communication.
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Channel delivery rate</p>
                  <p className="mt-2 text-2xl font-bold text-slate-950">{data?.summary?.channelDeliveryRate || 0}%</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {providerCards.map(({ id, label, provider, description, active, icon: Icon }) => (
                  <div key={id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm">
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                        {active ? 'Live' : 'Off'}
                      </span>
                    </div>
                    <p className="mt-4 text-sm font-semibold text-slate-900">{label}</p>
                    <p className="mt-1 text-xs text-slate-500">{provider}</p>
                    <p className="mt-3 text-xs leading-5 text-slate-600">{description}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-950">Audience targeting</h3>
                </div>
                <div className="mt-4 space-y-3">
                  {audiences.map((audience: any) => (
                    <div key={audience.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{audience.name}</p>
                          <p className="mt-1 text-xs text-slate-500">{audience.type} audience</p>
                        </div>
                        <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">
                          {audience.memberCount} members
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Megaphone className="h-5 w-5 text-blue-600" />
                    <h3 className="text-sm font-bold text-slate-950">Campaign pipeline</h3>
                  </div>
                  <button onClick={() => setActiveModal('campaign')} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
                    <Plus className="mr-1 inline h-4 w-4" />
                    New
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  {campaigns.length ? campaigns.map((item: any) => (
                    <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.channels.join(' / ')} • {item.subject || 'No subject'}
                          </p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{item.status}</span>
                      </div>
                      <p className="mt-3 text-sm text-slate-600">{item.content}</p>
                      <div className="mt-4 grid gap-2 sm:grid-cols-4">
                        <Mini label="Recipients" value={String(item.metrics?.recipients || 0)} />
                        <Mini label="Delivered" value={String(item.metrics?.delivered || 0)} />
                        <Mini label="Opened" value={String(item.metrics?.opened || 0)} />
                        <Mini label="Failed" value={String(item.metrics?.failed || 0)} />
                      </div>
                      {item.status !== 'SENT' && (
                        <button onClick={() => void sendCampaign(item.id)} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
                          <Send className="mr-2 inline h-4 w-4" />
                          Send now
                        </button>
                      )}
                    </div>
                  )) : <Empty text="No communications campaigns have been created yet." />}
                </div>
              </section>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-950">Channel providers</h3>
                    <p className="mt-1 text-xs text-slate-500">Configure email, SMS, WhatsApp, and app delivery settings for school-wide communication.</p>
                  </div>
                  {isAdmin && <button
                    onClick={() => void saveProviders()}
                    disabled={savingProviders}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingProviders ? 'Saving...' : 'Save providers'}
                  </button>}
                </div>
                <p className="mt-2 text-xs text-slate-500">{isAdmin ? 'Configure providers here. Other users can only select channels marked Live when creating a campaign.' : 'Channels are configured by an administrator. Select from the Live channels when creating a campaign.'}</p>
                <fieldset disabled={!isAdmin} className="mt-5 grid gap-4 md:grid-cols-2">
                  <ProviderCard
                    title="Email"
                    enabled={providerForm.email?.enabled}
                    onToggle={(value) => setProviderForm((current: any) => ({ ...current, email: { ...current.email, enabled: value } }))}
                  >
                    <Field label="Provider">
                      <select className={inputClass} value={providerForm.email?.provider || 'RESEND'} onChange={(e) => setProviderForm((current: any) => ({ ...current, email: { ...current.email, provider: e.target.value } }))}>
                        <option value="RESEND">Resend</option>
                        <option value="SMTP">SMTP</option>
                      </select>
                    </Field>
                    <Field label="From address">
                      <input className={inputClass} value={providerForm.email?.fromAddress || ''} onChange={(e) => setProviderForm((current: any) => ({ ...current, email: { ...current.email, fromAddress: e.target.value } }))} />
                    </Field>
                  </ProviderCard>

                  <ProviderCard
                    title="SMS"
                    enabled={providerForm.sms?.enabled}
                    onToggle={(value) => setProviderForm((current: any) => ({ ...current, sms: { ...current.sms, enabled: value } }))}
                  >
                    <Field label="Provider">
                      <select className={inputClass} value={providerForm.sms?.provider || 'NONE'} onChange={(e) => setProviderForm((current: any) => ({ ...current, sms: { ...current.sms, provider: e.target.value } }))}>
                        <option value="NONE">Not connected</option>
                        <option value="TWILIO">Twilio</option>
                        <option value="CLICKATELL">Clickatell</option>
                        <option value="BULKSMS">BulkSMS</option>
                      </select>
                    </Field>
                    <Field label="Sender ID">
                      <input className={inputClass} value={providerForm.sms?.senderId || ''} onChange={(e) => setProviderForm((current: any) => ({ ...current, sms: { ...current.sms, senderId: e.target.value } }))} />
                    </Field>
                    <Field label="Account SID">
                      <input className={inputClass} value={providerForm.sms?.accountSid || ''} onChange={(e) => setProviderForm((current: any) => ({ ...current, sms: { ...current.sms, accountSid: e.target.value } }))} />
                    </Field>
                    <Field label="Auth token">
                      <input className={inputClass} value={providerForm.sms?.authToken || ''} onChange={(e) => setProviderForm((current: any) => ({ ...current, sms: { ...current.sms, authToken: e.target.value } }))} />
                    </Field>
                    <Field label="From number">
                      <input className={inputClass} value={providerForm.sms?.fromNumber || ''} onChange={(e) => setProviderForm((current: any) => ({ ...current, sms: { ...current.sms, fromNumber: e.target.value } }))} placeholder="+27123456789" />
                    </Field>
                    <Field label="Status callback URL">
                      <input className={inputClass} value={providerForm.sms?.callbackUrl || ''} onChange={(e) => setProviderForm((current: any) => ({ ...current, sms: { ...current.sms, callbackUrl: e.target.value } }))} placeholder="https://your-school.app/api/webhooks/twilio/status" />
                    </Field>
                  </ProviderCard>

                  <ProviderCard
                    title="WhatsApp"
                    enabled={providerForm.whatsapp?.enabled}
                    onToggle={(value) => setProviderForm((current: any) => ({ ...current, whatsapp: { ...current.whatsapp, enabled: value } }))}
                  >
                    <Field label="Provider">
                      <select className={inputClass} value={providerForm.whatsapp?.provider || 'NONE'} onChange={(e) => setProviderForm((current: any) => ({ ...current, whatsapp: { ...current.whatsapp, provider: e.target.value } }))}>
                        <option value="NONE">Not connected</option>
                        <option value="META_CLOUD">Meta Cloud API</option>
                        <option value="TWILIO">Twilio WhatsApp</option>
                      </select>
                    </Field>
                    <Field label="Business account ID">
                      <input className={inputClass} value={providerForm.whatsapp?.businessAccountId || ''} onChange={(e) => setProviderForm((current: any) => ({ ...current, whatsapp: { ...current.whatsapp, businessAccountId: e.target.value } }))} />
                    </Field>
                    <Field label="Template namespace">
                      <input className={inputClass} value={providerForm.whatsapp?.templateNamespace || ''} onChange={(e) => setProviderForm((current: any) => ({ ...current, whatsapp: { ...current.whatsapp, templateNamespace: e.target.value } }))} />
                    </Field>
                    <Field label="Account SID">
                      <input className={inputClass} value={providerForm.whatsapp?.accountSid || ''} onChange={(e) => setProviderForm((current: any) => ({ ...current, whatsapp: { ...current.whatsapp, accountSid: e.target.value } }))} />
                    </Field>
                    <Field label="Auth token">
                      <input className={inputClass} value={providerForm.whatsapp?.authToken || ''} onChange={(e) => setProviderForm((current: any) => ({ ...current, whatsapp: { ...current.whatsapp, authToken: e.target.value } }))} />
                    </Field>
                    <Field label="From number">
                      <input className={inputClass} value={providerForm.whatsapp?.fromNumber || ''} onChange={(e) => setProviderForm((current: any) => ({ ...current, whatsapp: { ...current.whatsapp, fromNumber: e.target.value } }))} placeholder="whatsapp:+14155238886" />
                    </Field>
                    <Field label="Status callback URL">
                      <input className={inputClass} value={providerForm.whatsapp?.callbackUrl || ''} onChange={(e) => setProviderForm((current: any) => ({ ...current, whatsapp: { ...current.whatsapp, callbackUrl: e.target.value } }))} placeholder="https://your-school.app/api/webhooks/twilio/status" />
                    </Field>
                  </ProviderCard>

                  <ProviderCard
                    title="App / push"
                    enabled={providerForm.push?.enabled}
                    onToggle={(value) => setProviderForm((current: any) => ({ ...current, push: { ...current.push, enabled: value } }))}
                  >
                    <Field label="Provider">
                      <input className={inputClass} value={providerForm.push?.provider || 'PWA'} onChange={(e) => setProviderForm((current: any) => ({ ...current, push: { ...current.push, provider: e.target.value } }))} />
                    </Field>
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={Boolean(providerForm.push?.vapidConfigured)}
                        onChange={(e) => setProviderForm((current: any) => ({ ...current, push: { ...current.push, vapidConfigured: e.target.checked } }))}
                      />
                      VAPID keys configured
                    </label>
                  </ProviderCard>
                </fieldset>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[220px] flex-1">
                      <Field label="Test email address">
                        <input className={inputClass} value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="ops@popin.school" />
                      </Field>
                    </div>
                    {isAdmin && <button
                      onClick={() => void sendTestEmail()}
                      disabled={!testEmail || testingEmail}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {testingEmail ? 'Testing...' : 'Send test email'}
                    </button>}
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-bold text-slate-950">Recent delivery activity</h3>
                <div className="mt-4 space-y-3">
                  {deliveryLogs.length ? deliveryLogs.slice(0, 8).map((item: any) => (
                    <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{item.channel} to {item.recipient}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.provider} • {item.recipientRole} • {new Date(item.createdAt).toLocaleString('en-ZA')}
                          </p>
                        </div>
                        <span className={`rounded-full px-2 py-1 text-xs font-bold ${item.status === 'DELIVERED' ? 'bg-emerald-50 text-emerald-700' : item.status === 'FAILED' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>{item.status}</span>
                      </div>
                      {item.error ? (
                        <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
                          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>{item.error}</span>
                        </div>
                      ) : (
                        <div className="mt-3 flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>Provider accepted this delivery event.</span>
                        </div>
                      )}
                    </div>
                  )) : <Empty text="No delivery activity has been recorded yet." />}
                </div>
              </section>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-bold text-slate-950">Shared resources</h3>
                <div className="mt-4 space-y-3">
                  {resources.length ? resources.map((item: any) => (
                    <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.category} • {item.visibility}</p>
                      <p className="mt-2 text-xs text-blue-600">{item.url}</p>
                    </div>
                  )) : <Empty text="No shared resources are published yet." />}
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-bold text-slate-950">Calendar publishing</h3>
                <div className="mt-4 space-y-3">
                  {calendar.length ? calendar.map((item: any) => (
                    <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {new Date(item.startsAt).toLocaleString()} • {item.location || 'School venue'}
                      </p>
                    </div>
                  )) : <Empty text="No calendar events have been published yet." />}
                </div>
              </section>
            </div>
          </>
        )}
      </div>

      <Modal title="Create campaign" isOpen={activeModal === 'campaign'} onClose={() => setActiveModal(null)}>
        <div className="space-y-4">
          <Field label="Campaign title"><input className={inputClass} value={campaign.title} onChange={(e) => setCampaign((v) => ({ ...v, title: e.target.value }))} /></Field>
          <Field label="Audience">
            <select className={inputClass} value={campaign.audienceId} onChange={(e) => setCampaign((v) => ({ ...v, audienceId: e.target.value }))}>
              <option value="">Select audience</option>
              {audiences.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </Field>
          <Field label="Delivery channels">
            <div className="grid gap-2 sm:grid-cols-2">
              {availableChannels.map((channel) => (
                <label key={channel.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={campaign.channels.includes(channel.id)}
                    onChange={(event) => setCampaign((current) => ({
                      ...current,
                      channels: event.target.checked
                        ? [...current.channels, channel.id]
                        : current.channels.filter((item) => item !== channel.id),
                    }))}
                  />
                  {channel.label}
                </label>
              ))}
            </div>
            {!availableChannels.length && <p className="text-xs text-rose-600">No communication providers are configured yet. Ask an administrator to configure a channel in Settings.</p>}
          </Field>
          <Field label="Subject"><input className={inputClass} value={campaign.subject} onChange={(e) => setCampaign((v) => ({ ...v, subject: e.target.value }))} /></Field>
          <Field label="Message"><textarea rows={5} className={inputClass} value={campaign.content} onChange={(e) => setCampaign((v) => ({ ...v, content: e.target.value }))} /></Field>
          <Field label="Schedule">
            <input type="datetime-local" className={inputClass} value={campaign.scheduledFor} onChange={(e) => setCampaign((v) => ({ ...v, scheduledFor: e.target.value }))} />
          </Field>
          <button onClick={() => void createCampaign()} className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white">Save campaign</button>
        </div>
      </Modal>

      <Modal title="Add shared resource" isOpen={activeModal === 'resource'} onClose={() => setActiveModal(null)}>
        <div className="space-y-4">
          <Field label="Title"><input className={inputClass} value={resource.title} onChange={(e) => setResource((v) => ({ ...v, title: e.target.value }))} /></Field>
          <Field label="Category"><input className={inputClass} value={resource.category} onChange={(e) => setResource((v) => ({ ...v, category: e.target.value }))} /></Field>
          <Field label="URL or path"><input className={inputClass} value={resource.url} onChange={(e) => setResource((v) => ({ ...v, url: e.target.value }))} /></Field>
          <button onClick={() => void createResource()} className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white">Publish resource</button>
        </div>
      </Modal>

      <Modal title="Create calendar event" isOpen={activeModal === 'event'} onClose={() => setActiveModal(null)}>
        <div className="space-y-4">
          <Field label="Title"><input className={inputClass} value={event.title} onChange={(e) => setEvent((v) => ({ ...v, title: e.target.value }))} /></Field>
          <Field label="Location"><input className={inputClass} value={event.location} onChange={(e) => setEvent((v) => ({ ...v, location: e.target.value }))} /></Field>
          <Field label="Starts at"><input type="datetime-local" className={inputClass} value={event.startsAt} onChange={(e) => setEvent((v) => ({ ...v, startsAt: e.target.value }))} /></Field>
          <Field label="Ends at"><input type="datetime-local" className={inputClass} value={event.endsAt} onChange={(e) => setEvent((v) => ({ ...v, endsAt: e.target.value }))} /></Field>
          <button onClick={() => void createEvent()} className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white">Publish event</button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}

function ProviderCard({
  title,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  enabled: boolean;
  onToggle: (value: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${enabled ? 'border-blue-200 bg-blue-50/30' : 'border-slate-200 bg-white'}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <input type="checkbox" checked={Boolean(enabled)} onChange={(e) => onToggle(e.target.checked)} />
          Enabled
        </label>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-800">{value}</p>
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

function Empty({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-slate-400">{text}</p>;
}
