/**
 * Converts a list of diff results into GitHub API–ready commit data.
 * Works for both ZIP and Branch diffs.
 *
 * @param {Array} diffs - List of diff objects (from zip or branch diff)
 * @param {string} basePath - Optional base path prefix
 * @returns {Array<{ path: string, content: string }>}
 */
export function serializeDiffForCommit(diffs, basePath = "") {
  if (!Array.isArray(diffs)) return [];

  return diffs
    .filter((item) => item && item.status !== "deleted")
    .map((item) => {
      const path = basePath ? `${basePath}/${item.path}` : item.path;

      // 🔹 unified content field detection
      const content =
        item.newContent ?? // used by branch-based diffs
        item.zipText ??    // used by ZIP-based diffs
        item.text ??       // generic fallback
        item.content ??    // already prepared
        "";

      return { path, content };
    });
}
