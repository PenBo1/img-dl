import type {
  DownloadConfig,
  DownloadItem,
  DownloadMetadata,
  ImageCandidate,
  PopupProgress,
  ScanResult
} from "./lib/types"
import {
  MSG_CANCEL,
  MSG_CONVERT,
  MSG_PROGRESS,
  MSG_SCAN,
  MSG_START_DOWNLOAD
} from "./lib/messages"
import { getConfig } from "./lib/storage"
import {
  buildIndexedName,
  ensureExtension,
  extractFileName,
  formatToMime,
  guessFormat,
  sanitizeFolderName
} from "./lib/utils"

type DownloadTask = {
  candidate: ImageCandidate
  index: number
}

type SessionState = {
  sessionId: string
  pageTitle: string
  pageUrl: string
  folder: string
  config: DownloadConfig
  tabId: number
  total: number
  done: number
  failed: number
  queue: DownloadTask[]
  results: DownloadItem[]
  active: number
  cancelled: boolean
}

let currentSession: SessionState | null = null
const autoDownloadedUrl = new Map<number, string>()

const sendProgress = (state: SessionState) => {
  const progress: PopupProgress = {
    sessionId: state.sessionId,
    total: state.total,
    done: state.done,
    failed: state.failed
  }
  chrome.runtime.sendMessage({ type: MSG_PROGRESS, payload: progress })
}

const updateBadge = (tabId: number, count: number) => {
  const text = count > 0 ? String(Math.min(count, 99)) : ""
  chrome.action.setBadgeText({ tabId, text })
  chrome.action.setBadgeBackgroundColor({ tabId, color: "#ef4444" })
}

const fetchArrayBuffer = async (url: string): Promise<ArrayBuffer> => {
  const response = await fetch(url, { credentials: "include" })
  if (!response.ok) {
    throw new Error(`请求失败：${response.status}`)
  }
  return await response.arrayBuffer()
}

const convertBuffer = async (
  tabId: number,
  buffer: ArrayBuffer,
  targetFormat: "png" | "jpg",
  quality: number
): Promise<{ buffer: ArrayBuffer; width: number; height: number }> => {
  // 关键逻辑：通过 content script 调用 Canvas 转换，确保 Firefox 也可用
  const result = await new Promise<{
    ok: boolean
    buffer?: ArrayBuffer
    width?: number
    height?: number
    error?: string
  }>((resolve) => {
    chrome.tabs.sendMessage(
      tabId,
      {
        type: MSG_CONVERT,
        payload: { buffer, targetFormat, quality }
      },
      (response) => resolve(response)
    )
  })

  if (!result?.ok || !result.buffer) {
    throw new Error(result?.error || "转换失败")
  }

  return { buffer: result.buffer, width: result.width || 0, height: result.height || 0 }
}

const buildFilename = (
  candidate: ImageCandidate,
  index: number,
  format: string
): string => {
  const originalName = extractFileName(candidate.bestUrl)
  if (originalName) return ensureExtension(originalName, format)
  return buildIndexedName(index, format)
}

const processQueue = async () => {
  const state = currentSession
  if (!state || state.cancelled) return

  while (state.active < state.config.maxConcurrency && state.queue.length > 0) {
    const task = state.queue.shift()
    if (!task) break
    state.active += 1
    handleTask(state, task)
      .catch((error) => {
        state.failed += 1
        state.results.push({
          id: task.candidate.id,
          filename: buildFilename(
            task.candidate,
            task.index,
            task.candidate.format || "jpg"
          ),
          folder: state.folder,
          downloadUrl: task.candidate.bestUrl,
          originalUrl: task.candidate.originalUrl,
          width: task.candidate.width,
          height: task.candidate.height,
          format: task.candidate.format,
          status: "failed",
          error: error?.message || "下载失败"
        })
      })
      .finally(() => {
        state.active -= 1
        sendProgress(state)
        if (state.queue.length === 0 && state.active === 0) {
          finalizeSession(state).catch(() => null)
        } else {
          processQueue()
        }
      })
  }
}

