export function withBase(path: string, base = import.meta.env.BASE_URL): string {
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new Error(`Expected a root-relative site path, received: ${path}`);
  }
  if (!base.startsWith('/') || base.startsWith('//') || base.includes('..')) {
    throw new Error(`Invalid site base: ${base}`);
  }
  return `${base.replace(/\/$/, '')}${path}`;
}

export function newsletterPath(page: number): string {
  if (!Number.isInteger(page) || page < 1 || page > 15) throw new Error(`Invalid newsletter page: ${page}`);
  return page === 1 ? '/newsletter/' : `/newsletter/${page}/`;
}
