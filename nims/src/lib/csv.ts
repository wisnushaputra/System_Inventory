/**
 * CSV Helper with Formula Injection (CWE-1236) Defense
 * Menjamin semua sel yang diawali karakter berbahaya (=, +, -, @, \t, \r)
 * di-escape dengan tanda kutip tunggal (') agar tidak dieksekusi sebagai formula di spreadsheet.
 */

const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r'];

export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '""';
  }

  let str = String(value);

  // Jika string diawali salah satu karakter trigger formula, prepend tanda kutip tunggal (')
  if (str.length > 0 && FORMULA_TRIGGERS.includes(str[0])) {
    str = `'${str}`;
  }

  // Escape tanda kutip ganda internal dengan melipatgandakannya (" -> "")
  const escaped = str.replace(/"/g, '""');

  return `"${escaped}"`;
}

export function generateCsv(headers: string[], rows: unknown[][]): string {
  // UTF-8 Byte Order Mark (BOM) agar Excel Windows otomatis membaca format UTF-8
  const BOM = '\uFEFF';

  const headerLine = headers.map((h) => sanitizeCsvCell(h)).join(',');
  const rowLines = rows.map((row) => row.map((cell) => sanitizeCsvCell(cell)).join(','));

  return BOM + [headerLine, ...rowLines].join('\r\n');
}
