/* 10-defaults.js — 預設資料：測項庫、軸向、固定角度、拍照清單、檢查清單、基本資料欄位。
 * 這個檔案只放「資料」，改這裡就能換成公司真實的測項文字與清單，不必動程式邏輯。
 *
 * 第二版依 8 份過往正式報告（Shock & Vibration Engineering Report）整理：
 *   - 報告內容一律英文（介面仍是繁體中文）。
 *   - 軸向依公司慣例：X＝前後（F-R）、Y＝左右（L-R）、Z＝上下（T-B）；
 *     +X Front、-X Rear、+Y Right、-Y Left、+Z Top、-Z Bottom。
 *   - 數值類（G 值、PSD、時間等）以 [ ] 表示待填，避免把錯誤數值帶進報告。
 * 表格文字的格式：每行一列，欄位用「|」或 Tab 分隔（可直接從 Excel 複製貼上）。 */
'use strict';

AR.DEFAULTS = (() => {
  const PURPOSE_OP = 'Verify the enterprise system being capable of exposure to specific operating environment, without introducing failures.\nSystem level verifications';
  const PURPOSE_NONOP = 'Verify the enterprise system being capable of exposure to specific transportation environment, without introducing failures.\nSystem level verifications';
  const PURPOSE_L105 = 'Verify the enterprise system by L10.5 methodology as L11 pre-test.\nSystem level verifications';

  const PROFILE_RANDOM = "Waveform | Grms | Hz | slope in dB/Oct. | PSD, g²/Hz | Face/Axes\nRandom | [ ] | [ ] | [ ] | [ ] | 3 axes / [ ] min/axis";
  const PROFILE_SINE = "Waveform | G's | Hz | Sweep rate (oct/min) | Face/Axes\nSine-sweep | [ ] | [ ] | [ ] | 3 axes / [ ] sweeps/axis";
  const PROFILE_SQUARE = "Waveform | G's | Duration(ms) or Velocity change (in/sec) | Face/Axes | Shock#\nSquare-Wave | [ ] | [ ] in/sec | 6 directions (±X, ±Y, ±Z), [ ] impacts per face | 6 faces, total [ ] shocks";
  const PROFILE_HALFSINE = "Waveform | G's | Duration(ms) or Velocity change (in/sec) | Face/Axes | Shock#\nHalf-sine | [ ] | [ ] ms | 6 directions (±X, ±Y, ±Z), [ ] impacts per face | 6 faces, total [ ] shocks";

  const EQUIP_VIB = 'Equipment Type | Manufacturer | Model# | Serial#\nVibration machine | [ ] | [ ] | [ ]';
  const EQUIP_SHOCK = 'Equipment Type | Manufacturer | Model# | Serial#\nShock machine | [ ] | [ ] | [ ]';

  const TOOLS_NONOP = ' | Stressing Tools | Checked Component(s)\n'
    + 'Pre-functional Testing | BurnIn 90% stress, 15 mins. | CPUs, Memory, HDD\n'
    + 'Functional Stress during Testing | N/A | N/A\n'
    + 'Post-functional Testing | BurnIn 90% stress, 15 mins. | CPUs, Memory, HDD';
  const TOOLS_OP = ' | Stressing Tools | Checked Component(s)\n'
    + 'Pre-functional Testing | BurnIn 90% stress, 15 mins. | CPUs, Memory, HDD\n'
    + 'Functional Stress during Testing | BurnIn 90% stress | CPUs, Memory\n'
    + 'Post-functional Testing | BurnIn 90% stress, 15 mins. | CPUs, Memory, HDD';

  const vib = (key, name, sheet, purpose, extra = {}) => ({
    key, kind: 'vib', name, sheet, purpose, spec: '[Specification document]', profile: PROFILE_RANDOM,
    level: '[ ] Grms', equipment: EQUIP_VIB, tools: TOOLS_NONOP, ...extra,
  });
  const shock = (key, name, sheet, purpose, extra = {}) => ({
    key, kind: 'shock', name, sheet, purpose, spec: '[Specification document]', profile: PROFILE_HALFSINE,
    level: "[ ] G's, [ ] ms", equipment: EQUIP_SHOCK, tools: TOOLS_NONOP, ...extra,
  });

  return {
    /** 基本資料欄位（對應正式報告各測項頁的 Project Name / Phase / Engineer… 區塊） */
    infoFields: [
      { key: 'projectName', label: 'Project Name（專案名稱）' },
      { key: 'codeName', label: 'Code Name（代號）' },
      { key: 'phase', label: 'Phase（階段，例：EVT／DVT）' },
      { key: 'sku', label: 'Testing SKU／Config（測試配置）' },
      { key: 'engineer', label: 'Engineer（測試工程師）' },
      { key: 'technician', label: 'Technician（技術員）' },
      { key: 'approval', label: 'Approval（核准人）' },
      { key: 'testDate', label: 'Testing Date（測試日期，例：2026/4/22、4/23）' },
      { key: 'reportDate', label: 'Report Date（報告日期）', type: 'date' },
      { key: 'revision', label: 'Revision（報告版次，例：A01）' },
      { key: 'lab', label: 'Test Lab（實驗室）' },
      { key: 'labAddress', label: 'Lab Address（實驗室地址）' },
    ],

    /** 軸向（公司慣例）。label/name 給介面用，en 給報告用。
     *  vib 每軸一個分項；shock 每面一個分項。short 用在檢查表欄位，setup 用在 6.1 架設照列名。 */
    axes: {
      X: { label: 'X 軸（前後）', en: 'F-R / X-Axis', short: 'F-R', setup: 'Front-Rear',
        faces: [{ dir: '+X', name: '+X（前）', en: 'Front / +X-Axis', short: 'Front' },
          { dir: '-X', name: '-X（後）', en: 'Rear / -X-Axis', short: 'Rear' }] },
      Y: { label: 'Y 軸（左右）', en: 'L-R / Y-Axis', short: 'L-R', setup: 'Left-Right',
        faces: [{ dir: '+Y', name: '+Y（右）', en: 'Right / +Y-Axis', short: 'Right' },
          { dir: '-Y', name: '-Y（左）', en: 'Left / -Y-Axis', short: 'Left' }] },
      Z: { label: 'Z 軸（上下）', en: 'T-B / Z-Axis', short: 'T-B', setup: 'Top-Bottom',
        faces: [{ dir: '+Z', name: '+Z（上）', en: 'Top / +Z-Axis', short: 'Top' },
          { dir: '-Z', name: '-Z（下）', en: 'Bottom / -Z-Axis', short: 'Bottom' }] },
    },

    /** 測項庫（名稱與工作表名取自過往報告）。kind: vib=震動、shock=衝擊。
     *  purpose 每行一條（報告會自動編成 1.1、1.2…）；profile/equipment/tools 為表格文字。 */
    testLibrary: [
      vib('op_rv', 'Operating Random Vibration', 'OP_Vib', PURPOSE_OP, { tools: TOOLS_OP }),
      shock('op_hs', 'Operating Half-sine Shock', 'OP_Shock', PURPOSE_OP, { tools: TOOLS_OP }),
      vib('nonop_rv', 'Unpackaged NONOP Random Vibration', 'NONOP Vib', PURPOSE_NONOP),
      shock('nonop_sq', 'Unpackaged NONOP Square-Wave Shock', 'NONOP Shock', PURPOSE_NONOP,
        { profile: PROFILE_SQUARE, level: "[ ] G's, [ ] in/sec" }),
      shock('nonop_hs', 'NONOP Half-sine Shock', 'NONOP HS Shock', PURPOSE_NONOP),
      vib('nonop_sine', 'NONOP Sine-sweep Vibration', 'NONOP Sine', PURPOSE_NONOP, { profile: PROFILE_SINE, level: "[ ] G's" }),
      vib('l105_arv', 'L10.5 NONOP Random Vibration - Air Ride Van', 'L10.5_Vibe_AirRide', PURPOSE_L105),
      vib('l105_cc', 'L10.5 NONOP Random Vibration - Common Carrier', 'L10.5_Vibe_Common', PURPOSE_L105),
      shock('l105_sh1', 'L10.5 NONOP Shock - Level 1', 'L10.5_Shock_LV1', PURPOSE_L105),
      shock('l105_sh2', 'L10.5 NONOP Shock - Level 2', 'L10.5_Shock_LV2', PURPOSE_L105),
    ],

    /** 第一版測項 key → 第二版（舊專案升級用） */
    legacyTestKeys: { rv_op: 'op_rv', rv_nonop: 'nonop_rv', sine: 'nonop_sine', hs_op: 'op_hs', hs_nonop: 'nonop_hs', sq_nonop: 'nonop_sq' },

    /** 固定 10 個母圖角度（已確認）。en 為報告用名稱。 */
    angles: [
      { id: 'ang_closed_front', name: '未開蓋－前', en: 'Front (w/ top cover)' },
      { id: 'ang_closed_rear', name: '未開蓋－後', en: 'Rear (w/ top cover)' },
      { id: 'ang_closed_top', name: '未開蓋－上', en: 'Top (w/ top cover)' },
      { id: 'ang_closed_left', name: '未開蓋－左', en: 'Left (w/ top cover)' },
      { id: 'ang_closed_right', name: '未開蓋－右', en: 'Right (w/ top cover)' },
      { id: 'ang_open_front', name: '開蓋－前', en: 'Front (w/o top cover)' },
      { id: 'ang_open_rear', name: '開蓋－後', en: 'Rear (w/o top cover)' },
      { id: 'ang_open_top', name: '開蓋－上', en: 'Top (w/o top cover)' },
      { id: 'ang_open_left', name: '開蓋－左', en: 'Left (w/o top cover)' },
      { id: 'ang_open_right', name: '開蓋－右', en: 'Right (w/o top cover)' },
    ],

    /** 單獨拍攝的零件（英文，直接用在報告 4.3／8.3 標題）。整理自過往報告的 4.3.x 與 8.3 項目。 */
    parts: [
      'Rear wall / PCIe cage', 'Top cover latch', 'Mid plane', 'Mid plane guiding', 'Air duct',
      'HDD / DFM cage', 'HDD / DFM carrier', 'Fan module / fan cage', 'MB stopper / standoff',
      'Riser card & PCIe connector', 'Riser latch', 'OCP cage / OCP NIC / M.2', 'CPU heatsink',
      'DIMM', 'PSU', 'Rail kit', 'Screw anti-loosening marks', 'Burn-in test result',
    ],

    /** 8.1 檢查清單（每行一項；以「## 」開頭的是分組標題）。整理自過往報告。 */
    checkItems: [
      'All components and hardwares are stressed normally.',
      'Pictures to record at least the front, rear and inside of system w/ & w/o airshroud',
      'All screws are in place',
      'All screws in proper torque',
      'PCIe cards in place',
      'Battery in place',
      'Record the value of card movement, e.g., PCIe cards, riser cards.',
      '## Record Top Cover',
      'Front top cover hook',
      'Rear top cover hook',
      'Front top cover gap',
      'Rear top cover pin',
      '## Recording PCIe Cage and Rear Wall',
      'PCIe riser CONN',
      'PCIe CONN and latch',
      'Rear wall deform',
      'Card Support',
      'Riser board toolless feature',
      '## Recording Chassis and Component',
      'DIMM pop out',
      'Fan pop out',
      'Air duct',
      'Fan cage deformed',
      'PSU CONN deformed',
      'PSU stopper deformed',
      '## Recording SM',
      'HDD carrier/HDD pop out or pushed in and hook crack',
      'HDD CONN deformed',
      'HDD stopper deformed',
      'HDD MP out of T pin',
    ].join('\n'),

    /** 4.1、4.2 表格的標題列（內容由使用者從過往報告複製貼上） */
    configHead: "Component(s) | Qty's | Vendor | Part Description(s) | JPN | MPN | Mass(g) & Notes",
    torqueHead: 'Positions | Torque (kgf.cm)',

    verdicts: [
      { value: '', label: '未判定', en: '' },
      { value: 'pass', label: '無問題（Pass）', en: 'Pass' },
      { value: 'defect', label: '缺陷（Defect）', en: 'Defect' },
      { value: 'fail', label: '失效（Fail）', en: 'Fail' },
      { value: 'skip', label: '未比對（依風險跳過）', en: 'N/A' },
    ],

    /** 過往報告 Issue Lists 出現過的值（可自由輸入） */
    severities: ['N/A', '1', '2', '3', '4'],
    issueStatuses: ['Record', 'Open', 'Fix', 'Close'],

    /** 報告頁尾左側文字（可在「產生報告」頁修改） */
    footer: 'Proprietary and Confidential - All rights reserved',
  };
})();
