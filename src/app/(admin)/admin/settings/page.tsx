import { getSettings } from '@/lib/admin/settings'
import { SettingsForm } from '@/components/admin/settings-form'

export default async function AdminSettingsPage() {
  const settings = await getSettings()

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Feature flags, rate limits and round times. Changes take effect within 30 seconds.
        </p>
      </div>

      <SettingsForm initial={settings} />
    </>
  )
}
