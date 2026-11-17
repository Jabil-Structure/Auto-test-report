/* 87-ui-report.js — 出報告前：指定每個報告大項的測試前／後照片、勾選要放的照片、報告設定，產生 Excel */
'use strict';

AR.views.report = async (p) => {
  const M = AR.model, D = AR.DEFAULTS;
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
        h('label', null, h('span', null, '測試前照片（報告 4.3 Pictures） ', sugTag('before')), AR.select(nodeOpts, a.before || '', (v) => { st.before = v || null; rerender(); })),
        h('label', null, h('span', null, '測試後照片（報告 8.3 Post-check record） ', sugTag('after')), AR.select(nodeOpts, a.after || '', (v) => { st.after = v || null; rerender(); }))),
      (st.before !== undefined || st.after !== undefined) && h('button', { class: 'btn small ghost', onclick: async () => { delete st.before; delete st.after; rerender(); } }, '恢復系統建議'),
      warns.length ? h('ul', { class: 'warns' }, warns.map((w) => h('li', null, '⚠ ' + w))) : h('p', { class: 'ok-text' }, '✓ 對應看起來合理'),
      h('details', null, h('summary', null, '要放進報告的照片'),
        h('h4', null, '母圖（System views）'), h('div', { class: 'checks' }, M.enabledItems(p, ['angle']).map((c) => chk('item:' + c.id, c.name, has(c.id)))),
        h('h4', null, '裁切特寫'), h('div', { class: 'checks' }, p.regions.filter((r) => !r.accel).map((r) => chk('region:' + r.id, r.name, has(r.angleId)))),
        h('h4', null, '零件'), h('div', { class: 'checks' }, M.enabledItems(p, ['part']).map((c) => chk('item:' + c.id, c.name, has(c.id))))));
  });

  // 報告設定（存在這台裝置，所有測試案共用）
  const logo = await AR.store.getSetting('reportLogo');
  const footer = (await AR.store.getSetting('reportFooter')) ?? D.footer;
  const settings = h('section', { class: 'panel' },
    h('h2', null, '報告設定（這台裝置的所有測試案共用）'),
    h('div', { class: 'row wrap' },
      logo ? h('img', { src: URL.createObjectURL(logo), style: { maxHeight: '48px', maxWidth: '260px', border: '1px solid #ddd', borderRadius: '6px' } }) : h('span', { class: 'muted small' }, '尚未設定公司標誌（封面與各測項頁頂端）'),
      h('button', { class: 'btn small', onclick: async () => {
        const [f] = await AR.pickFiles({ accept: 'image/png,image/jpeg' });
        if (!f) return;
        await AR.store.putSetting('reportLogo', f); AR.render();
      } }, logo ? '更換標誌' : '上傳標誌圖片'),
      logo ? h('button', { class: 'btn small ghost danger', onclick: async () => { await AR.store.putSetting('reportLogo', null); AR.render(); } }, '移除') : null),
    h('label', null, '頁尾左側文字（例：公司名 Proprietary and Confidential - All rights reserved）',
      h('input', { value: footer, oninput: (e) => AR.store.putSetting('reportFooter', e.target.value) })));

  const undecided = M.allSubitems(p).filter((s) => !p.verdicts[s.id]).length;
  return h('div', { class: 'page' },
    h('section', { class: 'panel' },
      h('h2', null, '產生報告'),
      h('p', { class: 'muted' }, '依公司報告格式產生：Cover、Summary、每個測項一頁（1. Purposes ~ 8. Testing Detail Results）、Issue Lists、每個問題一頁。系統已依時間軸預填每個報告大項的測試前／後照片，請確認或改選。沒選進報告的照片仍完整留存。'),
      undecided ? h('p', { class: 'warn-text' }, `⚠ 還有 ${undecided} 個分項未判定。`) : null,
      h('p', { class: 'muted small' }, '系統內沒有的資料（4.1 配置表若未貼上、8.2 Card movement 量測值）會留空白或 N/A，產生後直接在 Excel 補上。'),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn primary big', onclick: async () => {
          const busy = AR.busy('產生 Excel 中…');
          try {
            const blob = await AR.report.generate(p, (m) => busy.set(m));
            AR.download(blob, AR.report.fileName(p));
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
    groupPanels,
    settings);
};
