import { useEffect, useState } from "react"
import * as Select from "@radix-ui/react-select"
import * as Switch from "@radix-ui/react-switch"

import "~style.css"

import type { DownloadConfig } from "./lib/types"
import { applyTheme } from "./lib/theme"
import { defaultConfig, getConfig, setConfig } from "./lib/storage"

const OptionsPage = () => {
  const [config, setLocalConfig] = useState<DownloadConfig>(defaultConfig)

  useEffect(() => {
    getConfig().then((cfg) => {
      setLocalConfig(cfg)
      applyTheme(cfg.theme)
    })
  }, [])

  const updateConfig = async <K extends keyof DownloadConfig>(
    key: K,
    value: DownloadConfig[K]
  ) => {
    const next = { ...config, [key]: value }
    setLocalConfig(next)
    await setConfig(next)
    if (key === "theme") {
      applyTheme(next.theme)
    }
  }

  return (
    <div className="min-h-screen bg-bg p-8 text-sm">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <p className="text-xs uppercase tracking-widest text-muted">Imgdl 设置</p>
          <h1 className="text-2xl font-semibold">下载偏好与主题</h1>
        </header>

        <section className="rounded-xl border border-border bg-panel p-4 shadow-soft space-y-3">
          <h2 className="text-sm font-semibold">格式与质量</h2>
          <div className="flex items-center justify-between">
            <span className="text-muted">默认下载格式</span>
            <Select.Root
              value={config.defaultFormat}
              onValueChange={(value) =>
                updateConfig("defaultFormat", value as DownloadConfig["defaultFormat"])
              }>
              <Select.Trigger className="inline-flex items-center gap-2 rounded-md border border-border bg-panel px-2 py-1 text-xs">
                <Select.Value />
              </Select.Trigger>
              <Select.Portal>
              <Select.Content className="rounded-md border border-border bg-panel p-2 shadow-soft text-text">
                  <Select.Item
                    value="original"
                    className="cursor-pointer rounded px-2 py-1 text-xs hover:bg-bg">
                    <Select.ItemText>保持原格式</Select.ItemText>
                  </Select.Item>
                  <Select.Item
                    value="png"
                    className="cursor-pointer rounded px-2 py-1 text-xs hover:bg-bg">
                    <Select.ItemText>PNG</Select.ItemText>
                  </Select.Item>
                  <Select.Item
                    value="jpg"
                    className="cursor-pointer rounded px-2 py-1 text-xs hover:bg-bg">
                    <Select.ItemText>JPG</Select.ItemText>
                  </Select.Item>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted">JPG 质量</span>
            <input
              type="number"
              min={0.1}
              max={1}
              step={0.05}
              value={config.jpgQuality}
              className="w-20 rounded-md border border-border bg-panel px-2 py-1 text-xs"
              onChange={(e) =>
                updateConfig("jpgQuality", Number(e.target.value))
              }
            />
          </div>
        </section>

        <section className="rounded-xl border border-border bg-panel p-4 shadow-soft space-y-3">
          <h2 className="text-sm font-semibold">下载行为</h2>
          <div className="flex items-center justify-between">
            <span className="text-muted">自动下载</span>
            <Switch.Root
              checked={config.autoDownload}
              onCheckedChange={(checked) => updateConfig("autoDownload", checked)}
              className="h-5 w-9 rounded-full border border-border data-[state=checked]:bg-accent data-[state=unchecked]:bg-bg">
              <Switch.Thumb className="block h-4 w-4 translate-x-0.5 rounded-full bg-panel transition data-[state=checked]:translate-x-4" />
            </Switch.Root>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">包含背景图</span>
            <Switch.Root
              checked={config.includeBackgroundImages}
              onCheckedChange={(checked) =>
                updateConfig("includeBackgroundImages", checked)
              }
              className="h-5 w-9 rounded-full border border-border data-[state=checked]:bg-accent data-[state=unchecked]:bg-bg">
              <Switch.Thumb className="block h-4 w-4 translate-x-0.5 rounded-full bg-panel transition data-[state=checked]:translate-x-4" />
            </Switch.Root>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">并发下载</span>
            <input
              className="w-20 rounded-md border border-border bg-panel px-2 py-1 text-xs"
              type="number"
              min={1}
              max={10}
              value={config.maxConcurrency}
              onChange={(e) =>
                updateConfig("maxConcurrency", Number(e.target.value))
              }
            />
          </div>
        </section>

        <section className="rounded-xl border border-border bg-panel p-4 shadow-soft space-y-3">
          <h2 className="text-sm font-semibold">主题</h2>
          <div className="flex items-center justify-between">
            <span className="text-muted">外观</span>
            <Select.Root
              value={config.theme}
              onValueChange={(value) =>
                updateConfig("theme", value as DownloadConfig["theme"])
              }>
              <Select.Trigger className="inline-flex items-center gap-2 rounded-md border border-border bg-panel px-2 py-1 text-xs">
                <Select.Value />
              </Select.Trigger>
              <Select.Portal>
              <Select.Content className="rounded-md border border-border bg-panel p-2 shadow-soft text-text">
                  <Select.Item
                    value="system"
                    className="cursor-pointer rounded px-2 py-1 text-xs hover:bg-bg">
                    <Select.ItemText>跟随系统</Select.ItemText>
                  </Select.Item>
                  <Select.Item
                    value="light"
                    className="cursor-pointer rounded px-2 py-1 text-xs hover:bg-bg">
                    <Select.ItemText>浅色</Select.ItemText>
                  </Select.Item>
                  <Select.Item
                    value="dark"
                    className="cursor-pointer rounded px-2 py-1 text-xs hover:bg-bg">
                    <Select.ItemText>深色</Select.ItemText>
                  </Select.Item>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
          </div>
        </section>
      </div>
    </div>
  )
}

export default OptionsPage
