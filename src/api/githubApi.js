import { gitBlobSha } from "../utils/diffUtils";

const GITHUB_API = "https://api.github.com";
// Simple in-memory cache for branch trees
const treeCache = new Map();

function withAuthHeaders(token) {
  return {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github+json",
  };
}

async function ghGet(url, token) {
  const res = await fetch(url, { headers: withAuthHeaders(token) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} (${url})`);
  return res.json();
}

async function ghPost(url, token, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...withAuthHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} (${url})`);
  return res.json();
}

async function ghPut(url, token, body) {
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      ...withAuthHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} (${url})`);
  return res.json();
}

async function ghPatch(url, token, body) {
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      ...withAuthHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} (${url})`);
  return res.json();
}

export const githubApi = {
  // 🧩 FILES ----------------------------------------------------------
  async getTreeRecursive(token, fullName, branch) {
    const url = `${GITHUB_API}/repos/${fullName}/git/trees/${encodeURIComponent(
      branch
    )}?recursive=1`;
    return ghGet(url, token);
  },

  async getBlobRaw(token, fullName, sha) {
    const url = `${GITHUB_API}/repos/${fullName}/git/blobs/${sha}`;
    const res = await fetch(url, { headers: withAuthHeaders(token) });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const data = await res.json();
    return data.encoding === "base64"
      ? atob(data.content.replace(/\n/g, ""))
      : data.content || "";
  },

  async getFileText(token, fullName, path, ref) {
    const url = `${GITHUB_API}/repos/${fullName}/contents/${encodeURIComponent(
      path
    )}?ref=${encodeURIComponent(ref)}`;
    const json = await ghGet(url, token);
    return json.encoding === "base64"
      ? atob(json.content.replace(/\n/g, ""))
      : json.content || "";
  },

  // 🧩 USER & REPOS ---------------------------------------------------
  async getViewer(token) {
    return ghGet(`${GITHUB_API}/user`, token);
  },

  async listRepos(token, visibility = "private") {
    const url = `${GITHUB_API}/user/repos?per_page=100&sort=updated&visibility=${visibility}`;
    return ghGet(url, token);
  },

  // 🧩 BRANCHES -------------------------------------------------------
  async listBranches(token, fullName) {
    const url = `${GITHUB_API}/repos/${fullName}/branches?per_page=100`;
    return ghGet(url, token);
  },

  async getBranch(token, fullName, branch) {
    const url = `${GITHUB_API}/repos/${fullName}/git/refs/heads/${encodeURIComponent(
      branch
    )}`;
    return ghGet(url, token);
  },

  async createBranch(token, fullName, newBranch, fromBranch) {
    const ref = await this.getBranch(token, fullName, fromBranch);
    const sha = ref.object.sha;
    const url = `${GITHUB_API}/repos/${fullName}/git/refs`;
    return ghPost(url, token, { ref: `refs/heads/${newBranch}`, sha });
  },

  async compareBranches(token, fullName, base, head) {
    const url = `${GITHUB_API}/repos/${fullName}/compare/${encodeURIComponent(
      base
    )}...${encodeURIComponent(head)}?per_page=300`;
    return ghGet(url, token);
  },

  // 🧩 COMMITS --------------------------------------------------------
  /**
   * Create a commit that updates target branch with selected files.
   * Automatically reuses blob SHAs from the source branch to prevent false diffs.
   * @param {string} token - GitHub token
   * @param {string} fullName - e.g. "user/repo"
   * @param {string} targetBranch - branch to update
   * @param {Array<{path: string, content?: string, sourceBranch?: string}>} files
   * @param {string} message - commit message
   */

  /**
   * Commits selected files from sourceBranch (or ZIP) into targetBranch.
   * - Works for both ZIP→branch and branch→branch.
   * - Skips identical files to avoid empty commits.
   * - Handles deletions (sha: null).
   * - Creates new branch if target does not exist.
   * - Uses cached trees to reduce API calls.
   */
  async commitChanges(token, fullName, sourceBranch, targetBranch, files, message) {

    async function getTreeByBranch(branch) {
      const cacheKey = `${fullName}:${branch}`;
      if (treeCache.has(cacheKey)) return treeCache.get(cacheKey);

      // 1️⃣ Get branch reference (may not exist)
      const ref = await ghGet(`${GITHUB_API}/repos/${fullName}/git/refs/heads/${branch}`, token);
      if (!ref?.object?.sha) throw new Error(`Branch ${branch} not found`);
      const commitSha = ref.object.sha;

      // 2️⃣ Get commit to obtain tree SHA
      const commit = await ghGet(`${GITHUB_API}/repos/${fullName}/git/commits/${commitSha}`, token);
      const treeSha = commit.tree.sha;

      // 3️⃣ Get full tree recursively
      const tree = await ghGet(
        `${GITHUB_API}/repos/${fullName}/git/trees/${treeSha}?recursive=1`,
        token
      );

      treeCache.set(cacheKey, tree);
      return tree;
    }

    // 🧩 Get target branch ref (create if missing)
    let baseSha = null;
    let targetRef = null;
    try {
      targetRef = await ghGet(`${GITHUB_API}/repos/${fullName}/git/refs/heads/${targetBranch}`, token);
      baseSha = targetRef?.object?.sha || null;
    } catch {
      console.warn(`Target branch ${targetBranch} not found – will be created`);
    }

    // 🧩 Load both trees (if sourceBranch provided)
    let sourceTree = { tree: [] };
    let targetTree = { tree: [] };

    if (sourceBranch) {
      try {
        sourceTree = await getTreeByBranch(sourceBranch);
      } catch (err) {
        console.warn("Source branch tree load failed:", err);
      }
    }

    if (targetRef) {
      try {
        targetTree = await getTreeByBranch(targetBranch);
      } catch (err) {
        console.warn("Target branch tree load failed:", err);
      }
    }

    const sourceMap = new Map(sourceTree.tree.map((t) => [t.path, t.sha]));
    const targetMap = new Map(targetTree.tree.map((t) => [t.path, t.sha]));

    // 🧩 Build tree entries
    const treeEntries = [];
    for (const f of files) {
      const sourceSha = sourceMap.get(f.path);
      const targetSha = targetMap.get(f.path);

      // Skip identical
      if (sourceSha && sourceSha === targetSha) continue;

      if (f.delete === true) {
        treeEntries.push({ path: f.path, mode: "100644", type: "blob", sha: null });
        continue;
      }

      if (sourceSha) {
        treeEntries.push({ path: f.path, mode: "100644", type: "blob", sha: sourceSha });
      } else {
        const blob = await ghPost(`${GITHUB_API}/repos/${fullName}/git/blobs`, token, {
          content: f.content ?? "",
          encoding: "utf-8",
        });
        treeEntries.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
      }
    }

    if (treeEntries.length === 0) {
      return { noop: true, message: "No changes to commit." };
    }

    // 🧩 Create new tree
    const newTree = await ghPost(`${GITHUB_API}/repos/${fullName}/git/trees`, token, {
      base_tree: baseSha || undefined,
      tree: treeEntries,
    });

    // 🧩 Create commit
    const newCommit = await ghPost(`${GITHUB_API}/repos/${fullName}/git/commits`, token, {
      message,
      tree: newTree.sha,
      parents: baseSha ? [baseSha] : [],
    });

    // 🧩 Update or create branch ref
    if (targetRef) {
      await ghPatch(`${GITHUB_API}/repos/${fullName}/git/refs/heads/${targetBranch}`, token, {
        sha: newCommit.sha,
      });
    } else {
      await ghPost(`${GITHUB_API}/repos/${fullName}/git/refs`, token, {
        ref: `refs/heads/${targetBranch}`,
        sha: newCommit.sha,
      });
    }

    // Invalidate cached trees for affected branches so subsequent reads reflect the commit
    try {
      treeCache.delete(`${fullName}:${targetBranch}`);
      if (sourceBranch) treeCache.delete(`${fullName}:${sourceBranch}`);
    } catch (e) {
      // ignore cache invalidation errors — non-fatal
    }

    return newCommit;
  },
};
