import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PR Review Metrics Dashboard',
  description: 'GitHub PR review analytics and insights',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
