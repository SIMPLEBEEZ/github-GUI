import React, { useEffect, useState } from "react";
import { Box, FormControl, InputLabel, Select, MenuItem } from "@mui/material";
import { githubApi } from "../../api/githubApi";

export default function BranchSelectorBar({
  token,
  repo,
  branchSource,
  setBranchSource,
  branchTarget,
  setBranchTarget,
}) {
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    if (!token || !repo) return;
    githubApi
      .listBranches(token, repo.full_name)
      .then((data) => setBranches(data.map((b) => b.name)))
      .catch((err) => console.error("Branch list failed", err));
  }, [token, repo]);

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        mb: 2,
        backgroundColor: (theme) =>
          theme.palette.mode === "dark" ? "#161b22" : "#f6f8fa",
        borderRadius: 2,
        p: 2,
        border: (theme) =>
          `1px solid ${
            theme.palette.mode === "dark" ? "#30363d" : "#d0d7de"
          }`,
      }}
    >
      <FormControl size="small" sx={{ minWidth: 180 }}>
        <InputLabel>Source branch</InputLabel>
        <Select
          value={branchSource || ""}
          label="Source branch"
          onChange={(e) => setBranchSource(e.target.value)}
        >
          {branches.map((b) => (
            <MenuItem key={b} value={b}>
              {b}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box sx={{ fontWeight: 600 }}>→</Box>

      <FormControl size="small" sx={{ minWidth: 180 }}>
        <InputLabel>Target branch</InputLabel>
        <Select
          value={branchTarget || ""}
          label="Target branch"
          onChange={(e) => setBranchTarget(e.target.value)}
        >
          {branches.map((b) => (
            <MenuItem key={b} value={b}>
              {b}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
}
