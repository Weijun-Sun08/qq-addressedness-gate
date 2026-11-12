# 把稿件发到 arXiv（步骤）

## 0. 先打包

```
把 arxiv/ 里的 main.tex 和 refs.bib 压成 zip（arxiv-source.zip）
不要带 PDF，arXiv 自己编译
```

## 1. 注册 / 登录

```
https://arxiv.org → Register（用邮箱）
已有账号直接 Login
```

## 2. 可能需要 endorsement

```
第一次投 cs.CL / cs.SE 的新账号，常被要求「endorsement」
找一位发过 arXiv 的人（老师、学长）帮你背书
没有的话，先传 cs.CY 或 cs.HC 也可能过
```

## 3. 开始提交

```
右上 Submit → Start New Submission
选 license（推荐 CC BY 4.0）
选分类：primary cs.CL（自然语言处理），secondary cs.SE
```

## 4. 上传源码

```
Upload files → 选 arxiv-source.zip
等它编译，点 View PDF 检查排版
报错就看日志，多是缺宏包或 bib 问题
```

## 5. 填元数据

```
Title: Deciding When a Group-Chat Bot Should Speak: A Reproducible Gate for Addressedness
Authors: Weijun Sun
Abstract: 复制 main.tex 里 abstract 那段
Comments: 4 pages, code available at github.com/Weijun-Sun08/qq-addressedness-gate
```

## 6. 提交

```
Submit → 等 moderation（一般 1-2 个工作日）
通过后拿到 arXiv ID，例如 arXiv:2611.XXXXX
```

## 7. 之后用它证明「研究用途」

```
JOSS 提交时在 Message to editors 里写：
  A preprint describing this software is available at arXiv:XXXX.XXXXX
仓库 README 里加 arXiv 链接
```

## 注意

```
· arXiv 要求「可编译的 LaTeX 源码」，不要只传 PDF（现在多数分类强制）
· 预印本不算正式发表，之后仍可投期刊/会议（多数允许）
· 参考文献少没关系，但正文要能自洽
```
