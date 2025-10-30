/**
 * Converts a list of diff results into commit-ready objects for the GitHub API.
 * Supports add/modify/delete and both ZIP-based and branch-based diffs.
 */
export function serializeDiffForCommit(diffs, basePath = "") {
  if (!Array.isArray(diffs)) return [];

  return diffs
    .filter(Boolean)
    .map((item) => {
      const path = basePath ? `${basePath}/${item.path}` : item.path;

      // 🔹 unified content detection
      const content =
        item.newContent ?? // used by branch-based diffs
        item.zipText ??    // used by ZIP-based diffs
        item.text ??       // generic fallback
        item.content ??    // already prepared
        "";

      // 🔹 carry over the source branch (important for commitChanges)
      const sourceBranch = item.sourceBranch ?? undefined;
      const isDelete = item.status === "removed" || item.status === "deleted";

      return { path, content, sourceBranch, delete: isDelete };
    });
}
