/* 83-ui-crop.js — 母圖框選裁切：一張母圖畫多個框，其他節點同角度照片自動套用同一組框，可個別微調。 */
'use strict';

AR.views.crop = async (p) => {
  const M = AR.model;
  const S = AR.state.sub;
  const angles = M.enabledItems(p, ['angle']);
  const nodesWith = (aid) => M.sortedNodes(p).filter((n) => M.primaryPhoto(p, n.id, aid));
  if (!S.angleId || !angles.some((a) => a.id === S.angleId)) {
    const withPhotos = angles.filter((a) => nodesWith(a.id).length);
    const byRegions = [...withPhotos].sort((a, b) => p.regions.filter((r) => r.angleId === b.id).length - p.regions.filter((r) => r.angleId === a.id).length);
    S.angleId = (byRegions[0] || angles[0] || {}).id;
  }
  const nodeList = S.angleId ? nodesWith(S.angleId) : [];
  if (!nodeList.some((n) => n.id === S.nodeId)) S.nodeId = nodeList[0] && nodeList[0].id;
  const rerender = () => { AR.save(); AR.render(); };

  const head = h('section', { class: 'panel' },
    h('h2', null, '母圖框選裁切'),
    h('p', { class: 'muted' }, '在一張母圖上畫多個框，每個框就是一個零件的特寫；勾選「加速規」的框會在報告中以紅框加箭頭標示。框會自動套用到其他節點同角度的照片，位置跑掉時直接拖曳微調（只改那一張）。原始照片不會被修改。'),
    h('div', { class: 'grid2' },
      h('label', null, '角度（母圖）', AR.select(angles.map((a) => ({ value: a.id, label: `${a.name}（${p.regions.filter((r) => r.angleId === a.id).length} 框）` })), S.angleId, (v) => { S.angleId = v; S.sel = null; rerender(); })),
      h('label', null, '拍照節點', AR.select(nodeList.map((n) => ({ value: n.id, label: M.nodeLabel(p, n) })), S.nodeId, (v) => { S.nodeId = v; rerender(); }))));

  if (!S.nodeId) return h('div', { class: 'page' }, head, h('p', { class: 'muted' }, '這個角度還沒有照片。'));

  const ph = M.primaryPhoto(p, S.nodeId, S.angleId);
  const url = await AR.blobUrl(ph.blobId);
  const regions = p.regions.filter((r) => r.angleId === S.angleId);
  const editsBase = (r) => r.baseNodeId === S.nodeId;
  const getRect = (r) => M.regionRect(p, r, ph.id);
  const setRect = (r, rect) => {
    if (editsBase(r)) r.rect = rect;
    else (p.regionOverrides[ph.id] = p.regionOverrides[ph.id] || {})[r.id] = rect;
  };

  // ---- 編輯區 ----
  const stage = h('div', { class: 'stage' + (S.draw ? ' drawing' : '') });
  const img = h('img', { src: url, draggable: 'false' });
  stage.appendChild(img);
  if (S.ghost && S.ghost !== S.nodeId) {
    const gph = M.primaryPhoto(p, S.ghost, S.angleId);
    if (gph) stage.appendChild(h('img', { class: 'ghost', src: await AR.blobUrl(gph.blobId), style: { opacity: S.ghostOpacity ?? 0.5 } }));
  }
  const boxEls = new Map();
  const place = (el, r) => Object.assign(el.style, { left: r.x * 100 + '%', top: r.y * 100 + '%', width: r.w * 100 + '%', height: r.h * 100 + '%' });
  regions.forEach((r) => {
    const el = h('div', { class: 'rbox' + (r.accel ? ' accel' : '') + (S.sel === r.id ? ' sel' : '') + (M.isOverridden(p, r, ph.id) ? ' over' : ''), 'data-id': r.id },
      h('span', { class: 'rlabel' }, r.name), S.sel === r.id ? h('span', { class: 'handle' }) : null);
    place(el, getRect(r));
    boxEls.set(r.id, el);
    stage.appendChild(el);
  });

  const clamp = (v) => Math.min(1, Math.max(0, v));
  let drag = null;
  const pt = (e) => { const b = stage.getBoundingClientRect(); return { x: clamp((e.clientX - b.left) / b.width), y: clamp((e.clientY - b.top) / b.height) }; };
  stage.addEventListener('pointerdown', (e) => {
    const p0 = pt(e);
    const boxEl = e.target.closest('.rbox');
    if (S.draw) {
      const el = h('div', { class: 'rbox sel' }); stage.appendChild(el);
      drag = { mode: 'draw', p0, el, rect: { x: p0.x, y: p0.y, w: 0, h: 0 } };
    } else if (e.target.classList.contains('handle')) {
      const r = regions.find((x) => x.id === S.sel);
      drag = { mode: 'resize', r, p0, start: { ...getRect(r) }, el: boxEls.get(r.id) };
    } else if (boxEl) {
      const r = regions.find((x) => x.id === boxEl.dataset.id);
      if (S.sel !== r.id) { S.sel = r.id; AR.render(); return; }
      drag = { mode: 'move', r, p0, start: { ...getRect(r) }, el: boxEl };
    } else return;
    stage.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const q = pt(e), dx = q.x - drag.p0.x, dy = q.y - drag.p0.y, s = drag.start;
    if (drag.mode === 'draw') drag.rect = { x: Math.min(q.x, drag.p0.x), y: Math.min(q.y, drag.p0.y), w: Math.abs(dx), h: Math.abs(dy) };
    if (drag.mode === 'move') drag.rect = { ...s, x: clamp(Math.min(s.x + dx, 1 - s.w)), y: clamp(Math.min(s.y + dy, 1 - s.h)) };
    if (drag.mode === 'resize') drag.rect = { ...s, w: Math.max(0.01, Math.min(s.w + dx, 1 - s.x)), h: Math.max(0.01, Math.min(s.h + dy, 1 - s.y)) };
    place(drag.el, drag.rect);
  });
  stage.addEventListener('pointerup', async () => {
    if (!drag) return;
    const d = drag; drag = null;
    if (!d.rect) return;
    if (d.mode === 'draw') {
      if (d.rect.w < 0.01 || d.rect.h < 0.01) { d.el.remove(); return; }
      const name = await AR.prompt('這個框是哪個零件？', '');
      if (!name) { d.el.remove(); return; }
      const r = { id: AR.uid('r_'), angleId: S.angleId, name, rect: d.rect, accel: /加速規|acc/i.test(name), baseNodeId: S.nodeId };
      p.regions.push(r); S.sel = r.id; S.draw = false;
    } else setRect(d.r, d.rect);
    rerender();
  });

  // ---- 選取中的框 ----
  const sel = regions.find((r) => r.id === S.sel);
  const selPanel = sel ? h('div', { class: 'card' },
    h('div', { class: 'row wrap' },
      h('input', { class: 'grow', value: sel.name, oninput: (e) => { sel.name = e.target.value; AR.save(); } }),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: sel.accel, onchange: (e) => { sel.accel = e.target.checked; rerender(); } }), '加速規')),
    h('div', { class: 'muted small' }, editsBase(sel) ? '這是母框所在的照片：拖曳會改母框，所有未微調的照片跟著變。'
      : M.isOverridden(p, sel, ph.id) ? '這張照片已個別微調。' : '目前套用母框位置；拖曳只會改這一張。'),
    h('div', { class: 'row wrap' },
      !editsBase(sel) && M.isOverridden(p, sel, ph.id) && h('button', { class: 'btn small', onclick: async () => { delete p.regionOverrides[ph.id][sel.id]; rerender(); } }, '重設為母框位置'),
      !editsBase(sel) && h('button', { class: 'btn small ghost', onclick: async () => { sel.rect = { ...getRect(sel) }; sel.baseNodeId = S.nodeId; if (p.regionOverrides[ph.id]) delete p.regionOverrides[ph.id][sel.id]; rerender(); } }, '把這張設為母框'),
      h('button', { class: 'btn small ghost danger', onclick: async () => {
        if (!await AR.confirm(`刪除框「${sel.name}」？`)) return;
        p.regions = p.regions.filter((r) => r !== sel);
        Object.values(p.regionOverrides).forEach((o) => delete o[sel.id]);
        p.issues.forEach((i) => (i.refs = (i.refs || []).filter((x) => x.regionId !== sel.id)));
        S.sel = null; rerender();
      } }, '刪除框'))) : null;

  const tools = h('div', { class: 'row wrap' },
    h('button', { class: 'btn ' + (S.draw ? 'primary' : ''), onclick: async () => { S.draw = !S.draw; S.sel = null; AR.render(); } }, S.draw ? '✏️ 畫框中（在照片上拖曳）' : '＋ 新增框'),
    h('label', { class: 'inline' }, '疊圖比對 ', AR.select([{ value: '', label: '不疊圖' }, ...nodeList.filter((n) => n.id !== S.nodeId).map((n) => ({ value: n.id, label: M.nodeLabel(p, n) }))], S.ghost || '', (v) => { S.ghost = v; AR.render(); })),
    S.ghost ? h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: S.ghostOpacity ?? 0.5, oninput: (e) => { S.ghostOpacity = +e.target.value; const g = stage.querySelector('.ghost'); if (g) g.style.opacity = e.target.value; } }) : null);

  const previews = h('div', { class: 'thumbs' }, regions.map((r) => h('div', { class: 'pv' + (S.sel === r.id ? ' sel' : ''), onclick: async () => { S.sel = r.id; AR.render(); } },
    AR.img.cropThumb(url, getRect(r), ph, { width: 130 }), h('div', { class: 'small' }, (r.accel ? '🔴 ' : '') + r.name))));

  return h('div', { class: 'page' }, head,
    h('section', { class: 'panel' }, tools, stage, selPanel, h('h3', null, '這張照片裁出來的特寫'), regions.length ? previews : h('p', { class: 'muted' }, '還沒有框。按「新增框」後在照片上拖曳。')));
};
