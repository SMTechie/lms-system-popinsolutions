import React, { useEffect, useState } from 'react';
import { BarChart3, MessageCircleCode, SendHorizonal, Sparkles } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import PortalLoader from '../components/PortalLoader';
import { apiRequest } from '../lib/api';
import { notifyAction } from '../lib/notify';

const inputClass =
  'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10';

export default function AIAssist() {
  const [loading, setLoading] = useState(true);
  const [home, setHome] = useState<any>(null);
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState<any>(null);
  const [asking, setAsking] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setHome(await apiRequest('/admin/ai-assist'));
    } catch (error: any) {
      notifyAction(error.message || 'Could not load AI Assist.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const ask = async (nextPrompt?: string) => {
    const value = (nextPrompt ?? prompt).trim();
    if (!value) {
      notifyAction('Enter a question for AI Assist.', 'error');
      return;
    }
    setAsking(true);
    try {
      const result = await apiRequest('/admin/ai-assist/query', {
        method: 'POST',
        body: JSON.stringify({ prompt: value }),
      });
      setResponse(result);
      setPrompt(value);
    } catch (error: any) {
      notifyAction(error.message || 'AI Assist could not answer right now.', 'error');
    } finally {
      setAsking(false);
    }
  };

  return (
    <DashboardLayout title="AI Assist">
      <div className="space-y-6">
        <section className="rounded-3xl bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_52%,#06b6d4_100%)] p-6 text-white shadow-xl shadow-blue-900/15">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">Leadership intelligence</p>
              <h2 className="mt-1 text-3xl font-bold">Ask the school data what matters right now</h2>
              <p className="mt-2 max-w-3xl text-sm text-blue-100">
                AI Assist summarises finance, attendance, communications, hostel, discipline, and admissions data into quick operational answers for leadership teams.
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold">
              Built on current live LMS data
            </div>
          </div>
        </section>

        {loading && <PortalLoader label="Loading AI Assist..." />}

        {!loading && (
          <>
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <MessageCircleCode className="h-5 w-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-950">Ask a question</h3>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
                <textarea
                  rows={4}
                  className={inputClass}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Example: Which payments still need verification?"
                />
                <button onClick={() => void ask()} disabled={asking} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white disabled:bg-slate-300">
                  <SendHorizonal className="mr-2 inline h-4 w-4" />
                  {asking ? 'Thinking...' : 'Ask AI Assist'}
                </button>
              </div>
            </section>

            <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-950">Suggested prompts</h3>
                </div>
                <div className="mt-4 space-y-3">
                  {(home?.suggestions || []).map((item: string) => (
                    <button
                      key={item}
                      onClick={() => void ask(item)}
                      className="w-full rounded-2xl border border-slate-200 p-4 text-left text-sm text-slate-700 transition hover:border-blue-300 hover:bg-blue-50"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-950">AI response</h3>
                </div>

                {response ? (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Answer</p>
                      <p className="mt-2 text-sm text-slate-700">{response.answer}</p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      {(response.metrics || []).map((item: any) => (
                        <div key={item.label} className="rounded-2xl border border-slate-200 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{item.label}</p>
                          <p className="mt-2 text-lg font-bold text-slate-950">{item.value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-2xl border border-slate-200 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Highlights</p>
                      <div className="mt-3 space-y-2">
                        {(response.bullets || []).map((item: string, index: number) => (
                          <p key={index} className="text-sm text-slate-700">{item}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 py-8 text-center text-sm text-slate-400">
                    Ask a question to receive a live operational summary from the current school data.
                  </p>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
