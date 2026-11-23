"use client";

import { useEffect, useRef, useState } from "react";

/** Cover photo with thumbnails; tap any photo to view it full screen. */
export function PhotoGallery({ photos, title }: { photos: string[]; title: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const touchX = useRef<number | null>(null);
  const count = photos.length;

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((i) => (i === null ? i : (i + 1) % count));
      if (e.key === "ArrowLeft") setOpen((i) => (i === null ? i : (i - 1 + count) % count));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, count]);

  if (count === 0) return null;

  return (
    <div className="w-full sm:w-64">
      <button type="button" onClick={() => setOpen(0)} className="block w-full" aria-label={`View photos of ${title}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- user photos and images from recipe sites */}
        <img src={photos[0]} alt={title} className="aspect-[4/3] w-full rounded-2xl object-cover" referrerPolicy="no-referrer" />
      </button>
      {count > 1 && (
        <ul className="mt-2 flex gap-2 overflow-x-auto pb-1" aria-label="More photos">
          {photos.slice(1).map((src, i) => (
            <li key={`${src.slice(0, 64)}-${i}`} className="shrink-0">
              <button type="button" onClick={() => setOpen(i + 1)} aria-label={`View photo ${i + 2} of ${count}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
                <img src={src} alt="" className="size-14 rounded-lg object-cover" referrerPolicy="no-referrer" loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {open !== null && (
        <div
          role="dialog"
          aria-modal
          aria-label={`Photo ${open + 1} of ${count}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setOpen(null)}
          onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            touchX.current = null;
            if (Math.abs(dx) > 50) setOpen((open + (dx < 0 ? 1 : -1) + count) % count);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
          <img
            src={photos[open]}
            alt={`${title}, photo ${open + 1}`}
            className="max-h-full max-w-full rounded-lg object-contain"
            referrerPolicy="no-referrer"
            onClick={(e) => e.stopPropagation()}
          />
          <button type="button" className="absolute top-4 right-4 rounded-full bg-white/20 px-4 py-2 text-white" onClick={() => setOpen(null)}>
            ✕ Close
          </button>
          {count > 1 && (
            <>
              <button
                type="button"
                className="absolute left-3 rounded-full bg-white/20 px-4 py-3 text-2xl text-white"
                aria-label="Previous photo"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen((open - 1 + count) % count);
                }}
              >
                ‹
              </button>
              <button
                type="button"
                className="absolute right-3 rounded-full bg-white/20 px-4 py-3 text-2xl text-white"
                aria-label="Next photo"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen((open + 1) % count);
                }}
              >
                ›
              </button>
              <p className="absolute bottom-6 text-sm text-white/80">
                {open + 1} / {count}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
