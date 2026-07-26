'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { AlertBanner } from '@/components/ui/AlertBanner'
import {
  NOTIFICATION_GROUPS,
  urlBase64ToUint8Array,
  type NotificationPreferences,
  type PreferenceKey,
} from '@/app/(public)/account/notification-preferences-shared'

interface NotificationSettings {
  preferences: NotificationPreferences
  pushEnabled: boolean
  vapidPublicKey: string | null
}

type PushState = 'unsupported' | 'unavailable' | 'off' | 'on'

const isPushSupported = (): boolean =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window

const getRegistration = async (): Promise<ServiceWorkerRegistration | null> => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null
  }
  return navigator.serviceWorker.ready
}

export function NotificationsSection() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null)
  const [pushState, setPushState] = useState<PushState>('unsupported')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/account/notifications')
      const data = await res.json()
      if (data.success) setSettings(data.data)
    } catch {
      setError('Could not load your notification preferences.')
    }
  }, [])

  useEffect(() => {
    const timer = globalThis.setTimeout(() => {
      void loadSettings()
    }, 0)

    return () => {
      globalThis.clearTimeout(timer)
    }
  }, [loadSettings])

  useEffect(() => {
    if (!settings) return
    let cancelled = false

    const resolvePushState = async (): Promise<PushState> => {
      if (!isPushSupported()) return 'unsupported'
      if (!settings.pushEnabled || !settings.vapidPublicKey)
        return 'unavailable'
      try {
        const registration = await getRegistration()
        const subscription = await registration?.pushManager.getSubscription()
        return subscription ? 'on' : 'off'
      } catch {
        return 'off'
      }
    }

    void resolvePushState().then((state) => {
      if (!cancelled) setPushState(state)
    })

    return () => {
      cancelled = true
    }
  }, [settings])

  const savePreference = useCallback(
    async (key: PreferenceKey, value: boolean) => {
      setBusy(true)
      setError('')
      try {
        const res = await fetch('/api/account/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [key]: value }),
        })
        const data = await res.json()
        if (!data.success) throw new Error('save failed')
        setSettings((current) =>
          current ? { ...current, preferences: data.data.preferences } : current
        )
      } catch {
        setError('Could not save your notification preferences.')
      } finally {
        setBusy(false)
      }
    },
    []
  )

  const enablePush = useCallback(async () => {
    if (!settings?.vapidPublicKey) return
    setBusy(true)
    setError('')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setError('Browser notification permission was not granted.')
        return
      }
      const registration = await getRegistration()
      if (!registration) throw new Error('no service worker')
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(settings.vapidPublicKey),
      })
      const res = await fetch('/api/account/push-subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      })
      if (!res.ok) throw new Error('subscribe failed')
      setPushState('on')
      await savePreference('transactionalPush', true)
    } catch {
      setError('Could not enable push notifications on this device.')
    } finally {
      setBusy(false)
    }
  }, [settings, savePreference])

  const disablePush = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      const registration = await getRegistration()
      const subscription = await registration?.pushManager.getSubscription()
      if (subscription) {
        await fetch('/api/account/push-subscriptions', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })
        await subscription.unsubscribe()
      }
      setPushState('off')
      await savePreference('transactionalPush', false)
    } catch {
      setError('Could not turn off push notifications on this device.')
    } finally {
      setBusy(false)
    }
  }, [savePreference])

  const preferences = settings?.preferences

  return (
    <Card className="p-6 sm:p-8 mb-6">
      <h2 className="text-xl font-bold text-[var(--foreground)] mb-2">
        Notifications
      </h2>
      <p className="text-sm text-[var(--text-muted)] mb-6">
        Choose how we reach you. Transactional messages cover your orders;
        marketing covers offers and reminders.
      </p>

      {error && (
        <AlertBanner message={error} variant="error" className="mb-4" />
      )}

      <div className="mb-6">
        <p className="text-sm font-medium text-[var(--text-muted)] mb-2">
          Browser push
        </p>
        {pushState === 'unsupported' && (
          <p className="text-xs text-[var(--text-muted)]">
            This browser does not support push notifications.
          </p>
        )}
        {pushState === 'unavailable' && (
          <p className="text-xs text-[var(--text-muted)]">
            Push notifications are not configured for this store yet.
          </p>
        )}
        {(pushState === 'on' || pushState === 'off') && (
          <button
            type="button"
            onClick={() =>
              void (pushState === 'on' ? disablePush() : enablePush())
            }
            disabled={busy}
            className="rounded-md border border-[var(--border-warm)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--foreground)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
          >
            {pushState === 'on'
              ? 'Turn off push on this device'
              : 'Enable push on this device'}
          </button>
        )}
      </div>

      {preferences &&
        NOTIFICATION_GROUPS.map((group) => (
          <fieldset key={group.category} className="mb-6 last:mb-0">
            <legend className="text-sm font-medium text-[var(--text-muted)] mb-1">
              {group.title}
            </legend>
            <p className="text-xs text-[var(--text-muted)] mb-3">
              {group.description}
            </p>
            <div className="flex flex-col gap-2">
              {group.channels.map((channel) => (
                <label
                  key={channel.key}
                  htmlFor={channel.key}
                  className="flex items-center gap-2 text-sm text-[var(--foreground)]"
                >
                  <input
                    id={channel.key}
                    type="checkbox"
                    aria-label={`${group.title}: ${channel.label}`}
                    checked={preferences[channel.key]}
                    disabled={busy}
                    onChange={(event) =>
                      void savePreference(channel.key, event.target.checked)
                    }
                    className="h-4 w-4 cursor-pointer accent-[var(--accent-rose)] disabled:opacity-50"
                  />
                  <span>{channel.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
    </Card>
  )
}
