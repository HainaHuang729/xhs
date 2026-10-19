# 小红书收藏半自动导出脚本

这个脚本只读取你当前浏览器页面里已经能看到的内容，不需要账号密码，不上传 Cookie，不绕过登录。

## 使用步骤

1. 用电脑浏览器打开并登录小红书或 Rednote 网页端。
   - 国内版常见地址：https://www.xiaohongshu.com/
   - 国际版常见地址：https://www.rednote.com/
2. 进入你的个人主页，打开“收藏”或对应收藏夹页面。
3. 按 `F12` 打开开发者工具，进入 `Console` / `控制台`。
4. 打开 `xhs-favorites-exporter.js`，复制全部内容，粘贴到控制台回车。
5. 脚本会慢慢滚动页面，扫描笔记链接，结束后自动下载：
   - `xhs-favorites-时间.csv`
   - `xhs-favorites-时间.json`

## 停止导出

如果想中途停止，在控制台输入：

```js
window.__xhsExportStop = true
```

停止后脚本会导出已经收集到的部分。

## 注意

- 先手动切到你想导出的收藏夹。脚本只导出当前页面/当前收藏夹里能加载出来的笔记。
- 如果 Chrome 提示不允许粘贴，需要在控制台按提示输入 `allow pasting`。
- 默认导出的链接会去掉 URL 查询参数，更适合保存和分享。如果发现导出的链接打不开，可以把脚本里的 `keepQueryParams: false` 改成 `true` 后再跑一次。
- 不建议把 CSV/JSON 发给陌生人；收藏列表本身也可能透露你的兴趣画像。
