export const CUSTOMER_LANGUAGES = ['en', 'hi', 'te', 'ta', 'kn', 'ml', 'mr'] as const

export type CustomerLanguage = typeof CUSTOMER_LANGUAGES[number]

export interface CustomerLanguageOption {
  code: CustomerLanguage
  label: string
  speechLocale: string
}

export interface CustomerCopy {
  language: string
  languageName: string
  chatPlaceholder: string
  listening: string
  voiceInput: string
  voiceUnavailable: string
  voiceReplyOn: string
  voiceReplyOff: string
  replyLanguageInstruction: string
}

export const LANGUAGE_STORAGE_KEY = 'bikeai_customer_language'

export const CUSTOMER_LANGUAGE_OPTIONS: CustomerLanguageOption[] = [
  { code: 'en', label: 'English', speechLocale: 'en-IN' },
  { code: 'hi', label: 'Hindi', speechLocale: 'hi-IN' },
  { code: 'te', label: 'Telugu', speechLocale: 'te-IN' },
  { code: 'ta', label: 'Tamil', speechLocale: 'ta-IN' },
  { code: 'kn', label: 'Kannada', speechLocale: 'kn-IN' },
  { code: 'ml', label: 'Malayalam', speechLocale: 'ml-IN' },
  { code: 'mr', label: 'Marathi', speechLocale: 'mr-IN' },
]

const ENGLISH_FIRST_COPY: Omit<CustomerCopy, 'languageName'> = {
  language: 'Language',
  chatPlaceholder: 'Book service, track repair, report issue...',
  listening: 'Listening...',
  voiceInput: 'Voice input',
  voiceUnavailable: 'Voice input unavailable',
  voiceReplyOn: 'Voice replies on',
  voiceReplyOff: 'Voice replies off',
  replyLanguageInstruction:
    'Reply in English by default. If the customer asks for another supported Indian language, keep the answer short and clear.',
}

export const CUSTOMER_COPY: Record<CustomerLanguage, CustomerCopy> = {
  en: { ...ENGLISH_FIRST_COPY, languageName: 'English' },
  hi: { ...ENGLISH_FIRST_COPY, languageName: 'Hindi' },
  te: { ...ENGLISH_FIRST_COPY, languageName: 'Telugu' },
  ta: { ...ENGLISH_FIRST_COPY, languageName: 'Tamil' },
  kn: { ...ENGLISH_FIRST_COPY, languageName: 'Kannada' },
  ml: { ...ENGLISH_FIRST_COPY, languageName: 'Malayalam' },
  mr: { ...ENGLISH_FIRST_COPY, languageName: 'Marathi' },
}

export function isCustomerLanguage(value: unknown): value is CustomerLanguage {
  return typeof value === 'string' && CUSTOMER_LANGUAGES.includes(value as CustomerLanguage)
}

export function normalizeCustomerLanguage(value: unknown, fallback: CustomerLanguage = 'en'): CustomerLanguage {
  return isCustomerLanguage(value) ? value : fallback
}

export function readStoredCustomerLanguage(fallback: CustomerLanguage = 'en'): CustomerLanguage {
  if (typeof window === 'undefined') return fallback
  return normalizeCustomerLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY), fallback)
}

export function writeStoredCustomerLanguage(language: CustomerLanguage) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
}

export function getCustomerCopy(language?: CustomerLanguage): CustomerCopy {
  return CUSTOMER_COPY[language ?? 'en'] ?? CUSTOMER_COPY.en
}

export function speechLocaleForLanguage(language?: CustomerLanguage): string {
  return CUSTOMER_LANGUAGE_OPTIONS.find(option => option.code === language)?.speechLocale ?? 'en-IN'
}
