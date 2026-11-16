"use client";
// Logo picker (Website → Partners, CR-16): the chosen picture is shrunk in the browser to at most 320 px and kept
// as a data: URL in the form, so the server only ever stores a small image. Shows a preview and a Remove button.
import { useRef } from "react";

const MAX_SIDE = 320;
const TYPES = /^image\/(png|jpeg|webp|gif)$/;

/** File → small data: URL (WebP where the browser can write it, else PNG; transparency is kept). */
export async function shrinkImage(file, max = MAX_SIDE) {
  if (!TYPES.test(file.type)) throw new Error("Choose a PNG, JPG or WebP image.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, bad) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => bad(new Error("This image could not be read. Try another file."));
      i.src = url;
    });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * k));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * k));
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/webp", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function ImageInput({ value, onChange, onError, readOnly, label, invalid }) {
  const file = useRef(null);
  const pick = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try { onChange(await shrinkImage(f)); } catch (err) { onError?.(err.message); }
  };
  return (
    <div className="image-input">
      {value ? <img src={value} alt={`${label} preview`} className="image-preview" /> : <span className="image-empty">No logo</span>}
      {!readOnly && (
        <div className="image-buttons">
          <button type="button" className="btn btn-light btn-sm" onClick={() => file.current?.click()}>{value ? "Change logo" : "Choose logo"}</button>
          {value && <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => onChange("")}>Remove</button>}
          <input ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden aria-label={label} aria-invalid={invalid || undefined} onChange={pick} />
        </div>
      )}
    </div>
  );
}
