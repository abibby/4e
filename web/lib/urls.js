export function safeEntryURL(path, root) {
  // Called for live results only; shell links use relative paths during SSR.
  if (!(root instanceof URL)) root = new URL(root, window.location.href);
  try {
    const url = new URL(path, root);
    return url.origin === root.origin && url.pathname.startsWith(root.pathname + 'content/')
      ? url.href : new URL('search.html', root).href;
  } catch { return new URL('search.html', root).href; }
}

export function shortMetadata(doc) {
  return ['level', 'role', 'rarity', 'item_type', 'class_or_path', 'usage', 'tier']
    .flatMap(key => (doc.metadata?.[key] || []).slice(0, 1).map(value => key === 'level' ? `Level ${value}` : value))
    .slice(0, 3).join(' · ');
}
