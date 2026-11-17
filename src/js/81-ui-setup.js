/* 81-ui-setup.js — 基本資料、報告大項、測項與固定文字、拍照清單 */
'use strict';

AR.views.setup = async (p) => {
  const M = AR.model, D = AR.DEFAULTS;
  const save = () => AR.save();
  const rerender = () => { save(); AR.render(); };

  const info = h('section', { class: 'panel' },
    h('h2', null, '基本資料 ', h('span', { class: 'tag warn' }, '欄位暫定，待範本')),
    h('label', null, '測試案名稱', h('input', { value: p.name, oninput: (e) => { p.name = e.target.value; save(); } })),
    h('div', { class: 'grid2' }, D.infoFields.map((f) => h('label', null, f.label,
      h('input', { type: f.type || 'text', value: p.info[f.key] || '', oninput: (e) => { p.info[f.key] = e.target.value; save(); } })))));

  const groupOpts = p.groups.map((g) => ({ value: g.id, label: g.name }));
  const groups = h('section', { class: 'panel' },
    h('h2', null, '報告大項'),
    h('p', { class: 'muted' }, '交錯一起做的測項放在同一個大項，共用一組測試前與全部做完後的測試後照片；沒有合併做的測項各自一個大項。'),
    p.groups.map((g) => h('div', { class: 'row' },
      h('input', { value: g.name, oninput: (e) => { g.name = e.target.value; save(); } }),
      h('span', { class: 'muted small nowrap' }, `${p.tests.filter((t) => t.groupId === g.id).length} 個測項`),
      p.groups.length > 1 && h('button', { class: 'btn ghost small danger', onclick: async () => {
        if (p.tests.some((t) => t.groupId === g.id)) return AR.alert('請先把這個大項裡的測項移到其他大項。');
        p.groups = p.groups.filter((x) => x !== g); delete p.assignments[g.id]; rerender();
      } }, '刪除'))),
    h('button', { class: 'btn small', onclick: async () => { p.groups.push({ id: AR.uid('g_'), name: `報告大項 ${p.groups.length + 1}` }); rerender(); } }, '＋ 新增報告大項'));

  let addKey = D.testLibrary[0].key;
  const tests = h('section', { class: 'panel' },
    h('h2', null, '測項與固定文字 ', h('span', { class: 'tag warn' }, '文字為範例，待換成公司固定文字')),
    p.tests.map((t) => h('div', { class: 'card' },
      h('div', { class: 'row wrap' },
        h('input', { class: 'grow', value: t.name, oninput: (e) => { t.name = e.target.value; save(); } }),
        h('label', { class: 'inline' }, '報告大項 ', AR.select(groupOpts, t.groupId, (v) => { t.groupId = v; rerender(); })),
        h('button', { class: 'btn ghost small danger', onclick: async () => {
          if (!await AR.confirm(`刪除測項「${t.name}」？已拍的照片會保留。`)) return;
          M.removeTest(p, t.id); rerender();
        } }, '刪除測項')),
      h('textarea', { rows: 3, value: t.text, oninput: (e) => { t.text = e.target.value; save(); } }),
      h('div', { class: 'chips' }, t.subitems.map((s) => h('span', { class: 'chip' }, s.name))))),
    h('div', { class: 'row wrap' },
      AR.select(D.testLibrary.map((t) => ({ value: t.key, label: t.name })), addKey, (v) => (addKey = v)),
      h('button', { class: 'btn', onclick: async () => { M.addTest(p, addKey); rerender(); } }, '＋ 加入測項'),
      h('button', { class: 'btn ghost', onclick: async () => { if (await AR.confirm('依軸向重新排列時間軸？（同一大項的測項，同一軸放在一起）')) { M.regroupByAxis(p); rerender(); } } }, '依軸向重排時間軸')));

  const partRow = (c) => h('div', { class: 'row' },
    h('input', { type: 'checkbox', checked: c.enabled, onchange: (e) => { c.enabled = e.target.checked; save(); } }),
    c.kind === 'angle' ? h('span', { class: 'grow' }, c.name)
      : h('input', { class: 'grow', value: c.name, oninput: (e) => { c.name = e.target.value; save(); } }),
    c.kind === 'part' && h('button', { class: 'btn ghost small danger', onclick: async () => {
      const n = p.photos.filter((x) => x.itemId === c.id).length;
      if (n && !await AR.confirm(`「${c.name}」已有 ${n} 張照片，刪除項目後照片會移到「未分類」。確定？`)) return;
      p.photos.forEach((x) => { if (x.itemId === c.id) x.itemId = 'unsorted'; });
      p.checklist = p.checklist.filter((x) => x !== c); rerender();
    } }, '刪除'));

  const checklist = h('section', { class: 'panel' },
    h('h2', null, '拍照清單 ', h('span', { class: 'tag warn' }, '零件清單暫定，待過往清單')),
    h('p', { class: 'muted' }, '取消勾選的項目不會出現在拍照畫面。每個項目都可以放多張照片。'),
    h('h3', null, '固定母圖角度（10 個）'),
    M.items(p, ['angle']).map(partRow),
    h('h3', null, '單獨拍攝的零件'),
    M.items(p, ['part']).map(partRow),
    h('div', { class: 'row wrap' },
      h('button', { class: 'btn small', onclick: async () => { const n = await AR.prompt('新增項目名稱'); if (n) { p.checklist.splice(p.checklist.findIndex((c) => c.kind === 'unsorted'), 0, { id: AR.uid('c_'), name: n, kind: 'part', enabled: true }); rerender(); } } }, '＋ 新增項目'),
      h('button', { class: 'btn small ghost', onclick: async () => {
        const name = await AR.prompt('存成機種清單，名稱：', p.info.model || p.name); if (!name) return;
        const lists = (await AR.store.getSetting('checklists')) || {};
        lists[name] = { parts: M.items(p, ['part']).map((c) => ({ name: c.name, enabled: c.enabled })), regions: p.regions.map((r) => ({ angleId: r.angleId, name: r.name, rect: r.rect, accel: r.accel })) };
        await AR.store.putSetting('checklists', lists); AR.toast('已存成機種清單（含裁切框）');
      } }, '存成機種清單'),
      h('button', { class: 'btn small ghost', onclick: async () => {
        const lists = (await AR.store.getSetting('checklists')) || {};
        const names = Object.keys(lists);
        if (!names.length) return AR.alert('還沒有存過機種清單。');
        const name = await AR.choose('要套用哪一份機種清單？', names); if (!name || !lists[name]) return;
        const L = lists[name];
        const have = new Set(M.items(p, ['part']).map((c) => c.name));
        L.parts.forEach((x) => { if (!have.has(x.name)) p.checklist.splice(p.checklist.findIndex((c) => c.kind === 'unsorted'), 0, { id: AR.uid('c_'), name: x.name, kind: 'part', enabled: x.enabled }); });
        const base = M.sortedNodes(p)[0].id;
        (L.regions || []).forEach((r) => { if (!p.regions.some((x) => x.angleId === r.angleId && x.name === r.name)) p.regions.push({ ...r, id: AR.uid('r_'), baseNodeId: base }); });
        rerender(); AR.toast('已套用機種清單與裁切框');
      } }, '套用機種清單')));

  return h('div', { class: 'page' }, info, groups, tests, checklist);
};
