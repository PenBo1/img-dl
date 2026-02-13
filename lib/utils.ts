export const sanitizeFolderName = (name: string): string => {
  const cleaned = name
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, " ")
  return cleaned.length > 0 ? cleaned : "download"
}

export const guessFormat = (url: string): string | undefined => {
  try {
    const { pathname } = new URL(url)
    const ext = pathname.split(".").pop()?.toLowerCase()
    if (!ext) return undefined
    if (ext === "jpeg") return "jpg"
    return ext
  } catch {
    return undefined
  }
}

export const extractFileName = (url: string): string | undefined => {
  try {
    const { pathname } = new URL(url)
    const name = pathname.split("/").pop()
    if (!name || !name.includes(".")) return undefined
    return decodeURIComponent(name)
  } catch {
    return undefined
  }
}

export const buildIndexedName = (
  index: number,
  format: string | undefined
): string => {
  const padded = String(index).padStart(4, "0")
  const suffix = format ? `.${format}` : ""
  return `img_${padded}${suffix}`
}

export const ensureExtension = (filename: string, format: string): string => {
  if (filename.toLowerCase().endsWith(`.${format}`)) return filename
  const base = filename.replace(/\.[^/.]+$/, "")
  return `${base}.${format}`
}

export const formatToMime = (format: string): string => {
  const normalized = format.toLowerCase()
  switch (normalized) {
    case "png":
      return "image/png"
    case "jpg":
    case "jpeg":
      return "image/jpeg"
    case "webp":
      return "image/webp"
    case "gif":
      return "image/gif"
    case "avif":
      return "image/avif"
    case "svg":
      return "image/svg+xml"
    default:
      return "application/octet-stream"
  }
}
