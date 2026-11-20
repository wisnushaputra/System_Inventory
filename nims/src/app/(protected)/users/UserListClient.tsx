'use client';

import { useState, useCallback, useEffect } from 'react';

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

  // Flash message auto clear
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
          'Origin': window.location.origin,
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
          'Origin': window.location.origin,
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
          'Origin': window.location.origin,
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
          'Origin': window.location.origin,
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
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'network engineer':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'operator noc':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'supervisor':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Heading */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Manajemen Pengguna</h1>
          <p className="mt-1 text-sm text-slate-500">
            Kelola akun personel, pembagian peran kerja, status aktif, dan reset kata sandi akses sistem.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Tambah Pengguna
        </button>
      </div>

      {/* Global Alerts */}
      {successMsg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 shadow-sm">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">{successMsg}</span>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 shadow-sm">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-rose-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
            </svg>
            <span>{errorMsg}</span>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label htmlFor="search-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Pencarian
            </label>
            <div className="relative mt-1">
              <input
                id="search-input"
                type="text"
                placeholder="Cari berdasarkan nama, username, atau email..."
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 pl-9 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <svg
                className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
          </div>

          <div>
            <label htmlFor="role-select" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Filter Peran (Role)
            </label>
            <select
              id="role-select"
              value={roleIdFilter}
              onChange={(e) => {
                setRoleIdFilter(e.target.value);
                setPage(1);
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
            <label htmlFor="status-select" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Status Akun
            </label>
            <select
              id="status-select"
              value={isActiveFilter}
              onChange={(e) => {
                setIsActiveFilter(e.target.value);
                setPage(1);
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Semua Status</option>
              <option value="true">Aktif</option>
              <option value="false">Nonaktif</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th scope="col" className="px-6 py-3.5">Nama & Username</th>
                <th scope="col" className="px-6 py-3.5">Email</th>
                <th scope="col" className="px-6 py-3.5">Peran</th>
                <th scope="col" className="px-6 py-3.5">Status</th>
                <th scope="col" className="px-6 py-3.5">Terakhir Login</th>
                <th scope="col" className="px-6 py-3.5 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <div className="inline-flex items-center gap-2">
                      <svg className="h-5 w-5 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Memuat data pengguna...</span>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    Tidak ada data pengguna yang sesuai dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const isSelf = user.id === currentUserId;
                  return (
                    <tr key={user.id} className="transition hover:bg-slate-50/80">
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                              {user.name}
                              {isSelf && (
                                <span className="inline-flex items-center rounded-md bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                                  Akun Anda
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500">@{user.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-slate-600">
                        {user.email || <span className="text-slate-400 italic">Tidak ada email</span>}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getRoleBadgeClass(
                            user.role.name
                          )}`}
                        >
                          {user.role.name}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        {user.isActive ? (
                          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                            Nonaktif
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-xs text-slate-500">
                        {user.lastLoginAt ? (
                          new Date(user.lastLoginAt).toLocaleString('id-ID', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })
                        ) : (
                          <span className="italic text-slate-400">Belum pernah login</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(user)}
                            className="rounded px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-slate-400"
                            title="Edit Data Pengguna"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleOpenReset(user)}
                            className="rounded px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 focus:outline-none focus:ring-1 focus:ring-blue-400"
                            title="Reset Kata Sandi"
                          >
                            Reset Password
                          </button>
                          {isSelf ? (
                            <span
                              className="cursor-not-allowed rounded px-2.5 py-1 text-xs font-medium text-slate-300"
                              title="Anda tidak dapat menghapus akun Anda sendiri"
                            >
                              Hapus
                            </span>
                          ) : (
                            <button
                              onClick={() => handleOpenDelete(user)}
                              className="rounded px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 focus:outline-none focus:ring-1 focus:ring-rose-400"
                              title="Hapus Pengguna"
                            >
                              Hapus
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

        {/* Pagination Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3 text-xs text-slate-500">
          <div>
            Total <span className="font-semibold text-slate-800">{totalCount}</span> pengguna
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded border border-slate-300 bg-white px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Sebelumnya
            </button>
            <span>
              Halaman {page} dari {totalPages}
            </span>
            <button
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded border border-slate-300 bg-white px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Tambah Pengguna */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900">Tambah Pengguna Baru</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="sr-only">Tutup</span>
                &times;
              </button>
            </div>

            {addError && (
              <div className="mt-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
                {addError}
              </div>
            )}

            <form onSubmit={handleSubmitAdd} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  placeholder="Contoh: Budi Santoso"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Username *</label>
                  <input
                    type="text"
                    required
                    value={addForm.username}
                    onChange={(e) => setAddForm({ ...addForm, username: e.target.value })}
                    placeholder="Contoh: budi_s"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <p className="mt-0.5 text-[11px] text-slate-500">Huruf, angka, _ atau -</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Email</label>
                  <input
                    type="email"
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                    placeholder="budi@perusahaan.co.id"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Peran (Role) *</label>
                <select
                  value={addForm.roleId}
                  onChange={(e) => setAddForm({ ...addForm, roleId: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                  <label className="block text-xs font-semibold text-slate-700">Kata Sandi Awal *</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={addForm.password}
                    onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                    placeholder="Minimal 8 karakter"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Konfirmasi Kata Sandi *</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={addForm.confirmPassword}
                    onChange={(e) => setAddForm({ ...addForm, confirmPassword: e.target.value })}
                    placeholder="Ulangi kata sandi"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  id="add-is-active"
                  type="checkbox"
                  checked={addForm.isActive}
                  onChange={(e) => setAddForm({ ...addForm, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="add-is-active" className="text-sm font-medium text-slate-700">
                  Status akun aktif (dapat langsung login)
                </label>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingAdd}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Edit Pengguna</h2>
                <p className="text-xs text-slate-500">Username: @{editTarget.username}</p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="sr-only">Tutup</span>
                &times;
              </button>
            </div>

            {editError && (
              <div className="mt-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
                {editError}
              </div>
            )}

            <form onSubmit={handleSubmitEdit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  placeholder="opsional@perusahaan.co.id"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Peran (Role) *</label>
                <select
                  value={editForm.roleId}
                  disabled={editTarget.id === currentUserId}
                  onChange={(e) => setEditForm({ ...editForm, roleId: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 disabled:bg-slate-100 disabled:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {initialRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                {editTarget.id === currentUserId && (
                  <p className="mt-1 text-xs text-amber-600">
                    Anda tidak dapat mengubah peran akun Anda sendiri.
                  </p>
                )}
              </div>

              <div className="pt-2">
                <div className="flex items-center gap-2">
                  <input
                    id="edit-is-active"
                    type="checkbox"
                    disabled={editTarget.id === currentUserId}
                    checked={editForm.isActive}
                    onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                  />
                  <label htmlFor="edit-is-active" className="text-sm font-medium text-slate-700">
                    Status akun aktif
                  </label>
                </div>
                {editTarget.id === currentUserId && (
                  <p className="mt-1 text-xs text-amber-600">
                    Anda tidak dapat menonaktifkan akun Anda sendiri yang sedang aktif.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Reset Kata Sandi</h2>
                <p className="text-xs text-slate-500">Pengguna: {resetTarget.name} (@{resetTarget.username})</p>
              </div>
              <button
                onClick={() => setShowResetModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="sr-only">Tutup</span>
                &times;
              </button>
            </div>

            {resetError && (
              <div className="mt-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
                {resetError}
              </div>
            )}

            <form onSubmit={handleSubmitReset} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Kata Sandi Baru *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Minimal 8 karakter"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Konfirmasi Kata Sandi Baru *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={resetConfirm}
                  onChange={(e) => setResetConfirm(e.target.value)}
                  placeholder="Ulangi kata sandi baru"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingReset}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-rose-700">Konfirmasi Hapus Pengguna</h2>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="sr-only">Tutup</span>
                &times;
              </button>
            </div>

            {deleteError && (
              <div className="mt-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
                {deleteError}
              </div>
            )}

            <div className="mt-4 text-sm text-slate-600">
              Apakah Anda yakin ingin menghapus pengguna{' '}
              <span className="font-semibold text-slate-900">{deleteTarget.name}</span> (username:{' '}
              <span className="font-mono text-slate-800">@{deleteTarget.username}</span>)?
              <p className="mt-2 text-xs text-slate-500">
                Tindakan ini permanen. Seluruh log riwayat audit yang bersangkutan akan tetap tersimpan demi akuntabilitas kepatuhan sistem.
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSubmitDelete}
                disabled={submittingDelete}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
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
