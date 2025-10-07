import React from "react";
import {
  Drawer,
  Box,
  Button,
  Stack,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import ArchiveIcon from "@mui/icons-material/Archive";

export default function Sidebar({ tab, setTab, sidebarOpen }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const sidebarContent = (
    <Box p={2} width={260}>
      <Stack spacing={2}>
        <Button
          variant={tab === 0 ? "contained" : "outlined"}
          startIcon={<AddIcon />}
          fullWidth
          onClick={() => setTab(0)}
        >
          New Branch
        </Button>

        <Button
          variant={tab === 1 ? "contained" : "outlined"}
          startIcon={<ArchiveIcon />}
          fullWidth
          onClick={() => setTab(1)}
        >
          ZIP → Branch
        </Button>

        <Button
          variant={tab === 2 ? "contained" : "outlined"}
          startIcon={<CompareArrowsIcon />}
          fullWidth
          onClick={() => setTab(2)}
        >
          Branch → Branch
        </Button>
      </Stack>
    </Box>
  );

  return isMobile ? (
    <Drawer
      anchor="left"
      open={sidebarOpen}
      onClose={() => {}}
      ModalProps={{ keepMounted: true }}
      sx={{
        "& .MuiDrawer-paper": {
          width: 260,
          top: 64,
          height: "calc(100% - 64px)",
          backgroundColor: theme.palette.background.default,
        },
      }}
    >
      {sidebarContent}
    </Drawer>
  ) : (
    <Box
      sx={{
        width: 260,
        flexShrink: 0,
        borderRight: `1px solid ${
          theme.palette.mode === "dark" ? "#30363d" : "#d0d7de"
        }`,
        mt: "64px",
        backgroundColor: theme.palette.background.default,
        boxShadow:
          theme.palette.mode === "dark"
            ? "0 0 10px rgba(255,255,255,0.05)"
            : "0 0 8px rgba(0,0,0,0.08)",
      }}
    >
      {sidebarContent}
    </Box>
  );
}
