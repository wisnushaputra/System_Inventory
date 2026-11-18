import { requireUser } from '@/lib/auth';

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <main className="space-y-2">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <p className="text-sm text-gray-600">
        Masuk sebagai <strong>{user.name}</strong> ({user.role.name})
      </p>
      <form action="/api/auth/logout" method="post">
        <button className="rounded border px-3 py-1 text-sm">Logout</button>
      </form>
    </main>
  );
}
