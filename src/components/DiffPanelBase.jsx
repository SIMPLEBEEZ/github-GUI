import React, { useMemo, useState } from "react";
import { Box, Button, Card, CardContent, Typography } from "@mui/material";
import { Virtuoso } from "react-virtuoso";
import CompareIcon from "@mui/icons-material/Compare";
import DownloadIcon from "@mui/icons-material/Download";
import { FileRow } from "./FileRow";
import { DiffDialog } from "./DiffDialog";

export default function DiffPanelBase({
  title,
  compareLabel,
  canRun,
  visibleFiles,
  selected,
  setSelected,
  onCompare,
  onExport,
  onOpenDetail,
  detail,
  setDetail,
}) {
  const hasFiles = visibleFiles.length > 0;

  const selectAll = () => setSelected(visibleFiles.map((c) => c.path));
  const deselectAll = () => setSelected([]);

  return (
    <Card sx={{ mt: 3, display: "flex", flexDirection: "column", height: "100%" }}>
      <CardContent
        sx={{
          flex: "1 1 auto",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {title}
          </Typography>
          <Button
            variant="contained"
            startIcon={<CompareIcon />}
            disabled={!canRun}
            onClick={onCompare}
          >
            {compareLabel}
          </Button>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={onExport}>
            Export selected (ZIP)
          </Button>
        </Box>

        {/* Selection toolbar */}
        {hasFiles && (
          <Box sx={{ display: "flex", gap: 2, mb: 1, mt: 2, alignItems: "center" }}>
            <Button size="small" variant="outlined" onClick={selectAll}>
              Select all
            </Button>
            <Button size="small" variant="outlined" onClick={deselectAll}>
              Deselect all
            </Button>
            <Typography variant="body2" sx={{ ml: "auto" }}>
              New: {visibleFiles.filter((c) => c.status === "added").length} | Modified:{" "}
              {visibleFiles.filter((c) => c.status === "modified").length} | Selected:{" "}
              {selected.length}
            </Typography>
          </Box>
        )}

        {/* Virtualized list */}
        {hasFiles && (
          <Box
            sx={{
              flex: "1 1 auto",
              minHeight: 0,
              height: "calc(100vh - 400px)",
              border: "1px solid rgba(0,0,0,0.1)",
              borderRadius: 1,
            }}
          >
            <Virtuoso
              totalCount={visibleFiles.length}
              itemContent={(index) => {
                const c = visibleFiles[index];
                return (
                  <FileRow
                    file={c}
                    selected={selected}
                    toggleSelected={(path) =>
                      setSelected((prev) =>
                        prev.includes(path)
                          ? prev.filter((p) => p !== path)
                          : [...prev, path]
                      )
                    }
                    openDetail={onOpenDetail}
                  />
                );
              }}
            />
          </Box>
        )}
      </CardContent>

      <DiffDialog detail={detail} onClose={() => setDetail(null)} />
    </Card>
  );
}
