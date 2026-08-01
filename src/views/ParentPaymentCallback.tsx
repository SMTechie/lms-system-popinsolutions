'use client';

import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, ShieldCheck, XCircle } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import PortalLoader from '../components/PortalLoader';
import { apiRequest } from '../lib/api';

export default function ParentPaymentCallback() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [state, setState] = useState<{ loading: boolean; ok: boolean; message: string }>({
    loading: true,
    ok: false,
    message: 'Verifying your payment with the gateway...',
  });

  useEffect(() => {
    const learnerId = params.get('learnerId') || '';
    const reference = params.get('reference') || params.get('trxref') || '';

    if (!learnerId || !reference) {
      setState({ loading: false, ok: false, message: 'The payment reference is missing from this return link.' });
      return;
    }

    apiRequest(`/parent/children/${learnerId}/fees/payments/verify`, {
      method: 'POST',
      body: JSON.stringify({ reference }),
    })
      .then(() => {
        setState({ loading: false, ok: true, message: 'Your payment has been verified successfully.' });
        window.setTimeout(() => navigate('/parent-portal'), 2200);
      })
      .catch((error: any) => {
        setState({ loading: false, ok: false, message: error.message || 'We could not verify this payment yet.' });
      });
  }, [navigate, params]);

  return (
    <DashboardLayout title="Payment callback">
      <div className="mx-auto max-w-4xl space-y-5">
        <section className="rounded-3xl bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_52%,#06b6d4_100%)] p-6 text-white shadow-xl shadow-blue-900/15">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">Secure checkout</p>
              <h1 className="mt-2 text-3xl font-bold">Payment return and verification</h1>
              <p className="mt-2 max-w-2xl text-sm text-blue-100">
                We are confirming the gateway result and updating the learner fee account before taking you back into the parent portal.
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-cyan-200" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Gateway</p>
                  <p className="text-sm font-bold">Paystack verification</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        {state.loading ? (
          <PortalLoader label="Verifying your payment..." className="border-0 p-0 shadow-none" />
        ) : (
          <div className="space-y-5 text-center">
            <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${state.ok ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
              {state.ok ? <CheckCircle2 className="h-8 w-8" /> : <XCircle className="h-8 w-8" />}
            </div>
            <h1 className="text-2xl font-bold text-slate-950">{state.ok ? 'Payment confirmed' : 'Payment not confirmed yet'}</h1>
            <p className="text-sm text-slate-600">{state.message}</p>
            <div className="mx-auto max-w-xl rounded-2xl bg-slate-50 p-4 text-left">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">What happens next</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {[
                  'Gateway response checked',
                  'Learner fee account updated',
                  'Portal notification prepared',
                ].map((item) => (
                  <div key={item} className="rounded-2xl bg-white px-3 py-3 text-xs font-semibold text-slate-700 shadow-sm">
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <button onClick={() => navigate('/parent-portal')} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
              Return to parent portal
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
        </div>
      </div>
    </DashboardLayout>
  );
}
