'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  IconAlertTriangle,
  IconCheckCircle,
  IconClose,
  IconEdit,
  IconPlus,
  IconSitePin,
  IconTrash,
} from '@/components/Icons';

export interface SiteRoomRackTarget {
  id: number;
  siteCode: string;
  name: string;
}

interface RoomRecord {
  id: number;
  siteId: number;
  name: string;
  floor: string | null;
  description: string | null;
  _count?: { racks: number };
}

interface RackRecord {
  id: number;
  siteId: number;
  roomId: number | null;
  name: string;
  unitCapacity: number;
  description: string | null;
  room?: { id: number; name: string } | null;
}

interface Props {
  open: boolean;
  site: SiteRoomRackTarget | null;
  onClose: () => void;
  onChanged?: () => void;
}

/** Modal kelola Ruang & Rak (Tambah, Edit, Hapus) pada sebuah Site. */
export function RoomRackManagerModal({ open, site, onClose, onChanged }: Props) {
  const [activeTab, setActiveTab] = useState<'rooms' | 'racks'>('rooms');
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [racks, setRacks] = useState<RackRecord[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [editingRoomId, setEditingRoomId] = useState<number | null>(null);
  const [roomName, setRoomName] = useState('');
  const [roomFloor, setRoomFloor] = useState('');
  const [roomDescription, setRoomDescription] = useState('');

  const [editingRackId, setEditingRackId] = useState<number | null>(null);
  const [rackName, setRackName] = useState('');
  const [rackRoomId, setRackRoomId] = useState('');
  const [rackCapacity, setRackCapacity] = useState('42');
  const [rackDescription, setRackDescription] = useState('');

  const resetRoomForm = () => {
    setEditingRoomId(null);
    setRoomName('');
    setRoomFloor('');
    setRoomDescription('');
  };

  const resetRackForm = () => {
    setEditingRackId(null);
    setRackName('');
    setRackRoomId('');
    setRackCapacity('42');
    setRackDescription('');
  };

  const loadData = useCallback(async (siteId: number) => {
    setLoadingList(true);
    try {
      const [resRooms, resRacks] = await Promise.all([
        fetch(`/api/master/rooms?siteId=${siteId}`),
        fetch(`/api/master/racks?siteId=${siteId}`),
      ]);
      if (resRooms.ok) {
        const jRooms = await resRooms.json();
        setRooms(jRooms.data || []);
      }
      if (resRacks.ok) {
        const jRacks = await resRacks.json();
        setRacks(jRacks.data || []);
      }
    } catch {
      setErrorMsg('Gagal memuat daftar ruangan dan rak.');
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !site) return;
    setActiveTab('rooms');
    setErrorMsg(null);
    setSuccessMsg(null);
    resetRoomForm();
    resetRackForm();
    loadData(site.id);
  }, [open, site?.id, loadData]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, submitting, onClose]);

  if (!open || !site) return null;

  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);
    try {
      const isEdit = editingRoomId !== null;
      const url = isEdit ? `/api/master/rooms/${editingRoomId}` : '/api/master/rooms';
      const method = isEdit ? 'PUT' : 'POST';
      const payload = isEdit
        ? {
            name: roomName.trim(),
            floor: roomFloor.trim() || null,
            description: roomDescription.trim() || null,
          }
        : {
            siteId: site.id,
            name: roomName.trim(),
            floor: roomFloor.trim() || null,
            description: roomDescription.trim() || null,
          };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Gagal menyimpan ruangan.');

      setSuccessMsg(json.message);
      resetRoomForm();
      await loadData(site.id);
      onChanged?.();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan ruangan.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRoom = async (room: RoomRecord) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/master/rooms/${room.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Gagal menghapus ruangan.');
      if (editingRoomId === room.id) resetRoomForm();
      setSuccessMsg(json.message);
      await loadData(site.id);
      onChanged?.();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menghapus ruangan.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveRack = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);
    try {
      const isEdit = editingRackId !== null;
      const url = isEdit ? `/api/master/racks/${editingRackId}` : '/api/master/racks';
      const method = isEdit ? 'PUT' : 'POST';
      const parsedCapacity = parseInt(rackCapacity, 10);
      const unitCapacity = isNaN(parsedCapacity) ? 42 : parsedCapacity;

      const payload = isEdit
        ? {
            name: rackName.trim(),
            roomId: rackRoomId ? parseInt(rackRoomId, 10) : null,
            unitCapacity,
            description: rackDescription.trim() || null,
          }
        : {
            siteId: site.id,
            name: rackName.trim(),
            roomId: rackRoomId ? parseInt(rackRoomId, 10) : null,
            unitCapacity,
            description: rackDescription.trim() || null,
          };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Gagal menyimpan rak.');

      setSuccessMsg(json.message);
      resetRackForm();
      await loadData(site.id);
      onChanged?.();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan rak.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRack = async (rack: RackRecord) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/master/racks/${rack.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Gagal menghapus rak.');
      if (editingRackId === rack.id) resetRackForm();
      setSuccessMsg(json.message);
      await loadData(site.id);
      onChanged?.();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menghapus rak.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 animate-backdrop"
      onClick={() => {
        if (!submitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="room-rack-manager-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl border border-line bg-elevated shadow-2xl animate-modal overflow-hidden text-xs"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h3 id="room-rack-manager-title" className="text-base font-bold text-ink">
              Kelola Ruang & Rak
            </h3>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-secondary">
              <IconSitePin className="h-3.5 w-3.5 text-accent-ink shrink-0" />
              <span>
                <strong className="font-mono text-ink">{site.siteCode}</strong> - {site.name}
              </span>
            </p>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            aria-label="Tutup dialog"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-subtle hover:text-ink disabled:opacity-50"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        <div className="flex border-b border-line px-5 gap-5 bg-surface">
          <button
            type="button"
            onClick={() => {
              setActiveTab('rooms');
              setErrorMsg(null);
            }}
            className={`min-h-[42px] border-b-2 px-1 py-2 text-xs font-semibold transition-colors duration-150 ${
              activeTab === 'rooms'
                ? 'border-accent text-accent-ink'
                : 'border-transparent text-ink-secondary hover:text-ink'
            }`}
          >
            Ruangan ({rooms.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('racks');
              setErrorMsg(null);
            }}
            className={`min-h-[42px] border-b-2 px-1 py-2 text-xs font-semibold transition-colors duration-150 ${
              activeTab === 'racks'
                ? 'border-accent text-accent-ink'
                : 'border-transparent text-ink-secondary hover:text-ink'
            }`}
          >
            Rak ({racks.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMsg && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/50 p-3 text-xs text-rose-800 dark:text-rose-200"
            >
              <IconAlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div
              role="status"
              className="flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/50 p-3 text-xs font-medium text-emerald-900 dark:text-emerald-200"
            >
              <IconCheckCircle className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {activeTab === 'rooms' ? (
            <div className="space-y-4">
              <form
                onSubmit={handleSaveRoom}
                className="rounded-xl border border-line bg-surface p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-bold text-ink">
                    {editingRoomId ? 'Edit Ruangan' : 'Tambah Ruangan Baru'}
                  </h4>
                  {editingRoomId && (
                    <button
                      type="button"
                      onClick={resetRoomForm}
                      className="text-[11px] font-semibold text-accent-ink hover:underline"
                    >
                      Batal Edit
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label htmlFor="rr-room-name" className="block font-semibold text-ink-secondary">
                      Nama Ruangan *
                    </label>
                    <input
                      id="rr-room-name"
                      type="text"
                      required
                      maxLength={100}
                      placeholder="Contoh: Server Room A"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                    />
                  </div>
                  <div>
                    <label htmlFor="rr-room-floor" className="block font-semibold text-ink-secondary">
                      Lantai
                    </label>
                    <input
                      id="rr-room-floor"
                      type="text"
                      maxLength={50}
                      placeholder="Contoh: Lantai 2"
                      value={roomFloor}
                      onChange={(e) => setRoomFloor(e.target.value)}
                      className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                    />
                  </div>
                  <div>
                    <label htmlFor="rr-room-desc" className="block font-semibold text-ink-secondary">
                      Deskripsi
                    </label>
                    <input
                      id="rr-room-desc"
                      type="text"
                      maxLength={500}
                      placeholder="Catatan ruangan"
                      value={roomDescription}
                      onChange={(e) => setRoomDescription(e.target.value)}
                      className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-hover disabled:opacity-50"
                  >
                    {!editingRoomId && <IconPlus className="h-3.5 w-3.5" />}
                    <span>
                      {submitting
                        ? 'Menyimpan...'
                        : editingRoomId
                        ? 'Perbarui Ruangan'
                        : 'Tambah Ruangan'}
                    </span>
                  </button>
                </div>
              </form>

              <div className="overflow-hidden rounded-xl border border-line bg-surface">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-line text-left">
                    <thead className="bg-subtle text-ink-secondary font-semibold uppercase text-[11px]">
                      <tr>
                        <th className="px-3.5 py-2.5">Nama Ruangan</th>
                        <th className="px-3.5 py-2.5">Lantai</th>
                        <th className="px-3.5 py-2.5">Jumlah Rak</th>
                        <th className="px-3.5 py-2.5 text-right">Tindakan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line text-ink">
                      {loadingList ? (
                        <tr>
                          <td colSpan={4} className="px-3.5 py-6 text-center text-ink-secondary">
                            Memuat daftar ruangan...
                          </td>
                        </tr>
                      ) : rooms.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-3.5 py-6 text-center text-ink-secondary">
                            Belum ada ruangan terdaftar di site ini.
                          </td>
                        </tr>
                      ) : (
                        rooms.map((rm) => (
                          <tr key={rm.id} className="hover:bg-subtle/60">
                            <td className="px-3.5 py-2.5 font-semibold">
                              <div>{rm.name}</div>
                              {rm.description && (
                                <div className="text-[11px] font-normal text-ink-muted">
                                  {rm.description}
                                </div>
                              )}
                            </td>
                            <td className="px-3.5 py-2.5 text-ink-secondary">{rm.floor || '-'}</td>
                            <td className="px-3.5 py-2.5 font-mono text-ink-secondary tabular-nums-data">
                              {rm._count?.racks ?? 0} rak
                            </td>
                            <td className="px-3.5 py-2.5 text-right">
                              <div className="inline-flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  disabled={submitting}
                                  onClick={() => {
                                    setErrorMsg(null);
                                    setSuccessMsg(null);
                                    setEditingRoomId(rm.id);
                                    setRoomName(rm.name);
                                    setRoomFloor(rm.floor || '');
                                    setRoomDescription(rm.description || '');
                                  }}
                                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-accent-ink hover:bg-accent-soft font-medium disabled:opacity-50"
                                >
                                  <IconEdit className="h-3.5 w-3.5" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={submitting}
                                  onClick={() => handleDeleteRoom(rm)}
                                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/60 font-medium disabled:opacity-50"
                                >
                                  <IconTrash className="h-3.5 w-3.5" />
                                  <span>Hapus</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <form
                onSubmit={handleSaveRack}
                className="rounded-xl border border-line bg-surface p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-bold text-ink">
                    {editingRackId ? 'Edit Rak' : 'Tambah Rak Baru'}
                  </h4>
                  {editingRackId && (
                    <button
                      type="button"
                      onClick={resetRackForm}
                      className="text-[11px] font-semibold text-accent-ink hover:underline"
                    >
                      Batal Edit
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <div className="sm:col-span-2">
                    <label htmlFor="rr-rack-name" className="block font-semibold text-ink-secondary">
                      Nama Rak *
                    </label>
                    <input
                      id="rr-rack-name"
                      type="text"
                      required
                      maxLength={100}
                      placeholder="Contoh: Rack-Core-01"
                      value={rackName}
                      onChange={(e) => setRackName(e.target.value)}
                      className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                    />
                  </div>
                  <div>
                    <label htmlFor="rr-rack-room" className="block font-semibold text-ink-secondary">
                      Ruangan (Opsional)
                    </label>
                    <select
                      id="rr-rack-room"
                      value={rackRoomId}
                      onChange={(e) => setRackRoomId(e.target.value)}
                      className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
                    >
                      <option value="">Tanpa Ruangan</option>
                      {rooms.map((rm) => (
                        <option key={rm.id} value={rm.id}>
                          {rm.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="rr-rack-cap" className="block font-semibold text-ink-secondary">
                      Kapasitas (U)
                    </label>
                    <input
                      id="rr-rack-cap"
                      type="number"
                      min={1}
                      max={100}
                      required
                      value={rackCapacity}
                      onChange={(e) => setRackCapacity(e.target.value)}
                      className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs font-mono text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="rr-rack-desc" className="block font-semibold text-ink-secondary">
                    Deskripsi
                  </label>
                  <input
                    id="rr-rack-desc"
                    type="text"
                    maxLength={500}
                    placeholder="Catatan posisi atau fungsi rak"
                    value={rackDescription}
                    onChange={(e) => setRackDescription(e.target.value)}
                    className="mt-1 min-h-[38px] block w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-hover disabled:opacity-50"
                  >
                    {!editingRackId && <IconPlus className="h-3.5 w-3.5" />}
                    <span>
                      {submitting
                        ? 'Menyimpan...'
                        : editingRackId
                        ? 'Perbarui Rak'
                        : 'Tambah Rak'}
                    </span>
                  </button>
                </div>
              </form>

              <div className="overflow-hidden rounded-xl border border-line bg-surface">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-line text-left">
                    <thead className="bg-subtle text-ink-secondary font-semibold uppercase text-[11px]">
                      <tr>
                        <th className="px-3.5 py-2.5">Nama Rak</th>
                        <th className="px-3.5 py-2.5">Ruangan</th>
                        <th className="px-3.5 py-2.5">Kapasitas</th>
                        <th className="px-3.5 py-2.5 text-right">Tindakan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line text-ink">
                      {loadingList ? (
                        <tr>
                          <td colSpan={4} className="px-3.5 py-6 text-center text-ink-secondary">
                            Memuat daftar rak...
                          </td>
                        </tr>
                      ) : racks.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-3.5 py-6 text-center text-ink-secondary">
                            Belum ada rak terdaftar di site ini.
                          </td>
                        </tr>
                      ) : (
                        racks.map((rk) => (
                          <tr key={rk.id} className="hover:bg-subtle/60">
                            <td className="px-3.5 py-2.5 font-semibold">
                              <div>{rk.name}</div>
                              {rk.description && (
                                <div className="text-[11px] font-normal text-ink-muted">
                                  {rk.description}
                                </div>
                              )}
                            </td>
                            <td className="px-3.5 py-2.5 text-ink-secondary">
                              {rk.room?.name || '-'}
                            </td>
                            <td className="px-3.5 py-2.5 font-mono text-ink-secondary tabular-nums-data">
                              {rk.unitCapacity}U
                            </td>
                            <td className="px-3.5 py-2.5 text-right">
                              <div className="inline-flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  disabled={submitting}
                                  onClick={() => {
                                    setErrorMsg(null);
                                    setSuccessMsg(null);
                                    setEditingRackId(rk.id);
                                    setRackName(rk.name);
                                    setRackRoomId(rk.roomId ? rk.roomId.toString() : '');
                                    setRackCapacity(rk.unitCapacity.toString());
                                    setRackDescription(rk.description || '');
                                  }}
                                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-accent-ink hover:bg-accent-soft font-medium disabled:opacity-50"
                                >
                                  <IconEdit className="h-3.5 w-3.5" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={submitting}
                                  onClick={() => handleDeleteRack(rk)}
                                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/60 font-medium disabled:opacity-50"
                                >
                                  <IconTrash className="h-3.5 w-3.5" />
                                  <span>Hapus</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-line bg-surface px-5 py-3">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="min-h-[36px] rounded-lg border border-line bg-canvas px-4 py-1.5 text-xs font-medium text-ink hover:bg-subtle disabled:opacity-50"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
}
