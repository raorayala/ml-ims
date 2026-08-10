"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Camera, CameraOff } from "lucide-react";
import type { Html5Qrcode } from "html5-qrcode";

type Props = {
  onScan: (value: string) => void;
};

export function BarcodeScanner({ onScan }: Props) {
  const regionId = useId().replace(/:/g, "");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      void scannerRef.current?.stop().catch(() => undefined);
      scannerRef.current?.clear();
    };
  }, []);

  async function start() {
    setError(null);
    try {
      const { Html5Qrcode: Scanner } = await import("html5-qrcode");
      const scanner = new Scanner(regionId);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 140 } },
        (decoded) => {
          onScan(decoded);
          void stop();
        },
        () => undefined,
      );
      setActive(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Camera unavailable");
      setActive(false);
    }
  }

  async function stop() {
    try {
      await scannerRef.current?.stop();
      scannerRef.current?.clear();
    } catch {
      // ignore stop races
    } finally {
      scannerRef.current = null;
      setActive(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--muted)]">
          Scan a reagent barcode / lot QR to autofill check-out.
        </p>
        <button
          type="button"
          onClick={() => void (active ? stop() : start())}
          className="inline-flex items-center gap-2 border border-[var(--line)] bg-white px-3 py-2 text-sm hover:border-[var(--accent)]"
        >
          {active ? <CameraOff size={16} /> : <Camera size={16} />}
          {active ? "Stop scanner" : "Start scanner"}
        </button>
      </div>
      <div
        id={regionId}
        className="min-h-[180px] w-full overflow-hidden border border-dashed border-[var(--line)] bg-black/5"
      />
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
