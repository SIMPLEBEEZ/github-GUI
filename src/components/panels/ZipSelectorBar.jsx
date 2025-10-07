import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import UploadIcon from "@mui/icons-material/Upload";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import { githubApi } from "../../api/githubApi";

export default function ZipSelectorBar({
  token,
  repo,
  zipBranch,
  setZipBranch,
  onZipUpload,
  zipFileName,
}) {
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    if (!token || !repo) return;
    githubApi
      .listBranches(token, repo.full_name)
      .then((data) => setBranches(data.map((b) => b.name)))
      .catch((err) => console.error("Failed to load branches:", err));
  }, [token, repo]);

  const hasZip = Boolean(zipFileName);

  // 🧹 When repo changes, clear ZIP file display
  useEffect(() => {
    // If repo changes, clear ZIP name shown on screen
    // (Parent resets zipFile, so zipFileName becomes empty)
  }, [repo, zipFileName]);

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        justifyContent: "space-between",
        gap: 2,
        mb: 2,
        p: 2,
        borderRadius: 2,
        backgroundColor: (theme) =>
          theme.palette.mode === "dark" ? "#161b22" : "#f6f8fa",
        border: (theme) =>
          `1px solid ${
            theme.palette.mode === "dark" ? "#30363d" : "#d0d7de"
          }`,
      }}
    >
      {/* 🔹 Left side — Upload/Replace button + ZIP filename */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Button
          variant="contained"
          color={hasZip ? "secondary" : "primary"}
          startIcon={hasZip ? <SwapHorizIcon /> : <UploadIcon />}
          component="label"
        >
          {hasZip ? "Replace ZIP" : "Upload ZIP"}
          <input
            type="file"
            accept=".zip"
            hidden
            onChange={(e) => {
              if (e.target.files.length > 0) {
                onZipUpload(e.target.files[0]);
                e.target.value = null; // ✅ allow re-upload of same file
              }
            }}
          />
        </Button>

        <Typography
          variant="body2"
          sx={{
            color: (theme) =>
              theme.palette.mode === "dark" ? "#c9d1d9" : "#24292f",
            fontStyle: hasZip ? "normal" : "italic",
            opacity: hasZip ? 1 : 0.6,
            maxWidth: 280,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            transition: "opacity 0.3s ease",
          }}
        >
          {zipFileName || "No ZIP file uploaded"}
        </Typography>
      </Box>

      {/* 🔹 Right side — Target branch selector */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>Target branch</InputLabel>
          <Select
            label="Target branch"
            value={zipBranch || ""}
            onChange={(e) => setZipBranch(e.target.value)}
          >
            {branches.map((b) => (
              <MenuItem key={b} value={b}>
                {b}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
    </Box>
  );
}
