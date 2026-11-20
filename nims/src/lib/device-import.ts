import { ipToInt, parseCidr, validateHostIp } from '@/lib/ipam';

export interface DeviceImportRow {
  rowNumber: number; // 1-based line number in file (1 = header, 2 = row 1)
  deviceCode: string;
  hostname: string;
  category: string;
  vendor: string;
  model?: string;
  serialNumber?: string;
  managementIp?: string;
  siteCode: string;
  networkRole?: string;
  inventoryStatus?: string;
  description?: string;
}

export interface ValidatedImportDevice {
  rowNumber: number;
  deviceCode: string;
  hostname: string;
  categoryId: number;
  categoryName: string;
  vendorId: number;
  vendorName: string;
  modelName?: string;
  serialNumber?: string;
  managementIp?: string;
  siteId: number;
  siteName: string;
  networkRole?: string;
  inventoryStatus: string;
  description?: string;
}

export interface ImportErrorDetail {
  rowNumber: number;
  deviceCode?: string;
  hostname?: string;
  error: string;
}

export interface ParseResult {
  headers: string[];
  rows: DeviceImportRow[];
  headerError?: string;
}

export const EXPECTED_HEADERS = [
  'device_code',
  'hostname',
  'category',
  'vendor',
  'model',
  'serial_number',
  'management_ip',
  'site_code',
  'network_role',
  'inventory_status',
  'description',
] as const;

export const CSV_TEMPLATE_CONTENT =
  `device_code,hostname,category,vendor,model,serial_number,management_ip,site_code,network_role,inventory_status,description\r\n` +
  `NOC-RTR-001,RTR-POP-BDG,router,MikroTik,CCR2004,DEMO-SN-001,10.10.10.1,POP-BDG-01,core,active,Data simulasi router core\r\n` +
  `NOC-SW-001,SW-POP-BDG,switch,Cisco,Catalyst-Demo,DEMO-SN-002,10.10.10.2,POP-BDG-01,distribution,active,Data simulasi switch distribution\r\n` +
  `NOC-OLT-001,OLT-POP-BDG,olt,Huawei,MA5800-Demo,DEMO-SN-003,10.10.10.3,POP-BDG-01,access,active,Data simulasi OLT access\r\n`;

/**
 * Parse CSV line respecting quotes and commas inside quotes
 */
export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Parse raw CSV string to rows with row numbering
 */
