import { diff_match_patch } from "diff-match-patch";

const dmp = new diff_match_patch();

export function diffText(a, b) {
  const diffs = dmp.diff_main(a ?? "", b ?? "");
  dmp.diff_cleanupSemantic(diffs);
  return diffs;
}

export function normalizeXmlText(text) {
  if (!text) return "";

  let normalized = text;

  // 🔹 Remove UTF-8 BOM if present
  normalized = normalized.replace(/^\uFEFF/, "");

  // 🔹 Try to fix typical mojibake (Ã¡, Ã©, Ä›, etc.)
  if (/[ÃĚŠŽÝÁČŘÍÉŮÚĎŤň]/.test(normalized)) {
    try {
      const decoder = new TextDecoder("utf-8");
      const bytes = Uint8Array.from(normalized.split("").map(c => c.charCodeAt(0)));
      normalized = decoder.decode(bytes);
    } catch {
      // ignore decode errors
    }
  }

  // 🔹 Normalize line endings and remove trailing spaces
  normalized = normalized
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n+$/, "\n");

  // 🔹 Trim leading whitespace and BOM leftovers
  return normalized.trimStart();
}

export async function gitBlobSha(text) {
  // ✅ Always normalize first (remove BOM, fix encoding, normalize newlines)
  const normalized = normalizeXmlText(text ?? "");

  // Encode to bytes
  const encoder = new TextEncoder();
  const bytes = encoder.encode(normalized);

  // Git blob format: "blob {len}\0{data}"
  const header = encoder.encode(`blob ${bytes.length}\0`);
  const buf = new Uint8Array(header.length + bytes.length);
  buf.set(header, 0);
  buf.set(bytes, header.length);

  // Compute SHA-1
  const hash = await crypto.subtle.digest("SHA-1", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function gitBlobShaFromBytes(bytes) {
  // 🧹 Normalize for Git-style SHA compatibility
  let data = bytes;

  // Convert to string to strip BOM / normalize EOL
  const decoder = new TextDecoder("utf-8");
  let text = decoder.decode(bytes);

  // Remove UTF-8 BOM if present
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  // Git stores files exactly as they are, so only unify EOL to LF (optional)
  text = text.replace(/\r\n/g, "\n");

  // Convert back to bytes
  const encoder = new TextEncoder();
  data = encoder.encode(text);

  // Build Git blob format
  const header = encoder.encode(`blob ${data.length}\0`);
  const buf = new Uint8Array(header.length + data.length);
  buf.set(header, 0);
  buf.set(data, header.length);

  // Compute SHA-1
  const hash = await crypto.subtle.digest("SHA-1", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
