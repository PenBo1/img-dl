# Imgdl 浏览器插件

一个基于 Plasmo 的图片批量下载插件，支持“最高分辨率识别 + 格式转换 + 元数据导出”，并提供 Popup/Options 双页面与深浅色主题。

## 环境搭建

1. 安装依赖

```bash
npm install
```

2. 开发模式

```bash
npm run dev
```

3. 构建 & 打包

```bash
npm run build
npm run package
```

打包后产物在 `build/` 中，可直接生成 `.zip` 安装包。

### Firefox 目标

```bash
npm run dev:firefox
npm run build:firefox
npm run package:firefox
```

## 项目结构

```
.
├─ background.ts        # 后台脚本：下载队列、格式转换、元数据写入
├─ content.ts           # 内容脚本：扫描图片候选、canvas 转换
├─ popup.tsx            # 弹窗页面
├─ options.tsx          # 设置页面
├─ lib/
│  ├─ messages.ts       # 消息常量
│  ├─ storage.ts        # Plasmo Storage 封装
│  ├─ theme.ts          # 主题切换工具
│  ├─ types.ts          # 类型定义
│  └─ utils.ts          # 工具函数
├─ style.css            # Tailwind 入口与主题变量
├─ tailwind.config.js
└─ postcss.config.js
```

## 功能说明

### 1) 批量下载与最清晰版本识别
- 扫描 `img`、`picture/source`、`srcset`、常见 lazy 属性。
- `srcset` 解析后选最大 `w/x` 描述符。
- 可选包含背景图（仅 inline style 背景）。

### 2) 格式支持与转换
- 默认保持原格式，可选转换为 PNG/JPG。
- 转换逻辑在 content script 中用 Canvas 完成，兼容 Chromium + Firefox。

### 3) 下载目录与命名
- 下载目录为当前网页标题。
- 命名规则：原文件名优先，若缺失则使用 `img_0001` 兜底。

### 4) 元数据文件
- 下载结束后生成 `metadata.json` 并保存到同目录。
- 记录：文件名、原始 URL、下载 URL、尺寸、格式、状态、字节数。

### 5) Popup
- 图片缩略图 + 勾选下载。
- 按尺寸/格式/域名过滤。
- 进度展示、取消下载。

### 6) Options
- 默认格式、JPG 质量、自动下载、并发数、是否包含背景图。
- 主题：浅色 / 深色 / 跟随系统。

## 使用指南

1. 打开网页，点击 Popup 的“扫描页面”。
2. 选择要下载的图片，点击“下载所选”。
3. 在 Options 页面配置默认格式、主题等。

## 测试场景（建议手动）

1. 普通页面：`img + srcset` 是否能命中大图。  
2. Lazy 图片：`data-src` 是否识别。  
3. WebP → PNG/JPG 转换。  
4. `metadata.json` 是否正确生成。  
5. 主题切换持久化。  
6. Firefox 开发模式：`gecko.id` 是否生效。  