const handleTask = async (state: SessionState, task: DownloadTask) => {
  if (state.cancelled) return

  const buffer = await fetchArrayBuffer(task.candidate.bestUrl)
  const originalFormat =
    task.candidate.format || guessFormat(task.candidate.bestUrl) || "jpg"

  let outputBuffer = buffer
  let outputFormat = originalFormat
  let outputWidth = task.candidate.width
  let outputHeight = task.candidate.height

  if (state.config.defaultFormat !== "original") {
    const target = state.config.defaultFormat
    if (target === "png" || target === "jpg") {
      const converted = await convertBuffer(
        state.tabId,
        buffer,
        target,
        state.config.jpgQuality
      )
      outputBuffer = converted.buffer
      outputFormat = target
      outputWidth = converted.width
      outputHeight = converted.height
    }
  }

  const filename = buildFilename(task.candidate, task.index, outputFormat)
  const blob = new Blob([outputBuffer], {
    type: formatToMime(outputFormat)
  })
  const objectUrl = URL.createObjectURL(blob)

  await new Promise<void>((resolve, reject) => {
    chrome.downloads.download(
      {
        url: objectUrl,
        filename: `${state.folder}/${filename}`,
        conflictAction: "uniquify",
        saveAs: false
      },
      (downloadId) => {
        if (chrome.runtime.lastError || !downloadId) {
          reject(
            new Error(chrome.runtime.lastError?.message || "下载失败")
          )
          return
        }
        resolve()
      }
    )
  })

  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000)

  state.done += 1
  state.results.push({
    id: task.candidate.id,
    filename,
    folder: state.folder,
    downloadUrl: task.candidate.bestUrl,
    originalUrl: task.candidate.originalUrl,
    width: outputWidth,
    height: outputHeight,
    format: outputFormat,
    status: "done",
    bytes: outputBuffer.byteLength
  })
}

const finalizeSession = async (state: SessionState) => {
  if (state.cancelled) return
  const metadata: DownloadMetadata = {
    pageTitle: state.pageTitle,
    pageUrl: state.pageUrl,
    timestamp: new Date().toISOString(),
    items: state.results
  }

  const blob = new Blob([JSON.stringify(metadata, null, 2)], {
    type: "application/json"
  })
  const objectUrl = URL.createObjectURL(blob)
  await new Promise<void>((resolve, reject) => {
    chrome.downloads.download(
      {
        url: objectUrl,
        filename: `${state.folder}/metadata.json`,
        conflictAction: "overwrite",
        saveAs: false
      },
      (downloadId) => {
        if (chrome.runtime.lastError || !downloadId) {
          reject(
            new Error(chrome.runtime.lastError?.message || "保存元数据失败")
          )
          return
        }
        resolve()
      }
    )
  })

  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000)
}

const startSession = async (
  tabId: number,
  sessionId: string,
  scan: ScanResult,
  selected: ImageCandidate[]
) => {
  const config = await getConfig()
  const folder = sanitizeFolderName(scan.pageTitle)

  if (currentSession && !currentSession.cancelled) {
    currentSession.cancelled = true
  }

  currentSession = {
    sessionId,
    pageTitle: scan.pageTitle,
    pageUrl: scan.pageUrl,
    folder,
    config,
    tabId,
    total: selected.length,
    done: 0,
    failed: 0,
    queue: selected.map((candidate, index) => ({
      candidate,
      index: index + 1
    })),
    results: [],
    active: 0,
    cancelled: false
  }

  sendProgress(currentSession)
  processQueue()
}

const scanTab = async (
  tabId: number,
  includeBackgroundImages: boolean
): Promise<ScanResult> => {
  return await new Promise<ScanResult>((resolve, reject) => {
    chrome.tabs.sendMessage(
      tabId,
      { type: MSG_SCAN, payload: { includeBackgroundImages } },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }
        resolve(response as ScanResult)
      }
    )
  })
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === MSG_SCAN) {
    const tabId = message?.payload?.tabId as number | undefined
    if (!tabId) {
      sendResponse({ ok: false, error: "缺少 tabId" })
      return false
    }

    getConfig()
      .then((config) =>
        scanTab(tabId, config.includeBackgroundImages).then((data) => {
          updateBadge(tabId, data.images.length)
          sendResponse({ ok: true, data })
        })
      )
      .catch((error) =>
        sendResponse({ ok: false, error: error?.message || "扫描失败" })
      )
    return true
  }

  if (message?.type === MSG_START_DOWNLOAD) {
    const payload = message?.payload as {
      tabId: number
      sessionId: string
      scan: ScanResult
      selected: ImageCandidate[]
    }

    startSession(payload.tabId, payload.sessionId, payload.scan, payload.selected)
      .then(() => sendResponse({ ok: true }))
      .catch((error) =>
        sendResponse({ ok: false, error: error?.message || "启动失败" })
      )
    return true
  }

  if (message?.type === MSG_CANCEL) {
    if (currentSession) {
      currentSession.cancelled = true
    }
    sendResponse({ ok: true })
    return false
  }

  return false
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) return
  getConfig()
    .then((config) => {
      if (!config.autoDownload) return
      if (autoDownloadedUrl.get(tabId) === tab.url) return
      autoDownloadedUrl.set(tabId, tab.url)
      return scanTab(tabId, config.includeBackgroundImages).then((scan) => {
        updateBadge(tabId, scan.images.length)
        return startSession(
          tabId,
          `auto-${tabId}-${Date.now()}`,
          scan,
          scan.images
        )
      })
    })
    .catch(() => null)
})
