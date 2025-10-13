import React, { useMemo } from "react";
import { Box, Button, Card, CardContent, Typography } from "@mui/material";
import CompareIcon from "@mui/icons-material/Compare";
import DownloadIcon from "@mui/icons-material/Download";
import { DiffDialog } from "./DiffDialog";
import { buildFileTree } from "../utils/fileTreeUtils";
import { FileTreeView } from "./FileTreeView";

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
  const fileTree = useMemo(() => buildFileTree(visibleFiles), [visibleFiles]);

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

        {/* Tree structure */}
        {hasFiles && (
          <Box
            sx={{
              flex: "1 1 auto",
              minHeight: 0,
              height: "calc(100vh - 400px)",
              overflowY: "auto",
              border: "1px solid rgba(0,0,0,0.1)",
              borderRadius: 1,
              p: 1,
            }}
          >
            <FileTreeView
              tree={fileTree}
              selected={selected}
              setSelected={setSelected}
              onOpenDetail={onOpenDetail}
            />
          </Box>
        )}
      </CardContent>

      <DiffDialog detail={detail} onClose={() => setDetail(null)} />
    </Card>
  );
}
