---
title: 你好，世界：我的新博客上线了
date: 2026-08-11
tags: 随笔, 公告
excerpt: 用 WorkBuddy 从零搭了一个零依赖静态博客，并部署到 GitHub Pages。记录一下为什么要自己做，以及它长什么样。
---

# 你好，世界

这是博客的第一篇文章。它不是一个现成框架套出来的产物，而是我用 [WorkBuddy](https://www.workbuddy.cn) 从零搭起来的——一个**零运行时依赖**的静态博客。

## 为什么自己搭

市面上的博客方案很多，但我想要的是：

- **完全可控**：所有文件都在仓库里，不依赖任何第三方服务
- **极致简单**：不需要数据库，不需要服务端渲染
- **随手可写**：文章就是 `posts/` 里的一个 Markdown 文件

> 工程的乐趣，往往在于把复杂的东西做简单。

## 它怎么工作

整个站点只有一个生成器 `build.js`，负责把 Markdown 转成 HTML：

```js
const html = mdToHtml(postBody);   // 解析 Markdown
fs.writeFileSync('index.html', render(layout, vars));
```

写完文章后，一条命令重新构建，再推送到 GitHub 即可。

## 接下来

我会在这里记录工程实践、读书笔记和一些碎碎念。如果你也喜欢「自己掌控一切」的感觉，欢迎一起折腾。
