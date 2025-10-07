import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  LinearProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Snackbar,
  Tab,
  Tabs,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import UploadIcon from "@mui/icons-material/Upload";
import CompareIcon from "@mui/icons-material/Compare";
import MergeIcon from "@mui/icons-material/MergeType";
import AddIcon from "@mui/icons-material/Add";
import JSZip from "jszip";
import { diff_match_patch } from "diff-match-patch";
import { Virtuoso } from "react-virtuoso";
import DiffPanelBase from "./components/DiffPanelBase";
import AuthPanel from "./components/AuthPanel";
import { Toaster } from "react-hot-toast";
import { useGitHubOAuth } from "./hooks/useGitHubOAuth";

/*************************************
 * GitHub GUI – MVP (per spec)
 * - Auth via PAT (in-memory only)
 * - List repositories & branches
 * - Create branch from selected source
 * - Branch↔Branch: list changed XML files
 * - ZIP↔Repo: import ZIP and compare XML text
 * - Export selected files to ZIP
 *
 * Notes:
 * - Works on GitHub Pages (pure front-end). No tokens stored.
 * - Keep repos ≤ ~500 MB and ZIPs ≤ ~100 MB for performance.
 *************************************/

/****************** GitHub API base + helpers ******************/

const GITHUB_API = "https://api.github.com";

/**
 * Returns default GitHub API headers with your Personal Access Token (PAT).
 */
function withAuthHeaders(token) {
  return {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github+json",
  };
}

/**
 * Generic JSON fetch wrapper with proper headers and error handling.
 */
async function ghGet(url, token) {
  const res = await fetch(url, { headers: withAuthHeaders(token) });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} (${url})`);
  }
  return res.json();
}

/**
 * Generic text fetch wrapper (rarely used now; API returns JSON/Base64).
 */
async function ghGetText(url, token) {
  const res = await fetch(url, { headers: withAuthHeaders(token) });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} (${url})`);
  }
  return res.text();
}

/**
 * POST helper for GitHub API endpoints.
 */
async function ghPost(url, token, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...withAuthHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} (${url})`);
  }
  return res.json();
}

/**
 * PUT helper for GitHub API endpoints.
 */
async function ghPut(url, token, body) {
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      ...withAuthHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} (${url})`);
  }
  return res.json();
}

