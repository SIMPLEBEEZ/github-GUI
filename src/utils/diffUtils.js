import { diff_match_patch } from "diff-match-patch";

const dmp = new diff_match_patch();

export function diffText(a, b) {
  const diffs = dmp.diff_main(a ?? "", b ?? "");
  dmp.diff_cleanupSemantic(diffs);
  return diffs;
}

export function normalizeXmlText(text) {
  return (text ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/^\s*\n/gm, "")
    .trim();
}

export async function gitBlobSha(text) {
  const enc = new TextEncoder();
  const bytes = enc.encode(text ?? "");
  const header = enc.encode(`blob ${bytes.length}\u0000`);
  const buf = new Uint8Array(header.length + bytes.length);
  buf.set(header, 0);
  buf.set(bytes, header.length);
  const hash = await crypto.subtle.digest("SHA-1", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
