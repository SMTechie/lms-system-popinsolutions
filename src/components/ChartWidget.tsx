import React from 'react';
import { motion } from 'framer-motion';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

type ChartType = 'line' | 'bar' | 'pie';

interface ChartWidgetProps {
  title: string;
  subtitle?: string;
  type: ChartType;
  data: Record<string, unknown>[];
  dataKeys?: { key: string; color: string; name?: string }[];
  nameKey?: string;
  valueKey?: string;
  height?: number;
}

export default function ChartWidget({
  title,
  subtitle,
  type,
  data,
  dataKeys = [],
  nameKey = 'name',
  valueKey = 'value',
  height = 220,
}: ChartWidgetProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-all duration-200"
    >
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>

      <ResponsiveContainer width="100%" height={height}>
        {type === 'line' ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis dataKey={nameKey} tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '12px' }} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            {dataKeys.map(dk => (
              <Line key={dk.key} type="monotone" dataKey={dk.key} stroke={dk.color} strokeWidth={2} dot={false} name={dk.name || dk.key} />
            ))}
          </LineChart>
        ) : type === 'bar' ? (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis dataKey={nameKey} tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '12px' }} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            {dataKeys.map(dk => (
              <Bar key={dk.key} dataKey={dk.key} fill={dk.color} radius={[4, 4, 0, 0]} name={dk.name || dk.key} />
            ))}
          </BarChart>
        ) : (
          <PieChart>
            <Pie data={data} dataKey={valueKey} nameKey={nameKey} cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={(entry as Record<string, unknown>).color as string || dataKeys[index]?.color || '#3B82F6'} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '12px' }} />
          </PieChart>
        )}
      </ResponsiveContainer>
    </motion.div>
  );
}