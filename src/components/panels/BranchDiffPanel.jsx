import React, { useState, useMemo } from "react";
import DiffPanelBase from "../DiffPanelBase";
import { githubApi } from "../../api/githubApi";
import { onlyXmlFiles, mapLimit } from "../../utils/commonUtils";
import { diffText, normalizeXmlText } from "../../utils/diffUtils";
import { downloadAsZip } from "../../utils/zipUtils";

export default function BranchDiffPanel({
  token,
  repo,
  branchA,
  branchB,
  setBusy,
  setSnack,
}) {
  const [comparison, setComparison] = useState([]);
  const [detail, setDetail] = useState(null);
  const [selected, setSelected] = useState([]);

  const canCompare = repo && branchA && branchB && branchA !== branchB;
  const visibleFiles = useMemo(
    () => comparison.filter((c) => c.status !== "same"),
    [comparison]
  );

  const runCompare = async () => {
    if (!canCompare) return;
    setBusy(true);
    try {
      const cmp = await githubApi.compareBranches(
        token,
        repo.full_name,
        branchA,
        branchB
      );
      const xmlFiles = onlyXmlFiles(cmp.files).map((f) => ({
        path: f.filename,
        status: f.status,
      }));
      setComparison(xmlFiles);
      setSelected(xmlFiles.filter((f) => f.status !== "same").map((f) => f.path));
      if (xmlFiles.length === 0)
        setSnack?.({ open: true, message: "No XML file changes found." });
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
        branchA
      );
      const headRaw = await githubApi.getFileText(
        token,
        repo.full_name,
        file.path,
        branchB
      );
      const baseText = normalizeXmlText(baseRaw);
      const headText = normalizeXmlText(headRaw);
      if (baseText === headText) {
        setSnack?.({ open: true, message: "File is identical after normalization." });
        return;
      }
      const diffs = diffText(baseText, headText);
      setDetail({ path: file.path, diffs, branchA, branchB });
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
            branchB
          );
          return { path: c.path, text: meta };
        })
      );
      downloadAsZip(files, `export_${repo.name}_${branchA}_vs_${branchB}.zip`);
      setSnack?.({ open: true, message: `Exported ${files.length} files.` });
    } catch (e) {
      setSnack?.({ open: true, message: `Export failed: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <DiffPanelBase
      title="Branch ↔ Branch diff (XML)"
      compareLabel={`Compare ${branchA} ↔ ${branchB}`}
      canRun={canCompare}
      visibleFiles={visibleFiles}
      selected={selected}
      setSelected={setSelected}
      onCompare={runCompare}
      onExport={exportSelected}
      onOpenDetail={openDetail}
      detail={detail}
      setDetail={setDetail}
    />
  );
}
