/* 00-util.js — 共用小工具（不含任何業務邏輯） */
'use strict';
const AR = (window.AR = window.AR || {});

AR.uid = (prefix = '') =>
  prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

AR.now = () => new Date().toISOString();

AR.clone = (o) => JSON.parse(JSON.stringify(o));

AR.fmtTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** 建立 DOM 元素：h('div', {class:'x', onclick:fn}, '文字', child) */
function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked' || k === 'selected' || k === 'disabled' || k === 'multiple') el[k] = !!v;
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  const add = (c) => {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) return c.forEach(add);
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  };
  children.forEach(add);
  return el;
}
AR.h = h;

/** 下拉選單 */
AR.select = (options, value, onchange, attrs = {}) =>
  h('select', { ...attrs, onchange: (e) => onchange(e.target.value) },
    options.map((o) => h('option', { value: o.value, selected: String(o.value) === String(value ?? '') }, o.label)));

AR.toast = (msg, ms = 2500) => {
  const t = h('div', { class: 'toast' }, msg);
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, ms);
};

/** 選檔案（回傳 FileList 的陣列） */
AR.pickFiles = ({ accept = 'image/*', multiple = false, capture = null } = {}) =>
  new Promise((resolve) => {
    const inp = h('input', { type: 'file', accept, multiple, style: 'display:none' });
    if (capture) inp.setAttribute('capture', capture);
    inp.addEventListener('change', () => { resolve([...inp.files]); inp.remove(); });
    document.body.appendChild(inp);
    inp.click();
  });

/** 手機上優先用系統分享選單（可直接存到 OneDrive App）；不支援時改成下載 */
AR.shareOrDownload = async (blob, filename) => {
  const file = new File([blob], filename, { type: blob.type || 'application/zip' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return 'shared'; }
    catch (e) { if (e.name === 'AbortError') return 'cancelled'; }
  }
  AR.download(blob, filename);
  return 'downloaded';
};

AR.download = (blob, filename) => {
  const a = h('a', { href: URL.createObjectURL(blob), download: filename });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
};

/** 檔名安全化 */
AR.safeName = (s) => String(s || '').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60);

/** 彈出視窗：回傳 {close} */
AR.modal = (title, body, { wide = false } = {}) => {
  const close = () => wrap.remove();
  const wrap = h('div', { class: 'modal-bg', onclick: (e) => { if (e.target === wrap) close(); } },
    h('div', { class: 'modal' + (wide ? ' wide' : '') },
      h('div', { class: 'modal-head' }, h('b', null, title), h('button', { class: 'btn ghost', onclick: close }, '✕')),
      h('div', { class: 'modal-body' }, body)));
  document.body.appendChild(wrap);
  return { close };
};

/* 網頁內的確認／輸入框。
 * 不用瀏覽器原生的 confirm/prompt/alert：部分手機的檔案預覽或內嵌瀏覽器會擋掉原生對話框，導致按鈕沒反應。 */
AR.dialog = ({ title = '', message = '', input = false, value = '', options = null, okText = '確定', cancel = true }) =>
  new Promise((resolve) => {
    let field = null;
    if (options) field = AR.select(options.map((o) => ({ value: o, label: o })), value || options[0], () => {});
    else if (input) field = h('input', { value, onkeydown: (e) => { if (e.key === 'Enter') finish(true); } });
    const finish = (ok) => { wrap.remove(); resolve(ok ? (field ? field.value : true) : (field ? null : false)); };
    const wrap = h('div', { class: 'modal-bg', onclick: (e) => { if (e.target === wrap && cancel) finish(false); } },
      h('div', { class: 'modal' },
        title ? h('div', { class: 'modal-head' }, h('b', null, title)) : null,
        h('div', { class: 'modal-body' },
          message ? h('p', { style: 'white-space:pre-wrap;margin-top:0' }, message) : null,
          field,
          h('div', { class: 'row end' },
            cancel ? h('button', { class: 'btn', onclick: () => finish(false) }, '取消') : null,
            h('button', { class: 'btn primary', onclick: () => finish(true) }, okText)))));
    document.body.appendChild(wrap);
    if (field) setTimeout(() => field.focus(), 50);
  });
AR.confirm = (message) => AR.dialog({ message });
AR.prompt = (message, value = '') => AR.dialog({ message, input: true, value });
AR.choose = (message, options) => AR.dialog({ message, options });
AR.alert = (message) => AR.dialog({ message, cancel: false });
