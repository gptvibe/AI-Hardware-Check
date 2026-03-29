export const downloadTextFile = (fileName: string, content: string): boolean => {
  if (typeof document === 'undefined') return false

  try {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    return true
  } catch {
    return false
  }
}
