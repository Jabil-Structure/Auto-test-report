/* 84-ui-review.js — 回顧：同一個角度／零件在各時間點的照片，用來找出問題是哪個階段產生的 */
'use strict';

AR.views.review = async (p) => {
  const M = AR.model;
  const S = AR.state.sub;
  const opts = [
    ...M.enabledItems(p, ['angle']).map((c) => ({ value: 'item:' + c.id, label: '母圖｜' + c.name })),
    ...p.regions.map((r) => ({ value: 'region:' + r.id, label: `裁切｜${r.name}（${M.itemName(p, r.angleId)}）` })),
    ...M.enabledItems(p, ['part']).map((c) => ({ value: 'item:' + c.id, label: '零件｜' + c.name })),
  ];
  if (!opts.some((o) => o.value === S.target)) S.target = (p.regions[0] ? 'region:' + p.regions[0].id : opts[0]?.value);
  const [kind, id] = (S.target || ':').split(':');
  const hist = M.history(p, kind === 'region' ? { regionId: id } : { itemId: id });
  const size = S.size || 220;

  const cols = await Promise.all(hist.map(async ({ node, shots }) => {
    const iss = p.issues.filter((i) => i.foundNodeId === node.id);
    return h('div', { class: 'hcol' },
      h('div', { class: 'small' }, h('b', null, M.nodeLabel(p, node))),
      iss.length ? h('div', { class: 'tag bad' }, iss.map((i) => `問題 #${i.no}`).join(' ')) : null,
      shots.length ? await Promise.all(shots.map(async (s) => {
        const url = await AR.blobUrl(s.photo.blobId);
        const el = s.rect ? AR.img.cropThumb(url, s.rect, s.photo, { width: size, cls: 'click' }) : h('img', { class: 'click', src: url, style: { width: size + 'px' } });
        el.addEventListener('click', () => AR.photoViewer(p, s.photo, () => AR.render()));
        return el;
      })) : h('div', { class: 'empty', style: { width: size + 'px' } }, '此節點未拍'));
  }));

  return h('div', { class: 'page' },
    h('section', { class: 'panel' },
      h('h2', null, '照片回顧（依時間軸）'),
      h('p', { class: 'muted' }, '選一個角度或零件，橫向比對每個拍照節點的照片。'),
      h('div', { class: 'row wrap' },
        AR.select(opts, S.target, (v) => { S.target = v; AR.render(); }, { class: 'grow' }),
        h('label', { class: 'inline' }, '大小 ', h('input', { type: 'range', min: 120, max: 480, step: 20, value: size, onchange: (e) => { S.size = +e.target.value; AR.render(); } })))),
    h('div', { class: 'hscroll' }, cols));
};
