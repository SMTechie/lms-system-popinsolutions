import { randomUUID } from "crypto";
import { readRecordData, writeRecordData } from "./recordStorage";

type InventoryCategory = { id: string; name: string };
type InventoryUnit = { id: string; name: string; abbreviation: string };
type InventoryLocation = { id: string; name: string };
type InventoryBalance = {
  id: string;
  itemId: string;
  locationId: string;
  quantityOnHand: number;
  location?: InventoryLocation;
};
type InventoryItem = {
  id: string;
  name: string;
  sku: string;
  type: string;
  tracking: string;
  reorderPoint: number;
  minStock: number;
  isActive: boolean;
  categoryId?: string;
  unitId?: string;
};
type InventoryMovement = {
  id: string;
  reference: string;
  type: string;
  itemId: string;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  locationId: string;
  reason?: string;
  unitCost?: number;
  createdAt: string;
};
type InventoryRequest = {
  id: string;
  reference: string;
  locationId?: string;
  department?: string;
  status: string;
  createdAt: string;
  lines: Array<{ itemId: string; quantityRequested: number }>;
};
type InventoryTransfer = {
  id: string;
  reference: string;
  fromLocationId: string;
  toLocationId: string;
  status: string;
  createdAt: string;
  items: Array<{ itemId: string; quantity: number }>;
};
type InventoryAdjustment = {
  id: string;
  reference: string;
  locationId: string;
  status: string;
  reason: string;
  createdAt: string;
  lines: Array<{ itemId: string; quantityDelta: number }>;
};
type InventoryCount = {
  id: string;
  reference: string;
  locationId: string;
  status: string;
  type: string;
  createdAt: string;
};
type InventoryAlert = {
  id: string;
  type: string;
  message: string;
  itemId: string;
  locationId?: string;
};

type RequisitionTicket = {
  id: string;
  reference: string;
  title: string;
  description?: string;
  department?: string;
  priority?: string;
  status: string;
  createdAt: string;
  createdBy: { id: string; name?: string | null; email: string };
  requisition: {
    id: string;
    budgetCode?: string;
    requiredDate?: string | null;
    deliveryLocation?: string;
    vendorPreference?: string;
    procurementStatus?: string;
    approvalLevel?: number;
    estimatedTotalCost?: number;
  };
  items: Array<{
    id: string;
    itemName: string;
    category?: string;
    quantity: number;
    estimatedUnitCost?: number;
    totalCost?: number;
    itemType: string;
    inventoryItemId?: string;
  }>;
  approvals: Array<{
    id: string;
    approvalRole: string;
    decision: string;
    comments?: string;
    decidedAt?: string;
    approver?: { name?: string | null; email: string } | null;
  }>;
  purchaseOrders: Array<{
    id: string;
    reference: string;
    vendor?: string;
    status: string;
    orderDate: string;
    expectedDeliveryDate?: string | null;
    items: { id: string; name: string; quantity: number }[];
  }>;
  estimatedTotal: number;
};

type StoreCategory = { id: string; name: string };
type StoreHistoryItem = {
  id: string;
  type: string;
  quantityChange: number;
  previousQuantity: number;
  newQuantity: number;
  reason?: string;
  createdAt: string;
};
type StoreSaleHistoryItem = {
  id: string;
  quantity: number;
  price: number;
  order: {
    id: string;
    createdAt: string;
    status: string;
  };
};
type StoreProduct = {
  id: string;
  name: string;
  slug: string;
  sku?: string | null;
  barcode?: string | null;
  basePrice?: number | null;
  costPrice?: number | null;
  vatRate?: number;
  vatInclusive?: boolean;
  shortDescription?: string | null;
  primaryImage?: string | null;
  stockQuantity?: number | null;
  lowStockThreshold?: number | null;
  reorderQuantity?: number | null;
  categoryId?: string | null;
  isActive: boolean;
  isFeatured: boolean;
  allowOnlinePurchase?: boolean;
  sizeOptions?: string[];
  colorOptions?: string[];
  genderGroup?: string | null;
  gradeGroup?: string | null;
  supplierId?: string | null;
  collectionLocation?: string | null;
  returnPolicy?: string | null;
  images?: Array<{ url: string; isPrimary?: boolean }>;
  variants?: Array<{ id?: string; name: string; size?: string; color?: string; stockQuantity?: number }>;
};
type StoreOrder = {
  id: string;
  userId: string;
  status: string;
  paymentMethod: string;
  totalAmount: number;
  createdAt: string;
  items: Array<{ id: string; productId: string; name: string; quantity: number; price: number }>;
};

