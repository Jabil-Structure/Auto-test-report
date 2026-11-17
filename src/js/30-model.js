/* 30-model.js — 資料結構與業務規則（不碰畫面）。
 *
 * Project 資料結構（存成一份 JSON；照片本體另存為 blob，以 blobId 參照）：
 * {
 *   id, name, schema, createdAt, updatedAt,
 *   info: { reportNo, product, model, ... },               // 基本資料
 *   groups: [{ id, name }],                                 // 報告大項（共用一組測試前/後照片的測項群組）
 *   tests: [{ id, libKey, kind:'vib'|'shock', name, text, groupId,
 *             subitems: [{ id, name, axis }] }],            // 測項與分項
 *   timeline: [subitemId, ...],                             // 分項實際執行順序
 *   nodes: [{ id, after: subitemId|null, createdAt }],      // 拍照節點；after=null 為「測試前」
 *   checklist: [{ id, name, kind:'angle'|'part'|'unsorted', enabled }],
 *   photos: [{ id, nodeId, itemId, blobId, w, h, takenAt, by, note }],
 *   regions: [{ id, angleId, name, rect:{x,y,w,h}, accel, baseNodeId }],  // 母圖裁切框（比例座標 0~1）
 *   regionOverrides: { [photoId]: { [regionId]: rect } },  // 個別照片微調後的框
 *   assignments: { [groupId]: { before, after, include: { [key]: bool } } },
 *   verdicts: { [subitemId]: ''|'pass'|'fail'|'skip' },
 *   issues: [{ id, no, subitemId, part, title, desc, severity, foundNodeId, refs:[{photoId, regionId}] }],
 *   responses: [{ id, blobId, w, h, name, source, testId, subitemId, caption, include }],
 * }
 */
'use strict';

