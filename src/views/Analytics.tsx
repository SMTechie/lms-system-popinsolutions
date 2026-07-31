import React, { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import ChartWidget from '../components/ChartWidget';
import PortalLoader from '../components/PortalLoader';
import { Calendar } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { notifyAction } from '../lib/notify';

export default function Analytics() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest('/admin/analytics')
      .then(setAnalytics)
      .catch((error) => notifyAction(error.message || 'Could not load analytics.', 'error'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardLayout title="Analytics">
      {loading ? (
        <PortalLoader label="Loading analytics dashboards..." />
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-950">Analytics overview</h2>
              <p className="mt-1 text-sm text-slate-500">
                Revenue, collections, service delivery, admissions progression, and departmental demand.
              </p>
            </div>

            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span>{analytics?.rangeLabel || 'Operational year to date'}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {(analytics?.kpis || []).map((kpi: any) => (
              <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-all duration-200">
                <p className="text-xs text-gray-500 mb-1">{kpi.label}</p>
                <p className="text-2xl font-bold text-gray-900 font-heading">{kpi.value}</p>
                <p className="text-xs text-emerald-600 font-medium mt-1">{kpi.change}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartWidget
              title="Revenue Trend"
              subtitle="Store sales by recent month"
              type="line"
              data={analytics?.revenueTrend || []}
              nameKey="month"
              dataKeys={[{ key: 'revenue', color: '#3B82F6', name: 'Revenue' }]}
              height={260}
            />
            <ChartWidget
              title="Fees Collection"
              subtitle="Payments distributed across recent periods"
              type="bar"
              data={analytics?.feeTrend || []}
              nameKey="month"
              dataKeys={[{ key: 'fees', color: '#10B981', name: 'Fees' }]}
              height={260}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <ChartWidget
              title="Ticket Distribution"
              subtitle="Operational support categories"
              type="pie"
              data={analytics?.ticketBreakdown || []}
              nameKey="name"
              valueKey="value"
              height={240}
            />

            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Admissions Funnel</h3>
              <div className="space-y-3">
                {(analytics?.admissionsFunnel || []).map((stage: any, i: number, list: any[]) => {
                  const pct = list[0]?.count ? Math.round((stage.count / list[0].count) * 100) : 0;
                  return (
                    <div key={stage.stage} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-24 text-right">{stage.stage}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                        <div
                          className="h-full rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: `hsl(${220 - i * 15}, 80%, ${55 + i * 3}%)` }}
                        >
                          <span className="text-xs font-bold text-white">{stage.count}</span>
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 w-10">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Demand by Department</h3>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {(analytics?.spendByDepartment || []).map((item: any) => (
                <div key={item.name} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-400">{item.name}</p>
                  <p className="mt-2 text-2xl font-bold text-gray-900">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
