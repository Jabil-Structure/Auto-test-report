/* 99-app.js — 畫面切換與啟動 */
'use strict';

AR.state = { view: 'home', tab: 'timeline', sub: {}, project: null, user: '' };

AR.TABS = [
  { id: 'setup', label: '① 基本資料與測項' },
  { id: 'timeline', label: '② 時間軸與拍照' },
  { id: 'crop', label: '③ 框選裁切' },
  { id: 'review', label: '④ 照片回顧' },
  { id: 'issues', label: '⑤ 問題與判定' },
  { id: 'responses', label: '⑥ 響應圖' },
  { id: 'report', label: '⑦ 產生報告' },
];

AR.go = (view, tab) => {
  AR.state.view = view;
  if (tab && tab !== AR.state.tab) { AR.state.tab = tab; AR.state.sub = {}; }
  AR.render();
  window.scrollTo(0, 0);
};

AR.busy = (msg) => {
  const txt = h('div', null, msg);
  const el = h('div', { class: 'busy' }, h('div', { class: 'spinner' }), txt);
  document.body.appendChild(el);
  return { set: (m) => (txt.textContent = m), close: () => el.remove() };
};

let renderSeq = 0;
AR.render = async () => {
  const seq = ++renderSeq;
  const root = document.getElementById('app');
  const p = AR.state.project;
  let content;
  try {
    content = AR.state.view === 'home' || !p ? await AR.views.home() : await AR.views[AR.state.tab](p);
  } catch (err) {
    console.error(err);
    content = h('div', { class: 'page' }, h('p', { class: 'warn-text' }, '畫面發生錯誤：' + err.message));
  }
  if (seq !== renderSeq) return; // 已有更新的重繪
  const header = h('header', null,
    h('div', { class: 'bar' },
      h('a', { class: 'brand', href: '#', onclick: async (e) => { e.preventDefault(); await AR.save.now(); AR.state.project = null; AR.go('home'); } }, '🏠 Autoreport'),
      p && AR.state.view !== 'home' ? h('span', { class: 'pname' }, p.name) : null,
      h('span', { class: 'grow' }),
      h('span', { class: 'local-badge', title: '資料只存在這台裝置的瀏覽器' }, '🔒 僅存本機')),
    p && AR.state.view !== 'home' ? h('nav', null, AR.TABS.map((t) => h('button', { class: 'tab' + (AR.state.tab === t.id ? ' on' : ''), onclick: () => AR.go('project', t.id) }, t.label))) : null);
  root.replaceChildren(header, content);
};

window.addEventListener('beforeunload', () => AR.save.now());
document.addEventListener('visibilitychange', () => { if (document.hidden) AR.save.now(); });

(async () => {
  if (!window.indexedDB) {
    document.getElementById('app').textContent = '這個瀏覽器不支援本機儲存（IndexedDB），請改用 Chrome、Edge 或 Safari。';
    return;
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  AR.render();
})();
