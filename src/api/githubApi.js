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
  async getTreeRecursive(token, fullName, branch) {
    const url = `${GITHUB_API}/repos/${fullName}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
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

  async getViewer(token) {
    return ghGet(`${GITHUB_API}/user`, token);
  },

  async listRepos(token, visibility = "private") {
    const url = `${GITHUB_API}/user/repos?per_page=100&sort=updated&visibility=${visibility}`;
    return ghGet(url, token);
  },

  async listBranches(token, fullName) {
    const url = `${GITHUB_API}/repos/${fullName}/branches?per_page=100`;
    return ghGet(url, token);
  },

  async getBranch(token, fullName, branch) {
    const url = `${GITHUB_API}/repos/${fullName}/git/ref/heads/${encodeURIComponent(branch)}`;
    return ghGet(url, token);
  },

  async createBranchFrom(token, fullName, newBranch, fromBranch) {
    const ref = await this.getBranch(token, fullName, fromBranch);
    const sha = ref.object.sha;
    const url = `${GITHUB_API}/repos/${fullName}/git/refs`;
    return ghPost(url, token, { ref: `refs/heads/${newBranch}`, sha });
  },

  async compareBranches(token, fullName, base, head) {
    const url = `${GITHUB_API}/repos/${fullName}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}?per_page=300`;
    return ghGet(url, token);
  },

  async getFileText(token, fullName, path, ref) {
    const url = `${GITHUB_API}/repos/${fullName}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref)}`;
    const json = await ghGet(url, token);
    return json.encoding === "base64"
      ? atob(json.content.replace(/\n/g, ""))
      : json.content || "";
  },
};
