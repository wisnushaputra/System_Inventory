'use client';

import { useState } from 'react';
import {
  IconAlertTriangle,
  IconCheckCircle,
  IconEye,
  IconEyeOff,
  IconKey,
  IconUsers,
} from '@/components/Icons';
import { useFeedback } from '@/components/FeedbackProvider';

export interface ProfileUserInfo {
  id: number;
  name: string;
  username: string;
  email: string | null;
  roleName: string;
  roleDescription: string | null;
  permissionCount: number;
  createdAt: string;
}

export interface ProfileSecurityLog {
  id: number;
  action: string;
  entityType: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface Props {
  user: ProfileUserInfo;
  recentLogs: ProfileSecurityLog[];
}

function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  placeholder: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-ink-secondary mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required
          className="min-h-[44px] w-full rounded-lg border border-line bg-canvas px-3.5 py-2 pr-11 text-sm text-ink placeholder-ink-muted transition-colors focus:border-accent focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent/20"
        />
        <button
          type="button"
          onClick={() => setVisible((prev) => !prev)}
          aria-label={visible ? `Sembunyikan ${label}` : `Tampilkan ${label}`}
          className="absolute right-1 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-md text-ink-muted hover:text-ink"
        >
          {visible ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export function ProfileClient({ user, recentLogs }: Props) {
  const { toast } = useFeedback();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (newPassword.length < 8) {
      setErrorMsg('Kata sandi baru minimal 8 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Konfirmasi kata sandi baru tidak cocok.');
      return;
    }
    if (newPassword === currentPassword) {
      setErrorMsg('Kata sandi baru harus berbeda dengan kata sandi saat ini.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/profile/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = json?.message || 'Gagal memperbarui kata sandi.';
        setErrorMsg(msg);
        toast.error(msg);
        return;
      }

      const okMsg = json?.message || 'Kata sandi akun berhasil diperbarui.';
      setSuccessMsg(okMsg);
      toast.success(okMsg);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      const msg = 'Tidak dapat terhubung ke server.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="animate-enter">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Profil & Keamanan Akun</h1>
        <p className="text-sm text-ink-secondary mt-1">
          Informasi akun operasional, penggantian kata sandi mandiri, serta ringkasan aktivitas login terbaru.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Account Overview */}
        <section
          aria-labelledby="profile-account-heading"
          className="lg:col-span-5 rounded-xl border border-line bg-surface p-5 shadow-xs space-y-4"
        >
          <div className="flex items-center gap-3 border-b border-line pb-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
              <IconUsers className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 id="profile-account-heading" className="truncate text-base font-bold text-ink">
                {user.name}
              </h2>
              <p className="truncate font-mono text-xs text-ink-muted">@{user.username}</p>
            </div>
          </div>

          <dl className="grid grid-cols-1 gap-3 text-xs">
            <div className="flex items-center justify-between gap-3 border-b border-line/60 pb-2.5">
              <dt className="text-ink-muted">Email</dt>
              <dd className="font-medium text-ink truncate">{user.email || '-'}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-line/60 pb-2.5">
              <dt className="text-ink-muted">Peran Sistem</dt>
              <dd>
                <span className="inline-flex items-center gap-1 rounded-md border border-accent/30 bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-ink">
                  <IconKey className="h-3 w-3" />
                  {user.roleName}
                </span>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-line/60 pb-2.5">
              <dt className="text-ink-muted">Hak Akses Aktif</dt>
              <dd className="font-mono font-semibold text-ink tabular-nums-data">
                {user.permissionCount} izin
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-muted">Terdaftar Sejak</dt>
              <dd className="font-mono text-ink-secondary tabular-nums-data">
                {new Date(user.createdAt).toLocaleDateString('id-ID', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </dd>
            </div>
          </dl>

          {user.roleDescription && (
            <p className="rounded-lg border border-line bg-subtle/60 p-3 text-xs text-ink-secondary">
              {user.roleDescription}
            </p>
          )}
        </section>

        {/* Self-Service Password Change */}
        <section
          aria-labelledby="profile-password-heading"
          className="lg:col-span-7 rounded-xl border border-line bg-surface p-5 shadow-xs space-y-4"
        >
          <div className="border-b border-line pb-3">
            <h2 id="profile-password-heading" className="text-base font-bold text-ink">
              Ubah Kata Sandi Mandiri
            </h2>
            <p className="text-xs text-ink-secondary mt-0.5">
              Gunakan kombinasi minimal 8 karakter yang kuat dan belum pernah dipakai sebelumnya.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <PasswordInput
              id="profile-current-pw"
              label="Kata Sandi Saat Ini"
              value={currentPassword}
              onChange={setCurrentPassword}
              autoComplete="current-password"
              placeholder="Masukkan kata sandi saat ini"
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <PasswordInput
                id="profile-new-pw"
                label="Kata Sandi Baru"
                value={newPassword}
                onChange={setNewPassword}
                autoComplete="new-password"
                placeholder="Minimal 8 karakter"
              />
              <PasswordInput
                id="profile-confirm-pw"
                label="Konfirmasi Kata Sandi Baru"
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
                placeholder="Ulangi kata sandi baru"
              />
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/60 p-3 text-xs font-medium text-rose-800 dark:text-rose-200"
              >
                <IconAlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div
                role="status"
                className="flex items-start gap-2 rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/60 p-3 text-xs font-medium text-emerald-800 dark:text-emerald-200"
              >
                <IconCheckCircle className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={busy}
                className="min-h-[44px] rounded-lg bg-accent px-5 py-2 text-xs font-semibold text-accent-fg shadow-xs transition-colors hover:bg-accent-hover disabled:opacity-50"
              >
                {busy ? 'Menyimpan Kata Sandi...' : 'Simpan Kata Sandi Baru'}
              </button>
            </div>
          </form>
        </section>
      </div>

      {/* Recent Security & Login Activity */}
      <section
        aria-labelledby="profile-activity-heading"
        className="rounded-xl border border-line bg-surface shadow-xs overflow-hidden text-xs"
      >
        <div className="border-b border-line px-5 py-4">
          <h2 id="profile-activity-heading" className="text-base font-bold text-ink">
            Aktivitas Masuk & Keamanan Terakhir
          </h2>
          <p className="text-xs text-ink-secondary mt-0.5">
            Menampilkan maksimal 10 catatan login, logout, dan pembaruan akun terakhir Anda.
          </p>
        </div>

        {recentLogs.length === 0 ? (
          <div className="p-6 text-center text-ink-secondary">
            Belum ada riwayat aktivitas keamanan tercatat untuk akun ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left divide-y divide-line">
              <thead className="bg-subtle text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Waktu</th>
                  <th className="py-3 px-4">Aktivitas</th>
                  <th className="py-3 px-4">Alamat IP</th>
                  <th className="py-3 px-4">Perangkat / User Agent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {recentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-subtle/50">
                    <td className="py-3 px-4 font-mono text-[11px] text-ink-secondary whitespace-nowrap tabular-nums-data">
                      {new Date(log.createdAt).toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-block rounded border border-line bg-subtle px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-ink">
                      {log.ipAddress || '-'}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-ink-muted max-w-md truncate">
                      {log.userAgent || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
