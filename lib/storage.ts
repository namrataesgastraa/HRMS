import type { SupabaseClient } from "@supabase/supabase-js";
import type { StoredFile } from "./types";

/**
 * Upload files to a private bucket under the user's own folder (`<uid>/...`),
 * matching the storage RLS policies. Returns StoredFile records (the `url`
 * field holds the storage path/key — resolve with a signed URL to view).
 */
export async function uploadUserFiles(
  supabase: SupabaseClient,
  bucket: string,
  uid: string,
  files: File[],
  category?: string,
): Promise<StoredFile[]> {
  const out: StoredFile[] = [];
  for (const file of files) {
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${uid}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw error;
    out.push({
      url: path,
      type: file.type,
      filename: file.name,
      ...(category ? { category } : {}),
    });
  }
  return out;
}

/**
 * Upload files to a PUBLIC bucket and return StoredFile entries whose `url` is
 * the public URL (stored as type "link" so they open directly, no signing).
 * Used for admin task attachments the assignee must be able to view.
 */
export async function uploadPublicFiles(
  supabase: SupabaseClient,
  bucket: string,
  uid: string,
  files: File[],
): Promise<StoredFile[]> {
  const out: StoredFile[] = [];
  for (const file of files) {
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${uid}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw error;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    out.push({ url: data.publicUrl, type: "link", filename: file.name });
  }
  return out;
}

/**
 * Upload chat attachments to the PUBLIC chat-files bucket, keeping the real
 * mime type (so images can render inline). `url` is the public URL.
 */
export async function uploadChatFiles(
  supabase: SupabaseClient,
  uid: string,
  files: File[],
): Promise<StoredFile[]> {
  const out: StoredFile[] = [];
  for (const file of files) {
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${uid}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await supabase.storage
      .from("chat-files")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw error;
    const { data } = supabase.storage.from("chat-files").getPublicUrl(path);
    out.push({ url: data.publicUrl, type: file.type || "file", filename: file.name });
  }
  return out;
}

/** Turn pasted URLs into StoredFile proof entries (type "link"). */
export function linksToStoredFiles(links: string[]): StoredFile[] {
  return links
    .map((l) => l.trim())
    .filter(Boolean)
    .map((url) => ({ url, type: "link", filename: url }));
}

/**
 * Open a stored proof/document. Links open directly; storage files resolve to a
 * short-lived signed URL. Returns false if it couldn't be opened.
 *
 * We open a blank tab SYNCHRONOUSLY (inside the click gesture) and only then
 * navigate it once the URL is ready — otherwise the `await` breaks the
 * user-gesture chain and the browser's pop-up blocker silently kills it.
 */
export async function openStoredFile(
  supabase: SupabaseClient,
  bucket: string,
  file: StoredFile,
): Promise<boolean> {
  const pending =
    typeof window !== "undefined" ? window.open("", "_blank") : null;

  let url: string | null = null;
  if (file.type === "link") {
    url = file.url;
  } else {
    const { data } = await supabase.storage
      .from(bucket)
      .createSignedUrl(file.url, 3600);
    url = data?.signedUrl ?? null;
  }

  if (!url) {
    pending?.close();
    return false;
  }
  if (pending) {
    pending.location.href = url;
  } else {
    // Pop-up fully blocked → fall back to navigating the current tab.
    window.location.href = url;
  }
  return true;
}

/**
 * Upload an avatar to the PUBLIC avatars bucket and return its public URL.
 * (Public so the photo renders everywhere without per-view signed URLs.)
 */
export async function uploadAvatar(
  supabase: SupabaseClient,
  uid: string,
  file: File,
): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${uid}/avatar-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}
