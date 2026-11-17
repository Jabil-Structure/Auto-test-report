/* 80-ui-home.js — 首頁：測試案列表、新增、示範資料、匯入 */
'use strict';

AR.views = AR.views || {};

AR.views.home = async () => {
  const list = await AR.store.listProjects();
  const openP = async (id) => { AR.state.project = await AR.store.getProject(id); AR.go('project', 'timeline'); };

  const newWizard = () => {
    const sel = new Set(['rv_nonop', 'hs_nonop']);
    let name = '', merge = true;
    const body = h('div', null,
      h('label', null, '測試案名稱', h('input', { placeholder: '例：XX 2U 伺服器 DVT 震動衝擊', oninput: (e) => (name = e.target.value) })),
      h('p', { class: 'muted' }, '勾選本次的測項（之後還可以增刪）：'),
      AR.DEFAULTS.testLibrary.map((t) => h('label', { class: 'check' },
        h('input', { type: 'checkbox', checked: sel.has(t.key), onchange: (e) => (e.target.checked ? sel.add(t.key) : sel.delete(t.key)) }),
        `${t.name}（${t.kind === 'vib' ? 'X／Y／Z 三軸' : '六個面'}）`)),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: true, onchange: (e) => (merge = e.target.checked) }),
        '勾選的測項交錯一起做（同一軸的震動與衝擊一起做），共用一組測試前與測試後照片'),
      h('div', { class: 'row end' }, h('button', { class: 'btn primary', onclick: async () => {
        const M = AR.model;
        const p = M.newProject(name || '新測試案');
        [...sel].forEach((k, i) => {
          let gid = p.groups[0].id;
          if (!merge && i > 0) { gid = AR.uid('g_'); p.groups.push({ id: gid, name: `報告大項 ${i + 1}` }); }
          const t = M.addTest(p, k, gid);
          if (!merge || sel.size === 1) p.groups.find((g) => g.id === gid).name = t.name;
        });
        if (merge && sel.size > 1) p.groups[0].name = p.tests.map((t) => t.name).join('＋');
        M.regroupByAxis(p);
        await AR.store.putProject(p);
        m.close();
        AR.state.project = p;
        AR.go('project', 'setup');
      } }, '建立')));
    const m = AR.modal('新增測試案', body);
  };

  return h('div', { class: 'page' },
    h('div', { class: 'hero' },
      h('h1', null, '震動衝擊測試報告 自動化（第一版）'),
      h('p', null, '照片與資料只存在這台裝置的瀏覽器裡，不會上傳到任何地方。要帶到別台裝置或與同事合併，請用「匯出專案檔」。')),
    h('div', { class: 'row wrap' },
      h('button', { class: 'btn primary', onclick: newWizard }, '＋ 新增測試案'),
      h('button', { class: 'btn', onclick: async (e) => {
        e.target.disabled = true;
        const busy = AR.busy('正在產生示範資料…');
        try { const p = await AR.demo.create((m) => busy.set(m)); AR.state.project = p; AR.go('project', 'timeline'); }
        finally { busy.close(); }
      } }, '載入示範資料'),
      h('button', { class: 'btn', onclick: async () => {
        const [f] = await AR.pickFiles({ accept: '.zip' });
        if (!f) return;
        const busy = AR.busy('匯入中…');
        try {
          const r = await AR.pkg.importZip(f);
          AR.toast(r.merged ? `已合併到現有測試案，新增 ${r.added} 張照片` : `已匯入，共 ${r.added} 張照片`);
          AR.state.project = r.project; AR.go('project', 'timeline');
        } catch (err) { AR.alert('匯入失敗：' + err.message); } finally { busy.close(); }
      } }, '匯入／合併專案檔（.zip）')),
    h('h2', null, '測試案'),
    list.length ? h('div', { class: 'cards' }, list.map((p) => h('div', { class: 'card click', onclick: async () => openP(p.id) },
      h('b', null, p.name), h('div', { class: 'muted' }, [p.info?.model, p.info?.stage].filter(Boolean).join('｜')),
      h('div', { class: 'muted small' }, '最後修改 ' + AR.fmtTime(p.updatedAt)),
      h('button', { class: 'btn ghost small danger', onclick: async (e) => {
        e.stopPropagation();
        if (!await AR.confirm(`確定刪除「${p.name}」？照片也會一起從這台裝置刪除（已匯出的專案檔不受影響）。`)) return;
        const full = await AR.store.getProject(p.id);
        for (const x of [...full.photos, ...full.responses]) await AR.store.deleteBlob(x.blobId);
        await AR.store.deleteProject(p.id);
        AR.render();
      } }, '刪除'))))
      : h('p', { class: 'muted' }, '還沒有測試案。可以先按「載入示範資料」看看完整流程。'));
};
