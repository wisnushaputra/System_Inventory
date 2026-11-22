'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  IconClose,
  IconCopy,
  IconDownload,
  IconExternalLink,
  IconFileDoc,
  IconSearch,
} from '@/components/Icons';
import { useFeedback } from '@/components/FeedbackProvider';

export interface PreviewDocumentItem {
  id: number;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  checksum: string;
  category: string;
  description: string | null;
}

export type PreviewKind = 'image' | 'pdf' | 'text';

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const TEXT_EXTS = new Set(['.txt', '.log', '.cfg', '.conf', '.csv']);
const MAX_INLINE_TEXT_CHARS = 300_000;

export function getDocumentPreviewKind(filename: string, mimeType?: string): PreviewKind | null {
  const lower = filename.toLowerCase();
  const dotIdx = lower.lastIndexOf('.');
  const ext = dotIdx >= 0 ? lower.slice(dotIdx) : '';

  if (IMAGE_EXTS.has(ext) || mimeType?.startsWith('image/png') || mimeType?.startsWith('image/jpeg') || mimeType?.startsWith('image/webp')) {
    return 'image';
  }
  if (ext === '.pdf' || mimeType === 'application/pdf') {
    return 'pdf';
  }
  if (TEXT_EXTS.has(ext) || mimeType === 'text/plain' || mimeType === 'text/csv') {
    return 'text';
  }
  return null;
}

