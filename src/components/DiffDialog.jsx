import React, { useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box } from "@mui/material";

export function DiffDialog({ detail, onClose }) {
  const [showWs, setShowWs] = useState(false);
  if (!detail) return null;

  const visualizeWhitespace = (s) => {
    if (!showWs) return s;
    return (s ?? "")
      .replace(/ /g, "·")
      .replace(/\t/g, "⇥")
      .replace(/\n/g, "↵\n");
  };

  return (
    <Dialog open={!!detail} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Box sx={{ flex: 1 }}>
          Diff: {detail.path}
          {detail.branchSource && detail.branchTarget && (
            <Typography variant="body2" color="text.secondary">
              {detail.branchSource} → {detail.branchTarget}
            </Typography>
          )}
        </Box>
        <Button size="small" variant="outlined" onClick={() => setShowWs((v) => !v)}>
          {showWs ? "Hide whitespace" : "Show whitespace"}
        </Button>
      </DialogTitle>
      <DialogContent dividers>
        <pre style={{ whiteSpace: "pre-wrap", fontFamily: "monospace", margin: 0 }}>
          {detail.diffs.map(([op, raw], i) => {
            const text = visualizeWhitespace(raw);
            const style =
              op === 1
                ? { background: "#e8f5e9" } // inserted
                : op === -1
                ? { background: "#ffebee", textDecoration: "line-through" }
                : {};
            const withBorder = op !== 0 ? { ...style, outline: "1px solid rgba(0,0,0,0.05)" } : style;
            return (
              <span key={i} style={withBorder}>
                {text}
              </span>
            );
          })}
        </pre>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
