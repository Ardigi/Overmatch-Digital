import DashboardContent from '@/components/dashboard/DashboardContent';
import { auth } from '@/lib/auth';

export default async function DashboardPage() {
  const session = await auth();

  return <DashboardContent userName={session?.user?.name} />;
}
