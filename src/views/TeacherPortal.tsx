import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Megaphone,
  MessageSquare,
  PackagePlus,
  Plus,
  RefreshCw,
  ScanText,
  Send,
  Users,
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import Modal from '../components/Modal';
import PortalLoader from '../components/PortalLoader';
import TeacherAssistant from '../components/TeacherAssistant';
import { useAuth } from '../auth/AuthContext';
import { apiRequest } from '../lib/api';
import { notifyAction } from '../lib/notify';

type Tab =
  | 'workbench'
  | 'classes'
  | 'timetable'
  | 'gradebook'
  | 'resources'
  | 'reports'
  | 'calendar'
  | 'notifications'
  | 'homework'
  | 'plans'
  | 'attendance'
  | 'assessments'
  | 'assistant'
  | 'communication'
  | 'requisitions'
  | 'profile';

const fieldClass =
  'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10';

export default function TeacherPortal() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('workbench');
  const [dashboard, setDashboard] = useState<any>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [assessmentOverview, setAssessmentOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showWork, setShowWork] = useState(false);
  const [work, setWork] = useState({ type: 'HOMEWORK', title: '', classId: '', instructions: '', dueAt: '', scheduledAt: '', visibleToParents: true });
  const [attendanceClass, setAttendanceClass] = useState<any>(null);
  const [attendance, setAttendance] = useState<Record<string, { status: string; note: string }>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [profileDraft, setProfileDraft] = useState<any>(null);
  const [timetableDraft, setTimetableDraft] = useState({ classId: '', day: 'Monday', subject: '', startsAt: '08:00', endsAt: '08:45', room: '' });
  const [editingTimetableId, setEditingTimetableId] = useState<string | null>(null);
  const [resources, setResources] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [teacherNotifications, setTeacherNotifications] = useState<any[]>([]);
  const [gradebook, setGradebook] = useState<any>({ assessments: [], entries: [] });
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('');
  const [gradeDraft, setGradeDraft] = useState<Record<string, { mark: string; comment: string }>>({});
  const [resourceDraft, setResourceDraft] = useState({ title: '', url: '', category: 'Lesson material', classId: '' });
  const [reportDraft, setReportDraft] = useState({ classId: '', learnerId: '', term: 'Current term', comment: '' });
  const [calendarDraft, setCalendarDraft] = useState({ title: '', type: 'Lesson', startsAt: '', endsAt: '', classId: '', notes: '' });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [summary, classData, messageData, requisitionData, profileData, appointmentData, assessmentData, resourceData, reportData, calendarData, notificationData, gradebookData] = await Promise.all([
        apiRequest('/teacher/dashboard'),
        apiRequest<any[]>('/teacher/classes'),
        apiRequest<any[]>('/teacher/messages'),
        apiRequest<any[]>('/teacher/requisitions'),
        apiRequest('/teacher/profile'),
        apiRequest<any[]>('/teacher/appointments'),
        apiRequest('/teacher/assessments/overview'),
        apiRequest<any[]>('/teacher/resources'),
        apiRequest<any[]>('/teacher/reports'),
        apiRequest<any[]>('/teacher/calendar'),
        apiRequest<any[]>('/teacher/notifications'),
        apiRequest('/teacher/gradebook'),
      ]);
      setDashboard(summary && typeof summary === 'object' ? summary : null);
      setClasses(Array.isArray(classData) ? classData : []);
      setMessages(Array.isArray(messageData) ? messageData : []);
      setRequisitions(Array.isArray(requisitionData) ? requisitionData : []);
      setAppointments(Array.isArray(appointmentData) ? appointmentData : []);
      setAssessmentOverview(assessmentData && typeof assessmentData === 'object' ? assessmentData : null);
      setProfileDraft(profileData && typeof profileData === 'object' ? profileData : null);
      setResources(Array.isArray(resourceData) ? resourceData : []);
      setReports(Array.isArray(reportData) ? reportData : []);
      setCalendarEvents(Array.isArray(calendarData) ? calendarData : []);
      setTeacherNotifications(Array.isArray(notificationData) ? notificationData : []);
      setGradebook(gradebookData && typeof gradebookData === 'object' ? gradebookData : { assessments: [], entries: [] });
    } catch (err: any) {
      setError(err.message || 'Unable to load your teacher workspace.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const allWork = useMemo(() => classes.flatMap((item) => item.workItems || []), [classes]);
  const workByType = (type: string) => allWork.filter((item) => item.type === type);
  const totalSubjects = useMemo(
    () => new Set(classes.flatMap((schoolClass) => schoolClass.assignments?.map((item: any) => item.subject) || [])).size,
    [classes],
  );
  const attendanceAlerts = useMemo(
    () => appointments.filter((item) => ['REQUESTED', 'CONFIRMED'].includes(item.status)).length,
    [appointments],
  );
  const releaseAssessmentResults = async (assessmentId: string) => {
    try {
      const result: any = await apiRequest(`/teacher/assessments/${assessmentId}/release`, { method: 'POST' });
      notifyAction(`${result.released || 0} result(s) released to parent portal.`, 'success');
      await load();
    } catch (error: any) {
      notifyAction(error.message || 'Could not release assessment results.', 'error');
    }
  };

  const createWork = async () => {
    try {
      await apiRequest('/teacher/work-items', {
        method: 'POST',
        body: JSON.stringify({
          ...work,
          classId: work.classId || undefined,
          dueAt: work.dueAt || undefined,
          scheduledAt: work.scheduledAt || undefined,
          status: work.visibleToParents ? 'PUBLISHED' : 'DRAFT',
        }),
      });
      setShowWork(false);
      setWork({ type: 'HOMEWORK', title: '', classId: '', instructions: '', dueAt: '', scheduledAt: '', visibleToParents: true });
      notifyAction('Teaching item created.', 'success');
      await load();
    } catch (err: any) {
      setError(err.message || 'Could not create teaching item.');
    }
  };

  const addTimetablePeriod = async () => {
    if (!timetableDraft.classId || !timetableDraft.subject.trim() || !timetableDraft.startsAt || !timetableDraft.endsAt) {
      notifyAction('Select a class and complete the timetable fields.', 'error');
      return;
    }
    try {
      await apiRequest(editingTimetableId ? `/teacher/timetable/${editingTimetableId}` : '/teacher/timetable', { method: editingTimetableId ? 'PATCH' : 'POST', body: JSON.stringify(timetableDraft) });
      notifyAction(editingTimetableId ? 'Timetable period updated.' : 'Timetable period added.', 'success');
      setTimetableDraft({ classId: '', day: 'Monday', subject: '', startsAt: '08:00', endsAt: '08:45', room: '' });
      setEditingTimetableId(null);
      await load();
    } catch (err: any) {
      notifyAction(err.message || 'Could not add timetable period.', 'error');
    }
  };

  const deleteTimetablePeriod = async (id: string) => {
    try { await apiRequest(`/teacher/timetable/${id}`, { method: 'DELETE' }); notifyAction('Timetable period removed.', 'success'); await load(); }
    catch (err: any) { notifyAction(err.message || 'Could not remove timetable period.', 'error'); }
  };

  const loadAssessmentGrades = async (assessmentId: string) => {
    setSelectedAssessmentId(assessmentId);
    if (!assessmentId) return;
    const result: any = await apiRequest(`/teacher/gradebook?assessmentId=${encodeURIComponent(assessmentId)}`);
    setGradebook((current: any) => ({ ...current, entries: result.entries || [] }));
    setGradeDraft(Object.fromEntries((result.entries || []).map((entry: any) => [entry.learnerId, { mark: String(entry.mark ?? ''), comment: entry.comment || '' }])));
  };

  const saveGrades = async () => {
    if (!selectedAssessmentId) return;
    await apiRequest('/teacher/gradebook', { method: 'POST', body: JSON.stringify({ assessmentId: selectedAssessmentId, entries: Object.entries(gradeDraft).map(([learnerId, value]) => ({ learnerId, ...value })) }) });
    notifyAction('Gradebook saved.', 'success'); await load();
  };

  const createResource = async () => {
    try { await apiRequest('/teacher/resources', { method: 'POST', body: JSON.stringify(resourceDraft) }); setResourceDraft({ title: '', url: '', category: 'Lesson material', classId: '' }); notifyAction('Resource added.', 'success'); await load(); }
    catch (err: any) { notifyAction(err.message || 'Could not add resource.', 'error'); }
  };
  const createReport = async () => {
    try { await apiRequest('/teacher/reports', { method: 'POST', body: JSON.stringify(reportDraft) }); setReportDraft({ ...reportDraft, comment: '' }); notifyAction('Progress report saved.', 'success'); await load(); }
    catch (err: any) { notifyAction(err.message || 'Could not save progress report.', 'error'); }
  };
  const createCalendarEvent = async () => {
    try { await apiRequest('/teacher/calendar', { method: 'POST', body: JSON.stringify(calendarDraft) }); setCalendarDraft({ title: '', type: 'Lesson', startsAt: '', endsAt: '', classId: '', notes: '' }); notifyAction('Calendar event added.', 'success'); await load(); }
    catch (err: any) { notifyAction(err.message || 'Could not add calendar event.', 'error'); }
  };
  const markNotificationsRead = async () => { await apiRequest('/teacher/notifications/read-all', { method: 'POST' }); await load(); };

  const openAttendance = (schoolClass: any) => {
    setAttendanceClass(schoolClass);
    setAttendance(
      Object.fromEntries((schoolClass.learners || []).map((learner: any) => [learner.id, { status: 'PRESENT', note: '' }])),
    );
  };

  const saveAttendance = async (submit: boolean) => {
    if (!attendanceClass) return;
    try {
      await apiRequest('/teacher/attendance', {
        method: 'POST',
        body: JSON.stringify({
          classId: attendanceClass.id,
          registerDate: new Date().toISOString(),
          submit,
          entries: Object.entries(attendance).map(([learnerId, value]) => ({ learnerId, ...value })),
        }),
      });
      setAttendanceClass(null);
      notifyAction(submit ? 'Attendance register submitted.' : 'Attendance draft saved.', 'success');
      await load();
    } catch (err: any) {
      setError(err.message || 'Could not save attendance.');
    }
  };

  const replyToParent = async (threadId: string) => {
    const message = replyDrafts[threadId];
    if (!message?.trim()) {
      notifyAction('Enter a reply before sending.', 'error');
      return;
    }
    try {
      await apiRequest(`/teacher/messages/${threadId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ message, status: 'ANSWERED' }),
      });
      setReplyDrafts((current) => ({ ...current, [threadId]: '' }));
      notifyAction('Reply sent to parent.', 'success');
      await load();
    } catch (error: any) {
      notifyAction(error.message || 'Could not send the reply.', 'error');
    }
  };

  const updateThreadStatus = async (threadId: string, status: string) => {
    try {
      await apiRequest(`/teacher/messages/${threadId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      notifyAction('Conversation updated.', 'success');
      await load();
    } catch (error: any) {
      notifyAction(error.message || 'Could not update the conversation.', 'error');
    }
  };


  const saveProfile = async () => {
    try {
      const updated = await apiRequest('/teacher/profile', {
        method: 'PATCH',
        body: JSON.stringify(profileDraft),
      });
      setProfileDraft(updated);
      notifyAction('Teacher profile updated.', 'success');
      await load();
    } catch (error: any) {
      notifyAction(error.message || 'Could not save the teacher profile.', 'error');
    }
  };

  const tabs: Array<{ id: Tab; label: string; icon: any }> = [
    { id: 'workbench', label: 'Today', icon: CalendarDays },
    { id: 'classes', label: 'My Classes', icon: Users },
    { id: 'timetable', label: 'Timetable', icon: CalendarDays },
    { id: 'gradebook', label: 'Gradebook', icon: ClipboardCheck },
    { id: 'resources', label: 'Resources', icon: BookOpen },
    { id: 'reports', label: 'Progress Reports', icon: FileText },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays },
    { id: 'notifications', label: 'Notifications', icon: Megaphone },
    { id: 'homework', label: 'Homework', icon: BookOpen },
    { id: 'plans', label: 'Lesson Plans', icon: FileText },
    { id: 'attendance', label: 'Attendance', icon: ClipboardCheck },
    { id: 'assessments', label: 'Assessments', icon: GraduationCap },
    { id: 'assistant', label: 'Teacher Assistant', icon: ScanText },
    { id: 'communication', label: 'Parent Communication', icon: MessageSquare },
    { id: 'requisitions', label: 'Requisitions', icon: PackagePlus },
    { id: 'profile', label: 'My Profile', icon: CheckCircle2 },
  ];

  return (
    <DashboardLayout title="Teacher Portal">
      <div className="space-y-6">
        <div className="rounded-3xl bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_55%,#06b6d4_100%)] p-6 text-white shadow-xl shadow-blue-900/15">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">Daily classroom workbench</p>
              <h2 className="mt-1 text-3xl font-bold">Good day, {user?.name?.split(' ')[0] || 'Teacher'}</h2>
              <p className="mt-2 max-w-2xl text-sm text-blue-100">
                Manage class work, answer parents, process appointment requests, and keep your teaching day running
                from one professional workspace.
              </p>
            </div>
            <button onClick={() => void load()} className="rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/20">
              <RefreshCw className="mr-2 inline h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <div className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                tab === id ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {loading && <PortalLoader label="Preparing your classroom workspace..." />}

        {!loading && tab === 'workbench' && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <Metric label="Today's classes" value={dashboard?.today?.length || 0} tone="blue" />
              <Metric label="Homework due" value={dashboard?.homeworkDueToday?.length || 0} tone="amber" />
              <Metric label="Parent replies" value={dashboard?.parentQueries?.length || 0} tone="rose" />
              <Metric label="Attendance tasks" value={dashboard?.attendanceTasks?.length || 0} tone="emerald" />
              <Metric label="Appointments" value={attendanceAlerts} tone="blue" />
            </div>

            <div className="grid gap-5 xl:grid-cols-3">
              <Panel title="Today's timetable" className="xl:col-span-2">
                {dashboard?.today?.length ? (
                  dashboard.today.map((entry: any) => (
                    <div key={entry.id} className="flex items-center gap-4 border-b border-slate-100 py-3 last:border-0">
                      <div className="rounded-xl bg-blue-50 px-3 py-2 text-center text-xs font-bold text-blue-700">
                        {entry.startsAt}
                        <br />
                        {entry.endsAt}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {entry.subject} / {entry.class?.name}
                        </p>
                        <p className="text-xs text-slate-500">{entry.room || entry.class?.room || 'Room not set'}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <Empty text="No classes scheduled today." />
                )}
              </Panel>

              <Panel title="Needs attention">
                <Attention label="Incomplete lesson plans" value={dashboard?.lessonPlansIncomplete?.length || 0} />
                <Attention label="Parent messages" value={messages.filter((item) => item.status !== 'CLOSED').length} />
                <Attention label="My requisitions" value={requisitions.filter((item) => !['DELIVERED', 'CLOSED'].includes(item.status)).length} />
                <Attention label="Appointment requests" value={appointments.filter((item) => item.status === 'REQUESTED').length} />
              </Panel>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <Panel title="Parent communication queue">
                {messages.length ? (
                  messages.slice(0, 3).map((thread: any) => (
                    <div key={thread.id} className="border-b border-slate-100 py-3 last:border-0">
                      <div className="flex justify-between gap-3">
                        <p className="text-sm font-bold text-slate-900">{thread.subject}</p>
                        <span className="text-xs font-semibold text-amber-600">{thread.status}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{thread.learnerName || 'Learner'}</p>
                      <p className="mt-2 text-sm text-slate-600">{thread.messages?.[thread.messages.length - 1]?.message}</p>
                    </div>
                  ))
                ) : (
                  <Empty text="No parent conversations are waiting." />
                )}
              </Panel>
              <Panel title="Quick actions">
                <div className="grid grid-cols-2 gap-3">
                  <Quick label="Create homework" icon={BookOpen} onClick={() => { setWork((value) => ({ ...value, type: 'HOMEWORK' })); setShowWork(true); }} />
                  <Quick label="Plan a lesson" icon={FileText} onClick={() => { setWork((value) => ({ ...value, type: 'LESSON_PLAN' })); setShowWork(true); }} />
                  <Quick label="Post announcement" icon={Megaphone} onClick={() => { setWork((value) => ({ ...value, type: 'ANNOUNCEMENT' })); setShowWork(true); }} />
                  <Quick label="Request supplies" icon={PackagePlus} onClick={() => window.location.assign('/requisitions/new')} />
                </div>
              </Panel>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <Panel title="Appointment requests">
                {appointments.length ? (
                  appointments.slice(0, 4).map((item: any) => (
                    <div key={item.id} className="border-b border-slate-100 py-3 last:border-0">
                      <div className="flex justify-between gap-3">
                        <p className="text-sm font-bold text-slate-900">{item.title}</p>
                        <span className="text-xs font-semibold text-blue-600">{item.status}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.learnerId} / {new Date(item.startsAt).toLocaleString()}
                      </p>
                    </div>
                  ))
                ) : (
                  <Empty text="No appointment requests are assigned to you." />
                )}
              </Panel>
              <Panel title="Latest announcements">
                {dashboard?.announcements?.length ? dashboard.announcements.map((item: any) => <WorkRow key={item.id} item={item} />) : <Empty text="No announcements yet." />}
              </Panel>
            </div>
          </>
        )}

        {!loading && tab === 'classes' && (
          <div className="grid gap-5 lg:grid-cols-2">
            {classes.map((schoolClass) => (
              <div key={schoolClass.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{schoolClass.grade?.name}</p>
                    <h3 className="text-xl font-bold text-slate-950">{schoolClass.name}</h3>
                    <p className="text-sm text-slate-500">{schoolClass.assignments.map((item: any) => item.subject).join(', ')} / Room {schoolClass.room}</p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{schoolClass.learners.length} learners</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <Info label="Timetable" value={`${schoolClass.timetable.length} periods`} />
                  <Info label="Homework" value={`${schoolClass.workItems.filter((item: any) => item.type === 'HOMEWORK').length} tasks`} />
                  <Info label="Assessments" value={`${schoolClass.workItems.filter((item: any) => item.type === 'ASSESSMENT').length} items`} />
                  <Info label="Lesson plans" value={`${schoolClass.workItems.filter((item: any) => item.type === 'LESSON_PLAN').length} plans`} />
                </div>
                <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Learners</p>
                  <div className="mt-3 grid gap-2">
                    {(schoolClass.learners || []).map((learner: any) => (
                      <div key={learner.id} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm">
                        <span className="font-medium text-slate-800">
                          {learner.firstName} {learner.lastName}
                        </span>
                        <span className="text-xs text-slate-500">{learner.studentNumber}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => openAttendance(schoolClass)} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white">
                    Mark attendance
                  </button>
                  <button
                    onClick={() => {
                      setWork((value) => ({ ...value, classId: schoolClass.id }));
                      setShowWork(true);
                    }}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                  >
                    Create class item
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && tab === 'timetable' && (
          <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
            <Panel title="Add timetable period">
              <div className="space-y-3">
                <Field label="Class"><select className={fieldClass} value={timetableDraft.classId} onChange={(event) => setTimetableDraft({ ...timetableDraft, classId: event.target.value })}><option value="">Select class</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
                <Field label="Day"><select className={fieldClass} value={timetableDraft.day} onChange={(event) => setTimetableDraft({ ...timetableDraft, day: event.target.value })}>{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => <option key={day}>{day}</option>)}</select></Field>
                <Field label="Subject"><input className={fieldClass} value={timetableDraft.subject} onChange={(event) => setTimetableDraft({ ...timetableDraft, subject: event.target.value })} placeholder="Mathematics" /></Field>
                <div className="grid grid-cols-2 gap-3"><Field label="Starts"><input type="time" className={fieldClass} value={timetableDraft.startsAt} onChange={(event) => setTimetableDraft({ ...timetableDraft, startsAt: event.target.value })} /></Field><Field label="Ends"><input type="time" className={fieldClass} value={timetableDraft.endsAt} onChange={(event) => setTimetableDraft({ ...timetableDraft, endsAt: event.target.value })} /></Field></div>
                <Field label="Room"><input className={fieldClass} value={timetableDraft.room} onChange={(event) => setTimetableDraft({ ...timetableDraft, room: event.target.value })} placeholder="Room B12" /></Field>
                <button onClick={() => void addTimetablePeriod()} className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white"><Plus className="mr-2 inline h-4 w-4" />{editingTimetableId ? 'Update period' : 'Add period'}</button>
                {editingTimetableId && <button onClick={() => { setEditingTimetableId(null); setTimetableDraft({ classId: '', day: 'Monday', subject: '', startsAt: '08:00', endsAt: '08:45', room: '' }); }} className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancel edit</button>}
              </div>
            </Panel>
            <Panel title="Class timetable">
              <div className="space-y-4">{classes.map((schoolClass) => <div key={schoolClass.id}><h4 className="font-bold text-slate-900">{schoolClass.name}</h4><div className="mt-2 grid gap-2">{(schoolClass.timetable || []).map((entry: any) => <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm"><span className="font-semibold">{entry.day || 'School day'} · {entry.subject}</span><span className="text-xs text-slate-500">{entry.startsAt}–{entry.endsAt} · {entry.room || schoolClass.room || 'Room not set'}</span></div>)}</div></div>)}</div>
            </Panel>
          </div>
        )}

        {!loading && tab === 'timetable' && <Panel title="Edit or remove periods"><div className="space-y-2">{classes.flatMap((schoolClass) => (schoolClass.timetable || []).map((entry: any) => <div key={entry.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3"><span className="text-sm font-semibold">{schoolClass.name} · {entry.day} {entry.startsAt}–{entry.endsAt} · {entry.subject}</span><div className="flex gap-3"><button onClick={() => { setEditingTimetableId(entry.id); setTimetableDraft({ classId: schoolClass.id, day: entry.day || 'Monday', subject: entry.subject || '', startsAt: entry.startsAt || '08:00', endsAt: entry.endsAt || '08:45', room: entry.room || '' }); }} className="text-xs font-semibold text-blue-600">Edit</button><button onClick={() => void deleteTimetablePeriod(entry.id)} className="text-xs font-semibold text-red-600">Delete</button></div></div>))}</div></Panel>}

        {!loading && tab === 'gradebook' && <Panel title="Assessment gradebook"><div className="space-y-4"><select className={fieldClass} value={selectedAssessmentId} onChange={(event) => void loadAssessmentGrades(event.target.value)}><option value="">Select an assessment</option>{(gradebook.assessments || []).map((item: any) => <option key={item.id} value={item.id}>{item.title} — {item.className}</option>)}</select>{selectedAssessmentId ? <><div className="space-y-2">{(gradebook.assessments.find((item: any) => item.id === selectedAssessmentId)?.learners || []).map((learner: any) => <div key={learner.id} className="grid gap-2 rounded-xl bg-slate-50 p-3 md:grid-cols-[1fr_120px_2fr]"><span className="self-center text-sm font-semibold">{learner.firstName} {learner.lastName}</span><input className={fieldClass} type="number" min="0" placeholder="Mark" value={gradeDraft[learner.id]?.mark || ''} onChange={(event) => setGradeDraft({ ...gradeDraft, [learner.id]: { mark: event.target.value, comment: gradeDraft[learner.id]?.comment || '' } })} /><input className={fieldClass} placeholder="Feedback" value={gradeDraft[learner.id]?.comment || ''} onChange={(event) => setGradeDraft({ ...gradeDraft, [learner.id]: { mark: gradeDraft[learner.id]?.mark || '', comment: event.target.value } })} /></div>)}</div><button onClick={() => void saveGrades()} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white">Save gradebook</button></> : <Empty text="Select an assessment to enter marks and feedback." />}</div></Panel>}

        {!loading && tab === 'resources' && <div className="grid gap-5 lg:grid-cols-[360px_1fr]"><Panel title="Add learning resource"><div className="space-y-3"><Field label="Title"><input className={fieldClass} value={resourceDraft.title} onChange={(event) => setResourceDraft({ ...resourceDraft, title: event.target.value })} /></Field><Field label="File or URL"><input className={fieldClass} value={resourceDraft.url} onChange={(event) => setResourceDraft({ ...resourceDraft, url: event.target.value })} placeholder="https://..." /></Field><Field label="Category"><input className={fieldClass} value={resourceDraft.category} onChange={(event) => setResourceDraft({ ...resourceDraft, category: event.target.value })} /></Field><Field label="Class"><select className={fieldClass} value={resourceDraft.classId} onChange={(event) => setResourceDraft({ ...resourceDraft, classId: event.target.value })}><option value="">All my classes</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><button onClick={() => void createResource()} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white">Add resource</button></div></Panel><Panel title="Teaching resources"><div className="space-y-3">{resources.length ? resources.map((item) => <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="block rounded-xl border border-slate-200 p-3 hover:border-blue-300"><p className="font-semibold text-slate-900">{item.title}</p><p className="text-xs text-slate-500">{item.category} · {item.url}</p></a>) : <Empty text="No resources added yet." />}</div></Panel></div>}

        {!loading && tab === 'reports' && <div className="grid gap-5 lg:grid-cols-[360px_1fr]"><Panel title="Write progress report"><div className="space-y-3"><Field label="Class"><select className={fieldClass} value={reportDraft.classId} onChange={(event) => setReportDraft({ ...reportDraft, classId: event.target.value, learnerId: '' })}><option value="">Select class</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Learner"><select className={fieldClass} value={reportDraft.learnerId} onChange={(event) => setReportDraft({ ...reportDraft, learnerId: event.target.value })}><option value="">Select learner</option>{(classes.find((item) => item.id === reportDraft.classId)?.learners || []).map((learner: any) => <option key={learner.id} value={learner.id}>{learner.firstName} {learner.lastName}</option>)}</select></Field><Field label="Term"><input className={fieldClass} value={reportDraft.term} onChange={(event) => setReportDraft({ ...reportDraft, term: event.target.value })} /></Field><Field label="Comment"><textarea className={fieldClass} rows={5} value={reportDraft.comment} onChange={(event) => setReportDraft({ ...reportDraft, comment: event.target.value })} /></Field><button onClick={() => void createReport()} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white">Save report</button></div></Panel><Panel title="Saved progress reports"><div className="space-y-3">{reports.length ? reports.map((item) => <div key={item.id} className="rounded-xl bg-slate-50 p-3"><p className="font-semibold text-slate-900">{item.learnerName} · {item.term}</p><p className="mt-1 text-sm text-slate-600">{item.comment}</p></div>) : <Empty text="No progress reports saved yet." />}</div></Panel></div>}

        {!loading && tab === 'calendar' && <div className="grid gap-5 lg:grid-cols-[360px_1fr]"><Panel title="Add calendar event"><div className="space-y-3"><Field label="Title"><input className={fieldClass} value={calendarDraft.title} onChange={(event) => setCalendarDraft({ ...calendarDraft, title: event.target.value })} /></Field><Field label="Type"><select className={fieldClass} value={calendarDraft.type} onChange={(event) => setCalendarDraft({ ...calendarDraft, type: event.target.value })}><option>Lesson</option><option>Meeting</option><option>Substitution</option><option>Reminder</option></select></Field><Field label="Starts"><input type="datetime-local" className={fieldClass} value={calendarDraft.startsAt} onChange={(event) => setCalendarDraft({ ...calendarDraft, startsAt: event.target.value })} /></Field><Field label="Ends"><input type="datetime-local" className={fieldClass} value={calendarDraft.endsAt} onChange={(event) => setCalendarDraft({ ...calendarDraft, endsAt: event.target.value })} /></Field><Field label="Class"><select className={fieldClass} value={calendarDraft.classId} onChange={(event) => setCalendarDraft({ ...calendarDraft, classId: event.target.value })}><option value="">No class</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Notes"><textarea className={fieldClass} rows={3} value={calendarDraft.notes} onChange={(event) => setCalendarDraft({ ...calendarDraft, notes: event.target.value })} /></Field><button onClick={() => void createCalendarEvent()} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white">Add event</button></div></Panel><Panel title="Teacher calendar"><div className="space-y-3">{calendarEvents.length ? calendarEvents.map((item) => <div key={item.id} className="rounded-xl border border-slate-200 p-3"><p className="font-semibold text-slate-900">{item.title} <span className="text-xs text-blue-600">{item.type}</span></p><p className="text-xs text-slate-500">{new Date(item.startsAt).toLocaleString()} {item.endsAt ? `— ${new Date(item.endsAt).toLocaleString()}` : ''}</p><p className="mt-1 text-sm text-slate-600">{item.notes}</p></div>) : <Empty text="No calendar events yet." />}</div></Panel></div>}

        {!loading && tab === 'notifications' && <Panel title="Teacher notifications"><div className="mb-3 flex justify-end"><button onClick={() => void markNotificationsRead()} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Mark all as read</button></div><div className="space-y-3">{teacherNotifications.length ? teacherNotifications.map((item) => <div key={item.id} className={`rounded-xl p-3 ${item.readAt ? 'bg-slate-50' : 'bg-blue-50'}`}><p className="font-semibold text-slate-900">{item.title}</p><p className="text-sm text-slate-600">{item.message}</p></div>) : <Empty text="No notifications yet." />}</div></Panel>}

        {!loading && ['homework', 'plans'].includes(tab) && (
          <WorkList
            title={tab === 'homework' ? 'Homework & Assignments' : 'Lesson Plans'}
            items={workByType(tab === 'homework' ? 'HOMEWORK' : 'LESSON_PLAN')}
            onCreate={() => {
              setWork((value) => ({ ...value, type: tab === 'homework' ? 'HOMEWORK' : 'LESSON_PLAN' }));
              setShowWork(true);
            }}
          />
        )}

        {!loading && tab === 'assessments' && (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-4">
              <Metric label="Classroom items" value={assessmentOverview?.metrics?.classroomCount || 0} tone="blue" />
              <Metric label="Marking batches" value={assessmentOverview?.metrics?.assistantCount || 0} tone="amber" />
              <Metric label="Ready to release" value={assessmentOverview?.metrics?.readyForRelease || 0} tone="rose" />
              <Metric label="Released" value={assessmentOverview?.metrics?.released || 0} tone="emerald" />
            </div>

            <Panel title="Assessment schedule">
              <div className="mb-4 flex flex-wrap justify-end gap-2">
                <button
                  onClick={() => {
                    setWork((value) => ({ ...value, type: 'ASSESSMENT' }));
                    setShowWork(true);
                  }}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white"
                >
                  <Plus className="mr-1 inline h-4 w-4" />
                  New class assessment
                </button>
                <button onClick={() => setTab('assistant')} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700">
                  <ScanText className="mr-1 inline h-4 w-4" />
                  Open marking workspace
                </button>
              </div>
              {assessmentOverview?.classroomAssessments?.length ? (
                assessmentOverview.classroomAssessments.map((item: any) => (
                  <div key={item.id} className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 py-4 last:border-0">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{item.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.className} / {item.gradeName || 'Grade'} / {item.dueAt ? new Date(item.dueAt).toLocaleString() : 'No due date'}
                      </p>
                      <p className="mt-2 text-sm text-slate-600">{item.instructions || 'No assessment instructions added yet.'}</p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">{item.status}</span>
                  </div>
                ))
              ) : (
                <Empty text="No class assessments have been scheduled yet." />
              )}
            </Panel>

            <Panel title="Marking and release pipeline">
              {assessmentOverview?.assistantAssessments?.length ? (
                <div className="space-y-4">
                  {assessmentOverview.assistantAssessments.map((assessment: any) => (
                    <div key={assessment.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-slate-900">{assessment.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {assessment.subject} / {(assessment.classNames || []).join(', ') || 'No class linked'} / {assessment.totalMarks || 0} marks
                          </p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{assessment.status}</span>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-4">
                        <Info label="Scripts" value={String(assessment.counts?.total || 0)} />
                        <Info label="Ready" value={String(assessment.counts?.ready || 0)} />
                        <Info label="To release" value={String(assessment.releasableCount || 0)} />
                        <Info label="Released" value={String(assessment.releasedCount || 0)} />
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button onClick={() => setTab('assistant')} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
                          Review in assistant
                        </button>
                        <button
                          onClick={() => void releaseAssessmentResults(assessment.id)}
                          disabled={!assessment.releasableCount}
                          className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          Release to parent portal
                        </button>
                      </div>
                      {assessment.resultsReleasedAt && (
                        <p className="mt-3 text-xs text-emerald-700">
                          Results last released on {new Date(assessment.resultsReleasedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <Empty text="No marking batches are linked to the teacher assistant yet." />
              )}
            </Panel>

            <TeacherAssistant classes={classes} />
          </div>
        )}

        {!loading && tab === 'assistant' && <TeacherAssistant classes={classes} />}

        {!loading && tab === 'attendance' && (
          <Panel title="Class registers">
            <div className="grid gap-3 md:grid-cols-2">
              {classes.map((schoolClass) => (
                <button key={schoolClass.id} onClick={() => openAttendance(schoolClass)} className="rounded-2xl border border-slate-200 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50">
                  <p className="font-bold text-slate-900">{schoolClass.name}</p>
                  <p className="text-xs text-slate-500">{schoolClass.learners.length} learners / Capture today&apos;s register</p>
                </button>
              ))}
            </div>
          </Panel>
        )}

        {!loading && tab === 'communication' && (
          <div className="space-y-5">
            <Panel title="Parent conversations">
              <p className="mb-4 text-xs text-slate-500">Reply directly from the teacher portal. Parents will see updates in their portal and notifications.</p>
              {messages.length ? (
                <div className="space-y-4">
                  {messages.map((thread: any) => (
                    <div key={thread.id} className="rounded-2xl border border-slate-100 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <b className="text-sm text-slate-900">{thread.subject}</b>
                          <p className="mt-1 text-xs text-slate-500">
                            {thread.learnerName || 'Learner'} / Updated {new Date(thread.updatedAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">{thread.status}</span>
                          {thread.status !== 'CLOSED' && (
                            <button onClick={() => void updateThreadStatus(thread.id, 'CLOSED')} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600">
                              Close
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="mt-4 space-y-3">
                        {(thread.messages || []).map((message: any) => (
                          <div key={message.id} className={`rounded-2xl p-3 ${message.authorRole === 'TEACHER' ? 'bg-blue-50' : 'bg-slate-50'}`}>
                            <div className="flex justify-between gap-3">
                              <b className="text-xs text-slate-800">{message.authorName}</b>
                              <span className="text-[11px] text-slate-400">{new Date(message.createdAt).toLocaleString()}</span>
                            </div>
                            <p className="mt-2 text-sm text-slate-600">{message.message}</p>
                          </div>
                        ))}
                      </div>
                      {thread.status !== 'CLOSED' && (
                        <div className="mt-4 space-y-2">
                          <textarea
                            rows={3}
                            className={fieldClass}
                            placeholder="Type your reply to the parent"
                            value={replyDrafts[thread.id] || ''}
                            onChange={(event) => setReplyDrafts((current) => ({ ...current, [thread.id]: event.target.value }))}
                          />
                          <button onClick={() => void replyToParent(thread.id)} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
                            <Send className="mr-2 inline h-4 w-4" />
                            Send reply
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <Empty text="No parent questions are waiting." />
              )}
            </Panel>
          </div>
        )}

        {!loading && tab === 'requisitions' && (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
              <Metric label="My requisitions" value={requisitions.length} tone="blue" />
              <Metric label="Pending approval" value={requisitions.filter((item) => item.status === 'PENDING_APPROVAL').length} tone="amber" />
              <Metric label="In progress" value={requisitions.filter((item) => ['PROCUREMENT', 'ORDERED'].includes(item.status)).length} tone="emerald" />
            </div>
            <Panel title="My requisitions">
              <div className="mb-4 flex justify-end">
                <button onClick={() => window.location.assign('/requisitions/new')} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white">
                  <Plus className="mr-1 inline h-4 w-4" />
                  New requisition
                </button>
              </div>
              {requisitions.length ? (
                requisitions.map((item: any) => (
                  <div key={item.id} className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 py-4 last:border-0">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{item.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.reference} / {item.department || 'General'} / R {(item.estimatedTotal || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">{item.status}</span>
                      <button onClick={() => window.location.assign(`/requisitions/${item.id}`)} className="text-xs font-bold text-blue-600">
                        Open workflow
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <Empty text="You have not submitted any requisitions." />
              )}
            </Panel>
          </div>
        )}

        {!loading && tab === 'profile' && (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-4">
              <Info label="Assigned classes" value={String(classes.length)} />
              <Info label="Subjects taught" value={String(totalSubjects)} />
              <Info label="Weekly periods" value={String(classes.reduce((sum, item) => sum + item.timetable.length, 0))} />
              <Info label="Parent threads" value={String(messages.length)} />
            </div>
            <Panel title="Teacher profile">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Name">
                  <input className={fieldClass} value={profileDraft?.identity?.name || ''} onChange={(event) => setProfileDraft((current: any) => ({ ...current, identity: { ...current.identity, name: event.target.value } }))} />
                </Field>
                <Field label="Email">
                  <input className={fieldClass} value={profileDraft?.identity?.email || user?.email || ''} readOnly />
                </Field>
                <Field label="Department">
                  <input className={fieldClass} value={profileDraft?.profile?.department || ''} onChange={(event) => setProfileDraft((current: any) => ({ ...current, profile: { ...current.profile, department: event.target.value } }))} />
                </Field>
                <Field label="Classroom / office">
                  <input className={fieldClass} value={profileDraft?.profile?.room || ''} onChange={(event) => setProfileDraft((current: any) => ({ ...current, profile: { ...current.profile, room: event.target.value } }))} />
                </Field>
                <Field label="Phone">
                  <input className={fieldClass} value={profileDraft?.profile?.phone || ''} onChange={(event) => setProfileDraft((current: any) => ({ ...current, profile: { ...current.profile, phone: event.target.value } }))} />
                </Field>
                <Field label="Alternate phone">
                  <input className={fieldClass} value={profileDraft?.profile?.alternatePhone || ''} onChange={(event) => setProfileDraft((current: any) => ({ ...current, profile: { ...current.profile, alternatePhone: event.target.value } }))} />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Professional bio">
                    <textarea rows={4} className={fieldClass} value={profileDraft?.profile?.bio || ''} onChange={(event) => setProfileDraft((current: any) => ({ ...current, profile: { ...current.profile, bio: event.target.value } }))} />
                  </Field>
                </div>
              </div>
            </Panel>
            <Panel title="Notification preferences">
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  ['emailNotifications', 'Email notifications'],
                  ['inAppNotifications', 'In-app notifications'],
                  ['parentMessageAlerts', 'Parent message alerts'],
                  ['attendanceReminders', 'Attendance reminders'],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(profileDraft?.profile?.notificationPreferences?.[key])}
                      onChange={(event) =>
                        setProfileDraft((current: any) => ({
                          ...current,
                          profile: {
                            ...current.profile,
                            notificationPreferences: {
                              ...current.profile?.notificationPreferences,
                              [key]: event.target.checked,
                            },
                          },
                        }))
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
              <button onClick={() => void saveProfile()} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
                Save profile
              </button>
            </Panel>
          </div>
        )}
      </div>

      <Modal title={`Create ${work.type.toLowerCase().replace('_', ' ')}`} isOpen={showWork} onClose={() => setShowWork(false)}>
        <div className="space-y-4">
          <Field label="Type">
            <select className={fieldClass} value={work.type} onChange={(event) => setWork({ ...work, type: event.target.value })}>
              {['HOMEWORK', 'LESSON_PLAN', 'ANNOUNCEMENT', 'ASSESSMENT'].map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </Field>
          <Field label="Class">
            <select className={fieldClass} value={work.classId} onChange={(event) => setWork({ ...work, classId: event.target.value })}>
              <option value="">All my classes</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Title">
            <input className={fieldClass} value={work.title} onChange={(event) => setWork({ ...work, title: event.target.value })} />
          </Field>
          <Field label="Instructions / content">
            <textarea rows={5} className={fieldClass} value={work.instructions} onChange={(event) => setWork({ ...work, instructions: event.target.value })} />
          </Field>
          <Field label="Due date">
            <input type="datetime-local" className={fieldClass} value={work.dueAt} onChange={(event) => setWork({ ...work, dueAt: event.target.value })} />
          </Field>
          <Field label="Publish / schedule date (optional)">
            <input type="datetime-local" className={fieldClass} value={work.scheduledAt} onChange={(event) => setWork({ ...work, scheduledAt: event.target.value })} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={work.visibleToParents} onChange={(event) => setWork({ ...work, visibleToParents: event.target.checked })} />
            Visible to parents
          </label>
          <button onClick={() => void createWork()} className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white">
            Create item
          </button>
        </div>
      </Modal>

      <Modal title={`Attendance / ${attendanceClass?.name || ''}`} isOpen={!!attendanceClass} onClose={() => setAttendanceClass(null)}>
        <div className="max-h-[68vh] space-y-3 overflow-y-auto">
          {attendanceClass?.learners.map((learner: any) => (
            <div key={learner.id} className="rounded-2xl border border-slate-100 p-3">
              <p className="mb-2 text-sm font-bold text-slate-900">
                {learner.firstName} {learner.lastName}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <select
                  className={fieldClass}
                  value={attendance[learner.id]?.status}
                  onChange={(event) => setAttendance({ ...attendance, [learner.id]: { ...attendance[learner.id], status: event.target.value } })}
                >
                  {['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
                <input
                  className={fieldClass}
                  placeholder="Note"
                  value={attendance[learner.id]?.note || ''}
                  onChange={(event) => setAttendance({ ...attendance, [learner.id]: { ...attendance[learner.id], note: event.target.value } })}
                />
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <button onClick={() => void saveAttendance(false)} className="flex-1 rounded-xl border border-slate-200 py-2 text-sm font-bold text-slate-700">
              Save draft
            </button>
            <button onClick={() => void saveAttendance(true)} className="flex-1 rounded-xl bg-blue-600 py-2 text-sm font-bold text-white">
              Submit register
            </button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: 'blue' | 'amber' | 'rose' | 'emerald' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
    emerald: 'bg-emerald-50 text-emerald-700',
  } as const;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className={`mt-3 inline-flex rounded-xl px-3 py-1 text-2xl font-bold ${tones[tone]}`}>{value}</p>
    </div>
  );
}

function Panel({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <h3 className="mb-4 text-sm font-bold text-slate-950">{title}</h3>
      {children}
    </section>
  );
}

function Attention({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between border-b border-slate-100 py-3 text-sm last:border-0">
      <span className="text-slate-600">{label}</span>
      <b className="text-slate-950">{value}</b>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-slate-400">{text}</p>;
}

function WorkRow({ item }: { item: any }) {
  return (
    <div className="border-b border-slate-100 py-3 last:border-0">
      <p className="text-sm font-bold text-slate-900">{item.title}</p>
      <p className="text-xs text-slate-500">
        {item.status}
        {item.dueAt ? ` / Due ${new Date(item.dueAt).toLocaleString()}` : ''}
      </p>
    </div>
  );
}

function Quick({ label, icon: Icon, onClick }: { label: string; icon: any; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-2xl border border-slate-200 p-4 text-left text-sm font-semibold transition hover:border-blue-300 hover:bg-blue-50">
      <Icon className="mb-3 h-5 w-5 text-blue-600" />
      {label}
    </button>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}

function WorkList({ title, items, onCreate }: { title: string; items: any[]; onCreate: () => void }) {
  return (
    <Panel title={title}>
      <div className="mb-3 flex justify-end">
        <button onClick={onCreate} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white">
          <Plus className="mr-1 inline h-4 w-4" />
          New
        </button>
      </div>
      {items.length ? items.map((item) => <WorkRow key={item.id} item={item} />) : <Empty text={`No ${title.toLowerCase()} yet.`} />}
    </Panel>
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