const githubApi = {
  async getTreeRecursive(token, fullName, branch) {
    const url = `${GITHUB_API}/repos/${fullName}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
    return ghGet(url, token);
  },

  // Get raw blob text directly via API (safe, supports private repos)
  async getBlobRaw(token, fullName, sha) {
    const url = `${GITHUB_API}/repos/${fullName}/git/blobs/${sha}`;
    const res = await fetch(url, {
      headers: withAuthHeaders(token),
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const data = await res.json();
    if (data.encoding === "base64") {
      return atob(data.content.replace(/\n/g, ""));
    }
    return data.content || "";
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

  // ✅ SAFE VERSION – uses only GitHub API (no raw.githubusercontent.com)
  async getFileText(token, fullName, path, ref) {
    const url = `${GITHUB_API}/repos/${fullName}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref)}`;
    const json = await ghGet(url, token);

    if (json.encoding === "base64") {
      return atob(json.content.replace(/\n/g, ""));
    }

    // Do NOT use json.download_url — raw.githubusercontent.com has no CORS
    return "";
  },
};

/****************** Utilities ******************/
const dmp = new diff_match_patch();

// Compute Git blob SHA-1 for a given UTF-8 text
async function gitBlobSha(text) {
  const enc = new TextEncoder();
  const bytes = enc.encode(text ?? "");
  const header = enc.encode(`blob ${bytes.length}\u0000`);
  const buf = new Uint8Array(header.length + bytes.length);
  buf.set(header, 0);
  buf.set(bytes, header.length);
  const hash = await crypto.subtle.digest("SHA-1", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Simple concurrency limiter
async function mapLimit(items, limit, mapper) {
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

function onlyXmlFiles(files) {
  return files?.filter((f) => f.filename?.toLowerCase().endsWith(".xml")) || [];
}

async function fileListFromZip(file) {
  const zip = await JSZip.loadAsync(file);
  const entries = [];
  await Promise.all(
    Object.keys(zip.files).map(async (name) => {
      const entry = zip.files[name];
      if (entry.dir) return;
      if (!name.toLowerCase().endsWith(".xml")) return;
      const text = await entry.async("string");
      entries.push({ path: name, text });
    })
  );
  return entries;
}

function diffText(a, b) {
  const diffs = dmp.diff_main(a ?? "", b ?? "");
  dmp.diff_cleanupSemantic(diffs);
  return diffs;
}

function normalizeXmlText(text) {
  return (text ?? "")
    .replace(/\r\n/g, "\n")     // normalize CRLF -> LF
    .replace(/[ \t]+$/gm, "")   // strip trailing spaces/tabs per line
    .replace(/^\s*\n/gm, "")    // remove empty lines
    .trim();                    // trim start/end
}

function downloadAsZip(files, zipName = "export.zip") {
  const zip = new JSZip();
  files.forEach((f) => zip.file(f.path, f.text ?? ""));
  zip.generateAsync({ type: "blob" }).then((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = zipName;
    a.click();
    URL.revokeObjectURL(url);
  });
}

/****************** UI Blocks ******************/
function Header({ user, onLogout }) {
  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          GitHub GUI – MVP
        </Typography>
        {user && (
          <Chip
            label={`${user.login}`}
            avatar={<img src={user.avatar_url} alt="avatar" width={24} height={24} />}
            sx={{ mr: 2, color: "white" }}
          />
        )}
        {user && (
          <Button color="inherit" onClick={onLogout} startIcon={<CloseIcon />}>
            Log out
          </Button>
        )}
      </Toolbar>
    </AppBar>
  );
}

function RepoBranchPicker({ token, repo, setRepo, branchA, branchB, setBranchA, setBranchB, busy, setBusy, setSnack }) {
  const [repos, setRepos] = useState([]);
  const [branches, setBranches] = useState([]);
  const [newBranchName, setNewBranchName] = useState("");
  const [fromBranch, setFromBranch] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        const data = await githubApi.listRepos(token, "private");
        if (!cancelled) setRepos(data);
      } catch (e) {
        setSnack({ open: true, message: `Error loading repositories: ${e.message}` });
      } finally {
        setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!repo) return setBranches([]);
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        const data = await githubApi.listBranches(token, repo.full_name);
        if (!cancelled) setBranches(data);
      } catch (e) {
        setSnack({ open: true, message: `Error loading branches: ${e.message}` });
      } finally {
        setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, repo]);

  const handleCreateBranch = async () => {
    if (!repo || !newBranchName || !fromBranch) return;
    setBusy(true);
    try {
      await githubApi.createBranchFrom(token, repo.full_name, newBranchName, fromBranch);
      const data = await githubApi.listBranches(token, repo.full_name);
      setBranches(data);
      setNewBranchName("");
      setSnack({ open: true, message: `Branch '${newBranchName}' created.` });
    } catch (e) {
      setSnack({ open: true, message: `Branch creation failed: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card sx={{ mt: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Repository & Branches
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 2 }}>
          <FormControl fullWidth>
            <InputLabel id="repo-label">Repository</InputLabel>
            <Select
              labelId="repo-label"
              label="Repository"
              value={repo?.full_name ?? ""}
              onChange={(e) => {
                const found = repos.find((r) => r.full_name === e.target.value);
                setRepo(found || null);
              }}
            >
              {repos.map((r) => (
                <MenuItem key={r.id} value={r.full_name}>
                  {r.full_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel id="branchA-label">Branch A (base)</InputLabel>
            <Select
              labelId="branchA-label"
              label="Branch A (base)"
              value={branchA}
              onChange={(e) => setBranchA(e.target.value)}
            >
              {branches.map((b) => (
                <MenuItem key={b.name} value={b.name}>
                  {b.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel id="branchB-label">Branch B (head)</InputLabel>
            <Select
              labelId="branchB-label"
              label="Branch B (head)"
              value={branchB}
              onChange={(e) => setBranchB(e.target.value)}
            >
              {branches.map((b) => (
                <MenuItem key={b.name} value={b.name}>
                  {b.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle1" gutterBottom>
          Create a new branch
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr", gap: 2 }}>
          <TextField
            label="New branch name"
            value={newBranchName}
            onChange={(e) => setNewBranchName(e.target.value)}
          />
          <FormControl>
            <InputLabel id="from-branch-label">From branch</InputLabel>
            <Select
              labelId="from-branch-label"
              label="From branch"
              value={fromBranch}
              onChange={(e) => setFromBranch(e.target.value)}
            >
              {branches.map((b) => (
                <MenuItem key={b.name} value={b.name}>
                  {b.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={handleCreateBranch}>
            Create
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}

function BranchDiffPanel({ token, repo, branchA, branchB, setSnack, busy, setBusy }) {
  const [comparison, setComparison] = useState([]);
  const [detail, setDetail] = useState(null);
  const [selected, setSelected] = useState([]);
  const canCompare = repo && branchA && branchB && branchA !== branchB;

  const visibleFiles = useMemo(() => comparison.filter((c) => c.status !== "same"), [comparison]);

  const runCompare = async () => {
    if (!canCompare) return;
    setBusy(true);
    try {
      const cmp = await githubApi.compareBranches(token, repo.full_name, branchA, branchB);
      const xmlFiles = onlyXmlFiles(cmp.files).map((f) => ({
        path: f.filename,
        status: f.status,
      }));
      setComparison(xmlFiles);
      setSelected(xmlFiles.filter((f) => f.status !== "same").map((f) => f.path));
      if (xmlFiles.length === 0) setSnack({ open: true, message: "No XML file changes found." });
    } catch (e) {
      setSnack({ open: true, message: `Comparison failed: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

  const openDetail = async (file) => {
    try {
      setBusy(true);
      const baseRaw = await githubApi.getFileText(token, repo.full_name, file.path, branchA);
      const headRaw = await githubApi.getFileText(token, repo.full_name, file.path, branchB);
      const baseText = normalizeXmlText(baseRaw);
      const headText = normalizeXmlText(headRaw);
      if (baseText === headText) {
        setSnack({ open: true, message: "File is identical after normalization." });
        return;
      }
      const diffs = diffText(baseText, headText);
      setDetail({ path: file.path, diffs, branchA, branchB });
    } catch (e) {
      setSnack({ open: true, message: `Failed to load file: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

  const exportSelected = async () => {
    const targets = comparison.filter((c) => selected.includes(c.path));
    if (!targets.length) return setSnack({ open: true, message: "Nothing to export." });
    setBusy(true);
    try {
      const files = await Promise.all(
        comparison
          .filter((c) => selected.includes(c.path))
          .map(async (c) => {
            // Step 1: get metadata via GitHub API (safe)
            const meta = await ghGet(
              `${GITHUB_API}/repos/${repo.full_name}/contents/${encodeURIComponent(c.path)}?ref=${encodeURIComponent(branchB)}`,
              token
            );

            // Step 2: decode Base64
            const text = meta.encoding === "base64"
              ? atob(meta.content.replace(/\n/g, ""))
              : (meta.content ?? "");

            return { path: c.path, text };
          })
      );
      downloadAsZip(files, `export_${repo.name}_${branchA}_vs_${branchB}.zip`);
      setSnack({ open: true, message: `Exported ${files.length} files.` });
    } catch (e) {
      setSnack({ open: true, message: `Export failed: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <DiffPanelBase
      title="Branch → Branch diff (XML)"
      compareLabel={`Compare ${branchA} ↔ ${branchB}`}
      canRun={canCompare}
      visibleFiles={visibleFiles}
      selected={selected}
      setSelected={setSelected}
      onCompare={runCompare}
      onExport={exportSelected}
      onOpenDetail={openDetail}
      detail={detail}
      setDetail={setDetail}
    />
  );
}

function ZipDiffPanel({ token, repo, branchRef, setSnack, busy, setBusy }) {
  const [zipEntries, setZipEntries] = useState([]);
  const [comparison, setComparison] = useState([]);
  const [detail, setDetail] = useState(null);
  const [selected, setSelected] = useState([]);
  const fileInputRef = useRef(null);

  const canRun = token && repo && branchRef && zipEntries.length > 0;
  const visibleFiles = useMemo(() => comparison.filter((c) => c.status !== "same"), [comparison]);

  const pickZip = async (file) => {
    if (!file) return;
    try {
      setBusy(true);
      const entries = await fileListFromZip(file);
      setZipEntries(entries);
      setSnack({ open: true, message: `Loaded ${entries.length} XML files from ZIP.` });
    } catch (e) {
      setSnack({ open: true, message: `ZIP error: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

  const runCompare = async () => {
    if (!canRun) return;
    setBusy(true);
    try {
      const tree = await githubApi.getTreeRecursive(token, repo.full_name, branchRef);
      const blobMap = new Map(tree.tree.filter((t) => /\.xml$/i.test(t.path)).map((n) => [n.path, n.sha]));

      const results = await mapLimit(zipEntries, 24, async (e) => {
        const path = e.path;
        const repoSha = blobMap.get(path);
        if (!repoSha) return { path, status: "added", repoSha: null, zipText: e.text };
        const zipSha = await gitBlobSha(e.text);
        if (zipSha === repoSha) return { path, status: "same", repoSha, zipText: e.text };
        return { path, status: "modified", repoSha, zipText: e.text };
      });

      setComparison(results);
      setSelected(results.filter((c) => c.status !== "same").map((c) => c.path));
    } catch (e) {
      setSnack({ open: true, message: `Comparison failed: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

  const openDetail = async (c) => {
    try {
      setBusy(true);
      const repoRaw = c.repoSha
        ? await githubApi.getBlobRaw(token, repo.full_name, c.repoSha)
        : "";
      const repoText = normalizeXmlText(repoRaw);
      const zipText = normalizeXmlText(c.zipText);
      if (repoText === zipText) {
        setSnack({ open: true, message: "File is identical after normalization." });
        return;
      }
      const diffs = diffText(repoText, zipText);
      setDetail({ path: c.path, diffs, branchA: branchRef, branchB: "ZIP" });
    } catch (e) {
      setSnack({ open: true, message: `Failed to load file details: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

  const exportSelected = () => {
    const files = comparison
      .filter((c) => selected.includes(c.path))
      .map((c) => ({ path: c.path, text: c.zipText }));
    if (!files.length) {
      setSnack({ open: true, message: "Nothing to export." });
      return;
    }
    downloadAsZip(files, `export_${repo.name}_${branchRef}.zip`);
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        style={{ display: "none" }}
        onChange={(e) => pickZip(e.target.files?.[0])}
      />
      <Button
        variant="outlined"
        startIcon={<UploadIcon />}
        onClick={() => fileInputRef.current?.click()}
        sx={{ mb: 2 }}
      >
        Upload ZIP
      </Button>

      <DiffPanelBase
        title="ZIP → Repo diff (XML)"
        compareLabel={`Compare with ${branchRef}`}
        canRun={canRun}
        visibleFiles={visibleFiles}
        selected={selected}
        setSelected={setSelected}
        onCompare={runCompare}
        onExport={exportSelected}
        onOpenDetail={openDetail}
        detail={detail}
        setDetail={setDetail}
      />
    </>
  );
}

function normalizePath(p) {
  return p.replace(/^\/+/, "").replace(/\\/g, "/");
}

/****************** Main App ******************/
export default function App() {
  const { auth, logout } = useGitHubOAuth();
  const [busy, setBusy] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: "" });

  const [repo, setRepo] = useState(null);
  const [branchA, setBranchA] = useState("");
  const [branchB, setBranchB] = useState("");

  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Header user={auth?.user} onLogout={logout} />
      {busy && <LinearProgress />}
      <Container maxWidth="lg" sx={{ py: 3 }}>
        {!auth ? (
          <AuthPanel onAuthenticated={() => {}} setSnack={setSnack} />
        ) : (
          <>
            <RepoBranchPicker
              token={auth.token}
              repo={repo}
              setRepo={setRepo}
              branchA={branchA}
              branchB={branchB}
              setBranchA={setBranchA}
              setBranchB={setBranchB}
              busy={busy}
              setBusy={setBusy}
              setSnack={setSnack}
            />

            <Box sx={{ borderBottom: 1, borderColor: "divider", mt: 3 }}>
              <Tabs value={tab} onChange={(_, v) => setTab(v)}>
                <Tab label="Branch ↔ Branch" />
                <Tab label="ZIP ↔ Repo" />
              </Tabs>
            </Box>

            {tab === 0 && (
              <BranchDiffPanel
                token={auth.token}
                repo={repo}
                branchA={branchA}
                branchB={branchB}
                setSnack={setSnack}
                busy={busy}
                setBusy={setBusy}
              />
            )}

            {tab === 1 && (
              <ZipDiffPanel
                token={auth.token}
                repo={repo}
                branchRef={branchA || branchB}
                setSnack={setSnack}
                busy={busy}
                setBusy={setBusy}
              />
            )}
          </>
        )}
      </Container>

      {/* Toast notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#161b22",
            color: "#fff",
            border: "1px solid #30363d",
          },
          success: {
            iconTheme: {
              primary: "#3fb950",
              secondary: "#161b22",
            },
          },
        }}
      />
    </Box>
  );
}

export { githubApi };
