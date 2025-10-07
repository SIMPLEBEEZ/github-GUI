export async function mapLimit(items, limit, mapper) {
  const ret = [];
  let i = 0;
  const runners = new Array(Math.min(limit, items.length))
    .fill(0)
    .map(async () => {
      while (i < items.length) {
        const idx = i++;
        ret[idx] = await mapper(items[idx], idx);
      }
    });
  await Promise.all(runners);
  return ret;
}

export function onlyXmlFiles(files) {
  return files?.filter((f) => f.filename?.toLowerCase().endsWith(".xml")) || [];
}

export function normalizePath(p) {
  return p.replace(/^\/+/, "").replace(/\\/g, "/");
}
