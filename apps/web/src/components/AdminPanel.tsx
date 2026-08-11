"use client";

import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import { api, type DashboardData, type Supplier } from "@/lib/api";

type Props = {
  reagents: DashboardData["reagents"];
  onChanged: () => Promise<void>;
  setError: (msg: string | null) => void;
  setNotice: (msg: string | null) => void;
};

const UNITS = ["mL", "L", "g", "kg", "vials", "packs"] as const;

export function AdminPanel({ reagents, onChanged, setError, setNotice }: Props) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [busy, setBusy] = useState(false);

  const [supplierForm, setSupplierForm] = useState({
    supplierName: "",
    contactEmail: "",
    contactPhone: "",
    accountNumber: "",
  });

  const [reagentForm, setReagentForm] = useState({
    reagentName: "",
    unitOfMeasure: "mL",
    minThresholdQuantity: "100",
    reorderQuantity: "500",
    supplierId: "",
    barcode: "",
  });

  const [lotForm, setLotForm] = useState({
    reagentId: "",
    lotNumber: "",
    currentQuantity: "100",
    storageLocation: "",
    expirationDate: "",
  });

  useEffect(() => {
    void api
      .suppliers()
      .then((rows) => {
        setSuppliers(rows);
        setReagentForm((f) =>
          f.supplierId || !rows[0] ? f : { ...f, supplierId: rows[0].supplierId },
        );
      })
      .catch((err: Error) => setError(err.message));
  }, [reagents.length, setError]);

  useEffect(() => {
    if (!lotForm.reagentId && reagents[0]) {
      setLotForm((f) => ({ ...f, reagentId: reagents[0].reagentId }));
    }
  }, [reagents, lotForm.reagentId]);

  async function run(action: () => Promise<unknown>, ok: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      const rows = await api.suppliers();
      setSuppliers(rows);
      await onChanged();
      setNotice(ok);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel animate-rise p-5">
      <div className="mb-4 flex items-center gap-2">
        <Settings2 size={18} className="text-[var(--accent)]" />
        <h2 className="text-lg font-semibold">Master data admin</h2>
      </div>
      <p className="mb-4 text-sm text-[var(--muted)]">
        Create suppliers, reagents, and lots. Deletes are available via API when records have
        no dependents.
      </p>

      <div className="grid gap-6 xl:grid-cols-3">
        <form
          className="space-y-2 border border-[var(--line)] p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => api.createSupplier(supplierForm), "Supplier created.");
          }}
        >
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            New supplier
          </h3>
          {(
            [
              ["supplierName", "Name"],
              ["contactEmail", "Email"],
              ["contactPhone", "Phone"],
              ["accountNumber", "Account #"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block text-sm">
              <span className="mb-1 block text-[var(--muted)]">{label}</span>
              <input
                required
                value={supplierForm[key]}
                onChange={(e) =>
                  setSupplierForm((f) => ({ ...f, [key]: e.target.value }))
                }
                className="w-full border border-[var(--line)] bg-white px-3 py-2"
              />
            </label>
          ))}
          <button
            type="submit"
            disabled={busy}
            className="bg-[var(--accent)] px-3 py-2 text-sm text-white disabled:opacity-60"
          >
            Add supplier
          </button>
          <p className="text-xs text-[var(--muted)]">{suppliers.length} suppliers loaded</p>
        </form>

        <form
          className="space-y-2 border border-[var(--line)] p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(
              () =>
                api.createReagent({
                  reagentName: reagentForm.reagentName,
                  unitOfMeasure: reagentForm.unitOfMeasure,
                  minThresholdQuantity: Number(reagentForm.minThresholdQuantity),
                  reorderQuantity: Number(reagentForm.reorderQuantity),
                  supplierId: reagentForm.supplierId,
                  barcode: reagentForm.barcode || null,
                }),
              "Reagent created.",
            );
          }}
        >
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            New reagent
          </h3>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">Name</span>
            <input
              required
              value={reagentForm.reagentName}
              onChange={(e) =>
                setReagentForm((f) => ({ ...f, reagentName: e.target.value }))
              }
              className="w-full border border-[var(--line)] bg-white px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">Unit</span>
            <select
              value={reagentForm.unitOfMeasure}
              onChange={(e) =>
                setReagentForm((f) => ({ ...f, unitOfMeasure: e.target.value }))
              }
              className="w-full border border-[var(--line)] bg-white px-3 py-2"
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">Supplier</span>
            <select
              required
              value={reagentForm.supplierId}
              onChange={(e) =>
                setReagentForm((f) => ({ ...f, supplierId: e.target.value }))
              }
              className="w-full border border-[var(--line)] bg-white px-3 py-2"
            >
              {suppliers.map((s) => (
                <option key={s.supplierId} value={s.supplierId}>
                  {s.supplierName}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-sm">
              <span className="mb-1 block text-[var(--muted)]">Min threshold</span>
              <input
                required
                value={reagentForm.minThresholdQuantity}
                onChange={(e) =>
                  setReagentForm((f) => ({
                    ...f,
                    minThresholdQuantity: e.target.value,
                  }))
                }
                className="w-full border border-[var(--line)] bg-white px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[var(--muted)]">Reorder qty</span>
              <input
                required
                value={reagentForm.reorderQuantity}
                onChange={(e) =>
                  setReagentForm((f) => ({ ...f, reorderQuantity: e.target.value }))
                }
                className="w-full border border-[var(--line)] bg-white px-3 py-2"
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">Barcode (optional)</span>
            <input
              value={reagentForm.barcode}
              onChange={(e) =>
                setReagentForm((f) => ({ ...f, barcode: e.target.value }))
              }
              className="w-full border border-[var(--line)] bg-white px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={busy || !reagentForm.supplierId}
            className="bg-[var(--accent)] px-3 py-2 text-sm text-white disabled:opacity-60"
          >
            Add reagent
          </button>
        </form>

        <form
          className="space-y-2 border border-[var(--line)] p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(
              () =>
                api.createLot({
                  reagentId: lotForm.reagentId,
                  lotNumber: lotForm.lotNumber,
                  currentQuantity: Number(lotForm.currentQuantity),
                  storageLocation: lotForm.storageLocation,
                  expirationDate: lotForm.expirationDate,
                  status: "Active",
                }),
              "Lot created.",
            );
          }}
        >
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            New lot
          </h3>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">Reagent</span>
            <select
              required
              value={lotForm.reagentId}
              onChange={(e) =>
                setLotForm((f) => ({ ...f, reagentId: e.target.value }))
              }
              className="w-full border border-[var(--line)] bg-white px-3 py-2"
            >
              {reagents.map((r) => (
                <option key={r.reagentId} value={r.reagentId}>
                  {r.reagentName}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">Lot number</span>
            <input
              required
              value={lotForm.lotNumber}
              onChange={(e) =>
                setLotForm((f) => ({ ...f, lotNumber: e.target.value }))
              }
              className="w-full border border-[var(--line)] bg-white px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">Quantity</span>
            <input
              required
              value={lotForm.currentQuantity}
              onChange={(e) =>
                setLotForm((f) => ({ ...f, currentQuantity: e.target.value }))
              }
              className="w-full border border-[var(--line)] bg-white px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">Storage location</span>
            <input
              required
              value={lotForm.storageLocation}
              onChange={(e) =>
                setLotForm((f) => ({ ...f, storageLocation: e.target.value }))
              }
              className="w-full border border-[var(--line)] bg-white px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">Expiration date</span>
            <input
              required
              type="date"
              value={lotForm.expirationDate}
              onChange={(e) =>
                setLotForm((f) => ({ ...f, expirationDate: e.target.value }))
              }
              className="w-full border border-[var(--line)] bg-white px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={busy || !lotForm.reagentId}
            className="bg-[var(--accent)] px-3 py-2 text-sm text-white disabled:opacity-60"
          >
            Add lot
          </button>
        </form>
      </div>
    </section>
  );
}
