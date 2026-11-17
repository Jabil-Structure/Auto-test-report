/* 40-imaging.js — 影像處理：讀圖、裁切、縮圖、加速規標示合成圖。
 * 原始照片永遠不修改；裁切只在畫面預覽與輸出報告時即時產生。 */
'use strict';

AR.img = (() => {
  const cache = new Map();

  /** 讀入 blobId 對應的 <img>（已解碼） */
  async function load(blobId) {
    if (cache.has(blobId)) return cache.get(blobId);
    const url = await AR.blobUrl(blobId);
    const im = new Image();
    im.src = url;
    await im.decode();
    cache.set(blobId, im);
    return im;
  }

  /** 讀檔取得尺寸 */
  async function sizeOfBlob(blob) {
    const url = URL.createObjectURL(blob);
    const im = new Image();
    im.src = url;
    await im.decode();
    const r = { w: im.naturalWidth, h: im.naturalHeight };
    URL.revokeObjectURL(url);
    return r;
  }

  /** 裁切並縮到最長邊 maxSide，回傳 {base64, w, h}（JPEG，不含 data: 前綴） */
  function render(im, rect, maxSide = 1600, quality = 0.85) {
    const r = rect || { x: 0, y: 0, w: 1, h: 1 };
    const sx = r.x * im.naturalWidth, sy = r.y * im.naturalHeight;
    const sw = r.w * im.naturalWidth, sh = r.h * im.naturalHeight;
    const scale = Math.min(1, maxSide / Math.max(sw, sh));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(sw * scale));
    c.height = Math.max(1, Math.round(sh * scale));
    c.getContext('2d').drawImage(im, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return { base64: c.toDataURL('image/jpeg', quality).split(',')[1], w: c.width, h: c.height };
  }

  /** 加速規標示圖：左邊整張大圖畫紅框，右邊放特寫，紅色箭頭連過去 */
  function accelComposite(im, rects, maxH = 900) {
    const scale = Math.min(1, maxH / im.naturalHeight);
    const W = Math.round(im.naturalWidth * scale), H = Math.round(im.naturalHeight * scale);
    const gap = Math.round(W * 0.12);
    const closeW = Math.round(W * 0.45);
    const n = rects.length;
    const slotH = H / n;
    const c = document.createElement('canvas');
    c.width = W + gap + closeW;
    c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(im, 0, 0, W, H);
    const lw = Math.max(3, Math.round(W / 250));
    rects.forEach((r, i) => {
      const bx = r.x * W, by = r.y * H, bw = r.w * W, bh = r.h * H;
      // 特寫
      const sw = r.w * im.naturalWidth, sh = r.h * im.naturalHeight;
      const s = Math.min((closeW - 10) / sw, (slotH - 10) / sh);
      const dw = sw * s, dh = sh * s;
      const dx = W + gap + (closeW - dw) / 2, dy = i * slotH + (slotH - dh) / 2;
      g.drawImage(im, r.x * im.naturalWidth, r.y * im.naturalHeight, sw, sh, dx, dy, dw, dh);
      g.strokeStyle = '#e00000';
      g.lineWidth = lw;
      g.strokeRect(bx, by, bw, bh);
      g.strokeRect(dx, dy, dw, dh);
      // 箭頭
      const x1 = bx + bw, y1 = by + bh / 2, x2 = dx - lw, y2 = dy + dh / 2;
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      const ang = Math.atan2(y2 - y1, x2 - x1), L = lw * 5;
      g.beginPath();
      g.moveTo(x2, y2);
      g.lineTo(x2 - L * Math.cos(ang - 0.4), y2 - L * Math.sin(ang - 0.4));
      g.lineTo(x2 - L * Math.cos(ang + 0.4), y2 - L * Math.sin(ang + 0.4));
      g.closePath(); g.fillStyle = '#e00000'; g.fill();
    });
    return { base64: c.toDataURL('image/jpeg', 0.85).split(',')[1], w: c.width, h: c.height };
  }

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

  return { load, sizeOfBlob, render, accelComposite, cropThumb };
})();
