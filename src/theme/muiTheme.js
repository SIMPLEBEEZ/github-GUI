// src/theme/muiTheme.js
import { createTheme } from "@mui/material/styles";

export const muiTheme = (darkMode = false) =>
  createTheme({
    palette: {
      mode: darkMode ? "dark" : "light",
      primary: {
        main: "#1f6feb", // GitHub blue
        contrastText: "#ffffff",
      },
      background: {
        default: darkMode ? "#0d1117" : "#f6f8fa",
        paper: darkMode ? "#161b22" : "#ffffff",
      },
      text: {
        primary: darkMode ? "#c9d1d9" : "#24292f",
        secondary: darkMode ? "#8b949e" : "#57606a",
      },
      divider: darkMode ? "#30363d" : "#d0d7de",
      action: {
        hover: darkMode ? "rgba(56,139,253,0.08)" : "rgba(9,105,218,0.06)",
        selected: darkMode ? "rgba(56,139,253,0.16)" : "rgba(9,105,218,0.08)",
      },
    },

    shape: { borderRadius: 6 },

    components: {
      /* 🌈 GLOBAL TRANSITIONS -------------------------------------------- */
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            transition:
              "background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease",
          },
          "*": {
            transition:
              "background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease",
          },
          // Optional: smooth icon/image adjustment
          img: {
            filter: darkMode ? "brightness(0.9)" : "brightness(1)",
            transition: "filter 0.3s ease",
          },
          svg: {
            filter: darkMode ? "brightness(0.85)" : "brightness(1)",
            transition: "filter 0.3s ease",
          },
        },
      },

      /* 🔹 BUTTONS --------------------------------------------------- */
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: "none",
            borderRadius: 6,
            fontWeight: 500,
            transition:
              "background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease",
            "&:hover": {
              backgroundColor: darkMode
                ? "rgba(56,139,253,0.16)"
                : "rgba(9,105,218,0.08)",
            },
          },
        },
      },

      /* 🔹 TABS ------------------------------------------------------ */
      MuiTabs: {
        styleOverrides: {
          root: {
            minHeight: 44,
            borderBottom: `1px solid ${darkMode ? "#30363d" : "#d0d7de"}`,
            backgroundColor: darkMode ? "#0d1117" : "#ffffff",
            transition: "background-color 0.3s ease, border-color 0.3s ease",
          },
          indicator: {
            height: 3,
            backgroundColor: "#0969da",
          },
        },
      },

      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: "none",
            fontWeight: 500,
            fontSize: 14,
            color: darkMode ? "#8b949e" : "#57606a",
            minHeight: 44,
            marginRight: 16,
            transition: "color 0.3s ease, background-color 0.3s ease",
            "&.Mui-selected": {
              color: darkMode ? "#f0f6fc" : "#24292f",
            },
            "&:hover": {
              color: darkMode ? "#f0f6fc" : "#24292f",
              backgroundColor: darkMode
                ? "rgba(56,139,253,0.12)"
                : "rgba(9,105,218,0.06)",
              borderRadius: 6,
            },
          },
        },
      },

      /* 🔹 DRAWER (SIDEBAR) ---------------------------------------- */
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: darkMode ? "#0d1117" : "#f6f8fa",
            borderRight: `1px solid ${darkMode ? "#30363d" : "#d0d7de"}`,
            transition: "background-color 0.3s ease, border-color 0.3s ease",
          },
        },
      },

      /* 🔹 SIDEBAR LISTS -------------------------------------------- */
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            marginBottom: 2,
            transition:
              "background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease",
            "&:hover": {
              backgroundColor: darkMode
                ? "rgba(56,139,253,0.1)"
                : "rgba(9,105,218,0.06)",
            },
            "&.Mui-selected": {
              backgroundColor: darkMode
                ? "rgba(56,139,253,0.16)"
                : "rgba(9,105,218,0.12)",
              color: darkMode ? "#f0f6fc" : "#24292f",
              "&:hover": {
                backgroundColor: darkMode
                  ? "rgba(56,139,253,0.2)"
                  : "rgba(9,105,218,0.16)",
              },
            },
          },
        },
      },

      MuiListItemText: {
        styleOverrides: {
          primary: {
            color: darkMode ? "#c9d1d9" : "#24292f",
            fontSize: 14,
            transition: "color 0.3s ease",
          },
        },
      },

      /* 🔹 APP BAR --------------------------------------------------- */
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: darkMode ? "#161b22" : "#24292f",
            transition: "background-color 0.3s ease, border-color 0.3s ease",
          },
        },
      },
    },
  });
