import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export const SUPABASE_URL = "https://vyggqgdzqgvnuevrmplx.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Tr_JjYalBg39NunE6Z30Iw_2GP-fTSJ";

export const STORAGE_BUCKETS = {
  bookCovers: "book-covers",
  profileAvatars: "profile-avatars",
  chapterFiles: "chapter-files"
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce"
  }
});

export function getSiteBaseUrl() {
  return new URL(".", window.location.href).toString();
}

export function getAbsoluteUrl(path) {
  return new URL(path, getSiteBaseUrl()).toString();
}

export function getLoginRedirectUrl(next = "index.html") {
  const url = new URL("auth-callback.html", getSiteBaseUrl());
  url.searchParams.set("next", next);
  return url.toString();
}

export function getProviderLabel(provider) {
  if (provider === "google") return "Google";
  if (provider === "facebook") return "Facebook";
  return "Password";
}

export function formatRoleLabel(role) {
  if (role === "super_admin") return "super admin";
  if (role === "admin") return "admin";
  return "user";
}

export function isAdminRole(role) {
  return role === "admin" || role === "super_admin";
}

export function fileExtension(fileName = "") {
  const match = String(fileName).toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : "jpg";
}

export function buildStoragePath(...parts) {
  return parts
    .filter(Boolean)
    .map((part) => String(part).replace(/^\/+|\/+$/g, ""))
    .join("/");
}

export function getPublicBucketUrl(bucket, path) {
  if (!path) return "";
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export function createTextFile(text, fileName) {
  return new File([text], fileName, { type: "text/plain;charset=utf-8" });
}

export function getCurrentDayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function makeOrderNumber() {
  return `#DS-${Math.floor(100000 + Math.random() * 900000)}`;
}

export function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
