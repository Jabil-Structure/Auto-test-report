/* 50-docx.js — 從實驗室的響應 Word 檔（.docx）抽出圖片，依文件中出現順序排列。
 * .docx 本身是 zip：圖片在 word/media/，順序由 document.xml 的 r:embed 決定。
 * 全程在瀏覽器內處理，檔案不會上傳。 */
'use strict';

AR.docx = (() => {
  const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', tif: 'image/tiff', tiff: 'image/tiff' };

  async function extractImages(file) {
    const zip = await JSZip.loadAsync(file);
    const rels = {};
    const relXml = await zip.file('word/_rels/document.xml.rels')?.async('string');
    if (relXml) {
      for (const m of relXml.matchAll(/<Relationship\b[^>]*>/g)) {
        const id = /Id="([^"]+)"/.exec(m[0])?.[1];
        const target = /Target="([^"]+)"/.exec(m[0])?.[1];
        if (id && target) rels[id] = 'word/' + target.replace(/^\.?\//, '').replace(/^\/word\//, '');
      }
    }
    const docXml = (await zip.file('word/document.xml')?.async('string')) || '';
    const ordered = [];
    for (const m of docXml.matchAll(/r:(?:embed|id)="([^"]+)"/g)) {
      const t = rels[m[1]];
      if (t && t.includes('media/') && !ordered.includes(t)) ordered.push(t);
    }
    // 補上沒被引用到的圖
    zip.folder('word/media').forEach((rel) => { const t = 'word/media/' + rel; if (!ordered.includes(t)) ordered.push(t); });

    const out = [], skipped = [];
    for (const path of ordered) {
      const ext = path.split('.').pop().toLowerCase();
      const f = zip.file(path);
      if (!f) continue;
      if (!MIME[ext]) { skipped.push(path.split('/').pop()); continue; } // EMF/WMF 瀏覽器無法顯示
      const blob = new Blob([await f.async('arraybuffer')], { type: MIME[ext] });
      out.push({ name: path.split('/').pop(), blob });
    }
    return { images: out, skipped };
  }

  return { extractImages };
})();