type OpsTicket = {
  id: string;
  title: string;
  category: string;
  priority: string;
  assignee: string;
  status: string;
  created: string;
};

export type OperationsData = {
  inventory: {
    categories: InventoryCategory[];
    units: InventoryUnit[];
    locations: InventoryLocation[];
    items: InventoryItem[];
    balances: InventoryBalance[];
    movements: InventoryMovement[];
    requests: InventoryRequest[];
    transfers: InventoryTransfer[];
    adjustments: InventoryAdjustment[];
    counts: InventoryCount[];
  };
  requisitions: RequisitionTicket[];
  store: {
    categories: StoreCategory[];
    products: StoreProduct[];
    orders: StoreOrder[];
    stockHistory: Record<string, StoreHistoryItem[]>;
    salesHistory: Record<string, StoreSaleHistoryItem[]>;
  };
  tickets: OpsTicket[];
};

const now = () => new Date().toISOString();

function ref(prefix: string, count: number) {
  return `${prefix}-${String(count).padStart(4, "0")}`;
}

export function defaultOperationsData(): OperationsData {
  const categories = [
    { id: "cat-stationery", name: "Stationery" },
    { id: "cat-it", name: "IT Equipment" },
    { id: "cat-uniform", name: "Uniform" },
    { id: "cat-cleaning", name: "Cleaning" }
  ];
  const units = [
    { id: "unit-ea", name: "Each", abbreviation: "ea" },
    { id: "unit-box", name: "Box", abbreviation: "box" },
    { id: "unit-pack", name: "Pack", abbreviation: "pack" }
  ];
  const locations = [
    { id: "loc-main", name: "Main Store" },
    { id: "loc-lab", name: "Science Lab" },
    { id: "loc-uniform", name: "Uniform Room" }
  ];
  const items: InventoryItem[] = [
    { id: "inv-paper", name: "A4 Paper", sku: "PAPER-A4", type: "CONSUMABLE", tracking: "NONE", reorderPoint: 20, minStock: 10, isActive: true, categoryId: "cat-stationery", unitId: "unit-box" },
    { id: "inv-projector", name: "Projector", sku: "IT-PROJ-01", type: "ASSET", tracking: "SERIAL", reorderPoint: 2, minStock: 1, isActive: true, categoryId: "cat-it", unitId: "unit-ea" },
    { id: "inv-blazer-g8", name: "Grade 8 Blazer", sku: "UNI-G8-BLZ", type: "STOCK", tracking: "NONE", reorderPoint: 8, minStock: 5, isActive: true, categoryId: "cat-uniform", unitId: "unit-ea" },
    { id: "inv-detergent", name: "Detergent", sku: "CLN-DET-01", type: "CONSUMABLE", tracking: "BATCH", reorderPoint: 6, minStock: 3, isActive: true, categoryId: "cat-cleaning", unitId: "unit-pack" }
  ];
  const balances: InventoryBalance[] = [
    { id: "bal-1", itemId: "inv-paper", locationId: "loc-main", quantityOnHand: 14 },
    { id: "bal-2", itemId: "inv-projector", locationId: "loc-main", quantityOnHand: 3 },
    { id: "bal-3", itemId: "inv-blazer-g8", locationId: "loc-uniform", quantityOnHand: 22 },
    { id: "bal-4", itemId: "inv-detergent", locationId: "loc-main", quantityOnHand: 4 },
    { id: "bal-5", itemId: "inv-paper", locationId: "loc-lab", quantityOnHand: 6 }
  ];
  const movements: InventoryMovement[] = [
    { id: "mov-1", reference: "RCV-0001", type: "RECEIVE", itemId: "inv-paper", quantity: 20, previousQuantity: 0, newQuantity: 20, locationId: "loc-main", unitCost: 85, reason: "Opening stock", createdAt: "2026-06-18T08:30:00.000Z" },
    { id: "mov-2", reference: "ISS-0001", type: "ISSUE", itemId: "inv-paper", quantity: -6, previousQuantity: 20, newQuantity: 14, locationId: "loc-main", reason: "Admin office issue", createdAt: "2026-06-19T09:15:00.000Z" },
    { id: "mov-3", reference: "RCV-0002", type: "RECEIVE", itemId: "inv-blazer-g8", quantity: 22, previousQuantity: 0, newQuantity: 22, locationId: "loc-uniform", unitCost: 520, reason: "Winter stock", createdAt: "2026-06-20T10:00:00.000Z" }
  ];
  const requests: InventoryRequest[] = [
    { id: "req-1", reference: "ISR-0001", department: "Admin", locationId: "loc-main", status: "PENDING_APPROVAL", createdAt: "2026-06-21T07:45:00.000Z", lines: [{ itemId: "inv-paper", quantityRequested: 8 }] }
  ];
  const transfers: InventoryTransfer[] = [
    { id: "trf-1", reference: "TRF-0001", fromLocationId: "loc-main", toLocationId: "loc-lab", status: "COMPLETED", createdAt: "2026-06-20T11:00:00.000Z", items: [{ itemId: "inv-paper", quantity: 6 }] }
  ];
  const adjustments: InventoryAdjustment[] = [
    { id: "adj-1", reference: "ADJ-0001", locationId: "loc-main", status: "APPROVED", reason: "Damaged box count correction", createdAt: "2026-06-21T13:15:00.000Z", lines: [{ itemId: "inv-detergent", quantityDelta: -1 }] }
  ];
  const counts: InventoryCount[] = [
    { id: "cnt-1", reference: "CNT-0001", locationId: "loc-main", status: "OPEN", type: "Cycle Count", createdAt: "2026-06-22T06:30:00.000Z" }
  ];

  const requisitions: RequisitionTicket[] = [
    {
      id: "rqt-1",
      reference: "REQ-0001",
      title: "Science lab starter kits",
      description: "Procure starter kits for incoming Grade 8 science practicals.",
      department: "Science",
      priority: "High",
      status: "PENDING_APPROVAL",
      createdAt: "2026-06-20T08:00:00.000Z",
      createdBy: { id: "seed-admin", name: "Operations Admin", email: "admin@popin.school" },
      requisition: {
        id: "rqtd-1",
        budgetCode: "SCI-2026-01",
        requiredDate: "2026-07-01",
        deliveryLocation: "Science Lab",
        vendorPreference: "EduLab Supplies",
        procurementStatus: "PENDING_APPROVAL",
        approvalLevel: 1,
        estimatedTotalCost: 14500
      },
      items: [
        { id: "rqti-1", itemName: "Lab goggles", category: "Science", quantity: 30, estimatedUnitCost: 150, totalCost: 4500, itemType: "CONSUMABLE" },
        { id: "rqti-2", itemName: "Starter beaker set", category: "Science", quantity: 20, estimatedUnitCost: 500, totalCost: 10000, itemType: "NEW_INVENTORY" }
      ],
      approvals: [],
      purchaseOrders: [],
      estimatedTotal: 14500
    },
    {
      id: "rqt-2",
      reference: "REQ-0002",
      title: "Term 3 blazer replenishment",
      department: "Uniform Store",
      priority: "Medium",
      status: "ORDERED",
      createdAt: "2026-06-18T11:00:00.000Z",
      createdBy: { id: "seed-admin", name: "Operations Admin", email: "admin@popin.school" },
      requisition: {
        id: "rqtd-2",
        budgetCode: "UNI-2026-02",
        requiredDate: "2026-06-28",
        deliveryLocation: "Uniform Room",
        vendorPreference: "Scholars Wear",
        procurementStatus: "ORDERED",
        approvalLevel: 2,
        estimatedTotalCost: 26000
      },
      items: [
        { id: "rqti-3", itemName: "Grade 8 Blazer", category: "Uniform", quantity: 40, estimatedUnitCost: 650, totalCost: 26000, itemType: "EXISTING_INVENTORY", inventoryItemId: "inv-blazer-g8" }
      ],
      approvals: [
        { id: "appr-1", approvalRole: "Department Head", decision: "APPROVED", comments: "Proceed", decidedAt: "2026-06-18T14:00:00.000Z", approver: { name: "Operations Admin", email: "admin@popin.school" } }
      ],
      purchaseOrders: [
        { id: "po-1", reference: "PO-0001", vendor: "Scholars Wear", status: "ORDERED", orderDate: "2026-06-19T08:00:00.000Z", expectedDeliveryDate: "2026-06-27", items: [{ id: "poi-1", name: "Grade 8 Blazer", quantity: 40 }] }
      ],
      estimatedTotal: 26000
    }
  ];

  const storeCategories = [
    { id: "store-blazers", name: "Blazers" },
    { id: "store-shirts", name: "Shirts" },
    { id: "store-sports", name: "Sportswear" }
  ];
  const storeProducts: StoreProduct[] = [
    {
      id: "prd-1",
      name: "Grade 8 Blazer",
      slug: "grade-8-blazer",
      sku: "UNI-G8-BLZ",
      basePrice: 850,
      costPrice: 650,
      vatRate: 15,
      vatInclusive: true,
      shortDescription: "Official Grade 8 navy blazer.",
      primaryImage: "https://placehold.co/600x400",
      stockQuantity: 22,
      lowStockThreshold: 5,
      reorderQuantity: 25,
      categoryId: "store-blazers",
      isActive: true,
      isFeatured: true,
      allowOnlinePurchase: true,
      sizeOptions: ["30", "32", "34", "36"],
      colorOptions: ["Navy"],
      collectionLocation: "Uniform Room",
      returnPolicy: "Exchange within 14 days."
    },
    {
      id: "prd-2",
      name: "School Shirt",
      slug: "school-shirt",
      sku: "UNI-SHIRT-01",
      basePrice: 180,
      costPrice: 110,
      shortDescription: "Short-sleeve school shirt.",
      primaryImage: "https://placehold.co/600x400",
      stockQuantity: 58,
      lowStockThreshold: 12,
      reorderQuantity: 30,
      categoryId: "store-shirts",
      isActive: true,
      isFeatured: false,
      allowOnlinePurchase: true,
      sizeOptions: ["S", "M", "L", "XL"],
      colorOptions: ["White"],
      collectionLocation: "Uniform Room",
      returnPolicy: "Exchange within 14 days."
    }
  ];
  const orders: StoreOrder[] = [
    {
      id: "ord-1",
      userId: "seed-admin",
      status: "READY_FOR_COLLECTION",
      paymentMethod: "eft",
      totalAmount: 1030,
      createdAt: "2026-06-21T10:00:00.000Z",
      items: [
        { id: "ordi-1", productId: "prd-1", name: "Grade 8 Blazer", quantity: 1, price: 850 },
        { id: "ordi-2", productId: "prd-2", name: "School Shirt", quantity: 1, price: 180 }
      ]
    }
  ];
  const stockHistory = {
    "prd-1": [
      { id: "sh-1", type: "RESTOCK", quantityChange: 22, previousQuantity: 0, newQuantity: 22, reason: "Opening stock", createdAt: "2026-06-20T08:00:00.000Z" }
    ],
    "prd-2": [
      { id: "sh-2", type: "RESTOCK", quantityChange: 60, previousQuantity: 0, newQuantity: 60, reason: "Opening stock", createdAt: "2026-06-20T08:15:00.000Z" }
    ]
  } as Record<string, StoreHistoryItem[]>;
  const salesHistory = {
    "prd-1": [
      { id: "saleh-1", quantity: 1, price: 850, order: { id: "ord-1", createdAt: "2026-06-21T10:00:00.000Z", status: "READY_FOR_COLLECTION" } }
    ],
    "prd-2": [
      { id: "saleh-2", quantity: 1, price: 180, order: { id: "ord-1", createdAt: "2026-06-21T10:00:00.000Z", status: "READY_FOR_COLLECTION" } }
    ]
  } as Record<string, StoreSaleHistoryItem[]>;

  const tickets: OpsTicket[] = [
    { id: "TKT-001", title: "Broken AC in Staff Room", category: "Maintenance", priority: "high", assignee: "John M.", status: "open", created: "2026-06-20" },
    { id: "TKT-002", title: "Projector not working in Lab 3", category: "IT", priority: "high", assignee: "John M.", status: "in-progress", created: "2026-06-19" },
    { id: "TKT-003", title: "Request for new whiteboard markers", category: "Supplies", priority: "low", assignee: "Lisa P.", status: "open", created: "2026-06-18" }
  ];

  return {
    inventory: { categories, units, locations, items, balances, movements, requests, transfers, adjustments, counts },
    requisitions,
    store: { categories: storeCategories, products: storeProducts, orders, stockHistory, salesHistory },
    tickets
  };
}

