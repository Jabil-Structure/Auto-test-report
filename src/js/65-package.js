/* 65-package.js — 專案檔匯出／匯入（.zip）。
 * 用途：備份、從手機帶到電腦、多人各自拍照後合併。
 * zip 內照片依「節點／清單項目」自動命名，解壓縮後就是整理好的資料夾，可直接放公司 OneDrive。 */
'use strict';

AR.pkg = (() => {
  const M = AR.model;
  const extOf = (blob) => ({ 'image/png': 'png', 'image/gif': 'gif', 'image/bmp': 'bmp' }[blob.type] || 'jpg');

  async function exportZip(p) {
    const zip = new JSZip();
    const files = {};
    const nodes = M.sortedNodes(p);
    for (const ph of p.photos) {
      const blob = await AR.store.getBlob(ph.blobId);
      if (!blob) continue;
      let path;
      if (ph.itemId === 'setup') {
        // 架設照：照片/架設照/{測項}_{分項}_{流水號}
        const k = M.setupPhotos(p, ph.subitemId).indexOf(ph) + 1;
        path = `照片/架設照/${AR.safeName(M.subLabel(p, ph.subitemId))}_${k}.${extOf(blob)}`;
      } else {
        const ni = nodes.findIndex((n) => n.id === ph.nodeId) + 1;
        const n = nodes[ni - 1];
        const dir = `照片/${String(ni).padStart(2, '0')}_${AR.safeName(n ? (n.after ? M.subLabel(p, n.after) + '之後' : '測試前') : '未知節點')}`;
        const same = M.photosOf(p, ph.nodeId, ph.itemId);
        const k = same.indexOf(ph) + 1;
        path = `${dir}/${AR.safeName(M.itemName(p, ph.itemId))}_${k}.${extOf(blob)}`;
      }
      zip.file(path, blob);
      files[ph.blobId] = path;
    }
    for (const r of p.responses) {
      const blob = await AR.store.getBlob(r.blobId);
      if (!blob) continue;
      const path = `響應圖/${AR.safeName(r.name || r.id)}_${r.id.slice(-4)}.${extOf(blob)}`;
      zip.file(path, blob);
      files[r.blobId] = path;
    }
    zip.file('project.json', JSON.stringify({ format: 'autoreport-project', version: 1, project: p, files }, null, 1));
    return zip.generateAsync({ type: 'blob' });
  }

  /** 匯入：同一個測試案（id 相同）會合併；否則新增 */
  async function importZip(file) {
    const zip = await JSZip.loadAsync(file);
    const meta = JSON.parse(await zip.file('project.json').async('string'));
    if (meta.format !== 'autoreport-project') throw new Error('不是 Autoreport 專案檔');
    for (const [blobId, path] of Object.entries(meta.files || {})) {
      const f = zip.file(path);
      if (!f) continue;
      const ext = path.split('.').pop();
      const type = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
      if (!(await AR.store.getBlob(blobId))) await AR.store.putBlob(new Blob([await f.async('arraybuffer')], { type }), blobId);
    }
    const incoming = M.migrate(meta.project);
    const local = M.migrate(await AR.store.getProject(incoming.id));
    if (local) {
      const added = M.merge(local, incoming);
      local.updatedAt = AR.now();
      await AR.store.putProject(local);
      return { project: local, merged: true, added };
    }
    await AR.store.putProject(incoming);
    return { project: incoming, merged: false, added: incoming.photos.length };
  }

  return { exportZip, importZip };
})();
