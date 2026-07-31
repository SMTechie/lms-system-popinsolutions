import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Box,
  ClipboardCheck,
  Package,
  Plus,
  RefreshCw,
  Search,
  Truck,
  Wrench
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import DashboardCard from '../components/DashboardCard';
import ChartWidget from '../components/ChartWidget';
import { apiRequest } from '../lib/api';
import { notifyAction } from '../lib/notify';
import Modal from '../components/Modal';

const tabs = [
  'Overview',
  'Items',
  'Stock',
  'Movements',
  'Requests',
  'Transfers',
  'Adjustments',
  'Counts',
  'Alerts',
  'Reports',
  'Settings'
] as const;

type InventoryTab = typeof tabs[number];

type InventoryOverview = {
  totalSkus: number;
  totalOnHand: number;
  lowStockCount: number;
  outOfStockCount: number;
  expiringItems: number;
  pendingRequests: number;
  stockValue: number;
  recentMovements: any[];
  locationSummary: { id: string; name: string; stockOnHand: number }[];
};

type InventoryItem = {
  id: string;
  name: string;
  sku: string;
  type: string;
  reorderPoint: number;
  minStock: number;
  isActive: boolean;
  category?: { name: string } | null;
  unit?: { abbreviation: string } | null;
  balances?: { quantityOnHand: number; location?: { name: string } }[];
};

