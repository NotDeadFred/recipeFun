"use client";

import { useCallback } from "react";
import { resizePhoto } from "@/lib/images";
import { useApp } from "../AppProvider";

/**
 * Resize a picked photo on the device, then store it. Local mode keeps photos
 * in limited browser storage, so they're kept smaller there.
 */
export function usePhotoUpload() {
  const { repo, mode } = useApp();
  return useCallback(
    async (file: File) => {
      const resized = await resizePhoto(file, mode === "local" ? 1024 : 2000, mode === "local" ? 0.75 : 0.85);
      return repo.uploadPhoto(resized);
    },
    [repo, mode],
  );
}
