---
title: 关于这个博客
---

# 关于

你好，我是 **Evan**。

这是一个用 [WorkBuddy](https://www.workbuddy.cn) 生成的静态博客，部署在 GitHub Pages 上。整个站点零运行时依赖，所有页面都由 `posts/` 目录下的 Markdown 文件构建而来。

## 技术栈

- 纯静态 HTML / CSS / JS，无需数据库
- 一个零依赖的 Node 生成器（`build.js`）
- 部署在 GitHub Pages，免费且稳定

## 如何写新文章

1. 在 `posts/` 目录新建一个 `.md` 文件，文件名即文章地址
2. 在文件顶部写 frontmatter：

```markdown
---
title: 文章标题
date: 2026-08-11
tags: 技术, 随笔
excerpt: 一句话简介（可选）
---

正文用 Markdown 书写……
```

3. 运行 `node build.js` 重新生成站点
4. 提交并推送到 GitHub

欢迎随时给我留言交流。
