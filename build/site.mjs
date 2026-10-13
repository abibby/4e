import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { catalog, loadTables } from './catalog.mjs';
import { createRenderer, entryPage, renderPage } from './render.mjs';

export function publicConfig(env, previous) {
  const key = env.TYPESENSE_SEARCH_KEY || '';
  if (key && key === env.TYPESENSE_ADMIN_KEY) throw new Error('The browser search key must differ from the admin key');
  if (!key && previous) return previous;
  return {
    endpoint: (env.TYPESENSE_PUBLIC_URL || env.TYPESENSE_URL || '').replace(/\/+$/, ''),
    searchKey: key, collection: env.TYPESENSE_COLLECTION || 'compendium'
  };
}

export function compendiumPlugin(env) {
  let config, rows, metadata, searchConfig;
  return {
    name: 'compendium-pages',
    configResolved(resolved) {
      config = resolved;
      rows = loadTables(path.join(config.root, 'tables'));
      metadata = catalog(rows);
      const previous = path.resolve(config.root, config.build.outDir, 'assets/config.json');
      searchConfig = publicConfig(env, existsSync(previous) ? JSON.parse(readFileSync(previous, 'utf8')) : undefined);
    },
    configureServer(server) {
      const entries = new Map(rows.map(row => [row.file, row]));
      server.middlewares.use(async (request, response, next) => {
        try {
          const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
          const data = { '/assets/catalog.json': metadata, '/assets/config.json': searchConfig }[pathname];
          if (data) {
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify(data));
          } else if (['/', '/index.html', '/search.html'].includes(pathname) || pathname.startsWith('/content/')) {
            const entry = pathname.startsWith('/content/');
            const row = entry ? entries.get(pathname.slice('/content/'.length)) : null;
            if (entry && !row) { response.statusCode = 404; response.end('Entry not found'); return; }
            const file = pathname === '/search.html' ? 'search.html' : 'index.html';
            const template = await server.transformIndexHtml(request.url, readFileSync(path.join(config.root, file), 'utf8'));
            const { render } = await server.ssrLoadModule('/web/entry-server.jsx');
            const html = row
              ? entryPage(template, row, readFileSync(path.join(config.root, 'content', row.file), 'utf8'), render)
              : renderPage(template, { root: './', pathname }, render);
            response.setHeader('Content-Type', 'text/html');
            response.end(html);
          } else next();
        } catch (error) { next(error); }
      });
      server.watcher.add(path.join(config.root, 'tables'));
      server.watcher.on('change', file => {
        if (file.startsWith(path.join(config.root, 'tables') + path.sep)) server.restart();
        else if (file.startsWith(path.join(config.root, 'content') + path.sep)) server.ws.send({ type: 'full-reload' });
      });
    },
    async writeBundle() {
      const output = path.resolve(config.root, config.build.outDir);
      const template = readFileSync(path.join(output, 'index.html'), 'utf8');
      mkdirSync(path.join(output, 'assets'), { recursive: true });
      writeFileSync(path.join(output, 'assets/catalog.json'), JSON.stringify(metadata));
      writeFileSync(path.join(output, 'assets/config.json'), JSON.stringify(searchConfig));
      cpSync(path.join(config.root, 'images'), path.join(output, 'images'), { recursive: true });
      const renderer = await createRenderer(config.root);
      try {
        // All entries at the same depth share the same React header.
        const shells = new Map();
        const render = props => {
          const key = props.pathname.startsWith('/content/') ? `entry:${props.root}` : props.pathname;
          if (!shells.has(key)) shells.set(key, renderer.render(props));
          return shells.get(key);
        };
        writeFileSync(path.join(output, 'index.html'), renderPage(template, { root: './', pathname: '/index.html' }, render));
        const searchFile = path.join(output, 'search.html');
        writeFileSync(searchFile, renderPage(readFileSync(searchFile, 'utf8'), { root: './', pathname: '/search.html' }, render));
        for (const row of rows) {
          const destination = path.join(output, 'content', row.file);
          mkdirSync(path.dirname(destination), { recursive: true });
          writeFileSync(destination, entryPage(template, row, readFileSync(path.join(config.root, 'content', row.file), 'utf8'), render));
        }
        config.logger.info(`Server-rendered ${rows.length.toLocaleString()} compendium entry pages.`);
      } finally { await renderer.close(); }
    },
  };
}
