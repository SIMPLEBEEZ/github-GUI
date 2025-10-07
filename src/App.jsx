import React, { useEffect, useState } from "react";
import { Box, CssBaseline, ThemeProvider } from "@mui/material";
import { Toaster } from "react-hot-toast";
import { useGitHubOAuth } from "./hooks/useGitHubOAuth";
import { muiTheme } from "./theme/muiTheme";
import { githubApi } from "./api/githubApi";
import TopBar from "./components/layout/TopBar";
import TabsBar from "./components/layout/TabsBar";
import Sidebar from "./components/layout/Sidebar";
import StatusBar from "./components/layout/StatusBar";
import BranchDiffPanel from "./components/panels/BranchDiffPanel";
import ZipDiffPanel from "./components/panels/ZipDiffPanel";
import AuthPanel from "./components/auth/AuthPanel";
import BranchSelectorBar from "./components/panels/BranchSelectorBar";

export default function App() {
  const { auth, logout } = useGitHubOAuth();
  const [busy, setBusy] = useState(false);
  const [repo, setRepo] = useState(null);
  const [branchA, setBranchA] = useState("");
  const [branchB, setBranchB] = useState("");
  const [tab, setTab] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // 🌙 Persistent dark mode
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem("themeMode");
    if (stored === "dark") return true;
    if (stored === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    localStorage.setItem("themeMode", darkMode ? "dark" : "light");
  }, [darkMode]);

  // 🧩 NEW: Branch-related state
  const [branches, setBranches] = useState([]);
  const [newBranchName, setNewBranchName] = useState("");
  const [fromBranch, setFromBranch] = useState("");

  // 🧩 NEW: Load branches when repo changes
  useEffect(() => {
    if (!repo || !auth?.token) return;
    githubApi
      .listBranches(auth.token, repo.full_name)
      .then(setBranches)
      .catch((err) => console.error("Error loading branches:", err));
  }, [repo, auth]);

  // 🧩 NEW: Create new branch
  async function handleCreateBranch() {
    if (!repo || !auth?.token || !newBranchName || !fromBranch) {
      toast.error("Please fill in all branch details.");
      return;
    }

    setBusy(true);
    const loadingToast = toast.loading("Creating new branch...");
    try {
      await githubApi.createBranch(
        auth.token,
        repo.full_name,
        newBranchName,
        fromBranch
      );

      const updated = await githubApi.listBranches(auth.token, repo.full_name);
      setBranches(updated);
      setNewBranchName("");

      toast.success(`Branch "${newBranchName}" created successfully!`);
    } catch (err) {
      console.error("Error creating branch:", err);
      toast.error(`Failed to create branch: ${err.message}`);
    } finally {
      setBusy(false);
      toast.dismiss(loadingToast);
    }
  }

  return (
    <ThemeProvider theme={muiTheme(darkMode)}>
      <CssBaseline />

      {!auth ? (
        // 🔹 Fullscreen centered login screen
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh",
            width: "100vw",
            transition: "background-color 0.3s ease, color 0.3s ease",
            backgroundColor: (theme) =>
              theme.palette.mode === "dark" ? "#0d1117" : "#f6f8fa",
          }}
        >
          <AuthPanel />
        </Box>
      ) : (
        // 🔹 Main layout after login
        <Box
          display="flex"
          flexDirection="column"
          height="100vh"
          sx={{
            transition: "background-color 0.3s ease, color 0.3s ease",
          }}
        >
          {/* 🔹 TOP BAR */}
          <TopBar
            auth={auth}
            darkMode={darkMode}
            setDarkMode={setDarkMode}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            busy={busy}
            onLogout={logout}
            repo={repo}
            setRepo={setRepo}
          />

          {/* 🔹 TABS */}
          <TabsBar tab={tab} setTab={setTab} darkMode={darkMode} />

          {/* 🔹 MAIN LAYOUT */}
          <Box display="flex" flexGrow={1}>
            <Sidebar
              tab={tab}
              setTab={setTab}
              onNewBranch={() => handleCreateBranch()}
              sidebarOpen={sidebarOpen}
            />

            <Box flexGrow={1} p={2} overflow="auto">
              {tab === 0 && (
                <>
                  <BranchSelectorBar
                    token={auth?.token}
                    repo={repo}
                    branchA={branchA}
                    setBranchA={setBranchA}
                    branchB={branchB}
                    setBranchB={setBranchB}
                  />
                  <BranchDiffPanel
                    token={auth?.token}
                    repo={repo}
                    branchA={branchA}
                    branchB={branchB}
                    setBusy={setBusy}
                  />
                </>
              )}
              {tab === 1 && (
                <ZipDiffPanel
                  token={auth?.token}
                  repo={repo}
                  branchRef={branchA || branchB}
                  setBusy={setBusy}
                />
              )}
            </Box>
          </Box>

          {/* 🔹 STATUS BAR */}
          <StatusBar
            repo={repo}
            branchA={branchA}
            branchB={branchB}
            busy={busy}
          />
        </Box>
      )}

      {/* 🔹 TOAST NOTIFICATIONS */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: darkMode ? "#161b22" : "#ffffff",
            color: darkMode ? "#f0f6fc" : "#24292f",
            border: `1px solid ${darkMode ? "#30363d" : "#d0d7de"}`,
            boxShadow: darkMode
              ? "0 4px 12px rgba(255,255,255,0.05)"
              : "0 4px 12px rgba(0,0,0,0.08)",
            borderRadius: "6px",
            fontFamily: "system-ui, sans-serif",
          },
          success: {
            iconTheme: {
              primary: "#3fb950", // GitHub green
              secondary: darkMode ? "#161b22" : "#ffffff",
            },
          },
          error: {
            iconTheme: {
              primary: "#f85149", // GitHub red
              secondary: darkMode ? "#161b22" : "#ffffff",
            },
          },
          loading: {
            iconTheme: {
              primary: "#58a6ff", // GitHub blue
              secondary: darkMode ? "#161b22" : "#ffffff",
            },
          },
        }}
      />
    </ThemeProvider>
  );
}
