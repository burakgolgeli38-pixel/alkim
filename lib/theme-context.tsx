'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { ThemeColors, lightColors, darkColors } from './theme'

interface ThemeContextType {
  isDark: boolean
  toggle: () => void
  colors: ThemeColors
}

const ThemeContext = createContext<ThemeContextType | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('alkim-theme')
    if (saved === 'dark') setIsDark(true)
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    localStorage.setItem('alkim-theme', isDark ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', isDark)
  }, [isDark, mounted])

  const toggle = () => setIsDark(prev => !prev)
  const colors = isDark ? darkColors : lightColors

  // Hydration mismatch onlemek icin mount olana kadar light goster
  if (!mounted) {
    return (
      <ThemeContext.Provider value={{ isDark: false, toggle, colors: lightColors }}>
        {children}
      </ThemeContext.Provider>
    )
  }

  return (
    <ThemeContext.Provider value={{ isDark, toggle, colors }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
