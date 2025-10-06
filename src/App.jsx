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

/****************** Services ******************/
const GITHUB_API = "https://api.github.com";

function withAuthHeaders(token) {
  return {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github+json",
  };
}

async function ghGet(url, token) {
  const res = await fetch(url, { headers: withAuthHeaders(token) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function ghGetText(url, token) {
  const res = await fetch(url, { headers: withAuthHeaders(token) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.text();
}

async function ghPost(url, token, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { ...withAuthHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function ghPut(url, token, body) {
  const res = await fetch(url, {
    method: "PUT",
    headers: { ...withAuthHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

const githubApi = {
  async getTreeRecursive(token, fullName, branch) {
    const url = `${GITHUB_API}/repos/${fullName}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
    return ghGet(url, token);
  },
  async getBlobRaw(token, fullName, sha) {
    const url = `${GITHUB_API}/repos/${fullName}/git/blobs/${sha}`;
    const res = await fetch(url, {
      headers: { ...withAuthHeaders(token), Accept: "application/vnd.github.raw" },
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.text();
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
    // 1) get SHA of fromBranch
    const ref = await this.getBranch(token, fullName, fromBranch);
    const sha = ref.object.sha;
    // 2) create ref
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
    if (json.encoding === "base64") {
      return atob(json.content.replace(/\n/g, ""));
    }
    if (json.download_url) return ghGetText(json.download_url, token);
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

function AuthPanel({ onAuthenticated, setSnack }) {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const user = await githubApi.getViewer(token);
      onAuthenticated({ token, user });
    } catch (e) {
      setSnack({ open: true, message: `Login failed: ${e.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card sx={{ mt: 4 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Login (PAT)
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Enter a Personal Access Token with <code>repo</code> permission. The token is
          only stored in memory and never saved.
        </Typography>
        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
          <TextField
            fullWidth
            type="password"
            label="GitHub PAT"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ghp_..."
          />
          <Button variant="contained" onClick={handleLogin} disabled={loading}>
            {loading ? <CircularProgress size={22} /> : "Login"}
          </Button>
        </Box>
      </CardContent>
    </Card>
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
  const [changedXml, setChangedXml] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);

  const canCompare = repo && branchA && branchB && branchA !== branchB;

  const handleCompare = async () => {
    if (!canCompare) return;
    setLoading(true);
    setBusy(true);
    setDetail(null);
    try {
      const cmp = await githubApi.compareBranches(token, repo.full_name, branchA, branchB);
      const xmlFiles = onlyXmlFiles(cmp.files);
      setChangedXml(xmlFiles);
      if (xmlFiles.length === 0) {
        setSnack({ open: true, message: "No XML file changes found." });
      }
    } catch (e) {
      setSnack({ open: true, message: `Comparison failed: ${e.message}` });
    } finally {
      setLoading(false);
      setBusy(false);
    }
  };

  const openDetail = async (file) => {
    try {
      setBusy(true);
      const baseText = await githubApi.getFileText(token, repo.full_name, file.filename, branchA);
      const headText = await githubApi.getFileText(token, repo.full_name, file.filename, branchB);
      setDetail({
        path: file.filename,
        baseText,
        headText,
        diffs: diffText(baseText, headText),
      });
    } catch (e) {
      setSnack({ open: true, message: `Failed to load file: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card sx={{ mt: 3 }}>
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Branch → Branch diff (XML)
          </Typography>
          <Button
            variant="contained"
            startIcon={<CompareIcon />}
            disabled={!canCompare || loading}
            onClick={handleCompare}
          >
            {loading ? <CircularProgress size={22} /> : "Compare"}
          </Button>
        </Box>
        {loading && <LinearProgress sx={{ mt: 2 }} />}

        <List dense>
          {changedXml.map((f) => (
            <ListItem key={f.filename} button onClick={() => openDetail(f)}>
              <ListItemText primary={f.filename} secondary={`status: ${f.status}, changes: ${f.changes}`} />
            </ListItem>
          ))}
        </List>

        <DiffDialog detail={detail} onClose={() => setDetail(null)} branchA={branchA} branchB={branchB} />
      </CardContent>
    </Card>
  );
}

function DiffDialog({ detail, onClose, branchA, branchB }) {
  if (!detail) return null;
  return (
    <Dialog open={!!detail} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Diff: {detail.path}
        <Typography variant="body2" color="text.secondary">
          {branchA} → {branchB}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        <pre style={{ whiteSpace: "pre-wrap", fontFamily: "monospace" }}>
          {detail.diffs.map((d, i) => {
            const [op, text] = d;
            const style =
              op === 1
                ? { background: "#e8f5e9" }
                : op === -1
                ? { background: "#ffebee", textDecoration: "line-through" }
                : {};
            return (
              <span key={i} style={style}>
                {text}
              </span>
            );
          })}
        </pre>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

// File row (memoized)
const FileRow = React.memo(function FileRow({ file, selected, toggleSelected, openDetail }) {
  return (
    <ListItem key={file.path} disableGutters>
      <Checkbox
        checked={selected.includes(file.path)}
        onClick={(e) => e.stopPropagation()}
        onChange={() => toggleSelected(file.path)}
        tabIndex={-1}
      />
      <ListItemButton onClick={() => openDetail(file)} sx={{ flex: 1 }}>
        <ListItemText
          primary={file.path}
          secondary={file.status === "modified" ? "modified" : "new file"}
        />
      </ListItemButton>
    </ListItem>
  );
});

function ZipComparePanel({ token, repo, branchRef, setSnack, busy, setBusy }) {
  const [zipFile, setZipFile] = useState(null);
  const [zipEntries, setZipEntries] = useState([]);
  const [comparison, setComparison] = useState([]);
  const [detail, setDetail] = useState(null); // {path, zipText, repoText, diffs}
  const [selected, setSelected] = useState([]);
  const fileInputRef = useRef(null);

  const canRun = token && repo && branchRef && zipEntries.length > 0;

  const visibleFiles = useMemo(() => comparison.filter((c) => c.status !== "same"), [comparison]);

  const onPickZip = async (file) => {
    setZipFile(file);
    setZipEntries([]);
    setComparison([]);
    setSelected([]);
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
      const blobMap = new Map();
      for (const node of tree.tree || []) {
        if (node.type === "blob" && /\.xml$/i.test(node.path)) {
          blobMap.set(normalizePath(node.path), node.sha);
        }
      }

      const results = await mapLimit(zipEntries, 24, async (e) => {
        const path = normalizePath(e.path);
        const repoSha = blobMap.get(path);
        if (!repoSha) {
          return { path, status: "added", repoSha: null, zipText: e.text };
        }
        const zipSha = await gitBlobSha(e.text);
        if (zipSha === repoSha) {
          return { path, status: "same", repoSha, zipText: e.text };
        }
        return { path, status: "modified", repoSha, zipText: e.text };
      });

      setComparison(results);
      setSelected(results.filter((c) => c.status !== "same").map((c) => c.path));

      if (results.length === 0) {
        setSnack({ open: true, message: "No XML files found in ZIP." });
      }
    } catch (e) {
      setSnack({ open: true, message: `Comparison failed: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

  const openDetail = async (c) => {
    if (c.status === "same") {
      setSnack({ open: true, message: "File is identical." });
      return;
    }
    try {
      setBusy(true);
      let repoText = "";
      if (c.repoSha) {
        repoText = await githubApi.getBlobRaw(token, repo.full_name, c.repoSha);
      }
      const diffs = diffText(repoText, c.zipText);
      setDetail({ path: c.path, repoText, zipText: c.zipText, diffs });
    } catch (e) {
      setSnack({ open: true, message: `Failed to load file details: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

  const toggleSelected = (path) => {
    setSelected((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  };

  const exportSelected = () => {
    const files = comparison
      .filter((c) => selected.includes(c.path))
      .map((c) => ({ path: c.path, text: c.zipText }));
    if (files.length === 0) {
      setSnack({ open: true, message: "Nothing to export." });
      return;
    }
    downloadAsZip(files, `export_${repo.name}_${branchRef}.zip`);
  };

  return (
    <Card sx={{ mt: 3, display: "flex", flexDirection: "column", height: "100%" }}>
      <CardContent
        sx={{
          flex: "1 1 auto",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            ZIP → Repo diff (XML)
          </Typography>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            style={{ display: "none" }}
            onChange={(e) => onPickZip(e.target.files?.[0] || null)}
          />
          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            onClick={() => fileInputRef.current?.click()}
          >
            Upload ZIP
          </Button>
          <Button
            variant="contained"
            startIcon={<CompareIcon />}
            disabled={!canRun}
            onClick={runCompare}
          >
            Compare with {branchRef}
          </Button>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportSelected}>
            Export selected (ZIP)
          </Button>
        </Box>

        {/* Selection controls */}
        {visibleFiles.length > 0 && (
          <Box sx={{ display: "flex", gap: 2, mb: 1, mt: 2, alignItems: "center" }}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setSelected(visibleFiles.map((c) => c.path))}
            >
              Select all
            </Button>
            <Button size="small" variant="outlined" onClick={() => setSelected([])}>
              Deselect all
            </Button>
            <Typography variant="body2" sx={{ ml: "auto" }}>
              New: {visibleFiles.filter((c) => c.status === "added").length} | Modified:{" "}
              {visibleFiles.filter((c) => c.status === "modified").length} | Selected:{" "}
              {selected.length}
            </Typography>
          </Box>
        )}

        {/* Virtualized list */}
        {visibleFiles.length > 0 && (
          <Box
            sx={{
              flex: "1 1 auto",
              minHeight: 0,
              height: "calc(100vh - 400px)",
              border: "1px solid rgba(0,0,0,0.1)",
              borderRadius: 1,
            }}
          >
            <Virtuoso
              totalCount={visibleFiles.length}
              itemContent={(index) => {
                const c = visibleFiles[index];
                return (
                  <FileRow
                    file={c}
                    selected={selected}
                    toggleSelected={toggleSelected}
                    openDetail={openDetail}
                  />
                );
              }}
            />
          </Box>
        )}
      </CardContent>
      <DiffDialog
        detail={detail}
        onClose={() => setDetail(null)}
        branchA={branchRef}
        branchB="ZIP"
      />
    </Card>
  );
}

function normalizePath(p) {
  return p.replace(/^\/+/, "").replace(/\\/g, "/");
}

/****************** Main App ******************/
export default function App() {
  const [auth, setAuth] = useState(null); // {token, user}
  const [busy, setBusy] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: "" });

  const [repo, setRepo] = useState(null);
  const [branchA, setBranchA] = useState("");
  const [branchB, setBranchB] = useState("");

  const [tab, setTab] = useState(0);

  const onLogout = () => {
    setAuth(null);
    setRepo(null);
    setBranchA("");
    setBranchB("");
  };

  return (
    <Box>
      <Header user={auth?.user} onLogout={onLogout} />
      {busy && <LinearProgress />}
      <Container maxWidth="lg" sx={{ py: 3 }}>
        {!auth ? (
          <AuthPanel onAuthenticated={(a) => setAuth(a)} setSnack={setSnack} />
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
              <ZipComparePanel
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

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        message={snack.message}
      />
    </Box>
  );
}
