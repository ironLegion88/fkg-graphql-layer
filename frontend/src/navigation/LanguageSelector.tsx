import React from 'react'
import { Languages } from 'lucide-react'
import './LanguageSelector.css'

export interface LanguageSelectorProps {
  preferredLanguages?: string[]
  currentLanguage: string
  onLanguageChange: (lang: string) => void
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English (en)',
  fr: 'Français (fr)',
  it: 'Italiano (it)',
  de: 'Deutsch (de)',
  es: 'Español (es)',
  hi: 'हिंदी (hi)',
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  preferredLanguages = ['en'],
  currentLanguage,
  onLanguageChange,
}) => {
  // If no languages provided, default to en
  const languages = preferredLanguages.length > 0 ? preferredLanguages : ['en']

  return (
    <div className="language-selector" aria-label="Language preference selector">
      <span className="lang-icon" aria-hidden="true">
        <Languages size={14} />
      </span>
      <select
        className="lang-select"
        value={currentLanguage}
        onChange={(e) => onLanguageChange(e.target.value)}
        aria-label="Display language preference"
        title="Select display language for multilingual labels and descriptions"
      >
        {languages.map((code) => (
          <option key={code} value={code}>
            {LANGUAGE_NAMES[code] ?? code.toUpperCase()}
          </option>
        ))}
      </select>
    </div>
  )
}

export default LanguageSelector
