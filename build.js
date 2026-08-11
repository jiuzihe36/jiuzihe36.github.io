#!/usr/bin/env node
/**
 * Zero-dependency static blog generator.
 * Reads Markdown posts from ./posts, a layout from ./src/layout.html,
 * and writes a fully static site (index.html + post pages + assets)
 * ready to be served by GitHub Pages from the repository root.
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const POSTS_DIR = path.join(ROOT, 'posts');
const SRC_DIR = path.join(ROOT, 'src');
const OUT_DIR = ROOT; // serve from repo root
const ASSETS_OUT = path.join(OUT_DIR, 'assets');

const SITE = {
  title: 'Evan 的技术随笔',
  description: '一个由 WorkBuddy 生成的静态博客 · 记录工程实践与思考',
  author: 'Evan',
  baseUrl: '', // set to e.g. https://<user>.github.io or repo subpath if needed
  postsPerPage: 20,
};

// ---------- tiny Markdown -> HTML ----------
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inlineMd(text) {
  // images first: ![alt](src "title")
  text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
    (_, alt, src, title) => `<img src="${src}" alt="${alt}"${title ? ` title="${title}"` : ''} loading="lazy">`);
  // links: [text](url)
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
    (_, t, url, title) => `<a href="${url}"${title ? ` title="${title}"` : ''}>${t}</a>`);
  // inline code
  text = text.replace(/`([^`]+)`/g, (_, c) => `<code>${escapeHtml(c)}</code>`);
  // bold
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // italic
  text = text.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  // strikethrough
  text = text.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  return text;
}

function parseFrontmatter(raw) {
  const fm = {};
  let body = raw;
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (m) {
    body = raw.slice(m[0].length);
    m[1].split('\n').forEach((line) => {
      const idx = line.indexOf(':');
      if (idx === -1) return;
      const key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key) fm[key] = val;
    });
  }
  return { fm, body };
}

function mdToHtml(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let i = 0;
  let listType = null; // 'ul' | 'ol'
  const closeList = () => { if (listType) { html.push(`</${listType}>`); listType = null; } };

  while (i < lines.length) {
    let line = lines[i];

    // code fence
    if (/^```/.test(line)) {
      closeList();
      const lang = line.slice(3).trim();
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++; // skip closing fence
      html.push(`<pre data-lang="${lang}"><code>${escapeHtml(buf.join('\n'))}</code></pre>`);
      continue;
    }

    // blank line
    if (/^\s*$/.test(line)) { closeList(); i++; continue; }

    // horizontal rule
    if (/^(\s*[-*_]){3,}\s*$/.test(line)) { closeList(); html.push('<hr>'); i++; continue; }

    // heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      closeList();
      const level = h[1].length;
      const txt = inlineMd(h[2].trim());
      const id = h[2].trim().toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '');
      html.push(`<h${level} id="${id}">${txt}</h${level}>`);
      i++; continue;
    }

    // blockquote
    if (/^>\s?/.test(line)) {
      closeList();
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++; }
      html.push(`<blockquote>${mdToHtml(buf.join('\n'))}</blockquote>`);
      continue;
    }

    // unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      if (listType !== 'ul') { closeList(); html.push('<ul>'); listType = 'ul'; }
      html.push(`<li>${inlineMd(line.replace(/^\s*[-*]\s+/, ''))}</li>`);
      i++; continue;
    }

    // ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      if (listType !== 'ol') { closeList(); html.push('<ol>'); listType = 'ol'; }
      html.push(`<li>${inlineMd(line.replace(/^\s*\d+\.\s+/, ''))}</li>`);
      i++; continue;
    }

    // paragraph (gather consecutive non-special lines)
    closeList();
    const buf = [line];
    i++;
    while (i < lines.length && !/^\s*$/.test(lines[i]) &&
           !/^(#{1,6}\s|>\s?|```|\s*[-*]\s+|\s*\d+\.\s+|(\s*[-*_]){3,}\s*$)/.test(lines[i])) {
      buf.push(lines[i]); i++;
    }
    html.push(`<p>${inlineMd(buf.join(' '))}</p>`);
  }
  closeList();
  return html.join('\n');
}

// ---------- read posts ----------
function readPosts() {
  if (!fs.existsSync(POSTS_DIR)) return [];
  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'));
  const posts = files.map((file) => {
    const raw = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8');
    const { fm, body } = parseFrontmatter(raw);
    const slug = file.replace(/\.md$/, '');
    const html = mdToHtml(body);
    // build excerpt
    let excerpt = fm.excerpt || '';
    if (!excerpt) {
      const txt = body.replace(/[#>*`\-]/g, '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').trim();
      excerpt = txt.slice(0, 120).replace(/\n+/g, ' ');
    }
    return {
      slug,
      title: fm.title || slug,
      date: fm.date || '',
      tags: (fm.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
      excerpt,
      html,
    };
  });
  posts.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return posts;
}

// ---------- layout ----------
function render(template, vars) {
  let out = template.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] != null ? vars[k] : ''));
  out = out.replace(/\{\{base\}\}/g, SITE.baseUrl); // resolve tokens nested inside injected vars
  return out;
}

function build() {
  // clean previous build output so deleted posts don't leave stale HTML behind.
  // wrapped in try/catch: local sandbox may block unlink; CI deletes normally.
  const safeUnlink = (p) => { try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (e) { /* ignore */ } };
  ['index.html', 'about.html', 'rss.xml'].forEach((f) => safeUnlink(path.join(OUT_DIR, f)));
  if (fs.existsSync(POSTS_DIR)) {
    fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.html')).forEach((f) => safeUnlink(path.join(POSTS_DIR, f)));
  }

  const layout = fs.readFileSync(path.join(SRC_DIR, 'layout.html'), 'utf8');
  const posts = readPosts();

  const nav = `
    <a href="{{base}}/index.html">首页</a>
    <a href="{{base}}/about.html">关于</a>
    <a href="{{base}}/rss.xml">RSS</a>`;

  // index
  const items = posts.map((p) => `
    <article class="post-card">
      <h2><a href="{{base}}/posts/${p.slug}.html">${p.title}</a></h2>
      <div class="meta">${p.date ? `<time>${p.date}</time>` : ''}${p.tags.length ? ' · ' + p.tags.map((t) => `<span class="tag">${t}</span>`).join('') : ''}</div>
      <p class="excerpt">${p.excerpt}</p>
      <a class="read-more" href="{{base}}/posts/${p.slug}.html">阅读全文 →</a>
    </article>`).join('');

  const indexHtml = render(layout, {
    site_title: SITE.title,
    site_description: SITE.description,
    page_title: SITE.title,
    base: SITE.baseUrl,
    nav,
    content: `<header class="page-head"><h1>${SITE.title}</h1><p>${SITE.description}</p></header><section class="post-list">${items || '<p>还没有文章，去 <code>posts/</code> 目录添加一篇吧。</p>'}</section>`,
    year: new Date().getFullYear(),
    author: SITE.author,
  });
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), indexHtml);

  // post pages
  const postOutDir = path.join(OUT_DIR, 'posts');
  if (!fs.existsSync(postOutDir)) fs.mkdirSync(postOutDir, { recursive: true });
  posts.forEach((p) => {
    const html = render(layout, {
      site_title: SITE.title,
      site_description: SITE.description,
      page_title: `${p.title} · ${SITE.title}`,
      base: SITE.baseUrl,
      nav,
      content: `
        <article class="post">
          <header class="post-head">
            <h1>${p.title}</h1>
            <div class="meta">${p.date ? `<time>${p.date}</time>` : ''}${p.tags.length ? ' · ' + p.tags.map((t) => `<span class="tag">${t}</span>`).join('') : ''}</div>
          </header>
          <div class="post-body">${p.html}</div>
          <footer class="post-foot"><a href="{{base}}/index.html">← 返回首页</a></footer>
        </article>`,
      year: new Date().getFullYear(),
      author: SITE.author,
    });
    fs.writeFileSync(path.join(postOutDir, `${p.slug}.html`), html);
  });

  // about page
  const aboutSrc = path.join(SRC_DIR, 'about.md');
  if (fs.existsSync(aboutSrc)) {
    const { body } = parseFrontmatter(fs.readFileSync(aboutSrc, 'utf8'));
    const aboutHtml = render(layout, {
      site_title: SITE.title,
      site_description: SITE.description,
      page_title: `关于 · ${SITE.title}`,
      base: SITE.baseUrl,
      nav,
      content: `<article class="post"><div class="post-body">${mdToHtml(body)}</div></article>`,
      year: new Date().getFullYear(),
      author: SITE.author,
    });
    fs.writeFileSync(path.join(OUT_DIR, 'about.html'), aboutHtml);
  }

  // RSS
  const rssItems = posts.map((p) => `
    <item>
      <title>${escapeHtml(p.title)}</title>
      <link>${SITE.baseUrl}/posts/${p.slug}.html</link>
      <guid>${SITE.baseUrl}/posts/${p.slug}.html</guid>
      <pubDate>${p.date ? new Date(p.date).toUTCString() : ''}</pubDate>
      <description>${escapeHtml(p.excerpt)}</description>
    </item>`).join('');
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>${escapeHtml(SITE.title)}</title>
  <link>${SITE.baseUrl}/</link>
  <description>${escapeHtml(SITE.description)}</description>
  ${rssItems}
</channel></rss>`;
  fs.writeFileSync(path.join(OUT_DIR, 'rss.xml'), rss);

  // assets
  for (const f of ['style.css', 'main.js']) {
    const src = path.join(SRC_DIR, f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(ASSETS_OUT, f));
  }

  console.log(`✓ Built ${posts.length} post(s) -> index.html, posts/, rss.xml, assets/`);
}

build();
