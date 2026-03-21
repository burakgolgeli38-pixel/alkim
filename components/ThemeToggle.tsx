'use client'

import { useTheme } from '@/lib/theme-context'

export default function ThemeToggle() {
  const { isDark, toggle, colors } = useTheme()

  return (
    <button
      onClick={toggle}
      className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-105"
      style={{ background: colors.inputBg, border: `1px solid ${colors.borderColor}` }}
      title={isDark ? 'Acik tema' : 'Koyu tema'}
    >
      {isDark ? (
        // Gunes ikonu - light mode'a gec
        <svg className="w-[18px] h-[18px]" fill="none" stroke={colors.orange} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        // Ay ikonu - dark mode'a gec
        <svg className="w-[18px] h-[18px]" fill="none" stroke={colors.textMuted} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  )
}
