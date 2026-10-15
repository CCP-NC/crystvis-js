import CrystVis from '../index.js';
import examples from 'docs:examples';

const THEME = { background: 0x101827, foreground: 0xffffff, highlight: 0x00ff00, cell_line_color: 0x8a94a8, label_color: 0xffffff };
const MAX_LOG_LINES = 50;

const roundNumber = (n) => Math.round(n * 1e4) / 1e4;

function isPlainValue(value) {
    if (Array.isArray(value)) return true;
    if (value === null || typeof value !== 'object') return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

function formatArg(arg) {
    if (typeof arg === 'string') return arg;
    if (typeof arg === 'number') return String(roundNumber(arg));
    if (isPlainValue(arg)) {
        try {
            return JSON.stringify(arg, (_, v) => (typeof v === 'number' ? roundNumber(v) : v));
        } catch {
            return String(arg);
        }
    }
    return String(arg);
}

function appendLogLine(plate, text, isError) {
    const line = document.createElement('div');
    if (isError) line.className = 'err';
    line.textContent = text;
    plate.log.append(line);
    while (plate.log.children.length > MAX_LOG_LINES) {
        plate.log.firstElementChild.remove();
    }
    plate.log.hidden = false;
    plate.log.scrollTop = plate.log.scrollHeight;
}

function makeConsole(plate, vis) {
    const proxy = {};
    for (const level of ['log', 'info', 'warn', 'error']) {
        proxy[level] = (...args) => {
            if (plate.vis === vis) {
                appendLogLine(plate, args.map(formatArg).join(' '), level === 'warn' || level === 'error');
            }
            console[level](...args);
        };
    }
    return proxy;
}

function disposeViewer(plate) {
    if (!plate.vis) return;
    try {
        plate.vis.dispose();
    } catch {
        // The viewer may already be gone; nothing else to clean up.
    }
    plate.vis = null;
}

function runExample(plate) {
    disposeViewer(plate);
    plate.log.textContent = '';
    plate.log.hidden = true;

    let vis;
    try {
        vis = new CrystVis(plate.viewer);
    } catch (e) {
        appendLogLine(plate, `Error: ${e && e.message ? e.message : e}`, true);
        return;
    }
    plate.vis = vis;
    vis.highlightSelected = true;
    vis.theme = { ...THEME };

    const example = examples[plate.name];
    const out = makeConsole(plate, vis);
    (async () => {
        try {
            if (!example) throw new Error(`Unknown example "${plate.name}"`);
            await example(vis, out);
        } catch (e) {
            if (plate.vis === vis) {
                appendLogLine(plate, `Error: ${e && e.message ? e.message : e}`, true);
            }
        }
    })();
}

// Each plate keeps its state, so a viewer can be created, disposed, and recreated.
const byFigure = new Map();
for (const figure of document.querySelectorAll('figure.plate[data-example]')) {
    const plate = {
        name: figure.dataset.example,
        viewer: figure.querySelector('.viewer'),
        log: figure.querySelector('.plate-log'),
        vis: null,
    };
    byFigure.set(figure, plate);
    figure.querySelector('.plate-rerun').addEventListener('click', () => runExample(plate));
}

// Start a viewer as its plate approaches the viewport.
const startObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
        const plate = byFigure.get(entry.target);
        if (entry.isIntersecting && !plate.vis) runExample(plate);
    }
}, { rootMargin: '200px' });

// Dispose far off-screen viewers, since browsers cap the number of WebGL contexts.
// Setting plate.vis to null marks the plate to restart when it comes back.
const disposeObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
        if (!entry.isIntersecting) disposeViewer(byFigure.get(entry.target));
    }
}, { rootMargin: '1500px' });

for (const figure of byFigure.keys()) {
    startObserver.observe(figure);
    disposeObserver.observe(figure);
}

// Copy buttons for code outside plates.
for (const pre of document.querySelectorAll('pre')) {
    if (pre.closest('.plate')) continue;

    const wrap = document.createElement('div');
    wrap.className = 'code-block';
    pre.before(wrap);
    wrap.append(pre);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy';
    button.textContent = 'Copy';
    wrap.append(button);

    let timer = null;
    button.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(pre.textContent);
        } catch {
            return;
        }
        button.textContent = 'Copied';
        clearTimeout(timer);
        timer = setTimeout(() => { button.textContent = 'Copy'; }, 1500);
    });
}

// On the home page, move the title and lede into the hero plate as an overlay.
const hero = document.querySelector('body.page-index figure.plate-hero');
const h1 = document.querySelector('main h1');
if (hero && h1) {
    let lede = h1.nextElementSibling;
    while (lede && lede !== hero && lede.tagName !== 'P') lede = lede.nextElementSibling;

    const caption = document.createElement('div');
    caption.className = 'hero-caption';
    caption.append(h1);
    if (lede && lede.tagName === 'P') caption.append(lede);
    hero.querySelector('.plate-view').append(caption);
}

// Mobile nav: the contents list starts closed on narrow screens and open on desktop.
const mobileQuery = window.matchMedia('(max-width: 899px)');
const navToggle = document.querySelector('details.nav-toggle');
if (navToggle) {
    const syncNav = () => { navToggle.open = !mobileQuery.matches; };
    syncNav();
    mobileQuery.addEventListener('change', syncNav);
}
