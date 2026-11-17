/* 82-ui-timeline.js — 分項時間軸、拍照節點、現場拍照歸位、各分項架設照 */
'use strict';

AR.TEST_COLORS = ['#2563eb', '#d97706', '#059669', '#7c3aed', '#db2777', '#0891b2'];

/** 存入照片。extra：額外欄位（例如架設照的 subitemId） */
AR.addPhotos = async (p, nodeId, itemId, files, extra = {}) => {
  const busy = files.length > 2 ? AR.busy(`存入 ${files.length} 張照片…`) : null;
  try {
    for (const f of files) {
      const blobId = await AR.store.putBlob(f);
      let w = 0, hh = 0;
      try { ({ w, h: hh } = await AR.img.sizeOfBlob(f)); } catch (e) { /* 無法解碼的格式（例如部分 HEIC） */ }
      p.photos.push({ id: AR.uid('ph_'), nodeId, itemId, blobId, w, h: hh, takenAt: AR.now(), by: AR.state.user || '', note: '', ...extra });
    }
  } finally { busy && busy.close(); }
  AR.save();
};

/** 大圖檢視：移動、備註、刪除 */
AR.photoViewer = async (p, ph, onChange) => {
  const M = AR.model;
  const url = await AR.blobUrl(ph.blobId);
  const isSetup = ph.itemId === 'setup';
  const done = () => { AR.save(); m.close(); onChange && onChange(); };
  const where = isSetup
    ? h('label', null, '所屬分項（報告 6.1 Testing Setup）', AR.select(p.timeline.map((sid) => ({ value: sid, label: M.subLabel(p, sid) })), ph.subitemId, (v) => { ph.subitemId = v; done(); }))
    : h('div', { class: 'grid2' },
      h('label', null, '歸到清單項目', AR.select(M.items(p, ['angle', 'part', 'unsorted']).map((c) => ({ value: c.id, label: c.name })), ph.itemId, (v) => { ph.itemId = v; done(); })),
      h('label', null, '歸到拍照節點', AR.select(M.sortedNodes(p).map((n) => ({ value: n.id, label: M.nodeLabel(p, n) })), ph.nodeId, (v) => { ph.nodeId = v; done(); })));
  const title = isSetup ? `架設照｜${M.subLabel(p, ph.subitemId)}` : `${M.itemName(p, ph.itemId)}｜${M.nodeLabel(p, ph.nodeId)}`;
  const m = AR.modal(title, h('div', null,
    h('img', { class: 'big', src: url }),
    ph.w ? null : h('p', { class: 'warn-text' }, '這張照片格式無法在瀏覽器顯示（可能是 HEIC），建議手機相機改用「最相容」格式。'),
    where,
    h('label', null, '備註（報告中會當成照片說明，例如 L／M／R）', h('input', { value: ph.note || '', oninput: (e) => { ph.note = e.target.value; AR.save(); } })),
    h('div', { class: 'muted small' }, `拍攝/加入時間：${AR.fmtTime(ph.takenAt)}　${ph.w}×${ph.h}`),
    h('div', { class: 'row end' }, h('button', { class: 'btn danger', onclick: async () => {
      if (!await AR.confirm('刪除這張照片？')) return;
      p.photos = p.photos.filter((x) => x !== ph);
      delete p.regionOverrides[ph.id];
      p.issues.forEach((i) => (i.refs = (i.refs || []).filter((r) => r.photoId !== ph.id)));
      await AR.store.deleteBlob(ph.blobId);
      done();
    } }, '刪除照片'))), { wide: true });
};

AR.thumb = async (p, ph, onChange) => {
  const url = await AR.blobUrl(ph.blobId);
  return h('img', { class: 'thumb', src: url, loading: 'lazy', title: ph.note || '', onclick: async () => AR.photoViewer(p, ph, onChange) });
};

/** 某個分項的架設照（UUT 固定在震動台／衝擊台上的照片，報告 6.1） */
AR.setupPhotoModal = (p, subId) => {
  const M = AR.model;
  const box = h('div');
  const m = AR.modal(`架設照｜${M.subLabel(p, subId)}`, box, { wide: true });
  const draw = async () => {
    const list = M.setupPhotos(p, subId);
    box.replaceChildren(
      h('p', { class: 'muted small' }, '每個分項（每一面／每一軸）拍一張 UUT 與控制加速規的架設照，報告 6.1 Testing Setup 會自動帶入。可以多張。'),
      h('div', { class: 'thumbs' }, list.length ? await Promise.all(list.map((ph) => AR.thumb(p, ph, () => { draw(); AR.render(); })))
        : h('span', { class: 'muted small' }, '還沒有架設照。')),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', onclick: async () => { const fs = await AR.pickFiles({ capture: 'environment' }); if (fs.length) { await AR.addPhotos(p, null, 'setup', fs, { subitemId: subId }); draw(); AR.render(); } } }, '📷 拍照'),
        h('button', { class: 'btn', onclick: async () => { const fs = await AR.pickFiles({ multiple: true }); if (fs.length) { await AR.addPhotos(p, null, 'setup', fs, { subitemId: subId }); draw(); AR.render(); } } }, '🖼 選照片'),
        h('span', { class: 'grow' }),
        h('button', { class: 'btn ghost', onclick: () => m.close() }, '完成')));
  };
  draw();
};

