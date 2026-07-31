import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Ticket } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import FilterBar from '../components/FilterBar';
import Modal from '../components/Modal';
import { apiRequest } from '../lib/api';
import { notifyAction } from '../lib/notify';

type OpsTicket = {
  id: string;
  title: string;
  category: string;
  priority: string;
  assignee: string;
  status: string;
  created: string;
};

const priorityColors: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-emerald-100 text-emerald-700',
};

const statusColors: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  'in-progress': 'bg-amber-100 text-amber-700',
  resolved: 'bg-emerald-100 text-emerald-700',
};

export default function Tickets() {
  const [search, setSearch] = useState('');
  const [tickets, setTickets] = useState<OpsTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ title: '', category: 'General', priority: 'medium', assignee: '' });

  const loadTickets = async (value = '') => {
    setLoading(true);
    try {
      const data = await apiRequest<OpsTicket[]>(`/tickets?search=${encodeURIComponent(value)}`);
      setTickets(data);
    } catch (error: any) {
      notifyAction(error.message || 'Could not load tickets', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTickets();
  }, []);

  const stats = useMemo(() => {
    const open = tickets.filter((ticket) => ticket.status === 'open').length;
    const inProgress = tickets.filter((ticket) => ticket.status === 'in-progress').length;
    const resolved = tickets.filter((ticket) => ticket.status === 'resolved').length;
    return [
      { label: 'Open', count: open, color: 'text-blue-600 bg-blue-50' },
      { label: 'In Progress', count: inProgress, color: 'text-amber-600 bg-amber-50' },
      { label: 'Resolved', count: resolved, color: 'text-emerald-600 bg-emerald-50' },
      { label: 'Total', count: tickets.length, color: 'text-gray-600 bg-gray-50' },
    ];
  }, [tickets]);

  const filtered = tickets.filter((ticket) =>
    ticket.title.toLowerCase().includes(search.toLowerCase()) ||
    ticket.category.toLowerCase().includes(search.toLowerCase())
  );

  const createTicket = async () => {
    try {
      await apiRequest('/tickets', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      notifyAction('Ticket created', 'success');
      setShowNew(false);
      setForm({ title: '', category: 'General', priority: 'medium', assignee: '' });
      await loadTickets(search);
    } catch (error: any) {
      notifyAction(error.message || 'Could not create ticket', 'error');
    }
  };

  return (
    <DashboardLayout title="Tickets">
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.color}`}>
                <Ticket className="h-5 w-5" />
              </div>
              <div>
                <div className="font-heading text-xl font-bold text-gray-900">{stat.count}</div>
                <div className="text-xs text-gray-500">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                placeholder="Search tickets..."
                value={search}
                onChange={async (e) => {
                  const value = e.target.value;
                  setSearch(value);
                  await loadTickets(value);
                }}
                className="w-52 rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm transition-all duration-200 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <FilterBar
              filters={[
                { label: 'Category', options: ['IT', 'Maintenance', 'HR', 'Finance', 'Supplies', 'General'] },
                { label: 'Priority', options: ['High', 'Medium', 'Low'] },
                { label: 'Status', options: ['Open', 'In Progress', 'Resolved'] },
              ]}
            />
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:scale-105 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            New Ticket
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['ID', 'Title', 'Category', 'Priority', 'Assignee', 'Status', 'Created'].map((heading) => (
                  <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((ticket, index) => (
                <motion.tr
                  key={ticket.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.04 }}
                  className="cursor-pointer transition-colors hover:bg-gray-50"
                  onClick={() => notifyAction(`Opened ${ticket.id}`, 'success')}
                >
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{ticket.id}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-sm font-medium text-gray-800">{ticket.title}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{ticket.category}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityColors[ticket.priority] || priorityColors.medium}`}>{ticket.priority}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{ticket.assignee}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[ticket.status] || statusColors.open}`}>{ticket.status}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">{ticket.created}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {!loading && filtered.length === 0 && (
            <div className="p-10 text-center text-sm text-gray-500">No tickets found.</div>
          )}
        </div>
      </div>

      <Modal title="Create Ticket" isOpen={showNew} onClose={() => setShowNew(false)}>
        <div className="space-y-4">
          <input
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            placeholder="Ticket title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <input
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            placeholder="Category"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
          <select
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <input
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            placeholder="Assignee"
            value={form.assignee}
            onChange={(e) => setForm({ ...form, assignee: e.target.value })}
          />
          <button
            onClick={() => void createTicket()}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Save Ticket
          </button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
