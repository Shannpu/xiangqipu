# -*- coding: utf-8 -*-
"""把 canju12 的 FEN 题库 txt 转成 puzzles.json"""
import json, re, sys

FILES = [
    ("连将杀一至四步杀.txt", "连将杀 1-4"),
    ("连将杀五至七步杀.txt", "连将杀 5-7"),
    ("象棋杀着大全.txt", "杀着大全"),
]

VALID = set("kabnrcpKABNRCP123456789/")

def check_fen(fen):
    """粗校验：行数=10，字符合法，每行格子数=9"""
    board = fen.split(" ")[0]
    rows = board.split("/")
    if len(rows) != 10:
        return False
    for row in rows:
        cnt = 0
        for ch in row:
            if ch not in VALID:
                return False
            cnt += ch.isdigit() and int(ch) or 1
        if cnt != 9:
            return False
    return True

result = {}
total = 0
for fname, label in FILES:
    puzzles = []
    with open(fname, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or line.startswith("//"):
                continue
            flip = line.startswith("2#")
            if flip:
                line = line[2:]
            parts = line.split(" ")
            fen = parts[0]
            side = "b" if len(parts) > 1 and parts[1] == "b" else "w"
            if not check_fen(fen):
                continue
            puzzles.append([fen, side])
    result[label] = puzzles
    total += len(puzzles)
    print(f"{label}: {len(puzzles)} 题")

with open("puzzles.json", "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, separators=(",", ":"))
print(f"合计 {total} 题 -> puzzles.json")
