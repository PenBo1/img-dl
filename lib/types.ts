export type ImageCandidate = {
  id: string
  originalUrl: string
  bestUrl: string
  width?: number
  height?: number
  format?: string
  sourceType: "img" | "source" | "lazy" | "background" | "unknown"
  srcset?: string
}

export type DownloadItem = {
  id: string
  filename: string
  folder: string
  downloadUrl: string
  originalUrl: string
  width?: number
  height?: number
  format?: string
  status: "queued" | "downloading" | "done" | "failed"
  bytes?: number
  error?: string
}

export type DownloadMetadata = {
  pageTitle: string
  pageUrl: string
  timestamp: string
  items: DownloadItem[]
}

export type DownloadConfig = {
  defaultFormat: "original" | "png" | "jpg"
  jpgQuality: number
  autoDownload: boolean
  includeBackgroundImages: boolean
  theme: "light" | "dark" | "system"
  maxConcurrency: number
}

export type ScanResult = {
  pageTitle: string
  pageUrl: string
  images: ImageCandidate[]
}

export type PopupProgress = {
  sessionId: string
  total: number
  done: number
  failed: number
}
