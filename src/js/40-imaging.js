/* 40-imaging.js — 影像處理：讀圖、裁切、縮圖、加速規標示合成圖。
 * 原始照片永遠不修改；裁切只在畫面預覽與輸出報告時即時產生。
 *
 * 記憶體：手機照片約 1200 萬像素，解碼後每張約 48 MB。產生報告時一次處理上百張，
 * 所以這裡不快取解碼結果，用完立即釋放（ImageBitmap.close），畫布也共用一張。 */
'use strict';

AR.img = (() => {
  let shared = null;
  const canvas = () => (shared = shared || document.createElement('canvas'));
  const releaseCanvas = (c) => { c.width = 1; c.height = 1; };

  /** 解碼一個 Blob。回傳 { src, naturalWidth, naturalHeight, release() } */
  async function decode(blob) {
    if (window.createImageBitmap) {
      try {
        const b = await createImageBitmap(blob, { imageOrientation: 'from-image' });
        return { src: b, naturalWidth: b.width, naturalHeight: b.height, release: () => b.close() };
      } catch (e) { /* 部分格式改用 <img> 解碼 */ }
    }
    const url = URL.createObjectURL(blob);
    const im = new Image();
    im.src = url;
    await im.decode();
    return { src: im, naturalWidth: im.naturalWidth, naturalHeight: im.naturalHeight, release: () => URL.revokeObjectURL(url) };
  }

  /** 讀入 blobId 對應的圖片（不快取；用完要 release，或改用 withImage） */
  async function load(blobId) {
    const blob = await AR.store.getBlob(blobId);
    if (!blob) throw new Error('找不到照片資料（可能已被刪除）');
    return decode(blob);
  }

  /** 讀圖 → 執行 fn(im) → 釋放 */
  async function withImage(blobId, fn) {
    const im = await load(blobId);
    try { return await fn(im); } finally { im.release(); }
  }

  /** 讀檔取得尺寸 */
  async function sizeOfBlob(blob) {
    const im = await decode(blob);
    const r = { w: im.naturalWidth, h: im.naturalHeight };
    im.release();
    return r;
  }

  const toJpeg = (c, quality) => ({ base64: c.toDataURL('image/jpeg', quality).split(',')[1], w: c.width, h: c.height });

  /** 裁切並縮到最長邊 maxSide，回傳 {base64, w, h}（JPEG，不含 data: 前綴） */
  function render(im, rect, maxSide = 1600, quality = 0.85) {
    const r = rect || { x: 0, y: 0, w: 1, h: 1 };
    const sx = r.x * im.naturalWidth, sy = r.y * im.naturalHeight;
    const sw = r.w * im.naturalWidth, sh = r.h * im.naturalHeight;
    const scale = Math.min(1, maxSide / Math.max(sw, sh));
    const c = canvas();
    c.width = Math.max(1, Math.round(sw * scale));
    c.height = Math.max(1, Math.round(sh * scale));
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);   // 透明背景（PNG 響應圖）轉 JPEG 時用白底
    g.drawImage(im.src, sx, sy, sw, sh, 0, 0, c.width, c.height);
    const out = toJpeg(c, quality);
    releaseCanvas(c);
    return out;
  }

  /** 加速規標示圖（仿過往報告）：左邊整張大圖用紅色橢圓圈出加速規，紅色箭頭指向右邊的特寫 */
  function accelComposite(im, rects, maxH = 900) {
    const scale = Math.min(1, maxH / im.naturalHeight);
    const W = Math.round(im.naturalWidth * scale), H = Math.round(im.naturalHeight * scale);
    const gap = Math.round(W * 0.16);
    const closeW = Math.round(W * 0.5);
    const n = rects.length;
    const slotH = H / n;
    const c = canvas();
    c.width = W + gap + closeW;
    c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(im.src, 0, 0, W, H);
    const lw = Math.max(3, Math.round(W / 220));
    rects.forEach((r, i) => {
      const bx = r.x * W, by = r.y * H, bw = r.w * W, bh = r.h * H;
      // 特寫
      const sw = r.w * im.naturalWidth, sh = r.h * im.naturalHeight;
      const s = Math.min((closeW - 10) / sw, (slotH * 0.9 - 10) / sh);
      const dw = sw * s, dh = sh * s;
      const dx = W + gap + (closeW - dw) / 2, dy = i * slotH + (slotH - dh) / 2;
      g.drawImage(im.src, r.x * im.naturalWidth, r.y * im.naturalHeight, sw, sh, dx, dy, dw, dh);
      g.strokeStyle = '#ff0000';
      g.lineWidth = Math.max(2, lw / 2);
      g.strokeRect(dx, dy, dw, dh);
      // 紅色橢圓（比框大一點，避免壓到加速規）
      const cx = bx + bw / 2, cy = by + bh / 2, rx = Math.max(bw * 0.62, lw * 3), ry = Math.max(bh * 0.62, lw * 3);
      g.lineWidth = lw;
      g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.stroke();
      // 箭頭：從橢圓右緣到特寫左緣
      const x1 = cx + rx, y1 = cy, x2 = dx - lw, y2 = dy + dh / 2;
      g.lineWidth = Math.max(2, Math.round(lw * 0.7));
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      const ang = Math.atan2(y2 - y1, x2 - x1), L = lw * 5;
      g.beginPath();
      g.moveTo(x2, y2);
      g.lineTo(x2 - L * Math.cos(ang - 0.4), y2 - L * Math.sin(ang - 0.4));
      g.lineTo(x2 - L * Math.cos(ang + 0.4), y2 - L * Math.sin(ang + 0.4));
      g.closePath(); g.fillStyle = '#ff0000'; g.fill();
    });
    const out = toJpeg(c, 0.85);
    releaseCanvas(c);
    return out;
  }

  /** Blob → base64（不含 data: 前綴） */
  const blobToBase64 = (blob) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1]);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });

  /** 用 CSS 背景顯示裁切縮圖（不需重新運算圖片） */
  function cropThumb(url, rect, photo, { width = 120, cls = '' } = {}) {
    const r = rect || { x: 0, y: 0, w: 1, h: 1 };
    const aspect = (r.w * photo.w) / (r.h * photo.h) || 1;
    const bx = r.w >= 1 ? 0 : (r.x / (1 - r.w)) * 100;
    const by = r.h >= 1 ? 0 : (r.y / (1 - r.h)) * 100;
    return AR.h('div', {
      class: 'cropthumb ' + cls,
      style: {
        width: width + 'px', height: Math.round(width / aspect) + 'px',
        backgroundImage: `url("${url}")`,
        backgroundSize: `${100 / r.w}% ${100 / r.h}%`,
        backgroundPosition: `${bx}% ${by}%`,
      },
    });
  }

  return { decode, load, withImage, sizeOfBlob, render, accelComposite, blobToBase64, cropThumb };
})();
