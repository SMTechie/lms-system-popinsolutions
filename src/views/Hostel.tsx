import React, { useEffect, useMemo, useState } from 'react';
import {
  BedDouble,
  Building2,
  CreditCard,
  DoorOpen,
  FileBarChart,
  Megaphone,
  Plus,
  QrCode,
  RefreshCw,
  ScanLine,
  Soup,
  TriangleAlert,
  UserCheck,
  Users,
  Wrench,
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import Modal from '../components/Modal';
import PortalLoader from '../components/PortalLoader';
import { apiRequest } from '../lib/api';
import { notifyAction } from '../lib/notify';

const tabs = [
  'Dashboard',
  'Applications',
  'Room Allocation',
  'Learners in Hostel',
  'Attendance / Roll Call',
  'Meals',
  'Incidents',
  'Maintenance',
  'Visitors',
  'Billing',
  'Reports',
] as const;

type TabKey = (typeof tabs)[number];

const inputClassName =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

const money = (value: number) =>
  `R ${Number(value || 0).toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString();
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  return new Date(value).toLocaleString();
};

const learnerName = (item: any) =>
  item?.learner ? `${item.learner.firstName} ${item.learner.lastName}` : 'Unassigned learner';

export default function Hostel() {
  const [tab, setTab] = useState<TabKey>('Dashboard');
  const [dashboard, setDashboard] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [reports, setReports] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState('');
  const [form, setForm] = useState<any>({});
  const [search, setSearch] = useState('');

  const load = async (activeTab = tab) => {
    setLoading(true);
    try {
      const [dashboardData, overviewData] = await Promise.all([
        apiRequest('/hostel/dashboard'),
        apiRequest('/hostel/overview'),
      ]);
      setDashboard(dashboardData);
      setData(overviewData);
      if (activeTab === 'Reports') {
        setReports(await apiRequest('/hostel/reports'));
      }
    } catch (error: any) {
      notifyAction(error.message || 'Unable to load hostel module', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (tab === 'Reports' && !reports) {
      apiRequest('/hostel/reports')
        .then(setReports)
        .catch((error) => notifyAction(error.message || 'Unable to load hostel reports', 'error'));
    }
  }, [reports, tab]);

  const buildings = data?.buildings || [];
  const residents = useMemo(
    () => (data?.allocations || []).filter((item: any) => ['RESERVED', 'CHECKED_IN'].includes(item.status)),
    [data?.allocations],
  );
  const beds = useMemo(
    () =>
      buildings.flatMap((building: any) =>
        building.blocks.flatMap((block: any) =>
          block.rooms.flatMap((room: any) =>
            room.beds.map((bed: any) => ({
              ...bed,
              room,
              block,
              building,
            })),
          ),
        ),
      ),
    [buildings],
  );
  const notices = data?.notices || [];
  const unresolvedMaintenance = (data?.maintenance || []).filter((item: any) => item.status !== 'RESOLVED');
  const openIncidents = (data?.incidents || []).filter((item: any) => item.status !== 'RESOLVED');
  const recentScanEvents = (data?.scanEvents || []).slice(0, 8);
  const todayRollCallScans = (data?.scanEvents || []).filter((item: any) => String(item.eventType || '').startsWith('ROLL_CALL_')).length;
  const todayMealScans = (data?.scanEvents || []).filter((item: any) => String(item.eventType || '').startsWith('MEAL_')).length;
  const todayGateScans = (data?.scanEvents || []).filter((item: any) =>
    ['CHECKED_IN_GATE', 'CHECKED_OUT_GATE'].includes(String(item.eventType || '')),
  ).length;
  const todayScanExceptions = (data?.scanExceptions || []).length;

  const scannerActions = [
    {
      id: 'scan-roll-call',
      title: 'Roll call scanner',
      description: 'Run hostel attendance from learner QR passes.',
      icon: UserCheck,
      accent: 'from-blue-600 to-cyan-500',
      buttonClassName: 'btn-primary',
      onClick: () => open('scan', { eventType: 'ROLL_CALL_PRESENT', context: 'MORNING_ROLL_CALL', stationRole: 'HOSTEL_SUPERVISOR' }),
      buttonLabel: 'Start roll call',
    },
    {
      id: 'scan-check-in',
      title: 'Gate check-in scanner',
      description: 'Capture learners returning into hostel.',
      icon: DoorOpen,
      accent: 'from-emerald-600 to-teal-500',
      buttonClassName: 'btn-secondary',
      onClick: () => open('scan', { eventType: 'CHECKED_IN_GATE', context: 'HOSTEL_GATE', stationRole: 'GATE_CONTROL' }),
      buttonLabel: 'Start check-in',
    },
    {
      id: 'scan-check-out',
      title: 'Gate check-out scanner',
      description: 'Record learners leaving through hostel gate control.',
      icon: ScanLine,
      accent: 'from-amber-500 to-orange-500',
      buttonClassName: 'btn-secondary',
      onClick: () => open('scan', { eventType: 'CHECKED_OUT_GATE', context: 'HOSTEL_GATE', stationRole: 'GATE_CONTROL' }),
      buttonLabel: 'Start check-out',
    },
    {
      id: 'scan-meals',
      title: 'Dining hall scanner',
      description: 'Track breakfast, lunch, and dinner attendance.',
      icon: Soup,
      accent: 'from-fuchsia-600 to-pink-500',
      buttonClassName: 'btn-secondary',
      onClick: () => open('scan', { eventType: 'MEAL_BREAKFAST', context: 'HOSTEL_DINING', stationRole: 'DINING_HALL' }),
      buttonLabel: 'Start meal scan',
    },
  ];

  const filteredApplications = useMemo(() => {
    const query = search.toLowerCase();
    return (data?.applications || []).filter((item: any) =>
      `${learnerName(item)} ${item.status} ${item.preferredBuilding?.name || ''}`.toLowerCase().includes(query),
    );
  }, [data?.applications, search]);

  const filteredResidents = useMemo(() => {
    const query = search.toLowerCase();
    return residents.filter((item: any) => {
      const roomLabel = item?.bed
        ? `${item.bed.room.block.building.name} ${item.bed.room.roomNumber} ${item.bed.label}`
        : '';
      return `${learnerName(item)} ${item.status} ${roomLabel}`.toLowerCase().includes(query);
    });
  }, [residents, search]);

  const submit = async (path: string, method = 'POST', body = form) => {
    try {
      await apiRequest(path, { method, body: JSON.stringify(body) });
      setModal('');
      setForm({});
      await load();
      notifyAction('Hostel record saved.', 'success');
    } catch (error: any) {
      notifyAction(error.message || 'Unable to save hostel record', 'error');
    }
  };

  const open = (name: string, initial: Record<string, any> = {}) => {
    setForm(initial);
    setModal(name);
  };

  return (
    <DashboardLayout title="Hostel Management">
      <div className="space-y-6">
        <section className="rounded-[28px] bg-gradient-to-r from-slate-950 via-blue-950 to-indigo-900 p-6 text-white shadow-lg">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-blue-200">Boarding operations</p>
              <h1 className="mt-2 text-3xl font-bold">Hostel management</h1>
              <p className="mt-2 text-sm leading-6 text-blue-100">
                Run placements, resident care, meal records, maintenance, visitor access, billing and reporting from
                one operations workspace.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => open('notice')}
                className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                <Megaphone className="mr-2 inline h-4 w-4" />
                Hostel notice
              </button>
              <button
                onClick={() => void load()}
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-blue-900 transition hover:bg-blue-50"
              >
                <RefreshCw className="mr-2 inline h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {tabs.map((item) => (
              <button
                key={item}
                onClick={() => setTab(item)}
                className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  tab === item ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        {loading && <PortalLoader label="Loading hostel operations..." />}

        {!loading && dashboard && tab === 'Dashboard' && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
              <Metric icon={BedDouble} label="Total capacity" value={dashboard.capacity} />
              <Metric icon={UserCheck} label="Occupied beds" value={dashboard.occupied} />
              <Metric icon={BedDouble} label="Available beds" value={dashboard.available} />
              <Metric icon={Users} label="Pending applications" value={dashboard.pendingApplications} />
              <Metric icon={TriangleAlert} label="Waiting list" value={dashboard.waitingList} />
              <Metric icon={CreditCard} label="Outstanding fees" value={money(dashboard.outstandingFees)} />
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
              <Panel
                title="Hostel buildings"
                action={
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => open('building')} className="btn-secondary">
                      + Building
                    </button>
                    <button onClick={() => open('block')} className="btn-secondary">
                      + Block
                    </button>
                    <button onClick={() => open('room')} className="btn-primary">
                      + Room
                    </button>
                  </div>
                }
              >
                <BuildingCards buildings={buildings} />
              </Panel>

              <Panel title="Operations snapshot">
                <div className="grid gap-4 sm:grid-cols-2">
                  <InfoCard label="Check-ins" value={dashboard.checkIns} hint="Active checked-in residents" />
                  <InfoCard label="Check-outs" value={dashboard.checkOuts} hint="Completed departures" />
                  <InfoCard label="Meal attendance" value={dashboard.mealAttendance} hint="Latest served meals" />
                  <InfoCard label="Open maintenance" value={dashboard.openMaintenance} hint="Pending facility work" />
                </div>
                <div className="mt-5 grid gap-3">
                  <QuickRow label="Open incidents" value={openIncidents.length} />
                  <QuickRow label="Open maintenance requests" value={unresolvedMaintenance.length} />
                  <QuickRow label="Recent notices" value={notices.length} />
                  <QuickRow label="Recent QR scans" value={(data?.scanEvents || []).length} />
                </div>
              </Panel>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
              <Panel title="Recent notices" action={<button onClick={() => open('notice')} className="btn-secondary">+ Notice</button>}>
                <div className="space-y-3">
                  {notices.slice(0, 4).map((notice: any) => (
                    <div key={notice.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{notice.title}</p>
                          <p className="mt-1 text-sm text-slate-600">{notice.message}</p>
                        </div>
                        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                          {formatDate(notice.createdAt)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {!notices.length && <EmptyState text="No hostel notices published yet." />}
                </div>
              </Panel>

              <Panel title="Operational alerts">
                <div className="space-y-3">
                  <AlertCard
                    icon={TriangleAlert}
                    title="Hostel applications awaiting review"
                    value={dashboard.pendingApplications}
                    tone="amber"
                  />
                  <AlertCard
                    icon={Wrench}
                    title="Maintenance requests still open"
                    value={unresolvedMaintenance.length}
                    tone="red"
                  />
                  <AlertCard
                    icon={CreditCard}
                    title="Outstanding hostel balances"
                    value={money(dashboard.outstandingFees)}
                    tone="blue"
                  />
                </div>
              </Panel>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
              <Panel title="Scanner command centre">
                <div className="grid gap-4 md:grid-cols-2">
                  {scannerActions.map((action) => (
                    <ScannerActionCard
                      key={action.id}
                      title={action.title}
                      description={action.description}
                      icon={action.icon}
                      accent={action.accent}
                      buttonClassName={action.buttonClassName}
                      onClick={action.onClick}
                      buttonLabel={action.buttonLabel}
                    />
                  ))}
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-4">
                  <ScannerMiniMetric label="Roll call scans" value={todayRollCallScans} />
                  <ScannerMiniMetric label="Gate scans" value={todayGateScans} />
                  <ScannerMiniMetric label="Meal scans" value={todayMealScans} />
                  <ScannerMiniMetric label="Exceptions" value={todayScanExceptions} tone="alert" />
                </div>
              </Panel>

              <Panel
                title="Live scanner feed"
                action={
                  <button onClick={() => open('scan')} className="btn-secondary">
                    <QrCode className="mr-1 inline h-4 w-4" />
                    Manual scan
                  </button>
                }
              >
                <div className="space-y-3">
                  {recentScanEvents.map((item: any) => (
                    <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {item.learner ? `${item.learner.firstName} ${item.learner.lastName}` : 'Learner'}
                          </p>
                          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
                            {String(item.eventType || '').replaceAll('_', ' ')}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {String(item.context || 'HOSTEL').replaceAll('_', ' ')} · {item.scannedBy || 'Hostel staff'}
                          </p>
                        </div>
                        <span className="text-right text-xs text-slate-500">{formatDateTime(item.scannedAt)}</span>
                      </div>
                    </div>
                  ))}
                  {!recentScanEvents.length && <EmptyState text="No scanner activity has been recorded yet." />}
                </div>
              </Panel>
            </div>
          </div>
        )}

        {!loading && tab !== 'Dashboard' && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search hostel records..."
              className="w-full max-w-md rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        )}

        {!loading && tab === 'Applications' && (
          <Panel
            title="Hostel applications"
            action={
              <button onClick={() => open('application')} className="btn-primary">
                <Plus className="mr-1 inline h-4 w-4" />
                New application
              </button>
            }
          >
            <Table
              heads={['Learner', 'Year / preference', 'Boarding type', 'Status', 'Decision']}
              rows={filteredApplications.map((item: any) => [
                learnerName(item),
                `${item.academicYear || '-'} · ${item.preferredBuilding?.name || 'Any hostel'}`,
                item.boardingType || 'Standard',
                <Status key={`${item.id}-status`} value={item.status} />,
                <div key={`${item.id}-actions`} className="flex flex-wrap gap-1">
                  {['APPROVED', 'WAITLISTED', 'REJECTED'].map((status) => (
                    <button
                      key={status}
                      onClick={() => void submit(`/hostel/applications/${item.id}`, 'PATCH', { status })}
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 transition hover:bg-slate-50"
                    >
                      {status}
                    </button>
                  ))}
                </div>,
              ])}
            />
          </Panel>
        )}

        {!loading && tab === 'Room Allocation' && (
          <div className="space-y-5">
            <Panel
              title="Buildings, blocks, rooms and beds"
              action={
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => open('building')} className="btn-secondary">
                    + Building
                  </button>
                  <button onClick={() => open('block')} className="btn-secondary">
                    + Block
                  </button>
                  <button onClick={() => open('room')} className="btn-secondary">
                    + Room
                  </button>
                  <button onClick={() => open('allocation')} className="btn-primary">
                    Allocate bed
                  </button>
                </div>
              }
            >
              <BuildingCards buildings={buildings} />
            </Panel>

            <Panel title="Bed directory">
              <Table
                heads={['Building', 'Room', 'Bed', 'Status', 'Monthly fee']}
                rows={beds.map((bed: any) => [
                  bed.building.name,
                  `${bed.block.name} · ${bed.room.roomNumber}`,
                  bed.label,
                  <Status key={`${bed.id}-status`} value={bed.status} />,
                  money(Number(bed.room.monthlyFee || 0)),
                ])}
              />
            </Panel>
          </div>
        )}

        {!loading && tab === 'Learners in Hostel' && (
          <div className="space-y-5">
          <SectionLead
            eyebrow="Gate control"
            title="Hostel in / out scanner"
            description="Use QR scanning for fast gate movement capture, then manage bed-level actions below."
            actions={
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => open('scan', { eventType: 'CHECKED_IN_GATE', context: 'HOSTEL_GATE', stationRole: 'GATE_CONTROL' })}
                  className="btn-secondary"
                >
                  <QrCode className="mr-1 inline h-4 w-4" />
                  Scan check in
                </button>
                <button
                  onClick={() => open('scan', { eventType: 'CHECKED_OUT_GATE', context: 'HOSTEL_GATE', stationRole: 'GATE_CONTROL' })}
                  className="btn-primary"
                >
                  <QrCode className="mr-1 inline h-4 w-4" />
                  Scan check out
                </button>
              </div>
            }
          />
          <Panel title="Current residents">
            <Table
              heads={['Learner', 'Hostel / room / bed', 'Stay dates', 'Status', 'Actions']}
              rows={filteredResidents.map((item: any) => [
                learnerName(item),
                item.bed
                  ? `${item.bed.room.block.building.name} · ${item.bed.room.roomNumber} · ${item.bed.label}`
                  : 'Bed not assigned',
                `${formatDate(item.startDate)} to ${formatDate(item.expectedEndDate)}`,
                <Status key={`${item.id}-status`} value={item.status} />,
                <div key={`${item.id}-actions`} className="flex flex-wrap gap-2">
                  {item.status === 'RESERVED' && (
                    <button onClick={() => void submit(`/hostel/allocations/${item.id}/check-in`)} className="btn-secondary">
                      Check in
                    </button>
                  )}
                  <button onClick={() => open('transfer', { allocationId: item.id })} className="btn-secondary">
                    Transfer
                  </button>
                  <button
                    onClick={() =>
                      void submit(`/hostel/allocations/${item.id}/check-out`, 'POST', { reason: 'Completed stay' })
                    }
                    className="btn-secondary"
                  >
                    Check out
                  </button>
                </div>,
              ])}
            />
          </Panel>
          </div>
        )}

        {!loading && tab === 'Attendance / Roll Call' && (
          <div className="space-y-5">
          <SectionLead
            eyebrow="Attendance control"
            title="Roll call scanner"
            description="Scan learner hostel QR passes during morning or evening checks, or submit a full manual register."
            actions={
              <div className="flex flex-wrap gap-2">
                <button onClick={() => open('scan', { eventType: 'ROLL_CALL_PRESENT', context: 'MORNING_ROLL_CALL', stationRole: 'HOSTEL_SUPERVISOR' })} className="btn-secondary">
                  <QrCode className="mr-1 inline h-4 w-4" />
                  Morning scan
                </button>
                <button onClick={() => open('scan', { eventType: 'ROLL_CALL_PRESENT', context: 'EVENING_ROLL_CALL', stationRole: 'HOSTEL_SUPERVISOR' })} className="btn-secondary">
                  <QrCode className="mr-1 inline h-4 w-4" />
                  Evening scan
                </button>
                <button onClick={() => open('roll')} className="btn-primary">
                  + Take roll call
                </button>
              </div>
            }
          />
          <Panel title="Hostel roll calls">
            <Table
              heads={['Date', 'Session', 'Recorded', 'Status']}
              rows={(data.rollCalls || []).map((item: any) => [
                formatDate(item.rollDate),
                item.session,
                item.entries?.length || 0,
                <Status key={item.id} value={item.status} />,
              ])}
            />
          </Panel>
          </div>
        )}

        {!loading && tab === 'Meals' && (
          <div className="space-y-5">
          <SectionLead
            eyebrow="Dining hall"
            title="Meal scanner"
            description="Run breakfast, lunch, dinner, and special meal scans from learner QR passes. Meal scan totals feed the register."
            actions={
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => open('scan', { eventType: 'MEAL_BREAKFAST', context: 'HOSTEL_DINING', stationRole: 'DINING_HALL' })}
                  className="btn-secondary"
                >
                  <QrCode className="mr-1 inline h-4 w-4" />
                  Breakfast scan
                </button>
                <button
                  onClick={() => open('scan', { eventType: 'MEAL_LUNCH', context: 'HOSTEL_DINING', stationRole: 'DINING_HALL' })}
                  className="btn-secondary"
                >
                  <QrCode className="mr-1 inline h-4 w-4" />
                  Lunch scan
                </button>
                <button
                  onClick={() => open('scan', { eventType: 'MEAL_DINNER', context: 'HOSTEL_DINING', stationRole: 'DINING_HALL' })}
                  className="btn-secondary"
                >
                  <QrCode className="mr-1 inline h-4 w-4" />
                  Dinner scan
                </button>
                <button onClick={() => open('meal')} className="btn-primary">
                  + Meal register
                </button>
              </div>
            }
          />
          <Panel title="Meal register">
            <Table
              heads={['Date', 'Meal', 'Planned', 'Served']}
              rows={(data.meals || []).map((item: any) => [
                formatDate(item.mealDate),
                item.mealType,
                item.plannedCount,
                item.servedCount,
              ])}
            />
          </Panel>
          </div>
        )}

        {!loading && tab === 'Incidents' && (
          <Panel
            title="Discipline and welfare incidents"
            action={
              <button onClick={() => open('incident')} className="btn-primary">
                + Log incident
              </button>
            }
          >
            <Table
              heads={['Incident', 'Learner', 'Severity', 'Date', 'Status']}
              rows={(data.incidents || []).map((item: any) => [
                <div key={`${item.id}-title`}>
                  <p className="font-semibold text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-500">{item.category}</p>
                </div>,
                data.learners.find((learner: any) => learner.id === item.learnerId)
                  ? `${data.learners.find((learner: any) => learner.id === item.learnerId).firstName} ${
                      data.learners.find((learner: any) => learner.id === item.learnerId).lastName
                    }`
                  : 'General hostel',
                <Status key={`${item.id}-severity`} value={item.severity} />,
                formatDate(item.occurredAt),
                <button
                  key={`${item.id}-status`}
                  onClick={() =>
                    void submit(`/hostel/incidents/${item.id}`, 'PATCH', {
                      status: 'RESOLVED',
                      actionTaken: 'Resolved by hostel staff',
                    })
                  }
                >
                  <Status value={item.status} />
                </button>,
              ])}
            />
          </Panel>
        )}

        {!loading && tab === 'Maintenance' && (
          <Panel
            title="Maintenance requests"
            action={
              <button onClick={() => open('maintenance')} className="btn-primary">
                + Request maintenance
              </button>
            }
          >
            <Table
              heads={['Request', 'Location', 'Priority', 'Status']}
              rows={(data.maintenance || []).map((item: any) => [
                <div key={`${item.id}-title`}>
                  <p className="font-semibold text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-500">{item.source}</p>
                </div>,
                item.roomId || item.buildingId || 'General',
                <Status key={`${item.id}-priority`} value={item.priority} />,
                <button
                  key={`${item.id}-status`}
                  onClick={() =>
                    void submit(`/hostel/maintenance/${item.id}`, 'PATCH', {
                      status: 'RESOLVED',
                      resolution: 'Completed',
                    })
                  }
                >
                  <Status value={item.status} />
                </button>,
              ])}
            />
          </Panel>
        )}

        {!loading && tab === 'Visitors' && (
          <Panel
            title="Visitor log"
            action={
              <button onClick={() => open('visitor')} className="btn-primary">
                + Check visitor in
              </button>
            }
          >
            <Table
              heads={['Visitor', 'Learner', 'Checked in', 'Checked out', 'Status']}
              rows={(data.visitors || []).map((item: any) => [
                item.visitorName,
                data.learners.find((learner: any) => learner.id === item.learnerId)
                  ? `${data.learners.find((learner: any) => learner.id === item.learnerId).firstName} ${
                      data.learners.find((learner: any) => learner.id === item.learnerId).lastName
                    }`
                  : 'Learner',
                formatDateTime(item.checkedInAt),
                formatDateTime(item.checkedOutAt),
                item.status === 'CHECKED_IN' ? (
                  <button className="btn-secondary" onClick={() => void submit(`/hostel/visitors/${item.id}/check-out`)}>
                    Check out
                  </button>
                ) : (
                  <Status value={item.status} />
                ),
              ])}
            />
          </Panel>
        )}

        {!loading && tab === 'Billing' && (
          <Panel
            title="Hostel billing"
            action={
              <button onClick={() => open('charge')} className="btn-primary">
                + Add hostel charge
              </button>
            }
          >
            <Table
              heads={['Learner', 'Description', 'Due', 'Amount', 'Balance', 'Status']}
              rows={(data.charges || []).map((item: any) => [
                learnerName(item),
                item.description,
                formatDate(item.dueDate),
                money(Number(item.amount || 0)),
                money(Number(item.amount || 0) - Number(item.paidAmount || 0)),
                <Status key={item.id} value={item.status} />,
              ])}
            />
          </Panel>
        )}

        {!loading && tab === 'Reports' && reports && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Metric icon={FileBarChart} label="Occupancy" value={`${reports.dashboard.occupied}/${reports.dashboard.capacity}`} />
              <Metric icon={Soup} label="Meals served" value={reports.meals.servedCount || 0} />
              <Metric icon={CreditCard} label="Outstanding" value={money(reports.dashboard.outstandingFees)} />
              <Metric icon={TriangleAlert} label="Waitlist" value={reports.dashboard.waitingList} />
            </div>

            <Panel title="Occupancy by building">
              <Table
                heads={['Building', 'Capacity', 'Occupied', 'Utilisation']}
                rows={(reports.occupancyByBuilding || []).map((item: any) => [
                  item.name,
                  item.capacity,
                  item.occupied,
                  `${item.capacity ? Math.round((item.occupied / item.capacity) * 100) : 0}%`,
                ])}
              />
            </Panel>
            <Panel title="Today&apos;s scan breakdown">
              <Table
                heads={['Event', 'Count']}
                rows={(reports.scanBreakdown || []).map((item: any) => [
                  String(item.eventType || '').replaceAll('_', ' '),
                  item.count,
                ])}
              />
            </Panel>
            <Panel title="Scans by station role">
              <Table
                heads={['Station role', 'Scans today']}
                rows={(reports.scanRoles || []).map((item: any) => [
                  String(item.stationRole || '').replaceAll('_', ' '),
                  item.count,
                ])}
              />
            </Panel>
            <Panel title="Scan exceptions">
              <Table
                heads={['Learner', 'Event', 'Reason', 'Logged']}
                rows={(reports.scanExceptions || []).map((item: any) => [
                  item.learner ? `${item.learner.firstName} ${item.learner.lastName}` : 'Learner',
                  String(item.eventType || '').replaceAll('_', ' '),
                  item.reason,
                  formatDateTime(item.createdAt),
                ])}
              />
            </Panel>
          </div>
        )}

        <Editor
          modal={modal}
          form={form}
          setForm={setForm}
          close={() => setModal('')}
          submit={submit}
          data={data}
          beds={beds}
          residents={residents}
        />
      </div>
    </DashboardLayout>
  );
}

function Editor({
  modal,
  form,
  setForm,
  close,
  submit,
  data,
  beds,
  residents,
}: {
  modal: string;
  form: any;
  setForm: (value: any) => void;
  close: () => void;
  submit: (path: string, method?: string, body?: any) => Promise<void>;
  data: any;
  beds: any[];
  residents: any[];
}) {
  const [cameraActive, setCameraActive] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);

  const field = (key: string, label: string, type = 'text', placeholder = '') => (
    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
      {label}
      <input
        type={type}
        value={form[key] || ''}
        placeholder={placeholder}
        onChange={(event) => setForm({ ...form, [key]: event.target.value })}
        className={`${inputClassName} mt-1.5`}
      />
    </label>
  );

  const textarea = (key: string, label: string, placeholder = '') => (
    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
      {label}
      <textarea
        value={form[key] || ''}
        placeholder={placeholder}
        onChange={(event) => setForm({ ...form, [key]: event.target.value })}
        className={`${inputClassName} mt-1.5 min-h-[96px]`}
      />
    </label>
  );

  const select = (key: string, label: string, options: Array<{ value: string; label: string }>) => (
    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
      {label}
      <select
        value={form[key] || ''}
        onChange={(event) => setForm({ ...form, [key]: event.target.value })}
        className={`${inputClassName} mt-1.5`}
      >
        <option value="">Select...</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );

  const learners = (data?.learners || []).map((learner: any) => ({
    value: learner.id,
    label: `${learner.firstName} ${learner.lastName} · ${learner.studentNumber}`,
  }));
  const buildings = (data?.buildings || []).map((building: any) => ({
    value: building.id,
    label: building.name,
  }));
  const blocks = (data?.buildings || []).flatMap((building: any) =>
    building.blocks.map((block: any) => ({
      value: block.id,
      label: `${building.name} · ${block.name}`,
    })),
  );
  const availableBeds = beds
    .filter((bed) => bed.status === 'AVAILABLE')
    .map((bed) => ({
      value: bed.id,
      label: `${bed.building.name} · ${bed.room.roomNumber} · ${bed.label}`,
    }));

  let title = '';
  let path = '';
  let content: React.ReactNode = null;

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
  };

  useEffect(() => {
    if (modal !== 'scan') {
      stopCamera();
    }
    return () => stopCamera();
  }, [modal]);

  useEffect(() => {
    if (!cameraActive || modal !== 'scan') return;
    let cancelled = false;
    let frameId = 0;
    const Detector = (window as any).BarcodeDetector;

    const start = async () => {
      if (!Detector || !navigator.mediaDevices?.getUserMedia) {
        notifyAction('Camera scanning is not supported in this browser. You can still paste the QR value.', 'warning');
        setCameraActive(false);
        return;
      }

      try {
        const detector = new Detector({ formats: ['qr_code'] });
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setScannerReady(true);

        const scan = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            const value = barcodes?.[0]?.rawValue;
            if (value) {
              setForm((current: any) => ({ ...current, qrCodeValue: value }));
              notifyAction('QR code detected. Ready to save the scan.', 'success');
              stopCamera();
              return;
            }
          } catch {}
          frameId = window.requestAnimationFrame(() => void scan());
        };

        frameId = window.requestAnimationFrame(() => void scan());
      } catch (error: any) {
        notifyAction(error.message || 'Could not start the camera scanner.', 'error');
        setCameraActive(false);
      }
    };

    void start();

    return () => {
      cancelled = true;
      setScannerReady(false);
      if (frameId) window.cancelAnimationFrame(frameId);
      stopCamera();
    };
  }, [cameraActive, modal, setForm]);

  switch (modal) {
    case 'building':
      title = 'New hostel building';
      path = '/hostel/buildings';
      content = (
        <>
          {field('name', 'Building name')}
          {field('code', 'Code')}
          {select(
            'genderPolicy',
            'Gender policy',
            ['MIXED', 'FEMALE', 'MALE'].map((value) => ({ value, label: value })),
          )}
          {field('address', 'Location / address')}
        </>
      );
      break;
    case 'block':
      title = 'New block';
      path = '/hostel/blocks';
      content = (
        <>
          {select('buildingId', 'Building', buildings)}
          {field('name', 'Block name')}
          {field('code', 'Code')}
        </>
      );
      break;
    case 'room':
      title = 'New room';
      path = '/hostel/rooms';
      content = (
        <>
          {select('blockId', 'Block', blocks)}
          {field('roomNumber', 'Room number')}
          {field('capacity', 'Bed capacity', 'number')}
          {field('monthlyFee', 'Monthly fee', 'number')}
        </>
      );
      break;
    case 'application':
      title = 'Hostel application';
      path = '/hostel/applications';
      content = (
        <>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
            Parent applications normally come through the Parent Portal. This form lets staff capture or backfill a
            hostel request.
          </div>
          {select('learnerId', 'Learner', learners)}
          {field('academicYear', 'Academic year', 'number')}
          {select('preferredBuildingId', 'Preferred building', buildings)}
          {select(
            'boardingType',
            'Boarding type',
            ['FULL', 'WEEKLY', 'FLEXIBLE'].map((value) => ({ value, label: value })),
          )}
          {textarea('notes', 'Notes', 'Add family, transport or welfare notes')}
        </>
      );
      break;
    case 'allocation':
      title = 'Allocate a bed';
      path = '/hostel/allocations';
      content = (
        <>
          {select('learnerId', 'Learner', learners)}
          {select('bedId', 'Available bed', availableBeds)}
          {field('startDate', 'Start date', 'date')}
          {field('expectedEndDate', 'Expected end date', 'date')}
          {textarea('notes', 'Notes', 'Placement notes, guardian approvals, care considerations')}
        </>
      );
      break;
    case 'transfer':
      title = 'Transfer room / bed';
      path = `/hostel/allocations/${form.allocationId}/transfer`;
      content = (
        <>
          {select('bedId', 'New available bed', availableBeds)}
          {textarea('reason', 'Reason', 'Why is this learner being moved?')}
        </>
      );
      break;
    case 'roll':
      title = 'Take roll call';
      path = '/hostel/roll-calls';
      content = (
        <>
          {field('rollDate', 'Date', 'date')}
          {select(
            'session',
            'Session',
            ['MORNING', 'EVENING', 'CUSTOM'].map((value) => ({ value, label: value })),
          )}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
            Submitting this records all {residents.length} active residents as present. Exceptions can be added later in
            the attendance flow.
          </div>
        </>
      );
      break;
    case 'meal':
      title = 'Meal register';
      path = '/hostel/meals';
      content = (
        <>
          {field('mealDate', 'Date', 'date')}
          {select(
            'mealType',
            'Meal',
            ['BREAKFAST', 'LUNCH', 'DINNER', 'SPECIAL'].map((value) => ({ value, label: value })),
          )}
          {field('plannedCount', 'Planned meals', 'number')}
          {field('servedCount', 'Meals served', 'number')}
        </>
      );
      break;
    case 'incident':
      title = 'Log hostel incident';
      path = '/hostel/incidents';
      content = (
        <>
          {field('title', 'Title')}
          {select('learnerId', 'Learner (optional)', learners)}
          {select(
            'severity',
            'Severity',
            ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((value) => ({ value, label: value })),
          )}
          {field('category', 'Category', 'text', 'Welfare, conduct, health, safety')}
          {textarea('description', 'Description')}
        </>
      );
      break;
    case 'maintenance':
      title = 'Maintenance request';
      path = '/hostel/maintenance';
      content = (
        <>
          {field('title', 'Title')}
          {select('buildingId', 'Building', buildings)}
          {select(
            'priority',
            'Priority',
            ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((value) => ({ value, label: value })),
          )}
          {field('category', 'Category', 'text', 'Electrical, plumbing, security, furniture')}
          {textarea('description', 'Description')}
        </>
      );
      break;
    case 'visitor':
      title = 'Check visitor in';
      path = '/hostel/visitors';
      content = (
        <>
          {select('learnerId', 'Visiting learner', learners)}
          {field('visitorName', 'Visitor name')}
          {field('identityNumber', 'ID number')}
          {field('phone', 'Phone')}
          {field('purpose', 'Purpose')}
        </>
      );
      break;
    case 'charge':
      title = 'Add hostel charge';
      path = '/hostel/charges';
      content = (
        <>
          {select('learnerId', 'Learner', learners)}
          {field('description', 'Description')}
          {field('billingPeriod', 'Billing period', 'text', '2026-08')}
          {field('amount', 'Amount', 'number')}
          {field('dueDate', 'Due date', 'date')}
        </>
      );
      break;
    case 'notice':
      title = 'Publish hostel notice';
      path = '/hostel/notices';
      content = (
        <>
          {field('title', 'Title')}
          {select('buildingId', 'Building (optional)', buildings)}
          {textarea('message', 'Message', 'Write the notice shown to parents and staff')}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
            Notices publish in-app immediately and can later be routed to email, SMS or WhatsApp.
          </div>
        </>
      );
      break;
    case 'scan':
      title = 'Scan learner hostel QR';
      path = '/hostel/scans';
      content = (
        <>
          {select(
            'eventType',
            'Scan type',
            ['ROLL_CALL_PRESENT', 'CHECKED_IN_GATE', 'CHECKED_OUT_GATE', 'MEAL_BREAKFAST', 'MEAL_LUNCH', 'MEAL_DINNER', 'MEAL_SPECIAL'].map((value) => ({
              value,
              label: value.replaceAll('_', ' '),
            })),
          )}
          {select(
            'context',
            'Context',
            ['MORNING_ROLL_CALL', 'EVENING_ROLL_CALL', 'HOSTEL_GATE', 'HOSTEL_DINING'].map((value) => ({
              value,
              label: value.replaceAll('_', ' '),
            })),
          )}
          {select(
            'stationRole',
            'Station role',
            ['HOSTEL_SUPERVISOR', 'GATE_CONTROL', 'DINING_HALL'].map((value) => ({
              value,
              label: value.replaceAll('_', ' '),
            })),
          )}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Camera scanner</p>
                <p className="text-xs text-slate-500">Use the device camera to read the learner hostel QR code.</p>
              </div>
              <div className="flex gap-2">
                {!cameraActive ? (
                  <button
                    type="button"
                    onClick={() => {
                      setScannerReady(false);
                      setCameraActive(true);
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                  >
                    Start camera
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                  >
                    Stop camera
                  </button>
                )}
              </div>
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-black">
              <video ref={videoRef} muted playsInline className="h-52 w-full object-cover" />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {cameraActive
                ? scannerReady
                  ? 'Scanner is running. Hold the learner QR inside the frame.'
                  : 'Preparing the camera scanner...'
                : 'Camera is off. You can also paste the QR value manually below.'}
            </p>
          </div>
          {field('qrCodeValue', 'Learner QR value', 'text', 'Paste or scan the learner QR code here')}
          {textarea('notes', 'Notes', 'Optional gate, duty or hostel note')}
        </>
      );
      break;
  }

  if (!modal) return null;

  const body =
    modal === 'roll'
      ? {
          ...form,
          entries: residents.map((resident: any) => ({ learnerId: resident.learnerId, status: 'PRESENT' })),
          status: 'SUBMITTED',
        }
      : form;

  return (
    <Modal title={title} isOpen onClose={close}>
      <div className="space-y-4">
        {content}
        <div className="flex gap-3 pt-2">
          <button
            onClick={close}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={() => void submit(path, 'POST', body)}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}

function SectionLead({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-gradient-to-r from-slate-950 via-blue-950 to-indigo-900 p-5 text-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.26em] text-blue-200">{eyebrow}</p>
          <h2 className="mt-2 text-2xl font-bold">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-blue-100">{description}</p>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </section>
  );
}

function ScannerActionCard({
  title,
  description,
  icon: Icon,
  accent,
  buttonClassName,
  onClick,
  buttonLabel,
}: {
  title: string;
  description: string;
  icon: any;
  accent: string;
  buttonClassName: string;
  onClick: () => void;
  buttonLabel: string;
}) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
      <div className={`bg-gradient-to-r ${accent} p-4 text-white`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold">{title}</p>
            <p className="mt-1 text-xs text-white/80">{description}</p>
          </div>
          <div className="rounded-2xl bg-white/15 p-3">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </div>
      <div className="p-4">
        <button onClick={onClick} className={`${buttonClassName} w-full`}>
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}

function ScannerMiniMetric({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: any;
  tone?: 'default' | 'alert';
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${
        tone === 'alert' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'
      }`}
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-bold text-slate-950">{value}</p>
    </div>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        {title && <h3 className="text-base font-bold text-slate-900">{title}</h3>}
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Metric({ icon: Icon, label, value }: { icon: any; label: string; value: any }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <Icon className="h-4 w-4 text-blue-600" />
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
    </div>
  );
}

