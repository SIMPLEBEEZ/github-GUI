import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  List,
  ListItem,
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

/*************************************
 * GitHub GUI – MVP (per spec)
 * - Auth via PAT (in-memory only)
 * - List repos & branches
 * - Create branch from selected source
 * - Branch↔Branch: list changed XML files
 * - ZIP↔Repo: import ZIP and compare XML text
 * - Export selected files to ZIP
 *
 * Notes:
 * - Works on GitHub Pages (pure front‑end). No tokens stored.
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
    const url = `${GITHUB_API}/repos/${fullName}/git/ref/heads/${encodeURIComponent(
      branch
    )}`;
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
    const url = `${GITHUB_API}/repos/${fullName}/compare/${encodeURIComponent(
      base
    )}...${encodeURIComponent(head)}?per_page=300`;
    return ghGet(url, token);
  },
  async getFileText(token, fullName, path, ref) {
    const url = `${GITHUB_API}/repos/${fullName}/contents/${encodeURIComponent(
      path
    )}?ref=${encodeURIComponent(ref)}`;
    const json = await ghGet(url, token);
    if (json.encoding === "base64") {
      return atob(json.content.replace(/\n/g, ""));
    }
    // Fallback: raw URL
    if (json.download_url) return ghGetText(json.download_url, token);
    return "";
  },
};

/****************** Utilities ******************/
const dmp = new diff_match_patch();

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
      if (!name.toLowerCase().endsWith(".xml")) return; // per MVP: XML only
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
            Odhlásit
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
      setSnack({ open: true, message: `Přihlášení selhalo: ${e.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card sx={{ mt: 4 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Přihlášení (PAT)
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Vložte Personal Access Token s oprávněním <code>repo</code>. Token je
          držen pouze v paměti prohlížeče a neukládá se.
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
            {loading ? <CircularProgress size={22} /> : "Přihlásit"}
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
        setSnack({ open: true, message: `Chyba při načítání repozitářů: ${e.message}` });
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
        setSnack({ open: true, message: `Chyba při načítání větví: ${e.message}` });
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
      setSnack({ open: true, message: `Větev '${newBranchName}' vytvořena.` });
    } catch (e) {
      setSnack({ open: true, message: `Vytvoření větve selhalo: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card sx={{ mt: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Repozitář & větve
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 2 }}>
          <FormControl fullWidth>
            <InputLabel id="repo-label">Repozitář</InputLabel>
            <Select
              labelId="repo-label"
              label="Repozitář"
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
          Vytvořit novou větev
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr", gap: 2 }}>
          <TextField
            label="Název nové větve"
            value={newBranchName}
            onChange={(e) => setNewBranchName(e.target.value)}
          />
          <FormControl>
            <InputLabel id="from-branch-label">Z větve</InputLabel>
            <Select
              labelId="from-branch-label"
              label="Z větve"
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
            Vytvořit
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}

function BranchDiffPanel({ token, repo, branchA, branchB, setSnack, busy, setBusy }) {
  const [changedXml, setChangedXml] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null); // {path, baseText, headText, diffs}

  const canCompare = repo && branchA && branchB && branchA !== branchB;

  const handleCompare = async () => {
    if (!canCompare) return;
    setLoading(true);
    setBusy(true);
    setDetail(null);
    try {
      const cmp = await githubApi.compareBranches(
        token,
        repo.full_name,
        branchA,
        branchB
      );
      const xmlFiles = onlyXmlFiles(cmp.files);
      setChangedXml(xmlFiles);
      if (xmlFiles.length === 0) {
        setSnack({ open: true, message: "Žádné změny v XML souborech." });
      }
    } catch (e) {
      setSnack({ open: true, message: `Porovnání selhalo: ${e.message}` });
    } finally {
      setLoading(false);
      setBusy(false);
    }
  };

  const openDetail = async (file) => {
    try {
      setBusy(true);
      const baseText = await githubApi.getFileText(
        token,
        repo.full_name,
        file.filename,
        branchA
      );
      const headText = await githubApi.getFileText(
        token,
        repo.full_name,
        file.filename,
        branchB
      );
      setDetail({
        path: file.filename,
        baseText,
        headText,
        diffs: diffText(baseText, headText),
      });
    } catch (e) {
      setSnack({ open: true, message: `Načtení souboru selhalo: ${e.message}` });
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
            {loading ? <CircularProgress size={22} /> : "Porovnat"}
          </Button>
        </Box>
        {loading && <LinearProgress sx={{ mt: 2 }} />}

        <List dense>
          {changedXml.map((f) => (
            <ListItem key={f.filename} button onClick={() => openDetail(f)}>
              <ListItemText
                primary={f.filename}
                secondary={`status: ${f.status}, changes: ${f.changes}`}
              />
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
        <Button onClick={onClose}>Zavřít</Button>
      </DialogActions>
    </Dialog>
  );
}

function ZipComparePanel({ token, repo, branchRef, setSnack, busy, setBusy }) {
  const [zipFile, setZipFile] = useState(null);
  const [zipEntries, setZipEntries] = useState([]);
  const [comparison, setComparison] = useState([]); // [{path, status: 'added|removed|modified|same', diffs, repoText, zipText}]
  const fileInputRef = useRef(null);

  const canRun = token && repo && branchRef && zipEntries.length > 0;

  const onPickZip = async (file) => {
    setZipFile(file);
    setZipEntries([]);
    setComparison([]);
    if (!file) return;
    try {
      setBusy(true);
      const entries = await fileListFromZip(file);
      setZipEntries(entries);
      setSnack({ open: true, message: `Načteno ${entries.length} XML souborů ze ZIPu.` });
    } catch (e) {
      setSnack({ open: true, message: `ZIP chyba: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

  const runCompare = async () => {
    if (!canRun) return;
    setBusy(true);
    try {
      // Build path→text from ZIP
      const zipMap = new Map(zipEntries.map((e) => [normalizePath(e.path), e.text]));
      // List candidate paths = union of zip paths and repo XML paths (heuristic: use zip paths)
      const results = [];
      for (const [rawPath, zipText] of zipMap.entries()) {
        const path = rawPath; // keep as-is
        let repoText = "";
        let status = "added";
        try {
          repoText = await githubApi.getFileText(token, repo.full_name, path, branchRef);
          status = zipText === repoText ? "same" : "modified";
        } catch (_) {
          // file likely doesn't exist in repo → added
          status = "added";
        }
        const diffs = status === "modified" ? diffText(repoText, zipText) : [];
        results.push({ path, status, diffs, repoText, zipText });
      }
      // Optionally, detect removed files (present in repo but not in ZIP)
      // Skipped for MVP to keep API calls bounded.
      setComparison(results);
      if (results.length === 0) setSnack({ open: true, message: "Žádné XML v ZIPu." });
    } catch (e) {
      setSnack({ open: true, message: `Porovnání selhalo: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

  const exportSelected = () => {
    const files = comparison
      .filter((c) => c.status === "modified" || c.status === "added")
      .map((c) => ({ path: c.path, text: c.zipText }));
    if (files.length === 0) {
      setSnack({ open: true, message: "Není co exportovat." });
      return;
    }
    downloadAsZip(files, `export_${repo.name}_${branchRef}.zip`);
  };

  return (
    <Card sx={{ mt: 3 }}>
      <CardContent>
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
          <Button variant="outlined" startIcon={<UploadIcon />} onClick={() => fileInputRef.current?.click()}>
            Nahrát ZIP
          </Button>
          <Button variant="contained" startIcon={<CompareIcon />} disabled={!canRun} onClick={runCompare}>
            Porovnat se {branchRef}
          </Button>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportSelected}>
            Export vybraných změn (ZIP)
          </Button>
        </Box>

        <List dense>
          {comparison.map((c) => (
            <ListItem key={c.path}>
              <ListItemText
                primary={c.path}
                secondary={
                  c.status === "same"
                    ? "beze změny"
                    : c.status === "modified"
                    ? "změněno"
                    : "nový soubor"
                }
              />
            </ListItem>
          ))}
        </List>
      </CardContent>
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
          <AuthPanel
            onAuthenticated={(a) => setAuth(a)}
            setSnack={setSnack}
          />
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
