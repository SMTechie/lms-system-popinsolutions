import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ClipboardCheck, FilePlus, Truck } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import Modal from '../components/Modal';
import { apiRequest } from '../lib/api';
import { notifyAction } from '../lib/notify';

interface RequisitionItem {
  id: string;
  itemName: string;
  category?: string | null;
  quantity: number;
  estimatedUnitCost?: number | null;
  totalCost?: number | null;
  itemType: string;
  inventoryItemId?: string | null;
}

interface RequisitionDetail {
  id: string;
  budgetCode?: string | null;
  requiredDate?: string | null;
  deliveryLocation?: string | null;
  vendorPreference?: string | null;
  procurementStatus?: string | null;
  approvalLevel?: number | null;
  estimatedTotalCost?: number | null;
}

interface RequisitionApproval {
  id: string;
  approvalRole: string;
  decision: string;
  comments?: string | null;
  decidedAt?: string | null;
  approver?: { name?: string | null; email: string } | null;
}

interface PurchaseOrder {
  id: string;
  reference: string;
  vendor?: string | null;
  status: string;
  orderDate: string;
  expectedDeliveryDate?: string | null;
  items: { id: string; name: string; quantity: number }[];
}

interface RequisitionTicket {
  id: string;
  reference?: string | null;
  title: string;
  description?: string | null;
  department?: string | null;
  priority?: string | null;
  status: string;
  createdAt: string;
  createdBy?: { name?: string | null; email: string } | null;
  requisition?: RequisitionDetail | null;
  items: RequisitionItem[];
  approvals: RequisitionApproval[];
  purchaseOrders: PurchaseOrder[];
}

interface InventoryLocation {
  id: string;
  name: string;
}