AR.model = (() => {
  const D = AR.DEFAULTS;
  const SCHEMA = 1;

  function newProject(name = '新測試案') {
    const groupId = AR.uid('g_');
    const p = {
      id: AR.uid('p_'), name, schema: SCHEMA, createdAt: AR.now(), updatedAt: AR.now(),
      info: {}, groups: [{ id: groupId, name: '報告大項 1' }], tests: [], timeline: [],
      nodes: [{ id: AR.uid('n_'), after: null, createdAt: AR.now() }],
      checklist: [
        ...D.angles.map((a) => ({ id: a.id, name: a.name, kind: 'angle', enabled: true })),
        ...D.parts.map((n) => ({ id: AR.uid('c_'), name: n, kind: 'part', enabled: true })),
        { id: 'unsorted', name: '未分類（整批上傳）', kind: 'unsorted', enabled: true },
      ],
      photos: [], regions: [], regionOverrides: {}, assignments: {}, verdicts: {}, issues: [], responses: [],
    };
    return p;
  }

  function makeTest(libKey, groupId) {
    const lib = D.testLibrary.find((t) => t.key === libKey) || { key: 'custom', kind: 'vib', name: '自訂測項', text: '' };
    const subitems = [];
    for (const [ax, def] of Object.entries(D.axes)) {
      if (lib.kind === 'vib') subitems.push({ id: AR.uid('s_'), name: def.label, axis: ax });
      else def.faces.forEach((f) => subitems.push({ id: AR.uid('s_'), name: f, axis: ax }));
    }
    return { id: AR.uid('t_'), libKey: lib.key, kind: lib.kind, name: lib.name, text: lib.text, groupId, subitems };
  }

  /** 新增測項：分項接在時間軸最後（同軸放一起） */
  function addTest(p, libKey, groupId) {
    const t = makeTest(libKey, groupId || p.groups[0].id);
    p.tests.push(t);
    for (const ax of Object.keys(D.axes)) t.subitems.filter((s) => s.axis === ax).forEach((s) => p.timeline.push(s.id));
    return t;
  }

  function removeTest(p, testId) {
    const t = p.tests.find((x) => x.id === testId);
    if (!t) return;
    const ids = new Set(t.subitems.map((s) => s.id));
    p.tests = p.tests.filter((x) => x.id !== testId);
    p.timeline = p.timeline.filter((s) => !ids.has(s));
    // 掛在被刪分項後的拍照節點：保留照片，改掛到前一個分項
    p.nodes.forEach((n) => {
      if (n.after && ids.has(n.after)) n.after = p.timeline[p.timeline.length - 1] || null;
    });
    ids.forEach((id) => delete p.verdicts[id]);
  }

  /** 依軸向重排：同一軸的震動與衝擊排在一起（實驗室實際作法） */
  function regroupByAxis(p) {
    const order = [];
    for (const ax of Object.keys(D.axes)) {
      // 同一群組（合併進行）的測項依軸向交錯；不同群組的測項接在後面
      for (const g of p.groups) {
        p.tests.filter((t) => t.groupId === g.id).forEach((t) =>
          t.subitems.filter((s) => s.axis === ax).forEach((s) => order.push({ s: s.id, g: p.groups.indexOf(g), ax })));
      }
    }
    order.sort((a, b) => a.g - b.g || Object.keys(D.axes).indexOf(a.ax) - Object.keys(D.axes).indexOf(b.ax));
    p.timeline = order.map((o) => o.s);
  }

  const allSubitems = (p) => p.tests.flatMap((t) => t.subitems.map((s) => ({ ...s, test: t })));
  const subitem = (p, id) => allSubitems(p).find((s) => s.id === id);
  const testOf = (p, subId) => p.tests.find((t) => t.subitems.some((s) => s.id === subId));
  const subLabel = (p, id) => { const s = subitem(p, id); return s ? `${s.test.name}｜${s.name}` : '（已刪除的分項）'; };

  /** 拍照節點在時間軸的位置：-1 = 測試前 */
  const nodePos = (p, n) => (n.after ? p.timeline.indexOf(n.after) : -1);
  const sortedNodes = (p) => [...p.nodes].sort((a, b) => nodePos(p, a) - nodePos(p, b) || a.createdAt.localeCompare(b.createdAt));
  const nodeIndex = (p, nodeId) => sortedNodes(p).findIndex((n) => n.id === nodeId);
  const nodeLabel = (p, n) => {
    if (typeof n === 'string') n = p.nodes.find((x) => x.id === n);
    if (!n) return '（無）';
    const i = nodeIndex(p, n.id) + 1;
    return n.after ? `#${i} ${subLabel(p, n.after)} 之後` : `#${i} 測試前（初始）`;
  };

  const items = (p, kinds = ['angle', 'part']) => p.checklist.filter((c) => kinds.includes(c.kind));
  const enabledItems = (p, kinds) => items(p, kinds).filter((c) => c.enabled);
  const itemName = (p, id) => (p.checklist.find((c) => c.id === id) || {}).name || '（已刪除）';

  const photosOf = (p, nodeId, itemId) => p.photos.filter((ph) => ph.nodeId === nodeId && ph.itemId === itemId);
  const primaryPhoto = (p, nodeId, angleId) => photosOf(p, nodeId, angleId)[0] || null;

  /** 某張照片上某個框的位置：有微調用微調，沒有就用母框 */
  const regionRect = (p, region, photoId) =>
    (p.regionOverrides[photoId] && p.regionOverrides[photoId][region.id]) || region.rect;
  const isOverridden = (p, region, photoId) => !!(p.regionOverrides[photoId] && p.regionOverrides[photoId][region.id]);

  /** 報告大項建議的測試前／後節點 */
  function suggestAssignment(p, groupId) {
    const subIds = p.tests.filter((t) => t.groupId === groupId).flatMap((t) => t.subitems.map((s) => s.id));
    const idx = subIds.map((id) => p.timeline.indexOf(id)).filter((i) => i >= 0);
    if (!idx.length) return { before: null, after: null };
    const first = Math.min(...idx), last = Math.max(...idx);
    const ns = sortedNodes(p);
    const before = [...ns].reverse().find((n) => nodePos(p, n) < first);
    const after = ns.find((n) => nodePos(p, n) >= last);
    return { before: before ? before.id : null, after: after ? after.id : null };
  }

  function assignment(p, groupId) {
    const sug = suggestAssignment(p, groupId);
    const a = p.assignments[groupId] || {};
    return {
      before: a.before !== undefined ? a.before : sug.before,
      after: a.after !== undefined ? a.after : sug.after,
      include: a.include || {},
      suggested: sug,
    };
  }

  /** 對應不合理時的提醒（只提醒，不阻止） */
  function assignmentWarnings(p, groupId) {
    const w = [];
    const a = assignment(p, groupId);
    const tests = p.tests.filter((t) => t.groupId === groupId);
    if (!tests.length) return ['這個報告大項沒有任何測項。'];
    if (!a.before) w.push('尚未指定測試前照片。');
    if (!a.after) w.push('尚未指定測試後照片（這個大項做完後還沒有拍照節點）。');
    if (a.before && a.after) {
      const pb = nodePos(p, p.nodes.find((n) => n.id === a.before) || {});
      const pa = nodePos(p, p.nodes.find((n) => n.id === a.after) || {});
      if (pa <= pb) w.push('測試後節點不晚於測試前節點，請確認。');
      const subIdx = tests.flatMap((t) => t.subitems).map((s) => p.timeline.indexOf(s.id));
      if (pa < Math.max(...subIdx)) w.push('測試後節點之後還有這個大項的分項，照片可能不是全部做完後拍的。');
      if (pb >= Math.min(...subIdx)) w.push('測試前節點在這個大項的第一個分項之後。');
    }
    if (a.before && a.after) {
      const missing = enabledItems(p, ['angle']).filter((c) => !photosOf(p, a.before, c.id).length || !photosOf(p, a.after, c.id).length);
      if (missing.length) w.push(`有 ${missing.length} 個母圖角度缺少測試前或測試後照片：${missing.map((m) => m.name).join('、')}`);
    }
    return w;
  }

  const issuesOf = (p, subId) => p.issues.filter((i) => i.subitemId === subId);
  const verdictSuggestion = (p, subId) => (issuesOf(p, subId).length ? 'fail' : '');
  const verdictWarning = (p, subId) => {
    const v = p.verdicts[subId];
    if (v === 'fail' && !issuesOf(p, subId).length) return '判定有問題，但還沒有連結問題紀錄。';
    if (v === 'pass' && issuesOf(p, subId).length) return '判定無問題，但有問題紀錄掛在這個分項。';
    return '';
  };

  const renumberIssues = (p) => p.issues.forEach((i, k) => (i.no = k + 1));

  /** 某個項目在各時間點的照片（回顧用）。target: {itemId} 或 {regionId} */
  function history(p, target) {
    return sortedNodes(p).map((n) => {
      if (target.regionId) {
        const r = p.regions.find((x) => x.id === target.regionId);
        const ph = r && primaryPhoto(p, n.id, r.angleId);
        return { node: n, shots: ph ? [{ photo: ph, rect: regionRect(p, r, ph.id) }] : [] };
      }
      return { node: n, shots: photosOf(p, n.id, target.itemId).map((ph) => ({ photo: ph, rect: null })) };
    });
  }

  /** 合併另一份專案（多人各自拍照後合併）：以 id 聯集，不覆蓋本機已有的資料 */
  function merge(local, incoming) {
    const unionBy = (a, b, key = 'id') => { const ids = new Set(a.map((x) => x[key])); b.forEach((x) => { if (!ids.has(x[key])) a.push(x); }); };
    let added = 0;
    const before = local.photos.length;
    unionBy(local.nodes, incoming.nodes);
    unionBy(local.checklist, incoming.checklist);
    unionBy(local.photos, incoming.photos);
    unionBy(local.regions, incoming.regions);
    unionBy(local.issues, incoming.issues);
    unionBy(local.responses, incoming.responses);
    for (const [ph, ov] of Object.entries(incoming.regionOverrides || {})) local.regionOverrides[ph] = { ...ov, ...(local.regionOverrides[ph] || {}) };
    for (const [s, v] of Object.entries(incoming.verdicts || {})) if (!local.verdicts[s]) local.verdicts[s] = v;
    for (const [k, v] of Object.entries(incoming.info || {})) if (!local.info[k]) local.info[k] = v;
    renumberIssues(local);
    added = local.photos.length - before;
    return added;
  }

  return {
    SCHEMA, newProject, makeTest, addTest, removeTest, regroupByAxis, allSubitems, subitem, testOf, subLabel,
    nodePos, sortedNodes, nodeIndex, nodeLabel, items, enabledItems, itemName, photosOf, primaryPhoto,
    regionRect, isOverridden, suggestAssignment, assignment, assignmentWarnings, issuesOf, verdictSuggestion,
    verdictWarning, renumberIssues, history, merge,
  };
})();
