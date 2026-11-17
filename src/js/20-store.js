/* 20-store.js — 儲存層。
 * 第一版：資料只存在「這台裝置的瀏覽器」(IndexedDB)，不會送到任何伺服器。
 * 之後要改成公司 OneDrive／SharePoint（Microsoft Graph）時，只要另寫一個
 * 實作相同介面的 store，換掉 AR.store 即可。介面：
 *   listProjects() / getProject(id) / putProject(p) / deleteProject(id)
 *   putBlob(blob) -> id / getBlob(id) / deleteBlob(id)
 *   getSetting(key) / putSetting(key, value)
 */
'use strict';

AR.idbStore = (() => {
  const DB_NAME = 'autoreport-v1';
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      db.createObjectStore('projects', { keyPath: 'id' });
      db.createObjectStore('blobs');
      db.createObjectStore('settings');
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const tx = async (store, mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction(store, mode);
      const req = fn(t.objectStore(store));
      t.oncomplete = () => res(req && req.result);
      t.onerror = () => rej(t.error);
    });
  };
  return {
    listProjects: async () => {
      const all = (await tx('projects', 'readonly', (s) => s.getAll())) || [];
      return all.map((p) => ({ id: p.id, name: p.name, updatedAt: p.updatedAt, info: p.info }))
        .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    },
    getProject: (id) => tx('projects', 'readonly', (s) => s.get(id)),
    putProject: (p) => tx('projects', 'readwrite', (s) => s.put(p)),
    deleteProject: (id) => tx('projects', 'readwrite', (s) => s.delete(id)),
    putBlob: async (blob, id = AR.uid('b_')) => { await tx('blobs', 'readwrite', (s) => s.put(blob, id)); return id; },
    getBlob: (id) => tx('blobs', 'readonly', (s) => s.get(id)),
    deleteBlob: (id) => tx('blobs', 'readwrite', (s) => s.delete(id)),
    getSetting: (k) => tx('settings', 'readonly', (s) => s.get(k)),
    putSetting: (k, v) => tx('settings', 'readwrite', (s) => s.put(v, k)),
  };
})();

AR.store = AR.idbStore;

/** 圖片 URL 快取（blobId -> objectURL） */
AR.blobUrl = (() => {
  const cache = new Map();
  const fn = async (id) => {
    if (!id) return '';
    if (cache.has(id)) return cache.get(id);
    const b = await AR.store.getBlob(id);
    if (!b) return '';
    const u = URL.createObjectURL(b);
    cache.set(id, u);
    return u;
  };
  fn.peek = (id) => cache.get(id);
  return fn;
})();

/** 專案存檔（延遲合併寫入） */
AR.save = (() => {
  let timer = null;
  const fn = (p = AR.state.project) => {
    if (!p) return;
    p.updatedAt = AR.now();
    clearTimeout(timer);
    timer = setTimeout(() => AR.store.putProject(p), 300);
  };
  fn.now = (p = AR.state.project) => { clearTimeout(timer); if (p) return AR.store.putProject(p); };
  return fn;
})();
