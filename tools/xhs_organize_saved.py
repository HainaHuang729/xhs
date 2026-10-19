import argparse
import csv
import html
import json
import os
import re
import shutil
import subprocess
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "outputs"
OPENCLI_JS = Path(os.environ.get("APPDATA", "")) / "npm" / "node_modules" / "@jackwener" / "opencli" / "dist" / "src" / "main.js"
OPENCLI_CMD = ["node", str(OPENCLI_JS)] if OPENCLI_JS.exists() else [shutil.which("opencli") or shutil.which("opencli.cmd") or "opencli"]

CATEGORIES = [
    ("编程 AI 工具", r"AI|Codex|Vibe|Godot|Python|编程|代码|开发|工具|效率|自动化|prompt|提示词|LLM|Chatgpt|Obsidian|知识库|GitHub"),
    ("游戏娱乐", r"游戏|地平线|终末地|Steam|恐怖游戏|像素|蓝图|AE86|车辆|调教|抽奖|独立游戏"),
    ("量化金融", r"量化|金融|私募|面经|ETF|期权|Citadel|IMC|摩根大通|因子|打板|龙头|超短线|暑期实习|Trading|Quant"),
    ("港校生活", r"CUHK|CU|港硕|港中文|沙田|大埔|大围|香港|在读证明|学术会议报销"),
    ("植物园艺", r"植物|花烛|花束|盆栽|铁线莲|朱顶红|绣球|球根|酢浆草|龟背竹|园艺|浇花|种花|复花"),
    ("猫与宠物", r"猫|小猫|咪|猫砂盆|猫科|豹"),
    ("家居软装", r"家居|软装|宜家|MUJI|muji|收纳|储藏室|厨房|餐边|地砖|台灯|玻璃隔断|装修|房间|租房|小窝"),
    ("咖啡甜品", r"咖啡|甜品|蛋糕|巴斯克|面包|烘焙|奶茶"),
    ("酒饮烹饪", r"酒|鸡尾酒|梅子酒|青梅酒|泡酒|柠檬酒|Limoncello|冰淇淋|高汤|泡菜|盒马|鸡蛋|牛肉|肉麦饼|食谱|菜谱"),
    ("美食餐厅", r"美食|餐厅|晚餐|饭|豆腐|咖喱|火锅|烧烤|菜|吃|店名|大象里|外卖|食堂|大排档|豆浆|海南鸡|新荣记"),
    ("学习科研", r"科研|论文|硕博|读博|学习|英语|考试|技能|skills|博士|PHD|Introduction|Conclusion|理论物理"),
    ("摄影审美", r"摄影|拍照|机位|写真|互勉|审美|滤镜|照片|视觉|设计"),
    ("影音阅读", r"电影|剧|书|阅读|播客|音乐|文案|观影|文学|文字|随笔|四重奏|请回答1988|推理"),
    ("购物灵感", r"宝石|中古|穿搭|饰品|家居|收纳|装修|店"),
    ("情感生活", r"恋爱|女朋友|女友|闺蜜|情绪|生活|哄|委屈|想你|喜欢|情话|亲吻|接吻|朋友|心理|安慰|MBTI|INFP|INFJ"),
    ("旅行城市", r"旅行|旅游|东京|日本|神户|垦丁|白滨|台湾|京都|大阪|泉州|多洛米蒂|意大利|美娜多|徒步|攻略|路线|看展|温泉|staycation|潜水|高松|雨崩|虎跳峡|村子|春游"),
]


def run_opencli(*args):
    result = subprocess.run(
        [*OPENCLI_CMD, "xiaohongshu", *args],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=120,
    )
    if result.returncode:
        raise RuntimeError((result.stdout + "\n" + result.stderr).strip())
    return result.stdout


def parse_json_blob(text):
    start = min([i for i in (text.find("["), text.find("{")) if i >= 0], default=-1)
    if start < 0:
        raise ValueError("opencli output did not contain JSON")
    decoder = json.JSONDecoder()
    return decoder.raw_decode(text[start:])[0]


def fetch_saved(limit):
    return parse_json_blob(run_opencli("saved", "--limit", str(limit), "-f", "json"))


def fetch_note(url):
    rows = parse_json_blob(run_opencli("note", url, "-f", "json"))
    return {row.get("field"): row.get("value") for row in rows if isinstance(row, dict)}


def classify(note):
    text = f"{note.get('title', '')} {note.get('content', '')} {note.get('tags', '')}"
    for name, pattern in CATEGORIES:
        if re.search(pattern, text, re.I):
            return name
    return "其他待整理"


def build_rows(saved, details_limit):
    rows = []
    for item in saved:
        note = dict(item)
        if len(rows) < details_limit and item.get("url"):
            try:
                note.update(fetch_note(item["url"]))
            except Exception as exc:  # Failed details stay title-only so the rest of the export is preserved.
                note["detail_error"] = str(exc).splitlines()[0][:180]
        note["suggested_album"] = classify(note)
        rows.append(note)
    return rows


