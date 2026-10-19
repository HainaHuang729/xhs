# XHS detail extractor sample

Purpose: run a small test for extracting note body text and currently loaded comments from Xiaohongshu detail pages.

## Use

1. Open the Xiaohongshu favorites note page.
2. Open DevTools Console.
3. Paste all of `../detail-extension/xhs-detail-extractor.sample.js`.
4. Press Enter.

By default it extracts the first 5 visible favorite notes and downloads:

- `xhs-details-sample-*.json`
- `xhs-details-sample-*.csv`

The result is also available in the page console as:

```js
window.__xhsDetailResults
```

## Configure

Run this before pasting the extractor:

```js
window.__xhsDetailConfig = {
  maxNotes: 10,
  maxCommentsPerNote: 30,
  commentScrollRounds: 8
}
```

You can also provide explicit note URLs:

```js
window.__xhsDetailUrls = [
  "https://www.xiaohongshu.com/user/profile/.../..."
]
```

## Notes

- Body text is more reliable than comments.
- Comments are lazy loaded and may require more scroll rounds.
- Keep samples small first. Full runs can trigger rate limits or Xiaohongshu risk checks.
