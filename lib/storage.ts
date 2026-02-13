import { Storage } from "@plasmohq/storage"

import type { DownloadConfig } from "./types"

const storage = new Storage({
  area: "local"
})

export const defaultConfig: DownloadConfig = {
  defaultFormat: "original",
  jpgQuality: 0.9,
  autoDownload: false,
  includeBackgroundImages: false,
  theme: "system",
  maxConcurrency: 4
}

export const getConfig = async (): Promise<DownloadConfig> => {
  const stored = await storage.get<DownloadConfig>("config")
  return { ...defaultConfig, ...(stored ?? {}) }
}

export const setConfig = async (next: DownloadConfig): Promise<void> => {
  await storage.set("config", next)
}

export const listenConfig = (
  handler: (value: DownloadConfig) => void
): (() => void) => {
  const listener = (changes: Record<string, { newValue?: unknown }>) => {
    if (changes.config?.newValue) {
      handler(changes.config.newValue as DownloadConfig)
    }
  }

  storage.watch({
    config: listener
  })

  return () => storage.unwatch({ config: listener })
}
