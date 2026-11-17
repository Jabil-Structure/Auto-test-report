/* 81-ui-setup.js — 基本資料、報告大項、測項與報告文字、報告共用表格、拍照清單 */
'use strict';

AR.views.setup = async (p) => {
  const M = AR.model, D = AR.DEFAULTS;
  const save = () => AR.save();
  const rerender = () => { save(); AR.render(); };
  const area = (label, value, onInput, rows = 3, hint = '') => h('label', null, label,
    h('textarea', { rows, value: value || '', spellcheck: 'false', oninput: (e) => { onInput(e.target.value); save(); } }),
    hint ? h('span', { class: 'muted small' }, hint) : null);
  const TABLE_HINT = '每行一列，欄位用「|」分隔；也可以直接從 Excel 選取儲存格複製貼上。';

  const info = h('section', { class: 'panel' },
    h('h2', null, '基本資料'),
    h('p', { class: 'muted small' }, '這些欄位會填進報告封面、Summary 與各測項頁的 Project Name／Phase／Engineer 區塊。正式報告是英文，請用英文填寫。'),
    h('label', null, '測試案名稱（只在系統內顯示）', h('input', { value: p.name, oninput: (e) => { p.name = e.target.value; save(); } })),
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

  const testCard = (t) => h('div', { class: 'card' },
    h('div', { class: 'row wrap' },
      h('label', { class: 'grow' }, '測項名稱（報告標題，英文）', h('input', { value: t.name, oninput: (e) => { t.name = e.target.value; save(); } })),
      h('label', null, '工作表名稱', h('input', { value: t.sheet || '', maxlength: 31, style: 'width:11em', oninput: (e) => { t.sheet = e.target.value; save(); } })),
      h('label', null, '報告大項', AR.select(groupOpts, t.groupId, (v) => { t.groupId = v; rerender(); })),
      h('button', { class: 'btn ghost small danger', onclick: async () => {
        if (!await AR.confirm(`刪除測項「${t.name}」？已拍的照片會保留。`)) return;
        M.removeTest(p, t.id); rerender();
      } }, '刪除測項')),
    h('div', { class: 'chips' }, t.subitems.map((s) => h('span', { class: 'chip', title: s.en }, `${s.name}｜${s.en}`))),
    h('details', null, h('summary', null, '報告文字與表格（英文，預設全部帶入，可刪改）'),
      area('1. Purposes（每行一條，報告會自動編號 1.1、1.2…）', t.purpose, (v) => (t.purpose = v), 3),
      h('label', null, '2.1 Specification（規範文件）', h('input', { value: t.spec || '', oninput: (e) => { t.spec = e.target.value; save(); } })),
      area('2.2 Profile 表格（第一行是標題列）', t.profile, (v) => (t.profile = v), 3, TABLE_HINT),
      h('label', null, '5.1 Summary Table 的 G Level 欄', h('input', { value: t.level || '', oninput: (e) => { t.level = e.target.value; save(); } })),
      area('3. Equipment 表格（第一行是標題列）', t.equipment, (v) => (t.equipment = v), 2, TABLE_HINT),
      area('6.2 Functional Testing Tools 表格（第一行是標題列）', t.tools, (v) => (t.tools = v), 4, TABLE_HINT),
      h('div', { class: 'row end' }, h('button', { class: 'btn small ghost', onclick: async () => {
        const lib = D.testLibrary.find((x) => x.key === t.libKey);
        if (!lib) return AR.alert('這個測項不在測項庫裡，沒有預設文字。');
        if (!await AR.confirm('把這個測項的報告文字與表格恢復成測項庫的預設內容？')) return;
        Object.assign(t, { purpose: lib.purpose, spec: lib.spec, profile: lib.profile, level: lib.level, equipment: lib.equipment, tools: lib.tools });
        rerender();
      } }, '恢復預設文字'))));

  let addKey = D.testLibrary[0].key;
  const tests = h('section', { class: 'panel' },
    h('h2', null, '測項'),
    h('p', { class: 'muted small' }, '每個測項在報告中是一個工作表。數值（G 值、PSD、時間）預設是 [ ]，請依本次規範填寫。'),
    p.tests.map(testCard),
    h('div', { class: 'row wrap' },
      AR.select(D.testLibrary.map((t) => ({ value: t.key, label: `${t.name}（${t.kind === 'vib' ? '三軸' : '六面'}）` })), addKey, (v) => (addKey = v)),
      h('button', { class: 'btn', onclick: async () => { M.addTest(p, addKey); rerender(); } }, '＋ 加入測項'),
      h('button', { class: 'btn ghost', onclick: async () => { if (await AR.confirm('依軸向重新排列時間軸？（同一大項的測項，同一軸放在一起）')) { M.regroupByAxis(p); rerender(); } } }, '依軸向重排時間軸')));

  const shared = h('section', { class: 'panel' },
    h('h2', null, '報告共用內容（每個測項頁都會用到）'),
    area('4.1 Detail Configuration Table（不含標題列也可以）', p.config.table, (v) => (p.config.table = v), 5,
      `欄位：${D.configHead}。${TABLE_HINT}留空時報告會留空白表格。`),
    area('4.2 Torque of screws while setup（Positions | Torque (kgf.cm)）', p.config.torque, (v) => (p.config.torque = v), 3, TABLE_HINT),
    area('8.1 Checklist 檢查項目（每行一項，「## 」開頭為分組標題）', p.checkItems, (v) => (p.checkItems = v), 8,
      '報告會依每個分項的判定填 pass；問題紀錄若指定了檢查項目，該格會標成 Defect／Fail 並附問題編號。'),
    h('div', { class: 'row end' }, h('button', { class: 'btn small ghost', onclick: async () => {
      if (!await AR.confirm('把 8.1 檢查項目恢復成預設清單？')) return;
      p.checkItems = D.checkItems; rerender();
    } }, '恢復預設檢查項目')));

  const partRow = (c) => h('div', { class: 'row' },
    h('input', { type: 'checkbox', checked: c.enabled, onchange: (e) => { c.enabled = e.target.checked; save(); } }),
    c.kind === 'angle' ? h('span', { class: 'grow' }, c.name, h('span', { class: 'muted small' }, `　${c.en || ''}`))
      : h('input', { class: 'grow', value: c.name, oninput: (e) => { c.name = e.target.value; save(); } }),
    c.kind === 'part' && h('button', { class: 'btn ghost small danger', onclick: async () => {
      const n = p.photos.filter((x) => x.itemId === c.id).length;
      if (n && !await AR.confirm(`「${c.name}」已有 ${n} 張照片，刪除項目後照片會移到「未分類」。確定？`)) return;
      p.photos.forEach((x) => { if (x.itemId === c.id) x.itemId = 'unsorted'; });
      p.checklist = p.checklist.filter((x) => x !== c); rerender();
    } }, '刪除'));

  const checklist = h('section', { class: 'panel' },
    h('h2', null, '拍照清單'),
    h('p', { class: 'muted' }, '取消勾選的項目不會出現在拍照畫面。每個項目都可以放多張照片。零件名稱會直接當成報告 4.3／8.3 的小標題，建議用英文；裁切框若與零件同名，會放在同一個小標題下。'),
    h('h3', null, '固定母圖角度（10 個）'),
    M.items(p, ['angle']).map(partRow),
    h('h3', null, '單獨拍攝的零件'),
    M.items(p, ['part']).map(partRow),
    h('div', { class: 'row wrap' },
      h('button', { class: 'btn small', onclick: async () => { const n = await AR.prompt('新增項目名稱（建議英文）'); if (n) { p.checklist.splice(p.checklist.findIndex((c) => c.kind === 'unsorted'), 0, { id: AR.uid('c_'), name: n, kind: 'part', enabled: true }); rerender(); } } }, '＋ 新增項目'),
      h('button', { class: 'btn small ghost', onclick: async () => {
        const name = await AR.prompt('存成機種清單，名稱：', p.info.codeName || p.info.projectName || p.name); if (!name) return;
        const lists = (await AR.store.getSetting('checklists')) || {};
        lists[name] = {
          parts: M.items(p, ['part']).map((c) => ({ name: c.name, enabled: c.enabled })),
          regions: p.regions.map((r) => ({ angleId: r.angleId, name: r.name, rect: r.rect, accel: r.accel })),
          checkItems: p.checkItems, config: { ...p.config },
        };
        await AR.store.putSetting('checklists', lists); AR.toast('已存成機種清單（含裁切框、檢查項目、配置表）');
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
        if (L.checkItems) p.checkItems = L.checkItems;
        if (L.config) { if (!p.config.table) p.config.table = L.config.table || ''; if (!p.config.torque) p.config.torque = L.config.torque || ''; }
        rerender(); AR.toast('已套用機種清單');
      } }, '套用機種清單')));

  return h('div', { class: 'page' }, info, groups, tests, shared, checklist);
};
