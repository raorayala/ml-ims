"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("lab-tech-001");
  const [password, setPassword] = useState("changeme123");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="panel animate-rise p-6">
        <div className="mb-6 flex items-center gap-3">
          <FlaskConical className="text-[var(--accent)]" size={28} />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">ML-IMS</h1>
            <p className="text-sm text-[var(--muted)]">Sign in to continue</p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">Username</span>
            <input
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border border-[var(--line)] bg-white px-3 py-2"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-[var(--line)] bg-white px-3 py-2"
              required
            />
          </label>

          {error ? (
            <p className="border border-[var(--danger)] bg-[#fff5f5] px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-[var(--accent)] px-4 py-2 text-sm text-white hover:bg-[var(--accent-deep)] disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-5 text-xs text-[var(--muted)]">
          Seed accounts (password <code>changeme123</code>):{" "}
          <code>admin</code> (ADMIN), <code>lab-tech-001</code> /{" "}
          <code>lab-tech-002</code> (LAB_USER).
        </p>
      </div>
    </div>
  );
}
