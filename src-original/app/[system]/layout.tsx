import { AppShell } from '@/components/app-shell'

export default async function SystemLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ system: string }>
}) {
  const { system } = await params
  return (
    <AppShell systemId={system}>
      {children}
    </AppShell>
  )
}
