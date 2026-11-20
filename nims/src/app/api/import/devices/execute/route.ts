import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiPermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { validateHostIp } from '@/lib/ipam';
import {
  parseDeviceCsv,
  validateDeviceRows,
  LookupData,
  ImportErrorDetail,
} from '@/lib/device-import';

export async function POST(req: Request) {
  const { user, errorResponse } = await requireApiPermission('device.create', req);
  if (errorResponse) return errorResponse;

  let csvText = '';
  const contentType = req.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ message: 'Gagal memproses form-data' }, { status: 400 });
    }
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ message: 'Berkas CSV tidak ditemukan dalam unggahan' }, { status: 400 });
    }
    const blob = file as Blob;
    csvText = await blob.text();
  } else {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.csvText !== 'string') {
      return NextResponse.json({ message: 'Payload csvText wajib disertakan' }, { status: 400 });
    }
    csvText = body.csvText;
  }

  const { rows, headerError } = parseDeviceCsv(csvText);
  if (headerError) {
    return NextResponse.json({ message: headerError }, { status: 400 });
  }

  // Load latest lookups
  const [existingDevices, categories, vendors, sites, existingSubnets] = await Promise.all([
    prisma.device.findMany({ select: { deviceCode: true } }),
    prisma.deviceCategory.findMany({ select: { id: true, code: true, name: true } }),
    prisma.vendor.findMany({ select: { id: true, name: true } }),
    prisma.site.findMany({ select: { id: true, siteCode: true, name: true } }),
    prisma.subnet.findMany({ select: { id: true, cidr: true, name: true } }),
  ]);

  const existingCodes = new Set<string>(existingDevices.map((d) => d.deviceCode.toUpperCase()));

  const lookups: LookupData = {
    existingCodes,
    categories,
    vendors,
    sites,
  };

  const { validRows, errors: validationErrors } = validateDeviceRows(rows, lookups);
  const allErrors: ImportErrorDetail[] = [...validationErrors];
  const createdDevices: Array<{ id: number; deviceCode: string; hostname: string }> = [];

  // Eksekusi baris valid satu per satu (isolated per row)
  for (const row of validRows) {
    try {
      // 1. Resolve or create Model if specified
      let modelId: number | null = null;
      if (row.modelName) {
        const foundModel = await prisma.deviceModel.findFirst({
          where: {
            vendorId: row.vendorId,
            OR: [
              { modelName: { equals: row.modelName, mode: 'insensitive' } },
              { modelCode: { equals: row.modelName, mode: 'insensitive' } },
            ],
          },
        });

        if (foundModel) {
          modelId = foundModel.id;
        } else {
          // Buat DeviceModel baru secara otomatis
          const safeCode = row.modelName.toUpperCase().replace(/[^A-Z0-9_-]/g, '-').slice(0, 30);
          const uniqueModelCode = `${safeCode}-${Date.now().toString().slice(-4)}`;
          const newModel = await prisma.deviceModel.create({
            data: {
              vendorId: row.vendorId,
              categoryId: row.categoryId,
              modelName: row.modelName,
              modelCode: uniqueModelCode,
              description: 'Dibuat otomatis dari impor CSV',
            },
          });
          modelId = newModel.id;
        }
      }

      // 2. Buat record Device
      const newDevice = await prisma.device.create({
        data: {
          deviceCode: row.deviceCode,
          hostname: row.hostname,
          categoryId: row.categoryId,
          vendorId: row.vendorId,
          modelId,
          siteId: row.siteId,
          serialNumber: row.serialNumber || null,
          networkRole: row.networkRole || null,
          inventoryStatus: row.inventoryStatus,
          description: row.description || null,
          createdBy: user.id,
          updatedBy: user.id,
        },
      });

      // 3. Alokasikan management IP jika ada
      if (row.managementIp) {
        try {
          // Cari subnet yang cocok
          let matchedSubnet = existingSubnets.find((s) => validateHostIp(row.managementIp!, s.cidr).valid);

          if (!matchedSubnet) {
            // Buat subnet /24 otomatis jika belum ada
            const octets = row.managementIp.split('.');
            const autoCidr = `${octets[0]}.${octets[1]}.${octets[2]}.0/24`;

            let autoSubnet = await prisma.subnet.findUnique({ where: { cidr: autoCidr } });
            if (!autoSubnet) {
              autoSubnet = await prisma.subnet.create({
                data: {
                  name: `Subnet ${autoCidr} (Auto-Import)`,
                  cidr: autoCidr,
                  siteId: row.siteId,
                  purpose: 'management',
                  status: 'active',
                },
              });
              existingSubnets.push(autoSubnet);
            }
            matchedSubnet = autoSubnet;
          }

          if (matchedSubnet) {
            await prisma.ipAddress.upsert({
              where: {
                subnetId_address: {
                  subnetId: matchedSubnet.id,
                  address: row.managementIp,
                },
              },
              update: {
                deviceId: newDevice.id,
                purpose: 'management',
                allocationStatus: 'ALLOCATED',
                hostname: newDevice.hostname,
              },
              create: {
                subnetId: matchedSubnet.id,
                address: row.managementIp,
                deviceId: newDevice.id,
                purpose: 'management',
                allocationStatus: 'ALLOCATED',
                hostname: newDevice.hostname,
              },
            });
          }
        } catch (ipErr) {
          console.warn(`Gagal mengalokasikan IP ${row.managementIp} untuk ${newDevice.deviceCode}:`, ipErr);
        }
      }

      createdDevices.push({
        id: newDevice.id,
        deviceCode: newDevice.deviceCode,
        hostname: newDevice.hostname,
      });
    } catch (insertErr) {
      allErrors.push({
        rowNumber: row.rowNumber,
        deviceCode: row.deviceCode,
        hostname: row.hostname,
        error: insertErr instanceof Error ? insertErr.message : 'Gagal menyimpan perangkat ke database',
      });
    }
  }

  // T8.2 Catat hasil impor ke audit log
  await logAudit({
    userId: user.id,
    action: 'IMPORT',
    entityType: 'Device',
    afterData: {
      totalRows: rows.length,
      successCount: createdDevices.length,
      failedCount: allErrors.length,
      createdDeviceCodes: createdDevices.map((d) => d.deviceCode),
      errors: allErrors,
    },
    req,
  });

  return NextResponse.json({
    success: true,
    message: `Impor selesai: ${createdDevices.length} berhasil disimpan, ${allErrors.length} baris gagal.`,
    totalRows: rows.length,
    successCount: createdDevices.length,
    failedCount: allErrors.length,
    errors: allErrors.sort((a, b) => a.rowNumber - b.rowNumber),
    createdDevices,
  });
}
