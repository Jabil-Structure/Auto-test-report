/* 70-demo.js — 示範用假資料（畫出來的假伺服器照片與假響應圖），不需要任何真實機密照片就能試用整個流程。 */
'use strict';

AR.demo = (() => {
  const W = 1600, H = 1200;

  function base(g, label) {
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#d9dde2'); grd.addColorStop(1, '#b9bfc6');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    g.save(); g.translate(W / 2, H / 2); g.rotate(-0.35);
    g.font = 'bold 150px sans-serif'; g.fillStyle = 'rgba(255,255,255,0.18)'; g.textAlign = 'center';
    g.fillText('DEMO 假資料', 0, 50); g.restore();
    g.font = '32px sans-serif'; g.fillStyle = '#333'; g.textAlign = 'left';
    g.fillText(label, 30, H - 30);
  }
  const box = (g, x, y, w, h, fill, stroke = '#222', lw = 3) => {
    g.fillStyle = fill; g.fillRect(x * W, y * H, w * W, h * H);
    g.strokeStyle = stroke; g.lineWidth = lw; g.strokeRect(x * W, y * H, w * W, h * H);
  };
  const text = (g, s, x, y, size = 28, color = '#fff') => { g.font = `bold ${size}px sans-serif`; g.fillStyle = color; g.textAlign = 'center'; g.fillText(s, x * W, y * H); };
  function screw(g, x, y, markAngle) {
    g.beginPath(); g.arc(x * W, y * H, 16, 0, Math.PI * 2); g.fillStyle = '#888'; g.fill(); g.strokeStyle = '#333'; g.lineWidth = 2; g.stroke();
    // 防鬆標記：螺絲上的線與底座上的線（底座固定不動）
    g.strokeStyle = '#ffd400'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(x * W + 18, y * H); g.lineTo(x * W + 40, y * H); g.stroke();
    g.save(); g.translate(x * W, y * H); g.rotate(markAngle);
    g.beginPath(); g.moveTo(-14, 0); g.lineTo(16, 0); g.stroke(); g.restore();
  }
  function accel(g, x, y) { box(g, x, y, 0.05, 0.06, '#1f6fd1', '#0a2a55', 3); text(g, 'ACC', x + 0.025, y + 0.04, 22); g.strokeStyle = '#111'; g.lineWidth = 5; g.beginPath(); g.moveTo((x + 0.05) * W, (y + 0.03) * H); g.bezierCurveTo((x + 0.1) * W, y * H, (x + 0.12) * W, (y + 0.1) * H, W, (y + 0.12) * H); g.stroke(); }

  /** 畫一張角度照片。loose：防鬆標記是否已錯位 */
  function drawAngle(angleId, { dx = 0, dy = 0, loose = false } = {}) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const name = AR.DEFAULTS.angles.find((a) => a.id === angleId).name;
    base(g, name);
    g.save(); g.translate(dx, dy);
    const open = angleId.includes('_open_');
    const side = angleId.split('_').pop();
    if (side === 'top') {
      box(g, 0.1, 0.08, 0.8, 0.84, open ? '#2e7d32' : '#9aa3ab');
      if (open) {
        box(g, 0.15, 0.10, 0.6, 0.12, '#333'); for (let i = 0; i < 5; i++) { g.beginPath(); g.arc((0.21 + i * 0.12) * W, 0.16 * H, 50, 0, Math.PI * 2); g.strokeStyle = '#777'; g.lineWidth = 4; g.stroke(); }
        text(g, 'FAN', 0.45, 0.25, 26, '#fff');
        box(g, 0.30, 0.35, 0.18, 0.25, '#c0c6cc'); for (let i = 0; i < 12; i++) { g.fillStyle = '#8a9096'; g.fillRect((0.305 + i * 0.0145) * W, 0.36 * H, 6, 0.23 * H); } text(g, 'CPU0', 0.39, 0.64, 26);
        box(g, 0.30, 0.67, 0.18, 0.2, '#c0c6cc'); text(g, 'CPU1', 0.39, 0.79, 26, '#333');
        for (let i = 0; i < 8; i++) box(g, 0.52 + i * 0.015, 0.30, 0.01, 0.35, '#1b1b1b', '#000', 1);
        text(g, 'DIMM', 0.58, 0.68, 24);
        box(g, 0.70, 0.60, 0.18, 0.25, '#555'); text(g, 'PSU', 0.79, 0.74, 34);
        box(g, 0.13, 0.40, 0.12, 0.45, '#0d47a1'); text(g, 'PCIe', 0.19, 0.63, 26);
        screw(g, 0.78, 0.32, loose ? 0.6 : 0); text(g, '風扇支架螺絲', 0.80, 0.38, 22, '#fff');
        accel(g, 0.80, 0.15);
      } else {
        text(g, 'TOP COVER', 0.5, 0.5, 60, '#444');
        [[0.13, 0.12], [0.87, 0.12], [0.13, 0.88], [0.87, 0.88]].forEach(([x, y]) => screw(g, x, y, 0));
        accel(g, 0.45, 0.6);
      }
    } else {
      const frontish = side === 'front' || side === 'rear';
      box(g, 0.08, 0.32, 0.84, 0.36, '#8f979e');
      if (side === 'front') { for (let i = 0; i < 12; i++) box(g, 0.1 + i * 0.066, 0.36, 0.06, 0.28, '#333', '#111', 2); accel(g, 0.12, 0.2); }
      if (side === 'rear') { box(g, 0.1, 0.38, 0.2, 0.24, '#555'); text(g, 'PSU', 0.2, 0.52, 30); for (let i = 0; i < 6; i++) box(g, 0.4 + i * 0.07, 0.42, 0.05, 0.08, '#222'); }
      if (!frontish) { for (let i = 0; i < 6; i++) screw(g, 0.15 + i * 0.14, 0.62, 0); text(g, open ? 'SIDE（上蓋已開）' : 'SIDE', 0.5, 0.5, 40, '#333'); }
      if (open) box(g, 0.08, 0.26, 0.84, 0.06, '#2e7d32');
    }
    g.restore();
    return new Promise((res) => c.toBlob(res, 'image/jpeg', 0.85));
  }

  function drawPart(name, k, loose) {
    const c = document.createElement('canvas'); c.width = 1200; c.height = 900;
    const g = c.getContext('2d');
    g.fillStyle = '#cfd4d9'; g.fillRect(0, 0, 1200, 900);
    g.fillStyle = '#4b5563'; g.fillRect(200, 180, 800, 540);
    g.font = 'bold 60px sans-serif'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(name, 600, 440);
    g.font = '36px sans-serif'; g.fillText(`第 ${k} 張（DEMO）`, 600, 520);
    if (name.includes('防鬆')) {
      g.save(); g.translate(600, 640);
      g.beginPath(); g.arc(0, 0, 50, 0, Math.PI * 2); g.fillStyle = '#999'; g.fill();
      g.strokeStyle = '#ffd400'; g.lineWidth = 12; g.beginPath(); g.moveTo(55, 0); g.lineTo(130, 0); g.stroke();
      g.rotate(loose ? 0.6 : 0); g.beginPath(); g.moveTo(-45, 0); g.lineTo(50, 0); g.stroke(); g.restore();
    }
    return new Promise((res) => c.toBlob(res, 'image/jpeg', 0.85));
  }

  function drawResponse(title, kind, seed) {
    const c = document.createElement('canvas'); c.width = 1200; c.height = 700;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 1200, 700);
    g.strokeStyle = '#ddd'; g.lineWidth = 1;
    for (let i = 0; i <= 10; i++) { g.beginPath(); g.moveTo(100 + i * 100, 80); g.lineTo(100 + i * 100, 620); g.stroke(); g.beginPath(); g.moveTo(100, 80 + i * 54); g.lineTo(1100, 80 + i * 54); g.stroke(); }
    g.strokeStyle = '#000'; g.strokeRect(100, 80, 1000, 540);
    g.font = 'bold 30px sans-serif'; g.fillStyle = '#000'; g.textAlign = 'center'; g.fillText(title + '（DEMO 假圖）', 600, 50);
    const line = (color, f) => { g.strokeStyle = color; g.lineWidth = 3; g.beginPath(); for (let x = 0; x <= 1000; x += 4) { const y = f(x / 1000); x ? g.lineTo(100 + x, 620 - y * 540) : g.moveTo(100, 620 - y * 540); } g.stroke(); };
    if (kind === 'shock') {
      line('#c00', (t) => (t > 0.3 && t < 0.5 ? Math.sin(((t - 0.3) / 0.2) * Math.PI) * 0.8 : 0) + 0.05 * Math.sin(t * 90 + seed));
      line('#888', (t) => (t > 0.3 && t < 0.5 ? Math.sin(((t - 0.3) / 0.2) * Math.PI) * 0.7 : 0));
    } else {
      line('#888', (t) => (t < 0.2 ? t * 2.5 : t < 0.8 ? 0.5 : 0.5 - (t - 0.8) * 2));
      line('#06c', (t) => Math.max(0, (t < 0.2 ? t * 2.5 : t < 0.8 ? 0.5 : 0.5 - (t - 0.8) * 2) + 0.06 * Math.sin(t * 60 + seed) + 0.03 * Math.sin(t * 173 + seed * 2)));
    }
    return new Promise((res) => c.toBlob(res, 'image/png'));
  }

  /** 架設照：伺服器固定在震動台／衝擊台上（依面／軸畫不同方向） */
  function drawSetup(label, upright) {
    const c = document.createElement('canvas'); c.width = 1600; c.height = 1200;
    const g = c.getContext('2d');
    g.fillStyle = '#b8bfc7'; g.fillRect(0, 0, 1600, 1200);
    g.fillStyle = '#8a9198'; g.fillRect(150, 850, 1300, 200);                      // 台面
    for (let i = 0; i < 12; i++) { g.fillStyle = '#6b7178'; g.beginPath(); g.arc(220 + i * 105, 950, 14, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#7a4a2a'; g.fillRect(250, 780, 1100, 70);                         // 治具
    const [w, hh] = upright ? [380, 640] : [1000, 260];
    g.fillStyle = '#4b5563'; g.fillRect(800 - w / 2, 780 - hh, w, hh);               // 伺服器
    g.strokeStyle = '#111'; g.lineWidth = 4; g.strokeRect(800 - w / 2, 780 - hh, w, hh);
    g.font = 'bold 54px sans-serif'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(label, 800, 780 - hh / 2 + 18);
    g.font = 'bold 40px sans-serif'; g.fillStyle = 'rgba(255,255,255,.5)'; g.fillText('UUT SETUP（DEMO 假資料）', 800, 120);
    return new Promise((res) => c.toBlob(res, 'image/jpeg', 0.85));
  }

  async function addPhoto(p, nodeId, itemId, blob, extra = {}) {
    const blobId = await AR.store.putBlob(blob);
    const { w, h } = await AR.img.sizeOfBlob(blob);
    p.photos.push({ id: AR.uid('ph_'), nodeId, itemId, blobId, w, h, takenAt: AR.now(), by: '示範', note: '', ...extra });
  }
  async function addResponse(p, blob, name, extra) {
    const blobId = await AR.store.putBlob(blob);
    const { w, h } = await AR.img.sizeOfBlob(blob);
    p.responses.push({ id: AR.uid('rs_'), blobId, w, h, name, source: 'DEMO_response.docx', testId: '', subitemId: '', accelId: '', caption: '', include: true, ...extra });
  }

  async function create(onProgress = () => {}) {
    const M = AR.model;
    const p = M.newProject('示範：DEMO 伺服器 震動衝擊');
    Object.assign(p.info, {
      projectName: 'DEMO 2U', codeName: 'DM-2U-01', phase: 'DVT', sku: 'Config A (DEMO)', engineer: '（示範）', technician: 'DEMO',
      approval: 'DEMO', testDate: '2026/11/10~11/12', reportDate: '2026-11-12', revision: 'A01', lab: 'Third-party lab (DEMO)', labAddress: '',
    });
    const g1 = p.groups[0]; g1.name = 'NONOP Vib + Shock（交錯進行）';
    const g2 = { id: AR.uid('g_'), name: 'NONOP Sine-sweep Vibration' }; p.groups.push(g2);
    const rv = M.addTest(p, 'nonop_rv', g1.id), sq = M.addTest(p, 'nonop_sq', g1.id), sn = M.addTest(p, 'nonop_sine', g2.id);
    M.regroupByAxis(p);
    const sub = (t, dir) => t.subitems.find((s) => s.dir === dir).id;
    const n0 = p.nodes[0];
    const mk = (after) => { const n = { id: AR.uid('n_'), after, createdAt: AR.now() }; p.nodes.push(n); return n; };
    const nX = mk(sub(sq, '-X')), nY = mk(sub(sq, '-Y')), nZ = mk(sub(sq, '-Z')), nS = mk(sub(sn, 'Z'));
    const angles = AR.DEFAULTS.angles.map((a) => a.id);
    const partId = (name) => p.checklist.find((c) => c.name.startsWith(name)).id;
    const FAN = 'Fan module', MARK = 'Screw anti-loosening';
    const plan = [
      { n: n0, angles, loose: false, parts: true },
      { n: nX, angles: ['ang_open_top'], loose: true, parts: false },
      { n: nY, angles: ['ang_open_top'], loose: true, parts: false },
      { n: nZ, angles, loose: true, parts: true },
      { n: nS, angles, loose: true, parts: true },
    ];
    let k = 0;
    for (const step of plan) {
      onProgress(`產生示範照片 ${++k}/${plan.length}`);
      for (const a of step.angles) {
        await addPhoto(p, step.n.id, a, await drawAngle(a, { dx: Math.round(Math.random() * 40 - 20), dy: Math.round(Math.random() * 40 - 20), loose: step.loose && a === 'ang_open_top' }));
      }
      if (step.parts) {
        await addPhoto(p, step.n.id, partId(FAN), await drawPart('Fan module', 1), { note: 'L' });
        await addPhoto(p, step.n.id, partId(FAN), await drawPart('Fan module', 2), { note: 'R' });
        await addPhoto(p, step.n.id, partId(MARK), await drawPart('防鬆標記 Screw mark', 1, step.loose));
      }
    }
    onProgress('產生示範架設照');
    for (const t of [rv, sq, sn]) {
      for (const s of t.subitems) await addPhoto(p, null, 'setup', await drawSetup(s.setup || s.en, s.axis !== 'Z'), { subitemId: s.id });
    }
    // 母圖裁切框（在測試前節點畫好，其他節點自動套用）
    const R = (angleId, name, x, y, w, h, accel = false) => { const r = { id: AR.uid('r_'), angleId, name, rect: { x, y, w, h }, accel, baseNodeId: n0.id }; p.regions.push(r); return r; };
    R('ang_open_top', 'CPU heatsink', 0.28, 0.33, 0.22, 0.30);
    R('ang_open_top', 'DIMM', 0.50, 0.28, 0.16, 0.42);
    R('ang_open_top', 'PSU', 0.68, 0.57, 0.22, 0.31);
    const regScrew = R('ang_open_top', 'Fan bracket screw (anti-loosening mark)', 0.73, 0.27, 0.12, 0.14);
    const acc1 = R('ang_open_top', 'ACC-1 (fan bracket)', 0.78, 0.13, 0.09, 0.10, true);
    R('ang_closed_front', 'ACC-2 (front panel)', 0.10, 0.18, 0.09, 0.10, true);

    // 問題：-X（Rear）衝擊後發現風扇支架螺絲防鬆標記錯位，之後沒有惡化
    const phBefore = M.primaryPhoto(p, n0.id, 'ang_open_top'), phAfter = M.primaryPhoto(p, nX.id, 'ang_open_top');
    p.issues.push({ ...AR.newIssue({ subitemId: sub(sq, '-X'), foundNodeId: nX.id }), no: 1,
      part: 'Fan bracket screw', title: 'Anti-loosening mark of fan bracket screw shifted', severity: 'N/A', status: 'Record', defectNo: 'N/A',
      checkItem: 'All screws in proper torque',
      desc: 'After the -X (Rear) shock, the anti-loosening mark shifted about 30 degrees. No further change in the following tests. (DEMO text)',
      refs: [{ photoId: phBefore.id, regionId: regScrew.id }, { photoId: phAfter.id, regionId: regScrew.id }] });
    for (const s of M.allSubitems(p)) p.verdicts[s.id] = 'pass';
    p.verdicts[sub(sq, '-X')] = 'defect';

    // 響應圖：每個分項一張輸入波形（6.1），加速規一張響應（7.1）
    onProgress('產生示範響應圖');
    let seed = 1;
    for (const t of [rv, sq, sn]) {
      for (const s of t.subitems) await addResponse(p, await drawResponse(`${t.name} ${s.short}`, t.kind, seed++), `image${seed}.png`, { testId: t.id, subitemId: s.id });
    }
    await addResponse(p, await drawResponse('ACC-1 response', 'shock', 99), 'acc1.png', { testId: sq.id, accelId: acc1.id });
    p.config.torque = 'MB, HDD BP | 6\nTop cover | 6\nScrew of HSK | 9.2';
    await AR.store.putProject(p);
    return p;
  }

  return { create, drawAngle };
})();
