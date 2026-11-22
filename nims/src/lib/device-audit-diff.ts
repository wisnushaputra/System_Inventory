export interface AuditFieldChange {
  field: string;
  label: string;
  before: string;
  after: string;
}

export interface DeviceAuditLookupMaps {
  sites: Map<number, string>;
  rooms: Map<number, string>;
  racks: Map<number, string>;
  categories: Map<number, string>;
  vendors: Map<number, string>;
  models: Map<number, string>;
}

const ORDERED_FIELDS = [
  'hostname',
  'deviceCode',
  'inventoryStatus',
  'siteId',
  'roomId',
  'rackId',
  'categoryId',
  'vendorId',
  'modelId',
  'serialNumber',
  'networkRole',
  'ownerTeam',
  'installedAt',
  'warrantyExpiry',
  'managementNotes',
  'description',
  'archiveReason',
  'archivedAt',
] as const;

const FIELD_LABELS: Record<string, string> = {
  hostname: 'Hostname',
  deviceCode: 'Kode Perangkat',
  inventoryStatus: 'Status Inventaris',
  siteId: 'Site / Lokasi',
  roomId: 'Ruangan',
  rackId: 'Rak',
  categoryId: 'Kategori',
  vendorId: 'Vendor',
  modelId: 'Model',
  serialNumber: 'Serial Number',
  networkRole: 'Network Role',
  ownerTeam: 'Tim Penanggung Jawab',
  installedAt: 'Tanggal Pasang',
  warrantyExpiry: 'Batas Garansi',
  managementNotes: 'Catatan Manajemen',
  description: 'Deskripsi',
  archiveReason: 'Alasan Arsip',
  archivedAt: 'Status Arsip',
};

function isBlank(v: unknown): boolean {
  return v === null || v === undefined || v === '';
}

function asRecord(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  return data as Record<string, unknown>;
}

function formatFieldValue(
  field: string,
  val: unknown,
  maps: DeviceAuditLookupMaps
): string {
  if (isBlank(val)) {
    return field === 'archivedAt' ? 'Aktif' : '-';
  }

  if (field === 'archivedAt') {
    return 'Diarsipkan';
  }

  if (field === 'installedAt' || field === 'warrantyExpiry') {
    const dt = new Date(String(val));
    return Number.isNaN(dt.getTime()) ? String(val) : dt.toLocaleDateString('id-ID');
  }

  const numVal = typeof val === 'number' ? val : Number(val);
  if (Number.isInteger(numVal) && numVal > 0) {
    if (field === 'siteId') return maps.sites.get(numVal) ?? `Site #${numVal}`;
    if (field === 'roomId') return maps.rooms.get(numVal) ?? `Ruang #${numVal}`;
    if (field === 'rackId') return maps.racks.get(numVal) ?? `Rak #${numVal}`;
    if (field === 'categoryId') return maps.categories.get(numVal) ?? `Kategori #${numVal}`;
    if (field === 'vendorId') return maps.vendors.get(numVal) ?? `Vendor #${numVal}`;
    if (field === 'modelId') return maps.models.get(numVal) ?? `Model #${numVal}`;
  }

  return String(val);
}

function areValuesEqual(field: string, beforeVal: unknown, afterVal: unknown): boolean {
  if (isBlank(beforeVal) && isBlank(afterVal)) return true;
  if (isBlank(beforeVal) !== isBlank(afterVal)) return false;

  if (field === 'archivedAt') return true;

  if (field === 'installedAt' || field === 'warrantyExpiry') {
    const t1 = new Date(String(beforeVal)).getTime();
    const t2 = new Date(String(afterVal)).getTime();
    if (!Number.isNaN(t1) && !Number.isNaN(t2)) return t1 === t2;
  }

  return String(beforeVal) === String(afterVal);
}

export function extractDeviceAuditChanges(
  action: string,
  beforeRaw: unknown,
  afterRaw: unknown,
  maps: DeviceAuditLookupMaps
): AuditFieldChange[] {
  const before = asRecord(beforeRaw);
  const after = asRecord(afterRaw);

  if (action === 'CREATE' && after) {
    const createFields = ['deviceCode', 'hostname', 'inventoryStatus', 'siteId', 'roomId', 'rackId'];
    return createFields
      .filter((f) => !isBlank(after[f]))
      .map((field) => ({
        field,
        label: FIELD_LABELS[field] || field,
        before: '-',
        after: formatFieldValue(field, after[field], maps),
      }));
  }

  if (action === 'RESTORE' && before && after) {
    return [
      {
        field: 'archivedAt',
        label: 'Status Arsip',
        before: 'Diarsipkan',
        after: 'Aktif Kembali',
      },
      ...(before.archiveReason
        ? [
            {
              field: 'archiveReason',
              label: 'Alasan Arsip Sebelumnya',
              before: String(before.archiveReason),
              after: '-',
            },
          ]
        : []),
    ];
  }

  if (!before || !after) return [];

  const changes: AuditFieldChange[] = [];
  for (const field of ORDERED_FIELDS) {
    if (action === 'ARCHIVE' && field === 'archivedAt') continue;
    const bVal = before[field];
    const aVal = after[field];
    if (areValuesEqual(field, bVal, aVal)) continue;
    changes.push({
      field,
      label: FIELD_LABELS[field] || field,
      before: formatFieldValue(field, bVal, maps),
      after: formatFieldValue(field, aVal, maps),
    });
  }
  return changes;
}