export async function getOperationsData() {
  return readRecordData<OperationsData>("operations", defaultOperationsData());
}

export async function saveOperationsData(data: OperationsData) {
  await writeRecordData("operations", data);
  return data;
}

export function withInventoryJoins(data: OperationsData) {
  const categoryMap = new Map(data.inventory.categories.map((item) => [item.id, item]));
  const unitMap = new Map(data.inventory.units.map((item) => [item.id, item]));
  const locationMap = new Map(data.inventory.locations.map((item) => [item.id, item]));

  const balances = data.inventory.balances.map((balance) => ({
    ...balance,
    location: locationMap.get(balance.locationId)
  }));

  const items = data.inventory.items.map((item) => ({
    ...item,
    category: item.categoryId ? categoryMap.get(item.categoryId) ?? null : null,
    unit: item.unitId ? unitMap.get(item.unitId) ?? null : null,
    balances: balances.filter((balance) => balance.itemId === item.id)
  }));

  return {
    items,
    balances,
    categoryMap,
    unitMap,
    locationMap
  };
}

function getBalance(data: OperationsData, itemId: string, locationId: string) {
  let balance = data.inventory.balances.find((item) => item.itemId === itemId && item.locationId === locationId);
  if (!balance) {
    balance = { id: randomUUID(), itemId, locationId, quantityOnHand: 0 };
    data.inventory.balances.push(balance);
  }
  return balance;
}

