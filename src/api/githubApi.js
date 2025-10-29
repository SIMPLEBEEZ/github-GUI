const GITHUB_API = "https://api.github.com";

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
  async commitChanges(token, fullName, targetBranch, files, message) {
    if (!files?.length) throw new Error("No files to commit");

    // Determine source branch (take from first file if available)
    const sourceBranch = files[0]?.sourceBranch || targetBranch;

    // 1️⃣ Get current target branch ref and latest commit
    const refUrl = `${GITHUB_API}/repos/${fullName}/git/ref/heads/${encodeURIComponent(targetBranch)}`;
    const refData = await ghGet(refUrl, token);
    const latestCommitSha = refData.object.sha;

    const commitUrl = `${GITHUB_API}/repos/${fullName}/git/commits/${latestCommitSha}`;
    const commitData = await ghGet(commitUrl, token);
    const baseTreeSha = commitData.tree.sha;

    // 2️⃣ Get source tree to reuse SHAs for unchanged files
    const sourceTree = await this.getTreeRecursive(token, fullName, sourceBranch);
    const sourceMap = new Map(sourceTree.tree.map((t) => [t.path, t.sha]));

    // 3️⃣ Prepare tree entries (reuse SHA if exists in source branch)
    const treeEntries = [];

    for (const f of files) {
      const sourceSha = sourceMap.get(f.path);

      if (sourceSha) {
        // Reuse SHA from source branch
        treeEntries.push({
          path: f.path,
          mode: "100644",
          type: "blob",
          sha: sourceSha,
        });
      } else {
        // Create a new blob if not present in source branch
        const blob = await ghPost(`${GITHUB_API}/repos/${fullName}/git/blobs`, token, {
          content: f.content,
          encoding: "utf-8",
        });
        treeEntries.push({
          path: f.path,
          mode: "100644",
          type: "blob",
          sha: blob.sha,
        });
      }
    }

    // 4️⃣ Create a new tree
    const treeUrl = `${GITHUB_API}/repos/${fullName}/git/trees`;
    const treeData = await ghPost(treeUrl, token, {
      base_tree: baseTreeSha,
      tree: treeEntries,
    });

    // 5️⃣ Create a new commit
    const commitCreateUrl = `${GITHUB_API}/repos/${fullName}/git/commits`;
    const newCommit = await ghPost(commitCreateUrl, token, {
      message,
      tree: treeData.sha,
      parents: [latestCommitSha],
    });

    // 6️⃣ Update the branch reference
    const updateRefUrl = `${GITHUB_API}/repos/${fullName}/git/refs/heads/${encodeURIComponent(targetBranch)}`;
    const res = await fetch(updateRefUrl, {
      method: "PATCH",
      headers: {
        ...withAuthHeaders(token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sha: newCommit.sha }),
    });

    if (!res.ok) throw new Error(`Failed to update branch: ${res.statusText}`);

    return newCommit;
  },
};
