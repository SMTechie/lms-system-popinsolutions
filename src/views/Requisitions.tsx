import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, ClipboardList, DollarSign, FileText, Filter, Plus, Search } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import DashboardCard from '../components/DashboardCard';
import ChartWidget from '../components/ChartWidget';
import { apiRequest } from '../lib/api';
import { notifyAction } from '../lib/notify';

interface RequisitionOverview {
  totalRequisitions: number;
  pendingApprovals: number;
  ordersInProgress: number;
  deliveredItems: number;
  monthlySpend: number;
  byDepartment: { name: string; value: number }[];
  spendByCategory: { name: string; value: number }[];
  approvalMetrics: { averageHours: number };
}

interface RequisitionItem {
  id: string;
  itemName: string;
  category?: string | null;
  quantity: number;
  itemType: string;
  estimatedUnitCost?: number | null;
  totalCost?: number | null;
}

interface RequisitionTicket {
  id: string;
  reference?: string | null;
  title: string;
  department?: string | null;
  priority?: string | null;
  status: string;
  createdAt: string;
  createdBy?: { name?: string | null; email: string };
  requisition?: { estimatedTotalCost?: number | null };
  items: RequisitionItem[];
  estimatedTotal?: number;
}

const statusStyles: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-rose-100 text-rose-700',
  PROCUREMENT: 'bg-indigo-100 text-indigo-700',
  ORDERED: 'bg-purple-100 text-purple-700',
  DELIVERED: 'bg-emerald-100 text-emerald-700',
  CLOSED: 'bg-gray-200 text-gray-700'
};

export default function Requisitions() {
  const [overview, setOverview] = useState<RequisitionOverview | null>(null);
  const [requisitions, setRequisitions] = useState<RequisitionTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: '', status: '', department: '', priority: '' });

  const fetchOverview = async () => {
    const data = await apiRequest<RequisitionOverview>('/tickets/requisitions/overview');
    setOverview(data);
  };

  const fetchList = async () => {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.status) params.set('status', filters.status);
    if (filters.department) params.set('department', filters.department);
    if (filters.priority) params.set('priority', filters.priority);

    const data = await apiRequest<{ items: RequisitionTicket[] }>('/tickets/requisitions?' + params.toString());
    setRequisitions(data.items || []);
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([fetchOverview(), fetchList()])
      .catch((err) => notifyAction(err.message || 'Failed to load requisitions', 'error'))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const handleFilter = async () => {
    setLoading(true);
    try {
      await fetchList();
    } catch (err: any) {
      notifyAction(err.message || 'Failed to load requisitions', 'error');
    } finally {
      setLoading(false);
    }
  };

  const summaryCards = useMemo(() => {
    return [
      {
        title: 'Total Requisitions',
        value: overview?.totalRequisitions ?? 0,
        icon: <FileText className="w-5 h-5 text-blue-600" />,
        iconBg: 'bg-blue-50'
      },
      {
        title: 'Pending Approvals',
        value: overview?.pendingApprovals ?? 0,
        icon: <ClipboardList className="w-5 h-5 text-amber-600" />,
        iconBg: 'bg-amber-50'
      },
      {
        title: 'Orders In Progress',
        value: overview?.ordersInProgress ?? 0,
        icon: <Bell className="w-5 h-5 text-purple-600" />,
        iconBg: 'bg-purple-50'
      },
      {
        title: 'Monthly Spend',
        value: `R ${Math.round(overview?.monthlySpend ?? 0).toLocaleString()}`,
        subtitle: `${overview?.approvalMetrics.averageHours.toFixed(1) ?? '0.0'}h avg approval`,
        icon: <DollarSign className="w-5 h-5 text-emerald-600" />,
        iconBg: 'bg-emerald-50'
      }
    ];
  }, [overview]);

  return (
    <DashboardLayout title="Requisitions">
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Requisitions</h1>
            <p className="text-sm text-gray-500">Manage ticket-based procurement requests and approvals.</p>
          </div>
          <Link
            to="/requisitions/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Requisition
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {summaryCards.map((card) => (
            <DashboardCard key={card.title} {...card} loading={loading} />
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <ChartWidget
            title="Requisitions by Department"
            subtitle="Current term"
            type="bar"
            data={overview?.byDepartment || []}
            dataKeys={[{ key: 'value', color: '#6366F1', name: 'Requisitions' }]}
            nameKey="name"
          />
          <ChartWidget
            title="Spend by Category"
            subtitle="Approved budget allocation"
            type="pie"
            data={(overview?.spendByCategory || []).map((entry, index) => ({
              ...entry,
              color: ['#6366F1', '#22C55E', '#F59E0B', '#3B82F6', '#EC4899'][index % 5]
            }))}
            nameKey="name"
            valueKey="value"
          />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Requisition Tickets</h2>
              <p className="text-sm text-gray-500">All requisitions with ticket-based workflow states.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  value={filters.search}
                  onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                  placeholder="Search requisitions..."
                  className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <select
                value={filters.status}
                onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                <option value="">All statuses</option>
                {['DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PROCUREMENT', 'ORDERED', 'DELIVERED', 'CLOSED'].map((status) => (
                  <option key={status} value={status}>{status.replace('_', ' ')}</option>
                ))}
              </select>
              <select
                value={filters.priority}
                onChange={(e) => setFilters((prev) => ({ ...prev, priority: e.target.value }))}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                <option value="">Priority</option>
                {['Low', 'Medium', 'High', 'Urgent'].map((priority) => (
                  <option key={priority} value={priority}>{priority}</option>
                ))}
              </select>
              <button
                onClick={handleFilter}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                <Filter className="w-4 h-4" />
                Apply
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-3 pr-4 font-medium">Ticket</th>
                  <th className="py-3 pr-4 font-medium">Department</th>
                  <th className="py-3 pr-4 font-medium">Requested By</th>
                  <th className="py-3 pr-4 font-medium">Priority</th>
                  <th className="py-3 pr-4 font-medium">Status</th>
                  <th className="py-3 pr-4 font-medium">Created</th>
                  <th className="py-3 pr-4 font-medium text-right">Est. Cost</th>
                </tr>
              </thead>
              <tbody>
                {requisitions.map((req) => (
                  <tr key={req.id} className="border-b hover:bg-gray-50">
                    <td className="py-4 pr-4">
                      <Link to={`/requisitions/${req.id}`} className="text-blue-600 font-medium hover:underline">
                        {req.reference || 'REQ'}
                      </Link>
                      <div className="text-xs text-gray-500">{req.title}</div>
                    </td>
                    <td className="py-4 pr-4 text-gray-700">{req.department || 'General'}</td>
                    <td className="py-4 pr-4 text-gray-700">{req.createdBy?.name || req.createdBy?.email || '—'}</td>
                    <td className="py-4 pr-4 text-gray-700">{req.priority || 'Medium'}</td>
                    <td className="py-4 pr-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusStyles[req.status] || 'bg-gray-100 text-gray-600'}`}>
                        {req.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-4 pr-4 text-gray-500">
                      {new Date(req.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-4 pr-2 text-right font-medium text-gray-800">
                      R {(req.estimatedTotal ?? 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!loading && requisitions.length === 0 && (
            <div className="py-10 text-center text-sm text-gray-500">No requisitions found.</div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
