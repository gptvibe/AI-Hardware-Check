export const loadJsonStorage = <T>(
  key: string,
  parse?: (value: unknown) => T | null,
): T | null => {
  if (typeof window === 'undefined') return null
  try {
    const stored = window.localStorage.getItem(key)
    if (!stored) return null
    const parsed = JSON.parse(stored) as unknown
    if (parse) return parse(parsed)
    return parsed as T
  } catch {
    return null
  }
}

export const saveJsonStorage = (key: string, value: unknown) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore storage failures.
  }
}
