import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { githubApi } from "../../api/githubApi";

export default function NewBranchBar({ token, repo }) {
  const theme = useTheme();
  const [branches, setBranches] = useState([]);
  const [sourceBranch, setSourceBranch] = useState("");
  const [newBranchName, setNewBranchName] = useState("");
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");

  // 🔹 Load branches when repository changes
  useEffect(() => {
    if (!token || !repo) return;
    githubApi
      .listBranches(token, repo.full_name)
      .then((data) => setBranches(data.map((b) => b.name)))
      .catch((err) => console.error("Failed to load branches:", err));
  }, [token, repo]);

  // 🔹 Handle branch creation
  const handleCreate = async () => {
    if (!sourceBranch || !newBranchName) {
      setMessage("⚠️ Please select a source branch and enter a new branch name.");
      return;
    }

    setCreating(true);
    setMessage("");

    try {
      await githubApi.createBranch(token, repo.full_name, newBranchName, sourceBranch);
      setMessage(`✅ Branch '${newBranchName}' created from '${sourceBranch}'.`);
      setNewBranchName("");
    } catch (err) {
      console.error(err);
      setMessage("❌ Failed to create branch.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Box
      display="flex"
      alignItems="center"
      gap={2}
      sx={{
        p: 2,
        borderRadius: 2,
        border: `1px solid ${
          theme.palette.mode === "dark" ? "#30363d" : "#d0d7de"
        }`,
        backgroundColor:
          theme.palette.mode === "dark" ? "#161b22" : "#f6f8fa",
        boxShadow:
          theme.palette.mode === "dark"
            ? "0 1px 3px rgba(255,255,255,0.05)"
            : "0 1px 3px rgba(0,0,0,0.08)",
        transition:
          "background-color 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease",
        height: "64px",
        alignItems: "center",
      }}
    >
      {/* Source branch selector */}
      <FormControl size="small" sx={{ minWidth: 200 }}>
        <InputLabel>Source branch</InputLabel>
        <Select
          value={sourceBranch}
          label="Source branch"
          onChange={(e) => setSourceBranch(e.target.value)}
        >
          {branches.map((b) => (
            <MenuItem key={b} value={b}>
              {b}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* New branch input */}
      <TextField
        size="small"
        label="New branch name"
        value={newBranchName}
        onChange={(e) => setNewBranchName(e.target.value)}
        sx={{
          minWidth: 220,
          input: { color: theme.palette.text.primary },
        }}
      />

      {/* Create button */}
      <Button
        variant="contained"
        onClick={handleCreate}
        disabled={creating}
        sx={{
          px: 3,
          fontWeight: 600,
          textTransform: "none",
          boxShadow: "none",
          "&:hover": { boxShadow: "0 2px 4px rgba(0,0,0,0.2)" },
        }}
      >
        {creating ? "Creating..." : "Create"}
      </Button>

      {/* Feedback message */}
      {message && (
        <Typography
          variant="body2"
          sx={{
            color: theme.palette.text.secondary,
            whiteSpace: "nowrap",
          }}
        >
          {message}
        </Typography>
      )}
    </Box>
  );
}
