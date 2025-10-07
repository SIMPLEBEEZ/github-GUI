import React from "react";
import { Box, Divider } from "@mui/material";

export default function StatusBar({ repo, branchA, branchB, busy }) {
  return (
    <>
      <Divider />
      <Box
        height={36}
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        px={2}
        bgcolor="#ffffff"
        color="#57606a"
        fontSize="0.875rem"
      >
        <span>
          {repo
            ? `🔄 ${repo.name}: ${branchA || "?"} → ${branchB || "?"}`
            : "No repository selected"}
        </span>
        <span>{busy ? "Processing…" : "Ready"}</span>
      </Box>
    </>
  );
}
