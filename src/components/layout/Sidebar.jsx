import React from "react";
import { Drawer, Box, Typography, Divider, Button, TextField, FormControl, InputLabel, Select, MenuItem, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";

export default function Sidebar({
  auth,
  repo,
  branchA,
  setBranchA,
  branchB,
  setBranchB,
  busy,
  setBusy,
  sidebarOpen,
  branches,
  setBranches,
  onCreateBranch,
  newBranchName,
  setNewBranchName,
  fromBranch,
  setFromBranch,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // ✅ Sidebar UI (only branch selection and creation)
  const sidebarContent = (
    <Box width={260} p={2}>
      {!repo ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 1, fontStyle: "italic" }}
        >
          No repository selected.
        </Typography>
      ) : (
        <>
          {/* 🔹 Branch selection */}
          <Typography
            variant="subtitle1"
            sx={{ mb: 1, fontWeight: 600, color: "text.primary" }}
          >
            Branches ({repo.name})
          </Typography>

          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Branch A (base)</InputLabel>
            <Select
              value={branchA}
              label="Branch A (base)"
              onChange={(e) => setBranchA(e.target.value)}
              disabled={!branches?.length}
            >
              {branches?.map((b) => (
                <MenuItem key={b.name} value={b.name}>
                  {b.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Branch B (head)</InputLabel>
            <Select
              value={branchB}
              label="Branch B (head)"
              onChange={(e) => setBranchB(e.target.value)}
              disabled={!branches?.length}
            >
              {branches?.map((b) => (
                <MenuItem key={b.name} value={b.name}>
                  {b.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Divider sx={{ my: 2 }} />

          {/* 🔹 Create new branch */}
          <Typography
            variant="subtitle1"
            sx={{ mb: 1, fontWeight: 600, color: "text.primary" }}
          >
            Create new branch
          </Typography>

          <TextField
            size="small"
            label="New branch name"
            fullWidth
            sx={{ mb: 2 }}
            value={newBranchName}
            onChange={(e) => setNewBranchName(e.target.value)}
          />

          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>From branch</InputLabel>
            <Select
              value={fromBranch}
              label="From branch"
              onChange={(e) => setFromBranch(e.target.value)}
              disabled={!branches?.length}
            >
              {branches?.map((b) => (
                <MenuItem key={b.name} value={b.name}>
                  {b.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            fullWidth
            onClick={onCreateBranch}
            disabled={!newBranchName || !fromBranch || busy}
          >
            Create
          </Button>
        </>
      )}
    </Box>
  );

  // ✅ Drawer layout for mobile / desktop
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
        backgroundColor: theme.palette.background.default,
        transition: "background-color 0.3s ease, border-color 0.3s ease",
      }}
    >
      {sidebarContent}
    </Box>
  );
}