export function applyInventoryMovement(
  data: OperationsData,
  input: {
    type: string;
    itemId: string;
    locationId: string;
    quantityChange: number;
    reason?: string;
    unitCost?: number;
    referencePrefix?: string;
  }
) {
  const balance = getBalance(data, input.itemId, input.locationId);
  const previousQuantity = balance.quantityOnHand;
  balance.quantityOnHand += input.quantityChange;
  const movement: InventoryMovement = {
    id: randomUUID(),
    reference: ref(input.referencePrefix || input.type.slice(0, 3).toUpperCase(), data.inventory.movements.length + 1),
    type: input.type,
    itemId: input.itemId,
    quantity: input.quantityChange,
    previousQuantity,
    newQuantity: balance.quantityOnHand,
    locationId: input.locationId,
    reason: input.reason,
    unitCost: input.unitCost,
    createdAt: now()
  };
  data.inventory.movements.unshift(movement);
  return movement;
}

export function computeInventoryAlerts(data: OperationsData) {
  const { items } = withInventoryJoins(data);
  const alerts: InventoryAlert[] = [];

  for (const item of items) {
    const total = (item.balances || []).reduce((sum, balance) => sum + balance.quantityOnHand, 0);
    if (total <= item.reorderPoint) {
      alerts.push({
        id: `alert-${item.id}`,
        type: total <= 0 ? "OUT_OF_STOCK" : "LOW_STOCK",
        message: total <= 0 ? `${item.name} is out of stock.` : `${item.name} is below reorder point.`,
        itemId: item.id
      });
    }
  }

  return alerts;
}

