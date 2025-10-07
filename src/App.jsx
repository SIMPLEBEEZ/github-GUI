import React, { useEffect, useState } from "react";
import { Box, CssBaseline, ThemeProvider } from "@mui/material";
import { Toaster } from "react-hot-toast";
import { useGitHubOAuth } from "./hooks/useGitHubOAuth";
import { muiTheme } from "./theme/muiTheme";
import TopBar from "./components/layout/TopBar";
import TabsBar from "./components/layout/TabsBar";
import Sidebar from "./components/layout/Sidebar";
import StatusBar from "./components/layout/StatusBar";
import BranchDiffPanel from "./components/panels/BranchDiffPanel";
import ZipDiffPanel from "./components/panels/ZipDiffPanel";
import AuthPanel from "./components/auth/AuthPanel";

export default function App() {
  const { auth, logout } = useGitHubOAuth();
  const [busy, setBusy] = useState(false);
  const [repo, setRepo] = useState(null);
  const [branchA, setBranchA] = useState("");
  const [branchB, setBranchB] = useState("");
  const [tab, setTab] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // 🌙 Persistent dark mode (stored in localStorage)
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem("themeMode");
    if (stored === "dark") return true;
    if (stored === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  // 💾 Save theme preference
  useEffect(() => {
    localStorage.setItem("themeMode", darkMode ? "dark" : "light");
  }, [darkMode]);

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
            darkMode={darkMode}
            setDarkMode={setDarkMode}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            busy={busy}
            onLogout={logout}
          />

          {/* 🔹 TABS */}
          <TabsBar tab={tab} setTab={setTab} darkMode={darkMode} />

          {/* 🔹 MAIN LAYOUT */}
          <Box display="flex" flexGrow={1}>
            <Sidebar
              auth={auth}
              repo={repo}
              setRepo={setRepo}
              branchA={branchA}
              setBranchA={setBranchA}
              branchB={branchB}
              setBranchB={setBranchB}
              busy={busy}
              setBusy={setBusy}
              sidebarOpen={sidebarOpen}
            />

            <Box flexGrow={1} p={2} overflow="auto">
              {tab === 0 && (
                <BranchDiffPanel
                  token={auth?.token}
                  repo={repo}
                  branchA={branchA}
                  branchB={branchB}
                  setBusy={setBusy}
                />
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
      <Toaster position="top-right" />
    </ThemeProvider>
  );
}
