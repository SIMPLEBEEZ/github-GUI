import React from "react";
import { ListItem, ListItemButton, ListItemText, Checkbox } from "@mui/material";

/**
 * FileRow – represents a single XML file entry in the diff list.
 *
 * Props:
 *  - file: { path, status } – file info
 *  - selected: string[] – list of currently selected file paths
 *  - toggleSelected(path): function – toggles selection of this file
 *  - openDetail(file): function – opens the diff detail dialog
 */
export const FileRow = React.memo(function FileRow({ file, selected, toggleSelected, openDetail }) {
  const isSelected = selected.includes(file.path);

  return (
    <ListItem key={file.path} disableGutters>
      <Checkbox
        checked={isSelected}
        onClick={(e) => e.stopPropagation()}
        onChange={() => toggleSelected(file.path)}
        tabIndex={-1}
      />
      <ListItemButton onClick={() => openDetail(file)} sx={{ flex: 1 }}>
        <ListItemText
          primary={file.path}
          secondary={
            file.status === "modified"
              ? "modified"
              : file.status === "added"
              ? "new file"
              : file.status
          }
        />
      </ListItemButton>
    </ListItem>
  );
});
