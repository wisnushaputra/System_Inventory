import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB

export const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.txt',
  '.log',
  '.cfg',
  '.conf',
  '.csv',
  '.xlsx',
  '.docx',
  '.zip',
]);

export const FORBIDDEN_EXTENSIONS = new Set([
  '.svg',
  '.html',
  '.htm',
  '.xhtml',
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.exe',
  '.bat',
  '.cmd',
  '.sh',
  '.php',
  '.py',
  '.vbs',
  '.ps1',
  '.msi',
]);

export const FORBIDDEN_MIME_TYPES = new Set([
  'image/svg+xml',
  'text/html',
  'application/xhtml+xml',
  'application/javascript',
  'text/javascript',
  'application/x-msdownload',
  'application/x-sh',
  'application/x-httpd-php',
]);

export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
  'text/x-log',
  'text/x-config',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream', // Sering dihasilkan untuk .cfg, .log, .conf
]);

export function validateFileMetadata(filename: string, mimeType: string, fileSize: number): { valid: boolean; error?: string } {
  if (!filename || filename.trim() === '') {
    return { valid: false, error: 'Nama file tidak boleh kosong.' };
  }

  if (fileSize <= 0) {
    return { valid: false, error: 'File kosong (0 byte).' };
  }

  if (fileSize > MAX_FILE_SIZE) {
    return { valid: false, error: `Ukuran file melebihi batas maksimum (${MAX_FILE_SIZE / (1024 * 1024)} MB).` };
  }

  const ext = path.extname(filename).toLowerCase();

  // Tolak keras format berisiko XSS atau executable (DoD T5.2)
  if (FORBIDDEN_EXTENSIONS.has(ext)) {
    return { valid: false, error: `Ekstensi '${ext}' dilarang demi keamanan sistem (DoD T5.2).` };
  }

  if (FORBIDDEN_MIME_TYPES.has(mimeType.toLowerCase())) {
    return { valid: false, error: `Tipe MIME '${mimeType}' dilarang demi keamanan sistem (DoD T5.2).` };
  }

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `Format ekstensi '${ext}' tidak diizinkan. Ekstensi yang didukung: ${Array.from(ALLOWED_EXTENSIONS).join(', ')}`,
    };
  }

  // Jika MIME tidak ada di whitelist dan bukan octet-stream
  if (mimeType && !ALLOWED_MIME_TYPES.has(mimeType.toLowerCase()) && mimeType.toLowerCase() !== 'application/octet-stream') {
    return {
      valid: false,
      error: `Tipe MIME '${mimeType}' tidak didukung.`,
    };
  }

  return { valid: true };
}

export function getStorageDirectory(): string {
  return path.join(process.cwd(), 'storage', 'documents');
}

export async function ensureStorageDirectory(): Promise<string> {
  const dir = getStorageDirectory();
  await fs.mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
  return dir;
}

export function calculateChecksum(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export async function saveDocumentFile(
  buffer: Buffer,
  originalFilename: string
): Promise<{ storageKey: string; checksum: string; fileSize: number }> {
  const dir = await ensureStorageDirectory();
  const ext = path.extname(originalFilename).toLowerCase();
  const randomUuid = crypto.randomUUID();
  const storageKey = `${randomUuid}${ext}`;
  const filePath = path.join(dir, storageKey);

  await fs.writeFile(/*turbopackIgnore: true*/ filePath, buffer);
  const checksum = calculateChecksum(buffer);

  return {
    storageKey,
    checksum,
    fileSize: buffer.length,
  };
}

export function getSafeFilePath(storageKey: string): string {
  // Cegah directory traversal
  const sanitized = path.basename(storageKey);
  const dir = getStorageDirectory();
  return path.join(dir, sanitized);
}

export async function readDocumentFile(storageKey: string): Promise<Buffer> {
  const filePath = getSafeFilePath(storageKey);
  return await fs.readFile(/*turbopackIgnore: true*/ filePath);
}

export async function deleteDocumentFile(storageKey: string): Promise<boolean> {
  try {
    const filePath = getSafeFilePath(storageKey);
    await fs.unlink(/*turbopackIgnore: true*/ filePath);
    return true;
  } catch (err) {
    console.warn(`Gagal menghapus berkas fisik ${storageKey}:`, err);
    return false;
  }
}
