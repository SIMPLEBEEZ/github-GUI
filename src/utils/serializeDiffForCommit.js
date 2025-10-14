/**
 * Converts a list of diffs into GitHub API–ready commit data.
 * @param {Array} diffs - List of diff objects (from zip or branch diff)
 * @param {string} basePath - Optional base path prefix
 * @returns {Array<{ path: string, content: string }>}
 */
export function serializeDiffForCommit(diffs, basePath = "") {
  const files = [];

  diffs.forEach((item) => {
    // Example item:
    // { path: "src/App.js", status: "modified", newContent: "..." }

    // Skip deleted files (GitHub API can't commit deletions via 'content' field)
    if (item.status === "deleted") return;

    const path = basePath ? `${basePath}/${item.path}` : item.path;

    files.push({
      path,
      content: item.newContent || item.content || "",
    });
  });

    return files;
}