const statusStyle: Record<string, string> = {
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

export default function RequisitionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<RequisitionTicket | null>(null);
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [loading, setLoading] = useState(true);

  const [showApproval, setShowApproval] = useState(false);
  const [approvalDecision, setApprovalDecision] = useState<'approve' | 'reject'>('approve');
  const [approvalRole, setApprovalRole] = useState('Department Head');
  const [approvalComments, setApprovalComments] = useState('');

  const [showPO, setShowPO] = useState(false);
  const [poVendor, setPoVendor] = useState('');
  const [poExpectedDate, setPoExpectedDate] = useState('');

  const [showDelivery, setShowDelivery] = useState(false);
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [deliveryQuantities, setDeliveryQuantities] = useState<Record<string, number>>({});

  const loadData = async () => {
    if (!id) return;
    const data = await apiRequest<RequisitionTicket>(`/tickets/requisitions/${id}`);
    setTicket(data);
    setPoVendor(data.requisition?.vendorPreference || '');
    const locs = await apiRequest<InventoryLocation[]>('/inventory/locations');
    setLocations(locs);
    if (locs.length && !deliveryLocation) {
      setDeliveryLocation(locs[0].id);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadData()
      .catch((err) => notifyAction(err.message || 'Failed to load requisition', 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  const estimatedTotal = useMemo(() => {
    if (!ticket) return 0;
    return ticket.items.reduce(
      (sum, item) => sum + (item.totalCost ?? item.estimatedUnitCost ?? 0) * item.quantity,
      0
    );
  }, [ticket]);

  const submitApproval = async () => {
    if (!id) return;
    try {
      if (approvalDecision === 'approve') {
        await apiRequest(`/tickets/${id}/approve`, {
          method: 'POST',
          body: JSON.stringify({ approvalRole, comments: approvalComments })
        });
        notifyAction('Requisition approved', 'success');
      } else {
        await apiRequest(`/tickets/${id}/reject`, {
          method: 'POST',
          body: JSON.stringify({ approvalRole, comments: approvalComments })
        });
        notifyAction('Requisition rejected', 'warning');
      }
      setShowApproval(false);
      await loadData();
    } catch (err: any) {
      notifyAction(err.message || 'Approval failed', 'error');
    }
  };

  const submitPurchaseOrder = async () => {
    if (!id) return;
    try {
      await apiRequest(`/requisitions/${id}/purchase-order`, {
        method: 'POST',
        body: JSON.stringify({ vendor: poVendor, expectedDeliveryDate: poExpectedDate || null })
      });
      notifyAction('Purchase order created', 'success');
      setShowPO(false);
      await loadData();
    } catch (err: any) {
      notifyAction(err.message || 'Failed to create PO', 'error');
    }
  };

  const submitDelivery = async () => {
    if (!id) return;
    try {
      const items = Object.entries(deliveryQuantities).map(([requisitionItemId, quantity]) => ({
        requisitionItemId,
        quantity
      }));
      await apiRequest(`/requisitions/${id}/deliver`, {
        method: 'POST',
        body: JSON.stringify({ locationId: deliveryLocation, items: items.length ? items : undefined })
      });
      notifyAction('Delivery confirmed', 'success');
      setShowDelivery(false);
      await loadData();
    } catch (err: any) {
      notifyAction(err.message || 'Delivery failed', 'error');
    }
  };

  if (loading || !ticket) {
    return (
      <DashboardLayout title="Requisition Detail">
        <div className="text-sm text-gray-500">Loading requisition...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={`Requisition ${ticket.reference || ''}`}>
      <div className="space-y-6">
        <button
          onClick={() => navigate('/requisitions')}
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Requisitions
        </button>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold text-gray-900">{ticket.reference}</h1>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusStyle[ticket.status]}`}>
                  {ticket.status.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">{ticket.title}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => { setApprovalDecision('approve'); setShowApproval(true); }}
                className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm"
              >
                <CheckCircle2 className="w-4 h-4" /> Approve
              </button>
              <button
                onClick={() => { setApprovalDecision('reject'); setShowApproval(true); }}
                className="inline-flex items-center gap-2 px-3 py-2 border border-rose-200 text-rose-600 rounded-lg text-sm"
              >
                Reject
              </button>
              <button
                onClick={() => setShowPO(true)}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                <FilePlus className="w-4 h-4" /> Create PO
              </button>
              <button
                onClick={() => setShowDelivery(true)}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                <Truck className="w-4 h-4" /> Mark Delivered
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500">Department</p>
              <p className="text-sm font-medium text-gray-900">{ticket.department || 'General'}</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500">Requested By</p>
              <p className="text-sm font-medium text-gray-900">{ticket.createdBy?.name || ticket.createdBy?.email}</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500">Estimated Total</p>
              <p className="text-sm font-semibold text-gray-900">R {(ticket.requisition?.estimatedTotalCost ?? estimatedTotal).toLocaleString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500">Budget Code</p>
              <p className="text-sm text-gray-900">{ticket.requisition?.budgetCode || '—'}</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500">Required Date</p>
              <p className="text-sm text-gray-900">
                {ticket.requisition?.requiredDate ? new Date(ticket.requisition.requiredDate).toLocaleDateString() : '—'}
              </p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500">Delivery Location</p>
              <p className="text-sm text-gray-900">{ticket.requisition?.deliveryLocation || '—'}</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500">Vendor Preference</p>
              <p className="text-sm text-gray-900">{ticket.requisition?.vendorPreference || '—'}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Line Items</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2">Item</th>
                  <th className="py-2">Type</th>
                  <th className="py-2">Qty</th>
                  <th className="py-2">Unit Cost</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {ticket.items.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="py-3">
                      <p className="text-gray-900 font-medium">{item.itemName}</p>
                      <p className="text-xs text-gray-500">{item.category || 'General'}</p>
                    </td>
                    <td className="py-3 text-gray-700">{item.itemType.replace(/_/g, ' ')}</td>
                    <td className="py-3 text-gray-700">{item.quantity}</td>
                    <td className="py-3 text-gray-700">R {(item.estimatedUnitCost ?? 0).toLocaleString()}</td>
                    <td className="py-3 text-right text-gray-900 font-medium">R {(item.totalCost ?? (item.estimatedUnitCost ?? 0) * item.quantity).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Approval Chain</h2>
            <div className="space-y-3">
              {ticket.approvals.length === 0 && (
                <p className="text-sm text-gray-500">No approvals recorded yet.</p>
              )}
              {ticket.approvals.map((approval) => (
                <div key={approval.id} className="flex items-start gap-3 border border-gray-100 rounded-lg p-3">
                  <ClipboardCheck className="w-5 h-5 text-emerald-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{approval.approvalRole}</p>
                    <p className="text-xs text-gray-500">
                      {approval.decision} · {approval.approver?.name || approval.approver?.email || 'Approver'}
                    </p>
                    {approval.comments && <p className="text-xs text-gray-500 mt-1">{approval.comments}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Procurement</h2>
            {ticket.purchaseOrders.length === 0 ? (
              <p className="text-sm text-gray-500">No purchase orders created yet.</p>
            ) : (
              <div className="space-y-4">
                {ticket.purchaseOrders.map((po) => (
                  <div key={po.id} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">{po.reference}</p>
                      <span className="text-xs text-gray-500">{po.status}</span>
                    </div>
                    <p className="text-xs text-gray-500">Vendor: {po.vendor || '—'}</p>
                    <p className="text-xs text-gray-500">Expected: {po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString() : '—'}</p>
                    <p className="text-xs text-gray-500 mt-2">Items: {po.items.length}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal open={showApproval} onClose={() => setShowApproval(false)} title={approvalDecision === 'approve' ? 'Approve Requisition' : 'Reject Requisition'}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500">Approval Role</label>
            <input
              value={approvalRole}
              onChange={(e) => setApprovalRole(e.target.value)}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Comments</label>
            <textarea
              value={approvalComments}
              onChange={(e) => setApprovalComments(e.target.value)}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button className="px-3 py-2 text-sm text-gray-600" onClick={() => setShowApproval(false)}>Cancel</button>
            <button className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg" onClick={submitApproval}>
              Confirm
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={showPO} onClose={() => setShowPO(false)} title="Create Purchase Order">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500">Vendor</label>
            <input
              value={poVendor}
              onChange={(e) => setPoVendor(e.target.value)}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Expected Delivery</label>
            <input
              type="date"
              value={poExpectedDate}
              onChange={(e) => setPoExpectedDate(e.target.value)}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button className="px-3 py-2 text-sm text-gray-600" onClick={() => setShowPO(false)}>Cancel</button>
            <button className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg" onClick={submitPurchaseOrder}>
              Create PO
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={showDelivery} onClose={() => setShowDelivery(false)} title="Confirm Delivery">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500">Delivery Location</label>
            <select
              value={deliveryLocation}
              onChange={(e) => setDeliveryLocation(e.target.value)}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-3">
            {ticket.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.itemName}</p>
                  <p className="text-xs text-gray-500">Requested: {item.quantity}</p>
                </div>
                <input
                  type="number"
                  min={1}
                  className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-sm"
                  value={deliveryQuantities[item.id] ?? item.quantity}
                  onChange={(e) =>
                    setDeliveryQuantities((prev) => ({
                      ...prev,
                      [item.id]: Number(e.target.value)
                    }))
                  }
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button className="px-3 py-2 text-sm text-gray-600" onClick={() => setShowDelivery(false)}>Cancel</button>
            <button className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg" onClick={submitDelivery}>
              Confirm Delivery
            </button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
