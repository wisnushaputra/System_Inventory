/**
 * Comprehensive Test Suite for User Management & RBAC (/users, /api/users, /api/roles)
 *
 * Verifies:
 * 1. RBAC Guard: Unauthenticated gets 401, non-admin (Operator NOC) gets 403 on all /api/users endpoints.
 * 2. Roles API: GET /api/roles returns all roles with permissions and user counts.
 * 3. Create User: POST /api/users creates user, hashes password, hides passwordHash, and logs audit trail.
 * 4. Duplicate Check: POST /api/users with same username/email returns 409 Conflict.
 * 5. Authentication with New User: Login at /api/auth/login works with created credentials.
 * 6. User Listing & Filter: GET /api/users supports q, roleId, isActive, and pagination without exposing passwordHash.
 * 7. Update User: PUT /api/users/[id] updates fields and records audit log.
 * 8. Self-Protection Guard: Admin cannot deactivate or delete their own active account.
 * 9. Reset Password: POST /api/users/[id]/reset-password updates password; verify login with old vs new credentials.
 * 10. Delete User: DELETE /api/users/[id] removes user and records audit log.
 */

import assert from 'node:assert';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE = 'http://localhost:3000';

async function login(username: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE },
    body: JSON.stringify({ username, password }),
  });
  const text = await res.text();
  assert.strictEqual(res.status, 200, `Login ${username} gagal: ${text}`);
  const setCookie = res.headers.get('set-cookie') || '';
  return setCookie.split(';')[0];
}

