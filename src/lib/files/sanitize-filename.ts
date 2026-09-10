/** Имя файла для Storage: без путей и спецсимволов, с гарантированным расширением, ≤100 символов. */
export function sanitizeFilename(raw: string): string {
  const base = (raw || '').split('/').pop()!.split('\\').pop()!.trim()
  const dot = base.lastIndexOf('.')
  let name = dot > 0 ? base.slice(0, dot) : base
  let ext = dot > 0 ? base.slice(dot + 1) : ''
  const clean = (s: string) => s.replace(/[^A-Za-z0-9._-]/g, '_')
  name = clean(name).replace(/^_+|_+$/g, '') || 'file'
  ext = clean(ext) || 'bin'
  const safe = `${name}.${ext}`
  if (safe.length <= 100) return safe
  return `${name.slice(0, Math.max(1, 100 - ext.length - 1))}.${ext}`
}
