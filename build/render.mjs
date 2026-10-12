import {labels, label} from './catalog.mjs';

export function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
}

export function renderPage(template, props, render) {
  return template.replace('<div id="root"></div>', () => `<div id="root">${render(props)}</div>`);
}

// Vite transforms the shared JSX for Node during the build; no server is shipped.
export async function createRenderer(root) {
  const {createServer} = await import('vite');
  const {default: react} = await import('@vitejs/plugin-react');
  const server = await createServer({
    configFile: false, root, plugins: [react()], appType: 'custom',
    optimizeDeps: {noDiscovery: true, include: []},
    server: {middlewareMode: true, watch: null, hmr: false, ws: false},
  });
  try {
    const {render} = await server.ssrLoadModule('/web/entry-server.jsx');
    return {render, close: () => server.close()};
  } catch (error) {
    await server.close();
    throw error;
  }
}

export function entryPage(template, row, source, render = () => '') {
  const root = '../'.repeat(row.file.split('/').length);
  const category = escapeHTML(labels[row.category] || label(row.category));
  const categoryURL = `${root}search.html?category=${encodeURIComponent(row.category)}`;
  const fragment = source.replace(/^\uFEFF/, '')
    .replace(/((?:src|href)=["'])images\//gi, `$1${root}images/`)
    .replace(/https?:\/\/www\.wizards\.com\/dnd\/images\//g, `${root}images/`);
  const body = `<main id="main" class="entry"><nav class="breadcrumb" aria-label="Breadcrumb"><a href="${root}search.html">Compendium</a><span>/</span><a href="${categoryURL}">${category}</a></nav>
<article id="detail">${row.text ? fragment : `<h1>${escapeHTML(row.name)}</h1><p>The source file for this entry is empty.</p>`}</article>
<a class="entry-back" href="${categoryURL}">← Browse ${category.toLowerCase()}</a></main>`;
  // Only rebase the compiled shell, never the original rules fragment.
  return template.replace(/<title>.*?<\/title>/, () => `<title>${escapeHTML(row.name)} · D&amp;D 4e</title>`)
    .replace('name="app-root" content="./"', `name="app-root" content="${root}"`)
    .replace(/((?:src|href)=")\.\/assets\//g, `$1${root}assets/`)
    .replace('<div id="root"></div>', () => `<div id="root">${render({root, pathname: '/content/' + row.file.split('/').map(encodeURIComponent).join('/')})}</div>\n${body}`);
}

