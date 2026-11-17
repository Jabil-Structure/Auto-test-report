/* 85-ui-issues.js — 逐分項判定、問題紀錄（問題清單與問題說明頁的資料來源） */
'use strict';

AR.issueEditor = async (p, iss, isNew) => {
  const M = AR.model, D = AR.DEFAULTS;
  const subOpts = [{ value: '', label: '（請選擇分項）' }, ...p.timeline.map((sid) => ({ value: sid, label: M.subLabel(p, sid) }))];
  const nodeOpts = [{ value: '', label: '（未指定）' }, ...M.sortedNodes(p).map((n) => ({ value: n.id, label: M.nodeLabel(p, n) }))];
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
  const body = h('div', null,
    h('div', { class: 'grid2' },
      h('label', null, '所屬分項', AR.select(subOpts, iss.subitemId, (v) => (iss.subitemId = v))),
      h('label', null, '零件', h('input', { value: iss.part || '', list: 'partlist', oninput: (e) => (iss.part = e.target.value) })),
      h('label', null, '首次發現的拍照節點', AR.select(nodeOpts, iss.foundNodeId, (v) => (iss.foundNodeId = v))),
      h('label', null, '嚴重度', AR.select([{ value: '', label: '—' }, ...D.severities.map((s) => ({ value: s, label: s }))], iss.severity, (v) => (iss.severity = v)))),
    h('datalist', { id: 'partlist' }, [...M.items(p, ['part']).map((c) => c.name), ...p.regions.map((r) => r.name)].map((n) => h('option', { value: n }))),
    h('label', null, '問題摘要', h('input', { value: iss.title || '', oninput: (e) => (iss.title = e.target.value) })),
    h('label', null, '問題描述（問題說明頁內容）', h('textarea', { rows: 4, value: iss.desc || '', oninput: (e) => (iss.desc = e.target.value) })),
    h('h3', null, '問題頁照片'), refsBox,
    h('label', null, '從這個節點挑照片：', AR.select(nodeOpts.slice(1), pickNode, (v) => { pickNode = v; drawPick(); })),
    pickBox,
    h('div', { class: 'row end' },
      !isNew && h('button', { class: 'btn danger', onclick: async () => {
        if (!await AR.confirm('刪除這個問題？')) return;
        p.issues = p.issues.filter((x) => x.id !== iss.id); M.renumberIssues(p); AR.save(); m.close(); AR.render();
      } }, '刪除'),
      h('button', { class: 'btn primary', onclick: async () => {
        if (!iss.subitemId) return AR.alert('請選擇問題所屬的分項。');
        if (isNew) { p.issues.push(iss); if (!p.verdicts[iss.subitemId]) p.verdicts[iss.subitemId] = 'fail'; }
        else { const k = p.issues.findIndex((x) => x.id === iss.id); p.issues[k] = iss; }
        M.renumberIssues(p); AR.save(); m.close(); AR.render();
      } }, '儲存')));
  const m = AR.modal(isNew ? '新增問題' : `問題 #${iss.no}`, body, { wide: true });
  drawRefs(); drawPick();
};

AR.views.issues = async (p) => {
  const M = AR.model, D = AR.DEFAULTS;
  if (AR.state.issueDraft) {
    const d = AR.state.issueDraft; AR.state.issueDraft = null;
    setTimeout(() => AR.issueEditor(p, { id: AR.uid('i_'), subitemId: d.subitemId || '', foundNodeId: d.foundNodeId || '', refs: [], part: '', title: '', desc: '', severity: '' }, true), 0);
  }
  const verdictTable = h('section', { class: 'panel' },
    h('h2', null, '逐分項判定'),
    h('p', { class: 'muted' }, '每個分項各自判定。記錄問題時，該分項會自動標成「有問題」。'),
    p.tests.map((t) => h('div', { class: 'card' }, h('b', null, t.name),
      h('table', { class: 'tbl' }, t.subitems.map((s) => {
        const warn = M.verdictWarning(p, s.id);
        const iss = M.issuesOf(p, s.id);
        return h('tr', null,
          h('td', null, s.name),
          h('td', null, AR.select(D.verdicts, p.verdicts[s.id] || '', (v) => { p.verdicts[s.id] = v; AR.save(); AR.render(); }, { class: 'v-' + (p.verdicts[s.id] || 'none') })),
          h('td', null, iss.map((i) => h('a', { href: '#', onclick: async (e) => { e.preventDefault(); AR.issueEditor(p, AR.clone(i), false); } }, `#${i.no} `)),
            warn ? h('span', { class: 'warn-text small' }, '⚠ ' + warn) : null));
      })))),
    h('div', { class: 'row' }, h('button', { class: 'btn small ghost', onclick: async () => {
      if (!await AR.confirm('把所有「未判定」且沒有問題紀錄的分項設為「無問題」？')) return;
      M.allSubitems(p).forEach((s) => { if (!p.verdicts[s.id] && !M.issuesOf(p, s.id).length) p.verdicts[s.id] = 'pass'; });
      AR.save(); AR.render();
    } }, '其餘未判定全部設為無問題')));

  const issueList = h('section', { class: 'panel' },
    h('h2', null, '問題清單 ', h('span', { class: 'tag warn' }, '問題頁格式暫定，待範本')),
    p.issues.length ? h('table', { class: 'tbl' },
      h('tr', null, ['#', '分項', '零件', '摘要', '嚴重度', '首次發現', '照片'].map((x) => h('th', null, x))),
      p.issues.map((i) => h('tr', { class: 'click', onclick: async () => AR.issueEditor(p, AR.clone(i), false) },
        h('td', null, i.no), h('td', null, M.subLabel(p, i.subitemId)), h('td', null, i.part), h('td', null, i.title),
        h('td', null, i.severity), h('td', null, i.foundNodeId ? M.nodeLabel(p, i.foundNodeId) : ''), h('td', null, (i.refs || []).length))))
      : h('p', { class: 'muted' }, '目前沒有問題紀錄。'),
    h('button', { class: 'btn primary', onclick: async () => AR.issueEditor(p, { id: AR.uid('i_'), subitemId: '', foundNodeId: '', refs: [], part: '', title: '', desc: '', severity: '' }, true) }, '＋ 新增問題'));

  return h('div', { class: 'page' }, issueList, verdictTable);
};
