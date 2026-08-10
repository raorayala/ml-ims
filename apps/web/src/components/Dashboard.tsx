"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Beaker,
  ClipboardList,
  FlaskConical,
  PackageSearch,
  RefreshCw,
  ScanLine,
  Sparkles,
} from "lucide-react";
import { api, type ConsumptionReport, type DashboardData } from "@/lib/api";
import { AdminPanel } from "./AdminPanel";
import { BarcodeScanner } from "./BarcodeScanner";
import { ConsumptionChart } from "./ConsumptionChart";

const DEFAULT_USER = "lab-tech-001";

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [report, setReport] = useState<ConsumptionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [lotNumber, setLotNumber] = useState("902");
  const [quantity, setQuantity] = useState("50");
  const [project, setProject] = useState("EXP-101");
  const [userId, setUserId] = useState(DEFAULT_USER);
  const [agentMessage, setAgentMessage] = useState(
    "I took 50mL of Lot 902 for Project EXP-101",
  );
  const [agentResult, setAgentResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    const [dashboard, consumption] = await Promise.all([
      api.dashboard(),
      api.consumption(30),
    ]);
    setData(dashboard);
    setReport(consumption);
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh()
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [refresh]);

  const lowCount = data?.lowStockAlerts.length ?? 0;
  const openPoCount = data?.openPurchaseOrders.length ?? 0;

  const stockRows = useMemo(() => data?.reagents ?? [], [data]);

  async function handleCheckOut() {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const result = (await api.checkOut({
        lotNumber,
        quantity: Number(quantity),
        userId,
        experimentIdOrProject: project || undefined,
      })) as {
        reorder?: { triggered?: boolean; alert?: { message?: string } };
        totalStock?: number;
      };
      await refresh();
      if (result.reorder?.triggered) {
        setNotice(
          result.reorder.alert?.message ??
            "Check-out saved. Low-stock reorder logic triggered.",
        );
      } else {
        setNotice(`Check-out recorded. Total active stock: ${result.totalStock}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check-out failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleCheckIn() {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      await api.checkIn({
        lotNumber,
        quantity: Number(quantity),
        userId,
      });
      await refresh();
      setNotice("Check-in recorded.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleAgent() {
    setBusy(true);
    setAgentResult(null);
    setError(null);
    try {
      const result = await api.agent(agentMessage, userId);
      setAgentResult(JSON.stringify(result, null, 2));
      await refresh();
      setNotice("Agent executed successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Agent failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleEvaluate() {
    setBusy(true);
    setError(null);
    try {
      await api.evaluateThresholds();
      await refresh();
      setNotice("Threshold evaluation complete.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Evaluation failed");
    } finally {
      setBusy(false);
    }
  }

  async function handlePoStatus(poId: string, status: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api.updatePoStatus(poId, status);
      await refresh();
      setNotice(`Purchase order updated to ${status}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PO update failed");
    } finally {
      setBusy(false);
    }
  }

  function nextPoActions(status: string): Array<{ label: string; status: string }> {
    switch (status) {
      case "Draft":
        return [{ label: "Send for approval", status: "Pending Approval" }];
      case "Pending Approval":
        return [
          { label: "Approve & submit", status: "Submitted" },
          { label: "Back to draft", status: "Draft" },
        ];
      case "Submitted":
        return [{ label: "Mark received", status: "Received" }];
      default:
        return [];
    }
  }

  function onScan(value: string) {
    // Accept either lot number or reagent barcode values.
    setLotNumber(value.replace(/^LOT[-:]?/i, "").trim());
    setNotice(`Scanner captured: ${value}`);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[var(--muted)]">
        Loading laboratory inventory…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
      <header className="animate-rise mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 inline-flex items-center gap-2 text-sm text-[var(--muted)]">
            <span className="live-dot" />
            Real-time ML-IMS
          </p>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            Microbiology Laboratory
            <span className="block text-[var(--accent-deep)]">Inventory System</span>
          </h1>
          <p className="mt-3 max-w-2xl text-[var(--muted)]">
            Auditable check-out/in, threshold-driven purchase drafts, and an agent loop
            that turns natural language into inventory mutations.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex items-center gap-2 border border-[var(--line)] bg-white px-4 py-2 text-sm hover:border-[var(--accent)]"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </header>

      {(error || notice) && (
        <div
          className={`animate-rise mb-6 border px-4 py-3 text-sm ${
            error
              ? "border-[var(--danger)] bg-[#fff5f5] text-[var(--danger)]"
              : "border-[var(--accent)] bg-[#f1faf5] text-[var(--accent-deep)]"
          }`}
        >
          {error ?? notice}
        </div>
      )}

      <section className="animate-rise mb-6 grid gap-4 md:grid-cols-4">
        <Stat
          icon={<Beaker size={18} />}
          label="Reagents"
          value={String(stockRows.length)}
        />
        <Stat
          icon={<AlertTriangle size={18} />}
          label="Low stock"
          value={String(lowCount)}
          tone={lowCount > 0 ? "warn" : "ok"}
        />
        <Stat
          icon={<PackageSearch size={18} />}
          label="Open POs"
          value={String(openPoCount)}
        />
        <Stat
          icon={<ClipboardList size={18} />}
          label="Recent txs"
          value={String(data?.recentTransactions.length ?? 0)}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="panel animate-rise p-5">
          <div className="mb-4 flex items-center gap-2">
            <FlaskConical size={18} className="text-[var(--accent)]" />
            <h2 className="text-lg font-semibold">Reagent list</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-[var(--muted)]">
                <tr className="border-b border-[var(--line)]">
                  <th className="py-2 pr-3 font-medium">Reagent</th>
                  <th className="py-2 pr-3 font-medium">Stock</th>
                  <th className="py-2 pr-3 font-medium">Threshold</th>
                  <th className="py-2 pr-3 font-medium">Supplier</th>
                  <th className="py-2 font-medium">Lots</th>
                </tr>
              </thead>
              <tbody>
                {stockRows.map((r) => {
                  const low = r.totalStock <= r.minThresholdQuantity;
                  return (
                    <tr key={r.reagentId} className="border-b border-[var(--line)]/70">
                      <td className="py-3 pr-3">
                        <div className="font-medium">{r.reagentName}</div>
                        <div className="text-xs text-[var(--muted)]">
                          {r.barcode ?? "—"}
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        <span className={low ? "text-[var(--warn)]" : ""}>
                          {r.totalStock} {r.unitOfMeasure}
                        </span>
                      </td>
                      <td className="py-3 pr-3">
                        {r.minThresholdQuantity} {r.unitOfMeasure}
                      </td>
                      <td className="py-3 pr-3">{r.supplierName}</td>
                      <td className="py-3">{r.lotCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel animate-rise p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-[var(--warn)]" />
              <h2 className="text-lg font-semibold">Low-stock alerts</h2>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleEvaluate()}
              className="text-xs underline decoration-[var(--line)] underline-offset-4"
            >
              Evaluate thresholds
            </button>
          </div>
          <div className="space-y-3">
            {(data?.lowStockAlerts.length ?? 0) === 0 ? (
              <p className="text-sm text-[var(--muted)]">No reagents below threshold.</p>
            ) : (
              data?.lowStockAlerts.map((a) => (
                <div
                  key={a.reagentId}
                  className="border border-[var(--line)] bg-white/70 px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{a.reagentName}</p>
                      <p className="text-xs text-[var(--muted)]">{a.supplierName}</p>
                    </div>
                    <span className="badge text-[var(--warn)]">LOW</span>
                  </div>
                  <p className="mt-2 text-sm">
                    {a.totalStock} / {a.minThreshold} {a.unitOfMeasure}
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="mt-6 border-t border-[var(--line)] pt-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
              Draft / open POs
            </h3>
            <div className="space-y-2">
              {(data?.openPurchaseOrders.length ?? 0) === 0 ? (
                <p className="text-sm text-[var(--muted)]">No open purchase orders.</p>
              ) : (
                data?.openPurchaseOrders.map((po) => (
                  <div key={po.poId} className="border border-[var(--line)] px-3 py-2 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{po.reagentName}</span>
                      <span className="badge">{po.status}</span>
                    </div>
                    <p className="text-[var(--muted)]">
                      Qty {po.suggestedQuantity} · {po.supplierName}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {nextPoActions(po.status).map((action) => (
                        <button
                          key={action.status}
                          type="button"
                          disabled={busy}
                          onClick={() => void handlePoStatus(po.poId, action.status)}
                          className="border border-[var(--line)] bg-white px-2 py-1 text-xs hover:border-[var(--accent)] disabled:opacity-60"
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="panel animate-rise p-5">
          <div className="mb-4 flex items-center gap-2">
            <ScanLine size={18} className="text-[var(--accent)]" />
            <h2 className="text-lg font-semibold">Check-out / check-in</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-[var(--muted)]">Lot number</span>
              <input
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                className="w-full border border-[var(--line)] bg-white px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-[var(--muted)]">Quantity</span>
              <input
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full border border-[var(--line)] bg-white px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-[var(--muted)]">Project / experiment</span>
              <input
                value={project}
                onChange={(e) => setProject(e.target.value)}
                className="w-full border border-[var(--line)] bg-white px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-[var(--muted)]">User ID</span>
              <input
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full border border-[var(--line)] bg-white px-3 py-2"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleCheckOut()}
              className="bg-[var(--accent)] px-4 py-2 text-sm text-white hover:bg-[var(--accent-deep)] disabled:opacity-60"
            >
              Check out
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleCheckIn()}
              className="border border-[var(--line)] bg-white px-4 py-2 text-sm hover:border-[var(--accent)] disabled:opacity-60"
            >
              Check in
            </button>
          </div>
          <div className="mt-5 border-t border-[var(--line)] pt-4">
            <BarcodeScanner onScan={onScan} />
          </div>
        </section>

        <section className="panel animate-rise p-5">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles size={18} className="text-[var(--accent)]" />
            <h2 className="text-lg font-semibold">Agentic AI loop</h2>
          </div>
          <p className="mb-3 text-sm text-[var(--muted)]">
            Natural language is parsed into MCP tools (`check_out_reagent`, etc.) and
            executed with automatic reorder evaluation.
          </p>
          <textarea
            value={agentMessage}
            onChange={(e) => setAgentMessage(e.target.value)}
            rows={4}
            className="w-full border border-[var(--line)] bg-white px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleAgent()}
            className="mt-3 bg-[var(--ink)] px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            Run agent
          </button>
          {agentResult ? (
            <pre className="mt-4 max-h-64 overflow-auto border border-[var(--line)] bg-[#0f1713] p-3 text-xs text-[#d7efe3]">
              {agentResult}
            </pre>
          ) : null}
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <section className="panel animate-rise p-5">
          <h2 className="mb-4 text-lg font-semibold">30-day consumption by project</h2>
          <ConsumptionChart report={report} />
        </section>

        <section className="panel animate-rise p-5">
          <div className="mb-4 flex items-center gap-2">
            <ClipboardList size={18} className="text-[var(--accent)]" />
            <h2 className="text-lg font-semibold">Transaction logger</h2>
          </div>
          <div className="max-h-[320px] space-y-2 overflow-y-auto">
            {(data?.recentTransactions.length ?? 0) === 0 ? (
              <p className="text-sm text-[var(--muted)]">No transactions yet.</p>
            ) : (
              data?.recentTransactions.map((t) => (
                <div
                  key={t.transactionId}
                  className="grid grid-cols-[auto_1fr_auto] gap-3 border border-[var(--line)] bg-white/60 px-3 py-2 text-sm"
                >
                  <span
                    className={`badge ${
                      t.transactionType === "Check-out"
                        ? "text-[var(--warn)]"
                        : "text-[var(--ok)]"
                    }`}
                  >
                    {t.transactionType}
                  </span>
                  <div>
                    <p className="font-medium">
                      Lot {t.lotNumber} · {t.reagentName}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {t.quantityChanged} {t.unitOfMeasure}
                      {t.experimentIdOrProject
                        ? ` · ${t.experimentIdOrProject}`
                        : ""}{" "}
                      · {t.userId}
                    </p>
                  </div>
                  <time className="text-xs text-[var(--muted)]">
                    {new Date(t.timestamp).toLocaleString()}
                  </time>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="mt-6">
        <AdminPanel
          reagents={stockRows}
          onChanged={refresh}
          setError={setError}
          setNotice={setNotice}
        />
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "warn" | "ok";
}) {
  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center justify-between text-[var(--muted)]">
        <span className="text-sm">{label}</span>
        {icon}
      </div>
      <p
        className={`text-3xl font-semibold ${
          tone === "warn"
            ? "text-[var(--warn)]"
            : tone === "ok"
              ? "text-[var(--ok)]"
              : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
