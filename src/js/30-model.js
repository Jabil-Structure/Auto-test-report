/* 30-model.js — 資料結構與業務規則（不碰畫面）。
 *
 * Project 資料結構（存成一份 JSON；照片本體另存為 blob，以 blobId 參照）：
 * {
 *   id, name, schema, createdAt, updatedAt,
 *   info: { projectName, codeName, phase, sku, engineer, technician, approval,
 *           testDate, reportDate, revision, lab, labAddress },      // 基本資料（報告英文）
 *   groups: [{ id, name }],                                 // 報告大項（共用一組測試前/後照片的測項群組）
 *   tests: [{ id, libKey, kind:'vib'|'shock', name, sheet, groupId,
 *             purpose, spec, profile, level, equipment, tools,  // 報告文字與表格（英文，可刪改）
 *             subitems: [{ id, axis, dir, name, en, short, setup }] }],
 *   timeline: [subitemId, ...],                             // 分項實際執行順序
 *   nodes: [{ id, after: subitemId|null, createdAt }],      // 拍照節點；after=null 為「測試前」
 *   checklist: [{ id, name, en?, kind:'angle'|'part'|'unsorted', enabled }],
 *   photos: [{ id, nodeId, itemId, blobId, w, h, takenAt, by, note }],
 *            // 架設照（報告 6.1）：nodeId=null, itemId='setup', subitemId
 *   regions: [{ id, angleId, name, rect:{x,y,w,h}, accel, baseNodeId }],  // 母圖裁切框（比例座標 0~1）
 *   regionOverrides: { [photoId]: { [regionId]: rect } },  // 個別照片微調後的框
 *   assignments: { [groupId]: { before, after, include: { [key]: bool } } },
 *   verdicts: { [subitemId]: ''|'pass'|'defect'|'fail'|'skip' },
 *   subNotes: { [subitemId]: { func, note } },             // 報告 5.1 的功能檢查與備註
 *   issues: [{ id, no, subitemId, part, title, desc, severity, status, defectNo, checkItem,
 *              rootCause, suggestion, solution, verifyResult, foundNodeId, refs:[{photoId, regionId}] }],
 *   responses: [{ id, blobId, w, h, name, source, testId, subitemId, accelId, caption, include }],
 *   checkItems: '每行一項，## 開頭為分組',                    // 報告 8.1 檢查清單（全案共用）
 *   config: { table, torque },                              // 報告 4.1、4.2（從 Excel 貼上的表格文字）
 * }
 */
'use strict';

