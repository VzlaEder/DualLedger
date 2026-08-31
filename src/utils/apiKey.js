const STORAGE_KEY = 'gemini_api_key'

export function getApiKey() {
  return localStorage.getItem(STORAGE_KEY) || ''
}

export function setApiKey(key) {
  if (key && key.trim()) {
    localStorage.setItem(STORAGE_KEY, key.trim())
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
}

export function hasApiKey() {
  return !!getApiKey()
}

export function isOAuthToken(key) {
  return typeof key === 'string' && key.startsWith('AQ.')
}