export function computeInventoryOverview(data: OperationsData) {
  const { items } = withInventoryJoins(data);
  const alerts = computeInventoryAlerts(data);
  const totalOnHand = data.inventory.balances.reduce((sum, item) => sum + item.quantityOnHand, 0);
  const stockValue = items.reduce((sum, item) => {
    const onHand = (item.balances || []).reduce((count, balance) => count + balance.quantityOnHand, 0);
    const relatedProduct = data.store.products.find((product) => product.sku === item.sku);
    const unitCost = relatedProduct?.costPrice || 100;
    return sum + onHand * unitCost;
  }, 0);

  return {
    totalSkus: items.length,
    totalOnHand,
    lowStockCount: alerts.filter((item) => item.type === "LOW_STOCK").length,
    outOfStockCount: alerts.filter((item) => item.type === "OUT_OF_STOCK").length,
    expiringItems: 0,
    pendingRequests: data.inventory.requests.filter((item) => item.status === "PENDING_APPROVAL").length,
    stockValue,
    recentMovements: data.inventory.movements.slice(0, 10),
    locationSummary: data.inventory.locations.map((location) => ({
      id: location.id,
      name: location.name,
      stockOnHand: data.inventory.balances.filter((item) => item.locationId === location.id).reduce((sum, item) => sum + item.quantityOnHand, 0)
    }))
  };
}

