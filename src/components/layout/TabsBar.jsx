import React from "react";
import { Box, Tabs, Tab } from "@mui/material";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import ArchiveIcon from "@mui/icons-material/Archive";

export default function TabsBar({ tab, setTab, darkMode }) {
  return (
    <Box
      sx={{
        borderBottom: 1,
        borderColor: darkMode ? "#30363d" : "#d0d7de",
        bgcolor: darkMode ? "#0d1117" : "#ffffff",
        px: 2,
      }}
    >
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        textColor="primary"
        indicatorColor="primary"
        sx={{
          minHeight: 44,
          "& .MuiTab-root": {
            textTransform: "none",
            fontWeight: 500,
            minHeight: 44,
            mr: 2,
          },
        }}
      >
        <Tab
          icon={<CompareArrowsIcon fontSize="small" />}
          iconPosition="start"
          label="Branch → Branch"
        />
        <Tab
          icon={<ArchiveIcon fontSize="small" />}
          iconPosition="start"
          label="ZIP → Branch"
        />
      </Tabs>
    </Box>
  );
}
