/* 86-ui-responses.js — 響應圖：從實驗室 Word 檔抽圖，對應到測項／分項／加速規 */
'use strict';

AR.views.responses = async (p) => {
  const rerender = () => { AR.save(); AR.render(); };
  const testOpts = [{ value: '', label: '（未指定測項）' }, ...p.tests.map((t) => ({ value: t.id, label: t.name }))];
  const accelOpts = [{ value: '', label: '（不是加速規響應）' }, ...p.regions.filter((r) => r.accel).map((r) => ({ value: r.id, label: `加速規：${r.name}` }))];

  const importDocx = async () => {
    const files = await AR.pickFiles({ accept: '.docx', multiple: true });
    if (!files.length) return;
    const busy = AR.busy('讀取 Word 檔…');
    let n = 0; const skipped = [];
    try {
      for (const f of files) {
        const { images, skipped: sk } = await AR.docx.extractImages(f);
        skipped.push(...sk);
        // 依檔名猜測測項（例如檔名含「Shock」「Vib」）
        const guess = p.tests.find((t) => (t.kind === 'shock' && /shock|衝擊/i.test(f.name)) || (t.kind === 'vib' && /vib|震動|振動/i.test(f.name)));
        for (const im of images) {
          const blobId = await AR.store.putBlob(im.blob);
          let w = 0, hh = 0;
          try { ({ w, h: hh } = await AR.img.sizeOfBlob(im.blob)); } catch (e) { /* skip */ }
          p.responses.push({ id: AR.uid('rs_'), blobId, w, h: hh, name: im.name, source: f.name, testId: guess ? guess.id : '', subitemId: '', accelId: '', caption: '', include: true });
          n++;
        }
      }
    } finally { busy.close(); }
    AR.toast(`抽出 ${n} 張圖片` + (skipped.length ? `，${skipped.length} 張是 EMF/WMF 格式無法顯示，請在 Word 裡另存為圖片` : ''), 5000);
    rerender();
  };

  const cards = await Promise.all(p.responses.map(async (r) => {
    const t = p.tests.find((x) => x.id === r.testId);
    const subOpts = [{ value: '', label: '（整個測項）' }, ...(t ? AR.model.orderedSubitems(p, t).map((s) => ({ value: s.id, label: `${s.name}｜${s.en}` })) : [])];
    return h('div', { class: 'card resp' + (r.include === false ? ' off' : '') },
      h('img', { src: await AR.blobUrl(r.blobId), class: 'click', onclick: async () => AR.modal(r.name, h('img', { class: 'big', src: await AR.blobUrl(r.blobId) }), { wide: true }) }),
      h('div', { class: 'muted small' }, `${r.source}｜${r.name}`),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: r.include !== false, onchange: (e) => { r.include = e.target.checked; rerender(); } }), '放進報告'),
      AR.select(testOpts, r.testId, (v) => { r.testId = v; r.subitemId = ''; rerender(); }),
      AR.select(subOpts, r.subitemId, (v) => { r.subitemId = v; if (v) r.accelId = ''; rerender(); }),
      accelOpts.length > 1 ? AR.select(accelOpts, r.accelId || '', (v) => { r.accelId = v; if (v) r.subitemId = ''; rerender(); }) : null,
      h('div', { class: 'muted small' }, r.accelId ? '→ 報告 7.1 Response' : r.subitemId ? '→ 報告 6.1 Input Waveforms' : r.testId ? '→ 報告 7.1（其他響應圖）' : '未指定，不會放進報告'),
      h('button', { class: 'btn ghost small danger', onclick: async () => { p.responses = p.responses.filter((x) => x !== r); await AR.store.deleteBlob(r.blobId); rerender(); } }, '刪除'));
  }));

  return h('div', { class: 'page' },
    h('section', { class: 'panel' },
      h('h2', null, '響應圖'),
      h('p', { class: 'muted' }, '上傳第三方實驗室的響應 Word 檔，系統會依文件順序抽出所有圖片，再指定每張圖屬於哪個測項：指定到「分項」的放進報告 6.1 Input Waveforms（同一分項可放多張，例如曲線圖加數據表）；指定到「加速規」的放進 7.1 Response。檔案只在這台裝置處理。'),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn primary', onclick: importDocx }, '上傳響應 Word 檔（.docx）'),
        h('button', { class: 'btn', onclick: async () => {
          const fs = await AR.pickFiles({ multiple: true });
          for (const f of fs) {
            const blobId = await AR.store.putBlob(f);
            let w = 0, hh = 0;
            try { ({ w, h: hh } = await AR.img.sizeOfBlob(f)); } catch (e) { /* skip */ }
            p.responses.push({ id: AR.uid('rs_'), blobId, w, h: hh, name: f.name, source: '直接上傳', testId: '', subitemId: '', accelId: '', caption: '', include: true });
          }
          if (fs.length) rerender();
        } }, '直接上傳圖片'))),
    p.responses.length ? h('div', { class: 'cards' }, cards) : h('p', { class: 'muted' }, '還沒有響應圖。'));
};
