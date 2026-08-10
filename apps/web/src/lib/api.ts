const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = body?.error?.message ?? `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body as T;
}

export type DashboardData = {
  reagents: Array<{
    reagentId: string;
    reagentName: string;
    unitOfMeasure: string;
    minThresholdQuantity: number;
    reorderQuantity: number;
    barcode: string | null;
    supplierName: string;
    totalStock: number;
    lotCount: number;
  }>;
  lots: Array<{
    lotId: string;
    lotNumber: string;
    reagentName: string;
    currentQuantity: number;
    unitOfMeasure: string;
    storageLocation: string;
    expirationDate: string;
    status: string;
  }>;
  recentTransactions: Array<{
    transactionId: string;
    lotNumber: string;
    reagentName: string;
    unitOfMeasure: string;
    userId: string;
    transactionType: string;
    quantityChanged: number;
    experimentIdOrProject: string | null;
    timestamp: string;
  }>;
  openPurchaseOrders: Array<{
    poId: string;
    reagentName: string;
    supplierName: string;
    suggestedQuantity: number;
    status: string;
    createdAt: string;
    alert: Record<string, unknown> | null;
  }>;
  lowStockAlerts: Array<{
    reagentId: string;
    reagentName: string;
    unitOfMeasure: string;
    totalStock: number;
    minThreshold: number;
    isLow: boolean;
    supplierName: string;
  }>;
};

export type ConsumptionReport = {
  days: number;
  groupBy: string;
  groups: Array<{
    key: string;
    label: string;
    totalConsumed: number;
    unitOfMeasure?: string;
    transactions: number;
    series: Array<{ date: string; quantity: number }>;
  }>;
};

export type Supplier = {
  supplierId: string;
  supplierName: string;
  contactEmail: string;
  contactPhone: string;
  accountNumber: string;
};

export const api = {
  dashboard: () => request<DashboardData>("/dashboard"),
  consumption: (days = 30) =>
    request<ConsumptionReport>(`/reports/consumption?days=${days}&groupBy=project`),
  suppliers: () => request<Supplier[]>("/suppliers"),
  createSupplier: (payload: Omit<Supplier, "supplierId">) =>
    request<Supplier>("/suppliers", { method: "POST", body: JSON.stringify(payload) }),
  createReagent: (payload: {
    reagentName: string;
    unitOfMeasure: string;
    minThresholdQuantity: number;
    reorderQuantity: number;
    supplierId: string;
    barcode?: string | null;
  }) => request("/reagents", { method: "POST", body: JSON.stringify(payload) }),
  createLot: (payload: {
    reagentId: string;
    lotNumber: string;
    currentQuantity: number;
    storageLocation: string;
    expirationDate: string;
    status?: string;
  }) => request("/lots", { method: "POST", body: JSON.stringify(payload) }),
  updatePoStatus: (poId: string, status: string) =>
    request(`/purchase-orders/${poId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  checkOut: (payload: {
    lotNumber?: string;
    lotId?: string;
    quantity: number;
    userId: string;
    experimentIdOrProject?: string;
  }) =>
    request("/inventory/check-out", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  checkIn: (payload: {
    lotNumber?: string;
    lotId?: string;
    quantity: number;
    userId: string;
  }) =>
    request("/inventory/check-in", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  agent: (message: string, userId?: string) =>
    request("/agent/execute", {
      method: "POST",
      body: JSON.stringify({ message, userId }),
    }),
  evaluateThresholds: () =>
    request("/inventory/evaluate-thresholds", { method: "POST" }),
};
