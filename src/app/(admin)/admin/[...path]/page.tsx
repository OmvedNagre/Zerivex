import { redirect } from 'next/navigation';

export default async function LegacyAdminPage({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  redirect(path[0] === 'audit-logs' ? '/staff/audit' : path[0] === 'users' ? '/staff/staff' : '/staff');
}
