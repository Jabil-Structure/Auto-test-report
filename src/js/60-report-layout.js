/* 60-report-layout.js — Excel 報告輸出（公司格式：Shock & Vibration Engineering Report）。
 *
 * 版面依 8 份過往正式報告整理（2026-11-17 提供），工作表順序：
 *   Cover → Summary → 每個測項一頁（章節 1~8）→ Issue Lists → #01、#02…（每個問題一頁）
 * 欄寬、合併儲存格、顏色、字型都照過往報告；報告文字一律英文。
 * 系統內沒有的資料（4.1 配置表、4.2 扭力表若未貼上、8.2 卡片位移）會留空白格或 N/A，產生後在 Excel 補上。
 * 調整版面只改這個檔，其他模組不需要動。
 *
 * 輸入：project；輸出：xlsx 的 Blob。
 */
'use strict';

AR.report = (() => {
  const M = AR.model, D = AR.DEFAULTS;

  /* ---------- 樣式（取自過往報告） ---------- */
  const NAVY = 'FF002060', GREEN = 'FF92D050', YELLOW = 'FFFFFF00', RED = 'FFFF0000', SUMMARY_GREEN = 'FF00B050';
  const BLACK = 'FF000000', WHITE = 'FFFFFFFF', LINK = 'FF0563C1', GRAY = 'FF595959', BLUE = 'FF0070C0';
  // scheme:'minor' → 繁中 Excel 以主題字型（新細明體）顯示，外觀與過往報告相同
  const F = (size = 11, extra = {}) => ({ name: 'Calibri', family: 2, scheme: 'minor', size, ...extra });
  const FS = (size = 12, extra = {}) => ({ name: 'Calibri', family: 2, size, ...extra });   // Summary 頁用一般 Calibri
  const thin = { style: 'thin', color: { argb: BLACK } };
  const medium = { style: 'medium', color: { argb: BLACK } };
  const BOX = { top: thin, left: thin, bottom: thin, right: thin };
  const solid = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
  const STATUS_FILL = { pass: GREEN, defect: YELLOW, fail: RED };
  const STATUS_TEXT = { pass: 'Pass', defect: 'Defect', fail: 'Fail', skip: 'N/A' };
  const LEFT = { horizontal: 'left', vertical: 'middle' };
  const CENTER = { horizontal: 'center', vertical: 'middle' };
  const WRAP = { horizontal: 'left', vertical: 'middle', wrapText: true };
  const HEAD = { font: F(11, { color: { argb: WHITE } }), fill: NAVY, border: true, align: LEFT };

  /* ---------- 版面尺寸（px，96 DPI） ----------
   * 欄寬換算：繁中 Excel 的預設字型（新細明體）實測 1 單位欄寬 = 4.8 pt = 6.4 px。
   * 英文版 Excel（Calibri）欄位會寬約 9%，圖片只是多一點留白，不會重疊。
   * 列高（pt）與圖片大小（EMU）都是實際長度，垂直方向不受字型影響。 */
  const EMU = 9525;
  const colPx = (w) => w * 6.4;
  const pxToPt = (px) => px * 0.75;
  const CHAR_PX = 7;                                   // 估算換行用：11pt 英文平均字寬
  // 測項頁欄寬（照過往報告 NONOP Shock 頁）：A 為「Back」連結欄，內容在 B~L
  const TEST_COLS = [4.4, 8.9, 8.9, 13.9, 9.9, 8.9, 8.9, 11.4, 10.4, 8.9, 8.9, 8.9];
  const GRID = { w: 214, h: 160, groups: [[2, 4], [5, 8], [9, 12]] };   // 照片格：每列 3 張，說明文字分別合併 B:D、E:H、I:L
  const WIDE_BOX = { w: 380, h: 262 };                 // 6.1／7.1 左側 C~H
  const SIDE_BOX = { w: 222, h: 262 };                 // 6.1／7.1 右側 I~L
  const MAX_SIDE = { grid: 1200, wide: 1600, issue: 1600 };

  const fit = (w, h, mw, mh) => { const s = Math.min(mw / w, mh / h); return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) }; };
  const xOfCol = (cols, c) => cols.slice(0, c - 1).reduce((a, w) => a + colPx(w), 0);   // c：1 起算
  function anchorX(cols, x) {
    let acc = 0;
    for (let c = 0; c < cols.length; c++) {
      const w = colPx(cols[c]);
      if (x < acc + w) return { nativeCol: c, nativeColOff: Math.round((x - acc) * EMU) };
      acc += w;
    }
    return { nativeCol: cols.length - 1, nativeColOff: 0 };
  }
  /** 估計換行後需要的列高（Excel 不會自動調整合併儲存格的高度） */
  const textHeight = (text, charsPerLine, linePt = 15, minPt = 15) => {
    const lines = String(text || '').split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length / charsPerLine)), 0);
    return Math.max(minPt, lines * linePt + 3);
  };

  /* ---------- 儲存格工具 ---------- */
  function styleCell(cell, st) {
    cell.font = st.font || F();
    if (st.fill) cell.fill = solid(st.fill);
    if (st.border) cell.border = st.border === true ? BOX : st.border;
    cell.alignment = st.align || LEFT;
    if (st.numFmt) cell.numFmt = st.numFmt;
  }
  /** 寫入一格或一個合併範圍（範圍內每格都套樣式，框線才完整） */
  function put(ws, r1, c1, value, st = {}, r2 = r1, c2 = c1) {
    if (r2 > r1 || c2 > c1) ws.mergeCells(r1, c1, r2, c2);
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) styleCell(ws.getCell(r, c), st);
    const cell = ws.getCell(r1, c1);
    if (value !== undefined && value !== null && value !== '') cell.value = value;
    return cell;
  }
  const link = (text, target) => ({ text, hyperlink: `#${target}` });
  const sheetRef = (name) => `'${name.replace(/'/g, "''")}'!A1`;
  const LINK_FONT = (size = 11) => F(size, { underline: true, color: { argb: LINK } });

  function setupPage(ws, { area, landscape = false, footer, fitWidth = true, fitHeight = 0 }) {
    ws.pageSetup = {
      paperSize: 9, orientation: landscape ? 'landscape' : 'portrait', fitToPage: fitWidth, fitToWidth: 1, fitToHeight: fitHeight,
      printArea: area, horizontalCentered: true,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 },
    };
    const esc = (s) => String(s || '').replace(/&/g, '&&');
    ws.headerFooter = { oddFooter: `&L&8&K808080${esc(footer)}&C&8&K808080&P of &N&R&8&K808080Printed copies are reference only` };
  }
  const view = (zoom = 85) => [{ style: 'pageBreakPreview', zoomScale: zoom, zoomScaleNormal: zoom, showGridLines: false }];

  /** 工作表名稱：去掉 Excel 不允許的字元、最長 31 字、不重複 */
  function sheetName(s, used) {
    let n = String(s || 'Sheet').replace(/[\[\]:*?/\\]/g, ' ').replace(/^'+|'+$/g, '').trim().slice(0, 31) || 'Sheet';
    const base = n;
    let k = 2;
    while (used.has(n.toLowerCase())) n = `${base.slice(0, 27)} (${k++})`;
    used.add(n.toLowerCase());
    return n;
  }

  /* ---------- 圖片 ---------- */
  /** 照片轉成 workbook 圖片（同一張照片同一個裁切只放一次檔案，可在多個工作表重複使用） */
  async function photoPic(ctx, ph, rect, maxSide) {
    const key = `${ph.id}|${rect ? [rect.x, rect.y, rect.w, rect.h].map((v) => v.toFixed(4)).join(',') : 'full'}|${maxSide}`;
    if (ctx.cache.has(key)) return ctx.cache.get(key);
    const pic = await AR.img.withImage(ph.blobId, (im) => AR.img.render(im, rect, maxSide, 0.85));
    const out = { id: ctx.wb.addImage({ base64: pic.base64, extension: 'jpeg' }), w: pic.w, h: pic.h };
    ctx.cache.set(key, out);
    return out;
  }
  /** 響應圖：PNG／JPEG 原檔直接放（線條較清楚），其他格式或太大的轉成 JPEG */
  async function responsePic(ctx, r) {
    const key = 'resp|' + r.id;
    if (ctx.cache.has(key)) return ctx.cache.get(key);
    const blob = await AR.store.getBlob(r.blobId);
    if (!blob) return null;
    let out;
    const ext = { 'image/png': 'png', 'image/jpeg': 'jpeg' }[blob.type];
    if (ext && blob.size < 3e6 && r.w && r.h) {
      out = { id: ctx.wb.addImage({ base64: await AR.img.blobToBase64(blob), extension: ext }), w: r.w, h: r.h };
    } else {
      const pic = await AR.img.withImage(r.blobId, (im) => AR.img.render(im, null, MAX_SIDE.wide, 0.92));
      out = { id: ctx.wb.addImage({ base64: pic.base64, extension: 'jpeg' }), w: pic.w, h: pic.h };
    }
    ctx.cache.set(key, out);
    return out;
  }
  function place(ws, cols, pic, x, row, yOff, size) {
    ws.addImage(pic.id, {
      tl: { ...anchorX(cols, x), nativeRow: row - 1, nativeRowOff: Math.round(yOff * EMU) },
      ext: { width: size.w, height: size.h }, editAs: 'oneCell',
    });
  }

  /* ====================================================================== */

  async function generate(p, onProgress = () => {}) {
    M.migrate(p);
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Autoreport';
    wb.created = new Date();
    const footer = (await AR.store.getSetting('reportFooter')) ?? D.footer;
    const logoBlob = await AR.store.getSetting('reportLogo');
    let logo = null;
    if (logoBlob) {
      try {
        const sz = await AR.img.sizeOfBlob(logoBlob);
        const ext = logoBlob.type === 'image/png' ? 'png' : 'jpeg';
        logo = { id: wb.addImage({ base64: await AR.img.blobToBase64(logoBlob), extension: ext }), ...sz };
      } catch (e) { logo = null; }
    }
    const used = new Set();
    const ctx = { wb, p, footer, logo, used, cache: new Map(), sheetOf: new Map(), issueSheet: new Map(), onProgress };

    // 先決定所有工作表名稱（彼此有超連結）
    const names = { cover: sheetName('Cover', used), summary: sheetName('Summary', used) };
    p.tests.forEach((t) => ctx.sheetOf.set(t.id, sheetName(t.sheet || t.name, used)));
    names.issues = sheetName('Issue Lists', used);
    p.issues.forEach((i) => ctx.issueSheet.set(i.id, sheetName(M.issueTag(i), used)));
    ctx.names = names;

    onProgress('封面與總表');
    coverSheet(ctx);
    summarySheet(ctx);
    for (const t of p.tests) {
      onProgress(`測項頁：${t.name}`);
      await testSheet(ctx, t);
    }
    onProgress('問題清單');
    issueListSheet(ctx);
    for (const iss of p.issues) {
      onProgress(`問題 ${M.issueTag(iss)}`);
      await issueSheet(ctx, iss);
    }
    onProgress('寫入檔案');
    const buf = await cleanXlsx(await wb.xlsx.writeBuffer());
    return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  /** ExcelJS 寫出的工作表內部連結是「外部連結＋#位置」，Excel 會判定參照無效。
   *  這裡改成標準寫法：只留 location（不含 #），並移除多餘的外部關聯。 */
  async function cleanXlsx(buf) {
    const zip = await JSZip.loadAsync(buf);
    const sheets = Object.keys(zip.files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
    for (const n of sheets) {
      let xml = await zip.file(n).async('string');
      const ids = [];
      xml = xml.replace(/<hyperlink ref="([^"]+)" r:id="([^"]+)" location="#([^"]*)"\s*\/>/g, (m, ref, rid, loc) => {
        ids.push(rid);
        return `<hyperlink ref="${ref}" location="${loc}"/>`;
      });
      if (!ids.length) continue;
      zip.file(n, xml);
      const relPath = n.replace('xl/worksheets/', 'xl/worksheets/_rels/') + '.rels';
      const rf = zip.file(relPath);
      if (!rf) continue;
      let rels = await rf.async('string');
      for (const id of ids) rels = rels.replace(new RegExp(`<Relationship Id="${id}"[^>]*/>`), '');
      zip.file(relPath, rels);
    }
    return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  }

  /** 報告檔名（照過往報告的命名方式） */
  function fileName(p) {
    const i = p.info || {};
    const d = (i.reportDate || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
    const head = [i.projectName || p.name, i.phase, i.sku].filter(Boolean).join('_');
    return `${head}_SV Eng Report_${i.revision || 'A01'} ${d}.xlsx`.replace(/[\\/:*?"<>|]+/g, '_');
  }

  /* ---------- Cover ---------- */
  function coverSheet(ctx) {
    const { wb, p } = ctx;
    const ws = wb.addWorksheet(ctx.names.cover, { views: view(85) });
    const cols = Array(10).fill(9.3);
    cols.forEach((w, i) => (ws.getColumn(i + 1).width = w));
    if (ctx.logo) place(ws, cols, ctx.logo, 62, 3, 16, fit(ctx.logo.w, ctx.logo.h, 549, 95));
    put(ws, 13, 1, 'Shock & Vibration Engineering Report', { font: F(28), align: CENTER }, 13, 10);
    ws.getRow(13).height = 37;
    const i = p.info;
    put(ws, 16, 1, [i.projectName || p.name, i.phase].filter(Boolean).join(' @ '), { font: F(18), align: CENTER }, 16, 10);
    ws.getRow(16).height = 23;
    p.tests.forEach((t, k) => {
      put(ws, 17 + k, 1, t.name, { font: F(16), align: CENTER }, 17 + k, 10);
      ws.getRow(17 + k).height = 23;
    });
    setupPage(ws, { area: `A1:J${Math.max(49, 20 + p.tests.length)}`, footer: ctx.footer, fitHeight: 1 });
  }

  /* ---------- Summary ---------- */
  function photoDates(p, t) {
    const ids = new Set(t.subitems.map((s) => s.id));
    const nodeIds = new Set(p.nodes.filter((n) => n.after && ids.has(n.after)).map((n) => n.id));
    const days = [...new Set(p.photos.filter((ph) => nodeIds.has(ph.nodeId) || (ph.itemId === 'setup' && ids.has(ph.subitemId)))
      .map((ph) => (ph.takenAt || '').slice(0, 10)).filter(Boolean))].sort();
    return days.map((d) => `${+d.slice(5, 7)}/${+d.slice(8, 10)}`).join('、');
  }

  function summarySheet(ctx) {
    const { wb, p } = ctx;
    const ws = wb.addWorksheet(ctx.names.summary, { views: view(100) });
    const cols = [3.7, 8.9, 8.9, 8.9, 8.9, 8.9, 8.9, 9.5, 9.5, 9.5, 18.1];
    cols.forEach((w, i) => (ws.getColumn(i + 1).width = w));
    const i = p.info;
    put(ws, 2, 1, i.projectName || p.name, { font: FS(20, { bold: true }), border: true, align: LEFT }, 3, 7);
    put(ws, 2, 8, [i.phase, i.sku].filter(Boolean).join(' / '), { font: FS(12), border: true, align: CENTER }, 2, 11);
    put(ws, 3, 8, i.testDate || '', { font: FS(12), border: true, align: CENTER }, 3, 11);
    put(ws, 4, 1, 'Overall Progress', { font: FS(20), border: true, align: CENTER }, 5, 5);
    const first = 6, rows = [{ name: 'System setup' }, ...p.tests.map((t) => ({ t }))];
    const last = first + rows.length - 1;
    const prog = p.tests.length ? p.tests.reduce((a, t) => a + M.testProgress(p, t), 0) / p.tests.length : 0;
    put(ws, 4, 6, { formula: `IFERROR(SUM(I${first + 1}:I${last})/COUNTA(H${first + 1}:H${last}),0)`, result: prog },
      { font: FS(20, { color: { argb: WHITE } }), fill: BLUE, border: true, align: CENTER, numFmt: '0%' }, 5, 7);
    put(ws, 4, 8, i.sku || 'Testing SKU', { font: FS(12, { bold: true }), border: { top: medium, left: medium, right: medium, bottom: thin }, align: CENTER }, 4, 11);
    ['Sequence', 'Progress', 'Status', 'Date'].forEach((h, k) => put(ws, 5, 8 + k, h, { font: FS(10), border: true, align: CENTER }));
    // 依時間軸決定執行順序（Sequence）
    const order = [...p.tests].sort((a, b) => Math.min(...a.subitems.map((s) => p.timeline.indexOf(s.id)))
      - Math.min(...b.subitems.map((s) => p.timeline.indexOf(s.id))));
    rows.forEach((row, k) => {
      const r = first + k;
      ws.getRow(r).height = 22;
      put(ws, r, 1, k + 1, { font: FS(12), border: true, align: LEFT });
      if (!row.t) {
        put(ws, r, 2, row.name, { font: FS(12), border: true }, r, 7);
        put(ws, r, 8, '#1', { font: FS(12), border: true, align: CENTER });
        [9, 10, 11].forEach((c) => put(ws, r, c, '', { font: FS(12), border: true, align: CENTER }));
        return;
      }
      const t = row.t, st = M.testStatus(p, t);
      put(ws, r, 2, link(t.name, sheetRef(ctx.sheetOf.get(t.id))), { font: FS(12, { underline: true, color: { argb: LINK } }), border: true }, r, 7);
      put(ws, r, 8, `#${order.indexOf(t) + 2}`, { font: FS(12), border: true, align: CENTER });
      put(ws, r, 9, M.testProgress(p, t), { font: FS(12), border: true, align: CENTER, numFmt: '0%' });
      put(ws, r, 10, STATUS_TEXT[st] || '', { font: FS(12), border: true, align: CENTER, fill: st === 'pass' ? SUMMARY_GREEN : STATUS_FILL[st] });
      put(ws, r, 11, photoDates(p, t), { font: FS(12), border: true, align: CENTER });
    });
    setupPage(ws, { area: `A1:K${last + 1}`, landscape: true, footer: ctx.footer });
  }

  /* ---------- 測項頁 ---------- */
  async function testSheet(ctx, t) {
    const { wb, p } = ctx;
    const name = ctx.sheetOf.get(t.id);
    const ws = wb.addWorksheet(name, { views: view(85) });
    const cols = TEST_COLS;
    cols.forEach((w, i) => (ws.getColumn(i + 1).width = w));
    const LAST = 12;                                  // L 欄
    const i = p.info;
    const g = p.groups.find((x) => x.id === t.groupId) || p.groups[0];
    const a = M.assignment(p, g.id);
    const inc = (key) => a.include[key] !== false;
    const subs = M.orderedSubitems(p, t);
    const status = M.testStatus(p, t);
    let r = 1;

    /* 封面區（第 1 頁） */
    put(ws, 1, 1, link('Back', sheetRef(ctx.names.summary)), { font: LINK_FONT(10) });
    if (ctx.logo) place(ws, cols, ctx.logo, xOfCol(cols, 3) + 24, 4, 2, fit(ctx.logo.w, ctx.logo.h, 528, 102));
    put(ws, 11, 2, 'Shock & Vibration Engineering Report', { font: F(28), align: CENTER }, 11, LAST);
    ws.getRow(11).height = 37;
    put(ws, 16, 2, t.name, { font: F(18), align: CENTER }, 16, LAST);
    put(ws, 17, 2, [i.projectName || p.name, i.sku].filter(Boolean).join(' '), { font: F(18), align: CENTER }, 17, LAST);
    ws.getRow(16).height = 23; ws.getRow(17).height = 23;
    [['PASS', GREEN, 'pass'], ['DEFECT', YELLOW, 'defect'], ['FAILURE', RED, 'fail']].forEach(([txt, color, key], k) => {
      put(ws, 21 + k, 6, status === key ? 'v' : '', { border: true, align: CENTER });
      put(ws, 21 + k, 7, txt, { fill: color, border: true, align: CENTER }, 21 + k, 8);
    });
    // 左欄 C~G、右欄 H~L（位置照過往報告）
    const infoL = [['Project Name:', i.projectName || p.name], ['Code Name:', i.codeName], ['Phase:', i.phase], ['Engineer:', i.engineer], ['Technician:', i.technician]];
    const infoR = [null, null, ['Approval:', i.approval], ['Testing Date:', i.testDate], ['Report Date:', i.reportDate ? i.reportDate.replace(/-/g, '/') : '']];
    infoL.forEach(([l, v], k) => { put(ws, 33 + k, 3, l, {}, 33 + k, 4); put(ws, 33 + k, 5, v || '', {}, 33 + k, 7); });
    infoR.forEach((x, k) => { if (x) { put(ws, 33 + k, 8, x[0], {}, 33 + k, 9); put(ws, 33 + k, 10, x[1] || '', {}, 33 + k, LAST); } });
    put(ws, 40, 2, 'Revision History');
    put(ws, 41, 2, 'Date', HEAD, 41, 3); put(ws, 41, 4, 'Revision', HEAD); put(ws, 41, 5, 'Explanation of Changes', HEAD, 41, 10); put(ws, 41, 11, 'Author', HEAD, 41, LAST);
    for (let k = 0; k < 4; k++) {
      const rr = 42 + k, first = k === 0;
      put(ws, rr, 2, first && i.reportDate ? i.reportDate.replace(/-/g, '/') : '', { border: true }, rr, 3);
      put(ws, rr, 4, first ? i.revision || 'A01' : '', { border: true });
      put(ws, rr, 5, first ? 'First release' : '', { border: true }, rr, 10);
      put(ws, rr, 11, first ? i.engineer || '' : '', { border: true }, rr, LAST);
    }
    ws.getRow(47).addPageBreak();
    r = 49;

    /* 共用的區塊工具 */
    const xB = xOfCol(cols, 2), contentW = xOfCol(cols, LAST + 1) - xB;   // B~L 的位置與寬度
    const heading = (text) => { put(ws, r, 2, text, { font: F(18) }, r, LAST); ws.getRow(r).height = 30; r++; };
    const subhead = (text, st = {}) => { put(ws, r, 2, text, { font: F(11), ...st }, r, LAST); r++; };
    const para = (text) => { put(ws, r, 2, text, { align: WRAP }, r, LAST); ws.getRow(r).height = textHeight(text, Math.floor(contentW / CHAR_PX)); r++; };
    const gap = (n = 1) => { r += n; };
    const spansFor = (n) => ({
      1: [[2, LAST]], 2: [[2, 5], [6, 7]], 3: [[2, 4], [5, 8], [9, LAST]], 4: [[2, 4], [5, 6], [7, 8], [9, 10]],
      5: [[2, 3], [4, 4], [5, 6], [7, 9], [10, LAST]], 6: [[2, 3], [4, 4], [5, 6], [7, 7], [8, 9], [10, LAST]],
      7: [[2, 3], [4, 4], [5, 5], [6, 8], [9, 9], [10, 10], [11, LAST]],
    }[n] || Array.from({ length: n }, (_, k) => { const c = 2 + Math.floor((k * 11) / n); const e = 1 + Math.floor(((k + 1) * 11) / n); return [c, e]; }));
    const charsOf = (span) => Math.max(4, Math.floor((cols.slice(span[0] - 1, span[1]).reduce((s, w) => s + colPx(w), 0) - 6) / CHAR_PX));
    /** 表格：rows[0] 為標題列（navy），其餘為內容 */
    const table = (rows, { spans = null, minRows = 0, cellStyle = () => ({}) } = {}) => {
      if (!rows.length) return;
      const n = Math.max(...rows.map((x) => x.length));
      const sp = spans || spansFor(n);
      const body = rows.slice(1);
      while (body.length < minRows) body.push([]);
      [rows[0], ...body].forEach((cells, k) => {
        let hpt = 15;
        sp.forEach((s, c) => {
          const v = cells[c] ?? '';
          const st = k === 0 ? { ...HEAD, align: { ...LEFT, wrapText: true } } : { border: true, align: { ...LEFT, wrapText: true }, ...cellStyle(k - 1, c, v) };
          put(ws, r, s[0], v, st, r, s[1]);
          hpt = Math.max(hpt, textHeight(v, charsOf(s)));
        });
        ws.getRow(r).height = hpt;
        r++;
      });
    };

    /** 照片格：每列 3 張平均分布，照片下方一列放說明文字 */
    const CAP = { font: F(9, { color: { argb: GRAY } }), align: { horizontal: 'center', vertical: 'top', wrapText: true } };
    const photoGrid = async (shots) => {
      const slot = contentW / 3;
      for (let k = 0; k < shots.length; k += 3) {
        const chunk = shots.slice(k, k + 3);
        let hmax = 20;
        for (let j = 0; j < chunk.length; j++) {
          const pic = await chunk[j].pic();
          if (!pic) continue;
          const sz = fit(pic.w, pic.h, GRID.w, GRID.h);
          place(ws, cols, pic, xB + j * slot + (slot - sz.w) / 2, r, 4, sz);
          hmax = Math.max(hmax, sz.h);
        }
        ws.getRow(r).height = pxToPt(hmax + 8);
        r++;
        if (chunk.some((s) => s.caption)) {
          chunk.forEach((s, j) => put(ws, r, GRID.groups[j][0], s.caption || '', CAP, r, GRID.groups[j][1]));
          ws.getRow(r).height = chunk.some((s) => (s.caption || '').length > 34) ? 24 : 13;
          r++;
        }
      }
    };
    /** 一個節點的照片，整理成「整機外觀＋各零件」區塊 */
    const componentBlocks = (nodeId) => {
      if (!nodeId) return [];
      const blocks = [];
      const views = [];
      for (const c of M.enabledItems(p, ['angle'])) {
        if (!inc('item:' + c.id)) continue;
        M.photosOf(p, nodeId, c.id).forEach((ph, k) => views.push({ caption: `${c.en || c.name}${k ? ` (${k + 1})` : ''}`, pic: () => photoPic(ctx, ph, null, MAX_SIDE.grid) }));
      }
      if (views.length) blocks.push({ title: 'System views', shots: views });
      // 零件：同名的裁切框與單獨拍攝項目放在同一區
      const byName = new Map();
      const keyOf = (s) => String(s).trim().toLowerCase();
      const comp = (nm) => { const k = keyOf(nm); if (!byName.has(k)) byName.set(k, { title: nm, shots: [] }); return byName.get(k); };
      M.enabledItems(p, ['part']).forEach((c) => comp(c.name));
      for (const rg of p.regions) {
        if (rg.accel || !inc('region:' + rg.id)) continue;
        const ph = M.primaryPhoto(p, nodeId, rg.angleId);
        if (!ph) continue;
        comp(rg.name).shots.push({ caption: `${rg.name} - ${M.itemNameEn(p, rg.angleId)}`, pic: () => photoPic(ctx, ph, M.regionRect(p, rg, ph.id), MAX_SIDE.grid) });
      }
      for (const c of M.enabledItems(p, ['part'])) {
        if (!inc('item:' + c.id)) continue;
        const list = M.photosOf(p, nodeId, c.id);
        list.forEach((ph, k) => comp(c.name).shots.push({ caption: ph.note || (list.length > 1 ? `(${k + 1})` : ''), pic: () => photoPic(ctx, ph, null, MAX_SIDE.grid) }));
      }
      byName.forEach((b) => { if (b.shots.length) blocks.push(b); });
      return blocks;
    };

    /* 1. Purposes */
    heading('1. Purposes');
    String(t.purpose || '').split('\n').filter((l) => l.trim()).forEach((l, k) => para(`1.${k + 1} ${l.trim()}`));
    gap();

    /* 2. Specification */
    heading('2. Specification');
    para(`2.1 ${t.spec || ''}`);
    subhead('2.2 Profile');
    table(M.parseTable(t.profile));
    gap();

    /* 3. Lab & Equipment */
    heading('3. Lab & Equipment');
    put(ws, r, 2, 'Test Lab', HEAD, r, 3); put(ws, r, 4, i.lab || '', { border: true }, r, 11); r++;
    put(ws, r, 2, 'Lab Address', HEAD, r, 3); put(ws, r, 4, i.labAddress || '', { border: true, align: WRAP }, r, 11);
    ws.getRow(r).height = textHeight(i.labAddress, 80); r++;
    gap();
    table(M.parseTable(t.equipment), { minRows: 1 });
    gap(2);

    /* 4. Configurations */
    heading('4. Configurations');
    subhead('4.1 Detail Configuration Table', { border: { bottom: thin } });
    const cfg = M.parseTable(p.config.table);
    if (cfg.length && /^component/i.test(cfg[0][0] || '')) cfg.shift();
    const cfgRows = cfg.length ? cfg : [['SKU Description', '', '', i.sku || '']];
    table([M.parseTable(D.configHead)[0], ...cfgRows], { minRows: cfg.length ? 0 : 8 });
    gap();
    subhead('4.2 Torque of screws while setup');
    const tq = M.parseTable(p.config.torque);
    if (tq.length && /^position/i.test(tq[0][0] || '')) tq.shift();
    table([M.parseTable(D.torqueHead)[0], ...tq], { minRows: tq.length ? 0 : 4 });
    gap();
    subhead('4.3 Pictures - system top/front/rear/left/right views and critical components need to be highlighted');
    const before = componentBlocks(a.before);
    if (!before.length) subhead(a.before ? '(No pre-test pictures selected.)' : '(Pre-test photo set is not assigned.)', { font: F(11, { italic: true, color: { argb: GRAY } }) });
    let k43 = 0;
    for (const b of before) {
      gap();
      subhead(`4.3.${++k43} ${b.title}`);
      await photoGrid(b.shots);
    }
    gap(2);

    /* 5. Results Summary */
    heading('5. Results Summary');
    subhead('5.1 Summary Table', { border: { bottom: thin } });
    const head51 = ['Sequence', 'G Level', 'Face / Axis', 'Pass / Defect / Fail', 'Pre/Post-Functional Check', 'Note'];
    const sp51 = [[2, 2], [3, 4], [5, 6], [7, 8], [9, 10], [11, LAST]];
    const rows51 = subs.map((s, k) => {
      const v = p.verdicts[s.id] || '';
      const sn = p.subNotes[s.id] || {};
      const iss = M.issuesOf(p, s.id).map(M.issueTag);
      return [`#${k + 1}`, t.level || '', s.en, STATUS_TEXT[v] || '', sn.func ?? (v && v !== 'fail' ? 'normal' : ''), [sn.note, iss.length ? `Issue ${iss.join(', ')}` : ''].filter(Boolean).join('; ')];
    });
    table([head51, ...rows51], {
      spans: sp51,
      cellStyle: (k, c) => {
        const v = p.verdicts[subs[k].id] || '';
        if (c === 0) return { align: CENTER };
        if (c === 3 && STATUS_FILL[v]) return { fill: STATUS_FILL[v] };
        return {};
      },
    });
    gap();
    subhead('5.2 Result Details / Suggestions & Comments');
    put(ws, r, 2, link('Refer to the sheet "Issue Lists"', sheetRef(ctx.names.issues)), { font: LINK_FONT() }, r, 8); r++;
    gap(2);

    /* 6. Testing Setup & Functional Testing Tools */
    heading('6. Testing Setup & Functional Testing Tools');
    subhead('6.1 Testing Setup');
    put(ws, r, 2, 'Face/Axial', HEAD); put(ws, r, 3, 'UUT Setup & Control Accelerometer(s) Setup', HEAD, r, 8); put(ws, r, 9, 'Input Waveforms', HEAD, r, LAST); r++;
    const xWide = xOfCol(cols, 3), xSide = xOfCol(cols, 9), wideW = xSide - xWide, sideW = xOfCol(cols, LAST + 1) - xSide;
    /** 標籤（直書）＋左圖＋右側多張圖（直向堆疊） */
    const setupRow = async (label, leftPics, rightPics) => {
      const n = Math.max(1, leftPics.length);
      const top = r;
      // 右側：寬度固定，依序往下排
      const rights = [];
      for (const rp of rightPics) { const pic = await rp(); if (pic) rights.push({ pic, sz: fit(pic.w, pic.h, SIDE_BOX.w, SIDE_BOX.h) }); }
      const rightH = rights.reduce((s, x) => s + x.sz.h + 6, 0);
      for (let k = 0; k < n; k++) {
        const pic = leftPics[k] ? await leftPics[k]() : null;
        const sz = pic ? fit(pic.w, pic.h, WIDE_BOX.w, WIDE_BOX.h) : { w: 0, h: 0 };
        const hpx = Math.max(WIDE_BOX.h + 12, sz.h + 12, k === 0 ? rightH + 12 : 0);
        ws.getRow(r).height = pxToPt(hpx);
        put(ws, r, 3, pic ? '' : (k === 0 ? 'N/A' : ''), { border: true, align: CENTER, font: F(11, { color: { argb: GRAY } }) }, r, 8);
        put(ws, r, 9, k === 0 && !rights.length ? 'N/A' : '', { border: true, align: CENTER, font: F(11, { color: { argb: GRAY } }) }, r, LAST);
        if (pic) place(ws, cols, pic, xWide + (wideW - sz.w) / 2, r, 6, sz);
        if (k === 0) { let y = 6; for (const x of rights) { place(ws, cols, x.pic, xSide + (sideW - x.sz.w) / 2, r, y, x.sz); y += x.sz.h + 6; } }
        r++;
      }
      put(ws, top, 2, label, { border: true, align: { horizontal: 'center', vertical: 'middle', textRotation: 90, wrapText: true } }, r - 1, 2);
    };
    for (const s of subs) {
      const sps = M.setupPhotos(p, s.id).map((ph) => () => photoPic(ctx, ph, null, MAX_SIDE.wide));
      const waves = p.responses.filter((x) => x.include !== false && x.testId === t.id && x.subitemId === s.id && !x.accelId).map((x) => () => responsePic(ctx, x));
      await setupRow(s.setup || s.en, sps, waves);
    }
    gap();
    subhead('6.2 Functional Testing Tools');
    table(M.parseTable(t.tools));
    gap(2);

    /* 7. Accelerometer Setup and Responses */
    heading('7. Accelerometer Setup and Responses');
    subhead('7.1 Accelerometer Setup & Responses');
    put(ws, r, 2, 'Face/Axial', HEAD); put(ws, r, 3, 'Accelerometer Setup', HEAD, r, 8); put(ws, r, 9, 'Response', HEAD, r, LAST); r++;
    const accels = p.regions.filter((rg) => rg.accel);
    const accelNode = a.before || (M.sortedNodes(p)[0] || {}).id;
    for (const rg of accels) {
      const ph = M.primaryPhoto(p, accelNode, rg.angleId) || p.photos.find((x) => x.itemId === rg.angleId);
      const left = ph ? [async () => {
        const key = `accel|${rg.id}|${ph.id}`;
        if (ctx.cache.has(key)) return ctx.cache.get(key);
        const pic = await AR.img.withImage(ph.blobId, (im) => AR.img.accelComposite(im, [M.regionRect(p, rg, ph.id)]));
        const out = { id: wb.addImage({ base64: pic.base64, extension: 'jpeg' }), w: pic.w, h: pic.h };
        ctx.cache.set(key, out);
        return out;
      }] : [];
      const resp = p.responses.filter((x) => x.include !== false && x.accelId === rg.id && (!x.testId || x.testId === t.id)).map((x) => () => responsePic(ctx, x));
      await setupRow(rg.name, left, resp);
    }
    const others = p.responses.filter((x) => x.include !== false && x.testId === t.id && !x.subitemId && !x.accelId);
    for (let k = 0; k < others.length; k += 2) {
      const pair = others.slice(k, k + 2).map((x) => () => responsePic(ctx, x));
      await setupRow('Response', pair.slice(0, 1), pair.slice(1));
    }
    if (!accels.length && !others.length) await setupRow('', [], []);
    gap(2);

    /* 8. Testing Detail Results, Issues and Defects Record */
    heading('8. Testing Detail Results, Issues and Defects Record');
    subhead('8.1 Checklist but not limited to below items');
    const checkCols = ['Pre-test', ...subs.map((s) => s.short), 'Post-test'];
    const lastCheckCol = Math.min(LAST, 5 + checkCols.length - 1);
    put(ws, r, 2, 'Check Item', HEAD, r, 4);
    checkCols.forEach((h, k) => put(ws, r, 5 + k, h, { ...HEAD, align: { ...CENTER, wrapText: true } }));
    ws.getRow(r).height = 30; r++;
    const allJudged = subs.every((s) => p.verdicts[s.id]);
    for (const it of M.parseCheckItems(p.checkItems)) {
      if (it.group) {
        put(ws, r, 2, it.name, { font: F(14, { bold: true, italic: true, color: { argb: WHITE } }), fill: BLACK, border: true, align: CENTER }, r, lastCheckCol);
        ws.getRow(r).height = 20; r++;
        continue;
      }
      put(ws, r, 2, it.name, { border: true, align: WRAP }, r, 4);
      ws.getRow(r).height = textHeight(it.name, 34);
      put(ws, r, 5, a.before ? 'checked' : '', { border: true, align: CENTER });
      subs.forEach((s, k) => {
        const v = p.verdicts[s.id] || '';
        const hit = M.issuesOf(p, s.id).filter((x) => x.checkItem && x.checkItem.trim().toLowerCase() === it.name.trim().toLowerCase());
        let txt = '', fillc = null;
        if (hit.length) { const bad = v === 'fail' ? 'fail' : 'defect'; txt = `${STATUS_TEXT[bad]} ${hit.map(M.issueTag).join(',')}`; fillc = STATUS_FILL[bad]; }
        else if (v === 'skip') txt = 'N/A';
        else if (v) { txt = 'pass'; fillc = GREEN; }
        put(ws, r, 6 + k, txt, { border: true, align: CENTER, fill: fillc });
      });
      put(ws, r, 6 + subs.length, a.after && allJudged ? 'checked' : '', { border: true, align: CENTER });
      r++;
    }
    gap();
    subhead('8.2 Card movement measurement');
    put(ws, r, 2, 'N/A', { border: true, align: CENTER, font: F(11, { color: { argb: GRAY } }) }, r + 1, LAST); r += 2;
    gap();
    subhead('8.3 Post-check record');
    const after = componentBlocks(a.after);
    if (!after.length) subhead(a.after ? '(No post-test pictures selected.)' : '(Post-test photo set is not assigned.)', { font: F(11, { italic: true, color: { argb: GRAY } }) });
    let k83 = 0;
    for (const b of after) {
      subhead(`${++k83}. ${b.title}`);
      await photoGrid(b.shots);
      gap();
    }
    subhead('8.4 Issues and Defects');
    put(ws, r, 2, link('Refer to the sheet "Issue Lists"', sheetRef(ctx.names.issues)), { font: LINK_FONT() }, r, 8); r++;

    setupPage(ws, { area: `A1:L${r + 1}`, footer: ctx.footer });
  }

  /* ---------- Issue Lists ---------- */
  function issueListSheet(ctx) {
    const { wb, p } = ctx;
    const ws = wb.addWorksheet(ctx.names.issues, { views: view(85) });
    const cols = [4.4, 5.4, 15.1, 10.9, 13.1, 18.7, 21.3, 23.9, 18.3, 41.9];
    cols.forEach((w, k) => (ws.getColumn(k + 1).width = w));
    put(ws, 1, 1, link('Back', sheetRef(ctx.names.summary)), { font: LINK_FONT(10) });
    const head = ['#', 'Defect Number', 'Severity', 'Issue Status', 'Testing SKU', 'Defect/Failure Part', 'Testing Item', 'Face / Axis', 'Descriptions'];
    head.forEach((h, k) => put(ws, 2, 2 + k, h, { font: F(12, { color: { argb: WHITE } }), fill: NAVY, border: true, align: WRAP }));
    ws.getRow(2).height = 25;
    let r = 3;
    for (const iss of p.issues) {
      const s = M.subitem(p, iss.subitemId);
      const vals = [iss.defectNo || 'N/A', iss.severity || 'N/A', iss.status || 'Record', p.info.sku || '', iss.part || '',
        s ? s.test.name : '', s ? s.en : '', iss.title || String(iss.desc || '').split('\n')[0]];
      put(ws, r, 2, link(M.issueTag(iss), sheetRef(ctx.issueSheet.get(iss.id))), { font: LINK_FONT(), border: true, align: WRAP });
      vals.forEach((v, k) => put(ws, r, 3 + k, v, { border: true, align: k < 2 ? { ...CENTER, wrapText: true } : WRAP }));
      ws.getRow(r).height = Math.max(15, textHeight(vals[7], 40), textHeight(vals[5], 22));
      r++;
    }
    if (!p.issues.length) { put(ws, r, 2, 'No issue was found in this test.', { border: true, align: LEFT }, r, 10); r++; }
    for (let k = 0; k < 5; k++, r++) for (let c = 2; c <= 10; c++) put(ws, r, c, '', { border: true });
    ws.autoFilter = { from: { row: 2, column: 2 }, to: { row: Math.max(3, r - 1), column: 10 } };
    setupPage(ws, { area: `A1:J${r}`, landscape: true, footer: ctx.footer });
  }

  /* ---------- 每個問題一頁 ---------- */
  async function issueSheet(ctx, iss) {
    const { wb, p } = ctx;
    const ws = wb.addWorksheet(ctx.issueSheet.get(iss.id), { views: view(100) });
    const cols = [5.4, 22.1, 44.4, 44.4, 4.0];
    cols.forEach((w, k) => (ws.getColumn(k + 1).width = w));
    const LBL = { font: F(12, { color: { argb: WHITE } }), fill: NAVY, border: true, align: { horizontal: 'right', vertical: 'top', wrapText: true } };
    const VAL = { border: true, align: { horizontal: 'left', vertical: 'top', wrapText: true } };
    const s = M.subitem(p, iss.subitemId);
    put(ws, 1, 1, link('Back', sheetRef(ctx.names.issues)), { font: LINK_FONT(12) });
    put(ws, 1, 2, `issue ${iss.no}`, { font: F(12, { color: { argb: WHITE } }), fill: NAVY, border: true, align: CENTER }, 1, 4);
    let r = 2;
    const lblChars = Math.floor((colPx(cols[1]) - 6) / 6.3), valChars = Math.floor((colPx(cols[2]) * 2 - 6) / CHAR_PX);
    const field = (label, value) => {
      put(ws, r, 2, label, LBL);
      put(ws, r, 3, value || 'N/A', VAL, r, 4);
      ws.getRow(r).height = Math.max(textHeight(value || 'N/A', valChars, 15, 20), textHeight(label, lblChars, 16, 20));
      r++;
    };
    field('Testing SKU', p.info.sku);
    field('Defect/Failure Part', iss.part);
    field('Testing Item', s ? s.test.name : '');
    field('Face / Axis', s ? s.en : '');
    field('Descriptions', [iss.title, iss.desc].filter(Boolean).join('\n'));
    // Illustrations：每列 2 張，照片下方一列說明
    const top = r;
    const refs = (iss.refs || []).map((ref) => ({ ref, ph: p.photos.find((x) => x.id === ref.photoId) })).filter((x) => x.ph);
    const xs = [xOfCol(cols, 3), xOfCol(cols, 4)];
    const box = { w: Math.floor(colPx(cols[2]) - 14), h: 210 };
    if (!refs.length) { put(ws, r, 3, 'N/A', VAL, r, 4); ws.getRow(r).height = 20; r++; }
    for (let k = 0; k < refs.length; k += 2) {
      const pair = refs.slice(k, k + 2);
      let hmax = 40;
      for (let j = 0; j < pair.length; j++) {
        const { ref, ph } = pair[j];
        const rg = ref.regionId && p.regions.find((x) => x.id === ref.regionId);
        const pic = await photoPic(ctx, ph, rg ? M.regionRect(p, rg, ph.id) : null, MAX_SIDE.issue);
        const sz = fit(pic.w, pic.h, box.w, box.h);
        place(ws, cols, pic, xs[j] + (colPx(cols[2]) - sz.w) / 2, r, 6, sz);
        hmax = Math.max(hmax, sz.h);
      }
      put(ws, r, 3, '', { border: { left: thin, top: thin } }); put(ws, r, 4, '', { border: { right: thin, top: thin } });
      ws.getRow(r).height = pxToPt(hmax + 12);
      r++;
      pair.forEach(({ ref, ph }, j) => {
        const rg = ref.regionId && p.regions.find((x) => x.id === ref.regionId);
        put(ws, r, 3 + j, `${M.nodeLabelEn(p, ph.nodeId)} | ${rg ? rg.name : M.itemNameEn(p, ph.itemId)}`, { font: F(9, { color: { argb: GRAY } }), align: { horizontal: 'center', vertical: 'top', wrapText: true }, border: { bottom: thin, [j ? 'right' : 'left']: thin } });
      });
      if (pair.length === 1) put(ws, r, 4, '', { border: { bottom: thin, right: thin } });
      ws.getRow(r).height = 26;
      r++;
    }
    put(ws, top, 2, 'Illustrations', LBL, r - 1, 2);
    field('Root Cause Analysis', iss.rootCause);
    field('Suggestion & Recommendation', iss.suggestion);
    field('Implemented Solutions', iss.solution);
    field('Verify Result', iss.verifyResult);
    setupPage(ws, { area: `A1:E${r}`, footer: ctx.footer });
  }

  return { generate, fileName };
})();