def write_outputs(rows):
    OUT.mkdir(exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    base = OUT / f"xhs-saved-organized-{stamp}"

    (base.with_suffix(".json")).write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")

    fields = ["rank", "suggested_album", "title", "author", "likes", "collects", "comments", "tags", "url", "content", "detail_error"]
    with base.with_suffix(".csv").open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

    grouped = {}
    for row in rows:
        grouped.setdefault(row["suggested_album"], []).append(row)

    lines = ["# 小红书收藏整理", ""]
    for name in sorted(grouped, key=lambda k: (-len(grouped[k]), k)):
        lines += [f"## {name} ({len(grouped[name])})", ""]
        for row in grouped[name][:30]:
            summary = (row.get("content") or "").replace("\n", " ")[:120]
            meta = [str(value) for value in (row.get("author"), row.get("likes") and f"{row.get('likes')}赞") if value]
            lines.append(f"- [{row.get('rank')}] {row.get('title')}{'｜' + '｜'.join(meta) if meta else ''}")
            if summary:
                lines.append(f"  {summary}")
        lines.append("")
    base.with_suffix(".md").write_text("\n".join(lines), encoding="utf-8")
    write_html(base.with_suffix(".html"), grouped)
    return base


def write_html(path, grouped):
    rows = [row for group in grouped.values() for row in group]
    with_content = sum(bool(row.get("content")) for row in rows)
    sections = []
    for name in sorted(grouped, key=lambda k: (-len(grouped[k]), k)):
        cards = []
        for row in grouped[name]:
            title = html.escape(str(row.get("title") or "无标题"))
            author = html.escape(str(row.get("author") or ""))
            url = html.escape(str(row.get("url") or ""))
            content = html.escape(str(row.get("content") or "该笔记正文为空，或当前工具只返回了标题/互动数据。"))
            meta = " · ".join(str(v) for v in (row.get("likes") and f"{row.get('likes')}赞", row.get("collects") and f"{row.get('collects')}收藏", row.get("comments") and f"{row.get('comments')}评论") if v)
            tags = html.escape(str(row.get("tags") or ""))
            cards.append(f"""
      <article class="card">
        <h3>{title}</h3>
        <p class="meta">{author}{' · ' if author and meta else ''}{html.escape(meta)}</p>
        <p class="body">{content}</p>
        {f'<p class="tags">{tags}</p>' if tags else ''}
        {f'<a href="{url}" target="_blank" rel="noreferrer">打开原笔记</a>' if url else ''}
      </article>""")
        sections.append(f"""
    <section>
      <h2>{html.escape(name)} <span>{len(grouped[name])}</span></h2>
      {''.join(cards)}
    </section>""")

    path.write_text(f"""<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8">
<title>小红书收藏正文整理</title>
<style>
body {{ margin: 0; font: 15px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif; color: #202124; background: #f6f7f9; }}
main {{ max-width: 980px; margin: 0 auto; padding: 32px 18px 60px; }}
h1 {{ margin: 0 0 6px; font-size: 28px; }}
.sub {{ margin: 0 0 28px; color: #626975; }}
section {{ margin: 28px 0; }}
h2 {{ font-size: 20px; margin: 0 0 12px; }}
h2 span {{ color: #7a808a; font-weight: 500; }}
.card {{ background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 18px; margin: 12px 0; }}
h3 {{ margin: 0 0 6px; font-size: 18px; }}
.meta, .tags {{ color: #68707d; margin: 0 0 10px; }}
.body {{ white-space: pre-wrap; margin: 12px 0; }}
a {{ color: #b4232a; text-decoration: none; }}
</style>
<main>
  <h1>小红书收藏正文整理</h1>
  <p class="sub">共 {len(rows)} 条收藏，其中 {with_content} 条有正文；缺少正文的条目保留标题和可用信息。</p>
  {''.join(sections)}
</main>
</html>
""", encoding="utf-8")


def self_test():
    from tempfile import TemporaryDirectory

    assert classify({"title": "Godot0基础教学", "content": ""}) == "编程 AI 工具"
    assert classify({"title": "深圳咖啡地图", "content": ""}) == "咖啡甜品"
    assert parse_json_blob('[{"a":1}]\nnoise') == [{"a": 1}]
    with TemporaryDirectory() as folder:
        path = Path(folder) / "sample.html"
        write_html(path, {"测试": [{"title": "<script>test</script>", "content": "正文"}, {"title": "空正文"}]})
        page = path.read_text(encoding="utf-8")
        assert "共 2 条收藏，其中 1 条有正文" in page
        assert "&lt;script&gt;test&lt;/script&gt;" in page
        assert "<script>test</script>" not in page


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=100)
    parser.add_argument("--details-limit", type=int, default=30)
    parser.add_argument("--from-legacy", help="Use an older xhs-favorites-live JSON export instead of OpenCLI.")
    parser.add_argument("--from-organized", help="Render an existing organized JSON file to HTML/CSV/MD again.")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        print("ok")
        return
    if args.from_organized:
        rows = json.loads(Path(args.from_organized).read_text(encoding="utf-8"))
        base = write_outputs(rows)
        print(json.dumps({"count": len(rows), "base": str(base)}, ensure_ascii=False))
        return
    if args.from_legacy:
        legacy = json.loads(Path(args.from_legacy).read_text(encoding="utf-8"))["rows"]
        saved = [
            {
                "rank": index + 1,
                "id": row.get("note_id", ""),
                "title": row.get("title", ""),
                "url": row.get("url_with_page_token") or row.get("clean_url", ""),
            }
            for index, row in enumerate(legacy)
        ]
        args.details_limit = 0
    else:
        saved = fetch_saved(args.limit)
    rows = build_rows(saved, args.details_limit)
    base = write_outputs(rows)
    print(json.dumps({"count": len(rows), "details": min(len(rows), args.details_limit), "base": str(base)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
