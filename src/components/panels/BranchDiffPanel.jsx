import React, { useState, useMemo } from "react";
import DiffPanelBase from "../DiffPanelBase";
import { githubApi } from "../../api/githubApi";
import { onlyXmlFiles } from "../../utils/commonUtils";
import { diffText, normalizeXmlText } from "../../utils/diffUtils";
import { downloadAsZip } from "../../utils/zipUtils";

export default function BranchDiffPanel({
  token,
  repo,
  branchSource,
  branchTarget,
  setBusy,
  setSnack,
}) {
  const [comparison, setComparison] = useState([]);
  const [detail, setDetail] = useState(null);
  const [selected, setSelected] = useState([]);

  const canCompare = repo && branchSource && branchTarget && branchSource !== branchTarget;
  const visibleFiles = useMemo(
    () => comparison.filter((c) => c.status !== "same"),
    [comparison]
  );

  const runCompare = async () => {
    if (!canCompare) return;
    setBusy(true);
    try {
      // 🧩 Compare target vs source
      const cmp = await githubApi.compareBranches(
        token,
        repo.full_name,
        branchTarget,
        branchSource
      );

      // 🧩 Build list of XML files
      const xmlFiles = await Promise.all(
        onlyXmlFiles(cmp.files).map(async (f) => {
          const path = f.filename;
          let newContent = "";

          // Load the content from SOURCE branch (we want to copy A → B)
          if (["added", "modified"].includes(f.status)) {
            try {
              newContent = await githubApi.getFileText(
                token,
                repo.full_name,
                path,
                branchSource
              );
            } catch {
              newContent = "";
            }
          }

          // 🔹 include sourceBranch in each record (for commitChanges)
          return { path, status: f.status, newContent, sourceBranch: branchSource };
        })
      );

      setComparison(xmlFiles);
      setSelected(xmlFiles.filter((f) => f.status !== "same").map((f) => f.path));

      if (xmlFiles.length === 0) {
        setSnack?.({ open: true, message: "No XML file changes found." });
      }
    } catch (e) {
      setSnack?.({ open: true, message: `Comparison failed: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

  const openDetail = async (file) => {
    try {
      setBusy(true);
      const baseRaw = await githubApi.getFileText(
        token,
        repo.full_name,
        file.path,
        branchSource
      );
      const headRaw = await githubApi.getFileText(
        token,
        repo.full_name,
        file.path,
        branchTarget
      );
      const baseText = normalizeXmlText(baseRaw);
      const headText = normalizeXmlText(headRaw);
      if (baseText === headText) {
        setSnack?.({ open: true, message: "File is identical after normalization." });
        return;
      }
      const diffs = diffText(headText, baseText);
      // Use clearer labels in the diff dialog
      const branchSourceLabel = `branch: ${branchSource}`;
      const branchTargetLabel = `branch: ${branchTarget}`;
      setDetail({ path: file.path, diffs, branchSource: branchSourceLabel, branchTarget: branchTargetLabel });
    } catch (e) {
      setSnack?.({ open: true, message: `Failed to load file: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

  const exportSelected = async () => {
    const targets = comparison.filter((c) => selected.includes(c.path));
    if (!targets.length)
      return setSnack?.({ open: true, message: "Nothing to export." });

    setBusy(true);
    try {
      const files = await Promise.all(
        targets.map(async (c) => {
          const meta = await githubApi.getFileText(
            token,
            repo.full_name,
            c.path,
            branchTarget
          );
          return { path: c.path, text: meta };
        })
      );
      downloadAsZip(files, `export_${repo.name}_${branchSource}_vs_${branchTarget}.zip`);
      setSnack?.({ open: true, message: `Exported ${files.length} files.` });
    } catch (e) {
      setSnack?.({ open: true, message: `Export failed: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <DiffPanelBase
      title="Branch → Branch diff (XML)"
      compareLabel={`Compare ${branchSource} → ${branchTarget}`}
      canRun={canCompare}
      visibleFiles={visibleFiles}
      selected={selected}
      setSelected={setSelected}
      onCompare={runCompare}
      onExport={exportSelected}
      onOpenDetail={openDetail}
      detail={detail}
      setDetail={setDetail}
      token={token}
      repo={repo}
      branch={branchTarget}
      onCommitted={async (res) => {
        console.log("✅ Commit successful", res);
        // Refresh comparison so committed files are no longer shown as changed
        try {
          await runCompare();
          setSnack?.({ open: true, message: "Commit applied — refreshed comparison." });
        } catch (e) {
          setSnack?.({ open: true, message: `Committed but refresh failed: ${e.message}` });
        }
      }}
    />
  );
}
