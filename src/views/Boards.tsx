import React, { useEffect, useMemo, useState } from 'react';
import { LayoutGrid, Plus, Search } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import Modal from '../components/Modal';
import PortalLoader from '../components/PortalLoader';
import { apiRequest } from '../lib/api';
import { notifyAction } from '../lib/notify';

export default function Boards() {
  const [boards, setBoards] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const items = await apiRequest<any[]>('/boards');
      const list = Array.isArray(items) ? items : [];
      setBoards(list);
      setSelectedId((current) => current || list[0]?.id || '');
    } catch (error: any) {
      notifyAction(error.message || 'Could not load boards.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const selectedBoard = boards.find((board) => board.id === selectedId) || boards[0];
  const filteredColumns = useMemo(() => {
    if (!selectedBoard) return [];
    const term = search.trim().toLowerCase();
    if (!term) return selectedBoard.columns || [];
    return (selectedBoard.columns || [])
      .map((column: any) => ({
        ...column,
        cards: (column.cards || []).filter((card: any) =>
          `${card.title} ${card.assignee} ${(card.tags || []).join(' ')}`
            .toLowerCase()
            .includes(term),
        ),
      }))
      .filter((column: any) => column.cards.length > 0);
  }, [search, selectedBoard]);

  const createBoard = async () => {
    if (!newBoardName.trim()) {
      notifyAction('Enter a board name first.', 'warning');
      return;
    }
    try {
      const board = await apiRequest<any>('/boards', {
        method: 'POST',
        body: JSON.stringify({ name: newBoardName }),
      });
      setShowCreate(false);
      setNewBoardName('');
      setSelectedId(board.id);
      await load();
      notifyAction('Board created.', 'success');
    } catch (error: any) {
      notifyAction(error.message || 'Could not create board.', 'error');
    }
  };

  return (
    <DashboardLayout title="Boards">
      <div className="space-y-6">
        <div className="rounded-3xl bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_55%,#22c55e_100%)] p-6 text-white shadow-xl shadow-blue-900/15">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">Workflow boards</p>
              <h2 className="mt-1 text-3xl font-bold">Operational board workspace</h2>
              <p className="mt-2 max-w-2xl text-sm text-blue-100">
                Use visual lanes to track procurement, family follow-up, and school operations from one place.
              </p>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900"
            >
              <Plus className="mr-2 inline h-4 w-4" />
              New board
            </button>
          </div>
        </div>

        {loading ? (
          <PortalLoader label="Loading workflow boards..." />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3 overflow-x-auto pb-1">
                {boards.map((board) => (
                  <button
                    key={board.id}
                    onClick={() => setSelectedId(board.id)}
                    className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                      selectedBoard?.id === board.id
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                        : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: selectedBoard?.id === board.id ? 'white' : board.color }}
                    />
                    {board.name}
                    <span className={`rounded-full px-2 py-0.5 text-xs ${selectedBoard?.id === board.id ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      {board.cards}
                    </span>
                  </button>
                ))}
              </div>

              <label className="relative min-w-[260px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search cards, assignees, or tags"
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                />
              </label>
            </div>

            {selectedBoard && (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Total cards" value={selectedBoard.cards} />
                <MetricCard label="Board members" value={selectedBoard.members} />
                <MetricCard
                  label="Active columns"
                  value={(selectedBoard.columns || []).filter((column: any) => (column.cards || []).length > 0).length}
                />
                <MetricCard
                  label="Connected insight"
                  value={
                    selectedBoard.linkedMetrics?.pendingApprovals ??
                    selectedBoard.linkedMetrics?.awaitingAcknowledgement ??
                    0
                  }
                />
              </div>
            )}

            <div className="overflow-x-auto pb-2">
              <div className="flex min-w-max gap-4">
                {filteredColumns.map((column: any) => (
                  <section key={column.id} className="w-80 rounded-3xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: column.color }} />
                        <h3 className="text-sm font-bold text-slate-900">{column.title}</h3>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">
                        {(column.cards || []).length}
                      </span>
                    </div>

                    <div className="space-y-3 p-4">
                      {(column.cards || []).map((card: any) => (
                        <article key={card.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex flex-wrap gap-1">
                            {(card.tags || []).map((tag: string) => (
                              <span key={tag} className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                                {tag}
                              </span>
                            ))}
                          </div>
                          <h4 className="mt-3 text-sm font-semibold text-slate-950">{card.title}</h4>
                          <p className="mt-2 text-xs leading-5 text-slate-500">{card.description}</p>
                          <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-500">
                            <div>
                              <p className="uppercase tracking-wide text-slate-400">Assignee</p>
                              <p className="mt-1 font-semibold text-slate-700">{card.assignee}</p>
                            </div>
                            <div>
                              <p className="uppercase tracking-wide text-slate-400">Due</p>
                              <p className="mt-1 font-semibold text-slate-700">{card.dueDate}</p>
                            </div>
                          </div>
                          <div className="mt-4 flex items-center justify-between">
                            <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${
                              card.priority === 'high'
                                ? 'bg-red-100 text-red-700'
                                : card.priority === 'medium'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {String(card.priority).toUpperCase()}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {card.comments} comment(s) • {card.attachments} attachment(s)
                            </span>
                          </div>
                        </article>
                      ))}
                      {(!column.cards || column.cards.length === 0) && (
                        <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
                          No cards in this lane.
                        </div>
                      )}
                    </div>
                  </section>
                ))}

                {filteredColumns.length === 0 && (
                  <div className="flex w-full min-w-[320px] items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
                    No workflow cards matched your search.
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <Modal title="Create board" isOpen={showCreate} onClose={() => setShowCreate(false)}>
        <div className="space-y-4">
          <label className="block text-xs font-semibold text-slate-600">
            <span className="mb-1.5 block">Board name</span>
            <input
              value={newBoardName}
              onChange={(event) => setNewBoardName(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
              placeholder="Example: Hostel Operations"
            />
          </label>
          <button onClick={() => void createBoard()} className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white">
            Create board
          </button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <LayoutGrid className="h-4 w-4 text-blue-600" />
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
    </div>
  );
}
