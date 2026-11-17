/* 87-ui-report.js — 出報告前：指定每個報告大項的測試前／後照片、勾選要放的照片，產生 Excel */
'use strict';

AR.views.report = async (p) => {
  const M = AR.model;
  const rerender = () => { AR.save(); AR.render(); };
  const nodeOpts = [{ value: '', label: '（不指定）' }, ...M.sortedNodes(p).map((n) => ({ value: n.id, label: M.nodeLabel(p, n) }))];

  const groupPanels = p.groups.filter((g) => p.tests.some((t) => t.groupId === g.id)).map((g) => {
    const a = M.assignment(p, g.id);
    const st = (p.assignments[g.id] = p.assignments[g.id] || {});
    const warns = M.assignmentWarnings(p, g.id);
    const inc = (key) => a.include[key] !== false;
    const setInc = (key, v) => { st.include = st.include || {}; st.include[key] = v; AR.save(); };
    const has = (itemId) => (a.before && M.photosOf(p, a.before, itemId).length) || (a.after && M.photosOf(p, a.after, itemId).length);
    const chk = (key, label, avail) => h('label', { class: 'check' + (avail ? '' : ' dim') }, h('input', { type: 'checkbox', checked: inc(key), onchange: (e) => setInc(key, e.target.checked) }), label + (avail ? '' : '（無照片）'));
    const sugTag = (k) => (a[k] === a.suggested[k] ? h('span', { class: 'tag ok' }, '系統建議') : h('span', { class: 'tag' }, '手動指定'));
    return h('section', { class: 'panel' },
      h('h2', null, g.name),
      h('div', { class: 'muted small' }, '包含：' + p.tests.filter((t) => t.groupId === g.id).map((t) => t.name).join('、')),
      h('div', { class: 'grid2' },
        h('label', null, h('span', null, '測試前照片 ', sugTag('before')), AR.select(nodeOpts, a.before || '', (v) => { st.before = v || null; rerender(); })),
        h('label', null, h('span', null, '測試後照片 ', sugTag('after')), AR.select(nodeOpts, a.after || '', (v) => { st.after = v || null; rerender(); }))),
      (st.before !== undefined || st.after !== undefined) && h('button', { class: 'btn small ghost', onclick: async () => { delete st.before; delete st.after; rerender(); } }, '恢復系統建議'),
      warns.length ? h('ul', { class: 'warns' }, warns.map((w) => h('li', null, '⚠ ' + w))) : h('p', { class: 'ok-text' }, '✓ 對應看起來合理'),
      h('details', null, h('summary', null, '要放進報告的照片'),
        h('h4', null, '母圖'), h('div', { class: 'checks' }, M.enabledItems(p, ['angle']).map((c) => chk('item:' + c.id, c.name, has(c.id)))),
        h('h4', null, '裁切特寫'), h('div', { class: 'checks' }, p.regions.map((r) => chk('region:' + r.id, `${r.name}${r.accel ? '（加速規）' : ''}`, has(r.angleId)))),
        h('h4', null, '零件'), h('div', { class: 'checks' }, M.enabledItems(p, ['part']).map((c) => chk('item:' + c.id, c.name, has(c.id))))));
  });

  const undecided = M.allSubitems(p).filter((s) => !p.verdicts[s.id]).length;
  return h('div', { class: 'page' },
    h('section', { class: 'panel' },
      h('h2', null, '產生報告'),
      h('p', { class: 'muted' }, '系統已依時間軸預填每個報告大項的測試前／後照片，請確認或改選。沒選進報告的照片仍完整留存。'),
      undecided ? h('p', { class: 'warn-text' }, `⚠ 還有 ${undecided} 個分項未判定。`) : null,
      h('p', { class: 'warn-text small' }, '目前 Excel 為暫定版面（尚未套用公司範本）。'),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn primary big', onclick: async () => {
          const busy = AR.busy('產生 Excel 中…');
          try {
            const blob = await AR.report.generate(p, (m) => busy.set(m));
            AR.download(blob, `${AR.safeName(p.info.reportNo || p.name)}_震動衝擊報告.xlsx`);
          } catch (err) { console.error(err); AR.alert('產生失敗：' + err.message); } finally { busy.close(); }
        } }, '📊 產生 Excel 報告'),
        h('button', { class: 'btn', onclick: async () => {
          const busy = AR.busy('打包中…');
          try { AR.download(await AR.pkg.exportZip(p), `${AR.safeName(p.name)}_專案檔.zip`); } finally { busy.close(); }
        } }, '匯出專案檔（.zip，含整理好的照片資料夾）'),
        navigator.share ? h('button', { class: 'btn', onclick: async () => {
          const busy = AR.busy('打包中…');
          let blob; try { blob = await AR.pkg.exportZip(p); } finally { busy.close(); }
          await AR.shareOrDownload(blob, `${AR.safeName(p.name)}_專案檔.zip`);
        } }, '📤 分享專案檔（存到 OneDrive App）') : null)),
    groupPanels);
};
