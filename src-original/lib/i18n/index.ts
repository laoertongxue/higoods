import { zhCN } from './zh-CN'

type Locale = 'zh-CN' | 'en-US'

const locales: Record<Locale, Record<string, string>> = {
  'zh-CN': zhCN,
  'en-US': {}, // 预留英文
}

let currentLocale: Locale = 'zh-CN'

export function setLocale(locale: Locale) {
  currentLocale = locale
}

export function getLocale(): Locale {
  return currentLocale
}

export function t(key: string, params?: Record<string, string | number>): string {
  const dict = locales[currentLocale]
  let text = dict[key] || key
  
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
    })
  }
  
  return text
}
