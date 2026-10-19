import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = [
  "src/config.js",
  "src/state.js",
  "src/logger.js",
  "src/dom.js",
  "src/categoryNames.js",
  "src/scanner.js",
  "src/albums.js",
  "src/classifier.js",
  "src/manualReview.js",
  "src/ui.js",
  "src/xhsApi.js",
  "src/index.js"
];

function stripModuleSyntax(source) {
  return source
    .replace(/^import\s+[^;]+;\r?\n/gm, "")
    .replace(/^export\s+\{[^}]+\};?\r?\n/gm, "")
    .replace(/\bexport\s+async\s+function\b/g, "async function")
    .replace(/\bexport\s+function\b/g, "function")
    .replace(/\bexport\s+const\b/g, "const")
    .replace(/\bexport\s+let\b/g, "let")
    .replace(/\bexport\s+class\b/g, "class");
}

function escapeNonAscii(source) {
  return source.replace(/[^\x00-\x7F]/g, (char) => {
    return Array.from(char)
      .map((codePointChar) => {
        const codePoint = codePointChar.codePointAt(0);
        if (codePoint <= 0xffff) {
          return `\\u${codePoint.toString(16).padStart(4, "0")}`;
        }

        const normalized = codePoint - 0x10000;
        const high = 0xd800 + (normalized >> 10);
        const low = 0xdc00 + (normalized & 0x3ff);
        return `\\u${high.toString(16).padStart(4, "0")}\\u${low.toString(16).padStart(4, "0")}`;
      })
      .join("");
  });
}

let body = "";
for (const file of files) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  body += `\n// ---- ${file} ----\n${stripModuleSyntax(source)}\n`;
}

const output = `// Generated from src/*.js. Paste this whole file into the browser Console on xiaohongshu.com.\n(function () {\n  "use strict";\n${body}\n  init();\n})();\n`;
const safeOutput = escapeNonAscii(output);

fs.mkdirSync(path.join(root, "dist"), { recursive: true });
fs.writeFileSync(path.join(root, "dist/xhs-album-builder.console.js"), safeOutput);
fs.mkdirSync(path.join(root, "extension"), { recursive: true });
fs.writeFileSync(path.join(root, "extension/xhs-album-builder.page.js"), safeOutput);
console.log("built dist/xhs-album-builder.console.js");
console.log("built extension/xhs-album-builder.page.js");
