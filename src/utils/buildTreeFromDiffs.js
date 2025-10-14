/**
 * Builds a nested tree structure from a flat list of diffs.
 * Example input:
 *   [
 *     { path: "src/App.js", status: "modified" },
 *     { path: "src/utils/helpers.js", status: "added" },
 *     { path: "README.md", status: "modified" }
 *   ]
 *
 * Example output:
 *   [
 *     {
 *       name: "src",
 *       type: "folder",
 *       children: [
 *         { name: "App.js", path: "src/App.js", type: "file", status: "modified" },
 *         { name: "utils", type: "folder", children: [
 *             { name: "helpers.js", path: "src/utils/helpers.js", type: "file", status: "added" }
 *         ]}
 *       ]
 *     },
 *     { name: "README.md", path: "README.md", type: "file", status: "modified" }
 *   ]
 */

export function buildTreeFromDiffs(diffs) {
  const root = {};

  diffs.forEach((diff) => {
    const parts = diff.path.split("/");
    let current = root;

    parts.forEach((part, idx) => {
      const isFile = idx === parts.length - 1;

      if (!current[part]) {
        current[part] = isFile
          ? { name: part, path: diff.path, type: "file", status: diff.status }
          : { name: part, type: "folder", children: {} };
      }

      // Go deeper
      if (!isFile) current = current[part].children;
    });
  });

  // Convert nested objects to arrays for easier rendering
  function convertToArray(obj) {
    return Object.values(obj).map((node) => {
      if (node.type === "folder") {
        node.children = convertToArray(node.children);
      }
      return node;
    });
  }

  return convertToArray(root);
}
