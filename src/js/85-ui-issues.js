/* 85-ui-issues.js — 逐分項判定、問題紀錄（報告 Issue Lists 與每個問題一頁的資料來源） */
'use strict';

AR.newIssue = (d = {}) => ({
  id: AR.uid('i_'), subitemId: d.subitemId || '', foundNodeId: d.foundNodeId || '', refs: [], part: '', title: '', desc: '',
  severity: 'N/A', status: 'Record', defectNo: 'N/A', checkItem: '', rootCause: '', suggestion: '', solution: '', verifyResult: '',
});

AR.issueEditor = async (p, iss, isNew) => {
  const M = AR.model, D = AR.DEFAULTS;
  const subOpts = [{ value: '', label: '（請選擇分項）' }, ...p.timeline.map((sid) => ({ value: sid, label: M.subLabel(p, sid) }))];
  const nodeOpts = [{ value: '', label: '（未指定）' }, ...M.sortedNodes(p).map((n) => ({ value: n.id, label: M.nodeLabel(p, n) }))];
  const checkOpts = [{ value: '', label: '（不指定）' }, ...M.parseCheckItems(p.checkItems).filter((x) => !x.group).map((x) => ({ value: x.name, label: x.name }))];
  if (iss.checkItem && !checkOpts.some((o) => o.value === iss.checkItem)) checkOpts.push({ value: iss.checkItem, label: iss.checkItem });
  let pickNode = iss.foundNodeId || M.sortedNodes(p)[0].id;
  const refsBox = h('div', { class: 'thumbs' });
  const pickBox = h('div', { class: 'thumbs' });
  const refKey = (r) => r.photoId + '|' + (r.regionId || '');
  const has = (r) => iss.refs.some((x) => refKey(x) === refKey(r));
  const toggle = (r) => { iss.refs = has(r) ? iss.refs.filter((x) => refKey(x) !== refKey(r)) : [...iss.refs, r]; drawRefs(); drawPick(); };
  const shotEl = async (r, w = 110) => {
    const ph = p.photos.find((x) => x.id === r.photoId);
    if (!ph) return null;
    const url = await AR.blobUrl(ph.blobId);
    const rg = r.regionId && p.regions.find((x) => x.id === r.regionId);
    const el = rg ? AR.img.cropThumb(url, M.regionRect(p, rg, ph.id), ph, { width: w }) : h('img', { src: url, style: { width: w + 'px' } });
    return h('div', { class: 'pv click' + (has(r) ? ' sel' : ''), onclick: async () => toggle(r) }, el,
      h('div', { class: 'small' }, rg ? rg.name : M.itemName(p, ph.itemId)));
  };
  const drawRefs = async () => {
    refsBox.replaceChildren(...(await Promise.all(iss.refs.map((r) => shotEl(r, 130)))).filter(Boolean));
    if (!iss.refs.length) refsBox.append(h('span', { class: 'muted small' }, '尚未選擇照片（從下方點選）'));
  };
  const drawPick = async () => {
    const list = [];
    for (const ph of p.photos.filter((x) => x.nodeId === pickNode)) {
      list.push({ photoId: ph.id });
      p.regions.filter((rg) => rg.angleId === ph.itemId && M.primaryPhoto(p, pickNode, rg.angleId) === ph).forEach((rg) => list.push({ photoId: ph.id, regionId: rg.id }));
    }
    pickBox.replaceChildren(...(await Promise.all(list.map((r) => shotEl(r)))).filter(Boolean));
  };
  const text = (label, key, attrs = {}) => h('label', null, label, h('input', { value: iss[key] || '', ...attrs, oninput: (e) => (iss[key] = e.target.value) }));
  const para = (label, key, rows = 2) => h('label', null, label, h('textarea', { rows, value: iss[key] || '', oninput: (e) => (iss[key] = e.target.value) }));
  const body = h('div', null,
    h('p', { class: 'muted small' }, '報告是英文，問題內容請用英文填寫。'),
    h('div', { class: 'grid2' },
      h('label', null, '所屬分項（Testing Item／Face / Axis）', AR.select(subOpts, iss.subitemId, (v) => (iss.subitemId = v))),
      text('Defect/Failure Part（零件）', 'part', { list: 'partlist' }),
      h('label', null, '對應 8.1 檢查項目（該格會標成 Defect／Fail）', AR.select(checkOpts, iss.checkItem || '', (v) => (iss.checkItem = v))),
      h('label', null, '首次發現的拍照節點', AR.select(nodeOpts, iss.foundNodeId, (v) => (iss.foundNodeId = v))),
      text('Severity（嚴重度）', 'severity', { list: 'sevlist' }),
      text('Issue Status（狀態）', 'status', { list: 'statuslist' }),
      text('Defect Number（缺陷單號）', 'defectNo')),
    h('datalist', { id: 'partlist' }, [...M.items(p, ['part']).map((c) => c.name), ...p.regions.map((r) => r.name)].map((n) => h('option', { value: n }))),
    h('datalist', { id: 'sevlist' }, D.severities.map((n) => h('option', { value: n }))),
    h('datalist', { id: 'statuslist' }, D.issueStatuses.map((n) => h('option', { value: n }))),
    text('Descriptions（問題摘要，會列在 Issue Lists）', 'title'),
    para('詳細描述（問題頁 Descriptions 第二行起）', 'desc', 3),
    h('h3', null, 'Illustrations（問題頁照片）'), refsBox,
    h('label', null, '從這個節點挑照片：', AR.select(nodeOpts.slice(1), pickNode, (v) => { pickNode = v; drawPick(); })),
    pickBox,
    h('details', null, h('summary', null, '分析與對策（Root Cause、Suggestion、Solutions、Verify Result）'),
      para('Root Cause Analysis', 'rootCause'), para('Suggestion & Recommendation', 'suggestion'),
      para('Implemented Solutions', 'solution'), para('Verify Result', 'verifyResult')),
    h('div', { class: 'row end' },
      !isNew && h('button', { class: 'btn danger', onclick: async () => {
        if (!await AR.confirm('刪除這個問題？')) return;
        p.issues = p.issues.filter((x) => x.id !== iss.id); M.renumberIssues(p); AR.save(); m.close(); AR.render();
      } }, '刪除'),
      h('button', { class: 'btn primary', onclick: async () => {
        if (!iss.subitemId) return AR.alert('請選擇問題所屬的分項。');
        if (isNew) { p.issues.push(iss); if (!p.verdicts[iss.subitemId] || p.verdicts[iss.subitemId] === 'pass') p.verdicts[iss.subitemId] = 'defect'; }
        else { const k = p.issues.findIndex((x) => x.id === iss.id); p.issues[k] = iss; }
        M.renumberIssues(p); AR.save(); m.close(); AR.render();
      } }, '儲存')));
  const m = AR.modal(isNew ? '新增問題' : `問題 ${M.issueTag(iss)}`, body, { wide: true });
  drawRefs(); drawPick();
};

