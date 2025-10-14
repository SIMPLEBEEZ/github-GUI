import React, { useState, useMemo } from "react";
import { githubApi } from "../../api/githubApi";
import DiffPanelBase from "../DiffPanelBase";
import { fileListFromZip, downloadAsZip } from "../../utils/zipUtils";
import { diffText, normalizeXmlText, gitBlobSha, gitBlobShaFromBytes } from "../../utils/diffUtils";
import { mapLimit } from "../../utils/commonUtils";

export default function ZipDiffPanel({
  token,
  repo,
  branchRef,
  setBusy,
  setSnack,
  zipFile, // ✅ we assume the uploaded ZIP is passed here
}) {
  const [zipEntries, setZipEntries] = useState([]);
  const [comparison, setComparison] = useState([]);
  const [detail, setDetail] = useState(null);
  const [selected, setSelected] = useState([]);

  const canRun = token && repo && branchRef && zipEntries.length > 0;
  const visibleFiles = useMemo(
    () => comparison.filter((c) => c.status !== "same"),
    [comparison]
  );

  // ✅ Handle ZIP parsing when zipFile changes
  React.useEffect(() => {
    if (!zipFile) return;
    const loadZip = async () => {
      try {
        setBusy(true);
        const entries = await fileListFromZip(zipFile);
        setZipEntries(entries);
        setSnack?.({
          open: true,
          message: `Loaded ${entries.length} XML files from ZIP.`,
        });
      } catch (e) {
        setSnack?.({ open: true, message: `ZIP error: ${e.message}` });
      } finally {
        setBusy(false);
      }
    };
    loadZip();
  }, [zipFile]);

  const runCompare = async () => {
    if (!canRun) return;
    setBusy(true);

    try {
      // 1️⃣ Get repo tree
      const tree = await githubApi.getTreeRecursive(token, repo.full_name, branchRef);

      // 2️⃣ Map path → SHA (only XML)
      const blobMap = new Map(
        tree.tree
          .filter((t) => /\.xml$/i.test(t.path))
          .map((n) => [n.path, n.sha])
      );

      // 3️⃣ Compare ZIP files to repo SHAs (no GitHub fetch)
      const results = await mapLimit(zipEntries, 24, async (entry) => {
        const repoSha = blobMap.get(entry.path);
        if (!repoSha) return { path: entry.path, status: "added", zipText: entry.text };

        // ✅ Compute SHA from raw bytes (exact Git match)
        const zipSha = await gitBlobShaFromBytes(entry.rawBytes);

        if (zipSha === repoSha) {
          return { path: entry.path, status: "same" };
        } else {
          return { path: entry.path, status: "modified", zipText: entry.text, repoSha };
        }
      });

      // 4️⃣ Save results
      setComparison(results);
      setSelected(results.filter((r) => r.status !== "same").map((r) => r.path));

      const mod = results.filter((r) => r.status === "modified").length;
      const add = results.filter((r) => r.status === "added").length;
      const same = results.filter((r) => r.status === "same").length;
      setSnack?.({
        open: true,
        message: `Comparison done: ${mod} modified, ${add} new, ${same} unchanged.`,
      });
    } catch (e) {
      setSnack?.({ open: true, message: `Comparison failed: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

  const openDetail = async (c) => {
    try {
      setBusy(true);
      const repoRaw = c.repoSha
        ? await githubApi.getBlobRaw(token, repo.full_name, c.repoSha)
        : "";
      const repoText = normalizeXmlText(repoRaw);
      const zipText = normalizeXmlText(c.zipText);
      if (repoText === zipText) {
        setSnack?.({ open: true, message: "File is identical after normalization." });
        return;
      }
      const diffs = diffText(zipText, repoText);
      setDetail({ path: c.path, diffs, branchA: branchRef, branchB: "ZIP" });
    } catch (e) {
      setSnack?.({ open: true, message: `Failed to load file details: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

  const exportSelected = () => {
    const files = comparison
      .filter((c) => selected.includes(c.path))
      .map((c) => ({ path: c.path, text: c.zipText }));
    if (!files.length) {
      setSnack?.({ open: true, message: "Nothing to export." });
      return;
    }
    downloadAsZip(files, `export_${repo.name}_${branchRef}.zip`);
  };

  return (
    <DiffPanelBase
      title="ZIP → Branch diff (XML)"
      compareLabel={`Compare with ${branchRef}`}
      canRun={canRun}
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
      branch={branchRef}
      onCommitted={() => console.log("✅ Commit successful")}
    />
  );
}
