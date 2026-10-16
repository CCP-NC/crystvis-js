// Builds the hand-written guide site into docs/ (the JSDoc API reference is
// built separately into docs/api by `npm run docs`).
//
//   docs-src/pages/*.md      guide pages, with a small front-matter block
//   docs-src/examples/*.js   live examples, embedded with {{example name}}
//   docs-src/site.js|css     page runtime and styles
//
// An example file exports `default async function (vis, console) {...}`.
// Its imports and function body are shown on the page; the same code runs in
// the live viewer, so the two cannot drift apart.

import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Marked, Renderer } from 'marked';
import hljs from 'highlight.js/lib/common';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = path.join(root, 'docs-src');
const out = path.join(root, 'docs');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const slugify = (s) => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function highlight(code, lang) {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
    return hljs.highlight(code, { language }).value;
}

// ---------------------------------------------------------------------------
// Examples
// ---------------------------------------------------------------------------

const exampleDir = path.join(src, 'examples');
const exampleNames = fs.readdirSync(exampleDir)
    .filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3)).sort();

function exampleSource(name) {
    const text = fs.readFileSync(path.join(exampleDir, name + '.js'), 'utf8');
    const lines = text.split('\n');
    const start = lines.findIndex((l) => /^export default async function/.test(l));
    const end = lines.lastIndexOf('}');
    if (start < 0 || end <= start) {
        throw new Error(`docs-src/examples/${name}.js must contain "export default async function (vis, console) { ... }"`);
    }
    const imports = lines.slice(0, start).filter((l) => !/^\s*\/\//.test(l)).join('\n').trim();
    const body = lines.slice(start + 1, end);
    const indent = Math.min(...body.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
    const code = body.map((l) => l.slice(indent)).join('\n').trim();
    return imports ? imports + '\n\n' + code : code;
}

function exampleHtml(name, flags) {
    if (!exampleNames.includes(name)) {
        throw new Error(`Unknown example "${name}"`);
    }
    const hero = flags.includes('hero');
    const code = hero ? '' : `
  <div class="plate-code"><pre><code class="hljs language-js">${highlight(exampleSource(name), 'javascript')}</code></pre></div>`;
    return `<figure class="plate${hero ? ' plate-hero' : ''}" data-example="${name}">
  <div class="plate-view">
    <div class="viewer" role="img" aria-label="Live 3D viewer. Drag to rotate, scroll to zoom, right-drag to pan."></div>
    <button type="button" class="plate-rerun">Run again</button>
  </div>${code}
  <output class="plate-log" hidden></output>
</figure>`;
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

function parsePage(file) {
    const raw = fs.readFileSync(path.join(src, 'pages', file), 'utf8');
    const m = raw.match(/^---\n([\s\S]*?)\n---\n/);
    const meta = {};
    if (m) {
        for (const line of m[1].split('\n')) {
            const i = line.indexOf(':');
            if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
        }
    }
    return {
        slug: file.replace(/\.md$/, ''),
        title: meta.title,
        nav: meta.nav || meta.title,
        description: meta.description || '',
        order: Number(meta.order || 99),
        body: m ? raw.slice(m[0].length) : raw,
    };
}

const pages = fs.readdirSync(path.join(src, 'pages'))
    .filter((f) => f.endsWith('.md')).map(parsePage).sort((a, b) => a.order - b.order);

function renderMarkdown(page) {
    const headings = [];
    const marked = new Marked({
        gfm: true,
        renderer: {
            heading({ tokens, depth }) {
                const text = this.parser.parseInline(tokens);
                const id = slugify(text);
                if (depth === 2) headings.push({ id, text });
                if (depth === 1) return `<h1>${text}</h1>\n`;
                return `<h${depth} id="${id}"><a class="anchor" href="#${id}">${text}</a></h${depth}>\n`;
            },
            code({ text, lang }) {
                const language = (lang || '').trim();
                return `<pre><code class="hljs language-${escapeHtml(language || 'text')}">${highlight(text, language)}</code></pre>\n`;
            },
            table(token) {
                return `<div class="table-wrap">${Renderer.prototype.table.call(this, token)}</div>\n`;
            },
        },
    });
    // Plates are swapped in after parsing: blank lines inside example code
    // would otherwise end marked's HTML block and get re-parsed as Markdown.
    const plates = [];
    const body = page.body.replace(/^\{\{example ([\w-]+)((?: [\w-]+)*)\}\}$/gm, (_, name, flags) => {
        plates.push(exampleHtml(name, flags.trim().split(/\s+/)));
        return `\n<div data-plate="${plates.length - 1}"></div>\n`;
    });
    const html = marked.parse(body).replace(/<div data-plate="(\d+)"><\/div>/g, (_, i) => plates[i]);
    return { html, headings };
}

function navHtml(current, headings) {
    const items = pages.filter((p) => p.order < 90).map((p) => {
        const here = p.slug === current.slug;
        const sub = here && headings.length && p.slug !== 'index'
            ? `<ol class="toc">${headings.map((h) => `<li><a href="#${h.id}">${h.text}</a></li>`).join('')}</ol>`
            : '';
        return `<li${here ? ' class="current"' : ''}><a href="${p.slug}.html"${here ? ' aria-current="page"' : ''}>${p.nav}</a>${sub}</li>`;
    }).join('\n');
    const extras = pages.filter((p) => p.order >= 90).map((p) =>
        `<li${p.slug === current.slug ? ' class="current"' : ''}><a href="${p.slug}.html">${p.nav}</a></li>`).join('\n');
    return `<ol class="nav-pages">${items}</ol>
<ul class="nav-extra">
<li><a href="api/index.html">API reference</a></li>
${extras}
<li><a href="https://github.com/ccp-nc/crystvis-js">Source on GitHub</a></li>
</ul>`;
}

// JSDoc names class pages after their module (lib_model.module_js-Model.html).
// Rename them to <Class>.html, the URLs the guides and users link to, and
// update every link to them in the API reference.
const apiDir = path.join(out, 'api');
function normalizeApiFiles() {
    if (!fs.existsSync(apiDir)) return;
    const renames = new Map();
    for (const f of fs.readdirSync(apiDir)) {
        const m = f.match(/^.*\.module_js-(\w+)\.html$/);
        if (m) renames.set(f, m[1] + '.html');
    }
    if (!renames.size) return;
    // Names also appear in data/search.json, so rewrite every text file.
    const texts = fs.readdirSync(apiDir, { recursive: true })
        .filter((f) => /\.(html|json|js)$/.test(f)).map((f) => path.join(apiDir, f));
    for (const p of texts) {
        let text = fs.readFileSync(p, 'utf8');
        for (const [from, to] of renames) text = text.split(from).join(to);
        fs.writeFileSync(p, text);
    }
    for (const [from, to] of renames) {
        fs.renameSync(path.join(apiDir, from), path.join(apiDir, to));
    }
}
normalizeApiFiles();

function pageHtml(page) {
    const rendered = renderMarkdown(page);
    const headings = rendered.headings;
    const html = rendered.html;
    const title = page.slug === 'index' ? `crystvis-js: ${page.title}` : `${page.title} · crystvis-js`;
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(page.description)}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='13' fill='%23F2D21B'/%3E%3Ccircle cx='16' cy='16' r='9' fill='%23101827'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Spline+Sans:wght@400;500;600;700&family=Spline+Sans+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="assets/site.css">
</head>
<body class="page-${page.slug}">
<a class="skip" href="#content">Skip to content</a>
<div class="layout">
<header class="sidebar">
  <a class="brand" href="index.html">crystvis-js <span class="version">${pkg.version}</span></a>
  <details class="nav-toggle" open>
    <summary>Contents</summary>
    <nav aria-label="Guides">${navHtml(page, headings)}</nav>
  </details>
</header>
<main id="content" class="content">
${html}
</main>
</div>
<script src="assets/site.js" defer></script>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

fs.mkdirSync(path.join(out, 'assets'), { recursive: true });
fs.mkdirSync(path.join(out, 'data'), { recursive: true });

for (const page of pages) {
    fs.writeFileSync(path.join(out, page.slug + '.html'), pageHtml(page));
}

fs.copyFileSync(path.join(src, 'site.css'), path.join(out, 'assets', 'site.css'));
for (const f of fs.readdirSync(path.join(root, 'test', 'data'))) {
    fs.copyFileSync(path.join(root, 'test', 'data', f), path.join(out, 'data', f));
}

const examplesPlugin = {
    name: 'docs-examples',
    setup(build) {
        build.onResolve({ filter: /^docs:examples$/ }, () => ({ path: 'examples', namespace: 'docs' }));
        build.onLoad({ filter: /.*/, namespace: 'docs' }, () => ({
            resolveDir: exampleDir,
            contents: exampleNames.map((n, i) => `import e${i} from './${n}.js';`).join('\n') +
                `\nexport default {${exampleNames.map((n, i) => `${JSON.stringify(n)}: e${i}`).join(', ')}};`,
        }));
        // Examples import the package by its public name, as users would.
        build.onResolve({ filter: /^@ccp-nc\/crystvis-js(\/.*)?$/ }, (args) => ({
            path: path.join(root, args.path === '@ccp-nc/crystvis-js' ? 'index.js' : args.path.replace('@ccp-nc/crystvis-js/', '')),
        }));
    },
};

await esbuild.build({
    entryPoints: [path.join(src, 'site.js')],
    bundle: true,
    minify: true,
    outfile: path.join(out, 'assets', 'site.js'),
    target: ['es2020'],
    define: { global: 'globalThis' },
    inject: [path.join(__dirname, 'plugins-shim.js')],
    plugins: [examplesPlugin],
    logLevel: 'warning',
});

fs.writeFileSync(path.join(out, '.nojekyll'), '');
console.log(`Built ${pages.length} pages and ${exampleNames.length} examples into docs/`);