function InfoCard({ label, value, hint }: { label: string; value: any; hint: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function QuickRow({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm">
      <span className="text-slate-600">{label}</span>
      <span className="font-bold text-slate-950">{value}</span>
    </div>
  );
}

function AlertCard({
  icon: Icon,
  title,
  value,
  tone,
}: {
  icon: any;
  title: string;
  value: any;
  tone: 'amber' | 'red' | 'blue';
}) {
  const palette =
    tone === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : tone === 'red'
        ? 'border-red-200 bg-red-50 text-red-900'
        : 'border-blue-200 bg-blue-50 text-blue-900';

  return (
    <div className={`rounded-2xl border p-4 ${palette}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-2 text-2xl font-bold">{value}</p>
        </div>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

function Status({ value }: { value: string }) {
  const palette = ['APPROVED', 'ACTIVE', 'AVAILABLE', 'PAID', 'RESOLVED', 'SUBMITTED', 'CHECKED_IN'].includes(value)
    ? 'bg-emerald-50 text-emerald-700'
    : ['REJECTED', 'CRITICAL', 'URGENT', 'OVERDUE'].includes(value)
      ? 'bg-red-50 text-red-700'
      : 'bg-amber-50 text-amber-700';

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${palette}`}>
      {value?.replaceAll('_', ' ')}
    </span>
  );
}

function Table({ heads, rows }: { heads: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {heads.map((head) => (
              <th key={head} className="px-3 py-3 font-semibold">
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t border-slate-100 align-top">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-3 text-slate-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <EmptyState text="No records yet." />}
    </div>
  );
}

function BuildingCards({ buildings }: { buildings: any[] }) {
  if (!buildings.length) {
    return <EmptyState text="Create a building, block and room to begin allocating beds." />;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {buildings.map((building) => {
        const rooms = building.blocks.flatMap((block: any) => block.rooms);
        const beds = rooms.flatMap((room: any) => room.beds);
        const occupied = beds.filter((bed: any) => bed.status === 'OCCUPIED').length;
        const utilisation = beds.length ? Math.round((occupied / beds.length) * 100) : 0;

        return (
          <div key={building.id} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-50 p-2">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-bold text-slate-900">{building.name}</p>
                <p className="text-xs text-slate-500">
                  {building.blocks.length} blocks · {rooms.length} rooms
                </p>
              </div>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-blue-600" style={{ width: `${utilisation}%` }} />
            </div>

            <div className="mt-3 grid gap-2 text-sm">
              <QuickRow label="Occupied beds" value={occupied} />
              <QuickRow label="Available beds" value={beds.length - occupied} />
              <QuickRow label="Capacity" value={beds.length} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">{text}</p>;
}
