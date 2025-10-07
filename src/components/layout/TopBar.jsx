import React from "react";
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Tooltip,
  useMediaQuery,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import LogoutIcon from "@mui/icons-material/Logout";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import { useTheme } from "@mui/material/styles";

export default function TopBar({
  darkMode,
  setDarkMode,
  onToggleSidebar,
  busy,
  onLogout,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

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
            }}
          >
            GitHub GUI – MVP
          </Typography>
        </Box>

        {/* 🔹 RIGHT SIDE */}
        <Box display="flex" alignItems="center" gap={1}>
          {/* 🌙 / ☀️ Theme Toggle */}
          <Tooltip title={darkMode ? "Switch to light mode" : "Switch to dark mode"}>
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

          {/* 🔹 Logout */}
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
