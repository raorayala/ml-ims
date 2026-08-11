"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Users } from "lucide-react";
import { api, type AuthUser, type UserRole } from "@/lib/api";

type Props = {
  setError: (msg: string | null) => void;
  setNotice: (msg: string | null) => void;
};

export function UserManagement({ setError, setNotice }: Props) {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    fullName: "",
    role: "LAB_USER" as UserRole,
  });

  const refresh = useCallback(async () => {
    setUsers(await api.users());
  }, []);

  useEffect(() => {
    void refresh().catch((err: Error) => setError(err.message));
  }, [refresh, setError]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api.createUser(form);
      setForm({
        username: "",
        email: "",
        password: "",
        fullName: "",
        role: "LAB_USER",
      });
      await refresh();
      setNotice("User created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(user: AuthUser) {
    setBusy(true);
    setError(null);
    try {
      await api.updateUser(user.id, { isActive: !user.isActive });
      await refresh();
      setNotice(
        `${user.username} is now ${user.isActive ? "inactive" : "active"}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(user: AuthUser, role: UserRole) {
    setBusy(true);
    setError(null);
    try {
      await api.updateUser(user.id, { role });
      await refresh();
      setNotice(`${user.username} role set to ${role}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Role update failed");
    } finally {
      setBusy(false);
    }
  }

  async function resetPw(user: AuthUser) {
    const password = window.prompt(
      `New password for ${user.username} (min 8 characters)`,
    );
    if (!password) return;
    setBusy(true);
    setError(null);
    try {
      await api.resetPassword(user.id, password);
      setNotice(`Password reset for ${user.username}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel animate-rise mt-6 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Users size={18} className="text-[var(--accent)]" />
        <h2 className="text-lg font-semibold">User management</h2>
      </div>
      <p className="mb-4 text-sm text-[var(--muted)]">
        Create accounts, assign ADMIN or LAB_USER roles, and reset passwords.
      </p>

      <form
        className="mb-6 grid gap-3 border border-[var(--line)] p-3 md:grid-cols-2 xl:grid-cols-3"
        onSubmit={(e) => void onCreate(e)}
      >
        <label className="text-sm">
          <span className="mb-1 block text-[var(--muted)]">Username</span>
          <input
            required
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            className="w-full border border-[var(--line)] bg-white px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-[var(--muted)]">Email</span>
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="w-full border border-[var(--line)] bg-white px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-[var(--muted)]">Full name</span>
          <input
            required
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
            className="w-full border border-[var(--line)] bg-white px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-[var(--muted)]">Password</span>
          <input
            required
            type="password"
            minLength={8}
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            className="w-full border border-[var(--line)] bg-white px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-[var(--muted)]">Role</span>
          <select
            value={form.role}
            onChange={(e) =>
              setForm((f) => ({ ...f, role: e.target.value as UserRole }))
            }
            className="w-full border border-[var(--line)] bg-white px-3 py-2"
          >
            <option value="LAB_USER">LAB_USER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={busy}
            className="bg-[var(--accent)] px-4 py-2 text-sm text-white hover:bg-[var(--accent-deep)] disabled:opacity-60"
          >
            Create user
          </button>
        </div>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-[var(--muted)]">
            <tr className="border-b border-[var(--line)]">
              <th className="py-2 pr-3 font-medium">User</th>
              <th className="py-2 pr-3 font-medium">Role</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-[var(--line)]/70">
                <td className="py-3 pr-3">
                  <div className="font-medium">{u.fullName}</div>
                  <div className="text-xs text-[var(--muted)]">
                    {u.username} · {u.email}
                  </div>
                </td>
                <td className="py-3 pr-3">
                  <select
                    disabled={busy}
                    value={u.role}
                    onChange={(e) =>
                      void changeRole(u, e.target.value as UserRole)
                    }
                    className="border border-[var(--line)] bg-white px-2 py-1"
                  >
                    <option value="LAB_USER">LAB_USER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </td>
                <td className="py-3 pr-3">
                  <span className="badge">{u.isActive ? "Active" : "Inactive"}</span>
                </td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void toggleActive(u)}
                      className="border border-[var(--line)] bg-white px-2 py-1 text-xs hover:border-[var(--accent)] disabled:opacity-60"
                    >
                      {u.isActive ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void resetPw(u)}
                      className="border border-[var(--line)] bg-white px-2 py-1 text-xs hover:border-[var(--accent)] disabled:opacity-60"
                    >
                      Reset password
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
