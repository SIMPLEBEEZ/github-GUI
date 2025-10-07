import React, { useEffect, useState } from "react";
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  useMediaQuery,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import LogoutIcon from "@mui/icons-material/Logout";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import FolderIcon from "@mui/icons-material/Folder";
import { useTheme } from "@mui/material/styles";
import { githubApi } from "../../api/githubApi";

export default function TopBar({
  auth,
  darkMode,
  setDarkMode,
  onToggleSidebar,
  busy,
  onLogout,
  repo,
  setRepo,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [repos, setRepos] = useState([]);

  // 🧩 Load repositories on login
  useEffect(() => {
    if (!auth?.token) return;
    githubApi
      .listRepos(auth.token, "private")
      .then(setRepos)
      .catch((e) => console.error(e));
  }, [auth]);

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        zIndex: (t) => t.zIndex.drawer + 1,
        backgroundColor: theme.palette.background.paper,
        borderBottom: `1px solid ${
          theme.palette.mode === "dark" ? "#30363d" : "#d0d7de"
        }`,
        transition: "background-color 0.3s ease, border-color 0.3s ease",
      }}
    >
      <Toolbar
        sx={{
          display: "flex",
          justifyContent: "space-between",
          minHeight: 64,
        }}
      >
        {/* 🔹 LEFT SIDE */}
        <Box display="flex" alignItems="center" gap={1}>
          {isMobile && (
            <IconButton
              color="inherit"
              onClick={onToggleSidebar}
              edge="start"
              sx={{ mr: 1 }}
            >
              <MenuIcon />
            </IconButton>
          )}

          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              color:
                theme.palette.mode === "dark" ? "#c9d1d9" : "#24292f",
              mr: 2,
            }}
          >
            GitHub GUI – MVP
          </Typography>

          {/* 🔸 Repository Picker */}
          {auth && (
            <FormControl
              size="small"
              sx={{
                minWidth: 240,
                backgroundColor:
                  theme.palette.mode === "dark" ? "#161b22" : "#ffffff",
                borderRadius: 1,
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor:
                    theme.palette.mode === "dark" ? "#30363d" : "#d0d7de",
                },
                "&:hover .MuiOutlinedInput-notchedOutline": {
                  borderColor:
                    theme.palette.mode === "dark" ? "#58a6ff" : "#0969da",
                },
              }}
            >
              <Select
                value={repo?.full_name || ""}
                displayEmpty
                onChange={(e) => {
                  const found = repos.find(
                    (r) => r.full_name === e.target.value
                  );
                  setRepo(found || null);
                }}
                renderValue={(selected) =>
                  selected ? (
                    <Box display="flex" alignItems="center" gap={1}>
                      <FolderIcon fontSize="small" />
                      <Typography variant="body2">
                        {selected}
                      </Typography>
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Select repository...
                    </Typography>
                  )
                }
              >
                {repos.map((r) => (
                  <MenuItem key={r.id} value={r.full_name}>
                    {r.full_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>

        {/* 🔹 RIGHT SIDE */}
        <Box display="flex" alignItems="center" gap={1}>
          <Tooltip
            title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            <IconButton
              onClick={() => setDarkMode(!darkMode)}
              sx={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                backgroundColor: darkMode ? "#1f6feb22" : "#00000011",
                border: `1px solid ${
                  darkMode ? "#30363d" : "#d0d7de"
                }`,
                "&:hover": {
                  backgroundColor: darkMode
                    ? "#1f6feb33"
                    : "rgba(9,105,218,0.08)",
                },
                transition:
                  "background-color 0.3s ease, border-color 0.3s ease",
              }}
            >
              {darkMode ? (
                <Brightness7Icon sx={{ color: "#f6f8fa" }} />
              ) : (
                <Brightness4Icon sx={{ color: "#24292f" }} />
              )}
            </IconButton>
          </Tooltip>

          <Tooltip title="Log out">
            <IconButton
              color="error"
              onClick={onLogout}
              sx={{
                border: "1px solid",
                borderColor: "error.main",
                borderRadius: "8px",
                px: 1.5,
                py: 0.5,
              }}
            >
              <LogoutIcon fontSize="small" sx={{ mr: 0.5 }} />
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                Logout
              </Typography>
            </IconButton>
          </Tooltip>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
