import React, { useEffect, useMemo, useState } from 'react';
import { BedDouble, Bell, BookOpen, CalendarDays, ClipboardCheck, FileText, GraduationCap, MessageSquare, ScrollText } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import Modal from '../components/Modal';
import PortalLoader from '../components/PortalLoader';
import { apiRequest } from '../lib/api';
import { notifyAction } from '../lib/notify';

const sections = [
  { key: 'homework', label: 'Homework', icon: BookOpen },
  { key: 'timetable', label: 'Timetable', icon: CalendarDays },
  { key: 'assessments', label: 'Assessments', icon: GraduationCap },
  { key: 'attendance', label: 'Attendance', icon: ClipboardCheck },
  { key: 'reports', label: 'Reports', icon: ScrollText },
  { key: 'announcements', label: 'Announcements', icon: MessageSquare },
  { key: 'resources', label: 'Resources', icon: FileText },
  { key: 'calendar', label: 'School Calendar', icon: CalendarDays },
  { key: 'grades', label: 'Grades', icon: ClipboardCheck },
  { key: 'hostel', label: 'Hostel', icon: BedDouble },
  { key: 'notifications', label: 'Notifications', icon: Bell },
] as const;

export default function StudentPortal() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [active, setActive] = useState<string | null>(null);
  const [submissionWork, setSubmissionWork] = useState<any>(null);
  const [submissionDraft, setSubmissionDraft] = useState({ content: '', fileName: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [overview, hostel] = await Promise.all([apiRequest('/student/overview'), apiRequest('/student/hostel')]);
      setData({ ...overview, hostel });
    } catch (error: any) {
      notifyAction(error.message || 'Could not load student portal.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const currentSection = useMemo(() => sections.find((item) => item.key === active) || null, [active]);

  const renderContent = () => {
    if (!active) return null;
    if (loading) return <PortalLoader label="Loading student workspace..." className="border-0 p-0 shadow-none" />;
    if (!data) return <Empty text="Student information is not available yet." />;

    if (active === 'homework') return <HomeworkList items={data.homework} submissions={data.submissions} onSubmit={setSubmissionWork} />;
    if (active === 'timetable') return <TimetableList items={data.timetable} />;
    if (active === 'assessments') return <SimpleList items={data.assessments} empty="No assessments are available yet." dateKey="dueAt" />;
    if (active === 'attendance') return <AttendanceList items={data.attendance} />;
    if (active === 'reports') return <ReportsList items={data.reports} />;
    if (active === 'announcements') return <SimpleList items={data.announcements} empty="No announcements are available right now." />;
    if (active === 'resources') return <ResourcesList items={data.resources} />;
    if (active === 'calendar') return <CalendarList items={data.calendar} />;
    if (active === 'grades') return <GradesList items={data.grades} />;
    if (active === 'hostel') return <StudentHostel data={data.hostel} />;
    if (active === 'notifications') return <NotificationsList items={data.notifications} onRead={async (id) => { try { await apiRequest(`/student/notifications/${id}/read`, { method: 'POST' }); await load(); } catch (error: any) { notifyAction(error.message || 'Could not update notification.', 'error'); } }} onReadAll={async () => { try { await apiRequest('/student/notifications/read-all', { method: 'POST' }); await load(); } catch (error: any) { notifyAction(error.message || 'Could not update notifications.', 'error'); } }} />;
    return <Empty text="This student module is ready." />;
  };

  return (
    <DashboardLayout title="Student Portal">
      <div className="space-y-6">
        <section className="rounded-3xl bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_52%,#06b6d4_100%)] p-6 text-white shadow-xl shadow-blue-900/15">
          <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">Student workspace</p>
              <h2 className="mt-2 text-3xl font-bold">Everything a learner needs in one portal</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
                View timetable, homework, attendance, assessments, resources, reports, and school announcements from a single student workspace.
              </p>
            </div>
            <div className="rounded-3xl bg-white/10 p-5 backdrop-blur">
              {loading ? (
                <p className="text-sm text-blue-100">Loading learner profile...</p>
              ) : data?.learner ? (
                <>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">Current learner</p>
                  <p className="mt-3 text-xl font-bold">{data.learner.firstName} {data.learner.lastName}</p>
                  <p className="mt-1 text-sm text-blue-100">{data.learner.studentNumber} • {data.classes?.[0]?.name || 'Class pending'}</p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <Info label="Homework" value={String(data.homework?.length || 0)} />
                    <Info label="Reports" value={String(data.reports?.length || 0)} />
                    <Info label="Attendance" value={String(data.attendance?.length || 0)} />
                    <Info label="Resources" value={String(data.resources?.length || 0)} />
                  </div>
                </>
              ) : (
                <p className="text-sm text-blue-100">No learner profile is linked to this account yet.</p>
              )}
            </div>
          </div>
        </section>

        {loading && <PortalLoader label="Loading student portal..." />}

        {!loading && data && (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Student modules</p>
              <h3 className="mt-1 text-xl font-bold text-slate-950">Choose an area</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {sections.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActive(key)}
                  className={`rounded-2xl border p-4 text-left shadow-sm transition ${
                    active === key
                      ? 'border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-slate-50'
                  }`}
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${active === key ? 'bg-white/15 text-white' : 'bg-blue-50 text-blue-600'}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="mt-4 text-sm font-semibold">{label}</p>
                  <p className={`mt-1 text-xs ${active === key ? 'text-blue-100' : 'text-slate-500'}`}>
                    {active === key ? 'Module open' : `Open ${label.toLowerCase()} now.`}
                  </p>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      <Modal
        open={!!active}
        onClose={() => setActive(null)}
        title={currentSection ? `${currentSection.label} - ${data?.learner?.firstName || 'Student'}` : 'Student Portal'}
        wide
      >
        {renderContent()}
      </Modal>
      <Modal open={!!submissionWork} onClose={() => setSubmissionWork(null)} title={`Submit work - ${submissionWork?.title || ''}`}>
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Submit a written response or provide the name of your uploaded file.</p>
          <textarea className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" rows={6} placeholder="Your response" value={submissionDraft.content} onChange={(event) => setSubmissionDraft({ ...submissionDraft, content: event.target.value })} />
          <input className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" placeholder="File name (optional)" value={submissionDraft.fileName} onChange={(event) => setSubmissionDraft({ ...submissionDraft, fileName: event.target.value })} />
          <button onClick={async () => { try { await apiRequest(`/student/work-items/${submissionWork.id}/submissions`, { method: 'POST', body: JSON.stringify(submissionDraft) }); notifyAction('Work submitted successfully.', 'success'); setSubmissionDraft({ content: '', fileName: '' }); setSubmissionWork(null); await load(); } catch (error: any) { notifyAction(error.message || 'Could not submit work.', 'error'); } }} className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white">Submit work</button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}

function SimpleList({ items, empty, dateKey }: { items: any[]; empty: string; dateKey?: string }) {
  if (!items?.length) return <Empty text={empty} />;
  return (
    <div className="space-y-3">
      {items.map((item: any, index: number) => (
        <div key={item.id || index} className="rounded-2xl border border-slate-200 p-4">
          <div className="flex justify-between gap-3">
            <b className="text-sm text-slate-900">{item.title || item.subject || item.term || 'Record'}</b>
            <span className="text-xs text-slate-500">
              {dateKey && item[dateKey] ? new Date(item[dateKey]).toLocaleDateString() : item.status || ''}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-600">{item.instructions || item.teacherComment || item.message || item.description || 'No details available.'}</p>
        </div>
      ))}
    </div>
  );
}

function HomeworkList({ items, submissions, onSubmit }: { items: any[]; submissions: any[]; onSubmit: (item: any) => void }) {
  const homework = Array.isArray(items) ? items : [];
  if (!homework.length) return <Empty text="No homework has been published yet." />;
  const isPastDue = (item: any) => {
    if (!item?.dueAt) return false;
    const dueAt = String(item.dueAt);
    const due = new Date(dueAt);
    if (Number.isNaN(due.getTime())) return false;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dueAt)) due.setHours(23, 59, 59, 999);
    return due.getTime() < Date.now();
  };
  const current = homework.filter((item: any) => !isPastDue(item));
  const past = homework.filter(isPastDue);
  const group = (title: string, records: any[], isPast = false) => (
    <section>
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold text-slate-900">{title}</h3><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">{records.length}</span></div>
      {records.length ? <div className="space-y-3">{records.map((item: any, index: number) => {
        const submission = (submissions || []).find((entry: any) => entry.workItemId === item.id);
        return <div key={`${item.id || 'homework'}-${index}`} className={`rounded-2xl border p-4 ${isPast ? 'border-slate-200 bg-slate-50/70' : 'border-blue-100 bg-white'}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><b className="text-sm text-slate-900">{item.title}</b><p className="mt-2 text-sm text-slate-600">{item.instructions || 'No instructions provided.'}</p></div><span className="text-xs text-slate-500">{item.dueAt ? `Due ${new Date(item.dueAt).toLocaleDateString()}` : 'No due date'}</span></div><div className="mt-3 flex items-center justify-between gap-3"><span className="text-xs font-semibold text-slate-500">{submission ? `Submitted ${new Date(submission.submittedAt).toLocaleString()}` : isPast ? 'Due date passed' : 'Not submitted'}</span>{!isPast && <button onClick={() => onSubmit(item)} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white">{submission ? 'Resubmit' : 'Submit work'}</button>}</div></div>;
      })}</div> : <Empty text={isPast ? 'No past homework yet.' : 'No current homework.'} />}
    </section>
  );
  return <div className="space-y-6">{group('Current homework', current)}{group('Past homework', past, true)}</div>;
}

function TimetableList({ items }: { items: any[] }) {
  if (!items?.length) return <Empty text="No timetable periods are configured yet." />;
  return (
    <div className="space-y-3">
      {items.map((item: any) => (
        <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
          <div className="flex justify-between gap-3">
            <b className="text-sm text-slate-900">{item.subject}</b>
            <span className="text-xs text-slate-500">{item.startsAt} - {item.endsAt}</span>
          </div>
          <p className="mt-2 text-sm text-slate-600">{item.class?.name || ''} • {item.room || item.class?.room || 'Room pending'}</p>
        </div>
      ))}
    </div>
  );
}

function AttendanceList({ items }: { items: any[] }) {
  if (!items?.length) return <Empty text="No attendance records are available yet." />;
  return (
    <div className="space-y-3">
      {items.map((item: any) => (
        <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
          <div className="flex justify-between gap-3">
            <b className="text-sm text-slate-900">{new Date(item.date).toLocaleDateString()}</b>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{item.status}</span>
          </div>
          <p className="mt-2 text-sm text-slate-600">{item.note || 'Captured by school register.'}</p>
        </div>
      ))}
    </div>
  );
}

function ReportsList({ items }: { items: any[] }) {
  if (!items?.length) return <Empty text="No published reports are available yet." />;
  return (
    <div className="space-y-3">
      {items.map((item: any) => (
        <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
          <div className="flex justify-between gap-3">
            <b className="text-sm text-slate-900">{item.term}</b>
            <span className="text-xs text-slate-500">{item.average}%</span>
          </div>
          <p className="mt-2 text-sm text-slate-600">{item.teacherComment || 'Published school report.'}</p>
        </div>
      ))}
    </div>
  );
}

function ResourcesList({ items }: { items: any[] }) {
  if (!items?.length) return <Empty text="No shared resources are available yet." />;
  return (
    <div className="space-y-3">
      {items.map((item: any) => (
        <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
          <b className="text-sm text-slate-900">{item.title}</b>
          <p className="mt-1 text-xs text-slate-500">{item.category} • {item.visibility}</p>
          <a href={item.url} target="_blank" rel="noreferrer" className="mt-2 block text-sm text-blue-600">Open resource</a>
        </div>
      ))}
    </div>
  );
}

function CalendarList({ items }: { items: any[] }) {
  if (!items?.length) return <Empty text="No school calendar events are available yet." />;
  return <div className="space-y-3">{items.map((item: any, index: number) => <div key={item.id || index} className="rounded-2xl border border-slate-200 p-4"><div className="flex justify-between gap-3"><b className="text-sm text-slate-900">{item.title || item.type || 'School event'}</b><span className="text-xs text-slate-500">{item.startsAt ? new Date(item.startsAt).toLocaleString() : item.date || ''}</span></div><p className="mt-2 text-sm text-slate-600">{item.notes || item.description || item.location || ''}</p></div>)}</div>;
}

function GradesList({ items }: { items: any[] }) {
  if (!items?.length) return <Empty text="No grades have been published yet." />;
  return <div className="space-y-3">{items.map((item: any, index: number) => <div key={item.id || index} className="rounded-2xl border border-slate-200 p-4"><div className="flex justify-between gap-3"><b className="text-sm text-slate-900">{item.assessmentTitle || 'Assessment'}</b><span className="font-bold text-blue-600">{item.mark}</span></div><p className="mt-2 text-sm text-slate-600">{item.comment || 'No feedback provided.'}</p></div>)}</div>;
}

function StudentHostel({ data }: { data: any }) {
  if (!data?.allocation && !data?.application) return <Empty text="No hostel placement or application is linked to your learner account." />;
  const balance = (data.charges || []).reduce((total: number, item: any) => total + Number(item.amount || 0) - Number(item.paidAmount || 0), 0);
  return <div className="space-y-4"><div className="grid gap-3 md:grid-cols-3"><div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs font-semibold uppercase text-slate-400">Placement</p><p className="mt-2 font-bold text-slate-900">{data.allocation?.status?.replaceAll('_', ' ') || 'Not allocated'}</p><p className="mt-1 text-xs text-slate-500">{data.allocation?.bed?.room?.roomNumber || 'Room pending'}</p></div><div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs font-semibold uppercase text-slate-400">Application</p><p className="mt-2 font-bold text-slate-900">{data.application?.status?.replaceAll('_', ' ') || 'None'}</p></div><div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs font-semibold uppercase text-slate-400">Balance</p><p className="mt-2 font-bold text-slate-900">R {balance.toFixed(2)}</p></div></div><section className="rounded-2xl border border-slate-200 p-4"><h3 className="font-bold text-slate-900">Hostel notices</h3>{(data.notices || []).length ? <div className="mt-3 space-y-2">{data.notices.map((notice: any) => <div key={notice.id} className="rounded-xl bg-slate-50 p-3"><p className="text-sm font-semibold">{notice.title}</p><p className="text-sm text-slate-600">{notice.message}</p></div>)}</div> : <Empty text="No hostel notices." />}</section><section className="rounded-2xl border border-slate-200 p-4"><h3 className="font-bold text-slate-900">Recent hostel activity</h3>{(data.movementHistory || []).length ? <div className="mt-3 space-y-2">{data.movementHistory.slice(0, 10).map((item: any) => <div key={item.id} className="flex justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm"><span>{String(item.eventType || item.status || 'Activity').replaceAll('_', ' ')}</span><span className="text-xs text-slate-500">{item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}</span></div>)}</div> : <Empty text="No hostel activity recorded." />}</section></div>;
}

function NotificationsList({ items, onRead, onReadAll }: { items: any[]; onRead: (id: string) => void; onReadAll: () => void }) {
  if (!items?.length) return <Empty text="No notifications are waiting for you." />;
  return (
    <div className="space-y-3"><div className="flex justify-end"><button onClick={onReadAll} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Mark all as read</button></div>
      {items.map((item: any, index: number) => (
        <button key={item.id || index} onClick={() => item.id && onRead(item.id)} className={`block w-full rounded-2xl border p-4 text-left ${item.readAt ? 'border-slate-200' : 'border-blue-200 bg-blue-50'}`}>
          <div className="flex justify-between gap-3">
            <b className="text-sm text-slate-900">{item.title}</b>
            <span className="text-xs text-slate-500">
              {item.createdAt ? new Date(item.createdAt).toLocaleString() : item.time || ''}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-600">{item.message}</p>
        </button>
      ))}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-200">{label}</p>
      <p className="mt-1 text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-slate-400">{text}</p>;
}