export default function Inventory() {
  const [activeTab, setActiveTab] = useState<InventoryTab>('Overview');
  const [overview, setOverview] = useState<InventoryOverview | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [counts, setCounts] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [itemDetail, setItemDetail] = useState<any | null>(null);
  const [showItemDetail, setShowItemDetail] = useState(false);

  const [showNewItem, setShowNewItem] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showAdjustment, setShowAdjustment] = useState(false);
  const [showCount, setShowCount] = useState(false);

  const [itemForm, setItemForm] = useState({
    name: '',
    sku: '',
    categoryId: '',
    unitId: '',
    type: 'CONSUMABLE',
    tracking: 'NONE',
    reorderPoint: 0,
    minStock: 0
  });

  const [receiveForm, setReceiveForm] = useState({
    locationId: '',
    itemId: '',
    quantity: 1,
    unitCost: 0
  });

  const [requestForm, setRequestForm] = useState({
    locationId: '',
    itemId: '',
    quantity: 1,
    department: ''
  });

  const [transferForm, setTransferForm] = useState({
    fromLocationId: '',
    toLocationId: '',
    itemId: '',
    quantity: 1
  });

  const [adjustmentForm, setAdjustmentForm] = useState({
    locationId: '',
    itemId: '',
    quantityDelta: 1,
    reason: ''
  });

  const [countForm, setCountForm] = useState({
    locationId: '',
    type: 'Full Count'
  });

  const loadOverview = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<InventoryOverview>('/inventory/overview');
      setOverview(data);
      const alertData = await apiRequest<any[]>('/inventory/alerts');
      setAlerts(alertData);
      const lowStockData = await apiRequest<InventoryItem[]>('/inventory/reports/low-stock');
      setLowStockItems(lowStockData);
      const pendingRequests = await apiRequest<any[]>('/inventory/requests?status=PENDING_APPROVAL');
      setRequests(pendingRequests);
    } finally {
      setLoading(false);
    }
  };

  const loadMasterData = async () => {
    const [categoryData, unitData, locationData] = await Promise.all([
      apiRequest<any[]>('/inventory/categories'),
      apiRequest<any[]>('/inventory/units'),
      apiRequest<any[]>('/inventory/locations')
    ]);
    setCategories(categoryData);
    setUnits(unitData);
    setLocations(locationData);
  };

  const loadItems = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<{ items: InventoryItem[] }>('/inventory/items');
      setItems(data.items || []);
    } finally {
      setLoading(false);
    }
  };

  const loadStock = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<any[]>('/inventory/balances');
      setBalances(data);
    } finally {
      setLoading(false);
    }
  };

  const loadMovements = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<any[]>('/inventory/movements');
      setMovements(data);
    } finally {
      setLoading(false);
    }
  };

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<any[]>('/inventory/requests');
      setRequests(data);
    } finally {
      setLoading(false);
    }
  };

  const loadTransfers = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<any[]>('/inventory/transfers');
      setTransfers(data);
    } finally {
      setLoading(false);
    }
  };

  const loadAdjustments = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<any[]>('/inventory/adjustments');
      setAdjustments(data);
    } finally {
      setLoading(false);
    }
  };

  const loadCounts = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<any[]>('/inventory/counts');
      setCounts(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMasterData();
    loadOverview();
    loadItems();
  }, []);

  useEffect(() => {
    if (activeTab === 'Items') loadItems();
    if (activeTab === 'Stock') loadStock();
    if (activeTab === 'Movements') loadMovements();
    if (activeTab === 'Requests') loadRequests();
    if (activeTab === 'Transfers') loadTransfers();
    if (activeTab === 'Adjustments') loadAdjustments();
    if (activeTab === 'Counts') loadCounts();
    if (activeTab === 'Alerts') loadOverview();
    if (activeTab === 'Reports') loadOverview();
  }, [activeTab]);

  const handleCreateItem = async () => {
    await apiRequest('/inventory/items', { method: 'POST', body: JSON.stringify(itemForm) });
    notifyAction('Item created.');
    setShowNewItem(false);
    loadItems();
  };

  const handleReceiveStock = async () => {
    await apiRequest('/inventory/stock/receive', {
      method: 'POST',
      body: JSON.stringify({
        locationId: receiveForm.locationId,
        items: [
          {
            itemId: receiveForm.itemId,
            quantity: Number(receiveForm.quantity),
            unitCost: Number(receiveForm.unitCost)
          }
        ]
      })
    });
    notifyAction('Stock received.');
    setShowReceive(false);
    loadOverview();
  };

  const handleRequest = async () => {
    await apiRequest('/inventory/requests', {
      method: 'POST',
      body: JSON.stringify({
        locationId: requestForm.locationId || undefined,
        department: requestForm.department || undefined,
        lines: [
          {
            itemId: requestForm.itemId,
            quantityRequested: Number(requestForm.quantity)
          }
        ]
      })
    });
    notifyAction('Stock request submitted.');
    setShowRequest(false);
    loadRequests();
  };

  const handleTransfer = async () => {
    await apiRequest('/inventory/transfers', {
      method: 'POST',
      body: JSON.stringify({
        fromLocationId: transferForm.fromLocationId,
        toLocationId: transferForm.toLocationId,
        items: [
          {
            itemId: transferForm.itemId,
            quantity: Number(transferForm.quantity)
          }
        ]
      })
    });
    notifyAction('Transfer created.');
    setShowTransfer(false);
    loadTransfers();
  };

  const handleAdjustment = async () => {
    await apiRequest('/inventory/adjustments', {
      method: 'POST',
      body: JSON.stringify({
        locationId: adjustmentForm.locationId,
        reason: adjustmentForm.reason,
        lines: [
          {
            itemId: adjustmentForm.itemId,
            quantityDelta: Number(adjustmentForm.quantityDelta)
          }
        ]
      })
    });
    notifyAction('Adjustment submitted.');
    setShowAdjustment(false);
    loadAdjustments();
  };

  const handleCount = async () => {
    await apiRequest('/inventory/counts', {
      method: 'POST',
      body: JSON.stringify({
        locationId: countForm.locationId,
        type: countForm.type
      })
    });
    notifyAction('Count session started.');
    setShowCount(false);
    loadCounts();
  };

  const openItemDetail = async (id: string) => {
    const data = await apiRequest<any>(`/inventory/items/${id}`);
    setItemDetail(data);
    setShowItemDetail(true);
  };

  const totalValue = overview?.stockValue ? `R ${overview.stockValue.toLocaleString()}` : '—';
  const stockUsageData = useMemo(() => {
    return (overview?.recentMovements || []).slice(0, 6).map((move: any, idx: number) => ({
      name: `M${idx + 1}`,
      received: move.type === 'RECEIVE' ? Math.abs(move.quantity) : 0,
      issued: move.type === 'ISSUE' ? Math.abs(move.quantity) : 0
    }));
  }, [overview?.recentMovements]);

  return (
    <DashboardLayout title="Inventory">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 font-heading">Inventory Control</h2>
            <p className="text-sm text-gray-500">Track stock, issue requests, and manage school storerooms.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowNewItem(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              New Item
            </button>
            <button
              onClick={() => setShowReceive(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <ArrowDownRight className="w-4 h-4 text-emerald-600" />
              Receive Stock
            </button>
            <button
              onClick={() => setShowTransfer(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <Truck className="w-4 h-4 text-indigo-600" />
              New Transfer
            </button>
            <button
              onClick={() => setShowAdjustment(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <Wrench className="w-4 h-4 text-amber-600" />
              New Adjustment
            </button>
            <button
              onClick={() => setShowCount(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <ClipboardCheck className="w-4 h-4 text-purple-600" />
              Start Count
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-all ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'Overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <DashboardCard
                title="Total SKUs"
                value={overview?.totalSkus ?? '—'}
                icon={<Box className="w-5 h-5 text-blue-600" />}
                iconBg="bg-blue-50"
                loading={loading && !overview}
              />
              <DashboardCard
                title="Stock on Hand"
                value={overview?.totalOnHand ?? '—'}
                icon={<Package className="w-5 h-5 text-emerald-600" />}
                iconBg="bg-emerald-50"
                loading={loading && !overview}
              />
              <DashboardCard
                title="Low Stock Alerts"
                value={overview?.lowStockCount ?? '—'}
                icon={<AlertTriangle className="w-5 h-5 text-amber-600" />}
                iconBg="bg-amber-50"
                loading={loading && !overview}
              />
              <DashboardCard
                title="Stock Valuation"
                value={totalValue}
                icon={<ArrowUpRight className="w-5 h-5 text-indigo-600" />}
                iconBg="bg-indigo-50"
                loading={loading && !overview}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <ChartWidget
                  title="Stock Movements"
                  subtitle="Last 6 movements"
                  type="bar"
                  data={stockUsageData}
                  nameKey="name"
                  dataKeys={[
                    { key: 'received', color: '#22C55E', name: 'Received' },
                    { key: 'issued', color: '#F59E0B', name: 'Issued' }
                  ]}
                />
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900">Open Alerts</h3>
                  <button
                    onClick={() => setActiveTab('Alerts')}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    View all
                  </button>
                </div>
                <div className="space-y-3">
                  {(alerts || []).slice(0, 4).map((alert: any) => (
                    <div key={alert.id} className="flex items-start gap-3 p-3 border border-gray-100 rounded-lg">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{alert.message}</p>
                        <p className="text-xs text-gray-500">{alert.location?.name || 'All locations'}</p>
                      </div>
                    </div>
                  ))}
                  {alerts.length === 0 && (
                    <p className="text-sm text-gray-500">No alerts right now.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Low Stock Items</h3>
                <div className="space-y-3">
                  {(lowStockItems || []).slice(0, 5).map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium text-gray-800">{item.name}</p>
                        <p className="text-xs text-gray-500">{item.category?.name || 'Uncategorised'}</p>
                      </div>
                      <span className="text-xs font-semibold text-amber-600">{item.reorderPoint} min</span>
                    </div>
                  ))}
                  {lowStockItems.length === 0 && <p className="text-sm text-gray-500">No items loaded.</p>}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Requests Awaiting Action</h3>
                <div className="space-y-3">
                  {(requests || []).slice(0, 5).map((req: any) => (
                    <div key={req.id} className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium text-gray-800">{req.reference}</p>
                        <p className="text-xs text-gray-500">{req.department || 'General'}</p>
                      </div>
                      <span className="text-xs font-semibold text-blue-600">{req.status}</span>
                    </div>
                  ))}
                  {requests.length === 0 && <p className="text-sm text-gray-500">No pending requests.</p>}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Stock by Location</h3>
                <div className="space-y-3">
                  {(overview?.locationSummary || []).map((loc) => (
                    <div key={loc.id} className="flex items-center justify-between text-sm">
                      <p className="text-gray-700">{loc.name}</p>
                      <span className="font-semibold text-gray-900">{loc.stockOnHand}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Items' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm"
                  placeholder="Search items..."
                  onChange={async (e) => {
                    const data = await apiRequest<{ items: InventoryItem[] }>(
                      `/inventory/items?search=${encodeURIComponent(e.target.value)}`
                    );
                    setItems(data.items || []);
                  }}
                />
              </div>
              <button
                onClick={loadItems}
                className="inline-flex items-center gap-2 text-sm text-gray-600"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b">
                    <th className="pb-2">Item</th>
                    <th className="pb-2">SKU</th>
                    <th className="pb-2">Category</th>
                    <th className="pb-2">Type</th>
                    <th className="pb-2">On Hand</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => openItemDetail(item.id)}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="py-2 font-medium text-gray-800">{item.name}</td>
                      <td className="py-2 text-gray-500">{item.sku}</td>
                      <td className="py-2 text-gray-500">{item.category?.name || '—'}</td>
                      <td className="py-2 text-gray-500">{item.type}</td>
                      <td className="py-2 text-gray-700">
                        {item.balances?.reduce((sum, b) => sum + b.quantityOnHand, 0) ?? 0}
                      </td>
                      <td className="py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${item.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                          {item.isActive ? 'Active' : 'Archived'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'Stock' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Stock by Location</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b">
                    <th className="pb-2">Item</th>
                    <th className="pb-2">Location</th>
                    <th className="pb-2">On Hand</th>
                    <th className="pb-2">Reserved</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {balances.map((balance: any) => (
                    <tr key={balance.id} className="hover:bg-gray-50">
                      <td className="py-2 text-gray-800">{balance.item?.name}</td>
                      <td className="py-2 text-gray-500">{balance.location?.name}</td>
                      <td className="py-2 text-gray-700">{balance.quantityOnHand}</td>
                      <td className="py-2 text-gray-500">{balance.quantityReserved}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'Movements' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Movement Ledger</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b">
                    <th className="pb-2">Item</th>
                    <th className="pb-2">Type</th>
                    <th className="pb-2">From</th>
                    <th className="pb-2">To</th>
                    <th className="pb-2">Qty</th>
                    <th className="pb-2">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {movements.map((move: any) => (
                    <tr key={move.id} className="hover:bg-gray-50">
                      <td className="py-2 text-gray-800">{move.item?.name}</td>
                      <td className="py-2 text-gray-500">{move.type}</td>
                      <td className="py-2 text-gray-500">{move.locationFrom?.name || '—'}</td>
                      <td className="py-2 text-gray-500">{move.locationTo?.name || '—'}</td>
                      <td className="py-2 text-gray-700">{move.quantity}</td>
                      <td className="py-2 text-gray-500">{new Date(move.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'Requests' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Stock Requests</h3>
              <button
                onClick={() => setShowRequest(true)}
                className="inline-flex items-center gap-2 text-sm text-blue-600"
              >
                <Plus className="w-4 h-4" />
                New Request
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b">
                    <th className="pb-2">Reference</th>
                    <th className="pb-2">Department</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {requests.map((req: any) => (
                    <tr key={req.id} className="hover:bg-gray-50">
                      <td className="py-2 text-gray-800">{req.reference}</td>
                      <td className="py-2 text-gray-500">{req.department || 'General'}</td>
                      <td className="py-2 text-gray-500">{req.status}</td>
                      <td className="py-2 text-gray-500">{new Date(req.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'Transfers' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Transfers</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b">
                    <th className="pb-2">Reference</th>
                    <th className="pb-2">From</th>
                    <th className="pb-2">To</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {transfers.map((transfer: any) => (
                    <tr key={transfer.id} className="hover:bg-gray-50">
                      <td className="py-2 text-gray-800">{transfer.reference}</td>
                      <td className="py-2 text-gray-500">{transfer.fromLocation?.name}</td>
                      <td className="py-2 text-gray-500">{transfer.toLocation?.name}</td>
                      <td className="py-2 text-gray-500">{transfer.status}</td>
                      <td className="py-2 text-gray-500">{new Date(transfer.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'Adjustments' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Adjustments</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b">
                    <th className="pb-2">Reference</th>
                    <th className="pb-2">Location</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {adjustments.map((adj: any) => (
                    <tr key={adj.id} className="hover:bg-gray-50">
                      <td className="py-2 text-gray-800">{adj.reference}</td>
                      <td className="py-2 text-gray-500">{adj.location?.name}</td>
                      <td className="py-2 text-gray-500">{adj.status}</td>
                      <td className="py-2 text-gray-500">{adj.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'Counts' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Stock Counts</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b">
                    <th className="pb-2">Reference</th>
                    <th className="pb-2">Location</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {counts.map((count: any) => (
                    <tr key={count.id} className="hover:bg-gray-50">
                      <td className="py-2 text-gray-800">{count.reference}</td>
                      <td className="py-2 text-gray-500">{count.location?.name}</td>
                      <td className="py-2 text-gray-500">{count.status}</td>
                      <td className="py-2 text-gray-500">{count.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'Alerts' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Alert Center</h3>
            <div className="space-y-3">
              {alerts.map((alert: any) => (
                <div key={alert.id} className="flex items-center justify-between border border-gray-100 rounded-lg p-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{alert.message}</p>
                    <p className="text-xs text-gray-500">{alert.location?.name || 'All locations'}</p>
                  </div>
                  <span className="text-xs font-semibold text-amber-600">{alert.type}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'Reports' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartWidget
              title="Stock Value by Location"
              subtitle="Current valuation"
              type="bar"
              data={(overview?.locationSummary || []).map((loc) => ({
                name: loc.name,
                value: loc.stockOnHand
              }))}
              dataKeys={[{ key: 'value', color: '#6366F1', name: 'Units' }]}
              nameKey="name"
            />
            <ChartWidget
              title="Low Stock Snapshot"
              subtitle="Threshold risk"
              type="pie"
              data={[
                { name: 'Low Stock', value: overview?.lowStockCount || 0, color: '#F59E0B' },
                { name: 'OK', value: (overview?.totalSkus || 0) - (overview?.lowStockCount || 0), color: '#22C55E' }
              ]}
              nameKey="name"
              valueKey="value"
            />
          </div>
        )}

        {activeTab === 'Settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Categories</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                {categories.map((cat) => (
                  <li key={cat.id}>{cat.name}</li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Units of Measure</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                {units.map((unit) => (
                  <li key={unit.id}>{unit.name} ({unit.abbreviation})</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      <Modal title="New Inventory Item" isOpen={showNewItem} onClose={() => setShowNewItem(false)}>
        <div className="space-y-4">
          <input
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            placeholder="Item name"
            value={itemForm.name}
            onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
          />
          <input
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            placeholder="SKU"
            value={itemForm.sku}
            onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value })}
          />
          <select
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={itemForm.categoryId}
            onChange={(e) => setItemForm({ ...itemForm, categoryId: e.target.value })}
          >
            <option value="">Select category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          <select
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={itemForm.unitId}
            onChange={(e) => setItemForm({ ...itemForm, unitId: e.target.value })}
          >
            <option value="">Select unit</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>{unit.name}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              placeholder="Reorder point"
              value={itemForm.reorderPoint}
              onChange={(e) => setItemForm({ ...itemForm, reorderPoint: Number(e.target.value) })}
            />
            <input
              type="number"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              placeholder="Min stock"
              value={itemForm.minStock}
              onChange={(e) => setItemForm({ ...itemForm, minStock: Number(e.target.value) })}
            />
          </div>
          <button
            onClick={handleCreateItem}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold"
          >
            Save Item
          </button>
        </div>
      </Modal>

      <Modal title="Item Details" isOpen={showItemDetail} onClose={() => setShowItemDetail(false)}>
        {itemDetail ? (
          <div className="space-y-4 text-sm text-gray-600">
            <div>
              <p className="text-xs uppercase text-gray-400">Item</p>
              <p className="text-base font-semibold text-gray-900">{itemDetail.name}</p>
              <p className="text-xs text-gray-500">{itemDetail.sku}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs uppercase text-gray-400">Category</p>
                <p className="text-sm text-gray-700">{itemDetail.category?.name || '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-400">Type</p>
                <p className="text-sm text-gray-700">{itemDetail.type}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-400">Tracking</p>
                <p className="text-sm text-gray-700">{itemDetail.tracking}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-400">Reorder Point</p>
                <p className="text-sm text-gray-700">{itemDetail.reorderPoint}</p>
              </div>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-400">Stock by Location</p>
              <div className="space-y-2 mt-2">
                {(itemDetail.balances || []).map((bal: any) => (
                  <div key={bal.id} className="flex items-center justify-between text-sm">
                    <span>{bal.location?.name}</span>
                    <span className="font-semibold text-gray-900">{bal.quantityOnHand}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Loading...</p>
        )}
      </Modal>

      <Modal title="Receive Stock" isOpen={showReceive} onClose={() => setShowReceive(false)}>
        <div className="space-y-4">
          <select
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={receiveForm.locationId}
            onChange={(e) => setReceiveForm({ ...receiveForm, locationId: e.target.value })}
          >
            <option value="">Select location</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
          <select
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={receiveForm.itemId}
            onChange={(e) => setReceiveForm({ ...receiveForm, itemId: e.target.value })}
          >
            <option value="">Select item</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              placeholder="Quantity"
              value={receiveForm.quantity}
              onChange={(e) => setReceiveForm({ ...receiveForm, quantity: Number(e.target.value) })}
            />
            <input
              type="number"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              placeholder="Unit cost"
              value={receiveForm.unitCost}
              onChange={(e) => setReceiveForm({ ...receiveForm, unitCost: Number(e.target.value) })}
            />
          </div>
          <button
            onClick={handleReceiveStock}
            className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold"
          >
            Receive
          </button>
        </div>
      </Modal>

      <Modal title="New Stock Request" isOpen={showRequest} onClose={() => setShowRequest(false)}>
        <div className="space-y-4">
          <select
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={requestForm.locationId}
            onChange={(e) => setRequestForm({ ...requestForm, locationId: e.target.value })}
          >
            <option value="">Select location</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
          <select
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={requestForm.itemId}
            onChange={(e) => setRequestForm({ ...requestForm, itemId: e.target.value })}
          >
            <option value="">Select item</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          <input
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            placeholder="Department"
            value={requestForm.department}
            onChange={(e) => setRequestForm({ ...requestForm, department: e.target.value })}
          />
          <input
            type="number"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            placeholder="Quantity"
            value={requestForm.quantity}
            onChange={(e) => setRequestForm({ ...requestForm, quantity: Number(e.target.value) })}
          />
          <button
            onClick={handleRequest}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold"
          >
            Submit Request
          </button>
        </div>
      </Modal>

      <Modal title="Create Transfer" isOpen={showTransfer} onClose={() => setShowTransfer(false)}>
        <div className="space-y-4">
          <select
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={transferForm.fromLocationId}
            onChange={(e) => setTransferForm({ ...transferForm, fromLocationId: e.target.value })}
          >
            <option value="">From location</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
          <select
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={transferForm.toLocationId}
            onChange={(e) => setTransferForm({ ...transferForm, toLocationId: e.target.value })}
          >
            <option value="">To location</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
          <select
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={transferForm.itemId}
            onChange={(e) => setTransferForm({ ...transferForm, itemId: e.target.value })}
          >
            <option value="">Select item</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          <input
            type="number"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            placeholder="Quantity"
            value={transferForm.quantity}
            onChange={(e) => setTransferForm({ ...transferForm, quantity: Number(e.target.value) })}
          />
          <button
            onClick={handleTransfer}
            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold"
          >
            Create Transfer
          </button>
        </div>
      </Modal>

      <Modal title="New Adjustment" isOpen={showAdjustment} onClose={() => setShowAdjustment(false)}>
        <div className="space-y-4">
          <select
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={adjustmentForm.locationId}
            onChange={(e) => setAdjustmentForm({ ...adjustmentForm, locationId: e.target.value })}
          >
            <option value="">Select location</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
          <select
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={adjustmentForm.itemId}
            onChange={(e) => setAdjustmentForm({ ...adjustmentForm, itemId: e.target.value })}
          >
            <option value="">Select item</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          <input
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            placeholder="Reason"
            value={adjustmentForm.reason}
            onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })}
          />
          <input
            type="number"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            placeholder="Quantity change"
            value={adjustmentForm.quantityDelta}
            onChange={(e) => setAdjustmentForm({ ...adjustmentForm, quantityDelta: Number(e.target.value) })}
          />
          <button
            onClick={handleAdjustment}
            className="w-full px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold"
          >
            Submit Adjustment
          </button>
        </div>
      </Modal>

      <Modal title="Start Stock Count" isOpen={showCount} onClose={() => setShowCount(false)}>
        <div className="space-y-4">
          <select
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={countForm.locationId}
            onChange={(e) => setCountForm({ ...countForm, locationId: e.target.value })}
          >
            <option value="">Select location</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
          <select
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={countForm.type}
            onChange={(e) => setCountForm({ ...countForm, type: e.target.value })}
          >
            <option value="Full Count">Full Count</option>
            <option value="Cycle Count">Cycle Count</option>
          </select>
          <button
            onClick={handleCount}
            className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold"
          >
            Start Session
          </button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}

