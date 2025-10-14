import JSZip from "jszip";
import { normalizeXmlText } from "./diffUtils";

export async function fileListFromZip(zipFile) {
  const zip = await JSZip.loadAsync(zipFile);
  const entries = [];

  for (const [path, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    if (!/\.xml$/i.test(path)) continue;

    // ✅ Read both text and raw bytes
    const bytes = await file.async("uint8array");

    // Decode text for later diff preview
    const decoder = new TextDecoder("utf-8");
    let text = decoder.decode(bytes);
    text = normalizeXmlText(text);

    // ✅ Store both text (for UI) and bytes (for exact hash)
    entries.push({ path, text, rawBytes: bytes });
  }

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
