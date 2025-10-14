import React, { useState } from "react";
import {
  Box,
  Checkbox,
  Typography,
  IconButton,
  Collapse,
  Chip,
} from "@mui/material";
import { ExpandMore, ChevronRight } from "@mui/icons-material";

const statusColors = {
  added: { color: "success.main", chip: "success", label: "A" },
  modified: { color: "warning.main", chip: "warning", label: "M" },
  deleted: { color: "error.main", chip: "error", label: "D" },
};

export function FileTreeView({
  tree,
  selected,
  setSelected,
  onOpenDetail,
  level = 0,
}) {
  const [openFolders, setOpenFolders] = useState({});

  if (!tree) return null;

  // Expand / collapse folder
  const toggleFolderOpen = (path) => {
    setOpenFolders((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  // Recursively collect all file paths inside a node
  const collectAllFilePaths = (node) => {
    let files = [];
    if (node.__file) files.push(node.__file.path);
    const children = node.__children || {};
    for (const child of Object.values(children)) {
      files = files.concat(collectAllFilePaths(child));
    }
    return files;
  };

  const renderNode = (node, prefix = "") =>
    Object.entries(node).map(([name, value]) => {
      if (name.startsWith("__")) return null;

      const isFile = !!value.__file;
      const path = prefix ? `${prefix}/${name}` : name;

      if (isFile) {
        const file = value.__file;
        const checked = selected.includes(file.path);
        const statusInfo = statusColors[file.status] || {};

        return (
          <Box
            key={path}
            sx={{
              pl: level * 2 + 4,
              display: "flex",
              alignItems: "center",
              cursor: "pointer",
              "&:hover": { backgroundColor: "action.hover" },
            }}
          >
            <Checkbox
              size="small"
              checked={checked}
              onChange={() =>
                setSelected((prev) =>
                  checked
                    ? prev.filter((p) => p !== file.path)
                    : [...prev, file.path]
                )
              }
            />
            <Typography
              variant="body2"
              sx={{
                flexGrow: 1,
                color: statusInfo.color || "text.primary",
                fontWeight: 500,
              }}
              onClick={() => onOpenDetail(file)}
            >
              {name}
            </Typography>
            {file.status && (
              <Chip
                label={statusInfo.label || file.status[0].toUpperCase()}
                color={statusInfo.chip}
                size="small"
                sx={{ fontWeight: 600 }}
              />
            )}
          </Box>
        );
      } else {
        // Folder node
        const allFilePaths = collectAllFilePaths(value);
        const hasFiles = allFilePaths.length > 0;
        const allSelected =
          hasFiles && allFilePaths.every((p) => selected.includes(p));
        const partiallySelected =
          hasFiles &&
          !allSelected &&
          allFilePaths.some((p) => selected.includes(p));
        const isOpen = openFolders[path] ?? false;

        return (
          <Box key={path} sx={{ pl: level * 1.5 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                cursor: "pointer",
                userSelect: "none",
                "&:hover": { backgroundColor: "action.hover" },
              }}
            >
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFolderOpen(path);
                }}
              >
                {isOpen ? (
                  <ExpandMore fontSize="small" />
                ) : (
                  <ChevronRight fontSize="small" />
                )}
              </IconButton>

              <Checkbox
                size="small"
                indeterminate={partiallySelected}
                checked={allSelected}
                disabled={!hasFiles}
                onChange={(e) => {
                  e.stopPropagation();
                  if (!hasFiles) return;
                  setSelected((prev) => {
                    const shouldDeselect = allFilePaths.every((p) =>
                      prev.includes(p)
                    );
                    return shouldDeselect
                      ? prev.filter((p) => !allFilePaths.includes(p))
                      : [...new Set([...prev, ...allFilePaths])];
                  });
                }}
              />

              <Typography
                variant="body2"
                sx={{ fontWeight: 600 }}
                onClick={() => toggleFolderOpen(path)}
              >
                {name}/
              </Typography>
            </Box>

            <Collapse in={isOpen} timeout="auto" unmountOnExit>
              <FileTreeView
                tree={value.__children}
                selected={selected}
                setSelected={setSelected}
                onOpenDetail={onOpenDetail}
                level={level + 1}
              />
            </Collapse>
          </Box>
        );
      }
    });

  return <>{renderNode(tree)}</>;
}
