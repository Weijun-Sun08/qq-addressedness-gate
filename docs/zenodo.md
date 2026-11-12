# 用 Zenodo 给仓库挂 DOI（GitHub 自动归档）

## 0. 准备

```
GitHub 仓库已公开、已有 release（现在有 v0.1.1）
```

## 1. 登录 Zenodo

```
打开 https://zenodo.org
右上 Sign up / Sign in
选「Sign in with GitHub」授权
```

## 2. 打开 GitHub 关联

```
登录后点右上头像 → Settings
左侧找到 GitHub（或直接访问 https://zenodo.org/account/settings/github/）
```

## 3. 开启仓库归档

```
页面列出你的 GitHub 仓库
找到 qq-addressedness-gate，把开关打开（ON）
```

## 4. 触发一次归档

```
回到 GitHub → Releases → 再发一个 release（比如 v0.1.2）
或者编辑现有 release 重新发布一次
Zenodo 检测到新 release 会自动打包、生成 DOI
```

## 5. 拿 DOI

```
回到 https://zenodo.org/account/settings/github/
仓库那一行会显示 DOI 徽章
点进去能看到记录页：标题、作者、版本、DOI
```

## 6. 用起来

```
· GitHub 仓库 About 右侧加 DOI 徽章（可选）
· README 里把徽章链接换成正式 DOI
· 简历/论文里引用格式：

  Sun, W. (2026). qq-addressedness-gate (v0.1.1) [Computer software].
  Zenodo. https://doi.org/10.5281/zenodo.XXXXXXX
```

## 注意

```
· 每个 release 会生成一个新 DOI；Zenodo 会给一个「总 DOI」指向所有版本
· 引用时用具体版本 DOI，指向整个项目用总 DOI
· 归档是自动的，之后每次发 release 都会存一份
```

## 常见问题

| 问题 | 处理 |
|---|---|
| 看不到仓库 | 确认 Zenodo 授权时勾了该仓库的访问权限 |
| 发了 release 没生成 DOI | 等几分钟；确认 Zenodo 的开关是 ON |
| 想改作者/标题 | Zenodo 记录页可以编辑元数据 |
