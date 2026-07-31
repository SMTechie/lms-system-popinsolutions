import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MoreHorizontal, TrendingUp, TrendingDown } from 'lucide-react';
import { notifyAction } from '../lib/notify';

interface DashboardCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: { value: number; label: string };
  icon: React.ReactNode;
  iconBg: string;
  loading?: boolean;
  children?: React.ReactNode;
}

export default function DashboardCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  iconBg,
  loading = false,
  children,
}: DashboardCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 bg-gray-200 rounded-lg" />
          <div className="w-6 h-6 bg-gray-200 rounded" />
        </div>
        <div className="h-8 bg-gray-200 rounded w-24 mb-2" />
        <div className="h-4 bg-gray-100 rounded w-32" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 relative"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors text-gray-400"
            aria-label="Card options"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
              {['View Details', 'Export', 'Refresh'].map(opt => (
                <button
                  key={opt}
                  onClick={() => {
                    notifyAction(`${opt} queued.`);
                    setMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mb-1">
        <span className="text-2xl font-bold text-gray-900 font-heading">{value}</span>
      </div>
      <p className="text-sm text-gray-500 mb-2">{title}</p>

      {trend && (
        <div className={`flex items-center gap-1 text-xs font-medium ${trend.value >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {trend.value >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          <span>{Math.abs(trend.value)}% {trend.label}</span>
        </div>
      )}

      {subtitle && !trend && <p className="text-xs text-gray-400">{subtitle}</p>}

      {children && <div className="mt-4 pt-4 border-t border-gray-100">{children}</div>}
    </motion.div>
  );
}
