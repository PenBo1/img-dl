import type { PlasmoCSConfig } from "plasmo"

import type { ImageCandidate, ScanResult } from "./lib/types"
import { MSG_CONVERT, MSG_SCAN } from "./lib/messages"
import { guessFormat } from "./lib/utils"

type SrcsetItem = { url: string; descriptor?: string }

const parseSrcset = (srcset: string): SrcsetItem[] => {
  return srcset
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [url, descriptor] = part.split(/\s+/)
      return { url, descriptor }
    })
}

const pickBestFromSrcset = (srcset?: string): string | undefined => {
  if (!srcset) return undefined
  const candidates = parseSrcset(srcset)
  if (candidates.length === 0) return undefined

  let best = candidates[0]
  let bestScore = 0

  for (const item of candidates) {
    if (!item.url) continue
    const descriptor = item.descriptor ?? ""
    let score = 0
    if (descriptor.endsWith("w")) {
      score = Number(descriptor.replace("w", "")) || 0
    } else if (descriptor.endsWith("x")) {
      score = (Number(descriptor.replace("x", "")) || 0) * 1000
    }
    if (score >= bestScore) {
      bestScore = score
      best = item
    }
  }
  return best?.url
}

const collectFromImg = (img: HTMLImageElement): ImageCandidate[] => {
  const candidates: ImageCandidate[] = []
  const srcset = img.getAttribute("srcset") ?? img.getAttribute("data-srcset")
  const bestFromSrcset = pickBestFromSrcset(srcset ?? undefined)
  const directSrc =
    img.currentSrc ||
    img.src ||
    img.getAttribute("data-src") ||
    img.getAttribute("data-original") ||
    img.getAttribute("data-lazy") ||
    ""

  const bestUrl = bestFromSrcset || directSrc
  if (!bestUrl) return candidates

  const width = img.naturalWidth || undefined
  const height = img.naturalHeight || undefined
  const format = guessFormat(bestUrl)

  candidates.push({
    id: `${bestUrl}|${width || 0}x${height || 0}`,
    originalUrl: directSrc || bestUrl,
    bestUrl,
    width,
    height,
    format,
    sourceType: srcset ? "img" : "lazy",
    srcset: srcset || undefined
  })

  return candidates
}

const collectFromPicture = (picture: HTMLPictureElement): ImageCandidate[] => {
  const candidates: ImageCandidate[] = []
  const sources = Array.from(picture.querySelectorAll("source"))

  for (const source of sources) {
    const srcset =
      source.getAttribute("srcset") ?? source.getAttribute("data-srcset")
    const bestFromSrcset = pickBestFromSrcset(srcset ?? undefined)
    if (!bestFromSrcset) continue

    candidates.push({
      id: `${bestFromSrcset}|0x0`,
      originalUrl: bestFromSrcset,
      bestUrl: bestFromSrcset,
      format: guessFormat(bestFromSrcset),
      sourceType: "source",
      srcset: srcset || undefined
    })
  }

  return candidates
}

const collectBackgroundImages = (): ImageCandidate[] => {
  const results: ImageCandidate[] = []
  const nodes = Array.from(document.querySelectorAll<HTMLElement>("[style]"))
  const urlRegex = /url\(["']?(.*?)["']?\)/g

  for (const node of nodes) {
    const bg = node.style.backgroundImage || node.style.background
    if (!bg) continue
    let match: RegExpExecArray | null
    while ((match = urlRegex.exec(bg))) {
      const url = match[1]
      if (!url || url.startsWith("data:")) continue
      const rect = node.getBoundingClientRect()
      results.push({
        id: `${url}|${Math.round(rect.width)}x${Math.round(rect.height)}`,
        originalUrl: url,
        bestUrl: url,
        width: Math.round(rect.width) || undefined,
        height: Math.round(rect.height) || undefined,
        format: guessFormat(url),
        sourceType: "background"
      })
    }
  }
  return results
}

const scanImages = (includeBackgroundImages: boolean): ScanResult => {
  // 关键逻辑：从页面中收集图片候选，并尽可能选到最高分辨率 URL
  const images: ImageCandidate[] = []
  const seen = new Set<string>()

  const imgs = Array.from(document.querySelectorAll("img"))
  for (const img of imgs) {
    for (const candidate of collectFromImg(img)) {
      if (seen.has(candidate.id)) continue
      seen.add(candidate.id)
      images.push(candidate)
    }
  }

  const pictures = Array.from(document.querySelectorAll("picture"))
  for (const picture of pictures) {
    for (const candidate of collectFromPicture(picture)) {
      if (seen.has(candidate.id)) continue
      seen.add(candidate.id)
      images.push(candidate)
    }
  }

  if (includeBackgroundImages) {
    for (const candidate of collectBackgroundImages()) {
      if (seen.has(candidate.id)) continue
      seen.add(candidate.id)
      images.push(candidate)
    }
  }

  return {
    pageTitle: document.title || "download",
    pageUrl: window.location.href,
    images
  }
}

const convertImageBuffer = async (
  arrayBuffer: ArrayBuffer,
  targetFormat: "png" | "jpg",
  quality: number
): Promise<{ buffer: ArrayBuffer; width: number; height: number }> => {
  // 关键逻辑：使用 Canvas 在 content script 中完成格式转换，兼容 Firefox
  const blob = new Blob([arrayBuffer])
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement("canvas")
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("无法获取 Canvas 上下文")
  ctx.drawImage(bitmap, 0, 0)

  const mime = targetFormat === "png" ? "image/png" : "image/jpeg"
  const outputBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) {
          reject(new Error("转换失败，无法生成 Blob"))
          return
        }
        resolve(result)
      },
      mime,
      quality
    )
  })

  const buffer = await outputBlob.arrayBuffer()
  return { buffer, width: bitmap.width, height: bitmap.height }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === MSG_SCAN) {
    const includeBackgroundImages = Boolean(
      message?.payload?.includeBackgroundImages
    )
    const result = scanImages(includeBackgroundImages)
    sendResponse(result)
    return true
  }

  if (message?.type === MSG_CONVERT) {
    const { buffer, targetFormat, quality } = message.payload as {
      buffer: ArrayBuffer
      targetFormat: "png" | "jpg"
      quality: number
    }

    convertImageBuffer(buffer, targetFormat, quality)
      .then((res) => sendResponse({ ok: true, ...res }))
      .catch((error) =>
        sendResponse({ ok: false, error: error?.message || "转换失败" })
      )

    return true
  }

  return false
})

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"]
}