function formatBytesLabel(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(1))} ${units[i]}`;
}

export function DocumentPreviewModal({
  document: doc,
  categoryLabel,
  onClose,
}: {
  document: PreviewDocumentItem | null;
  categoryLabel?: string;
  onClose: () => void;
}) {
  if (!doc) return null;
  return (
    <DocumentPreviewDialog
      key={doc.id}
      doc={doc}
      categoryLabel={categoryLabel}
      onClose={onClose}
    />
  );
}

function DocumentPreviewDialog({
  doc,
  categoryLabel,
  onClose,
}: {
  doc: PreviewDocumentItem;
  categoryLabel?: string;
  onClose: () => void;
}) {
  const { toast } = useFeedback();
  const kind = getDocumentPreviewKind(doc.originalFilename, doc.mimeType);
  const inlineUrl = `/api/documents/${doc.id}/download?inline=1`;
  const downloadUrl = `/api/documents/${doc.id}/download`;

  const [textContent, setTextContent] = useState<string>('');
  const [textTruncated, setTextTruncated] = useState(false);
  const [textLoading, setTextLoading] = useState(kind === 'text');
  const [textError, setTextError] = useState<string | null>(null);
  const [wrapLines, setWrapLines] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [mediaError, setMediaError] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (kind !== 'text') return;
    const controller = new AbortController();

    async function loadText() {
      try {
        const res = await fetch(inlineUrl, { signal: controller.signal });
        if (!res.ok) {
          throw new Error('Gagal membaca isi berkas dari penyimpanan privat.');
        }
        const raw = await res.text();
        if (raw.length > MAX_INLINE_TEXT_CHARS) {
          setTextContent(raw.slice(0, MAX_INLINE_TEXT_CHARS));
          setTextTruncated(true);
        } else {
          setTextContent(raw);
          setTextTruncated(false);
        }
        setTextError(null);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setTextError(
          err instanceof Error ? err.message : 'Terjadi kesalahan saat memuat isi berkas.'
        );
      } finally {
        setTextLoading(false);
      }
    }

    void loadText();
    return () => controller.abort();
  }, [kind, inlineUrl]);

  const lines = useMemo(() => textContent.split(/\r?\n/), [textContent]);
  const matchCount = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return 0;
    return lines.filter((line) => line.toLowerCase().includes(q)).length;
  }, [lines, searchQuery]);

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(textContent);
      toast.success('Isi berkas berhasil disalin ke clipboard.');
    } catch {
      toast.error('Gagal menyalin teks ke clipboard.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="doc-preview-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 animate-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-line bg-elevated shadow-2xl animate-modal">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
              <IconFileDoc className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 id="doc-preview-title" className="truncate text-sm font-bold text-ink">
                {doc.originalFilename}
              </h2>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-secondary">
                {categoryLabel && (
                  <span className="rounded border border-line bg-subtle px-1.5 py-0.5 font-medium text-ink">
                    {categoryLabel}
                  </span>
                )}
                <span>{formatBytesLabel(doc.fileSize)}</span>
                <span className="font-mono text-ink-muted">
                  SHA-256: {doc.checksum.slice(0, 12)}...
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:bg-subtle"
            >
              <IconDownload className="h-3.5 w-3.5" />
              <span>Unduh</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup pratinjau dokumen"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-ink-secondary hover:bg-subtle hover:text-ink"
            >
              <IconClose className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-canvas p-4 sm:p-5">
          {kind === 'image' && (
            <div className="flex flex-col items-center justify-center gap-3">
              {mediaError ? (
                <div className="rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/60 p-4 text-xs text-rose-800 dark:text-rose-200">
                  Gagal memuat pratinjau gambar. Silakan gunakan tombol Unduh di atas.
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={inlineUrl}
                  alt={doc.originalFilename}
                  onError={() => setMediaError(true)}
                  className="max-h-[70vh] w-auto max-w-full rounded-lg border border-line bg-surface object-contain shadow-xs"
                />
              )}
            </div>
          )}

          {kind === 'pdf' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-[11px] text-ink-secondary">
                <span>Menampilkan pratinjau dokumen PDF terproteksi RBAC.</span>
                <a
                  href={inlineUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-accent-ink hover:underline"
                >
                  <span>Buka di Tab Baru</span>
                  <IconExternalLink className="h-3 w-3" />
                </a>
              </div>
              <iframe
                title={`Pratinjau PDF ${doc.originalFilename}`}
                src={inlineUrl}
                className="h-[70vh] w-full rounded-lg border border-line bg-white"
              />
            </div>
          )}

          {kind === 'text' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <label htmlFor="doc-text-search" className="sr-only">
                    Cari teks dalam berkas
                  </label>
                  <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-muted" />
                  <input
                    id="doc-text-search"
                    type="text"
                    placeholder="Cari baris konfigurasi atau log..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="min-h-[36px] w-full rounded-lg border border-line bg-surface pl-8 pr-3 text-xs text-ink placeholder-ink-muted focus:border-accent focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {searchQuery.trim() && (
                    <span className="font-mono text-[11px] text-accent-ink font-semibold">
                      {matchCount} baris cocok
                    </span>
                  )}
                  <label className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-ink cursor-pointer">
                    <input
                      type="checkbox"
                      checked={wrapLines}
                      onChange={(e) => setWrapLines(e.target.checked)}
                      className="h-3.5 w-3.5 rounded accent-[var(--accent)]"
                    />
                    <span>Wrap Baris</span>
                  </label>
                  <button
                    type="button"
                    disabled={textLoading || Boolean(textError)}
                    onClick={handleCopyText}
                    className="inline-flex min-h-[32px] items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink hover:bg-subtle disabled:opacity-50"
                  >
                    <IconCopy className="h-3.5 w-3.5 text-accent-ink" />
                    <span>Salin Isi</span>
                  </button>
                </div>
              </div>

              {textTruncated && (
                <div className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/50 px-3 py-2 text-[11px] text-amber-900 dark:text-amber-200">
                  Ukuran teks sangat besar sehingga pratinjau dibatasi 300.000 karakter pertama. Gunakan tombol Unduh untuk isi penuh.
                </div>
              )}

              {textLoading ? (
                <div className="flex h-48 items-center justify-center rounded-lg border border-line bg-surface text-xs text-ink-secondary">
                  Memuat isi berkas teks...
                </div>
              ) : textError ? (
                <div className="rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/60 p-4 text-xs text-rose-800 dark:text-rose-200">
                  {textError}
                </div>
              ) : (
                <div className="max-h-[60vh] overflow-auto rounded-lg border border-line bg-surface font-mono text-[11px] leading-relaxed">
                  {lines.map((line, idx) => {
                    const q = searchQuery.trim().toLowerCase();
                    const isMatch = Boolean(q && line.toLowerCase().includes(q));
                    return (
                      <div
                        key={idx}
                        className={`flex border-b border-line/40 last:border-b-0 ${
                          isMatch ? 'bg-amber-100/70 dark:bg-amber-950/50' : ''
                        }`}
                      >
                        <span className="w-12 shrink-0 select-none border-r border-line bg-subtle/60 px-2 py-0.5 text-right text-[10px] text-ink-muted tabular-nums-data">
                          {idx + 1}
                        </span>
                        <span
                          className={`flex-1 px-3 py-0.5 text-ink ${
                            wrapLines ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'
                          }`}
                        >
                          {line || ' '}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {!kind && (
            <div className="rounded-lg border border-line bg-surface p-6 text-center text-xs text-ink-secondary space-y-2">
              <p className="font-semibold text-ink">
                Pratinjau langsung belum tersedia untuk tipe berkas ini.
              </p>
              <p>Silakan gunakan tombol Unduh di pojok kanan atas untuk membuka berkas.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
