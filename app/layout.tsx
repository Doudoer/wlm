import './globals.css'
import { ReactNode } from 'react'
import dynamic from 'next/dynamic'

const ServiceWorkerRegister = dynamic(() => import('../components/ServiceWorkerRegister'), { ssr: false })

export const metadata = {
  title: 'Next Supabase Chat',
  description: 'Chat app with Supabase realtime and Tailwind'
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#111827" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
      </head>
      <body className="bg-neutral-50 text-neutral-900">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
