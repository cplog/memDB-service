import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getAccessibleTeams } from '@/lib/teams'
import { AppShell } from '@/components/app-shell'

export default async function HomePage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const teams = getAccessibleTeams(user)

  return <AppShell user={user} teams={teams} />
}
