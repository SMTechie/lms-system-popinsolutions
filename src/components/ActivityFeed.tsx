import React from 'react';
import { motion } from 'framer-motion';

const avatarColors: Record<string, string> = {
  SK: 'bg-blue-500',
  JM: 'bg-purple-500',
  LP: 'bg-emerald-500',
  MT: 'bg-amber-500',
  ND: 'bg-rose-500',
  AD: 'bg-gray-500',
};

interface ActivityItem {
  id: string;
  user: string;
  action: string;
  target: string;
  time: string;
  avatar: string;
}

export default function ActivityFeed({ items }: { items: ActivityItem[] }) {
  const recentItems = items.slice(0, 5);
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Recent Activity</h3>
      <ul className="space-y-4">
        {recentItems.map((item, i) => (
          <motion.li
            key={item.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-start gap-3"
          >
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${avatarColors[item.avatar] || 'bg-gray-400'}`}>
              <span className="text-xs font-bold text-white">{item.avatar}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-700">
                <span className="font-semibold">{item.user}</span>{' '}
                <span className="text-gray-500">{item.action}</span>{' '}
                <span className="font-medium text-blue-600">{item.target}</span>
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{item.time}</p>
            </div>
          </motion.li>
        ))}
      </ul>
      {items.length === 0 && <p className="text-sm text-gray-500">No recent operational activity yet.</p>}
    </div>
  );
}