export function computeRequisitionOverview(data: OperationsData) {
  const byDepartmentMap = new Map<string, number>();
  const spendCategoryMap = new Map<string, number>();
  let approvalHours = 0;
  let approvalSamples = 0;

  for (const req of data.requisitions) {
    byDepartmentMap.set(req.department || "General", (byDepartmentMap.get(req.department || "General") || 0) + 1);
    for (const item of req.items) {
      spendCategoryMap.set(item.category || "General", (spendCategoryMap.get(item.category || "General") || 0) + (item.totalCost || 0));
    }
    if (req.approvals[0]?.decidedAt) {
      approvalHours += (new Date(req.approvals[0].decidedAt).getTime() - new Date(req.createdAt).getTime()) / 36e5;
      approvalSamples += 1;
    }
  }

  return {
    totalRequisitions: data.requisitions.length,
    pendingApprovals: data.requisitions.filter((item) => item.status === "PENDING_APPROVAL").length,
    ordersInProgress: data.requisitions.filter((item) => ["PROCUREMENT", "ORDERED"].includes(item.status)).length,
    deliveredItems: data.requisitions.filter((item) => item.status === "DELIVERED").reduce((sum, item) => sum + item.items.reduce((inner, line) => inner + line.quantity, 0), 0),
    monthlySpend: data.requisitions.reduce((sum, item) => sum + (item.estimatedTotal || 0), 0),
    byDepartment: Array.from(byDepartmentMap.entries()).map(([name, value]) => ({ name, value })),
    spendByCategory: Array.from(spendCategoryMap.entries()).map(([name, value]) => ({ name, value })),
    approvalMetrics: {
      averageHours: approvalSamples ? approvalHours / approvalSamples : 0
    }
  };
}

export function createRequisition(data: OperationsData, payload: any, user: { id: string; email: string; name?: string | null }) {
  const items = (payload.items || []).map((item: any) => ({
    id: randomUUID(),
    itemName: item.itemName,
    category: item.category,
    quantity: Number(item.quantity),
    estimatedUnitCost: Number(item.estimatedUnitCost || 0),
    totalCost: Number(item.quantity) * Number(item.estimatedUnitCost || 0),
    itemType: item.itemType,
    inventoryItemId: item.inventoryItemId
  }));

  const estimatedTotal = items.reduce((sum: number, item: any) => sum + (item.totalCost || 0), 0);
  const req: RequisitionTicket = {
    id: randomUUID(),
    reference: ref("REQ", data.requisitions.length + 1),
    title: payload.title,
    description: payload.description,
    department: payload.department,
    priority: payload.priority || "Medium",
    status: "PENDING_APPROVAL",
    createdAt: now(),
    createdBy: { id: user.id, email: user.email, name: user.name },
    requisition: {
      id: randomUUID(),
      budgetCode: payload.budgetCode,
      requiredDate: payload.requiredDate || null,
      deliveryLocation: payload.deliveryLocation,
      vendorPreference: payload.vendorPreference,
      procurementStatus: "PENDING_APPROVAL",
      approvalLevel: 1,
      estimatedTotalCost: estimatedTotal
    },
    items,
    approvals: [],
    purchaseOrders: [],
    estimatedTotal
  };
  data.requisitions.unshift(req);
  return req;
}

export function createStoreProduct(data: OperationsData, payload: any) {
  const product: StoreProduct = {
    id: randomUUID(),
    name: payload.name,
    slug: payload.slug,
    sku: payload.sku || null,
    barcode: payload.barcode || null,
    basePrice: Number(payload.basePrice || 0),
    costPrice: Number(payload.costPrice || 0),
    vatRate: Number(payload.vatRate || 15),
    vatInclusive: Boolean(payload.vatInclusive),
    shortDescription: payload.shortDescription || null,
    primaryImage: payload.images?.[0]?.url || payload.primaryImage || null,
    stockQuantity: Number(payload.stockQuantity || 0),
    lowStockThreshold: Number(payload.lowStockThreshold || 0),
    reorderQuantity: Number(payload.reorderQuantity || 0),
    categoryId: payload.categoryId || null,
    isActive: payload.isActive ?? true,
    isFeatured: payload.isFeatured ?? false,
    allowOnlinePurchase: payload.allowOnlinePurchase ?? true,
    sizeOptions: payload.sizeOptions || [],
    colorOptions: payload.colorOptions || [],
    genderGroup: payload.genderGroup || null,
    gradeGroup: payload.gradeGroup || null,
    supplierId: payload.supplierId || null,
    collectionLocation: payload.collectionLocation || null,
    returnPolicy: payload.returnPolicy || null,
    images: payload.images || [],
    variants: payload.variants || []
  };
  data.store.products.unshift(product);
  data.store.stockHistory[product.id] = [
    {
      id: randomUUID(),
      type: "CREATE",
      quantityChange: Number(product.stockQuantity || 0),
      previousQuantity: 0,
      newQuantity: Number(product.stockQuantity || 0),
      reason: "Product created",
      createdAt: now()
    }
  ];
  return product;
}
