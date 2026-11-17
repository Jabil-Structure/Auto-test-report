/* 60-report-layout.js — Excel 報告輸出。
 *
 * ⚠️【暫定版面】公司真實 Excel 範本尚未提供，這裡的版面是自行設計的佔位版。
 * 拿到範本後，只需要改寫這個檔案：
 *   - 以 ExcelJS 讀入範本（workbook.xlsx.load(範本檔)），找到固定位置（建議在範本裡用「名稱」標記儲存格）
 *   - 照片多時用 ws.spliceRows / insertRow 插入列，把後面的內容往下推
 * 其他模組（資料、裁切、判定）不需要改。
 *
 * 輸入：project；輸出：xlsx 的 Blob。
 */
'use strict';

AR.report = (() => {
  const M = AR.model;
  const PX_PER_CHAR = 7.2;           // Excel 欄寬單位約 7 px
  const PT_PER_PX = 0.75;
  const PHOTO_MAX_W = 380, PHOTO_MAX_H = 300;
  const COLS = { label: 1, before: 2, gap: 3, after: 4 };
  const thin = { style: 'thin', color: { argb: 'FF999999' } };
  const border = { top: thin, left: thin, bottom: thin, right: thin };
  const headFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } };
  const failFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8CBAD' } };
  const passFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };

  const sheetName = (s, used) => {
    let n = String(s).replace(/[\[\]:*?/\\]/g, ' ').slice(0, 28);
    let k = 2, base = n;
    while (used.has(n)) n = `${base.slice(0, 25)}(${k++})`;
    used.add(n);
    return n;
  };
  const fit = (w, h, mw, mh) => { const s = Math.min(mw / w, mh / h, 1e9); return { w: Math.round(w * s), h: Math.round(h * s) }; };

  function addPic(wb, ws, pic, row, col, mw = PHOTO_MAX_W, mh = PHOTO_MAX_H) {
    const id = wb.addImage({ base64: pic.base64, extension: 'jpeg' });
    const sz = fit(pic.w, pic.h, mw, mh);
    ws.addImage(id, { tl: { col: col - 1 + 0.05, row: row - 1 + 0.05 }, ext: { width: sz.w, height: sz.h }, editAs: 'oneCell' });
    return sz;
  }
  const setH = (ws, row, px) => { const r = ws.getRow(row); r.height = Math.max(r.height || 15, px * PT_PER_PX + 6); };
  const title = (ws, row, text, span = 4) => {
    ws.mergeCells(row, 1, row, span);
    const c = ws.getCell(row, 1);
    c.value = text; c.font = { bold: true, size: 13 }; c.fill = headFill;
    return row + 1;
  };

  async function renderPhoto(ph, rect, maxSide = 1400) {
    const im = await AR.img.load(ph.blobId);
    return AR.img.render(im, rect, maxSide);
  }

  async function generate(p, onProgress = () => {}) {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Autoreport 第一版';
    wb.created = new Date();
    const used = new Set();
    const D = AR.DEFAULTS;

    /* ---------- 1. 基本資料與測項 ---------- */
    {
      const ws = wb.addWorksheet(sheetName('基本資料', used));
      ws.columns = [{ width: 22 }, { width: 40 }, { width: 22 }, { width: 50 }];
      let r = 1;
      ws.mergeCells(r, 1, r, 4);
      ws.getCell(r, 1).value = `${p.info.product || p.name} 震動與衝擊測試報告`;
      ws.getCell(r, 1).font = { bold: true, size: 16 };
      r++;
      ws.mergeCells(r, 1, r, 4);
      ws.getCell(r, 1).value = '※ 本檔為第一版系統的暫定版面，正式版將套用公司 Excel 範本。';
      ws.getCell(r, 1).font = { italic: true, color: { argb: 'FFC00000' } };
      r += 2;
      r = title(ws, r, '基本資料');
      for (const f of D.infoFields) {
        ws.getCell(r, 1).value = f.label; ws.getCell(r, 1).fill = headFill;
        ws.getCell(r, 2).value = p.info[f.key] || '';
        ws.mergeCells(r, 2, r, 4);
        [1, 2].forEach((c) => (ws.getCell(r, c).border = border));
        r++;
      }
      r++;
      r = title(ws, r, '測試項目');
      for (const g of p.groups) {
        const tests = p.tests.filter((t) => t.groupId === g.id);
        if (!tests.length) continue;
        const a = M.assignment(p, g.id);
        ws.getCell(r, 1).value = `報告大項：${g.name}`; ws.getCell(r, 1).font = { bold: true };
        ws.getCell(r, 2).value = `測試前照片：${M.nodeLabel(p, a.before)}`;
        ws.getCell(r, 4).value = `測試後照片：${M.nodeLabel(p, a.after)}`;
        r++;
        for (const t of tests) {
          ws.getCell(r, 1).value = t.name; ws.getCell(r, 1).font = { bold: true };
          ws.getCell(r, 2).value = t.text || '';
          ws.getCell(r, 2).alignment = { wrapText: true, vertical: 'top' };
          ws.mergeCells(r, 2, r, 4);
          ws.getRow(r).height = Math.max(30, 15 * ((t.text || '').split('\n').length + Math.ceil((t.text || '').length / 80)));
          r++;
          ws.getCell(r, 1).value = '分項';
          ws.getCell(r, 2).value = t.subitems.map((s) => s.name).join('、');
          ws.mergeCells(r, 2, r, 4);
          r++;
        }
        r++;
      }
      r = title(ws, r, '分項執行順序（時間軸）');
      const nodesAfter = (sid) => p.nodes.filter((n) => n.after === sid).length;
      ws.getCell(r, 1).value = '1. 測試前拍照'; r++;
      p.timeline.forEach((sid, i) => {
        ws.getCell(r, 1).value = `${i + 2}. ${M.subLabel(p, sid)}${nodesAfter(sid) ? '　→ 拍照' : ''}`;
        ws.mergeCells(r, 1, r, 4);
        r++;
      });
    }

    /* ---------- 2. 判定總表（逐分項） ---------- */
    {
      const ws = wb.addWorksheet(sheetName('判定總表', used));
      ws.columns = [{ width: 26 }, { width: 18 }, { width: 22 }, { width: 18 }, { width: 40 }];
      const hdr = ['測項', '分項', '判定', '問題編號', '備註'];
      hdr.forEach((v, i) => { const c = ws.getCell(1, i + 1); c.value = v; c.fill = headFill; c.font = { bold: true }; c.border = border; });
      let r = 2;
      for (const t of p.tests) {
        for (const s of t.subitems) {
          const v = p.verdicts[s.id] || '';
          const iss = M.issuesOf(p, s.id);
          const row = [t.name, s.name, (D.verdicts.find((x) => x.value === v) || {}).label || '未判定',
            iss.map((i) => `#${i.no}`).join('、'), iss.map((i) => i.title).join('；')];
          row.forEach((val, i) => { const c = ws.getCell(r, i + 1); c.value = val; c.border = border; });
          if (v === 'fail') ws.getCell(r, 3).fill = failFill;
          if (v === 'pass') ws.getCell(r, 3).fill = passFill;
          r++;
        }
      }
    }

    /* ---------- 3. 各報告大項：測試前後照片 ---------- */
    let gi = 0;
    for (const g of p.groups) {
      gi++;
      if (!p.tests.some((t) => t.groupId === g.id)) continue;
      onProgress(`照片頁：${g.name}`);
      const a = M.assignment(p, g.id);
      const ws = wb.addWorksheet(sheetName(`照片-${g.name}`, used));
      ws.columns = [{ width: 16 }, { width: PHOTO_MAX_W / PX_PER_CHAR + 2 }, { width: 2 }, { width: PHOTO_MAX_W / PX_PER_CHAR + 2 }];
      let r = title(ws, 1, `${g.name}｜測試前後照片比對`);
      ws.getCell(r, COLS.before).value = `測試前：${M.nodeLabel(p, a.before)}`;
      ws.getCell(r, COLS.after).value = `測試後：${M.nodeLabel(p, a.after)}`;
      [COLS.before, COLS.after].forEach((c) => { ws.getCell(r, c).font = { bold: true }; ws.getCell(r, c).fill = headFill; });
      r += 2;
      const inc = (key) => a.include[key] !== false;

      const pair = async (label, bPic, aPic) => {
        ws.getCell(r, 1).value = label;
        ws.getCell(r, 1).alignment = { wrapText: true, vertical: 'middle' };
        let hmax = 40;
        if (bPic) hmax = Math.max(hmax, addPic(wb, ws, bPic, r, COLS.before).h);
        else ws.getCell(r, COLS.before).value = '（無照片）';
        if (aPic) hmax = Math.max(hmax, addPic(wb, ws, aPic, r, COLS.after).h);
        else ws.getCell(r, COLS.after).value = '（無照片）';
        setH(ws, r, hmax + 8);
        r++;
      };

      // 3a 母圖（整張）
      r = title(ws, r, '整機外觀（母圖）');
      for (const c of M.enabledItems(p, ['angle'])) {
        if (!inc('item:' + c.id)) continue;
        const b = a.before && M.primaryPhoto(p, a.before, c.id);
        const af = a.after && M.primaryPhoto(p, a.after, c.id);
        if (!b && !af) continue;
        await pair(c.name, b && (await renderPhoto(b)), af && (await renderPhoto(af)));
      }
      // 3b 母圖裁切出的零件特寫
      const regs = p.regions.filter((rg) => inc('region:' + rg.id));
      if (regs.length) {
        r++;
        r = title(ws, r, '零件特寫（由母圖裁切）');
        for (const rg of regs) {
          const b = a.before && M.primaryPhoto(p, a.before, rg.angleId);
          const af = a.after && M.primaryPhoto(p, a.after, rg.angleId);
          if (!b && !af) continue;
          await pair(`${rg.name}${rg.accel ? '（加速規）' : ''}\n${M.itemName(p, rg.angleId)}`,
            b && (await renderPhoto(b, M.regionRect(p, rg, b.id))),
            af && (await renderPhoto(af, M.regionRect(p, rg, af.id))));
        }
      }
      // 3c 單獨拍攝的零件（一個零件可多張）
      const parts = M.enabledItems(p, ['part']).filter((c) => inc('item:' + c.id));
      const partRows = parts.map((c) => ({ c, b: a.before ? M.photosOf(p, a.before, c.id) : [], af: a.after ? M.photosOf(p, a.after, c.id) : [] }))
        .filter((x) => x.b.length || x.af.length);
      if (partRows.length) {
        r++;
        r = title(ws, r, '零件單獨拍攝');
        for (const x of partRows) {
          const n = Math.max(x.b.length, x.af.length);
          for (let i = 0; i < n; i++) {
            await pair(`${x.c.name}${n > 1 ? ` (${i + 1}/${n})` : ''}`,
              x.b[i] && (await renderPhoto(x.b[i])), x.af[i] && (await renderPhoto(x.af[i])));
          }
        }
      }
    }

    /* ---------- 4. 加速規位置 ---------- */
    const accelRegs = p.regions.filter((rg) => rg.accel);
    if (accelRegs.length) {
      onProgress('加速規位置');
      const ws = wb.addWorksheet(sheetName('加速規位置', used));
      ws.columns = [{ width: 120 }];
      let r = title(ws, 1, '加速規位置（紅框為加速規，箭頭指向特寫）', 1);
      const firstGroup = p.groups.find((g) => p.tests.some((t) => t.groupId === g.id));
      const baseNode = firstGroup ? M.assignment(p, firstGroup.id).before : M.sortedNodes(p)[0]?.id;
      const byAngle = {};
      accelRegs.forEach((rg) => (byAngle[rg.angleId] = byAngle[rg.angleId] || []).push(rg));
      for (const [angleId, rgs] of Object.entries(byAngle)) {
        const ph = M.primaryPhoto(p, baseNode, angleId) || p.photos.find((x) => x.itemId === angleId);
        if (!ph) continue;
        const im = await AR.img.load(ph.blobId);
        const pic = AR.img.accelComposite(im, rgs.map((rg) => M.regionRect(p, rg, ph.id)));
        ws.getCell(r, 1).value = `${M.itemName(p, angleId)}：${rgs.map((x) => x.name).join('、')}`;
        r++;
        const sz = addPic(wb, ws, pic, r, 1, 820, 520);
        setH(ws, r, sz.h + 10);
        r += 2;
      }
    }

    /* ---------- 5. 響應圖 ---------- */
    const resp = p.responses.filter((x) => x.include !== false);
    if (resp.length) {
      onProgress('響應圖');
      const ws = wb.addWorksheet(sheetName('響應圖', used));
      ws.columns = [{ width: 90 }];
      let r = 1;
      const groupsOrder = [...p.tests.map((t) => t.id), null];
      for (const tid of groupsOrder) {
        const list = resp.filter((x) => (x.testId || null) === tid);
        if (!list.length) continue;
        r = title(ws, r, tid ? p.tests.find((t) => t.id === tid).name : '未指定測項', 1);
        for (const x of list) {
          ws.getCell(r, 1).value = [x.subitemId ? M.subLabel(p, x.subitemId) : '', x.caption || ''].filter(Boolean).join('｜') || x.name;
          r++;
          const im = await AR.img.load(x.blobId);
          const pic = AR.img.render(im, null, 1400, 0.9);
          const sz = addPic(wb, ws, pic, r, 1, 620, 420);
          setH(ws, r, sz.h + 10);
          r += 2;
        }
      }
    }

    /* ---------- 6. 問題清單與各問題說明頁 ---------- */
    {
      const ws = wb.addWorksheet(sheetName('問題清單', used));
      ws.columns = [{ width: 8 }, { width: 30 }, { width: 18 }, { width: 40 }, { width: 8 }, { width: 30 }];
      ['編號', '分項', '零件', '問題摘要', '嚴重度', '首次發現的拍照節點'].forEach((v, i) => {
        const c = ws.getCell(1, i + 1); c.value = v; c.fill = headFill; c.font = { bold: true }; c.border = border;
      });
      if (!p.issues.length) ws.getCell(2, 1).value = '本次測試無問題紀錄。';
      p.issues.forEach((iss, k) => {
        const row = [`#${iss.no}`, M.subLabel(p, iss.subitemId), iss.part || '', iss.title || '', iss.severity || '', iss.foundNodeId ? M.nodeLabel(p, iss.foundNodeId) : ''];
        row.forEach((v, i) => { const c = ws.getCell(k + 2, i + 1); c.value = v; c.border = border; c.alignment = { wrapText: true, vertical: 'top' }; });
      });
    }
    for (const iss of p.issues) {
      onProgress(`問題 #${iss.no}`);
      const ws = wb.addWorksheet(sheetName(`問題${iss.no}`, used));
      ws.columns = [{ width: 16 }, { width: PHOTO_MAX_W / PX_PER_CHAR + 2 }, { width: 2 }, { width: PHOTO_MAX_W / PX_PER_CHAR + 2 }];
      let r = title(ws, 1, `問題 #${iss.no}：${iss.title || ''}`);
      const fields = [['分項', M.subLabel(p, iss.subitemId)], ['零件', iss.part || ''], ['嚴重度', iss.severity || ''],
        ['首次發現', iss.foundNodeId ? M.nodeLabel(p, iss.foundNodeId) : ''], ['問題描述', iss.desc || '']];
      for (const [k, v] of fields) {
        ws.getCell(r, 1).value = k; ws.getCell(r, 1).fill = headFill; ws.getCell(r, 1).border = border;
        ws.getCell(r, 2).value = v; ws.mergeCells(r, 2, r, 4);
        ws.getCell(r, 2).alignment = { wrapText: true, vertical: 'top' }; ws.getCell(r, 2).border = border;
        if (k === '問題描述') ws.getRow(r).height = Math.max(45, 15 * (String(v).split('\n').length + Math.ceil(String(v).length / 60)));
        r++;
      }
      r++;
      const refs = iss.refs || [];
      for (let i = 0; i < refs.length; i += 2) {
        let hmax = 40;
        for (let j = 0; j < 2 && i + j < refs.length; j++) {
          const ref = refs[i + j];
          const ph = p.photos.find((x) => x.id === ref.photoId);
          if (!ph) continue;
          const rg = ref.regionId && p.regions.find((x) => x.id === ref.regionId);
          const pic = await renderPhoto(ph, rg ? M.regionRect(p, rg, ph.id) : null);
          const col = j === 0 ? COLS.before : COLS.after;
          ws.getCell(r, col).value = `${M.nodeLabel(p, ph.nodeId)}｜${rg ? rg.name : M.itemName(p, ph.itemId)}`;
          ws.getCell(r, col).font = { size: 9, color: { argb: 'FF555555' } };
          hmax = Math.max(hmax, addPic(wb, ws, pic, r + 1, col).h);
        }
        setH(ws, r + 1, hmax + 8);
        r += 3;
      }
    }

    onProgress('寫入檔案');
    const buf = await wb.xlsx.writeBuffer();
    return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  return { generate };
})();
