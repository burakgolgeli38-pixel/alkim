'use client'

import { ThemeProvider } from '@/lib/theme-context'
import { ReactNode } from 'react'

export default function Providers({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>
}
