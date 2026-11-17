/* 10-defaults.js — 預設資料：測項庫、固定角度、拍照清單、基本資料欄位。
 * 這個檔案只放「資料」，改這裡就能換成公司真實的測項文字與清單，不必動程式邏輯。
 * 標示【暫定】的內容都還在等使用者提供真實資料。 */
'use strict';

AR.DEFAULTS = {
  /** 基本資料欄位【暫定：實際欄位以公司 Excel 範本為準】 */
  infoFields: [
    { key: 'reportNo', label: '報告編號' },
    { key: 'product', label: '產品名稱' },
    { key: 'model', label: '機種／型號' },
    { key: 'sampleNo', label: '樣品編號（SN）' },
    { key: 'stage', label: '驗證階段（例：DVT／設計變更）' },
    { key: 'customer', label: '客戶' },
    { key: 'lab', label: '測試實驗室' },
    { key: 'startDate', label: '測試開始日期', type: 'date' },
    { key: 'endDate', label: '測試結束日期', type: 'date' },
    { key: 'engineer', label: '測試工程師' },
  ],

  /** 軸向定義【暫定，可依公司慣例修改】 */
  axes: {
    X: { label: 'X 軸（左右）', faces: ['+X（右）', '-X（左）'] },
    Y: { label: 'Y 軸（前後）', faces: ['+Y（前）', '-Y（後）'] },
    Z: { label: 'Z 軸（上下）', faces: ['+Z（上）', '-Z（下）'] },
  },

  /** 測項庫。kind: vib=震動（每軸一個分項）、shock=衝擊（每面一個分項）
   *  text 是預設帶入的固定文字【暫定範例文字，請換成公司固定文字】，使用者可刪改。 */
  testLibrary: [
    { key: 'rv_op', kind: 'vib', name: '隨機震動（運轉中）',
      text: '測試條件：隨機震動，運轉中。PSD 曲線：[依規格]，Grms：[ ]，每軸時間：[ ] 分鐘，軸向：X、Y、Z。\n判定標準：測試中與測試後系統功能正常，外觀與結構無損傷、無鬆脫。' },
    { key: 'rv_nonop', kind: 'vib', name: '隨機震動（非運轉）',
      text: '測試條件：隨機震動，非運轉。PSD 曲線：[依規格]，Grms：[ ]，每軸時間：[ ] 分鐘，軸向：X、Y、Z。\n判定標準：測試後開機功能正常，外觀與結構無損傷、無鬆脫。' },
    { key: 'sine', kind: 'vib', name: '正弦掃頻震動',
      text: '測試條件：正弦掃頻，頻率範圍：[ ] Hz，加速度：[ ] G，掃頻速率：[ ] oct/min，軸向：X、Y、Z。\n判定標準：測試後功能正常，外觀與結構無損傷。' },
    { key: 'hs_op', kind: 'shock', name: '半正弦衝擊（運轉中）',
      text: '測試條件：半正弦波衝擊，運轉中。峰值：[ ] G，脈寬：[ ] ms，每面次數：[ ]，共六面。\n判定標準：測試中與測試後系統功能正常，外觀與結構無損傷。' },
    { key: 'hs_nonop', kind: 'shock', name: '半正弦衝擊（非運轉）',
      text: '測試條件：半正弦波衝擊，非運轉。峰值：[ ] G，脈寬：[ ] ms，每面次數：[ ]，共六面。\n判定標準：測試後開機功能正常，外觀與結構無損傷、無鬆脫。' },
    { key: 'sq_nonop', kind: 'shock', name: '方波衝擊（非運轉）',
      text: '測試條件：方波衝擊，非運轉。速度變化量：[ ] in/s，峰值：[ ] G，共六面。\n判定標準：測試後開機功能正常，外觀與結構無損傷。' },
  ],

  /** 固定 10 個母圖角度（已確認） */
  angles: [
    { id: 'ang_closed_front', name: '未開蓋－前' },
    { id: 'ang_closed_rear', name: '未開蓋－後' },
    { id: 'ang_closed_top', name: '未開蓋－上' },
    { id: 'ang_closed_left', name: '未開蓋－左' },
    { id: 'ang_closed_right', name: '未開蓋－右' },
    { id: 'ang_open_front', name: '開蓋－前' },
    { id: 'ang_open_rear', name: '開蓋－後' },
    { id: 'ang_open_top', name: '開蓋－上' },
    { id: 'ang_open_left', name: '開蓋－左' },
    { id: 'ang_open_right', name: '開蓋－右' },
  ],

  /** 單獨拍攝的零件清單【暫定：等過往報告清單整理後替換】 */
  parts: [
    '主機板', 'CPU 散熱器', '記憶體（DIMM）', '電源供應器（PSU）', '硬碟與背板',
    '風扇模組', 'PCIe 擴充卡與固定架', '導風罩', '線材與接頭', '上蓋卡扣與螺絲',
    '滑軌與把手', '防鬆標記（螺絲）',
  ],

  verdicts: [
    { value: '', label: '未判定' },
    { value: 'pass', label: '無問題' },
    { value: 'fail', label: '有問題' },
    { value: 'skip', label: '未比對（依風險跳過）' },
  ],

  severities: ['高', '中', '低'],
};
