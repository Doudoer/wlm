"use client"

import { useEffect } from 'react'

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('Service worker registered:', reg.scope)
        })
        .catch((err) => {
          console.warn('Service worker registration failed:', err)
        })
    }

    // capture beforeinstallprompt globally so other components can use it
    function handleBeforeInstall(e: any) {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault()
      // Save the event on window so other components (sidebar) can access it
      ;(window as any).deferredPWAInstallPrompt = e
      console.log('beforeinstallprompt captured')
    }

    function handleAppInstalled() {
      console.log('PWA was installed')
      try {
        delete (window as any).deferredPWAInstallPrompt
      } catch (_) {}
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  return null
}
