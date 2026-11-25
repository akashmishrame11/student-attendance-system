import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "/api";
const TOKEN_KEY = "attendify_token";

export const storage = {
  get() {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set(token) {
    try { localStorage.setItem(TOKEN_KEY, token); } catch { /* storage unavailable */ }
  },
  clear() {
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ }
  },
};

const api = axios.create({ baseURL: API_URL, timeout: 30000 });

api.interceptors.request.use((config) => {
  const token = storage.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || "";
    if (status === 401 && !url.includes("/auth/login")) {
      storage.clear();
      window.dispatchEvent(new CustomEvent("auth:expired", { detail: error.response?.data?.message }));
    }
    return Promise.reject(error);
  }
);

export function errorMessage(err, fallback = "Something went wrong") {
  if (err?.response?.data?.message) return err.response.data.message;
  if (err?.code === "ECONNABORTED") return "Request timed out. Please try again.";
  if (err?.message === "Network Error") return "Cannot reach the server. Is the backend running?";
  return err?.message || fallback;
}

/** Absolute URL for an uploaded file path like /uploads/x.pdf */
export function fileUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//.test(path)) return path;
  if (/^https?:\/\//.test(API_URL)) return new URL(path, API_URL).toString();
  return path;
}

/** Build FormData from an object (arrays and objects are JSON-encoded, files appended). */
export function toFormData(values, fileFields = {}) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) {
    if (v === undefined || v === null) continue;
    if (v instanceof FileList || (Array.isArray(v) && v[0] instanceof File)) continue;
    if (Array.isArray(v) || (typeof v === "object" && !(v instanceof Date))) fd.append(k, JSON.stringify(v));
    else fd.append(k, v);
  }
  for (const [field, files] of Object.entries(fileFields)) {
    if (!files) continue;
    for (const f of Array.from(files)) fd.append(field, f);
  }
  return fd;
}

/** Download a protected file (e.g. CSV export) with the auth header. */
export async function download(path, params, filename) {
  const res = await api.get(path, { params, responseType: "blob" });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  const cd = res.headers["content-disposition"] || "";
  a.download = filename || cd.match(/filename="?([^"]+)"?/)?.[1] || "download";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default api;
