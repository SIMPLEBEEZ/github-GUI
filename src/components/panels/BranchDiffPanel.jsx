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

      // 🧩 Build list of XML files with SHA optimization
      const xmlFiles = await Promise.all(
        onlyXmlFiles(cmp.files).map(async (f) => {
          const path = f.filename;
          let status = f.status;
          let newContent = "";

          // If the file is added, SHA cannot be compared, so fetch the content
          if (status === "added") {
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
            return { path, status, newContent, sourceBranch: branchSource };
          }

          // If the file is modified, compare SHA
          // cmp.files contains 'sha' (new) and 'previous_sha' (old)
          const sha = f.sha;
          const previousSha = f.previous_sha;

          // If SHA is the same, the file is identical, no need to fetch content
          if (status === "modified" && sha && previousSha && sha === previousSha) {
            status = "same";
            return { path, status, newContent: "", sourceBranch: branchSource };
          }

          // If SHA is different or missing, fetch content for comparison
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

          let targetContent = "";
          try {
            targetContent = await githubApi.getFileText(
              token,
              repo.full_name,
              path,
              branchTarget
            );
          } catch {
            targetContent = "";
          }

          // Normalize and compare
          const normSource = normalizeXmlText(newContent);
          const normTarget = normalizeXmlText(targetContent);
          if (status === "modified" && normSource === normTarget) {
            status = "same";
          }

          return { path, status, newContent, sourceBranch: branchSource };
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
      onCommitted={async (res, committedFiles) => {
        console.log("✅ Commit successful", res);
        try {
          // Optimistically remove committed files from the current comparison so they
          // disappear immediately in the UI (committedFiles is an array of {path,...}).
          if (Array.isArray(committedFiles) && committedFiles.length) {
            const committedPaths = committedFiles.map((f) => f.path).filter(Boolean);
            if (committedPaths.length) {
              setComparison((prev) => prev.filter((c) => !committedPaths.includes(c.path)));
              setSelected((prev) => prev.filter((p) => !committedPaths.includes(p)));
            }
          }

          // Also re-run compare to ensure state is fully in sync with the repo
          await runCompare();
          setSnack?.({ open: true, message: "Commit applied — refreshed comparison." });
        } catch (e) {
          setSnack?.({ open: true, message: `Committed but refresh failed: ${e.message}` });
        }
      }}
    />
  );
}