AR.views.timeline = async (p) => {
  if (AR.state.sub.nodeId) return AR.views.node(p, AR.state.sub.nodeId);
  const M = AR.model;
  const rerender = () => { AR.save(); AR.render(); };
  const color = (t) => AR.TEST_COLORS[p.tests.indexOf(t) % AR.TEST_COLORS.length];
  const totalItems = M.enabledItems(p, ['angle', 'part']).length;

  const nodeCard = (n) => {
    const photos = p.photos.filter((x) => x.nodeId === n.id);
    const done = new Set(photos.map((x) => x.itemId)).size;
    return h('div', { class: 'node click', onclick: async () => { AR.state.sub = { nodeId: n.id }; AR.render(); } },
      h('div', null, h('b', null, '📷 ' + M.nodeLabel(p, n))),
      h('div', { class: 'muted small' }, `${photos.length} 張照片｜清單 ${done}/${totalItems} 項已拍`),
      n.after && h('button', { class: 'btn ghost small danger', onclick: async (e) => {
        e.stopPropagation();
        if (photos.length && !await AR.confirm(`這個節點有 ${photos.length} 張照片，刪除節點會一併刪除照片。確定？`)) return;
        p.photos = p.photos.filter((x) => x.nodeId !== n.id);
        p.nodes = p.nodes.filter((x) => x !== n);
        Object.values(p.assignments).forEach((a) => { if (a.before === n.id) delete a.before; if (a.after === n.id) delete a.after; });
        rerender();
      } }, '刪除節點'));
  };
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= p.timeline.length) return; [p.timeline[i], p.timeline[j]] = [p.timeline[j], p.timeline[i]]; rerender(); };

  const rows = [];
  p.nodes.filter((n) => !n.after).forEach((n) => rows.push(nodeCard(n)));
  p.timeline.forEach((sid, i) => {
    const s = M.subitem(p, sid);
    if (!s) return;
    const v = p.verdicts[sid];
    const nSetup = M.setupPhotos(p, sid).length;
    rows.push(h('div', { class: 'step' },
      h('span', { class: 'dot', style: { background: color(s.test) } }),
      h('span', { class: 'grow' }, h('span', { class: 'muted small' }, `${i + 1}. ${s.test.name}　`), h('b', null, s.name),
        v === 'fail' ? h('span', { class: 'tag bad' }, 'Fail') : v === 'defect' ? h('span', { class: 'tag warn' }, 'Defect') : v === 'pass' ? h('span', { class: 'tag ok' }, 'Pass') : null,
        M.issuesOf(p, sid).length ? h('span', { class: 'tag bad' }, `問題 ${M.issuesOf(p, sid).length}`) : null),
      h('button', { class: 'btn small' + (nSetup ? '' : ' ghost'), title: '這個分項的架設照（報告 6.1）', onclick: async () => AR.setupPhotoModal(p, sid) }, nSetup ? `🔧 架設照 ${nSetup}` : '🔧 架設照'),
      h('button', { class: 'btn ghost small', title: '往前', onclick: async () => move(i, -1) }, '↑'),
      h('button', { class: 'btn ghost small', title: '往後', onclick: async () => move(i, 1) }, '↓')));
    const ns = M.sortedNodes(p).filter((n) => n.after === sid);
    ns.forEach((n) => rows.push(nodeCard(n)));
    if (!ns.length) rows.push(h('button', { class: 'btn addnode', onclick: async () => {
      const n = { id: AR.uid('n_'), after: sid, createdAt: AR.now() };
      p.nodes.push(n); AR.save(); AR.state.sub = { nodeId: n.id }; AR.render();
    } }, '＋ 在這裡拍一組照片'));
  });

  return h('div', { class: 'page' },
    h('section', { class: 'panel' },
      h('h2', null, '分項時間軸'),
      h('p', { class: 'muted' }, '依實際執行順序排列（可用 ↑↓ 調整）。在任何分項後面都可以拍一組照片；前一組的測試後照片就是下一個分項的測試前照片。每一組都會完整留存，供之後回頭找問題是哪個階段產生的。每個分項另有「架設照」，放進報告 6.1。'),
      p.timeline.length ? null : h('p', { class: 'warn-text' }, '還沒有測項，請到「基本資料與測項」加入。'),
      h('div', { class: 'legend' }, p.tests.map((t) => h('span', null, h('span', { class: 'dot', style: { background: color(t) } }), t.name))),
      h('div', { class: 'timeline' }, rows)));
};

