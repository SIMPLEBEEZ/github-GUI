import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  Divider,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  CircularProgress,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { githubApi } from "../api/githubApi";

export default function RepoBranchPicker({
  token,
  repo,
  setRepo,
  branchA,
  setBranchA,
  branchB,
  setBranchB,
  busy,
  setBusy,
  setSnack,
}) {
  const [repos, setRepos] = useState([]);
  const [branches, setBranches] = useState([]);
  const [newBranchName, setNewBranchName] = useState("");
  const [fromBranch, setFromBranch] = useState("");

  // 🧭 Load repositories
  useEffect(() => {
    (async () => {
      setBusy(true);
      try {
        const data = await githubApi.listRepos(token, "private");
        setRepos(data);
      } catch (e) {
        setSnack?.({ open: true, message: `Failed to load repositories: ${e.message}` });
      } finally {
        setBusy(false);
      }
    })();
  }, [token]);

  // 🧭 Load branches when repo changes
  useEffect(() => {
    if (!repo) {
      setBranches([]);
      return;
    }
    (async () => {
      setBusy(true);
      try {
        const data = await githubApi.listBranches(token, repo.full_name);
        setBranches(data);
      } catch (e) {
        setSnack?.({ open: true, message: `Failed to load branches: ${e.message}` });
      } finally {
        setBusy(false);
      }
    })();
  }, [token, repo]);

  // 🧭 Create new branch
  const handleCreateBranch = async () => {
    if (!repo || !newBranchName || !fromBranch) return;
    setBusy(true);
    try {
      await githubApi.createBranchFrom(token, repo.full_name, newBranchName, fromBranch);
      const updated = await githubApi.listBranches(token, repo.full_name);
      setBranches(updated);
      setNewBranchName("");
      setSnack?.({ open: true, message: `Branch '${newBranchName}' created successfully.` });
    } catch (e) {
      setSnack?.({ open: true, message: `Branch creation failed: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Repositories
      </Typography>

      {busy && <CircularProgress size={18} sx={{ mb: 2 }} />}

      {/* Repository list */}
      <List dense disablePadding>
        {repos.map((r) => {
          const isActive = repo?.full_name === r.full_name;
          return (
            <ListItemButton
              key={r.id}
              selected={isActive}
              onClick={() => setRepo(r)}
            >
              <ListItemText primary={r.name} secondary={r.owner?.login} />
            </ListItemButton>
          );
        })}
      </List>

      {repo && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle1" gutterBottom>
            Branches ({repo.name})
          </Typography>

          <List dense disablePadding>
            {branches.map((b) => {
              const isSelectedA = branchA === b.name;
              const isSelectedB = branchB === b.name;
              return (
                <ListItemButton
                  key={b.name}
                  selected={isSelectedA || isSelectedB}
                  onClick={() => {
                    if (!branchA || branchA === b.name) setBranchA(b.name);
                    else setBranchB(b.name);
                  }}
                >
                  <ListItemText
                    primary={b.name}
                    secondary={
                      isSelectedA ? "Base (A)" : isSelectedB ? "Compare (B)" : undefined
                    }
                  />
                </ListItemButton>
              );
            })}
          </List>

          {/* New branch creation */}
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle1" gutterBottom>
            Create new branch
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr", gap: 2 }}>
            <TextField
              label="New branch name"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              size="small"
            />
            <FormControl size="small">
              <InputLabel id="from-branch">From branch</InputLabel>
              <Select
                labelId="from-branch"
                label="From branch"
                value={fromBranch}
                onChange={(e) => setFromBranch(e.target.value)}
              >
                {branches.map((b) => (
                  <MenuItem key={b.name} value={b.name}>
                    {b.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleCreateBranch}
            >
              Create
            </Button>
          </Box>
        </>
      )}
    </Box>
  );
}
