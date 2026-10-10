/** Tracks genuine Transformers.js model-download callbacks; unknown transfer totals stay indeterminate. */
export function createDownloadProgress(emit) {
  const files = new Map();
  return (info = {}) => {
    const status = info.status;
    const file = typeof info.file === "string" ? info.file : undefined;
    if (status === "progress_total" && Number.isFinite(info.total) && info.total > 0) {
      emit({ phase: "downloading", detail: "Downloading model files",
        loadedBytes: Math.min(info.total, Math.max(0, info.loaded || 0)),
        totalBytes: info.total,
        percent: Math.min(99, Math.max(0, info.progress ?? info.loaded / info.total * 100)) });
      return;
    }
    if (file && ["initiate","download","progress","done"].includes(status)) {
      const previous = files.get(file) || { loaded: 0, total: 0 };
      const total = Number.isFinite(info.total) && info.total > 0 ? info.total : previous.total;
      const loaded = status === "done" ? total : Number.isFinite(info.loaded) ? Math.max(previous.loaded, info.loaded) : previous.loaded;
      files.set(file, { loaded: total ? Math.min(total, loaded) : loaded, total });
    }
    const entries = [...files.values()];
    const loadedBytes = entries.reduce((sum, item) => sum + item.loaded, 0);
    const totalBytes = entries.reduce((sum, item) => sum + item.total, 0);
    emit({ phase: totalBytes > 0 ? "downloading" : "loading",
      detail: file ? (status === "done" ? "Downloaded " : "Downloading ") + file.split("/").at(-1) : "Preparing model",
      ...(totalBytes > 0 ? { loadedBytes, totalBytes,
        percent: Math.min(99, Math.max(0, loadedBytes / totalBytes * 100)) } : {}) });
  };
}
