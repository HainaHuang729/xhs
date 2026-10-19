# 小红书收藏智能专辑整理

模块化重写版脚本，用于在小红书网页版「收藏 -> 笔记」页面扫描收藏笔记标题，生成专辑分类方案，创建专辑，并尝试通过小红书前端内部接口把收藏移动到对应专辑。

## 如何运行

### 方法一：Chrome 本地扩展（推荐）

1. 打开 Chrome，进入 `chrome://extensions/`。
2. 打开右上角「开发者模式」。
3. 点击「加载已解压的扩展程序」。
4. 选择本项目的 `extension/` 目录。
5. 打开小红书网页版并登录，进入「收藏 -> 笔记」页面。
6. 页面「笔记 / 专辑」tab 附近会自动出现「智能构建专辑」按钮。

更新脚本后重新生成扩展页面脚本：

```bash
npm run build
```

然后在 `chrome://extensions/` 点这个扩展的刷新按钮。

### 方法二：Console 粘贴

1. 打开并登录小红书网页版。
2. 进入个人主页的「收藏 -> 笔记」子分类，URL 需要包含 `tab=fav&subTab=note`。
3. 打开浏览器 Console。
4. 复制 `dist/xhs-album-builder.console.js` 的全部内容粘贴执行。
5. 页面「笔记 / 专辑」tab 附近会出现「智能构建专辑」按钮。

重新生成 Console 单文件：

```bash
npm run build
```

语法检查：

```bash
npm run check
```

## LLMBridge

脚本只会调用当前页面上的 `window.LLMBridge.chat(prompt, "json")`。如果不存在 `window.LLMBridge`，会自动使用本地规则兜底分类。

期望返回 JSON：

```json
{
  "items": [
    { "i": 1, "name": "旅行" },
    { "i": 2, "name": "美食" }
  ]
}
```

## 人工 / 外部 AI 复核分类

如果本地兜底只分了一部分，可以先让脚本抓取标题，再把抓取结果交给外部 AI 或人工判断。

点击「智能构建专辑」让脚本完成扫描后，在 Console 运行：

```js
window.__tabbitXhsAlbumBuilderPrompt()
```

把输出内容发给 AI，让它只返回：

```json
{
  "items": [
    { "i": 1, "name": "旅行" },
    { "i": 2, "name": "美食" }
  ]
}
```

拿到 JSON 后，在 Console 运行：

```js
window.__tabbitXhsAlbumBuilderApplyPlan({
  "items": [
    { "i": 1, "name": "旅行" },
    { "i": 2, "name": "美食" }
  ]
})
```

脚本会重新打开分类结果弹窗，然后可以继续「创建专辑」和「接口一键添加」。

## 配置

执行脚本前可以注入配置：

```js
window.__tabbitXhsAlbumBuilderConfig = {
  maxCategories: 20,
  maxTitlesForPrompt: 500,
  classificationBatchSize: 100,
  defaultGranularity: "coarse"
};
```

## 收藏导出和本地阅读

- `tools/xhs-favorites-exporter.js`：在收藏页 Console 执行，滚动扫描并下载标题和链接。用法见 `tools/xhs-favorites-exporter.md`。需要后续抓正文时，将 `keepQueryParams` 设为 `true`，保留原链接中的签名参数；这些导出文件应保存在本地。
- `detail-extension/`：在 Chrome「加载已解压的扩展程序」中选择此目录，登录后进入收藏页，点击右下角「抓取正文/评论样本」。默认尝试前 5 条，正文及评论的提取仍属样本功能，配置见 `tools/xhs-detail-extractor.md`。
- `tools/xhs_organize_saved.py`：通过已安装并连接浏览器的 OpenCLI 读取收藏及正文，按关键词初分组，输出 JSON、CSV、Markdown 和 HTML。仅使用 Python 标准库；Windows 下优先直接调用 npm 安装的 OpenCLI JS 入口，避免签名 URL 中的 `&` 被 `.cmd` 拆分。

```powershell
python tools/xhs_organize_saved.py --limit 100 --details-limit 20
python tools/xhs_organize_saved.py --from-legacy path/to/favorites.json
python tools/xhs_organize_saved.py --from-organized path/to/organized.json
```

结果写入仓库根目录的 `outputs/`，已加入 Git 忽略规则。`--limit` 是请求上限，不保证工具一定返回该数量；旧格式导入只做标题分类，Markdown 每类最多列出 30 条，完整数据请看 JSON、CSV 或 HTML。

历史验证曾导出 393 条去重标题，但当时尚未滚动到底；正文整理样本为 20 条，其中 19 条有正文。这些是历史样本规模，不代表当前账号总量或成功率。个人收藏、签名链接、登录凭据和浏览器资料不随代码发布。

## 离线检查

```powershell
npm run build
npm run check
node scripts/check-regressions.mjs
python tools/xhs_organize_saved.py --self-test
```

回归检查覆盖兜底分类名称、人工分类导入、笔记分配和构建产物的 ASCII 编码。专辑创建及移动仍需登录后的真实页面验证；评论提取只包含页面已加载内容，可能混入日期、地区或点赞文本。

## 风险说明

- 需要先登录小红书，所有请求都使用当前页面登录态。
- 默认创建私有专辑，不会删除收藏。
- 不会把数据上传到未知第三方；分类只调用 `window.LLMBridge`，没有则本地兜底。
- 小红书 DOM 和 webpack 内部 API 可能随时变化。若探测不到 `note/move`、`note/collect` 或 `board/user`，脚本会给出明确错误并在 Console 输出调试信息。
- 仅建议用于个人收藏整理。

## 结构

```text
src/
  index.js       入口，初始化 MutationObserver
  config.js      默认配置
  state.js       全局状态
  dom.js         DOM 工具
  ui.js          按钮、弹窗、进度条
  scanner.js     收藏笔记扫描
  albums.js      读取/创建专辑
  classifier.js  LLM 分类 + 本地兜底
  xhsApi.js      webpack runtime API 探测与调用
  logger.js      debug / error 封装
```
