"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { isSupportedImage, MAX_PHOTO_BYTES } from "@/lib/images";

interface Props {
  photos: string[];
  onChange: (photos: string[]) => void;
  /** Stores a picked file and returns its URL. Without it, only links can be added. */
  upload?: (file: File) => Promise<string>;
  max?: number;
}

/**
 * Add pictures of the dish: take one with the camera or pick from the photo
 * library (on iPad the file picker offers both), or paste a link.
 * The first photo is the cover shown on cards and at the top of the recipe.
 */
export function PhotoPicker({ photos, onChange, upload, max = 12 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState("");
  // Uploads finish one by one; keep the latest list so none are lost.
  const latest = useRef(photos);
  useLayoutEffect(() => {
    latest.current = photos;
  });

  async function addFiles(files: FileList | null) {
    if (!files || !upload) return;
    setError(null);
    const room = max - photos.length;
    const chosen = Array.from(files).slice(0, Math.max(0, room));
    if (files.length > room) setError(`You can add up to ${max} photos.`);
    for (const file of chosen) {
      if (!isSupportedImage(file)) {
        setError(`“${file.name}” isn't a picture.`);
        continue;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        setError(`“${file.name}” is too large (25 MB max).`);
        continue;
      }
      setUploading((n) => n + 1);
      try {
        const url = await upload(file);
        const next = [...latest.current, url];
        latest.current = next;
        onChange(next);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  function addLink() {
    const value = link.trim();
    if (!value) return;
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
    } catch {
      setError("Enter a full picture link starting with https://");
      return;
    }
    setError(null);
    onChange([...photos, value]);
    setLink("");
  }

  const remove = (i: number) => onChange(photos.filter((_, idx) => idx !== i));
  const makeCover = (i: number) => onChange([photos[i], ...photos.filter((_, idx) => idx !== i)]);

  return (
    <fieldset className="space-y-3" aria-describedby="photos-help">
      <legend className="text-sm font-medium">Photos</legend>
      <p id="photos-help" className="text-xs text-muted">
        Show what the finished dish looks like. The first photo is the cover.
      </p>

      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6" aria-label="Recipe photos">
        {photos.map((src, i) => (
          <li key={`${src.slice(0, 64)}-${i}`} className="group relative">
            {/* eslint-disable-next-line @next/next/no-img-element -- user photos and links from any site */}
            <img
              src={src}
              alt={`Photo ${i + 1}${i === 0 ? " (cover)" : ""}`}
              className="aspect-square w-full rounded-md border border-border object-cover"
              referrerPolicy="no-referrer"
            />
            {i === 0 && (
              <span className="absolute top-1 left-1 rounded-sm bg-brand px-2 py-0.5 text-xs font-bold text-on-brand uppercase">Cover</span>
            )}
            <div className="mt-1 flex justify-between gap-1">
              {i > 0 ? (
                <button type="button" className="text-xs text-brand underline" onClick={() => makeCover(i)} aria-label={`Make photo ${i + 1} the cover`}>
                  Make cover
                </button>
              ) : (
                <span />
              )}
              <button type="button" className="text-xs text-danger underline" onClick={() => remove(i)} aria-label={`Remove photo ${i + 1}`}>
                Remove
              </button>
            </div>
          </li>
        ))}
        {Array.from({ length: uploading }, (_, i) => (
          <li
            key={`uploading-${i}`}
            className="flex aspect-square animate-pulse items-center justify-center rounded-md bg-surface-2 text-xs text-muted"
            role="status"
          >
            Uploading…
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2 sm:flex-row">
        {upload && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              id="photo-input"
              onChange={(e) => addFiles(e.target.files)}
              aria-label="Choose photos"
            />
            <label htmlFor="photo-input" className="btn cursor-pointer" aria-disabled={photos.length >= max}>
              📷 Add photos
            </label>
          </>
        )}
        <div className="flex flex-1 gap-2">
          <input
            type="url"
            className="input"
            placeholder="…or paste a picture link"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addLink();
              }
            }}
            aria-label="Picture link"
          />
          <button type="button" className="btn" onClick={addLink}>
            Add
          </button>
        </div>
      </div>
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
