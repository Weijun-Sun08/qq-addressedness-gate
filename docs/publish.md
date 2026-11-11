# 发布步骤（不装 git，全程网页）

> 适用：本机没有 git、GitHub 时通时不通。全部操作都能在浏览器里完成。

## 0. 准备

1. 解压 `qq-addressedness-gate.zip`，得到一个文件夹，里面能看到 `README.md`、`src`、`test`、`docs` 等。
2. 确认文件都在，不要解压出一个两层同名目录。

## 1. 建仓库

1. 打开 https://github.com ，登录（没有就注册）。
2. 右上角 `+` → `New repository`。
3. 填写：
   - Repository name：`qq-addressedness-gate`
   - Description：`Decide when a group-chat bot should speak`
   - 选 `Public`
   - **不要**勾 `Add a README file`（避免冲突）
4. 点 `Create repository`。

## 2. 上传文件

1. 在新仓库页面点 `Add file` → `Upload files`。
2. 打开解压后的文件夹，全选里面的**文件和子文件夹**（`src`、`test`、`docs`、`experiments`、`examples`、`README.md`、`LICENSE`、`package.json`、`paper.md`、`paper.bib`、`config.example.json`、`.gitignore`），拖进网页。
3. 等进度条走完，底部 `Commit changes` 填一句 `Initial import`，点提交。
4. 刷新仓库首页，确认能看到 `src` 等目录。

> 隐藏文件 `.gitignore` 在资源管理器里可能看不到：先开「查看 → 隐藏的项目」。

## 3. 打版本 tag

1. 仓库右侧 `Releases` → `Create a new release`。
2. `Choose a tag` 输入 `v0.1.0` → 点 `Create new tag`。
3. Release title 填 `v0.1.0`，描述写一句：
   `First public release of the addressedness gate.`
4. 点 `Publish release`。

## 4. 投稿 JOSS

1. 打开 https://joss.theoj.org ，用 GitHub 账号登录。
2. 点 `Submit a paper`。
3. 填写：
   - Repository URL：`https://github.com/<你的用户名>/qq-addressedness-gate`
   - Version / tag：`v0.1.0`
   - Software name：`qq-addressedness-gate`
   - Authors：你的名字、单位、邮箱、GitHub 用户名
   - 语言：选 `JavaScript`
   - 简短描述：一句话说明用途
4. 提交前自查：
   - 仓库公开可访问
   - `LICENSE` 存在
   - `README.md` 有安装与用法
   - `npm test` 能在干净环境跑通
   - `paper.md` 和 `paper.bib` 在仓库根目录
5. 点提交。

## 5. 之后发生什么

1. 编辑分配，审稿在仓库的 GitHub issue 里公开进行。
2. 审稿人会 clone 下来跑，可能提：
   - 安装步骤不清楚
   - 测试覆盖不足
   - 和已有工具的区别
3. 你逐条回复、改代码、补文档，直到录用。
4. 录用后 JOSS 给 DOI，`paper.md` 变成正式页面。

## 6. 常见卡点

| 问题 | 处理 |
|---|---|
| 网页上传大文件夹失败 | 分两次上传：先 `src`+`test`，再其余 |
| 看不到 `.gitignore` | 资源管理器开「隐藏的项目」 |
| 上传后目录结构乱 | 确认拖的是文件夹本身，不是文件夹里的内容再套一层 |
| GitHub 打不开 | 换网络（手机热点）；或等能访问再传，文件在本地不会丢 |
| JOSS 说不是 research software | 在 paper.md 的 Research applications 一节强调可复现的对照实验 |