export function parseDeviceCsv(csvText: string): ParseResult {
  // Strip UTF-8 BOM if present
  let cleanText = csvText;
  if (cleanText.charCodeAt(0) === 0xfeff) {
    cleanText = cleanText.slice(1);
  }

  const rawLines = cleanText.split(/\r\n|\n|\r/);
  const nonEmptyLines: { line: string; physicalLineNum: number }[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const trimmed = rawLines[i].trim();
    if (trimmed.length > 0) {
      nonEmptyLines.push({ line: rawLines[i], physicalLineNum: i + 1 });
    }
  }

  if (nonEmptyLines.length === 0) {
    return {
      headers: [],
      rows: [],
      headerError: 'Berkas CSV kosong atau tidak memiliki data',
    };
  }

  const headerLine = nonEmptyLines[0];
  const headers = parseCsvLine(headerLine.line).map((h) => h.toLowerCase().trim().replace(/['"]/g, ''));

  // Cek kolom wajib
  const requiredHeaders = ['device_code', 'hostname', 'category', 'vendor', 'site_code'];
  const missingHeaders = requiredHeaders.filter((rh) => !headers.includes(rh));

  if (missingHeaders.length > 0) {
    return {
      headers,
      rows: [],
      headerError: `Kolom wajib tidak ditemukan dalam header CSV: ${missingHeaders.join(', ')}`,
    };
  }

  const rows: DeviceImportRow[] = [];
  for (let i = 1; i < nonEmptyLines.length; i++) {
    const item = nonEmptyLines[i];
    const values = parseCsvLine(item.line);
    const rowObj: Record<string, string> = {};

    headers.forEach((header, index) => {
      rowObj[header] = values[index] !== undefined ? values[index] : '';
    });

    rows.push({
      rowNumber: item.physicalLineNum,
      deviceCode: rowObj['device_code'] || '',
      hostname: rowObj['hostname'] || '',
      category: rowObj['category'] || '',
      vendor: rowObj['vendor'] || '',
      model: rowObj['model'] || undefined,
      serialNumber: rowObj['serial_number'] || undefined,
      managementIp: rowObj['management_ip'] || undefined,
      siteCode: rowObj['site_code'] || '',
      networkRole: rowObj['network_role'] || undefined,
      inventoryStatus: rowObj['inventory_status'] || undefined,
      description: rowObj['description'] || undefined,
    });
  }

  return { headers, rows };
}

export interface LookupData {
  existingCodes: Set<string>;
  categories: Array<{ id: number; code: string; name: string }>;
  vendors: Array<{ id: number; name: string }>;
  sites: Array<{ id: number; siteCode: string; name: string }>;
}

const VALID_ROLES = ['core', 'distribution', 'access', 'aggregation', 'cpe', 'server', 'other'];
const VALID_STATUSES = ['PLANNED', 'ACTIVE', 'MAINTENANCE', 'RETIRED', 'LOST'];

/**
 * Validate parsed rows against database lookups and return valid rows and error list
 */
export function validateDeviceRows(
  rows: DeviceImportRow[],
  lookups: LookupData
): {
  validRows: ValidatedImportDevice[];
  errors: ImportErrorDetail[];
} {
  const validRows: ValidatedImportDevice[] = [];
  const errors: ImportErrorDetail[] = [];
  const fileCodesSeen = new Map<string, number>(); // code -> rowNumber

  const catMap = new Map<string, { id: number; name: string }>();
  lookups.categories.forEach((c) => {
    catMap.set(c.code.toLowerCase(), { id: c.id, name: c.name });
    catMap.set(c.name.toLowerCase(), { id: c.id, name: c.name });
  });

  const vendorMap = new Map<string, { id: number; name: string }>();
  lookups.vendors.forEach((v) => {
    vendorMap.set(v.name.toLowerCase(), { id: v.id, name: v.name });
  });

  const siteMap = new Map<string, { id: number; name: string }>();
  lookups.sites.forEach((s) => {
    siteMap.set(s.siteCode.toLowerCase(), { id: s.id, name: s.name });
    siteMap.set(s.name.toLowerCase(), { id: s.id, name: s.name });
  });

  for (const row of rows) {
    const rowErrors: string[] = [];
    const code = row.deviceCode.trim().toUpperCase();
    const hostname = row.hostname.trim();

    // 1. Validasi deviceCode
    if (!code) {
      rowErrors.push('Kode perangkat (device_code) wajib diisi');
    } else if (code.length < 2 || code.length > 50) {
      rowErrors.push('Kode perangkat harus antara 2 hingga 50 karakter');
    } else if (fileCodesSeen.has(code)) {
      rowErrors.push(`Kode perangkat '${code}' duplikat di dalam berkas CSV (sudah ada di baris ${fileCodesSeen.get(code)})`);
    } else if (lookups.existingCodes.has(code)) {
      rowErrors.push(`Kode perangkat '${code}' sudah terdaftar di sistem`);
    } else {
      fileCodesSeen.set(code, row.rowNumber);
    }

    // 2. Validasi hostname
    if (!hostname) {
      rowErrors.push('Hostname wajib diisi');
    } else if (hostname.length < 2 || hostname.length > 100) {
      rowErrors.push('Hostname harus antara 2 hingga 100 karakter');
    }

    // 3. Validasi Category
    const rawCat = row.category.trim();
    let categoryInfo: { id: number; name: string } | undefined;
    if (!rawCat) {
      rowErrors.push('Kategori (category) wajib diisi');
    } else {
      categoryInfo = catMap.get(rawCat.toLowerCase());
      if (!categoryInfo) {
        rowErrors.push(`Kategori '${rawCat}' tidak valid atau belum terdaftar`);
      }
    }

    // 4. Validasi Vendor
    const rawVendor = row.vendor.trim();
    let vendorInfo: { id: number; name: string } | undefined;
    if (!rawVendor) {
      rowErrors.push('Vendor wajib diisi');
    } else {
      vendorInfo = vendorMap.get(rawVendor.toLowerCase());
      if (!vendorInfo) {
        rowErrors.push(`Vendor '${rawVendor}' tidak valid atau belum terdaftar`);
      }
    }

    // 5. Validasi Site
    const rawSite = row.siteCode.trim();
    let siteInfo: { id: number; name: string } | undefined;
    if (!rawSite) {
      rowErrors.push('Site/Lokasi (site_code) wajib diisi');
    } else {
      siteInfo = siteMap.get(rawSite.toLowerCase());
      if (!siteInfo) {
        rowErrors.push(`Site/Lokasi '${rawSite}' tidak valid atau belum terdaftar`);
      }
    }

    // 6. Validasi Management IP jika diisi
    const rawIp = row.managementIp?.trim();
    if (rawIp) {
      try {
        ipToInt(rawIp);
      } catch (err) {
        rowErrors.push(`Format Management IP '${rawIp}' tidak valid`);
      }
    }

    // 7. Validasi networkRole jika diisi
    let networkRole = row.networkRole?.trim().toLowerCase();
    if (networkRole) {
      if (!VALID_ROLES.includes(networkRole)) {
        rowErrors.push(`Role jaringan '${networkRole}' tidak valid (pilihan: ${VALID_ROLES.join(', ')})`);
      }
    } else {
      networkRole = 'access';
    }

    // 8. Validasi inventoryStatus jika diisi
    let inventoryStatus = row.inventoryStatus?.trim().toUpperCase();
    if (inventoryStatus) {
      if (!VALID_STATUSES.includes(inventoryStatus)) {
        rowErrors.push(`Status inventaris '${inventoryStatus}' tidak valid (pilihan: ${VALID_STATUSES.join(', ')})`);
      }
    } else {
      inventoryStatus = 'ACTIVE';
    }

    if (rowErrors.length > 0) {
      errors.push({
        rowNumber: row.rowNumber,
        deviceCode: code || undefined,
        hostname: hostname || undefined,
        error: rowErrors.join('; '),
      });
    } else if (categoryInfo && vendorInfo && siteInfo) {
      validRows.push({
        rowNumber: row.rowNumber,
        deviceCode: code,
        hostname,
        categoryId: categoryInfo.id,
        categoryName: categoryInfo.name,
        vendorId: vendorInfo.id,
        vendorName: vendorInfo.name,
        modelName: row.model?.trim() || undefined,
        serialNumber: row.serialNumber?.trim() || undefined,
        managementIp: rawIp || undefined,
        siteId: siteInfo.id,
        siteName: siteInfo.name,
        networkRole,
        inventoryStatus,
        description: row.description?.trim() || undefined,
      });
    }
  }

  return { validRows, errors };
}
