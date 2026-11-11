import React, { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, CheckCircle2, Clock3, CreditCard, FileSpreadsheet, Plus, ShieldCheck, Wallet } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import Modal from '../components/Modal';
import PortalLoader from '../components/PortalLoader';
import { apiRequest } from '../lib/api';
import { notifyAction } from '../lib/notify';

const inputClass =
  'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10';

export default function Payments() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [savingGateways, setSavingGateways] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  const [showOfficePayment, setShowOfficePayment] = useState(false);
  const [officeFees, setOfficeFees] = useState<any[]>([]);
  const [learnerSearch, setLearnerSearch] = useState('');
  const [learnerResults, setLearnerResults] = useState<any[]>([]);
  const [selectedLearner, setSelectedLearner] = useState<any>(null);
  const [savingOfficePayment, setSavingOfficePayment] = useState(false);
  const [processingPaymentId, setProcessingPaymentId] = useState('');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [planSearch, setPlanSearch] = useState('');
  const [statementSearch, setStatementSearch] = useState('');
  const [paymentPage, setPaymentPage] = useState(1);
  const [planPage, setPlanPage] = useState(1);
  const [statementPage, setStatementPage] = useState(1);
  const [officePayment, setOfficePayment] = useState({ learnerId: '', feeId: '', paymentType: 'SCHOOL_FEES', amount: '', method: 'CASH', reference: '', paidAt: new Date().toISOString().slice(0, 16) });
  const [plan, setPlan] = useState({
    learnerId: '',
    title: '',
    instalmentAmount: '',
    frequency: 'MONTHLY',
    startDate: '',
    endDate: '',
    balance: '',
    notes: '',
  });
  const [gatewayForm, setGatewayForm] = useState<any>({
    primary: { provider: 'MANUAL_EFT', enabled: true, mode: 'manual', merchantId: '', publicKey: '', secretKey: '', callbackUrl: '', currency: 'ZAR' },
    alternatives: [],
  });

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiRequest('/admin/payments');
      setData(response);
      setGatewayForm(
        response?.gateways || {
          primary: { provider: 'MANUAL_EFT', enabled: true, mode: 'manual', merchantId: '', publicKey: '', secretKey: '', callbackUrl: '', currency: 'ZAR' },
          alternatives: [],
        },
      );
    } catch (error: any) {
      notifyAction(error.message || 'Could not load payments operations.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createPlan = async () => {
    try {
      await apiRequest('/admin/payments/plans', {
        method: 'POST',
        body: JSON.stringify({
          ...plan,
          instalmentAmount: Number(plan.instalmentAmount || 0),
          balance: Number(plan.balance || 0),
        }),
      });
      setPlan({ learnerId: '', title: '', instalmentAmount: '', frequency: 'MONTHLY', startDate: '', endDate: '', balance: '', notes: '' });
      setShowPlan(false);
      notifyAction('Payment plan created.', 'success');
      await load();
    } catch (error: any) {
      notifyAction(error.message || 'Could not create payment plan.', 'error');
    }
  };

  const updatePlanStatus = async (planId: string, status: string) => {
    try {
      await apiRequest(`/admin/payments/plans/${planId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      notifyAction('Payment plan updated.', 'success');
      await load();
    } catch (error: any) {
      notifyAction(error.message || 'Could not update payment plan.', 'error');
    }
  };

  const saveGateways = async () => {
    setSavingGateways(true);
    try {
      await apiRequest('/admin/payments/gateways', {
        method: 'PUT',
        body: JSON.stringify(gatewayForm),
      });
      notifyAction('Payment gateway settings updated.', 'success');
      await load();
    } catch (error: any) {
      notifyAction(error.message || 'Could not update payment gateways.', 'error');
    } finally {
      setSavingGateways(false);
    }
  };

  const openOfficePayment = async () => {
    try {
      const fees = await apiRequest<any[]>('/admin/finance/fees');
      setOfficeFees(Array.isArray(fees) ? fees : []);
      setLearnerSearch('');
      setLearnerResults([]);
      setSelectedLearner(null);
      setOfficePayment({ learnerId: '', feeId: '', paymentType: 'SCHOOL_FEES', amount: '', method: 'CASH', reference: '', paidAt: new Date().toISOString().slice(0, 16) });
      setShowOfficePayment(true);
    } catch (error: any) {
      notifyAction(error.message || 'Could not load outstanding fees.', 'error');
    }
  };

  const searchLearners = async (value: string) => {
    setLearnerSearch(value);
    setSelectedLearner(null);
    setOfficePayment((current) => ({ ...current, learnerId: '', feeId: '', amount: '' }));
    if (value.trim().length < 2) { setLearnerResults([]); return; }
    try {
      const results = await apiRequest<any[]>(`/admin/finance/learners?search=${encodeURIComponent(value)}`);
      setLearnerResults(Array.isArray(results) ? results : []);
    } catch (error: any) {
      notifyAction(error.message || 'Could not search learners.', 'error');
    }
  };

  const selectLearner = async (learner: any) => {
    setSelectedLearner(learner);
    setLearnerSearch(`${learner.name} · ${learner.studentNumber}`);
    setLearnerResults([]);
    setOfficePayment((current) => ({ ...current, learnerId: learner.id, feeId: '', amount: '' }));
    try {
      const fees = await apiRequest<any[]>(`/admin/finance/fees?learnerId=${encodeURIComponent(learner.id)}`);
      setOfficeFees(Array.isArray(fees) ? fees : []);
    } catch (error: any) {
      notifyAction(error.message || 'Could not load learner fees.', 'error');
    }
  };

  const captureOfficePayment = async () => {
    setSavingOfficePayment(true);
    try {
      await apiRequest('/admin/finance/payments', { method: 'POST', body: JSON.stringify({ ...officePayment, amount: Number(officePayment.amount) }) });
      setShowOfficePayment(false);
      notifyAction('Office payment recorded and sent for verification.', 'success');
      await load();
    } catch (error: any) {
      notifyAction(error.message || 'Could not record office payment.', 'error');
    } finally {
      setSavingOfficePayment(false);
    }
  };

  const reviewPayment = async (paymentId: string, decision: 'verify' | 'reject') => {
    setProcessingPaymentId(paymentId);
    try {
      await apiRequest(`/admin/finance/payments/${paymentId}/${decision}`, { method: 'POST' });
      notifyAction(decision === 'verify' ? 'Payment verified and balance updated.' : 'Payment rejected.', 'success');
      await load();
    } catch (error: any) {
      notifyAction(error.message || 'Could not review payment.', 'error');
    } finally {
      setProcessingPaymentId('');
    }
  };

  const pageSize = 12;
  const filterRows = (rows: any[], query: string, fields: string[]) => rows.filter((item) => fields.some((field) => String(item[field] || '').toLowerCase().includes(query.trim().toLowerCase())));
  const pageRows = (rows: any[], page: number) => rows.slice((page - 1) * pageSize, page * pageSize);
  const filteredPayments = filterRows(data?.payments || [], paymentSearch, ['learnerName', 'method', 'reference', 'status', 'paymentType']);
  const filteredPlans = filterRows(data?.plans || [], planSearch, ['learnerName', 'title', 'frequency', 'status']);
  const filteredStatements = filterRows(data?.statements || [], statementSearch, ['learnerName']);

  return (
    <DashboardLayout title="Payments">
      <div className="space-y-6">
        <section className="rounded-3xl bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_52%,#06b6d4_100%)] p-6 text-white shadow-xl shadow-blue-900/15">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">Finance operations</p>
              <h2 className="mt-1 text-3xl font-bold">Payment verification, plans, and statements</h2>
              <p className="mt-2 max-w-3xl text-sm text-blue-100">
                Keep fee collections organised with verification oversight, payment plans, receipts, and learner statement balances from one finance workspace.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => void openOfficePayment()} className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">
                <Plus className="mr-2 inline h-4 w-4" />
                Record office payment
              </button>
              <button onClick={() => setShowPlan(true)} className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20">
                <Plus className="mr-2 inline h-4 w-4" />
                New payment plan
              </button>
            </div>
          </div>
        </section>

        {loading && <PortalLoader label="Loading payment operations..." />}

        {!loading && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
              <Metric label="Outstanding" value={`R ${(data?.summary?.outstanding || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`} icon={Wallet} />
              <Metric label="Overdue" value={`R ${(data?.summary?.overdue || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`} icon={AlertTriangle} tone="rose" />
              <Metric label="Collected" value={`R ${(data?.summary?.collected || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`} icon={CreditCard} />
              <Metric label="Pending verification" value={String(data?.summary?.pendingVerification || 0)} icon={Clock3} />
              <Metric label="Rejected" value={String(data?.summary?.rejected || 0)} icon={CheckCircle2} />
              <Metric label="Active plans" value={String(data?.summary?.activePlans || 0)} icon={FileSpreadsheet} />
            </div>

            {(data?.overdueFees || []).length > 0 && <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5"><div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-rose-600" /><div><h3 className="text-sm font-bold text-rose-950">Overdue fee follow-up</h3><p className="mt-1 text-xs text-rose-700">Outstanding fee items past their due date.</p></div></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{data.overdueFees.slice(0, 6).map((fee: any) => <div key={fee.id} className="rounded-xl border border-rose-100 bg-white p-3"><p className="text-sm font-semibold text-slate-900">{fee.learnerName}</p><p className="mt-1 text-xs text-slate-500">{fee.term} · {fee.category} · Due {new Date(fee.dueDate).toLocaleDateString('en-ZA')}</p><p className="mt-2 text-sm font-bold text-rose-700">R {Number(fee.outstanding).toFixed(2)} outstanding</p></div>)}</div></section>}

            {false && <>
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Gateway control</p>
                  <h3 className="mt-1 text-xl font-bold text-slate-950">Live collection readiness</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Keep the finance team aligned on which payment route is active, what callback path is in use, and whether checkout is running in live or test mode.
                  </p>
                </div>
                <div className={`rounded-2xl px-4 py-3 text-right ${data?.gateways?.primary?.enabled ? 'bg-emerald-50' : 'bg-slate-100'}`}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Primary status</p>
                  <p className={`mt-2 text-2xl font-bold ${data?.gateways?.primary?.enabled ? 'text-emerald-700' : 'text-slate-600'}`}>
                    {data?.gateways?.primary?.enabled ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <GatewayMiniCard
                  icon={ShieldCheck}
                  label="Primary provider"
                  value={gatewayForm.primary?.provider || 'MANUAL_EFT'}
                  tone="blue"
                />
                <GatewayMiniCard
                  icon={ArrowRightLeft}
                  label="Mode"
                  value={String(gatewayForm.primary?.mode || 'manual').toUpperCase()}
                  tone={gatewayForm.primary?.mode === 'live' ? 'emerald' : 'amber'}
                />
                <GatewayMiniCard
                  icon={Clock3}
                  label="Callback"
                  value={gatewayForm.primary?.callbackUrl ? 'Configured' : 'Default route'}
                  tone="slate"
                />
                <GatewayMiniCard
                  icon={CheckCircle2}
                  label="Currency"
                  value={gatewayForm.primary?.currency || 'ZAR'}
                  tone="blue"
                />
              </div>
            </section>
            </>}

            <div className="space-y-5">
              {false && <>
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-950">Gateway configuration</h3>
                    <p className="mt-1 text-xs text-slate-500">Set the primary online payment provider and callback details for collections.</p>
                  </div>
                  <button
                    onClick={() => void saveGateways()}
                    disabled={savingGateways}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingGateways ? 'Saving...' : 'Save gateways'}
                  </button>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <Field label="Primary provider">
                    <select className={inputClass} value={gatewayForm.primary?.provider || 'MANUAL_EFT'} onChange={(e) => setGatewayForm((current: any) => ({ ...current, primary: { ...current.primary, provider: e.target.value } }))}>
                      <option value="MANUAL_EFT">Manual EFT</option>
                      <option value="PAYSTACK">Paystack</option>
                      <option value="PAYFAST">PayFast</option>
                      <option value="YOCO">Yoco</option>
                      <option value="OZOW">Ozow</option>
                    </select>
                  </Field>
                  <Field label="Mode">
                    <select className={inputClass} value={gatewayForm.primary?.mode || 'manual'} onChange={(e) => setGatewayForm((current: any) => ({ ...current, primary: { ...current.primary, mode: e.target.value } }))}>
                      <option value="manual">Manual</option>
                      <option value="test">Test</option>
                      <option value="live">Live</option>
                    </select>
                  </Field>
                  <Field label="Merchant ID">
                    <input className={inputClass} value={gatewayForm.primary?.merchantId || ''} onChange={(e) => setGatewayForm((current: any) => ({ ...current, primary: { ...current.primary, merchantId: e.target.value } }))} />
                  </Field>
                  <Field label="Public key">
                    <input className={inputClass} value={gatewayForm.primary?.publicKey || ''} onChange={(e) => setGatewayForm((current: any) => ({ ...current, primary: { ...current.primary, publicKey: e.target.value } }))} />
                  </Field>
                  <Field label="Secret key">
                    <input className={inputClass} value={gatewayForm.primary?.secretKey || ''} onChange={(e) => setGatewayForm((current: any) => ({ ...current, primary: { ...current.primary, secretKey: e.target.value } }))} />
                  </Field>
                  <Field label="Currency">
                    <input className={inputClass} value={gatewayForm.primary?.currency || 'ZAR'} onChange={(e) => setGatewayForm((current: any) => ({ ...current, primary: { ...current.primary, currency: e.target.value.toUpperCase() } }))} />
                  </Field>
                  <div className="md:col-span-2">
                    <Field label="Callback URL">
                      <input className={inputClass} value={gatewayForm.primary?.callbackUrl || ''} onChange={(e) => setGatewayForm((current: any) => ({ ...current, primary: { ...current.primary, callbackUrl: e.target.value } }))} />
                    </Field>
                  </div>
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 md:col-span-2">
                    <input
                      type="checkbox"
                      checked={Boolean(gatewayForm.primary?.enabled)}
                      onChange={(e) => setGatewayForm((current: any) => ({ ...current, primary: { ...current.primary, enabled: e.target.checked } }))}
                    />
                    Enable primary gateway
                  </label>
                </div>
                {(gatewayForm.alternatives || []).length ? (
                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Alternative providers</h4>
                    <div className="mt-3 grid gap-3">
                      {gatewayForm.alternatives.map((item: any) => (
                        <div key={item.provider} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{item.provider}</p>
                            <p className="text-xs text-slate-500">{item.mode} mode</p>
                          </div>
                          <span className={`rounded-full px-2 py-1 text-xs font-bold ${item.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                            {item.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>
              </>}

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><h3 className="text-sm font-bold text-slate-950">Payment verification log</h3><p className="mt-1 text-xs text-slate-500">Search, review, and verify payments without loading the whole ledger.</p></div>
                  <input value={paymentSearch} onChange={(event) => { setPaymentSearch(event.target.value); setPaymentPage(1); }} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 sm:w-64" placeholder="Search learner or reference..." />
                </div>
                <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Learner</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Received</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Action</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">{pageRows(filteredPayments, paymentPage).map((item: any) => <tr key={item.id} className="hover:bg-slate-50/70"><td className="px-4 py-3"><p className="font-semibold text-slate-900">{item.learnerName}</p><p className="mt-0.5 text-xs text-slate-500">{item.paymentType?.replace(/_/g, ' ') || 'School fees'} {item.captureSource === 'OFFICE' ? '· Office' : ''}</p></td><td className="px-4 py-3"><p className="font-medium text-slate-800">R {Number(item.amount || 0).toFixed(2)}</p><p className="mt-0.5 text-xs text-slate-500">{item.method} · {item.reference || item.receiptNumber || 'No reference'}</p></td><td className="px-4 py-3 text-xs text-slate-600">{item.paidAt ? new Date(item.paidAt).toLocaleString('en-ZA') : '—'}</td><td className="px-4 py-3"><StatusBadge status={item.status} /></td><td className="px-4 py-3 text-right">{item.status === 'PENDING_VERIFICATION' ? <div className="flex justify-end gap-2"><button disabled={processingPaymentId === item.id} onClick={() => void reviewPayment(item.id, 'verify')} className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-60">Verify</button><button disabled={processingPaymentId === item.id} onClick={() => void reviewPayment(item.id, 'reject')} className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-60">Reject</button></div> : <span className="text-xs text-slate-400">Reviewed</span>}</td></tr>)}</tbody>
                  </table>
                </div>
                <TablePager count={filteredPayments.length} page={paymentPage} onChange={setPaymentPage} emptyText="No payment records match your search." />
                {false && <div className="mt-4 space-y-3">
                  {(data?.payments || []).length ? data.payments.map((item: any) => (
                    <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{item.learnerName}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            R {Number(item.amount || 0).toFixed(2)} • {item.method} • {item.reference}
                          </p>
                        </div>
                        <span className={`rounded-full px-2 py-1 text-xs font-bold ${item.status === 'VERIFIED' ? 'bg-emerald-50 text-emerald-700' : item.status === 'REJECTED' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{item.status}</span>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <Mini label="Submitted" value={new Date(item.paidAt).toLocaleString('en-ZA')} />
                        <Mini label="Receipt" value={item.receiptNumber || 'Pending'} />
                      </div>
                      <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        {item.captureSource === 'OFFICE' ? `Recorded by ${item.capturedBy || 'school staff'} · ${item.paymentType?.replace(/_/g, ' ') || 'payment'}` : item.method === 'PAYSTACK' ? 'Online checkout transaction' : 'Parent-submitted payment'}
                      </div>
                      {item.status === 'PENDING_VERIFICATION' && <div className="mt-3 flex gap-2"><button disabled={processingPaymentId === item.id} onClick={() => void reviewPayment(item.id, 'verify')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">Verify</button><button disabled={processingPaymentId === item.id} onClick={() => void reviewPayment(item.id, 'reject')} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-60">Reject</button></div>}
                    </div>
                  )) : <Empty text="No payment records are available yet." />}
                </div>}
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-slate-950">Payment plans</h3><p className="mt-1 text-xs text-slate-500">Active arrangements and balances, in one place.</p></div><input value={planSearch} onChange={(event) => { setPlanSearch(event.target.value); setPlanPage(1); }} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 sm:w-56" placeholder="Search plan or learner..." /></div>
                <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Plan / learner</th><th className="px-4 py-3">Instalment</th><th className="px-4 py-3">Balance</th><th className="px-4 py-3">Period</th><th className="px-4 py-3 text-right">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{pageRows(filteredPlans, planPage).map((item: any) => <tr key={item.id} className="hover:bg-slate-50/70"><td className="px-4 py-3"><p className="font-semibold text-slate-900">{item.title}</p><p className="mt-0.5 text-xs text-slate-500">{item.learnerName} · {item.frequency}</p></td><td className="px-4 py-3 text-slate-700">R {Number(item.instalmentAmount || 0).toFixed(2)}</td><td className="px-4 py-3 font-medium text-slate-800">R {Number(item.balance || 0).toFixed(2)}</td><td className="px-4 py-3 text-xs text-slate-600">{item.startDate || '—'}{item.endDate ? ` to ${item.endDate}` : ''}</td><td className="px-4 py-3 text-right">{item.status === 'ACTIVE' ? <button onClick={() => void updatePlanStatus(item.id, 'COMPLETED')} className="rounded-lg border border-blue-200 px-2.5 py-1.5 text-xs font-semibold text-blue-700">Mark completed</button> : <StatusBadge status={item.status} />}</td></tr>)}</tbody></table></div>
                <TablePager count={filteredPlans.length} page={planPage} onChange={setPlanPage} emptyText="No payment plans match your search." />
                {false && <div className="mt-4 space-y-3">
                  {(data?.plans || []).length ? data.plans.map((item: any) => (
                    <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.learnerName} • R {Number(item.instalmentAmount || 0).toFixed(2)} • {item.frequency}
                          </p>
                        </div>
                        <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">{item.status}</span>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <Mini label="Balance" value={`R ${Number(item.balance || 0).toFixed(2)}`} />
                        <Mini label="Period" value={`${item.startDate}${item.endDate ? ` to ${item.endDate}` : ''}`} />
                      </div>
                      {item.status === 'ACTIVE' && (
                        <button onClick={() => void updatePlanStatus(item.id, 'COMPLETED')} className="mt-4 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
                          Mark completed
                        </button>
                      )}
                    </div>
                  )) : <Empty text="No payment plans have been created yet." />}
                </div>}
              </section>
            </div>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-slate-950">Learner statements</h3><p className="mt-1 text-xs text-slate-500">Find a learner’s current balance without scanning every account.</p></div><input value={statementSearch} onChange={(event) => { setStatementSearch(event.target.value); setStatementPage(1); }} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 sm:w-64" placeholder="Search learner..." /></div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                      <th className="pb-3">Learner</th>
                      <th className="pb-3">Balance</th>
                      <th className="pb-3">Statement items</th>
                      <th className="pb-3">Last payment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {pageRows(filteredStatements, statementPage).map((item: any) => (
                      <tr key={item.learnerId}>
                        <td className="py-3 text-sm font-medium text-slate-900">{item.learnerName}</td>
                        <td className="py-3 text-sm text-slate-600">R {Number(item.balance || 0).toFixed(2)}</td>
                        <td className="py-3 text-sm text-slate-600">{item.items}</td>
                        <td className="py-3 text-sm text-slate-500">{item.lastPaymentAt ? new Date(item.lastPaymentAt).toLocaleDateString('en-ZA') : 'No payment yet'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePager count={filteredStatements.length} page={statementPage} onChange={setStatementPage} emptyText="No learner statements match your search." />
            </section>
          </>
        )}
      </div>

      <Modal title="Create payment plan" isOpen={showPlan} onClose={() => setShowPlan(false)}>
        <div className="space-y-4">
          <Field label="Learner ID"><input className={inputClass} value={plan.learnerId} onChange={(e) => setPlan((v) => ({ ...v, learnerId: e.target.value }))} placeholder="learner-1" /></Field>
          <Field label="Plan title"><input className={inputClass} value={plan.title} onChange={(e) => setPlan((v) => ({ ...v, title: e.target.value }))} /></Field>
          <Field label="Instalment amount"><input className={inputClass} value={plan.instalmentAmount} onChange={(e) => setPlan((v) => ({ ...v, instalmentAmount: e.target.value }))} /></Field>
          <Field label="Balance"><input className={inputClass} value={plan.balance} onChange={(e) => setPlan((v) => ({ ...v, balance: e.target.value }))} /></Field>
          <Field label="Start date"><input type="date" className={inputClass} value={plan.startDate} onChange={(e) => setPlan((v) => ({ ...v, startDate: e.target.value }))} /></Field>
          <Field label="End date"><input type="date" className={inputClass} value={plan.endDate} onChange={(e) => setPlan((v) => ({ ...v, endDate: e.target.value }))} /></Field>
          <Field label="Notes"><textarea rows={3} className={inputClass} value={plan.notes} onChange={(e) => setPlan((v) => ({ ...v, notes: e.target.value }))} /></Field>
          <button onClick={() => void createPlan()} className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white">Save plan</button>
        </div>
      </Modal>
      <Modal title="Record office payment" isOpen={showOfficePayment} onClose={() => setShowOfficePayment(false)}>
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-800">Search for a learner first, then choose what the payment is for. School-fee payments are allocated to a fee item; other payments are captured against the learner for finance follow-up.</div>
          <div className="relative"><Field label="Search learner"><input className={inputClass} value={learnerSearch} onChange={(event) => void searchLearners(event.target.value)} placeholder="Search by learner name or student number" autoComplete="off" /></Field>{learnerResults.length > 0 && <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">{learnerResults.map((learner) => <button key={learner.id} type="button" onClick={() => void selectLearner(learner)} className="block w-full border-b border-slate-100 px-3 py-3 text-left text-sm transition last:border-0 hover:bg-blue-50"><span className="font-semibold text-slate-900">{learner.name}</span><span className="ml-2 text-xs text-slate-500">{learner.studentNumber}</span></button>)}</div>}</div>
          {selectedLearner && <div className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm"><span><b>{selectedLearner.name}</b> <span className="text-emerald-700">· {selectedLearner.studentNumber}</span></span><button type="button" onClick={() => { setSelectedLearner(null); setLearnerSearch(''); setOfficeFees([]); setOfficePayment((current) => ({ ...current, learnerId: '', feeId: '', amount: '' })); }} className="text-xs font-semibold text-emerald-700">Change</button></div>}
          <Field label="Payment type"><select className={inputClass} value={officePayment.paymentType} onChange={(event) => setOfficePayment((current) => ({ ...current, paymentType: event.target.value, feeId: '', amount: '' }))}><option value="SCHOOL_FEES">School fees</option><option value="TRANSPORT">Transport</option><option value="HOSTEL">Hostel</option><option value="UNIFORM">Uniform</option><option value="ACTIVITY">Activity / excursion</option><option value="OTHER">Other</option></select></Field>
          {officePayment.paymentType === 'SCHOOL_FEES' && <Field label="Fee item"><select className={inputClass} disabled={!selectedLearner} value={officePayment.feeId} onChange={(event) => { const fee = officeFees.find((item) => item.id === event.target.value); setOfficePayment((current) => ({ ...current, feeId: event.target.value, amount: fee?.outstanding ? String(fee.outstanding) : current.amount })); }}><option value="">{selectedLearner ? 'Select an outstanding fee' : 'Search and select a learner first'}</option>{officeFees.map((fee) => <option key={fee.id} value={fee.id}>{fee.term} {fee.category} · Outstanding R {Number(fee.outstanding).toFixed(2)}</option>)}</select></Field>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount (R)"><input type="number" min="0.01" step="0.01" className={inputClass} value={officePayment.amount} onChange={(event) => setOfficePayment((current) => ({ ...current, amount: event.target.value }))} /></Field>
            <Field label="Method"><select className={inputClass} value={officePayment.method} onChange={(event) => setOfficePayment((current) => ({ ...current, method: event.target.value }))}><option value="CASH">Cash</option><option value="EFT">EFT</option><option value="CARD">Card</option></select></Field>
          </div>
          <Field label="Receipt or payment reference"><input maxLength={100} className={inputClass} value={officePayment.reference} onChange={(event) => setOfficePayment((current) => ({ ...current, reference: event.target.value }))} placeholder={officePayment.method === 'CASH' ? 'Cash receipt number' : 'Bank or card reference'} /></Field>
          <Field label="Payment received at"><input type="datetime-local" className={inputClass} value={officePayment.paidAt} onChange={(event) => setOfficePayment((current) => ({ ...current, paidAt: event.target.value }))} /></Field>
          <button disabled={savingOfficePayment || !officePayment.learnerId || (officePayment.paymentType === 'SCHOOL_FEES' && !officePayment.feeId) || !officePayment.amount || !officePayment.reference.trim()} onClick={() => void captureOfficePayment()} className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{savingOfficePayment ? 'Recording payment...' : 'Record payment for verification'}</button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}

function Metric({ label, value, icon: Icon, tone = 'blue' }: { label: string; value: string; icon: any; tone?: 'blue' | 'rose' }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <Icon className={`h-4 w-4 ${tone === 'rose' ? 'text-rose-600' : 'text-blue-600'}`} />
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
    </div>
  );
}

function GatewayMiniCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: any;
  label: string;
  value: string;
  tone: 'blue' | 'emerald' | 'amber' | 'slate';
}) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    slate: 'bg-slate-100 text-slate-700',
  } as const;

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-2xl ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-sm font-bold text-slate-900">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const style = status === 'VERIFIED' || status === 'COMPLETED'
    ? 'bg-emerald-50 text-emerald-700'
    : status === 'REJECTED'
      ? 'bg-rose-50 text-rose-700'
      : status === 'PENDING_VERIFICATION'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-blue-50 text-blue-700';
  return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${style}`}>{status.replace(/_/g, ' ')}</span>;
}

function TablePager({ count, page, onChange, emptyText }: { count: number; page: number; onChange: (page: number) => void; emptyText: string }) {
  const pageSize = 12;
  const pages = Math.max(1, Math.ceil(count / pageSize));
  if (!count) return <Empty text={emptyText} />;
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
      <span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, count)} of {count} records</span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1} className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
        <span>Page {page} of {pages}</span>
        <button type="button" onClick={() => onChange(Math.min(pages, page + 1))} disabled={page === pages} className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
      </div>
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
