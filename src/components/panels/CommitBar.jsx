import React, { useState } from "react";
import { Box, TextField, Button, Typography, CircularProgress } from "@mui/material";
import { githubApi } from "../../api/githubApi";

export default function CommitBar({ token, repo, branch, selectedFiles, onCommitted }) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const handleCommit = async () => {
    if (!message.trim()) {
      setStatus("⚠️ Please enter a commit message");
      return;
    }
    if (!selectedFiles?.length) {
      setStatus("⚠️ No files selected");
      return;
    }

    try {
      setLoading(true);
      setStatus("Committing...");
      const res = await githubApi.commitChanges(
        token,
        repo.full_name,
        branch,
        selectedFiles,
        message
      );
      setStatus("✅ Commit successful");
      setMessage("");
      if (onCommitted) onCommitted(res);
    } catch (err) {
      console.error("Commit failed:", err);
      setStatus("❌ Commit failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: "flex", gap: 2, alignItems: "center", mt: 2 }}>
      <TextField
        label="Commit message"
        variant="outlined"
        size="small"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        sx={{ flex: 1 }}
      />
      <Button
        variant="contained"
        onClick={handleCommit}
        disabled={loading}
      >
        {loading ? <CircularProgress size={20} /> : "Commit"}
      </Button>
      <Typography variant="body2" color="text.secondary">
        {status}
      </Typography>
    </Box>
  );
}
