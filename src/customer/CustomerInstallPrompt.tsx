import { useEffect, useState } from 'react'

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const DISMISSED_KEY = 'bikeai_install_prompt_dismissed'

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export default function CustomerInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISSED_KEY) === 'true') return

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setPromptEvent(event as InstallPromptEvent)
      setVisible(true)
    }

    const onInstalled = () => {
      setVisible(false)
      setPromptEvent(null)
      localStorage.setItem(DISMISSED_KEY, 'true')
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (!visible || !promptEvent) return null

  const install = async () => {
    await promptEvent.prompt()
    const choice = await promptEvent.userChoice
    if (choice.outcome === 'accepted') {
      localStorage.setItem(DISMISSED_KEY, 'true')
    }
    setVisible(false)
    setPromptEvent(null)
  }

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'true')
    setVisible(false)
    setPromptEvent(null)
  }

  return (
    <div style={s.wrap}>
      <span style={s.text}>Install app</span>
      <button type="button" onClick={install} style={s.install}>Install</button>
      <button type="button" onClick={dismiss} style={s.dismiss} aria-label="Dismiss install prompt">x</button>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px 6px 10px', background: '#fff8dc', border: '1px solid #f5d56b', borderRadius: '18px' },
  text: { fontSize: '12px', fontWeight: 700, color: '#614700', whiteSpace: 'nowrap' },
  install: { border: 'none', background: '#0f2044', color: 'white', borderRadius: '14px', padding: '5px 10px', fontSize: '12px', fontWeight: 700 },
  dismiss: { border: 'none', background: 'transparent', color: '#8a6a00', fontSize: '18px', lineHeight: 1, padding: '0 2px' },
}
