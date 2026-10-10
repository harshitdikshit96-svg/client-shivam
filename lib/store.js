// Draft storage. Uses a PUBLIC Vercel Blob store when BLOB_READ_WRITE_TOKEN is set
// (auto-injected when a Blob store is connected on Vercel), otherwise a local file.
import { promises as fs } from "fs";
import path from "path";

const BLOB_PATH = "client-shivam/config.json";
const LOCAL_FILE = path.join(process.cwd(), ".data", "config.json");
const DEFAULT = { overrides: { hidden: {}, labels: {}, order: {} }, status: "draft", updatedAt: null, submittedAt: null };

const useBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

export async function readState() {
  try {
    if (useBlob()) {
      const { head } = await import("@vercel/blob");
      const meta = await head(BLOB_PATH).catch(() => null);
      if (!meta) return { ...DEFAULT };
      const res = await fetch(`${meta.url}?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return { ...DEFAULT };
      return { ...DEFAULT, ...(await res.json()) };
    }
    const txt = await fs.readFile(LOCAL_FILE, "utf8");
    return { ...DEFAULT, ...JSON.parse(txt) };
  } catch {
    return { ...DEFAULT };
  }
}

export async function writeState(state) {
  const body = JSON.stringify(state, null, 2);
  if (useBlob()) {
    const { put } = await import("@vercel/blob");
    await put(BLOB_PATH, body, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    });
    return;
  }
  await fs.mkdir(path.dirname(LOCAL_FILE), { recursive: true });
  await fs.writeFile(LOCAL_FILE, body);
}
