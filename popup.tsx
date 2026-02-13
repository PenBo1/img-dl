import { useEffect, useState } from "react"
import * as Checkbox from "@radix-ui/react-checkbox"
import * as Progress from "@radix-ui/react-progress"
import * as ScrollArea from "@radix-ui/react-scroll-area"

import "~style.css"

import { MSG_CANCEL, MSG_PROGRESS, MSG_SCAN, MSG_START_DOWNLOAD } from "./lib/messages"
import type { PopupProgress, ScanResult } from "./lib/types"
import { applyTheme } from "./lib/theme"
import { getConfig } from "./lib/storage"

const getActiveTabId = async (): Promise<number | null> => {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  })
  return tab?.id ?? null
}

const IndexPopup = () => {
  const [scan, setScan] = useState<ScanResult | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [progress, setProgress] = useState<PopupProgress | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    getConfig().then((cfg) => {
      applyTheme(cfg.theme)
    })
  }, [])

  useEffect(() => {
    handleScan().catch(() => null)
    // 关键逻辑：Popup 打开时自动扫描页面
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const handler = (message: { type: string; payload?: PopupProgress }) => {
      if (message.type === MSG_PROGRESS && message.payload) {
        setProgress(message.payload)
      }
    }
    chrome.runtime.onMessage.addListener(handler)
    return () => chrome.runtime.onMessage.removeListener(handler)
  }, [])

  const images = scan?.images ?? []

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const selectAll = () => {
    setSelectedIds(new Set(images.map((img) => img.id)))
  }

  const clearAll = () => {
    setSelectedIds(new Set())
  }

  const handleScan = async () => {
    setIsLoading(true)
    try {
      const tabId = await getActiveTabId()
      if (!tabId) return
      const response = await chrome.runtime.sendMessage({
        type: MSG_SCAN,
        payload: { tabId }
      })
      if (!response?.ok) {
        throw new Error(response?.error || "扫描失败")
      }
      const result = response.data as ScanResult
      setScan(result)
      setSelectedIds(new Set(result.images.map((img) => img.id)))
    } finally {
      setIsLoading(false)
    }
  }

  const handleStartDownload = async () => {
    if (!scan) return
    const tabId = await getActiveTabId()
    if (!tabId) return
    const selected = images.filter((img) => selectedIds.has(img.id))
    const sessionId = crypto.randomUUID()
    await chrome.runtime.sendMessage({
      type: MSG_START_DOWNLOAD,
      payload: {
        tabId,
        sessionId,
        scan,
        selected
      }
    })
  }

  const handleCancel = async () => {
    await chrome.runtime.sendMessage({ type: MSG_CANCEL })
  }

  const handleOpenOptions = async () => {
    if (chrome.runtime.openOptionsPage) {
      await chrome.runtime.openOptionsPage()
      return
    }
    window.open(chrome.runtime.getURL("options.html"))
  }

  return (
    <div className="app-shell popup-surface flex h-[720px] flex-col">
      <header className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.3em] text-muted">Imgdl</p>
          <h1 className="text-xl font-semibold">图片下载中心</h1>
          <p className="text-xs text-muted">自动扫描当前页面资源</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded-full border border-border px-3 py-1 text-xs hover:bg-panel/60"
            onClick={handleScan}>
            {isLoading ? "扫描中..." : "刷新扫描"}
          </button>
          <button
            className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border hover:bg-panel/60"
            onClick={handleOpenOptions}
            aria-label="打开设置">
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 text-muted"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round">
              <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.03.03a2 2 0 1 1-2.83 2.83l-.03-.03a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.54V22a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.54 1.7 1.7 0 0 0-1.87.34l-.03.03a2 2 0 1 1-2.83-2.83l.03-.03A1.7 1.7 0 0 0 5 15a1.7 1.7 0 0 0-1.54-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 5 8.46a1.7 1.7 0 0 0-.34-1.87l-.03-.03a2 2 0 1 1 2.83-2.83l.03.03A1.7 1.7 0 0 0 9.38 3.5H9.5A1.7 1.7 0 0 0 11 1.54V1a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.54h.12a1.7 1.7 0 0 0 1.87-.34l.03-.03a2 2 0 1 1 2.83 2.83l-.03.03a1.7 1.7 0 0 0-.34 1.87V9.5A1.7 1.7 0 0 0 22.46 11H23a2 2 0 1 1 0 4h-.1A1.7 1.7 0 0 0 21.54 17" />
            </svg>
          </button>
        </div>
      </header>

      <section className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border bg-panel/70 p-3 shadow-soft">
          <p className="text-xs text-muted">扫描结果</p>
          <p className="text-lg font-semibold">{images.length}</p>
          <p className="text-[11px] text-muted">当前页图片</p>
        </div>
        <div className="rounded-2xl border border-border bg-panel/70 p-3 shadow-soft">
          <p className="text-xs text-muted">已选择</p>
          <p className="text-lg font-semibold">{selectedIds.size}</p>
          <p className="text-[11px] text-muted">准备下载</p>
        </div>
        <div className="rounded-2xl border border-border bg-panel/70 p-3 shadow-soft">
          <p className="text-xs text-muted">下载状态</p>
          <p className="text-lg font-semibold">
            {progress ? `${progress.done}/${progress.total}` : "--"}
          </p>
          <p className="text-[11px] text-muted">完成/总数</p>
        </div>
      </section>

      <section className="mt-4 flex items-center justify-between text-xs">
        <span className="text-muted">
          预览列表 · 共 {images.length} 张
        </span>
        <div className="flex gap-2">
          <button className="text-accent" onClick={selectAll}>
            全选
          </button>
          <button className="text-danger" onClick={clearAll}>
            清空
          </button>
        </div>
      </section>

      <section className="mt-3 flex-1 min-h-0 rounded-2xl border border-border bg-panel/70">
        <ScrollArea.Root className="h-full w-full">
          <ScrollArea.Viewport className="grid grid-cols-2 gap-3 p-3">
            {images.length === 0 && (
              <div className="col-span-2 rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted">
                暂未发现图片，可点击“刷新扫描”更新。
              </div>
            )}
            {images.map((img) => (
              <label
                key={img.id}
                className="group flex flex-col gap-2 rounded-xl border border-border bg-panel p-2 shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft">
                <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-bg">
                  <img
                    src={img.bestUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
                  <Checkbox.Root
                    checked={selectedIds.has(img.id)}
                    onCheckedChange={() => toggleSelection(img.id)}
                    className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded border border-border bg-panel/90">
                    <Checkbox.Indicator className="h-2.5 w-2.5 rounded-sm bg-accent" />
                  </Checkbox.Root>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-medium line-clamp-1">
                    {img.bestUrl}
                  </p>
                  <p className="text-[10px] text-muted">
                    {img.width || "--"} x {img.height || "--"} · {img.format || "--"}
                  </p>
                </div>
              </label>
            ))}
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar
            orientation="vertical"
            className="flex touch-none select-none p-0.5">
            <ScrollArea.Thumb className="flex-1 rounded-full bg-border" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      </section>

      <section className="mt-3 space-y-2">
        <div className="flex gap-2">
          <button
            className="flex-1 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white shadow-soft"
            onClick={handleStartDownload}>
            下载所选
          </button>
          <button
            className="rounded-xl border border-border px-3 py-2 text-xs"
            onClick={handleCancel}>
            取消
          </button>
        </div>

        {progress && (
          <div className="rounded-xl border border-border bg-panel/70 p-2 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span>进度</span>
              <span>
                已完成 {progress.done} / {progress.total} · 失败 {progress.failed}
              </span>
            </div>
            <Progress.Root
              value={progress.total ? (progress.done / progress.total) * 100 : 0}
              className="h-2 w-full overflow-hidden rounded-full bg-bg">
              <Progress.Indicator className="h-full bg-accent transition-all" />
            </Progress.Root>
          </div>
        )}
      </section>
    </div>
  )
}

export default IndexPopup
