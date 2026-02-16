"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { CanvasImage } from "@/lib/types";

const DB_NAME = "otto-canvas-images";
const STORE_NAME = "ref-images";
const DB_VERSION = 2; // bump from v1 used by groups hook
const MAX_IMAGES = 20;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("images")) {
        db.createObjectStore("images"); // existing store from groups hook
      }
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbGet<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbPut(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Compress an image dataUrl to JPEG at reduced quality/size for storage */
function compressForStorage(dataUrl: string, maxWidth: number = 800): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(maxWidth / img.width, 1);
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.6));
    };
    img.onerror = () => resolve(dataUrl); // fallback to original
    img.src = dataUrl;
  });
}

interface StoredImage {
  id: string;
  compressedDataUrl: string;
  name: string;
  width: number;
  height: number;
  position: { x: number; y: number };
  thumbnail: string;
}

export function usePersistedImages() {
  const [images, setImagesRaw] = useState<CanvasImage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from IndexedDB on mount
  useEffect(() => {
    (async () => {
      try {
        const db = await openDB();
        const stored = await dbGet<StoredImage[]>(db, "canvas-images");
        if (stored && stored.length > 0) {
          setImagesRaw(stored.map((s) => ({
            id: s.id,
            dataUrl: s.compressedDataUrl,
            name: s.name,
            width: s.width,
            height: s.height,
            position: s.position,
            thumbnail: s.thumbnail,
          })));
        }
      } catch (err) {
        console.warn("[persist-images] Failed to load:", err);
      }
      setLoaded(true);
    })();
  }, []);

  // Debounced save to IndexedDB
  const persistImages = useCallback(async (newImages: CanvasImage[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const db = await openDB();
        // Compress images for storage (max 800px wide, JPEG 60%)
        const stored: StoredImage[] = await Promise.all(
          newImages.slice(0, MAX_IMAGES).map(async (img) => ({
            id: img.id,
            compressedDataUrl: await compressForStorage(img.dataUrl),
            name: img.name,
            width: img.width,
            height: img.height,
            position: img.position,
            thumbnail: img.thumbnail,
          }))
        );
        await dbPut(db, "canvas-images", stored);
      } catch (err) {
        console.warn("[persist-images] Failed to save:", err);
      }
    }, 500);
  }, []);

  const setImages = useCallback(
    (updater: CanvasImage[] | ((prev: CanvasImage[]) => CanvasImage[])) => {
      setImagesRaw((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        persistImages(next);
        return next;
      });
    },
    [persistImages]
  );

  return { images, setImages, loaded };
}
