import { requireUser } from '@/lib/auth';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <div className="p-6">{children}</div>;
}
