import React from "react";
import { Drawer, Box, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import RepoBranchPicker from "../RepoBranchPicker";

export default function Sidebar({
  auth,
  repo,
  setRepo,
  branchA,
  setBranchA,
  branchB,
  setBranchB,
  busy,
  setBusy,
  sidebarOpen,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const sidebarContent = (
    <Box width={260} p={2}>
      <RepoBranchPicker
        token={auth?.token}
        repo={repo}
        setRepo={setRepo}
        branchA={branchA}
        setBranchA={setBranchA}
        branchB={branchB}
        setBranchB={setBranchB}
        busy={busy}
        setBusy={setBusy}
      />
    </Box>
  );

  return isMobile ? (
    <Drawer
      anchor="left"
      open={sidebarOpen}
      onClose={() => setBusy(false)}
      ModalProps={{ keepMounted: true }}
      sx={{
        "& .MuiDrawer-paper": {
          width: 260,
          top: 64, // align under AppBar
          height: "calc(100% - 64px)",
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
        boxShadow: theme.palette.mode === "dark"
          ? "0 0 10px rgba(255,255,255,0.05)"
          : "0 0 8px rgba(0,0,0,0.08)",
      }}
    >
      {sidebarContent}
    </Box>
  );
}