AR.views.issues = async (p) => {
  const M = AR.model, D = AR.DEFAULTS;
  if (AR.state.issueDraft) {
    const d = AR.state.issueDraft; AR.state.issueDraft = null;
    setTimeout(() => AR.issueEditor(p, AR.newIssue(d), true), 0);
  }
  const note = (sid) => (p.subNotes[sid] = p.subNotes[sid] || {});
  const verdictTable = h('section', { class: 'panel' },
    h('h2', null, '逐分項判定'),
    h('p', { class: 'muted' }, '每個分項各自判定，會填進報告 5.1 Summary Table 與 8.1 Checklist。記錄問題時，該分項會自動標成 Defect（可改成 Fail）。'),
    p.tests.map((t) => h('div', { class: 'card' }, h('b', null, t.name),
      h('table', { class: 'tbl' },
        h('tr', null, ['分項', '判定', 'Pre/Post-Functional Check', 'Note（備註）', '問題'].map((x) => h('th', null, x))),
        M.orderedSubitems(p, t).map((s) => {
          const warn = M.verdictWarning(p, s.id);
          const iss = M.issuesOf(p, s.id);
          const v = p.verdicts[s.id] || '';
          return h('tr', null,
            h('td', null, s.name, h('div', { class: 'muted small' }, s.en)),
            h('td', null, AR.select(D.verdicts, v, (x) => { p.verdicts[s.id] = x; AR.save(); AR.render(); }, { class: 'v-' + (v || 'none') })),
            h('td', null, h('input', { value: note(s.id).func ?? '', placeholder: v && v !== 'fail' ? 'normal' : '', oninput: (e) => { note(s.id).func = e.target.value; AR.save(); } })),
            h('td', null, h('input', { value: note(s.id).note || '', oninput: (e) => { note(s.id).note = e.target.value; AR.save(); } })),
            h('td', null, iss.map((i) => h('a', { href: '#', onclick: async (e) => { e.preventDefault(); AR.issueEditor(p, AR.clone(i), false); } }, `${M.issueTag(i)} `)),
              warn ? h('span', { class: 'warn-text small' }, '⚠ ' + warn) : null));
        })))),
    h('div', { class: 'row' }, h('button', { class: 'btn small ghost', onclick: async () => {
      if (!await AR.confirm('把所有「未判定」且沒有問題紀錄的分項設為「Pass」？')) return;
      M.allSubitems(p).forEach((s) => { if (!p.verdicts[s.id] && !M.issuesOf(p, s.id).length) p.verdicts[s.id] = 'pass'; });
      AR.save(); AR.render();
    } }, '其餘未判定全部設為 Pass')));

  const issueList = h('section', { class: 'panel' },
    h('h2', null, '問題清單'),
    h('p', { class: 'muted small' }, '報告的 Issue Lists 頁會列出所有問題，並為每個問題產生一頁（#01、#02…）。'),
    p.issues.length ? h('table', { class: 'tbl' },
      h('tr', null, ['#', '分項', '零件', 'Descriptions', 'Severity', 'Status', '照片'].map((x) => h('th', null, x))),
      p.issues.map((i) => h('tr', { class: 'click', onclick: async () => AR.issueEditor(p, AR.clone(i), false) },
        h('td', null, M.issueTag(i)), h('td', null, M.subLabel(p, i.subitemId)), h('td', null, i.part), h('td', null, i.title),
        h('td', null, i.severity), h('td', null, i.status), h('td', null, (i.refs || []).length))))
      : h('p', { class: 'muted' }, '目前沒有問題紀錄。'),
    h('button', { class: 'btn primary', onclick: async () => AR.issueEditor(p, AR.newIssue(), true) }, '＋ 新增問題'));

  return h('div', { class: 'page' }, issueList, verdictTable);
};
