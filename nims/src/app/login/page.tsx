'use client';

import { useState } from 'react';
import { ThemeToggle } from '@/components/ThemeProvider';
import {
  PassnetBrandMark,
  PassnetWordmark,
  IconEye,
  IconEyeOff,
  IconAlertTriangle,
  IconServer,
  IconSubnetGlobe,
  IconTopology,
  IconAudit,
} from '@/components/Icons';

export default function LoginPage() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const form = new FormData(e.currentTarget);
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.get('username'),
          password: form.get('password'),
        }),
      });
      if (res.ok) {
        window.location.assign('/dashboard');
      } else if (res.status === 429) {
        setError('Terlalu banyak percobaan gagal. Coba kembali beberapa saat lagi.');
        setBusy(false);
      } else {
        setError('Username atau kata sandi tidak sesuai.');
        setBusy(false);
      }
    } catch {
      setError('Tidak dapat terhubung ke server. Periksa koneksi jaringan.');
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-canvas text-ink flex flex-col lg:grid lg:grid-cols-12">
      {/* Left Architectural Identity Panel */}
      <section
        aria-label="Informasi Passnet Inventory Sistem"
        className="relative hidden lg:col-span-6 lg:flex lg:flex-col lg:justify-between bg-[#0F1E36] dark:bg-[#0B1526] text-white p-10 xl:p-14 border-r border-blue-900/40"
      >
        <div className="flex flex-wrap items-center gap-3.5">
          <div className="inline-flex items-center rounded-xl bg-white px-3.5 py-2 shadow-sm">
            <PassnetWordmark className="h-9 w-auto" alt="Logo Passnet" />
          </div>
          <div>
            <p className="text-base font-bold tracking-tight text-white">
              Passnet Inventory Sistem
            </p>
            <p className="text-xs font-mono text-blue-200">
              Network Inventory Management System
            </p>
          </div>
        </div>

        <div className="my-auto max-w-lg space-y-8 animate-enter">
          <div className="space-y-3">
            <h2 className="text-3xl font-bold tracking-tight leading-tight text-white">
              Dokumentasi infrastruktur jaringan dalam satu pusat kerja.
            </h2>
            <p className="text-sm leading-relaxed text-slate-200">
              Catat aset perangkat per POP dan lokasi pelanggan, lacak alokasi subnet IP, petakan relasi kabel antarport, dan simpan jejak perubahan secara tertib.
            </p>
          </div>

          {/* Schematic Node Topology Diagram (direct visual connection to hierarchy) */}
          <div className="rounded-xl border border-blue-700/50 bg-[#0B172B] p-5">
            <p className="mb-3 text-[11px] font-mono uppercase tracking-wider text-blue-200">
              Struktur Hierarki Terkelola
            </p>
            <svg
              viewBox="0 0 380 110"
              className="w-full h-auto"
              role="img"
              aria-label="Diagram alur POP ke Site Pelanggan dan Perangkat"
            >
              <line x1="88" y1="55" x2="152" y2="30" stroke="#93C5FD" strokeWidth="1.75" />
              <line x1="88" y1="55" x2="152" y2="80" stroke="#93C5FD" strokeWidth="1.75" strokeDasharray="4 3" />
              <line x1="238" y1="30" x2="292" y2="30" stroke="#93C5FD" strokeWidth="1.75" />
              <line x1="238" y1="80" x2="292" y2="80" stroke="#93C5FD" strokeWidth="1.75" />

              <rect x="8" y="37" width="80" height="36" rx="6" fill="#1E3A8A" stroke="#60A5FA" strokeWidth="1.5" />
              <text x="48" y="59" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="600" fontFamily="monospace">
                POP Induk
              </text>

              <rect x="152" y="12" width="86" height="36" rx="6" fill="#172554" stroke="#93C5FD" strokeWidth="1.2" />
              <text x="195" y="34" textAnchor="middle" fill="#EFF6FF" fontSize="11" fontWeight="500" fontFamily="sans-serif">
                Site A
              </text>

              <rect x="152" y="62" width="86" height="36" rx="6" fill="#172554" stroke="#93C5FD" strokeWidth="1.2" />
              <text x="195" y="84" textAnchor="middle" fill="#EFF6FF" fontSize="11" fontWeight="500" fontFamily="sans-serif">
                Site B
              </text>

              <rect x="292" y="12" width="80" height="36" rx="6" fill="#0F172A" stroke="#BFDBFE" strokeWidth="1.2" />
              <text x="332" y="34" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontFamily="monospace">
                Router
              </text>

              <rect x="292" y="62" width="80" height="36" rx="6" fill="#0F172A" stroke="#BFDBFE" strokeWidth="1.2" />
              <text x="332" y="84" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontFamily="monospace">
                Switch
              </text>
            </svg>
          </div>

          <ul className="grid grid-cols-2 gap-3 text-xs text-slate-200">
            <li className="flex items-center gap-2.5">
              <IconServer className="h-4 w-4 shrink-0 text-blue-300" />
              <span>Inventaris perangkat per site</span>
            </li>
            <li className="flex items-center gap-2.5">
              <IconSubnetGlobe className="h-4 w-4 shrink-0 text-blue-300" />
              <span>Alokasi IPAM dan validasi CIDR</span>
            </li>
            <li className="flex items-center gap-2.5">
              <IconTopology className="h-4 w-4 shrink-0 text-blue-300" />
              <span>Graf topologi port terhubung</span>
            </li>
            <li className="flex items-center gap-2.5">
              <IconAudit className="h-4 w-4 shrink-0 text-blue-300" />
              <span>Catatan audit perubahan data</span>
            </li>
          </ul>
        </div>

        <p className="text-xs text-blue-200/90 font-mono">
          Akses berbasis peran: Admin, Network Engineer, Operator NOC, Supervisor.
        </p>
      </section>

      {/* Right Sign-in Column */}
      <div className="relative flex flex-1 flex-col justify-between p-5 sm:p-8 lg:col-span-6">
        <header className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 lg:hidden">
            <PassnetBrandMark className="h-8 w-8 shrink-0" />
            <span className="truncate text-sm font-bold tracking-tight text-ink">
              Passnet Inventory Sistem
            </span>
          </div>
          <div className="ml-auto shrink-0">
            <ThemeToggle />
          </div>
        </header>

        <main className="mx-auto my-auto w-full max-w-md py-8 animate-enter">
          <div className="rounded-xl border border-line bg-surface p-6 sm:p-8 shadow-sm">
            <div className="space-y-1.5 border-b border-line pb-5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
                Masuk ke Passnet Inventory Sistem
              </h1>
              <p className="text-sm text-ink-secondary">
                Masukkan kredensial akun operasional Anda untuk membuka inventaris jaringan.
              </p>
            </div>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="login-username"
                  className="block text-xs font-semibold text-ink-secondary mb-1.5"
                >
                  Username
                </label>
                <input
                  id="login-username"
                  name="username"
                  type="text"
                  placeholder="Masukkan username akun"
                  autoComplete="username"
                  required
                  className="min-h-[44px] w-full rounded-lg border border-line bg-canvas px-3.5 py-2 text-sm text-ink placeholder-ink-muted transition-[border-color,background-color] duration-150 focus:border-accent focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold text-ink-secondary mb-1.5"
                >
                  Kata Sandi
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Masukkan kata sandi"
                    autoComplete="current-password"
                    required
                    className="min-h-[44px] w-full rounded-lg border border-line bg-canvas px-3.5 py-2 pr-11 text-sm text-ink placeholder-ink-muted transition-[border-color,background-color] duration-150 focus:border-accent focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                    className="absolute right-1 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-md text-ink-muted transition-colors duration-150 hover:text-ink"
                  >
                    {showPassword ? (
                      <IconEyeOff className="h-4 w-4" />
                    ) : (
                      <IconEye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/60 p-3 text-xs font-medium text-rose-800 dark:text-rose-200"
                >
                  <IconAlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="min-h-[44px] w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg shadow-xs transition-[background-color,transform] duration-150 hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50"
              >
                {busy ? 'Memverifikasi sesi...' : 'Masuk ke Ruang Kerja'}
              </button>
            </form>
          </div>
        </main>

        <footer className="text-center text-xs text-ink-muted">
          Passnet Inventory Sistem - Portal Inventaris Jaringan Internal
        </footer>
      </div>
    </div>
  );
}
