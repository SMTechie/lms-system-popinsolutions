import React, { useEffect, useState } from 'react';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { apiRequest } from '../lib/api';
import { notifyAction } from '../lib/notify';

interface InventoryItemOption {
  id: string;
  name: string;
  sku: string;
}

interface RequisitionItemForm {
  itemName: string;
  category: string;
  quantity: number;
  estimatedUnitCost: number;
  itemType: 'EXISTING_INVENTORY' | 'NEW_INVENTORY' | 'CONSUMABLE';
  inventoryItemId?: string;
}

export default function RequisitionCreate() {
  const navigate = useNavigate();
  const [inventoryItems, setInventoryItems] = useState<InventoryItemOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    department: '',
    priority: 'Medium',
    budgetCode: '',
    requiredDate: '',
    deliveryLocation: '',
    vendorPreference: ''
  });
  const [items, setItems] = useState<RequisitionItemForm[]>([
    {
      itemName: '',
      category: '',
      quantity: 1,
      estimatedUnitCost: 0,
      itemType: 'NEW_INVENTORY'
    }
  ]);

  useEffect(() => {
    apiRequest<{ items: InventoryItemOption[] }>('/inventory/items?active=true')
      .then((res) => setInventoryItems(res.items || []))
      .catch(() => {});
  }, []);

  const updateItem = (index: number, field: keyof RequisitionItemForm, value: any) => {
    setItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item)));
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { itemName: '', category: '', quantity: 1, estimatedUnitCost: 0, itemType: 'NEW_INVENTORY' }
    ]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const payload = {
        ...form,
        items: items.map((item) => ({
          ...item,
          estimatedUnitCost: Number(item.estimatedUnitCost),
          quantity: Number(item.quantity),
          inventoryItemId: item.itemType === 'EXISTING_INVENTORY' ? item.inventoryItemId || undefined : undefined
        }))
      };

      const res = await apiRequest<any>('/tickets/requisitions', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      notifyAction('Requisition submitted', 'success');
      navigate(`/requisitions/${res.id}`);
    } catch (err: any) {
      notifyAction(err.message || 'Failed to create requisition', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout title="New Requisition">
      <div className="max-w-5xl mx-auto space-y-6">
        <button
          onClick={() => navigate('/requisitions')}
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Requisitions
        </button>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Create Requisition</h1>
            <p className="text-sm text-gray-500">Capture procurement needs with line items and budget details.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500">Title</label>
              <input
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Department</label>
              <input
                value={form.department}
                onChange={(e) => setForm((prev) => ({ ...prev, department: e.target.value }))}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                {['Low', 'Medium', 'High', 'Urgent'].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Budget Code</label>
              <input
                value={form.budgetCode}
                onChange={(e) => setForm((prev) => ({ ...prev, budgetCode: e.target.value }))}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Required Date</label>
              <input
                type="date"
                value={form.requiredDate}
                onChange={(e) => setForm((prev) => ({ ...prev, requiredDate: e.target.value }))}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Delivery Location</label>
              <input
                value={form.deliveryLocation}
                onChange={(e) => setForm((prev) => ({ ...prev, deliveryLocation: e.target.value }))}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Vendor Preference</label>
              <input
                value={form.vendorPreference}
                onChange={(e) => setForm((prev) => ({ ...prev, vendorPreference: e.target.value }))}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm min-h-[88px]"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Line Items</h2>
              <button
                onClick={addItem}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <Plus className="w-4 h-4" /> Add Item
              </button>
            </div>

            <div className="space-y-4">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-1 lg:grid-cols-6 gap-3 border border-gray-200 rounded-lg p-4">
                  <div className="lg:col-span-2">
                    <label className="text-xs font-medium text-gray-500">Item Name</label>
                    <input
                      value={item.itemName}
                      onChange={(e) => updateItem(index, 'itemName', e.target.value)}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">Category</label>
                    <input
                      value={item.category}
                      onChange={(e) => updateItem(index, 'category', e.target.value)}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">Qty</label>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">Unit Cost</label>
                    <input
                      type="number"
                      min={0}
                      value={item.estimatedUnitCost}
                      onChange={(e) => updateItem(index, 'estimatedUnitCost', Number(e.target.value))}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">Type</label>
                    <select
                      value={item.itemType}
                      onChange={(e) => updateItem(index, 'itemType', e.target.value as RequisitionItemForm['itemType'])}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="NEW_INVENTORY">New Inventory</option>
                      <option value="EXISTING_INVENTORY">Existing Inventory</option>
                      <option value="CONSUMABLE">Consumable</option>
                    </select>
                  </div>

                  {item.itemType === 'EXISTING_INVENTORY' && (
                    <div className="lg:col-span-6">
                      <label className="text-xs font-medium text-gray-500">Inventory Item</label>
                      <select
                        value={item.inventoryItemId || ''}
                        onChange={(e) => updateItem(index, 'inventoryItemId', e.target.value)}
                        className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="">Select inventory item</option>
                        {inventoryItems.map((inv) => (
                          <option key={inv.id} value={inv.id}>{inv.name} ({inv.sku})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="lg:col-span-6 flex justify-end">
                    {items.length > 1 && (
                      <button
                        onClick={() => removeItem(index)}
                        className="inline-flex items-center gap-2 text-sm text-rose-600 hover:text-rose-700"
                      >
                        <Trash2 className="w-4 h-4" /> Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => navigate('/requisitions')}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? 'Submitting...' : 'Submit Requisition'}
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
