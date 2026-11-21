'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  IconPlus,
  IconSearch,
  IconCheckCircle,
  IconAlertTriangle,
  IconEdit,
  IconKey,
  IconTrash,
  IconClose,
} from '@/components/Icons';

interface RoleOption {
  id: number;
  name: string;
  description: string | null;
}

interface UserItem {
  id: number;
  name: string;
  username: string;
  email: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  roleId: number;
  role: { id: number; name: string; description: string | null };
  createdAt: string;
  updatedAt: string;
}

interface Props {
  initialRoles: RoleOption[];
  currentUserId: number;
}

export function UserListClient({ initialRoles, currentUserId }: Props) {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [q, setQ] = useState('');
  const [roleIdFilter, setRoleIdFilter] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    roleId: initialRoles[0]?.id || 1,
    isActive: true,
  });
  const [addError, setAddError] = useState<string | null>(null);
  const [submittingAdd, setSubmittingAdd] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editTarget, setEditTarget] = useState<UserItem | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    roleId: 1,
    isActive: true,
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [submittingEdit, setSubmittingEdit] = useState(false);

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserItem | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [submittingReset, setSubmittingReset] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [submittingDelete, setSubmittingDelete] = useState(false);

  useEffect(() => {
    const anyModal = showAddModal || showEditModal || showResetModal || showDeleteModal;
    if (!anyModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAddModal(false);
        setShowEditModal(false);
        setShowResetModal(false);
        setShowDeleteModal(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showAddModal, showEditModal, showResetModal, showDeleteModal]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '10');
      if (q.trim()) params.set('q', q.trim());
      if (roleIdFilter) params.set('roleId', roleIdFilter);
      if (isActiveFilter !== '') params.set('isActive', isActiveFilter);

      const res = await fetch(`/api/users?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Gagal memuat data pengguna');
      }
      const data = await res.json();
      setUsers(data.data || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotalCount(data.pagination?.total || 0);
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setLoading(false);
    }
  }, [page, q, roleIdFilter, isActiveFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  const handleOpenAdd = () => {
    setAddForm({
      name: '',
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      roleId: initialRoles[0]?.id || 1,
      isActive: true,
    });
    setAddError(null);
    setShowAddModal(true);
  };

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    if (addForm.password !== addForm.confirmPassword) {
      setAddError('Konfirmasi kata sandi tidak cocok.');
      return;
    }
    if (addForm.password.length < 8) {
      setAddError('Kata sandi harus minimal 8 karakter.');
      return;
    }

    setSubmittingAdd(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: window.location.origin,
        },
        body: JSON.stringify({
          name: addForm.name,
          username: addForm.username,
          email: addForm.email || null,
          password: addForm.password,
          roleId: Number(addForm.roleId),
          isActive: addForm.isActive,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Gagal menambahkan pengguna baru.');
      }

      setShowAddModal(false);
      setSuccessMsg(`Pengguna '${data.data.username}' berhasil dibuat.`);
      fetchUsers();
    } catch (err: any) {
      setAddError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setSubmittingAdd(false);
    }
  };

  const handleOpenEdit = (user: UserItem) => {
    setEditTarget(user);
    setEditForm({
      name: user.name,
      email: user.email || '',
      roleId: user.roleId,
      isActive: user.isActive,
    });
    setEditError(null);
    setShowEditModal(true);
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditError(null);
    setSubmittingEdit(true);

    try {
      const res = await fetch(`/api/users/${editTarget.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Origin: window.location.origin,
        },
        body: JSON.stringify({
          name: editForm.name,
          email: editForm.email || null,
          roleId: Number(editForm.roleId),
          isActive: editForm.isActive,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Gagal memperbarui pengguna.');
      }

      setShowEditModal(false);
      setSuccessMsg(`Data pengguna '${editTarget.username}' berhasil diperbarui.`);
      fetchUsers();
    } catch (err: any) {
      setEditError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleOpenReset = (user: UserItem) => {
    setResetTarget(user);
    setResetPassword('');
    setResetConfirm('');
    setResetError(null);
    setShowResetModal(true);
  };

  const handleSubmitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    setResetError(null);

    if (resetPassword !== resetConfirm) {
      setResetError('Konfirmasi kata sandi tidak cocok.');
      return;
    }
    if (resetPassword.length < 8) {
      setResetError('Kata sandi baru minimal 8 karakter.');
      return;
    }

    setSubmittingReset(true);
    try {
      const res = await fetch(`/api/users/${resetTarget.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: window.location.origin,
        },
        body: JSON.stringify({
          newPassword: resetPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Gagal mereset kata sandi.');
      }

      setShowResetModal(false);
      setSuccessMsg(`Kata sandi untuk '${resetTarget.username}' berhasil diperbarui.`);
    } catch (err: any) {
      setResetError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setSubmittingReset(false);
    }
  };

  const handleOpenDelete = (user: UserItem) => {
    setDeleteTarget(user);
    setDeleteError(null);
    setShowDeleteModal(true);
  };

  const handleSubmitDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    setSubmittingDelete(true);

    try {
      const res = await fetch(`/api/users/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: {
          Origin: window.location.origin,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Gagal menghapus pengguna.');
      }

      setShowDeleteModal(false);
      setSuccessMsg(`Pengguna '${deleteTarget.username}' berhasil dihapus.`);
      fetchUsers();
    } catch (err: any) {
      setDeleteError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setSubmittingDelete(false);
    }
  };

  const getRoleBadgeClass = (roleName: string) => {
    switch (roleName.toLowerCase()) {
      case 'admin':
        return 'bg-accent-soft text-accent-ink border-accent/30';
      case 'network engineer':
        return 'bg-sky-50 text-sky-900 border-sky-200 dark:bg-sky-950/70 dark:text-sky-300 dark:border-sky-800';
      case 'operator noc':
        return 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800';
      case 'supervisor':
        return 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800';
      default:
        return 'bg-subtle text-ink-secondary border-line';
    }
  };

  return (
    <div className="space-y-6">
      <div className="animate-enter flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Manajemen Pengguna</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Kelola akun personel, pembagian peran kerja, status aktif, dan reset kata sandi akses sistem.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenAdd}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs sm:text-sm font-semibold text-accent-fg shadow-xs transition-[background-color,transform] duration-150 hover:bg-accent-hover active:scale-[0.97]"
        >
          <IconPlus className="h-4 w-4" />
          <span>Tambah Pengguna</span>
        </button>
      </div>

      {successMsg && (
        <div
          role="status"
          className="animate-enter rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/60 p-4 text-xs sm:text-sm text-emerald-900 dark:text-emerald-200 shadow-xs flex items-center gap-2.5"
        >
          <IconCheckCircle className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/60 p-4 text-xs sm:text-sm text-rose-900 dark:text-rose-200 shadow-xs flex items-center gap-2.5"
        >
          <IconAlertTriangle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="animate-enter stagger-1 rounded-xl border border-line bg-surface p-4 shadow-xs">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label
              htmlFor="search-input"
              className="block text-xs font-semibold uppercase tracking-wider text-ink-secondary"
            >
              Pencarian
            </label>
            <div className="relative mt-1.5">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
              <input
                id="search-input"
                type="text"
                placeholder="Cari berdasarkan nama, username, atau email..."
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                className="min-h-[42px] w-full rounded-lg border border-line bg-canvas pl-9 pr-3.5 text-sm text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="role-select"
              className="block text-xs font-semibold uppercase tracking-wider text-ink-secondary"
            >
              Filter Peran
            </label>
            <select
              id="role-select"
              value={roleIdFilter}
              onChange={(e) => {
                setRoleIdFilter(e.target.value);
                setPage(1);
              }}
              className="mt-1.5 min-h-[42px] w-full rounded-lg border border-line bg-canvas px-3 text-sm text-ink focus:border-accent focus:outline-none"
            >
              <option value="">Semua Peran</option>
              {initialRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="status-select"
              className="block text-xs font-semibold uppercase tracking-wider text-ink-secondary"
            >
              Status Akun
            </label>
            <select
              id="status-select"
              value={isActiveFilter}
              onChange={(e) => {
                setIsActiveFilter(e.target.value);
                setPage(1);
              }}
              className="mt-1.5 min-h-[42px] w-full rounded-lg border border-line bg-canvas px-3 text-sm text-ink focus:border-accent focus:outline-none"
            >
              <option value="">Semua Status</option>
              <option value="true">Aktif</option>
              <option value="false">Nonaktif</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="animate-enter stagger-2 overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-line text-left text-sm">
            <thead className="bg-subtle text-xs font-semibold uppercase tracking-wider text-ink-secondary">
              <tr>
                <th scope="col" className="px-5 py-3.5">
                  Nama & Username
                </th>
                <th scope="col" className="px-5 py-3.5">
                  Email
                </th>
                <th scope="col" className="px-5 py-3.5">
                  Peran
                </th>
                <th scope="col" className="px-5 py-3.5">
                  Status
                </th>
                <th scope="col" className="px-5 py-3.5">
                  Terakhir Login
                </th>
                <th scope="col" className="px-5 py-3.5 text-right">
                  Tindakan
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-surface">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-ink-secondary">
                    Memuat data pengguna...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-ink-secondary">
                    Tidak ada data pengguna yang cocok dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const isSelf = user.id === currentUserId;
                  return (
                    <tr key={user.id} className="transition-colors duration-100 hover:bg-subtle/60">
                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="font-semibold text-ink flex items-center gap-2">
                          <span>{user.name}</span>
                          {isSelf && (
                            <span className="inline-flex items-center rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-semibold text-accent-ink">
                              Akun Anda
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-xs text-ink-muted">@{user.username}</div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-xs text-ink-secondary">
                        {user.email || <span className="text-ink-muted italic">Tidak ada email</span>}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <span
                          className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold ${getRoleBadgeClass(
                            user.role.name
                          )}`}
                        >
                          {user.role.name}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        {user.isActive ? (
                          <span className="inline-flex items-center rounded-md bg-emerald-100 dark:bg-emerald-950/70 px-2.5 py-0.5 text-xs font-semibold text-emerald-900 dark:text-emerald-300">
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-subtle px-2.5 py-0.5 text-xs font-semibold text-ink-secondary">
                            Nonaktif
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-xs font-mono text-ink-muted tabular-nums-data">
                        {user.lastLoginAt ? (
                          new Date(user.lastLoginAt).toLocaleString('id-ID', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })
                        ) : (
                          <span className="font-sans italic text-ink-muted">Belum pernah login</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(user)}
                            className="inline-flex items-center gap-1 rounded-md border border-line bg-canvas px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-subtle"
                            title="Edit Data Pengguna"
                          >
                            <IconEdit className="h-3.5 w-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenReset(user)}
                            className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-2.5 py-1.5 text-xs font-semibold text-accent-ink hover:opacity-90"
                            title="Reset Kata Sandi"
                          >
                            <IconKey className="h-3.5 w-3.5" />
                            <span>Reset Password</span>
                          </button>
                          {isSelf ? (
                            <button
                              type="button"
                              disabled
                              className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-ink-muted opacity-40"
                              title="Anda tidak dapat menghapus akun Anda sendiri"
                            >
                              <IconTrash className="h-3.5 w-3.5" />
                              <span>Hapus</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenDelete(user)}
                              className="inline-flex items-center gap-1 rounded-md bg-rose-50 dark:bg-rose-950/60 px-2.5 py-1.5 text-xs font-medium text-rose-800 dark:text-rose-200 hover:bg-rose-100 dark:hover:bg-rose-900/60"
                              title="Hapus Pengguna"
                            >
                              <IconTrash className="h-3.5 w-3.5" />
                              <span>Hapus</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-subtle/50 px-5 py-3 text-xs text-ink-secondary">
          <div className="tabular-nums-data">
            Total <span className="font-semibold text-ink">{totalCount}</span> pengguna
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="min-h-[36px] rounded-md border border-line bg-surface px-3 py-1 font-medium text-ink hover:bg-subtle disabled:opacity-40"
            >
              Sebelumnya
            </button>
            <span className="tabular-nums-data">
              Halaman {page} dari {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="min-h-[36px] rounded-md border border-line bg-surface px-3 py-1 font-medium text-ink hover:bg-subtle disabled:opacity-40"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Tambah Pengguna */}
      {showAddModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-user-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 animate-backdrop"
        >
          <div className="w-full max-w-lg rounded-xl border border-line bg-elevated p-6 shadow-2xl animate-modal">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 id="add-user-title" className="text-lg font-bold text-ink">
                Tambah Pengguna Baru
              </h2>
              <button
                type="button"
                aria-label="Tutup dialog"
                onClick={() => setShowAddModal(false)}
                className="flex h-9 w-9 items-center justify-center rounded-md text-ink-muted hover:bg-subtle hover:text-ink"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>

            {addError && (
              <div className="mt-4 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/60 p-3 text-xs text-rose-800 dark:text-rose-200">
                {addError}
              </div>
            )}

            <form onSubmit={handleSubmitAdd} className="mt-4 space-y-4">
              <div>
                <label htmlFor="add-name" className="block text-xs font-semibold text-ink-secondary">
                  Nama Lengkap *
                </label>
                <input
                  id="add-name"
                  type="text"
                  required
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  placeholder="Nama lengkap staf"
                  className="mt-1 min-h-[40px] w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="add-username" className="block text-xs font-semibold text-ink-secondary">
                    Username *
                  </label>
                  <input
                    id="add-username"
                    type="text"
                    required
                    value={addForm.username}
                    onChange={(e) => setAddForm({ ...addForm, username: e.target.value })}
                    placeholder="misal: noc_operator2"
                    className="mt-1 min-h-[40px] w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                  <p className="mt-0.5 text-[11px] text-ink-muted">Huruf, angka, _ atau -</p>
                </div>
                <div>
                  <label htmlFor="add-email" className="block text-xs font-semibold text-ink-secondary">
                    Email
                  </label>
                  <input
                    id="add-email"
                    type="email"
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                    placeholder="email@perusahaan.co.id"
                    className="mt-1 min-h-[40px] w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="add-role" className="block text-xs font-semibold text-ink-secondary">
                  Peran (Role) *
                </label>
                <select
                  id="add-role"
                  value={addForm.roleId}
                  onChange={(e) => setAddForm({ ...addForm, roleId: Number(e.target.value) })}
                  className="mt-1 min-h-[40px] w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                >
                  {initialRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} {r.description ? `(${r.description})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="add-pw" className="block text-xs font-semibold text-ink-secondary">
                    Kata Sandi Awal *
                  </label>
                  <input
                    id="add-pw"
                    type="password"
                    required
                    minLength={8}
                    value={addForm.password}
                    onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                    placeholder="Minimal 8 karakter"
                    className="mt-1 min-h-[40px] w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                <div>
                  <label htmlFor="add-pw-confirm" className="block text-xs font-semibold text-ink-secondary">
                    Konfirmasi Kata Sandi *
                  </label>
                  <input
                    id="add-pw-confirm"
                    type="password"
                    required
                    minLength={8}
                    value={addForm.confirmPassword}
                    onChange={(e) => setAddForm({ ...addForm, confirmPassword: e.target.value })}
                    placeholder="Ulangi kata sandi"
                    className="mt-1 min-h-[40px] w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  id="add-is-active"
                  type="checkbox"
                  checked={addForm.isActive}
                  onChange={(e) => setAddForm({ ...addForm, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-line-strong text-accent focus:ring-accent"
                />
                <label htmlFor="add-is-active" className="text-sm font-medium text-ink">
                  Status akun aktif (dapat langsung login)
                </label>
              </div>

              <div className="flex justify-end gap-3 border-t border-line pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="min-h-[40px] rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-subtle hover:text-ink"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingAdd}
                  className="min-h-[40px] rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:bg-accent-hover disabled:opacity-50"
                >
                  {submittingAdd ? 'Menyimpan...' : 'Simpan Pengguna'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Pengguna */}
      {showEditModal && editTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-user-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 animate-backdrop"
        >
          <div className="w-full max-w-lg rounded-xl border border-line bg-elevated p-6 shadow-2xl animate-modal">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h2 id="edit-user-title" className="text-lg font-bold text-ink">
                  Edit Pengguna
                </h2>
                <p className="text-xs font-mono text-ink-muted">@{editTarget.username}</p>
              </div>
              <button
                type="button"
                aria-label="Tutup dialog"
                onClick={() => setShowEditModal(false)}
                className="flex h-9 w-9 items-center justify-center rounded-md text-ink-muted hover:bg-subtle hover:text-ink"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>

            {editError && (
              <div className="mt-4 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/60 p-3 text-xs text-rose-800 dark:text-rose-200">
                {editError}
              </div>
            )}

            <form onSubmit={handleSubmitEdit} className="mt-4 space-y-4">
              <div>
                <label htmlFor="edit-name" className="block text-xs font-semibold text-ink-secondary">
                  Nama Lengkap *
                </label>
                <input
                  id="edit-name"
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="mt-1 min-h-[40px] w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>

              <div>
                <label htmlFor="edit-email" className="block text-xs font-semibold text-ink-secondary">
                  Email
                </label>
                <input
                  id="edit-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  placeholder="opsional@perusahaan.co.id"
                  className="mt-1 min-h-[40px] w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>

              <div>
                <label htmlFor="edit-role" className="block text-xs font-semibold text-ink-secondary">
                  Peran (Role) *
                </label>
                <select
                  id="edit-role"
                  value={editForm.roleId}
                  disabled={editTarget.id === currentUserId}
                  onChange={(e) => setEditForm({ ...editForm, roleId: Number(e.target.value) })}
                  className="mt-1 min-h-[40px] w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink disabled:bg-subtle disabled:text-ink-muted focus:border-accent focus:outline-none"
                >
                  {initialRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                {editTarget.id === currentUserId && (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                    Anda tidak dapat mengubah peran akun Anda sendiri.
                  </p>
                )}
              </div>

              <div className="pt-1">
                <div className="flex items-center gap-2">
                  <input
                    id="edit-is-active"
                    type="checkbox"
                    disabled={editTarget.id === currentUserId}
                    checked={editForm.isActive}
                    onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                    className="h-4 w-4 rounded border-line-strong text-accent focus:ring-accent disabled:opacity-50"
                  />
                  <label htmlFor="edit-is-active" className="text-sm font-medium text-ink">
                    Status akun aktif
                  </label>
                </div>
                {editTarget.id === currentUserId && (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                    Anda tidak dapat menonaktifkan akun Anda sendiri yang sedang aktif.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3 border-t border-line pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="min-h-[40px] rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-subtle hover:text-ink"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="min-h-[40px] rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:bg-accent-hover disabled:opacity-50"
                >
                  {submittingEdit ? 'Menyimpan...' : 'Perbarui Pengguna'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reset Password */}
      {showResetModal && resetTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-pw-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 animate-backdrop"
        >
          <div className="w-full max-w-md rounded-xl border border-line bg-elevated p-6 shadow-2xl animate-modal">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h2 id="reset-pw-title" className="text-lg font-bold text-ink">
                  Reset Kata Sandi
                </h2>
                <p className="text-xs text-ink-muted">
                  Pengguna: {resetTarget.name} (@{resetTarget.username})
                </p>
              </div>
              <button
                type="button"
                aria-label="Tutup dialog"
                onClick={() => setShowResetModal(false)}
                className="flex h-9 w-9 items-center justify-center rounded-md text-ink-muted hover:bg-subtle hover:text-ink"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>

            {resetError && (
              <div className="mt-4 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/60 p-3 text-xs text-rose-800 dark:text-rose-200">
                {resetError}
              </div>
            )}

            <form onSubmit={handleSubmitReset} className="mt-4 space-y-4">
              <div>
                <label htmlFor="reset-new-pw" className="block text-xs font-semibold text-ink-secondary">
                  Kata Sandi Baru *
                </label>
                <input
                  id="reset-new-pw"
                  type="password"
                  required
                  minLength={8}
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Minimal 8 karakter"
                  className="mt-1 min-h-[40px] w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>

              <div>
                <label htmlFor="reset-confirm-pw" className="block text-xs font-semibold text-ink-secondary">
                  Konfirmasi Kata Sandi Baru *
                </label>
                <input
                  id="reset-confirm-pw"
                  type="password"
                  required
                  minLength={8}
                  value={resetConfirm}
                  onChange={(e) => setResetConfirm(e.target.value)}
                  placeholder="Ulangi kata sandi baru"
                  className="mt-1 min-h-[40px] w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-line pt-4">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="min-h-[40px] rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-subtle hover:text-ink"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingReset}
                  className="min-h-[40px] rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:bg-accent-hover disabled:opacity-50"
                >
                  {submittingReset ? 'Memproses...' : 'Simpan Kata Sandi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Konfirmasi Hapus */}
      {showDeleteModal && deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-user-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 animate-backdrop"
        >
          <div className="w-full max-w-md rounded-xl border border-line bg-elevated p-6 shadow-2xl animate-modal">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 id="delete-user-title" className="text-lg font-bold text-rose-700 dark:text-rose-300">
                Konfirmasi Hapus Pengguna
              </h2>
              <button
                type="button"
                aria-label="Tutup dialog"
                onClick={() => setShowDeleteModal(false)}
                className="flex h-9 w-9 items-center justify-center rounded-md text-ink-muted hover:bg-subtle hover:text-ink"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>

            {deleteError && (
              <div className="mt-4 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/60 p-3 text-xs text-rose-800 dark:text-rose-200">
                {deleteError}
              </div>
            )}

            <div className="mt-4 text-sm text-ink-secondary">
              Apakah Anda yakin ingin menghapus pengguna{' '}
              <span className="font-semibold text-ink">{deleteTarget.name}</span> (username:{' '}
              <span className="font-mono text-ink">@{deleteTarget.username}</span>)?
              <p className="mt-2 text-xs text-ink-muted">
                Tindakan ini permanen. Seluruh log riwayat audit lampau tetap tersimpan untuk menjaga akuntabilitas sistem.
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-line pt-4">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="min-h-[40px] rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-subtle hover:text-ink"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSubmitDelete}
                disabled={submittingDelete}
                className="min-h-[40px] rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
              >
                {submittingDelete ? 'Menghapus...' : 'Ya, Hapus Pengguna'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
