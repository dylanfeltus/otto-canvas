"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { GenerationGroup } from "@/lib/types";

const STORAGE_KEY = "otto-canvas-session";
const IMG_DB_NAME = "otto-canvas-images";
const IMG_STORE = "images";

/** IndexedDB helpers for storing base64 images */
function openImgDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IMG_DB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IMG_STORE)) {
        db.createObjectStore(IMG_STORE);
      }
      if (!db.objectStoreNames.contains("ref-images")) {
        db.createObjectStore("ref-images");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveImages(images: Record<string, string>): Promise<void> {
  const db = await openImgDB();
  const tx = db.transaction(IMG_STORE, "readwrite");
  const store = tx.objectStore(IMG_STORE);
  for (const [key, val] of Object.entries(images)) {
    store.put(val, key);
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function loadImages(): Promise<Record<string, string>> {
  const db = await openImgDB();
  const tx = db.transaction(IMG_STORE, "readonly");
  const store = tx.objectStore(IMG_STORE);
  const result: Record<string, string> = {};
  return new Promise((resolve, reject) => {
    const cursor = store.openCursor();
    cursor.onsuccess = () => {
      const c = cursor.result;
      if (c) { result[c.key as string] = c.value; c.continue(); }
      else { db.close(); resolve(result); }
    };
    cursor.onerror = () => { db.close(); reject(cursor.error); };
  });
}

/** Strip base64 data URIs, storing them in IndexedDB keyed by hash */
function extractBase64(groups: GenerationGroup[]): { stripped: GenerationGroup[]; images: Record<string, string> } {
  const images: Record<string, string> = {};
  let counter = 0;
  const stripped = groups.map((g) => ({
    ...g,
    iterations: g.iterations.map((it) => ({
      ...it,
      html: it.html
        ? it.html.replace(/src="(data:image\/[^"]+)"/g, (_m, uri) => {
            const key = `img_${g.id}_${it.id}_${counter++}`;
            images[key] = uri;
            return `src="[idb:${key}]"`;
          })
        : it.html,
    })),
  }));
  return { stripped, images };
}

/** Restore base64 from IndexedDB refs */
function restoreBase64(groups: GenerationGroup[], images: Record<string, string>): GenerationGroup[] {
  return groups.map((g) => ({
    ...g,
    iterations: g.iterations.map((it) => ({
      ...it,
      html: it.html
        ? it.html.replace(/src="\[idb:([^\]]+)\]"/g, (_m, key) => {
            return images[key] ? `src="${images[key]}"` : 'src="[img-missing]"';
          })
        : it.html,
    })),
  }));
}

export function usePersistedGroups() {
  const [groups, setGroupsRaw] = useState<GenerationGroup[]>([]);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from localStorage + IndexedDB on mount
  useEffect(() => {
    (async () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as GenerationGroup[];
          const valid = parsed.filter((g) =>
            g.iterations.some((it) => it.html && !it.isLoading)
          );
          if (valid.length > 0) {
            // Restore base64 images from IndexedDB
            try {
              const images = await loadImages();
              setGroupsRaw(restoreBase64(valid, images));
            } catch {
              setGroupsRaw(valid);
            }
          }
        }
      } catch {}
      setLoaded(true);
    })();
  }, []);

  // Debounced save to localStorage
  const persistGroups = useCallback((newGroups: GenerationGroup[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        // Only save groups that have real content
        const toSave = newGroups.filter((g) =>
          g.iterations.some((it) => it.html && !it.isLoading)
        );
        // Extract base64 images to IndexedDB, store lightweight HTML in localStorage
        const { stripped, images } = extractBase64(toSave);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stripped));
        if (Object.keys(images).length > 0) {
          saveImages(images).catch((err) =>
            console.warn("[persist] Failed to save images to IndexedDB:", err)
          );
        }
      } catch (err) {
        console.warn("[persist] Failed to save canvas session:", err);
      }
    }, 500);
  }, []);

  // Wrapper that persists on every change
  const setGroups = useCallback(
    (updater: GenerationGroup[] | ((prev: GenerationGroup[]) => GenerationGroup[])) => {
      setGroupsRaw((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        persistGroups(next);
        return next;
      });
    },
    [persistGroups]
  );

  const resetSession = useCallback(() => {
    setGroupsRaw([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  return { groups, setGroups, loaded, resetSession };
}