AR.model = (() => {
  const D = AR.DEFAULTS;
  const SCHEMA = 2;

  function newProject(name = '新測試案') {
    const groupId = AR.uid('g_');
    return {
      id: AR.uid('p_'), name, schema: SCHEMA, createdAt: AR.now(), updatedAt: AR.now(),
      info: { revision: 'A01' }, groups: [{ id: groupId, name: '報告大項 1' }], tests: [], timeline: [],
      nodes: [{ id: AR.uid('n_'), after: null, createdAt: AR.now() }],
      checklist: [
        ...D.angles.map((a) => ({ id: a.id, name: a.name, en: a.en, kind: 'angle', enabled: true })),
        ...D.parts.map((n) => ({ id: AR.uid('c_'), name: n, kind: 'part', enabled: true })),
        { id: 'unsorted', name: '未分類（整批上傳）', kind: 'unsorted', enabled: true },
      ],
      photos: [], regions: [], regionOverrides: {}, assignments: {}, verdicts: {}, subNotes: {}, issues: [], responses: [],
      checkItems: D.checkItems, config: { table: '', torque: '' },
    };
  }

  const libOf = (key) => D.testLibrary.find((t) => t.key === key);

  function makeSubitems(kind) {
    const out = [];
    for (const [ax, def] of Object.entries(D.axes)) {
      if (kind === 'vib') out.push({ id: AR.uid('s_'), axis: ax, dir: ax, name: def.label, en: def.en, short: def.short, setup: def.setup });
      else def.faces.forEach((f) => out.push({ id: AR.uid('s_'), axis: ax, dir: f.dir, name: f.name, en: f.en, short: f.short, setup: f.short }));
    }
    return out;
  }

  function makeTest(libKey, groupId) {
    const lib = libOf(libKey) || { ...D.testLibrary[0], key: 'custom', name: 'Custom Test', sheet: 'Custom' };
    return {
      id: AR.uid('t_'), libKey: lib.key, kind: lib.kind, name: lib.name, sheet: lib.sheet, groupId,
      purpose: lib.purpose, spec: lib.spec, profile: lib.profile, level: lib.level, equipment: lib.equipment, tools: lib.tools,
      subitems: makeSubitems(lib.kind),
    };
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
    // 被刪分項的架設照：保留，移到「測試前」節點的未分類
    const first = sortedNodes(p)[0];
    p.photos.forEach((ph) => { if (ph.itemId === 'setup' && ids.has(ph.subitemId)) { ph.itemId = 'unsorted'; ph.nodeId = first.id; delete ph.subitemId; } });
    p.responses.forEach((r) => { if (r.testId === testId) { r.testId = ''; r.subitemId = ''; } });
    ids.forEach((id) => { delete p.verdicts[id]; delete p.subNotes[id]; });
  }

  /** 依軸向重排：同一軸的震動與衝擊排在一起（實驗室實際作法） */
  function regroupByAxis(p) {
    const order = [];
    for (const ax of Object.keys(D.axes)) {
      for (const g of p.groups) {
        p.tests.filter((t) => t.groupId === g.id).forEach((t) =>
          t.subitems.filter((s) => s.axis === ax).forEach((s) => order.push({ s: s.id, g: p.groups.indexOf(g), ax })));
      }
    }
    order.sort((a, b) => a.g - b.g || Object.keys(D.axes).indexOf(a.ax) - Object.keys(D.axes).indexOf(b.ax));
    p.timeline = order.map((o) => o.s);
  }

  /* ---------- 第一版專案升級（schema 1 → 2） ---------- */

  /** 依中文方向字判斷實際方向（第一版的 X 是左右、Y 是前後，與公司慣例相反） */
  function dirFromName(name, kind) {
    const s = String(name || '');
    if (kind === 'vib') return /左右/.test(s) ? 'Y' : /前後/.test(s) ? 'X' : /上下/.test(s) ? 'Z' : null;
    return /（右）/.test(s) ? '+Y' : /（左）/.test(s) ? '-Y' : /（前）/.test(s) ? '+X' : /（後）/.test(s) ? '-X'
      : /（上）/.test(s) ? '+Z' : /（下）/.test(s) ? '-Z' : null;
  }
  function relabel(s, kind) {
    const ax = D.axes[s.axis];
    if (!ax) return;
    if (kind === 'vib') Object.assign(s, { dir: s.axis, name: ax.label, en: ax.en, short: ax.short, setup: ax.setup });
    else {
      const f = ax.faces.find((x) => x.dir === s.dir) || ax.faces[0];
      Object.assign(s, { dir: f.dir, name: f.name, en: f.en, short: f.short, setup: f.short });
    }
  }

  /** 把舊資料補齊成目前的結構（開啟、匯入、合併前都要呼叫；重複呼叫無害） */
  function migrate(p) {
    if (!p) return p;
    const old = (p.schema || 1) < 2;
    p.info = p.info || {};
    if (old) {
      const i = p.info;
      const mv = (from, to) => { if (i[from] && !i[to]) i[to] = i[from]; };
      mv('product', 'projectName'); mv('model', 'codeName'); mv('stage', 'phase'); mv('sampleNo', 'sku');
      if (!i.testDate && (i.startDate || i.endDate)) i.testDate = [i.startDate, i.endDate].filter(Boolean).join(' ~ ');
    }
    if (!p.info.revision) p.info.revision = 'A01';
    for (const t of p.tests || []) {
      if (old) {
        const key = D.legacyTestKeys[t.libKey] || t.libKey;
        const lib = libOf(key);
        if (lib) {
          t.libKey = key;
          // 報告改為英文：中文測項名稱換成測項庫的英文名稱（原名稱保留在 legacyName）
          if (t.name === undefined || /[\u4e00-\u9fff]/.test(t.name)) { t.legacyName = t.name; t.name = lib.name; }
        }
        if (t.text) { t.legacyText = t.text; delete t.text; }
        for (const s of t.subitems) {
          const d = dirFromName(s.name, t.kind);
          if (d) { s.axis = d.replace(/[+-]/, ''); s.dir = d; }
        }
      }
      const lib = libOf(t.libKey) || D.testLibrary.find((x) => x.kind === t.kind) || D.testLibrary[0];
      for (const k of ['sheet', 'purpose', 'spec', 'profile', 'level', 'equipment', 'tools']) if (t[k] === undefined) t[k] = lib[k];
      for (const s of t.subitems) if (old || !s.en) relabel(s, t.kind);
    }
    for (const c of p.checklist || []) if (c.kind === 'angle' && !c.en) c.en = (D.angles.find((a) => a.id === c.id) || {}).en || c.name;
    for (const iss of p.issues || []) {
      for (const k of ['status', 'defectNo', 'checkItem', 'rootCause', 'suggestion', 'solution', 'verifyResult']) if (iss[k] === undefined) iss[k] = '';
      iss.refs = iss.refs || [];
    }
    for (const r of p.responses || []) if (r.accelId === undefined) r.accelId = '';
    p.subNotes = p.subNotes || {};
    if (p.checkItems === undefined) p.checkItems = D.checkItems;
    p.config = p.config || { table: '', torque: '' };
    p.schema = SCHEMA;
    return p;
  }

  /* ---------- 查詢 ---------- */

  const allSubitems = (p) => p.tests.flatMap((t) => t.subitems.map((s) => ({ ...s, test: t })));
  const subitem = (p, id) => allSubitems(p).find((s) => s.id === id);
  const testOf = (p, subId) => p.tests.find((t) => t.subitems.some((s) => s.id === subId));
  const subLabel = (p, id) => { const s = subitem(p, id); return s ? `${s.test.name}｜${s.name}` : '（已刪除的分項）'; };
  /** 測項的分項，依時間軸順序 */
  const orderedSubitems = (p, t) => [...t.subitems].sort((a, b) => p.timeline.indexOf(a.id) - p.timeline.indexOf(b.id));

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
  /** 報告用（英文）節點名稱 */
  const nodeLabelEn = (p, n) => {
    if (typeof n === 'string') n = p.nodes.find((x) => x.id === n);
    if (!n) return '';
    if (!n.after) return 'Pre-test';
    const s = subitem(p, n.after);
    return s ? `After ${s.test.name} - ${s.short}` : 'After (deleted sub-item)';
  };

  const items = (p, kinds = ['angle', 'part']) => p.checklist.filter((c) => kinds.includes(c.kind));
  const enabledItems = (p, kinds) => items(p, kinds).filter((c) => c.enabled);
  const itemName = (p, id) => (p.checklist.find((c) => c.id === id) || {}).name || (id === 'setup' ? '架設照' : '（已刪除）');
  /** 報告用名稱：角度用英文名稱，其他用清單名稱 */
  const itemNameEn = (p, id) => { const c = p.checklist.find((x) => x.id === id); return c ? (c.en || c.name) : ''; };

  const photosOf = (p, nodeId, itemId) => p.photos.filter((ph) => ph.nodeId === nodeId && ph.itemId === itemId);
  const primaryPhoto = (p, nodeId, angleId) => photosOf(p, nodeId, angleId)[0] || null;
  const setupPhotos = (p, subId) => p.photos.filter((ph) => ph.itemId === 'setup' && ph.subitemId === subId);

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
    const noSetup = tests.flatMap((t) => t.subitems).filter((s) => !setupPhotos(p, s.id).length);
    if (noSetup.length) w.push(`有 ${noSetup.length} 個分項沒有架設照（報告 6.1 Testing Setup 會空白）。`);
    return w;
  }

  /* ---------- 判定 ---------- */

  const issuesOf = (p, subId) => p.issues.filter((i) => i.subitemId === subId);
  const verdictWarning = (p, subId) => {
    const v = p.verdicts[subId];
    if ((v === 'fail' || v === 'defect') && !issuesOf(p, subId).length) return '判定有問題，但還沒有連結問題紀錄。';
    if (v === 'pass' && issuesOf(p, subId).length) return '判定無問題，但有問題紀錄掛在這個分項。';
    return '';
  };
  const verdictEn = (v) => (D.verdicts.find((x) => x.value === v) || {}).en || '';

  /** 測項整體結果：fail > defect > pass；有分項未判定時回傳 ''（進行中） */
  function testStatus(p, t) {
    const vs = t.subitems.map((s) => p.verdicts[s.id] || '');
    if (vs.includes('fail')) return 'fail';
    if (vs.includes('defect')) return 'defect';
    if (vs.length && vs.every((v) => v)) return 'pass';
    return '';
  }
  const testProgress = (p, t) => (t.subitems.length ? t.subitems.filter((s) => p.verdicts[s.id]).length / t.subitems.length : 0);

  const renumberIssues = (p) => p.issues.forEach((i, k) => (i.no = k + 1));
  const issueTag = (i) => '#' + String(i.no).padStart(2, '0');

  /* ---------- 表格文字 ---------- */

  /** 「每行一列，欄位用 | 或 Tab 分隔」→ 二維陣列（略過空行） */
  const parseTable = (text) => String(text || '').split(/\r?\n/).filter((l) => l.trim())
    .map((l) => (l.includes('\t') ? l.split('\t') : l.split('|')).map((c) => c.trim()));
  /** 檢查清單文字 → [{ name, group }]（## 開頭為分組標題） */
  const parseCheckItems = (text) => String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    .map((l) => (l.startsWith('##') ? { name: l.replace(/^#+\s*/, ''), group: true } : { name: l, group: false }));

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
    migrate(local); migrate(incoming);
    const unionBy = (a, b, key = 'id') => { const ids = new Set(a.map((x) => x[key])); b.forEach((x) => { if (!ids.has(x[key])) a.push(x); }); };
    const before = local.photos.length;
    unionBy(local.nodes, incoming.nodes);
    unionBy(local.checklist, incoming.checklist);
    unionBy(local.photos, incoming.photos);
    unionBy(local.regions, incoming.regions);
    unionBy(local.issues, incoming.issues);
    unionBy(local.responses, incoming.responses);
    for (const [ph, ov] of Object.entries(incoming.regionOverrides || {})) local.regionOverrides[ph] = { ...ov, ...(local.regionOverrides[ph] || {}) };
    for (const [s, v] of Object.entries(incoming.verdicts || {})) if (!local.verdicts[s]) local.verdicts[s] = v;
    for (const [s, v] of Object.entries(incoming.subNotes || {})) if (!local.subNotes[s]) local.subNotes[s] = v;
    for (const [k, v] of Object.entries(incoming.info || {})) if (!local.info[k]) local.info[k] = v;
    renumberIssues(local);
    return local.photos.length - before;
  }

  return {
    SCHEMA, newProject, makeTest, addTest, removeTest, regroupByAxis, migrate, allSubitems, subitem, testOf, subLabel,
    orderedSubitems, nodePos, sortedNodes, nodeIndex, nodeLabel, nodeLabelEn, items, enabledItems, itemName, itemNameEn,
    photosOf, primaryPhoto, setupPhotos, regionRect, isOverridden, suggestAssignment, assignment, assignmentWarnings,
    issuesOf, verdictWarning, verdictEn, testStatus, testProgress, renumberIssues, issueTag, parseTable, parseCheckItems,
    history, merge,
  };
})();
