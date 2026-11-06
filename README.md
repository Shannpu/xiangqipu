# 象棋杀棋练习 PWA

移动端优先的中国象棋连将杀刷题应用，纯静态、免安装、离线可用。

## 功能

- 题库 3000 题：连将杀 1-4 步（1200）、连将杀 5-7 步（1200）、杀着大全（600）
- 你执红，xqwlight 引擎执黑防守，将杀或困毙即解出
- 无提示、无答案，做不出来换一题或重来
- 悔棋 / 随机换题 / 题号跳转 / 通关计数（localStorage）
- PWA：手机浏览器「添加到主屏幕」后离线可用

## 部署（GitHub Pages）

整个文件夹 push 到仓库，Settings → Pages → 选 main 分支 root 目录即可。
必须 HTTPS 访问才能安装 PWA（GitHub Pages 自带）。

## 本地预览

```
python3 -m http.server 8000
# 或 npx serve .
```

## 数据与依赖来源

- 题库：[liudada1980/canju12](https://github.com/liudada1980/canju12)（GPL-3.0）
- 棋盘：[lengyanyu258/xiangqiboardjs](https://github.com/lengyanyu258/xiangqiboardjs)（MIT）
- 规则：[lengyanyu258/xiangqi.js](https://github.com/lengyanyu258/xiangqi.js)（BSD）
- 引擎：[xqbase/xqwlight](https://github.com/xqbase/xqwlight)（LGPL）
