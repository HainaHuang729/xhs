# 小红书收藏整理与去处地图

模块化重写版脚本，用于在小红书网页版「收藏 -> 笔记」页面扫描收藏笔记标题，生成专辑分类方案，创建专辑，并尝试通过小红书前端内部接口把收藏移动到对应专辑。

同时提供本地收藏地图和「吃喝玩乐」浏览页。推荐页默认使用单卡漫游，支持按菜系、咖啡、甜品、户外和体验等主题查看原帖、照片与已确认地点。仓库只包含代码和公共底图；收藏数据、原图与个人复核记录保留在本地。

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
  maxTitlesForPrompt: 500,
  classificationBatchSize: 100,
  defaultGranularity: "coarse"
};
```

专辑和分类数量不设上限。旧版配置中的 `maxCategories` 会被忽略，已有专辑、自动分类和人工导入都不会因为数量过多而被合并到“其他”。标题选择数量和每批提示词中的分类参考样本数量仍分别受配置控制，不限制最终分类数量。

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
- 移动前会读取现有专辑成员，并同时传入原专辑和目标专辑 ID；未分专辑的收藏使用空原专辑 ID。调用时保留完整响应，不能把空数据对象当作成功确认。
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

## 收藏地图（本地）

```bash
npm start
# 或 python3 tools/serve_map.py
```

打开 http://127.0.0.1:8787 。无需 npm 安装。地图支持收藏导出、正文样本和整理 JSON；收藏数据保存在浏览器，可导出备份。按笔记 ID 合并重复导入，有 WGS84 坐标的地点会直接标注，无明确坐标的保留待定位。支持一篇笔记多个地点，支持调整首个地点，也可以勾选「添加为新的地点」保留已有地点。不要直接导入 GCJ02 / BD09 坐标。

单卡漫游入口：http://127.0.0.1:8787/discover.html 。地区和完整分类放在筛选弹层中；手机底部可前后翻页，卡片支持拖动与回位，点照片查看原帖图组、完整地址和原文。支持键盘与减少动态效果偏好。`discover-versions.html` 保留清单、单卡和画册三种版式的交互预览。

首次克隆仓库时页面为空，可通过地图的导入功能载入自己的导出 JSON，或保存为 `outputs/map-data.json`。原图缓存放在 `outputs/media/`；个人推荐说明、踩雷排除和往期活动标记放在 `outputs/discovery-reviews.json`，格式为 `{ "笔记ID": { "reason": "复核说明" } }`，也支持 `avoid`、`past`、`schedule`。服务会将复核信息随本地收藏接口返回，不改写原始导出文件。这些目录与文件均不提交到公开仓库。

不依赖个人数据的检查：

```sh
npm run check:map
npm run check:discover
python3 scripts/check-map-server.py
```

默认使用本地的简化海岸「漫游图」，不依赖地图瓦片；可切换到 OpenStreetMap 街道图查看道路细节。海岸来自公共领域 Natural Earth，轮廓经过简化，不能代替导航。地点仍使用已核对的 WGS84 坐标，概览会合并相邻标记，点击或放大展开。点击「打开导航」会将地点坐标发送给 Google Maps。服务只提供地图、照片与收藏接口，不提供仓库或其他 outputs 文件。关闭服务后重新运行上面的命令即可。

地图专用导出：在收藏页运行 `tools/xhs-map-exporter.js`，逐屏扫描收藏区域（包括无标题笔记），下载 JSON；继续运行 `tools/xhs-map-details.js` 可获取前 20 条旅行 / 餐饮笔记的正文样本。网页计数可能包含失效或未加载的条目，请核对实际导出数量。

将导出的数组保存为 `outputs/map-data.json`，启动地图后会自动读取。收藏数据、正文和签名链接仅存放在 Git 忽略的 `outputs/` 中。地图从正文的地点标记和列表提取搜索线索；在「补充地点」中查询 Nominatim 候选，核对城市、分店、地址后保存。查询结果可能不准确或缺失，请勿直接采用第一项。已知 WGS84 坐标可直接导入；地址只存在于图片或视频中的笔记暂不支持自动识别。首次流程仅提取正文样本，不代表已经定位全部收藏。

地图检查：`node scripts/check-map.mjs`。

### 大湾区优先与原笔记照片

地图默认显示「港深 · 优先」，可切换整个大湾区及各个城市。正文提及大湾区但实际地点在区域外时，区域外坐标不会显示在大湾区地图上。地区筛选是线索筛选，不代表每条笔记都有可确认的地点。

- `tools/xhs-gba-details.js`：在登录后的小红书页运行，先将已导出的笔记数组放入 `window.__xhsGbaQueue`。逐条读取正文和笔记图片链接，每 20 条下载进度；可点「停止并保存」。每条读完移除详情框架，避免累计导航历史。
- `python3 tools/merge_gba_details.py`：合并本机 Downloads 中的 `xhs-gba-*.json`，保留已经确认的位置和本地照片。
- `python3 tools/cache_note_photos.py`：将官方小红书图片 CDN 的照片保存在 `outputs/media/`，默认保存首两张和末两张，减少链接过期影响；不下载视频。默认仅在本机展示。
- `python3 tools/ocr_photos.py`：macOS 本地 Vision 文字识别，需要兼容的 Command Line Tools；此机优先使用已安装的 15.4 SDK。图片文字作为待核对线索，不会直接自动落点。

点击照片可放大、翻页。封面和相册属于原笔记，合集配图不一定对应每一个地点。楼宇 / 商场 / 园区参考点会明确标注；未确认分店的候选地址不放到地图上。重新加载地图会读取最新结果，页面也会定期刷新数据并保留手动调整的位置。

### 港深地图：补图与分类

地图新增「收藏分类」筛选，主题和城市分别保存。标题/正文规则给出初始分类，线索不足的保留「待分类」；每张卡片可手动调整分类并导出备份。这里的分类保存在本地地图，和小红书专辑独立。

当前细分类规则及专辑 ID 记录在 `outputs/taxonomy-policy-current.json`：餐厅按菜系，甜品、小吃、咖啡、饮品和食谱分别整理，其他收藏按主题细分。新专辑仅自己可见。本地分类使用 `category_manual` 和带日期的 `category_review`；原始导出的 `category` 保留历史值。旧分类批次脚本不应用于覆盖这套新审核结果。小红书归档以完整分页后的逐条回读报告为准，网页的首屏目录最多只显示 30 本。

吃喝分类按「菜系、甜品、小吃、饮品」复核，菜系再细分；多店合集允许同时归入多类，但地图按每个已定位地点自己的标签筛选，不把整篇合集的菜系复制到单一门店。人工复核写在 `outputs/food-category-review.json`，菜系仍无法判断的条目连同原因输出到 `outputs/food-category-unresolved.json`。应用复核并检查：

```sh
node tools/refresh_food_outputs.mjs --apply
npm run check:food
```


`tools/xhs-photo-exporter.js` 在已登录的小红书页面读取同源笔记 HTML 中的当前笔记正文、完整图片列表，不导出 Cookie 或账号状态。先设置 `window.__xhsGbaQueue`；连续三条无法返回笔记数据时自动停下并保存。每 10 条下载检查点。若 HTML 不含笔记数据，可用 `xhs-gba-details.js` 的可见页面读取方式补充。

按顺序执行（这些命令更新同一份私有数据，不要同时运行）：

```sh
python3 tools/merge_gba_details.py
python3 tools/cache_note_photos.py --all
python3 tools/ocr_photos.py
python3 tools/apply_reviewed_locations.py
node tools/audit-map.mjs
```

`--all` 保存完整已提取图组，记录原图标识以避免图片列表刷新后顺序错乱。OCR 只提供待核对线索。已核对地点保存在忽略版本控制的 `outputs/reviewed-locations.json`，包含来源、坐标系和参考点精度；待定位条目输出到 `outputs/hksz-pending-review.json`。

逐条地点核对可记录 `location_review_status`、`location_review_reason` 和 `location_reviewed_at`，在收藏详情中显示。`place_hints_reviewed` 是人工复核后的地点线索，可设为空数组，避免将行程时间或宣传语再次当成地址。只确认门牌但尚未核对坐标时，保留候选地址，不自动落点。

少数已复核的内地公开地图参考点使用 GCJ-02，经过本地逆转换后才保存为 WGS84，并保留原始坐标、转换方法及来源。转换工具和许可见 `tools/vendor/README.md`；检查运行 `python3 scripts/check-coordinates.py`。未知坐标系不会直接当作 WGS84。

### 手机使用

在同一 Wi-Fi 下运行 `npm run start:lan`，电脑打开 http://127.0.0.1:8787 ，点击右上角「手机打开」并用手机相机扫码。首次扫码配对后即可查看收藏、照片与地图；直接访问局域网根地址不会暴露收藏。连接二维码只在电脑页面提供，重启服务后需重新扫码。保持电脑与服务开启；这不是公网部署，离开该 Wi-Fi 后不能访问。`npm start` 仍仅允许本机访问。

手机底部切换「收藏 / 地图」，支持小屏、横屏和安全区，输入框字号避免 iOS 自动放大。浏览器可添加到主屏幕；仍需联网连接电脑，不是离线应用。手机手动分类和地点调整保存在手机浏览器，尚不会回写电脑或小红书。

检查：`npm run check:map`、`node --check map/app.js`、`node --check map/explore-map.js`、`python3 scripts/check-map-server.py`。

### 独立云端版本

私人 Sites 项目位于 `../sites/favorites-atlas/`，项目身份在该目录的 `.openai/hosting.json`，后续必须复用，不能重复创建站点。网址以 Sites 成功部署返回的 URL 为准。访问权限应保持仅所有者，所有静态页面、收藏 JSON 和媒体均由站点登录保护。此版本保留同样的手机界面和漫游图，电脑关闭后仍可访问。

使用带 Pillow 的 Python 运行 `tools/export_hosted_map.py ../sites/favorites-atlas --web-photos` 生成自包含快照（Sites 发布包有 256 MiB 上限，完整图组需使用手机优化版本）：复制地图文件、已有收藏和所有被引用的本地照片；去掉导出诊断、远程图片列表与原笔记临时访问令牌。云端默认读取 `data/favorites.json`，手机二维码使用站点本身的地址，不依赖局域网配对接口。新增收藏和核对结果需要重新导出并通过 Sites 发布，手机手动修改目前仍只保存在该浏览器。原始本地导出不会被覆盖。

导出后先检查站点目录里的 `npm run check`（更新数据数量时同步更新快照预期），再遵循 Sites 的源代码提交、打包和私有发布工作流。部署源中包含私人收藏与原图，请勿推送到原始小红书工具的公共仓库。
