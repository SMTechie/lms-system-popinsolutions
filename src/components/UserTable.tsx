import React, { useState } from 'react';
import { Search, UserPlus, MoreHorizontal } from 'lucide-react';
import { mockUsers } from '../data/mockData';
import { notifyAction } from '../lib/notify';

export default function UserTable() {
  const [search, setSearch] = useState('');

  const filtered = mockUsers.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  );

  const avatarColors: Record<string, string> = {
    SK: 'bg-blue-500', JM: 'bg-purple-500', LP: 'bg-emerald-500',
    MT: 'bg-amber-500', ND: 'bg-rose-500', PV: 'bg-cyan-500',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            placeholder="Search users..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all duration-200"
          />
        </div>
        <button
          onClick={() => notifyAction("Invite flow coming soon.")}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 hover:scale-105"
        >
          <UserPlus className="w-4 h-4" />
          Invite User
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['User', 'Role', 'Status', 'Last Login', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map(user => (
              <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${avatarColors[user.avatar] || 'bg-gray-400'}`}>
                      <span className="text-xs font-bold text-white">{user.avatar}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{user.name}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-600">{user.role}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${
                    user.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'active' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                    {user.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-500">{user.lastLogin}</span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => notifyAction(`Actions for ${user.name}`)}
                    className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors text-gray-400"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
        <span className="text-xs text-gray-500">{filtered.length} of {mockUsers.length} users</span>
        <div className="flex items-center gap-1">
          {[1, 2, 3].map(p => (
            <button
              key={p}
              onClick={() => notifyAction(`Page ${p}`)}
              className={`w-7 h-7 text-xs rounded-md transition-colors ${p === 1 ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
