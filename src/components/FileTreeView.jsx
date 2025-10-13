import React, { useState } from "react";
import {
  Box,
  Checkbox,
  Typography,
  IconButton,
  Collapse,
} from "@mui/material";
import { ExpandMore, ChevronRight } from "@mui/icons-material";

export function FileTreeView({
  tree,
  selected,
  setSelected,
  onOpenDetail,
  level = 0,
}) {
  const [openFolders, setOpenFolders] = useState({});

  if (!tree) return null;

  // Expand / collapse a folder
  const toggleFolderOpen = (path) => {
    setOpenFolders((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  // Select / deselect all files inside a folder (using functional state update)
  const toggleFolderSelection = (node) => {
    setSelected((prevSelected) => {
      const allFilePaths = collectAllFilePaths(node);
      const allSelected = allFilePaths.every((p) => prevSelected.includes(p));

      if (allSelected) {
        // Deselect all
        return prevSelected.filter((p) => !allFilePaths.includes(p));
      } else {
        // Select all
        return [...new Set([...prevSelected, ...allFilePaths])];
      }
    });
  };

  const renderNode = (node, prefix = "") =>
    Object.entries(node).map(([name, value]) => {
      if (name.startsWith("__")) return null;

      const isFile = !!value.__file;
      const path = prefix ? `${prefix}/${name}` : name;

      if (isFile) {
        const file = value.__file;
        const checked = selected.includes(file.path);
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
              sx={{ flexGrow: 1 }}
              onClick={() => onOpenDetail(file)}
            >
              {name}
            </Typography>
          </Box>
        );
      } else {
        // Folder node
        const allFilePaths = collectAllFilePaths(value);
        const hasFiles = allFilePaths.length > 0;
        const allSelected = hasFiles && allFilePaths.every((p) => selected.includes(p));
        const partiallySelected =
            hasFiles && !allSelected && allFilePaths.some((p) => selected.includes(p));
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

              {/* Folder checkbox */}
              <Checkbox
                size="small"
                indeterminate={partiallySelected}
                checked={allSelected}
                disabled={!hasFiles}
                onChange={(e) => {
                    e.stopPropagation();
                    if (!hasFiles) return;
                    // use functional update to avoid stale state
                    setSelected((prev) => {
                    const shouldDeselect = allFilePaths.every((p) => prev.includes(p));
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

// Recursively collect all file paths inside a node
function collectAllFilePaths(node) {
  let files = [];
  // include file at this node (leaf)
  if (node.__file) files.push(node.__file.path);

  // recurse into children map
  const children = node.__children || {};
  for (const child of Object.values(children)) {
    files = files.concat(collectAllFilePaths(child));
  }
  return files;
}