/** 單一拍照節點：照清單逐格拍照 */
AR.views.node = async (p, nodeId) => {
  const M = AR.model;
  const n = p.nodes.find((x) => x.id === nodeId);
  if (!n) { AR.state.sub = {}; return AR.views.timeline(p); }
  const rerender = () => AR.render();
  const ns = M.sortedNodes(p);
  const prev = ns[ns.findIndex((x) => x.id === nodeId) - 1];
  const items = M.enabledItems(p, ['angle', 'part']);
  const unsorted = M.photosOf(p, nodeId, 'unsorted');
  const done = items.filter((c) => M.photosOf(p, nodeId, c.id).length).length;
  const onlyMissing = AR.state.sub.onlyMissing;

  const itemRow = async (c) => {
    const photos = M.photosOf(p, nodeId, c.id);
    if (onlyMissing && photos.length) return null;
    const ref = prev && M.photosOf(p, prev.id, c.id)[0];
    return h('div', { class: 'item' + (photos.length ? ' done' : '') },
      h('div', { class: 'item-head' },
        h('b', null, (photos.length ? '✅ ' : '⬜ ') + c.name),
        h('span', { class: 'muted small' }, photos.length ? `${photos.length} 張` : '未拍')),
      h('div', { class: 'thumbs' },
        ref && h('div', { class: 'refwrap', title: '上一組的照片（參考角度）' }, h('img', { class: 'thumb ref', src: await AR.blobUrl(ref.blobId) }), h('span', null, '上一組')),
        await Promise.all(photos.map((ph) => AR.thumb(p, ph, rerender)))),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', onclick: async () => { const fs = await AR.pickFiles({ capture: 'environment' }); if (fs.length) { await AR.addPhotos(p, nodeId, c.id, fs); rerender(); } } }, '📷 拍照'),
        h('button', { class: 'btn', onclick: async () => { const fs = await AR.pickFiles({ multiple: true }); if (fs.length) { await AR.addPhotos(p, nodeId, c.id, fs); rerender(); } } }, '🖼 選照片')));
  };

  return h('div', { class: 'page' },
    h('div', { class: 'row wrap sticky' },
      h('button', { class: 'btn ghost', onclick: async () => { AR.state.sub = {}; AR.render(); } }, '← 時間軸'),
      h('b', { class: 'grow' }, M.nodeLabel(p, n)),
      h('span', { class: 'tag' }, `清單 ${done}/${items.length}`)),
    h('div', { class: 'row wrap' },
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!onlyMissing, onchange: (e) => { AR.state.sub.onlyMissing = e.target.checked; rerender(); } }), '只顯示未拍'),
      h('button', { class: 'btn small', onclick: async () => { const fs = await AR.pickFiles({ multiple: true }); if (fs.length) { await AR.addPhotos(p, nodeId, 'unsorted', fs); rerender(); } } }, '整批上傳（先放未分類）'),
      h('button', { class: 'btn small', onclick: async () => {
        const busy = AR.busy('打包中…');
        let blob; try { blob = await AR.pkg.exportZip(p); } finally { busy.close(); }
        await AR.shareOrDownload(blob, `${AR.safeName(p.name)}_專案檔.zip`);
      } }, '📤 存到 OneDrive（分享專案檔）'),
      h('button', { class: 'btn small', onclick: async () => { AR.state.issueDraft = { foundNodeId: nodeId, subitemId: n.after || '' }; AR.go('project', 'issues'); } }, '⚠ 在現場記錄問題')),
    unsorted.length ? h('section', { class: 'panel' }, h('h3', null, `未分類（${unsorted.length}）`), h('p', { class: 'muted small' }, '點照片選擇要歸到哪個項目。'),
      h('div', { class: 'thumbs' }, await Promise.all(unsorted.map((ph) => AR.thumb(p, ph, rerender))))) : null,
    h('h3', null, '固定母圖角度'),
    (await Promise.all(M.enabledItems(p, ['angle']).map(itemRow))).filter(Boolean),
    h('h3', null, '零件'),
    (await Promise.all(M.enabledItems(p, ['part']).map(itemRow))).filter(Boolean));
};