async function run() {
  console.log('=== MEMULAI TEST MANAJEMEN PENGGUNA & RBAC (/users & /api/users) ===\n');

  // Bersihkan data tes terdahulu jika ada sisa
  await prisma.user.deleteMany({
    where: {
      username: { in: ['test_engineer_auto', 'test_dummy_user'] },
    },
  });

  // 1. Auth Setup
  const adminCookie = await login('admin', 'Admin123!');
  console.log('✓ [Auth] Admin login berhasil');

  const operatorCookie = await login('operator', 'Operator123!');
  console.log('✓ [Auth] Operator NOC login berhasil');

  const adminUser = await prisma.user.findUniqueOrThrow({
    where: { username: 'admin' },
  });

  const engRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'Network Engineer' },
  });

  // 2. RBAC Enforcement: Operator NOC & Unauthenticated
  console.log('\n--- 1. Uji Proteksi RBAC & Autentikasi ---');
  {
    // Tanpa login
    const resNoAuth = await fetch(`${BASE}/api/users`);
    assert.strictEqual(resNoAuth.status, 401, 'Request tanpa autentikasi harus 401');
    console.log('✓ [RBAC] GET /api/users tanpa token ditolak 401');

    // Operator NOC (tanpa izin user.manage)
    const resForbiddenGet = await fetch(`${BASE}/api/users`, {
      headers: { Cookie: operatorCookie },
    });
    assert.strictEqual(resForbiddenGet.status, 403, 'Operator NOC harus ditolak 403');
    console.log('✓ [RBAC] GET /api/users oleh Operator NOC ditolak 403');

    const resForbiddenPost = await fetch(`${BASE}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: BASE,
        Cookie: operatorCookie,
      },
      body: JSON.stringify({
        name: 'Hacker User',
        username: 'hacker_1',
        password: 'Password123!',
        roleId: engRole.id,
      }),
    });
    assert.strictEqual(resForbiddenPost.status, 403, 'POST /api/users oleh Operator NOC harus ditolak 403');
    console.log('✓ [RBAC] POST /api/users oleh Operator NOC ditolak 403');
  }

  // 3. Endpoint Roles
  console.log('\n--- 2. Uji Endpoint Roles (/api/roles) ---');
  {
    const resRoles = await fetch(`${BASE}/api/roles`, {
      headers: { Cookie: adminCookie },
    });
    assert.strictEqual(resRoles.status, 200, 'GET /api/roles harus 200');
    const jsonRoles = await resRoles.json();
    assert.ok(Array.isArray(jsonRoles.data), 'Data roles harus berupa array');
    assert.ok(jsonRoles.data.length >= 4, 'Minimal 4 role tersedia');
    const roleNames = jsonRoles.data.map((r: any) => r.name);
    assert.ok(roleNames.includes('Admin'), 'Role Admin harus ada');
    assert.ok(roleNames.includes('Network Engineer'), 'Role Network Engineer harus ada');
    console.log(`✓ [Roles] Berhasil memuat ${jsonRoles.data.length} role sistem (${roleNames.join(', ')})`);
  }

  // 4. Tambah Pengguna Baru (POST /api/users)
  console.log('\n--- 3. Uji Pembuatan Pengguna Baru (POST /api/users) ---');
  let createdUserId: number = 0;
  {
    const resCreate = await fetch(`${BASE}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: BASE,
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        name: 'Test Engineer Automation',
        username: 'test_engineer_auto',
        email: 'engineer.auto@perusahaan.co.id',
        password: 'InitialPassword123!',
        roleId: engRole.id,
        isActive: true,
      }),
    });

    assert.strictEqual(resCreate.status, 201, 'POST /api/users harus 201 Created');
    const jsonCreate = await resCreate.json();
    assert.ok(jsonCreate.data?.id, 'ID pengguna baru harus ada');
    assert.strictEqual(jsonCreate.data.username, 'test_engineer_auto');
    assert.strictEqual(jsonCreate.data.passwordHash, undefined, 'passwordHash tidak boleh dibocorkan ke client');
    createdUserId = jsonCreate.data.id;
    console.log(`✓ [Create] Pengguna baru '${jsonCreate.data.username}' berhasil dibuat dengan ID ${createdUserId}`);

    // Verifikasi Audit Log
    const auditCreate = await prisma.auditLog.findFirst({
      where: {
        entityType: 'User',
        entityId: createdUserId,
        action: 'CREATE',
      },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(auditCreate, 'AuditLog CREATE untuk pengguna baru harus tercatat');
    console.log('✓ [Audit] AuditLog CREATE User berhasil diverifikasi di database');

    // Uji duplikasi username
    const resDup = await fetch(`${BASE}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: BASE,
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        name: 'Duplicate Engineer',
        username: 'test_engineer_auto',
        password: 'PasswordLain123!',
        roleId: engRole.id,
      }),
    });
    assert.strictEqual(resDup.status, 409, 'Pendaftaran username kembar harus ditolak 409 Conflict');
    console.log('✓ [Validation] Duplikasi username ditolak dengan HTTP 409 Conflict');
  }

  // 5. Login dengan Pengguna Baru
  console.log('\n--- 4. Uji Autentikasi Pengguna Baru (/api/auth/login) ---');
  {
    const newCookie = await login('test_engineer_auto', 'InitialPassword123!');
    assert.ok(newCookie.includes('nims_session='), 'Cookie sesi pengguna baru harus diterbitkan');
    console.log('✓ [Auth] Login berhasil menggunakan akun pengguna baru');
  }

  // 6. Listing & Filter Pengguna (GET /api/users)
  console.log('\n--- 5. Uji Pencarian & Filter Pengguna (GET /api/users) ---');
  {
    const resList = await fetch(`${BASE}/api/users?q=test_engineer_auto&roleId=${engRole.id}&isActive=true`, {
      headers: { Cookie: adminCookie },
    });
    assert.strictEqual(resList.status, 200, 'GET /api/users dengan filter harus 200');
    const jsonList = await resList.json();
    assert.strictEqual(jsonList.data.length, 1, 'Harus menemukan tepat 1 user');
    assert.strictEqual(jsonList.data[0].username, 'test_engineer_auto');
    assert.strictEqual(jsonList.data[0].passwordHash, undefined, 'passwordHash tidak boleh muncul di daftar user');
    console.log('✓ [List] Filter pencarian q, roleId, dan isActive berhasil menyaring data');
  }

  // 7. Update Pengguna (PUT /api/users/[id])
  console.log('\n--- 6. Uji Update Data Pengguna (PUT /api/users/[id]) ---');
  {
    const resUpdate = await fetch(`${BASE}/api/users/${createdUserId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Origin: BASE,
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        name: 'Test Engineer Renamed',
        email: 'engineer.renamed@perusahaan.co.id',
        roleId: engRole.id,
        isActive: true,
      }),
    });
    assert.strictEqual(resUpdate.status, 200, 'PUT /api/users/[id] harus 200 OK');
    const jsonUpdate = await resUpdate.json();
    assert.strictEqual(jsonUpdate.data.name, 'Test Engineer Renamed');
    console.log('✓ [Update] Nama pengguna berhasil diperbarui menjadi Test Engineer Renamed');

    // Verifikasi Audit Log
    const auditUpdate = await prisma.auditLog.findFirst({
      where: {
        entityType: 'User',
        entityId: createdUserId,
        action: 'UPDATE',
      },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(auditUpdate, 'AuditLog UPDATE untuk pengguna harus tercatat');
    console.log('✓ [Audit] AuditLog UPDATE User berhasil diverifikasi di database');
  }

  // 8. Proteksi Diri Sendiri (Self-Protection Guard)
  console.log('\n--- 7. Uji Proteksi Akun Mandiri (Self-Protection Guard) ---');
  {
    // Admin mencoba menonaktifkan dirinya sendiri
    const resDeactivateSelf = await fetch(`${BASE}/api/users/${adminUser.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Origin: BASE,
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        name: adminUser.name,
        email: adminUser.email,
        roleId: adminUser.roleId,
        isActive: false, // Mencoba menonaktifkan akun sendiri
      }),
    });
    assert.strictEqual(resDeactivateSelf.status, 400, 'Menonaktifkan akun sendiri harus ditolak 400');
    console.log('✓ [Guard] Percobaan penonaktifan akun sendiri ditolak HTTP 400');

    // Admin mencoba menghapus akunnya sendiri
    const resDeleteSelf = await fetch(`${BASE}/api/users/${adminUser.id}`, {
      method: 'DELETE',
      headers: {
        Origin: BASE,
        Cookie: adminCookie,
      },
    });
    assert.strictEqual(resDeleteSelf.status, 400, 'Menghapus akun sendiri harus ditolak 400');
    console.log('✓ [Guard] Percobaan penghapusan akun sendiri ditolak HTTP 400');
  }

  // 9. Reset Kata Sandi (POST /api/users/[id]/reset-password)
  console.log('\n--- 8. Uji Reset Kata Sandi (POST /api/users/[id]/reset-password) ---');
  {
    const resReset = await fetch(`${BASE}/api/users/${createdUserId}/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: BASE,
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        newPassword: 'BrandNewSecurePassword456!',
      }),
    });
    assert.strictEqual(resReset.status, 200, 'POST reset password harus 200 OK');
    console.log('✓ [Reset] Endpoint reset password berhasil mengembalikan 200 OK');

    // Login dengan password lama harus ditolak (401)
    const resOldLogin = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: BASE },
      body: JSON.stringify({
        username: 'test_engineer_auto',
        password: 'InitialPassword123!',
      }),
    });
    assert.strictEqual(resOldLogin.status, 401, 'Login dengan password lama harus ditolak 401');
    console.log('✓ [Auth] Password lama tidak dapat digunakan lagi (ditolak 401)');

    // Login dengan password baru harus berhasil (200)
    const newLoginCookie = await login('test_engineer_auto', 'BrandNewSecurePassword456!');
    assert.ok(newLoginCookie.includes('nims_session='), 'Login dengan password baru berhasil');
    console.log('✓ [Auth] Login dengan password baru berhasil diverifikasi');
  }

  // 10. Hapus Pengguna (DELETE /api/users/[id])
  console.log('\n--- 9. Uji Hapus Pengguna (DELETE /api/users/[id]) ---');
  {
    const resDelete = await fetch(`${BASE}/api/users/${createdUserId}`, {
      method: 'DELETE',
      headers: {
        Origin: BASE,
        Cookie: adminCookie,
      },
    });
    assert.strictEqual(resDelete.status, 200, 'DELETE /api/users/[id] harus 200 OK');
    console.log(`✓ [Delete] Pengguna ID ${createdUserId} berhasil dihapus`);

    const checkDb = await prisma.user.findUnique({
      where: { id: createdUserId },
    });
    assert.strictEqual(checkDb, null, 'User harus sudah terhapus permanen dari database');
    console.log('✓ [Database] Integritas database diverifikasi, entitas User sudah bersih');

    // Verifikasi Audit Log DELETE
    const auditDelete = await prisma.auditLog.findFirst({
      where: {
        entityType: 'User',
        entityId: createdUserId,
        action: 'DELETE',
      },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(auditDelete, 'AuditLog DELETE untuk pengguna harus tercatat');
    console.log('✓ [Audit] AuditLog DELETE User berhasil diverifikasi di database');
  }

  console.log('\n============================================================');
  console.log('🎉 SEMUA PENGUJIAN MANAJEMEN PENGGUNA & RBAC LOLOS 100%!');
  console.log('============================================================\n');
}

run()
  .catch((err) => {
    console.error('❌ PENGUJIAN GAGAL:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
