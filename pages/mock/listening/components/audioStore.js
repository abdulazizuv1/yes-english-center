// Keeps the recording on this computer, so it plays with no internet and
// after a refresh, the way the real test plays from the machine itself.
//
// Each file is downloaded once into the browser's Cache Storage and played
// from there. That needs the storage bucket to allow it (CORS); where it
// does not, the files stream from the internet as before and everything
// else still works, only the recording needs a connection. Files are
// removed once the test is submitted.
const CACHE = "yes-listening-audio-v1";

let cacheP = null;
const openCache = () => {
  if (!cacheP) {
    cacheP = ("caches" in window ? caches.open(CACHE) : Promise.reject(new Error("no cache")))
      .catch(() => null);
  }
  return cacheP;
};

const ready = new Map();      // url -> object URL of the stored copy
let canDownload = true;       // false once the server has said no (CORS)

/** A stored copy already on this computer, as a playable URL, or null. */
export async function storedUrl(url) {
  if (ready.has(url)) return ready.get(url);
  const cache = await openCache();
  if (!cache) return null;
  try {
    const hit = await cache.match(url);
    if (!hit) return null;
    const objectUrl = URL.createObjectURL(await hit.blob());
    ready.set(url, objectUrl);
    return objectUrl;
  } catch {
    return null;
  }
}

/**
 * Downloads every file not yet stored, one after another, in the
 * background. `onProgress(done, total)` counts whole files.
 */
export async function storeAll(urls, onProgress) {
  const cache = await openCache();
  let done = 0;
  for (const url of urls) {
    if (!cache || !canDownload) break;
    if (await storedUrl(url)) { onProgress?.(++done, urls.length); continue; }
    try {
      const res = await fetch(url, { mode: "cors", credentials: "omit" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      await cache.put(url, new Response(blob, { headers: { "Content-Type": blob.type || "audio/mpeg" } }));
      ready.set(url, URL.createObjectURL(blob));
      onProgress?.(++done, urls.length);
    } catch {
      // the bucket does not allow downloads from this site, or there is no
      // internet: stream instead, and do not keep asking
      canDownload = false;
    }
  }
  return done;
}

/** Frees the space once the test is over. */
export async function forgetAll(urls) {
  const cache = await openCache();
  for (const url of urls) {
    const objectUrl = ready.get(url);
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    ready.delete(url);
    try { await cache?.delete(url); } catch { /* already gone */ }
  }
}
