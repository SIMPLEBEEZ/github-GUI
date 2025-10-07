import JSZip from "jszip";

export async function fileListFromZip(file) {
  const zip = await JSZip.loadAsync(file);
  const entries = [];
  await Promise.all(
    Object.keys(zip.files).map(async (name) => {
      const entry = zip.files[name];
      if (entry.dir || !name.toLowerCase().endsWith(".xml")) return;
      const text = await entry.async("string");
      entries.push({ path: name, text });
    })
  );
  return entries;
}

export function downloadAsZip(files, zipName = "export.zip") {
  const zip = new JSZip();
  files.forEach((f) => zip.file(f.path, f.text ?? ""));
  zip.generateAsync({ type: "blob" }).then((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = zipName;
    a.click();
    URL.revokeObjectURL(url);
  });
}
