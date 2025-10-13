export function buildFileTree(files) {
  const root = {};
  for (const file of files) {
    const parts = file.path.split("/");
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!current[part]) current[part] = { __children: {}, __files: [] };
      if (i === parts.length - 1) {
        current[part].__file = file;
      }
      current = current[part].__children;
    }
  }
  return root;
}
