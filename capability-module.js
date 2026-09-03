/*
 * 肿瘤专科能力分析模块
 * 对应功能点：
 *   肿瘤诊疗技术目录 · 机构技术开展记录 · 医疗质量核心指标明细
 *   疑难病例收治特征库 · 专科能力综合评分报告
 * 与「专科画像」的分工：专科画像面向单个患者的诊疗过程与风险标签；
 *   本模块面向机构，评估其肿瘤专科的技术能力、医疗质量与收治难度。
 */
(function () {
  'use strict';

  const OWNED_IDS = ['cap-catalog', 'cap-records', 'cap-quality', 'cap-complex', 'cap-score'];
  const CURRENT_USER = '省级登记中心 · 陈敏';
  const EVAL_YEAR = '2025';

  const style = document.createElement('style');
  style.textContent = `
#pageContainer .cp-page{padding-bottom:20px}
#pageContainer .cp-head{background:linear-gradient(135deg,#fbfdff,#f4f8fd);border:1px solid var(--border);border-left:4px solid var(--primary);border-radius:6px;padding:14px 18px;margin-bottom:14px;display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
#pageContainer .cp-title{font-size:17px;font-weight:700;color:#1e293b}
#pageContainer .cp-sub{margin-top:5px;font-size:12px;color:#64748b;line-height:1.85;max-width:1080px}
#pageContainer .cp-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
#pageContainer .cp-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:10px;margin-bottom:14px}
#pageContainer .cp-kpi{background:#fff;border:1px solid var(--border);border-radius:6px;padding:11px 13px}
#pageContainer .cp-kpi-label{font-size:12px;color:#667085}
#pageContainer .cp-kpi-value{margin-top:5px;font-size:23px;font-weight:700;color:var(--primary);font-variant-numeric:tabular-nums}
#pageContainer .cp-kpi-value.danger{color:#b42335}
#pageContainer .cp-kpi-value.warn{color:#b54708}
#pageContainer .cp-kpi-value.ok{color:#15803d}
#pageContainer .cp-kpi-meta{margin-top:3px;font-size:11px;color:#94a3b8}
#pageContainer .cp-card{background:#fff;border:1px solid var(--border);border-radius:6px;margin-bottom:14px;overflow:hidden}
#pageContainer .cp-card-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 14px;border-bottom:1px solid var(--border);background:#fbfcfe}
#pageContainer .cp-card-title{font-size:14px;font-weight:600;color:#1e293b;display:flex;align-items:baseline;gap:8px}
#pageContainer .cp-card-sub{font-size:11px;font-weight:400;color:#94a3b8}
#pageContainer .cp-card-body{padding:13px 14px}
#pageContainer .cp-grid2{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:14px}
@media(max-width:1280px){#pageContainer .cp-grid2{grid-template-columns:minmax(0,1fr)}}
#pageContainer .cp-filter{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px 12px;align-items:end;padding:12px 14px;background:#f8fafc;border:1px solid var(--border);border-radius:6px;margin-bottom:12px}
#pageContainer .cp-filter .filter-actions{display:flex;gap:8px;align-items:flex-end}
#pageContainer .cp-table-wrap{overflow:auto;border:1px solid var(--border);border-radius:6px;background:#fff}
#pageContainer .cp-table{width:100%;min-width:1060px;border-collapse:collapse}
#pageContainer .cp-table th{height:40px;padding:0 11px;text-align:left;background:#f8fafc;color:#5b6673;font-size:12px;font-weight:600;border-bottom:1px solid var(--border);white-space:nowrap}
#pageContainer .cp-table td{height:46px;padding:7px 11px;border-bottom:1px solid var(--border);color:#334155;font-size:13px;vertical-align:middle}
#pageContainer .cp-table td.cp-nowrap{white-space:nowrap}
#pageContainer .cp-table tbody tr:hover{background:#f5f9ff}
#pageContainer .cp-table .badge{white-space:nowrap}
#pageContainer .cp-id{background:none;border:0;padding:0;color:var(--primary);font-weight:600;font-size:13px;cursor:pointer}
#pageContainer .cp-id:hover{text-decoration:underline}
#pageContainer .cp-sec{font-size:11px;color:#94a3b8;margin-top:3px;line-height:1.6}
#pageContainer .cp-num{font-variant-numeric:tabular-nums;text-align:right}
#pageContainer .cp-bar{height:6px;border-radius:3px;background:#eef2f7;overflow:hidden;margin-top:5px;min-width:70px}
#pageContainer .cp-bar>i{display:block;height:100%;background:var(--primary)}
#pageContainer .cp-bar>i.warn{background:#f59e0b}
#pageContainer .cp-bar>i.bad{background:#dc2626}
#pageContainer .cp-bar>i.ok{background:#16a34a}
#pageContainer .cp-note{font-size:11px;color:#94a3b8;line-height:1.8}
#pageContainer .cp-callout{border:1px solid #cfe0f5;border-left:3px solid var(--primary);background:#f4f9ff;border-radius:5px;padding:10px 12px;font-size:12px;color:#334155;line-height:1.85}
#pageContainer .cp-callout.warn{border-color:#f2cf73;border-left-color:#f4b400;background:#fff8e6;color:#594414}
#pageContainer .cp-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:9px}
#pageContainer .cp-field{min-width:0;padding:9px 10px;background:#fbfcfe;border:1px solid var(--border);border-radius:5px}
#pageContainer .cp-field-label{font-size:11px;color:#667085}
#pageContainer .cp-value{margin-top:3px;font-size:13px;color:#1e293b;word-break:break-word}
#pageContainer .cp-modal-mask{position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;z-index:1200;padding:24px}
#pageContainer .cp-modal{background:#fff;border-radius:8px;width:min(960px,100%);max-height:88vh;display:flex;flex-direction:column;box-shadow:0 20px 45px rgba(15,23,42,.25)}
#pageContainer .cp-modal.narrow{width:min(680px,100%)}
#pageContainer .cp-modal-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border)}
#pageContainer .cp-modal-title{font-size:15px;font-weight:700;color:#1e293b}
#pageContainer .cp-close{background:none;border:0;font-size:20px;line-height:1;color:#94a3b8;cursor:pointer}
#pageContainer .cp-modal-body{padding:15px 16px;overflow:auto}
#pageContainer .cp-modal-foot{display:flex;justify-content:flex-end;gap:8px;padding:12px 16px;border-top:1px solid var(--border);background:#fbfcfe}
#pageContainer .cp-sect{margin-top:14px}
#pageContainer .cp-h{margin:0 0 8px;font-size:13px;font-weight:600;color:#475569}
#pageContainer .cp-pivot{width:100%;border-collapse:collapse;font-size:12px}
#pageContainer .cp-pivot th,#pageContainer .cp-pivot td{border:1px solid var(--border);padding:6px 9px;text-align:right;white-space:nowrap}
#pageContainer .cp-pivot th{background:#f8fafc;color:#5b6673;font-weight:600}
#pageContainer .cp-pivot th:first-child,#pageContainer .cp-pivot td:first-child{text-align:left}
#pageContainer .cp-empty{padding:30px;text-align:center;color:#94a3b8;font-size:13px}
#pageContainer .cp-tabs{display:flex;gap:4px;border-bottom:1px solid var(--border);margin-bottom:12px;flex-wrap:wrap}
#pageContainer .cp-tab{appearance:none;border:0;background:transparent;color:#667085;padding:9px 14px;font-size:13px;font-weight:600;cursor:pointer;border-bottom:2px solid transparent}
#pageContainer .cp-tab.active{color:var(--primary);border-bottom-color:var(--primary)}
#pageContainer .cp-radar{display:flex;align-items:center;justify-content:center;padding:6px}
#pageContainer .cp-radar svg{width:100%;max-width:340px;height:auto}
#pageContainer .cp-score-big{font-size:38px;font-weight:700;color:var(--primary);font-variant-numeric:tabular-nums;line-height:1}
#pageContainer .cp-grade{display:inline-flex;align-items:center;height:26px;padding:0 11px;border-radius:13px;font-size:13px;font-weight:700}
#pageContainer .cp-grade.A{background:#e7f6ec;color:#15803d}
#pageContainer .cp-grade.B{background:#e8f1fd;color:#1d4ed8}
#pageContainer .cp-grade.C{background:#fff4e5;color:#b54708}
#pageContainer .cp-grade.D{background:#fdeaec;color:#b42335}
#pageContainer .cp-dim-row{display:grid;grid-template-columns:132px 1fr 76px;gap:10px;align-items:center;padding:7px 0;border-bottom:1px dashed var(--border)}
#pageContainer .cp-dim-row:last-child{border-bottom:0}
#pageContainer .cp-dim-name{font-size:12px;color:#475569}
#pageContainer .cp-dim-score{font-size:13px;font-weight:700;text-align:right;font-variant-numeric:tabular-nums}
#pageContainer .cp-chip{display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:11px;background:#eef2f7;color:#475569;font-size:11px;font-weight:600;margin:2px 4px 2px 0}
#pageContainer .cp-chip.lv4{background:#fdeaec;color:#b42335}
#pageContainer .cp-chip.lv3{background:#fff4e5;color:#b54708}
#pageContainer .cp-chip.lv2{background:#e8f1fd;color:#1d4ed8}
`;
  document.head.appendChild(style);

  /* 技术分级：国家限制类技术与四级手术口径 */
  const TECH_LEVEL = {
    L4: { label: '四级手术', cls: 'badge-danger', chip: 'lv4', note: '技术难度大、风险高，需省级备案' },
    L3: { label: '三级手术', cls: 'badge-orange', chip: 'lv3', note: '难度较大，需科室授权' },
    RESTRICT: { label: '限制类技术', cls: 'badge-danger', chip: 'lv4', note: '国家/省级限制类医疗技术，须备案并定期评估' },
    ROUTINE: { label: '常规技术', cls: 'badge-info', chip: 'lv2', note: '常规开展，纳入基础能力' }
  };
  const TECH_CATEGORY = ['外科手术', '放射治疗', '系统性药物治疗', '介入与微创', '病理与分子诊断', '核医学与影像', '综合支持治疗'];
  const CATALOG_STATUS = {
    ACTIVE: { label: '现行', cls: 'badge-success' },
    DRAFT: { label: '草案', cls: 'badge-warning' },
    RETIRED: { label: '已废止', cls: 'badge-muted' }
  };
  const AUDIT_RESULT = {
    QUALIFIED: { label: '合格', cls: 'badge-success' },
    OBSERVE: { label: '观察', cls: 'badge-warning' },
    UNQUALIFIED: { label: '不合格', cls: 'badge-danger' },
    NOT_EVAL: { label: '未评价', cls: 'badge-muted' }
  };
  const GRADE_RULE = [
    { min: 85, grade: 'A', label: 'A 省内领先' },
    { min: 75, grade: 'B', label: 'B 达标良好' },
    { min: 65, grade: 'C', label: 'C 基本达标' },
    { min: 0, grade: 'D', label: 'D 需重点提升' }
  ];

  const state = {
    page: 'cap-catalog',
    catalog: { category: 'ALL', level: 'ALL', status: 'ALL', keyword: '' },
    records: { org: 'ALL', level: 'ALL', audit: 'ALL', keyword: '' },
    quality: { org: 'ALL', domain: 'ALL', keyword: '' },
    complex: { org: 'ALL', factor: 'ALL', keyword: '' },
    score: { org: '江西省肿瘤医院' }
  };

  function esc(v) { const d = document.createElement('div'); d.textContent = v == null ? '' : String(v); return d.innerHTML; }
  function n1(v) { return Number(v || 0).toFixed(1); }
  function n2(v) { return Number(v || 0).toFixed(2); }
  function nInt(v) { return Number(v || 0).toLocaleString('zh-CN'); }
  function badge(meta) { return meta ? '<span class="badge ' + meta.cls + '">' + esc(meta.label) + '</span>' : '-'; }
  function bar(ratio, tone) { const w = Math.max(0, Math.min(100, ratio)); return '<div class="cp-bar"><i class="' + (tone || '') + '" style="width:' + w + '%"></i></div>'; }
  function cpToast(m, t) { if (typeof toast === 'function') toast(m, t); }
  function gradeOf(score) { return GRADE_RULE.find(function (g) { return score >= g.min; }); }

  function cpHeader(title, subtitle, actions) {
    return '<div class="cp-head"><div><div class="cp-title">' + esc(title) + '</div><div class="cp-sub">' + subtitle + '</div></div><div class="cp-actions">' + (actions || []).join('') + '</div></div>';
  }
  function cpKpi(label, value, meta, tone) {
    return '<div class="cp-kpi"><div class="cp-kpi-label">' + esc(label) + '</div><div class="cp-kpi-value ' + (tone || '') + '">' + value + '</div><div class="cp-kpi-meta">' + esc(meta) + '</div></div>';
  }
  function cpModal(title, body, foot, narrow) {
    const mask = document.createElement('div');
    mask.className = 'cp-modal-mask';
    mask.innerHTML = '<div class="cp-modal' + (narrow ? ' narrow' : '') + '"><div class="cp-modal-head"><div class="cp-modal-title">' + esc(title) + '</div><button class="cp-close" aria-label="关闭">×</button></div><div class="cp-modal-body">' + body + '</div>' + (foot ? '<div class="cp-modal-foot">' + foot + '</div>' : '') + '</div>';
    mask.addEventListener('click', function (e) { if (e.target === mask) mask.remove(); });
    mask.querySelector('.cp-close').addEventListener('click', function () { mask.remove(); });
    (document.getElementById('pageContainer') || document.body).appendChild(mask);
    return mask;
  }
  function closeCpModals() { document.querySelectorAll('.cp-modal-mask').forEach(function (m) { m.remove(); }); }
  function cpSet(group, key, value) { state[group][key] = value; renderPage(state.page); }

  /* 雷达图 */
  function radar(dims, values, compare) {
    const R = 105, cx = 130, cy = 125, n = dims.length;
    const pt = function (i, r) {
      const a = -Math.PI / 2 + i * 2 * Math.PI / n;
      return [(cx + r * Math.cos(a)).toFixed(1), (cy + r * Math.sin(a)).toFixed(1)];
    };
    let g = '';
    [0.25, 0.5, 0.75, 1].forEach(function (k) {
      const pts = dims.map(function (_, i) { return pt(i, R * k).join(','); }).join(' ');
      g += '<polygon points="' + pts + '" fill="none" stroke="#e6ebf2"/>';
    });
    dims.forEach(function (d, i) {
      const p = pt(i, R);
      g += '<line x1="' + cx + '" y1="' + cy + '" x2="' + p[0] + '" y2="' + p[1] + '" stroke="#e6ebf2"/>';
      const lp = pt(i, R + 17);
      const anchor = Number(lp[0]) > cx + 6 ? 'start' : Number(lp[0]) < cx - 6 ? 'end' : 'middle';
      g += '<text x="' + lp[0] + '" y="' + (Number(lp[1]) + 3) + '" font-size="9.5" fill="#64748b" text-anchor="' + anchor + '">' + esc(d) + '</text>';
    });
    if (compare) {
      const pts = compare.map(function (v, i) { return pt(i, R * Math.max(0, Math.min(1, v / 100))).join(','); }).join(' ');
      g += '<polygon points="' + pts + '" fill="#94a3b8" fill-opacity="0.12" stroke="#94a3b8" stroke-width="1.4" stroke-dasharray="5 4"/>';
    }
    const pts = values.map(function (v, i) { return pt(i, R * Math.max(0, Math.min(1, v / 100))).join(','); }).join(' ');
    g += '<polygon points="' + pts + '" fill="#1d4ed8" fill-opacity="0.18" stroke="#1d4ed8" stroke-width="2"/>';
    values.forEach(function (v, i) { const p = pt(i, R * Math.max(0, Math.min(1, v / 100))); g += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="2.8" fill="#fff" stroke="#1d4ed8" stroke-width="1.6"/>'; });
    return '<div class="cp-radar"><svg viewBox="0 0 260 250" role="img" aria-label="专科能力多维得分雷达图">' + g + '</svg></div>';
  }

  /* ============ 机构清单（江西口径） ============ */
  const ORGS = [
    { name: '江西省肿瘤医院', city: '南昌市', level: '三级甲等', type: '肿瘤专科', beds: 1500 },
    { name: '南昌大学第一附属医院', city: '南昌市', level: '三级甲等', type: '综合', beds: 3800 },
    { name: '南昌大学第二附属医院', city: '南昌市', level: '三级甲等', type: '综合', beds: 3200 },
    { name: '赣州市人民医院', city: '赣州市', level: '三级甲等', type: '综合', beds: 2600 },
    { name: '九江市第一人民医院', city: '九江市', level: '三级甲等', type: '综合', beds: 2200 },
    { name: '上饶市人民医院', city: '上饶市', level: '三级甲等', type: '综合', beds: 1800 },
    { name: '宜春市人民医院', city: '宜春市', level: '三级乙等', type: '综合', beds: 1400 },
    { name: '吉安市中心人民医院', city: '吉安市', level: '三级甲等', type: '综合', beds: 1700 },
    { name: '抚州市第一人民医院', city: '抚州市', level: '三级乙等', type: '综合', beds: 1200 },
    { name: '萍乡市人民医院', city: '萍乡市', level: '三级乙等', type: '综合', beds: 1100 }
  ];

  /* ============ 1. 肿瘤诊疗技术目录 ============ */
  const techCatalog = [
    { code: 'ONC-SUR-001', name: '胸腔镜下肺叶切除+系统性淋巴结清扫', category: '外科手术', level: 'L4', cancers: ['C34 肺'], status: 'ACTIVE', version: 'V2026.1', issuedBy: '国家卫健委四级手术目录', minCase: 30, requireCert: '胸外科四级手术授权', keyIndicator: '术后30天死亡率、R0切除率、清扫淋巴结站数', effective: '2026-01-01' },
    { code: 'ONC-SUR-002', name: '腹腔镜辅助根治性全胃切除+D2淋巴结清扫', category: '外科手术', level: 'L4', cancers: ['C16 胃'], status: 'ACTIVE', version: 'V2026.1', issuedBy: '国家卫健委四级手术目录', minCase: 25, requireCert: '胃肠外科四级手术授权', keyIndicator: '术后并发症率、清扫淋巴结数≥16枚占比', effective: '2026-01-01' },
    { code: 'ONC-SUR-003', name: '腹腔镜低位直肠癌根治术（保肛）', category: '外科手术', level: 'L4', cancers: ['C18-20 结直肠'], status: 'ACTIVE', version: 'V2026.1', issuedBy: '国家卫健委四级手术目录', minCase: 20, requireCert: '结直肠外科四级手术授权', keyIndicator: '保肛率、吻合口漏发生率、环周切缘阴性率', effective: '2026-01-01' },
    { code: 'ONC-SUR-004', name: '肝段/半肝切除术（含解剖性肝切除）', category: '外科手术', level: 'L4', cancers: ['C22 肝'], status: 'ACTIVE', version: 'V2026.1', issuedBy: '国家卫健委四级手术目录', minCase: 20, requireCert: '肝胆外科四级手术授权', keyIndicator: '术后肝功能衰竭率、围手术期死亡率', effective: '2026-01-01' },
    { code: 'ONC-SUR-005', name: '乳腺癌改良根治术+前哨淋巴结活检', category: '外科手术', level: 'L3', cancers: ['C50 乳腺'], status: 'ACTIVE', version: 'V2026.1', issuedBy: '省级三级手术目录', minCase: 40, requireCert: '乳腺外科三级手术授权', keyIndicator: '前哨活检替代腋窝清扫比例、切缘阳性率', effective: '2026-01-01' },
    { code: 'ONC-RAD-001', name: '调强放射治疗（IMRT）', category: '放射治疗', level: 'L3', cancers: ['C34 肺', 'C53 宫颈', 'C15 食管'], status: 'ACTIVE', version: 'V2026.1', issuedBy: '省级放疗技术规范', minCase: 100, requireCert: '放疗科资质+物理师≥2名', keyIndicator: '计划一次通过率、危及器官剂量达标率', effective: '2026-01-01' },
    { code: 'ONC-RAD-002', name: '立体定向放射治疗（SBRT/SRS）', category: '放射治疗', level: 'RESTRICT', cancers: ['C34 肺', 'C22 肝'], status: 'ACTIVE', version: 'V2026.1', issuedBy: '国家限制类医疗技术目录', minCase: 20, requireCert: '限制类技术省级备案+每年复评', keyIndicator: '局部控制率、≥3级放射性损伤发生率', effective: '2026-01-01' },
    { code: 'ONC-RAD-003', name: '后装腔内近距离治疗', category: '放射治疗', level: 'L3', cancers: ['C53 宫颈'], status: 'ACTIVE', version: 'V2026.1', issuedBy: '省级放疗技术规范', minCase: 30, requireCert: '后装机配置+放射防护许可', keyIndicator: 'A点剂量达标率、直肠膀胱剂量超限率', effective: '2026-01-01' },
    { code: 'ONC-DRG-001', name: '靶向治疗（基于基因检测的精准用药）', category: '系统性药物治疗', level: 'ROUTINE', cancers: ['C34 肺', 'C18-20 结直肠', 'C50 乳腺'], status: 'ACTIVE', version: 'V2026.1', issuedBy: '国家诊疗规范', minCase: 50, requireCert: '基因检测报告+MDT记录', keyIndicator: '用药前基因检测率、超说明书用药备案率', effective: '2026-01-01' },
    { code: 'ONC-DRG-002', name: '免疫检查点抑制剂治疗', category: '系统性药物治疗', level: 'ROUTINE', cancers: ['C34 肺', 'C22 肝', 'C16 胃'], status: 'ACTIVE', version: 'V2026.1', issuedBy: '国家诊疗规范', minCase: 50, requireCert: 'irAE 处理预案+多学科会诊通道', keyIndicator: 'irAE 上报率、≥3级 irAE 处理及时率', effective: '2026-01-01' },
    { code: 'ONC-DRG-003', name: 'CAR-T 细胞治疗', category: '系统性药物治疗', level: 'RESTRICT', cancers: ['其他（血液肿瘤）'], status: 'DRAFT', version: 'V2026.2草案', issuedBy: '国家限制类医疗技术目录', minCase: 5, requireCert: '细胞治疗资质+ICU保障+省级备案', keyIndicator: 'CRS 分级处理规范率、90天生存率', effective: '待发布' },
    { code: 'ONC-INT-001', name: '经导管肝动脉化疗栓塞术（TACE）', category: '介入与微创', level: 'L3', cancers: ['C22 肝'], status: 'ACTIVE', version: 'V2026.1', issuedBy: '省级介入技术规范', minCase: 40, requireCert: '介入手术室+DSA设备', keyIndicator: '客观缓解率、术后严重不良事件率', effective: '2026-01-01' },
    { code: 'ONC-INT-002', name: '影像引导下经皮消融治疗（射频/微波）', category: '介入与微创', level: 'L4', cancers: ['C22 肝', 'C34 肺'], status: 'ACTIVE', version: 'V2026.1', issuedBy: '国家卫健委四级手术目录', minCase: 20, requireCert: '消融技术授权+影像引导条件', keyIndicator: '完全消融率、气胸/出血发生率', effective: '2026-01-01' },
    { code: 'ONC-PAT-001', name: '免疫组化辅助病理诊断（≥20项抗体）', category: '病理与分子诊断', level: 'ROUTINE', cancers: ['全癌种'], status: 'ACTIVE', version: 'V2026.1', issuedBy: '国家病理质控规范', minCase: 500, requireCert: '病理科室间质评合格', keyIndicator: '室间质评合格率、报告及时率', effective: '2026-01-01' },
    { code: 'ONC-PAT-002', name: '高通量测序（NGS）肿瘤基因检测', category: '病理与分子诊断', level: 'RESTRICT', cancers: ['全癌种'], status: 'ACTIVE', version: 'V2026.1', issuedBy: '临床基因扩增检验实验室技术规范', minCase: 100, requireCert: 'PCR实验室验收+室间质评', keyIndicator: '样本失败率、变异判读一致率', effective: '2026-01-01' },
    { code: 'ONC-NUC-001', name: '放射性核素治疗（¹³¹I、¹⁷⁷Lu 等）', category: '核医学与影像', level: 'RESTRICT', cancers: ['其他（甲状腺/神经内分泌）'], status: 'ACTIVE', version: 'V2026.1', issuedBy: '放射性药品使用许可（三/四类）', minCase: 20, requireCert: '辐射安全许可+核素病房', keyIndicator: '剂量给予准确率、辐射防护事件数', effective: '2026-01-01' },
    { code: 'ONC-NUC-002', name: 'PET/CT 肿瘤显像', category: '核医学与影像', level: 'ROUTINE', cancers: ['全癌种'], status: 'ACTIVE', version: 'V2026.1', issuedBy: '大型医用设备配置许可', minCase: 300, requireCert: '甲类/乙类设备配置证', keyIndicator: '报告与病理符合率、检查阳性率', effective: '2026-01-01' },
    { code: 'ONC-SUP-001', name: '肿瘤患者营养支持与全程管理', category: '综合支持治疗', level: 'ROUTINE', cancers: ['全癌种'], status: 'ACTIVE', version: 'V2026.1', issuedBy: '国家肿瘤规范化诊疗指南', minCase: 200, requireCert: '临床营养科+PG-SGA 筛查流程', keyIndicator: '营养风险筛查率、干预后体重维持率', effective: '2026-01-01' },
    { code: 'ONC-SUP-002', name: '癌痛规范化治疗（三阶梯+阿片类管理）', category: '综合支持治疗', level: 'ROUTINE', cancers: ['全癌种'], status: 'ACTIVE', version: 'V2026.1', issuedBy: '癌痛规范化治疗示范病房标准', minCase: 200, requireCert: '麻醉药品管理资质', keyIndicator: '疼痛评估率、中重度疼痛缓解率', effective: '2026-01-01' },
    { code: 'ONC-SUR-006', name: '开放式食管癌根治术（经左胸单切口）', category: '外科手术', level: 'L3', cancers: ['C15 食管'], status: 'RETIRED', version: 'V2024.2', issuedBy: '省级三级手术目录（已废止）', minCase: 0, requireCert: '-', keyIndicator: '-', effective: '2024-01-01 至 2025-12-31' }
  ];

  /* 机构能力系数：驱动技术开展量与质量指标水平，保证两处口径一致 */
  const ORG_VOL = { '江西省肿瘤医院': 1.55, '南昌大学第一附属医院': 1.0, '南昌大学第二附属医院': 0.95 };
  const ORG_CAP = {
    '江西省肿瘤医院': 1.00, '南昌大学第一附属医院': 0.93, '南昌大学第二附属医院': 0.87,
    '赣州市人民医院': 0.76, '九江市第一人民医院': 0.70, '上饶市人民医院': 0.64,
    '宜春市人民医院': 0.53, '吉安市中心人民医院': 0.66, '抚州市第一人民医院': 0.47, '萍乡市人民医院': 0.44
  };

  /* ============ 2. 机构技术开展记录 ============ */
  const techRecords = [];
  (function buildRecords() {
    const active = techCatalog.filter(function (t) { return t.status === 'ACTIVE'; });
    ORGS.forEach(function (org, oi) {
      const c = ORG_CAP[org.name];
      active.forEach(function (t, ti) {
        /* 能力弱的机构不开展限制类与部分四级技术 */
        const hard = t.level === 'RESTRICT' || t.level === 'L4';
        if (hard && c < 0.6) return;
        if (t.level === 'RESTRICT' && c < 0.75) return;
        const seed = (oi * 7 + ti * 13) % 11;
        const volume = Math.max(1, Math.round(t.minCase * c * (ORG_VOL[org.name] || 1) * (1.62 + seed * 0.085)));
        const reach = volume >= t.minCase;
        /* 质量得分：能力系数为主，加入可复现扰动 */
        const qScore = Math.min(99, Math.round(58 + c * 38 + (seed - 5) * 1.1));
        const audit = !reach ? 'UNQUALIFIED' : qScore >= 85 ? 'QUALIFIED' : qScore >= 74 ? 'QUALIFIED' : qScore >= 66 ? 'OBSERVE' : 'UNQUALIFIED';
        techRecords.push({
          id: 'TR-' + EVAL_YEAR + '-' + String(techRecords.length + 1).padStart(4, '0'),
          org: org.name, city: org.city, techCode: t.code, techName: t.name, category: t.category, level: t.level,
          year: EVAL_YEAR, volume, minCase: t.minCase, reach,
          certified: t.level === 'RESTRICT' ? (c >= 0.9 ? '已备案' : '备案中') : reach ? '已授权' : '未授权',
          teamSize: Math.max(2, Math.round(c * 12 + (seed % 3))),
          qualityScore: qScore,
          audit,
          complication: Number((6.5 - c * 3.4 + (seed - 5) * 0.18).toFixed(1)),
          perioperativeDeath: t.category === '外科手术' ? Number((1.55 - c * 1.05 + (seed - 5) * 0.05).toFixed(2)) : null,
          firstDate: '2019-0' + (1 + (seed % 8)) + '-1' + (seed % 9),
          lastAudit: EVAL_YEAR + '-0' + (3 + (seed % 6)) + '-1' + (seed % 8),
          note: !reach ? '年例数未达技术目录最低要求（' + t.minCase + ' 例），能力评分按未达标计。'
            : t.level === 'RESTRICT' && c < 0.9 ? '限制类技术省级备案尚在办理，暂不计入能力得分。'
              : '例数与质量指标均满足目录要求。'
        });
      });
    });
  })();

  /* ============ 3. 医疗质量核心指标明细 ============ */
  const QUALITY_DOMAIN = {
    SAFETY: '围手术期安全',
    PROCESS: '规范诊疗过程',
    OUTCOME: '治疗结果',
    EFFICIENCY: '效率与负担'
  };
  /* 指标定义：方向 lower=越低越好 / higher=越高越好 */
  const qualityDefs = [
    { code: 'MQ-001', name: '围手术期死亡率（术后30天内）', domain: 'SAFETY', unit: '%', dir: 'lower', target: 1.0, alert: 2.0, source: '病案首页+死亡登记关联', formula: '术后30天内死亡例数 / 同期肿瘤手术例数' },
    { code: 'MQ-002', name: '术后严重并发症率（Clavien-Dindo≥III级）', domain: 'SAFETY', unit: '%', dir: 'lower', target: 5.0, alert: 9.0, source: '手术记录+并发症登记', formula: 'III级及以上并发症例数 / 同期手术例数' },
    { code: 'MQ-003', name: '非计划再次手术率', domain: 'SAFETY', unit: '%', dir: 'lower', target: 1.5, alert: 3.0, source: '手术明细', formula: '同一住院期间非计划再手术例数 / 手术例数' },
    { code: 'MQ-004', name: '术后30天非计划再入院率', domain: 'SAFETY', unit: '%', dir: 'lower', target: 4.0, alert: 7.5, source: '住院流水', formula: '出院30天内非计划再入院例数 / 出院手术例数' },
    { code: 'MQ-005', name: '治疗前病理确诊率', domain: 'PROCESS', unit: '%', dir: 'higher', target: 92.0, alert: 85.0, source: '病理报告+治疗记录时序', formula: '治疗前取得病理诊断例数 / 抗肿瘤治疗例数' },
    { code: 'MQ-006', name: '临床分期完整登记率', domain: 'PROCESS', unit: '%', dir: 'higher', target: 95.0, alert: 88.0, source: '报告卡分期字段', formula: 'TNM分期完整例数 / 新发病例数' },
    { code: 'MQ-007', name: 'MDT 多学科会诊覆盖率（III-IV期）', domain: 'PROCESS', unit: '%', dir: 'higher', target: 80.0, alert: 60.0, source: 'MDT会诊记录', formula: 'III-IV期经MDT讨论例数 / III-IV期新发例数' },
    { code: 'MQ-008', name: '靶向用药前基因检测率', domain: 'PROCESS', unit: '%', dir: 'higher', target: 95.0, alert: 85.0, source: '医嘱+分子病理报告', formula: '用药前完成检测例数 / 靶向治疗例数' },
    { code: 'MQ-009', name: '疼痛评估率（住院肿瘤患者）', domain: 'PROCESS', unit: '%', dir: 'higher', target: 90.0, alert: 75.0, source: '护理评估记录', formula: '完成疼痛评估例数 / 住院肿瘤患者数' },
    { code: 'MQ-010', name: '营养风险筛查率', domain: 'PROCESS', unit: '%', dir: 'higher', target: 85.0, alert: 70.0, source: 'PG-SGA/NRS2002 记录', formula: '完成筛查例数 / 住院肿瘤患者数' },
    { code: 'MQ-011', name: 'R0 切除率（根治性手术）', domain: 'OUTCOME', unit: '%', dir: 'higher', target: 90.0, alert: 82.0, source: '病理切缘报告', formula: '切缘阴性例数 / 根治术例数' },
    { code: 'MQ-012', name: '淋巴结清扫达标率', domain: 'OUTCOME', unit: '%', dir: 'higher', target: 85.0, alert: 72.0, source: '病理淋巴结计数', formula: '清扫数达指南要求例数 / 相应术式例数' },
    { code: 'MQ-013', name: '放疗计划一次通过率', domain: 'OUTCOME', unit: '%', dir: 'higher', target: 90.0, alert: 80.0, source: '放疗TPS+物理师复核', formula: '首次复核通过计划数 / 计划总数' },
    { code: 'MQ-014', name: '平均住院日（肿瘤手术）', domain: 'EFFICIENCY', unit: '日', dir: 'lower', target: 12.0, alert: 16.0, source: '住院流水', formula: '手术病例住院日合计 / 手术例数' },
    { code: 'MQ-015', name: '术前平均住院日', domain: 'EFFICIENCY', unit: '日', dir: 'lower', target: 3.0, alert: 5.0, source: '住院流水', formula: '入院至手术日合计 / 手术例数' },
    { code: 'MQ-016', name: '抗菌药物治疗前病原学送检率', domain: 'EFFICIENCY', unit: '%', dir: 'higher', target: 60.0, alert: 45.0, source: '医嘱+微生物检验', formula: '送检例数 / 抗菌药物治疗例数' }
  ];

  const qualityRecords = [];
  (function buildQuality() {
    ORGS.forEach(function (org, oi) {
      const c = ORG_CAP[org.name];
      qualityDefs.forEach(function (def, di) {
        const seed = (oi * 5 + di * 11) % 13;
        let value;
        if (def.dir === 'lower') {
          /* 能力越强值越低；target 附近浮动 */
          const span = def.alert - def.target;
          value = def.target + span * (1.70 - c * 1.72) + span * (seed - 6) * 0.05;
          value = Math.max(def.target * 0.35, value);
        } else {
          const span = def.target - def.alert;
          value = def.target - span * (1.66 - c * 1.68) + span * (seed - 6) * 0.055;
          value = Math.min(99.5, Math.max(40, value));
        }
        value = Number(value.toFixed(def.unit === '日' ? 1 : 1));
        const meet = def.dir === 'lower' ? value <= def.target : value >= def.target;
        const alerted = def.dir === 'lower' ? value > def.alert : value < def.alert;
        const denom = Math.round((def.domain === 'SAFETY' || def.domain === 'OUTCOME' ? 620 : 1850) * c * (1 + (seed - 6) * 0.03));
        qualityRecords.push({
          id: 'MQR-' + EVAL_YEAR + '-' + String(qualityRecords.length + 1).padStart(4, '0'),
          org: org.name, city: org.city, code: def.code, name: def.name, domain: def.domain,
          unit: def.unit, dir: def.dir, target: def.target, alert: def.alert,
          value, meet, alerted, denom,
          numer: def.unit === '日' ? null : Math.round(denom * value / 100),
          period: EVAL_YEAR + ' 年度', source: def.source, formula: def.formula,
          provinceAvg: Number((def.dir === 'lower' ? def.target * 1.18 : def.target * 0.94).toFixed(1)),
          trend: [0, 1, 2].map(function (k) {
            const drift = def.dir === 'lower' ? 0.045 : -0.035;
            return Number((value * (1 + drift * (2 - k))).toFixed(1));
          })
        });
      });
    });
  })();

  /* ============ 4. 疑难病例收治特征库 ============ */
  const COMPLEX_FACTOR = {
    STAGE_LATE: { label: 'IV期/晚期转诊', weight: 1.6, note: '初诊即IV期或外院治疗失败后转入' },
    MULTI_PRIMARY: { label: '多原发癌', weight: 1.8, note: '同一患者两个及以上独立原发肿瘤' },
    RARE: { label: '罕见病理类型', weight: 1.9, note: '发病率低、诊疗路径不明确' },
    RECUR: { label: '复发转移再治疗', weight: 1.5, note: '术后复发或远处转移需再次系统治疗' },
    COMORBID: { label: '重度合并症', weight: 1.7, note: 'ASA≥III级、心肺肝肾功能不全或器官移植后' },
    ELDERLY: { label: '高龄（≥80岁）', weight: 1.4, note: '合并衰弱、器官储备下降' },
    SALVAGE: { label: '挽救性手术/再次手术', weight: 2.0, note: '放化疗后瘢痕区手术或复杂重建' },
    MULTI_ORGAN: { label: '联合多器官切除', weight: 1.9, note: '一次手术涉及两个及以上器官切除' }
  };
  const complexCases = [
    { id: 'CX-2025-00871', org: '江西省肿瘤医院', city: '南昌市', sex: '男', age: 67, dx: 'C34.1 左肺上叶鳞癌 IIIB 期 + C16.2 胃体腺癌 II 期', factors: ['MULTI_PRIMARY', 'STAGE_LATE', 'COMORBID'], asa: 'III级', tech: 'ONC-SUR-001', mdt: '胸外科/胃肠外科/放疗科/病理科/影像科 5 学科', los: 28, icu: 3, outcome: '同期分站手术，术后 R0，无 III 级以上并发症', cmiLike: 4.31, referredFrom: '宜春市人民医院', note: '双原发癌手术顺序与放疗介入时机由 MDT 三次讨论确定。' },
    { id: 'CX-2025-00844', org: '南昌大学第一附属医院', city: '南昌市', sex: '女', age: 54, dx: 'C22.0 肝细胞癌 复发（首次切除后 26 个月）伴门静脉癌栓', factors: ['RECUR', 'STAGE_LATE', 'SALVAGE'], asa: 'III级', tech: 'ONC-INT-002', mdt: '肝胆外科/介入科/肿瘤内科/影像科 4 学科', los: 21, icu: 2, outcome: '消融+TACE 联合，靶免转化治疗后部分缓解', cmiLike: 4.02, referredFrom: '九江市第一人民医院', note: '癌栓分型 Vp3，不宜再次切除，转为局部治疗+系统治疗。' },
    { id: 'CX-2025-00812', org: '江西省肿瘤医院', city: '南昌市', sex: '女', age: 39, dx: 'C53.9 宫颈小细胞神经内分泌癌 IIIC1 期', factors: ['RARE', 'STAGE_LATE'], asa: 'II级', tech: 'ONC-RAD-003', mdt: '妇瘤科/放疗科/病理科/核医学科 4 学科', los: 34, icu: 0, outcome: '同步放化疗+后装，治疗结束评估完全缓解', cmiLike: 3.88, referredFrom: '赣州市人民医院', note: '罕见病理类型，病理科加做 5 项免疫组化并送省级会诊确认。' },
    { id: 'CX-2025-00790', org: '南昌大学第二附属医院', city: '南昌市', sex: '男', age: 82, dx: 'C18.7 乙状结肠癌 III 期，合并冠心病 PCI 术后、慢性肾功能不全 III 期', factors: ['ELDERLY', 'COMORBID'], asa: 'III级', tech: 'ONC-SUR-003', mdt: '结直肠外科/心内科/肾内科/麻醉科/营养科 5 学科', los: 24, icu: 4, outcome: '腹腔镜手术顺利，术后急性肾损伤经处理恢复', cmiLike: 3.55, referredFrom: '本院门诊', note: '高龄+多器官功能不全，术前完成心肺功能与衰弱评估。' },
    { id: 'CX-2025-00763', org: '赣州市人民医院', city: '赣州市', sex: '男', age: 61, dx: 'C15.5 食管下段癌 放化疗后局部残留', factors: ['SALVAGE', 'RECUR'], asa: 'III级', tech: 'ONC-SUR-006', mdt: '胸外科/放疗科/肿瘤内科 3 学科', los: 31, icu: 5, outcome: '挽救性食管切除+胃代食管，术后吻合口漏经引流愈合', cmiLike: 4.15, referredFrom: '本院放疗科', note: '放疗后瘢痕区手术难度显著增加，术后并发症在预期范围内。' },
    { id: 'CX-2025-00741', org: '江西省肿瘤医院', city: '南昌市', sex: '女', age: 48, dx: 'C50.4 右乳浸润性癌 IV 期（肝、骨转移）新辅助后降期', factors: ['STAGE_LATE', 'RECUR'], asa: 'II级', tech: 'ONC-DRG-001', mdt: '乳腺科/肿瘤内科/放疗科/介入科 4 学科', los: 12, icu: 0, outcome: '靶向+化疗后原发灶降期，行姑息性局部治疗', cmiLike: 3.42, referredFrom: '上饶市人民医院', note: 'HER2 阳性，双靶治疗方案经 MDT 与药事共同确认。' },
    { id: 'CX-2025-00718', org: '九江市第一人民医院', city: '九江市', sex: '男', age: 58, dx: 'C22.9 肝癌侵犯右侧膈肌及右肾上腺', factors: ['MULTI_ORGAN', 'STAGE_LATE'], asa: 'III级', tech: 'ONC-SUR-004', mdt: '肝胆外科/泌尿外科/胸外科/麻醉科 4 学科', los: 26, icu: 4, outcome: '联合右半肝+膈肌部分+肾上腺切除，膈肌补片修补', cmiLike: 4.44, referredFrom: '本院', note: '联合多器官切除，术中出血 1200ml，输血 4U。' },
    { id: 'CX-2025-00695', org: '吉安市中心人民医院', city: '吉安市', sex: '女', age: 73, dx: 'C16.0 胃食管结合部癌 III 期，合并糖尿病、重度营养不良（PG-SGA 12 分）', factors: ['COMORBID', 'ELDERLY'], asa: 'III级', tech: 'ONC-SUR-002', mdt: '胃肠外科/内分泌科/营养科/麻醉科 4 学科', los: 29, icu: 2, outcome: '术前营养支持 10 天后手术，术后无吻合口相关并发症', cmiLike: 3.61, referredFrom: '本院', note: '术前营养干预使白蛋白由 28g/L 升至 35g/L 后方手术。' },
    { id: 'CX-2025-00672', org: '南昌大学第一附属医院', city: '南昌市', sex: '男', age: 44, dx: '腹膜后去分化脂肪样脂肪肉瘤（罕见），累及下腔静脉', factors: ['RARE', 'MULTI_ORGAN', 'SALVAGE'], asa: 'IV级', tech: 'ONC-SUR-004', mdt: '普外科/血管外科/骨软组织肿瘤科/病理科/麻醉科 5 学科', los: 42, icu: 9, outcome: '联合下腔静脉人工血管置换，术后恢复出院', cmiLike: 5.12, referredFrom: '抚州市第一人民医院', note: '本年度全省难度最高病例，术中体外循环团队待命。' },
    { id: 'CX-2025-00650', org: '上饶市人民医院', city: '上饶市', sex: '女', age: 66, dx: 'C34.3 右肺下叶腺癌 术后 3 年脑单转移', factors: ['RECUR'], asa: 'II级', tech: 'ONC-RAD-002', mdt: '肿瘤内科/放疗科/神经外科 3 学科', los: 9, icu: 0, outcome: 'SRS 治疗后 3 个月复查病灶缩小', cmiLike: 3.05, referredFrom: '本院', note: '限制类技术 SBRT/SRS 由省级会诊后在本院实施。' }
  ];

  /* 疑难收治特征汇总（按机构） */
  function complexProfile(orgName) {
    const list = complexCases.filter(function (c) { return c.org === orgName; });
    const factorAgg = {};
    list.forEach(function (c) { c.factors.forEach(function (f) { factorAgg[f] = (factorAgg[f] || 0) + 1; }); });
    const cmi = list.length ? list.reduce(function (a, c) { return a + c.cmiLike; }, 0) / list.length : 0;
    const referredIn = list.filter(function (c) { return c.referredFrom && c.referredFrom.indexOf('本院') < 0; }).length;
    return { list, factorAgg, cmi, referredIn, avgLos: list.length ? list.reduce(function (a, c) { return a + c.los; }, 0) / list.length : 0 };
  }

  /* ============ 5. 专科能力综合评分引擎 ============ */
  const SCORE_DIMS = [
    { key: 'tech', name: '技术广度', weight: 0.22, desc: '现行目录中已达标开展的技术占比，四级/限制类技术加权' },
    { key: 'volume', name: '服务规模', weight: 0.16, desc: '技术开展例数相对全省同级机构中位数的水平' },
    { key: 'safety', name: '围手术期安全', weight: 0.20, desc: '围手术期死亡率、严重并发症率、非计划再手术与再入院' },
    { key: 'process', name: '规范诊疗', weight: 0.18, desc: '病理确诊、分期登记、MDT 覆盖、基因检测、疼痛与营养筛查' },
    { key: 'outcome', name: '治疗结果', weight: 0.14, desc: 'R0 切除率、淋巴结清扫达标率、放疗计划一次通过率' },
    { key: 'complex', name: '疑难收治', weight: 0.10, desc: '疑难病例难度指数与外院转入占比' }
  ];

  function domainScore(orgName, domainKey) {
    const list = qualityRecords.filter(function (r) { return r.org === orgName && r.domain === domainKey; });
    if (!list.length) return 0;
    /* 每个指标按与目标/预警线的相对位置线性折算 0-100 */
    const scores = list.map(function (r) {
      if (r.dir === 'lower') {
        if (r.value <= r.target) return Math.min(100, 90 + (r.target - r.value) / Math.max(r.target, 0.01) * 10);
        if (r.value >= r.alert) return Math.max(20, 60 - (r.value - r.alert) / Math.max(r.alert, 0.01) * 40);
        return 60 + (r.alert - r.value) / Math.max(r.alert - r.target, 0.01) * 30;
      }
      if (r.value >= r.target) return Math.min(100, 90 + (r.value - r.target) / Math.max(100 - r.target, 0.01) * 10);
      if (r.value <= r.alert) return Math.max(20, 60 - (r.alert - r.value) / Math.max(r.alert, 0.01) * 40);
      return 60 + (r.value - r.alert) / Math.max(r.target - r.alert, 0.01) * 30;
    });
    return scores.reduce(function (a, b) { return a + b; }, 0) / scores.length;
  }

  function scoreOrg(orgName) {
    const org = ORGS.find(function (o) { return o.name === orgName; });
    const recs = techRecords.filter(function (r) { return r.org === orgName; });
    const activeTech = techCatalog.filter(function (t) { return t.status === 'ACTIVE'; });

    /* 技术广度：达标开展的加权技术分 / 目录加权总分 */
    const weightOf = function (level) { return level === 'RESTRICT' ? 2.0 : level === 'L4' ? 1.7 : level === 'L3' ? 1.2 : 1.0; };
    const totalW = activeTech.reduce(function (a, t) { return a + weightOf(t.level); }, 0);
    const gotW = recs.filter(function (r) { return r.reach && r.audit !== 'UNQUALIFIED' && r.certified !== '备案中'; })
      .reduce(function (a, r) { return a + weightOf(r.level); }, 0);
    const techScore = Math.min(100, gotW / totalW * 100);

    /* 服务规模：例数相对全省该技术中位数 */
    const ratios = recs.map(function (r) {
      const peers = techRecords.filter(function (x) { return x.techCode === r.techCode; }).map(function (x) { return x.volume; }).sort(function (a, b) { return a - b; });
      const med = peers[Math.floor(peers.length / 2)] || 1;
      return Math.min(2.2, r.volume / med);
    });
    const volumeScore = ratios.length ? Math.min(100, ratios.reduce(function (a, b) { return a + b; }, 0) / ratios.length * 52) : 0;

    const safetyScore = domainScore(orgName, 'SAFETY');
    const processScore = domainScore(orgName, 'PROCESS');
    const outcomeScore = domainScore(orgName, 'OUTCOME');

    /* 疑难收治：难度指数与转入占比 */
    const cp = complexProfile(orgName);
    const complexScore = Math.min(100, cp.list.length ? Math.min(100, cp.cmi / 5.2 * 82 + cp.referredIn / cp.list.length * 18) : 35);

    const parts = { tech: techScore, volume: volumeScore, safety: safetyScore, process: processScore, outcome: outcomeScore, complex: complexScore };
    const total = SCORE_DIMS.reduce(function (a, d) { return a + parts[d.key] * d.weight; }, 0);
    return {
      org: orgName, city: org ? org.city : '', level: org ? org.level : '', type: org ? org.type : '', beds: org ? org.beds : 0,
      parts, total,
      grade: gradeOf(total),
      techCount: recs.filter(function (r) { return r.reach; }).length,
      techTotal: activeTech.length,
      restrictCount: recs.filter(function (r) { return r.level === 'RESTRICT' && r.certified === '已备案'; }).length,
      l4Count: recs.filter(function (r) { return r.level === 'L4' && r.reach; }).length,
      volume: recs.reduce(function (a, r) { return a + r.volume; }, 0),
      alertedIndicators: qualityRecords.filter(function (r) { return r.org === orgName && r.alerted; }),
      unmetIndicators: qualityRecords.filter(function (r) { return r.org === orgName && !r.meet; }).length,
      complex: cp
    };
  }

  const scoreBoard = ORGS.map(function (o) { return scoreOrg(o.name); }).sort(function (a, b) { return b.total - a.total; });
  scoreBoard.forEach(function (s, i) { s.rank = i + 1; });
  const provinceAvgParts = {};
  SCORE_DIMS.forEach(function (d) {
    provinceAvgParts[d.key] = scoreBoard.reduce(function (a, s) { return a + s.parts[d.key]; }, 0) / scoreBoard.length;
  });

  /* ==================== 页面 1：诊疗技术目录 ==================== */
  function renderCatalog() {
    const f = state.catalog, kw = f.keyword.trim().toLowerCase();
    const list = techCatalog.filter(function (t) {
      return (f.category === 'ALL' || t.category === f.category)
        && (f.level === 'ALL' || t.level === f.level)
        && (f.status === 'ALL' || t.status === f.status)
        && (!kw || [t.code, t.name, t.category, t.cancers.join(' '), t.issuedBy].join(' ').toLowerCase().includes(kw));
    });
    const active = techCatalog.filter(function (t) { return t.status === 'ACTIVE'; });
    const kpis = [
      cpKpi('目录技术总数', techCatalog.length, '含草案与已废止'),
      cpKpi('现行技术', active.length, '作为能力评估基础', 'ok'),
      cpKpi('四级手术', active.filter(function (t) { return t.level === 'L4'; }).length, '国家四级手术目录口径'),
      cpKpi('限制类技术', active.filter(function (t) { return t.level === 'RESTRICT'; }).length, '须省级备案并定期复评', 'warn'),
      cpKpi('技术类别', TECH_CATEGORY.length, '外科/放疗/药物/介入/病理/核医学/支持'),
      cpKpi('当前版本', 'V2026.1', '发布日 2026-01-01')
    ].join('');

    const rows = list.map(function (t) {
      return '<tr>' +
        '<td class="cp-nowrap"><button class="cp-id" onclick="showTechDetail(\'' + t.code + '\')">' + t.code + '</button><div class="cp-sec">' + esc(t.version) + '</div></td>' +
        '<td>' + esc(t.name) + '<div class="cp-sec">' + esc(t.issuedBy) + '</div></td>' +
        '<td class="cp-nowrap">' + esc(t.category) + '</td>' +
        '<td class="cp-nowrap">' + badge(TECH_LEVEL[t.level]) + '</td>' +
        '<td>' + t.cancers.map(function (c) { return '<span class="cp-chip">' + esc(c) + '</span>'; }).join('') + '</td>' +
        '<td class="cp-num cp-nowrap">' + (t.minCase ? t.minCase + ' 例/年' : '-') + '</td>' +
        '<td>' + esc(t.requireCert) + '</td>' +
        '<td class="cp-nowrap">' + badge(CATALOG_STATUS[t.status]) + '<div class="cp-sec">' + esc(t.effective) + '</div></td>' +
        '<td class="cp-nowrap"><button class="btn btn-ghost btn-xs" onclick="showTechDetail(\'' + t.code + '\')">详情</button> <button class="btn btn-outline btn-xs" onclick="showTechOrgs(\'' + t.code + '\')">开展机构</button></td>' +
        '</tr>';
    }).join('');

    const catOpts = [['ALL', '全部类别']].concat(TECH_CATEGORY.map(function (c) { return [c, c]; }))
      .map(function (o) { return '<option value="' + esc(o[0]) + '"' + (f.category === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');
    const lvOpts = [['ALL', '全部分级']].concat(Object.keys(TECH_LEVEL).map(function (k) { return [k, TECH_LEVEL[k].label]; }))
      .map(function (o) { return '<option value="' + o[0] + '"' + (f.level === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');
    const stOpts = [['ALL', '全部状态']].concat(Object.keys(CATALOG_STATUS).map(function (k) { return [k, CATALOG_STATUS[k].label]; }))
      .map(function (o) { return '<option value="' + o[0] + '"' + (f.status === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');

    const catRows = TECH_CATEGORY.map(function (c) {
      const sub = active.filter(function (t) { return t.category === c; });
      const hard = sub.filter(function (t) { return t.level === 'L4' || t.level === 'RESTRICT'; }).length;
      return '<tr><td>' + esc(c) + '</td><td class="cp-num">' + sub.length + '</td><td class="cp-num">' + hard + '</td>' +
        '<td class="cp-num">' + (sub.length ? n1(hard / sub.length * 100) : '0.0') + '%' + bar(sub.length ? hard / sub.length * 100 : 0, hard / Math.max(sub.length, 1) > 0.5 ? 'warn' : '') + '</td></tr>';
    }).join('');

    return '<div class="cp-page">' + cpHeader('肿瘤诊疗技术目录',
      '建立标准化的肿瘤诊疗技术清单，<b>作为能力评估基础</b>。技术分级采用国家四级手术目录与限制类医疗技术目录口径；每项技术定义最低年例数、资质要求与关键质量指标，机构开展记录与能力评分均以此目录为准绳。', [
      '<button class="btn btn-outline btn-sm" onclick="cpToastMsg(\'目录已导出\')">导出目录</button>',
      '<button class="btn btn-outline btn-sm" onclick="showCatalogVersion()">版本历史</button>',
      '<button class="btn btn-primary btn-sm" onclick="navigateTo(\'cap-records\')">查看开展记录</button>'
    ]) +
      '<div class="cp-kpis">' + kpis + '</div>' +
      '<div class="cp-filter">' +
      '<div class="form-group"><label>技术类别</label><select onchange="cpSet(\'catalog\',\'category\',this.value)">' + catOpts + '</select></div>' +
      '<div class="form-group"><label>技术分级</label><select onchange="cpSet(\'catalog\',\'level\',this.value)">' + lvOpts + '</select></div>' +
      '<div class="form-group"><label>目录状态</label><select onchange="cpSet(\'catalog\',\'status\',this.value)">' + stOpts + '</select></div>' +
      '<div class="form-group" style="grid-column:span 2"><label>检索</label><input value="' + esc(f.keyword) + '" placeholder="技术编码 / 名称 / 适用癌种" onchange="cpSet(\'catalog\',\'keyword\',this.value)"></div>' +
      '<div class="filter-actions"><button class="btn btn-outline btn-sm" onclick="cpResetCatalog()">重置</button></div></div>' +
      '<div class="cp-table-wrap"><table class="cp-table"><thead><tr><th>编码 / 版本</th><th>技术名称</th><th>类别</th><th>分级</th><th>适用癌种</th><th>最低例数</th><th>资质要求</th><th>状态</th><th>操作</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="9"><div class="cp-empty">暂无符合条件的技术</div></td></tr>') + '</tbody></table></div>' +
      '<div class="cp-card" style="margin-top:14px"><div class="cp-card-head"><div class="cp-card-title">类别构成与难度分布<span class="cp-card-sub">现行 ' + active.length + ' 项</span></div></div>' +
      '<div class="cp-card-body"><table class="cp-pivot" style="width:100%"><thead><tr><th>类别</th><th>现行技术数</th><th>四级/限制类</th><th>高难度占比</th></tr></thead><tbody>' + catRows + '</tbody></table>' +
      '<div class="cp-note" style="margin-top:9px">高难度占比高的类别对人员资质与设备条件要求更严，是市级机构能力短板的集中区域。</div></div></div>' +
      '</div>';
  }
  function cpResetCatalog() { state.catalog = { category: 'ALL', level: 'ALL', status: 'ALL', keyword: '' }; renderPage(state.page); }
  function cpToastMsg(m) { cpToast(m); }

  function showTechDetail(code) {
    const t = techCatalog.find(function (x) { return x.code === code; });
    if (!t) return;
    const recs = techRecords.filter(function (r) { return r.techCode === code; });
    const fields = [
      ['技术编码', t.code], ['技术名称', t.name], ['技术类别', t.category], ['技术分级', TECH_LEVEL[t.level].label],
      ['分级依据', TECH_LEVEL[t.level].note], ['发布依据', t.issuedBy], ['目录版本', t.version], ['目录状态', CATALOG_STATUS[t.status].label],
      ['最低年例数', t.minCase ? t.minCase + ' 例' : '-'], ['资质要求', t.requireCert], ['生效期间', t.effective],
      ['全省开展机构', recs.length + ' 家'], ['其中达标', recs.filter(function (r) { return r.reach; }).length + ' 家']
    ].map(function (x) { return '<div class="cp-field"><div class="cp-field-label">' + esc(x[0]) + '</div><div class="cp-value">' + esc(x[1]) + '</div></div>'; }).join('');
    const body = '<div class="cp-fields">' + fields + '</div>' +
      '<div class="cp-sect"><h4 class="cp-h">适用癌种</h4><div>' + t.cancers.map(function (c) { return '<span class="cp-chip">' + esc(c) + '</span>'; }).join('') + '</div></div>' +
      '<div class="cp-sect"><h4 class="cp-h">关键质量指标</h4><div class="cp-callout">' + esc(t.keyIndicator) + '</div></div>' +
      (t.status === 'RETIRED' ? '<div class="cp-sect"><div class="cp-callout warn"><strong>已废止：</strong>本技术自 2026 年起不再纳入能力评分，历史开展记录保留用于纵向对比。</div></div>'
        : t.level === 'RESTRICT' ? '<div class="cp-sect"><div class="cp-callout warn"><strong>限制类技术：</strong>开展前须完成省级备案，每年接受技术能力复评；未备案机构的开展量不计入能力得分。</div></div>' : '');
    const mask = cpModal('技术目录详情 · ' + t.code, body, '<button class="btn btn-ghost" data-close>关闭</button><button class="btn btn-primary" onclick="showTechOrgs(\'' + t.code + '\')">查看开展机构</button>');
    mask.querySelector('[data-close]').addEventListener('click', function () { mask.remove(); });
  }

  function showTechOrgs(code) {
    const t = techCatalog.find(function (x) { return x.code === code; });
    const recs = techRecords.filter(function (r) { return r.techCode === code; }).sort(function (a, b) { return b.volume - a.volume; });
    const rows = recs.length ? recs.map(function (r) {
      return '<tr><td>' + esc(r.org) + '<div class="cp-sec">' + esc(r.city) + '</div></td>' +
        '<td class="cp-num cp-nowrap">' + nInt(r.volume) + '<div class="cp-sec">下限 ' + r.minCase + '</div></td>' +
        '<td class="cp-nowrap">' + (r.reach ? '<span class="badge badge-success">达标</span>' : '<span class="badge badge-danger">未达标</span>') + '</td>' +
        '<td class="cp-nowrap">' + esc(r.certified) + '</td>' +
        '<td class="cp-num cp-nowrap">' + r.qualityScore + '</td>' +
        '<td class="cp-nowrap">' + badge(AUDIT_RESULT[r.audit]) + '</td></tr>';
    }).join('') : '<tr><td colspan="6"><div class="cp-empty">全省尚无机构开展该技术</div></td></tr>';
    const body = '<div class="cp-callout">技术：<strong>' + esc(t ? t.name : code) + '</strong>（' + esc(t ? TECH_LEVEL[t.level].label : '') + '，最低 ' + (t ? t.minCase : 0) + ' 例/年）</div>' +
      '<div class="cp-sect"><div class="cp-table-wrap"><table class="cp-table" style="min-width:0"><thead><tr><th>机构</th><th>' + EVAL_YEAR + ' 年例数</th><th>例数达标</th><th>授权/备案</th><th>质量分</th><th>评价</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    const mask = cpModal('开展机构 · ' + code, body, '<button class="btn btn-ghost" data-close>关闭</button>');
    mask.querySelector('[data-close]').addEventListener('click', function () { mask.remove(); });
  }

  function showCatalogVersion() {
    const rows = [
      ['V2026.1', '2026-01-01', '现行', '新增 CAR-T（草案）、NGS 基因检测纳入限制类；废止开放式食管癌根治术（经左胸单切口）'],
      ['V2025.1', '2025-01-01', '已归档', '新增立体定向放射治疗为限制类技术；调整胃癌 D2 最低例数 20→25 例'],
      ['V2024.2', '2024-07-01', '已归档', '首次将营养支持与癌痛规范化治疗纳入综合支持治疗类别'],
      ['V2024.1', '2024-01-01', '已归档', '目录首版发布，共 16 项技术']
    ].map(function (r) { return '<tr><td>' + esc(r[0]) + '</td><td class="cp-nowrap">' + esc(r[1]) + '</td><td class="cp-nowrap">' + esc(r[2]) + '</td><td style="text-align:left;white-space:normal">' + esc(r[3]) + '</td></tr>'; }).join('');
    const mask = cpModal('技术目录版本历史', '<table class="cp-pivot" style="width:100%"><thead><tr><th>版本</th><th>生效日</th><th>状态</th><th>主要变更</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="cp-callout" style="margin-top:11px">能力评分始终按评估年度当时生效的目录版本计算，跨年度对比时以报告中标注的目录版本为准。</div>',
      '<button class="btn btn-ghost" data-close>关闭</button>', true);
    mask.querySelector('[data-close]').addEventListener('click', function () { mask.remove(); });
  }

  /* ==================== 页面 2：机构技术开展记录 ==================== */
  function renderRecords() {
    const f = state.records, kw = f.keyword.trim().toLowerCase();
    const list = techRecords.filter(function (r) {
      return (f.org === 'ALL' || r.org === f.org)
        && (f.level === 'ALL' || r.level === f.level)
        && (f.audit === 'ALL' || r.audit === f.audit)
        && (!kw || [r.id, r.org, r.techName, r.techCode, r.category].join(' ').toLowerCase().includes(kw));
    });
    const reachCount = techRecords.filter(function (r) { return r.reach; }).length;
    const unqualified = techRecords.filter(function (r) { return r.audit === 'UNQUALIFIED'; }).length;
    const pendingCert = techRecords.filter(function (r) { return r.certified === '备案中'; }).length;
    const kpis = [
      cpKpi('开展记录', techRecords.length, EVAL_YEAR + ' 年度 · ' + ORGS.length + ' 家机构'),
      cpKpi('例数达标', reachCount, n1(reachCount / techRecords.length * 100) + '% 记录达目录下限', 'ok'),
      cpKpi('评价不合格', unqualified, '例数或质量未达要求', unqualified ? 'danger' : 'ok'),
      cpKpi('限制类备案中', pendingCert, '未完成备案不计入能力得分', pendingCert ? 'warn' : 'ok'),
      cpKpi('总开展例数', nInt(techRecords.reduce(function (a, r) { return a + r.volume; }, 0)), '全省合计'),
      cpKpi('四级手术记录', techRecords.filter(function (r) { return r.level === 'L4'; }).length, '含未达标')
    ].join('');

    const rows = list.slice(0, 60).map(function (r) {
      const reachRatio = Math.min(150, r.volume / Math.max(r.minCase, 1) * 100);
      return '<tr>' +
        '<td class="cp-nowrap"><button class="cp-id" onclick="showRecordDetail(\'' + r.id + '\')">' + r.id + '</button><div class="cp-sec">' + esc(r.techCode) + '</div></td>' +
        '<td>' + esc(r.org) + '<div class="cp-sec">' + esc(r.city) + '</div></td>' +
        '<td>' + esc(r.techName) + '<div class="cp-sec">' + esc(r.category) + '</div></td>' +
        '<td class="cp-nowrap">' + badge(TECH_LEVEL[r.level]) + '</td>' +
        '<td class="cp-num cp-nowrap">' + nInt(r.volume) + '<div class="cp-sec">下限 ' + r.minCase + '</div>' + bar(reachRatio, r.reach ? 'ok' : 'bad') + '</td>' +
        '<td class="cp-num cp-nowrap">' + r.teamSize + ' 人</td>' +
        '<td class="cp-num cp-nowrap">' + r.qualityScore + '<div class="cp-sec">并发症 ' + n1(r.complication) + '%</div></td>' +
        '<td class="cp-nowrap">' + esc(r.certified) + '</td>' +
        '<td class="cp-nowrap">' + badge(AUDIT_RESULT[r.audit]) + '<div class="cp-sec">' + esc(r.lastAudit) + '</div></td>' +
        '<td class="cp-nowrap"><button class="btn btn-ghost btn-xs" onclick="showRecordDetail(\'' + r.id + '\')">详情</button></td>' +
        '</tr>';
    }).join('');

    const orgOpts = [['ALL', '全部机构']].concat(ORGS.map(function (o) { return [o.name, o.name]; }))
      .map(function (o) { return '<option value="' + esc(o[0]) + '"' + (f.org === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');
    const lvOpts = [['ALL', '全部分级']].concat(Object.keys(TECH_LEVEL).map(function (k) { return [k, TECH_LEVEL[k].label]; }))
      .map(function (o) { return '<option value="' + o[0] + '"' + (f.level === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');
    const auOpts = [['ALL', '全部评价']].concat(Object.keys(AUDIT_RESULT).map(function (k) { return [k, AUDIT_RESULT[k].label]; }))
      .map(function (o) { return '<option value="' + o[0] + '"' + (f.audit === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');

    /* 机构能力矩阵：机构 × 技术类别 达标数 */
    const head = '<tr><th>机构</th>' + TECH_CATEGORY.map(function (c) { return '<th>' + esc(c.slice(0, 4)) + '</th>'; }).join('') + '<th>达标合计</th></tr>';
    const matrix = ORGS.map(function (o) {
      const cells = TECH_CATEGORY.map(function (c) {
        const sub = techRecords.filter(function (r) { return r.org === o.name && r.category === c; });
        const ok = sub.filter(function (r) { return r.reach; }).length;
        return '<td>' + (sub.length ? ok + '/' + sub.length : '-') + '</td>';
      }).join('');
      const total = techRecords.filter(function (r) { return r.org === o.name && r.reach; }).length;
      return '<tr><td>' + esc(o.name) + '</td>' + cells + '<td><strong>' + total + '</strong></td></tr>';
    }).join('');

    return '<div class="cp-page">' + cpHeader('机构技术开展记录',
      '记录各机构开展特定技术的<b>数量与质量</b>，用于能力画像。例数对照技术目录最低要求判定达标；质量分综合并发症率、围手术期死亡率与关键指标；限制类技术未完成省级备案的开展量不计入能力得分。', [
      '<button class="btn btn-outline btn-sm" onclick="cpToastMsg(\'开展记录已导出\')">导出记录</button>',
      '<button class="btn btn-outline btn-sm" onclick="navigateTo(\'cap-quality\')">医疗质量指标</button>',
      '<button class="btn btn-primary btn-sm" onclick="navigateTo(\'cap-score\')">生成能力评分</button>'
    ]) +
      '<div class="cp-kpis">' + kpis + '</div>' +
      '<div class="cp-filter">' +
      '<div class="form-group" style="grid-column:span 2"><label>机构</label><select onchange="cpSet(\'records\',\'org\',this.value)">' + orgOpts + '</select></div>' +
      '<div class="form-group"><label>技术分级</label><select onchange="cpSet(\'records\',\'level\',this.value)">' + lvOpts + '</select></div>' +
      '<div class="form-group"><label>评价结果</label><select onchange="cpSet(\'records\',\'audit\',this.value)">' + auOpts + '</select></div>' +
      '<div class="form-group" style="grid-column:span 2"><label>检索</label><input value="' + esc(f.keyword) + '" placeholder="记录号 / 技术名称 / 编码" onchange="cpSet(\'records\',\'keyword\',this.value)"></div>' +
      '<div class="filter-actions"><button class="btn btn-outline btn-sm" onclick="cpResetRecords()">重置</button></div></div>' +
      '<div class="cp-table-wrap"><table class="cp-table"><thead><tr><th>记录号</th><th>机构</th><th>技术</th><th>分级</th><th>年例数</th><th>团队</th><th>质量分</th><th>授权/备案</th><th>评价</th><th>操作</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="10"><div class="cp-empty">暂无符合条件的开展记录</div></td></tr>') + '</tbody></table></div>' +
      (list.length > 60 ? '<div class="cp-note" style="margin-top:8px">共 ' + list.length + ' 条，已显示前 60 条，请使用筛选缩小范围。</div>' : '') +
      '<div class="cp-card" style="margin-top:14px"><div class="cp-card-head"><div class="cp-card-title">机构技术能力矩阵<span class="cp-card-sub">达标数 / 开展数</span></div></div>' +
      '<div class="cp-card-body" style="overflow:auto"><table class="cp-pivot"><thead>' + head + '</thead><tbody>' + matrix + '</tbody></table>' +
      '<div class="cp-note" style="margin-top:9px">"-"表示该机构未开展该类别任何技术；能力弱的机构在四级与限制类技术上普遍缺项，是专科能力建设的重点方向。</div></div></div>' +
      '</div>';
  }
  function cpResetRecords() { state.records = { org: 'ALL', level: 'ALL', audit: 'ALL', keyword: '' }; renderPage(state.page); }

  function showRecordDetail(id) {
    const r = techRecords.find(function (x) { return x.id === id; });
    if (!r) return;
    const t = techCatalog.find(function (x) { return x.code === r.techCode; });
    const peers = techRecords.filter(function (x) { return x.techCode === r.techCode; }).sort(function (a, b) { return b.volume - a.volume; });
    const rank = peers.findIndex(function (x) { return x.id === r.id; }) + 1;
    const fields = [
      ['记录号', r.id], ['机构', r.org], ['所属地市', r.city], ['评估年度', r.year],
      ['技术编码', r.techCode], ['技术名称', r.techName], ['技术分级', TECH_LEVEL[r.level].label],
      ['年开展例数', nInt(r.volume) + ' 例'], ['目录最低例数', r.minCase + ' 例'],
      ['例数达标', r.reach ? '达标' : '未达标'], ['省内例数排名', rank + ' / ' + peers.length],
      ['授权/备案', r.certified], ['技术团队', r.teamSize + ' 人'],
      ['质量得分', String(r.qualityScore)], ['严重并发症率', n1(r.complication) + '%'],
      ['围手术期死亡率', r.perioperativeDeath === null ? '不适用（非手术技术）' : n2(r.perioperativeDeath) + '%'],
      ['首次开展', r.firstDate], ['最近评价', r.lastAudit], ['评价结果', AUDIT_RESULT[r.audit].label]
    ].map(function (x) { return '<div class="cp-field"><div class="cp-field-label">' + esc(x[0]) + '</div><div class="cp-value">' + esc(x[1]) + '</div></div>'; }).join('');
    const body = '<div class="cp-fields">' + fields + '</div>' +
      '<div class="cp-sect"><div class="cp-callout' + (r.audit === 'UNQUALIFIED' ? ' warn' : '') + '"><strong>评价说明：</strong>' + esc(r.note) + '</div></div>' +
      (t ? '<div class="cp-sect"><h4 class="cp-h">目录要求的关键质量指标</h4><div class="cp-callout">' + esc(t.keyIndicator) + '<div class="cp-note" style="margin-top:6px">资质要求：' + esc(t.requireCert) + '</div></div></div>' : '') +
      '<div class="cp-sect"><h4 class="cp-h">该技术省内例数分布（前 5）</h4><table class="cp-pivot" style="width:100%"><thead><tr><th>机构</th><th>例数</th><th>质量分</th><th>评价</th></tr></thead><tbody>' +
      peers.slice(0, 5).map(function (p) { return '<tr' + (p.id === r.id ? ' style="background:#f4f9ff"' : '') + '><td>' + esc(p.org) + '</td><td>' + nInt(p.volume) + '</td><td>' + p.qualityScore + '</td><td>' + AUDIT_RESULT[p.audit].label + '</td></tr>'; }).join('') +
      '</tbody></table></div>';
    const mask = cpModal('技术开展记录 · ' + r.id, body, '<button class="btn btn-ghost" data-close>关闭</button><button class="btn btn-primary" onclick="cpGoScore(\'' + r.org.replace(/'/g, "\\'") + '\')">查看机构评分</button>');
    mask.querySelector('[data-close]').addEventListener('click', function () { mask.remove(); });
  }
  function cpGoScore(orgName) { state.score.org = orgName; closeCpModals(); if (typeof navigateTo === 'function') navigateTo('cap-score'); }

  /* ==================== 页面 3：医疗质量核心指标明细 ==================== */
  function renderQuality() {
    const f = state.quality, kw = f.keyword.trim().toLowerCase();
    const list = qualityRecords.filter(function (r) {
      return (f.org === 'ALL' || r.org === f.org)
        && (f.domain === 'ALL' || r.domain === f.domain)
        && (!kw || [r.id, r.org, r.name, r.code].join(' ').toLowerCase().includes(kw));
    });
    const alerted = qualityRecords.filter(function (r) { return r.alerted; });
    const unmet = qualityRecords.filter(function (r) { return !r.meet; });
    const kpis = [
      cpKpi('指标定义', qualityDefs.length, '安全/过程/结果/效率 四域'),
      cpKpi('指标明细', nInt(qualityRecords.length), ORGS.length + ' 家 × ' + qualityDefs.length + ' 项 · ' + EVAL_YEAR),
      cpKpi('未达目标值', unmet.length, n1(unmet.length / qualityRecords.length * 100) + '% 明细未达目标', unmet.length ? 'warn' : 'ok'),
      cpKpi('突破预警线', alerted.length, '需列入整改清单', alerted.length ? 'danger' : 'ok'),
      cpKpi('围手术期死亡率', n1(qualityRecords.filter(function (r) { return r.code === 'MQ-001'; }).reduce(function (a, r) { return a + r.value; }, 0) / ORGS.length) + '%', '全省 ' + ORGS.length + ' 家均值')
    ].join('');

    const rows = list.slice(0, 60).map(function (r) {
      const ratio = r.dir === 'lower'
        ? Math.min(100, r.value / Math.max(r.alert, 0.01) * 100)
        : Math.min(100, r.value / Math.max(r.target, 0.01) * 100);
      const tone = r.alerted ? 'bad' : !r.meet ? 'warn' : 'ok';
      const cmpProv = r.dir === 'lower' ? (r.value <= r.provinceAvg ? '优于省均' : '劣于省均') : (r.value >= r.provinceAvg ? '优于省均' : '劣于省均');
      return '<tr>' +
        '<td class="cp-nowrap"><button class="cp-id" onclick="showQualityDetail(\'' + r.id + '\')">' + r.code + '</button><div class="cp-sec">' + esc(r.id) + '</div></td>' +
        '<td>' + esc(r.name) + '<div class="cp-sec">' + esc(QUALITY_DOMAIN[r.domain]) + '</div></td>' +
        '<td>' + esc(r.org) + '<div class="cp-sec">' + esc(r.city) + '</div></td>' +
        '<td class="cp-num cp-nowrap"><strong>' + n1(r.value) + '</strong> ' + esc(r.unit) + bar(ratio, tone) + '</td>' +
        '<td class="cp-num cp-nowrap">' + n1(r.target) + '<div class="cp-sec">预警 ' + n1(r.alert) + '</div></td>' +
        '<td class="cp-num cp-nowrap">' + n1(r.provinceAvg) + '<div class="cp-sec">' + cmpProv + '</div></td>' +
        '<td class="cp-num cp-nowrap">' + nInt(r.denom) + '</td>' +
        '<td class="cp-nowrap">' + (r.alerted ? '<span class="badge badge-danger">超预警线</span>' : r.meet ? '<span class="badge badge-success">达标</span>' : '<span class="badge badge-orange">未达目标</span>') + '</td>' +
        '<td class="cp-nowrap"><button class="btn btn-ghost btn-xs" onclick="showQualityDetail(\'' + r.id + '\')">详情</button></td>' +
        '</tr>';
    }).join('');

    const orgOpts = [['ALL', '全部机构']].concat(ORGS.map(function (o) { return [o.name, o.name]; }))
      .map(function (o) { return '<option value="' + esc(o[0]) + '"' + (f.org === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');
    const dmOpts = [['ALL', '全部指标域']].concat(Object.keys(QUALITY_DOMAIN).map(function (k) { return [k, QUALITY_DOMAIN[k]]; }))
      .map(function (o) { return '<option value="' + o[0] + '"' + (f.domain === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');

    /* 机构 × 指标域 得分矩阵 */
    const head = '<tr><th>机构</th>' + Object.keys(QUALITY_DOMAIN).map(function (k) { return '<th>' + esc(QUALITY_DOMAIN[k]) + '</th>'; }).join('') + '<th>超预警线</th></tr>';
    const matrix = ORGS.map(function (o) {
      const cells = Object.keys(QUALITY_DOMAIN).map(function (k) {
        const s = domainScore(o.name, k);
        const cls = s >= 85 ? 'style="color:#15803d;font-weight:600"' : s >= 70 ? '' : 'style="color:#b42335;font-weight:600"';
        return '<td ' + cls + '>' + n1(s) + '</td>';
      }).join('');
      const al = qualityRecords.filter(function (r) { return r.org === o.name && r.alerted; }).length;
      return '<tr><td>' + esc(o.name) + '</td>' + cells + '<td>' + (al ? '<span class="badge badge-danger">' + al + '</span>' : '<span class="badge badge-success">0</span>') + '</td></tr>';
    }).join('');

    return '<div class="cp-page">' + cpHeader('医疗质量核心指标明细',
      '存储<b>围手术期死亡率、并发症率</b>等医疗质量指标的机构级明细。每项指标带目标值、预警线、分子分母口径与数据来源，可与全省均值对标并保留三年趋势；突破预警线的指标进入整改清单，并在专科能力综合评分中扣减对应维度得分。', [
      '<button class="btn btn-outline btn-sm" onclick="cpToastMsg(\'指标明细已导出\')">导出明细</button>',
      '<button class="btn btn-outline btn-sm" onclick="showAlertList()">整改清单</button>',
      '<button class="btn btn-primary btn-sm" onclick="navigateTo(\'cap-score\')">能力评分报告</button>'
    ]) +
      '<div class="cp-kpis">' + kpis + '</div>' +
      '<div class="cp-filter">' +
      '<div class="form-group" style="grid-column:span 2"><label>机构</label><select onchange="cpSet(\'quality\',\'org\',this.value)">' + orgOpts + '</select></div>' +
      '<div class="form-group"><label>指标域</label><select onchange="cpSet(\'quality\',\'domain\',this.value)">' + dmOpts + '</select></div>' +
      '<div class="form-group" style="grid-column:span 2"><label>检索</label><input value="' + esc(f.keyword) + '" placeholder="指标编码 / 名称" onchange="cpSet(\'quality\',\'keyword\',this.value)"></div>' +
      '<div class="filter-actions"><button class="btn btn-outline btn-sm" onclick="cpResetQuality()">重置</button></div></div>' +
      '<div class="cp-table-wrap"><table class="cp-table"><thead><tr><th>指标编码</th><th>指标名称</th><th>机构</th><th>实测值</th><th>目标 / 预警</th><th>全省均值</th><th>分母</th><th>判定</th><th>操作</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="9"><div class="cp-empty">暂无符合条件的指标明细</div></td></tr>') + '</tbody></table></div>' +
      (list.length > 60 ? '<div class="cp-note" style="margin-top:8px">共 ' + list.length + ' 条，已显示前 60 条，请使用筛选缩小范围。</div>' : '') +
      '<div class="cp-card" style="margin-top:14px"><div class="cp-card-head"><div class="cp-card-title">机构质量域得分矩阵<span class="cp-card-sub">0-100 折算分</span></div></div>' +
      '<div class="cp-card-body" style="overflow:auto"><table class="cp-pivot" style="width:100%"><thead>' + head + '</thead><tbody>' + matrix + '</tbody></table>' +
      '<div class="cp-note" style="margin-top:9px">折算规则：达目标值起步 90 分，超出部分线性加分至 100；介于目标与预警线之间为 60-90 分；突破预警线 60 分以下，最低 20 分。</div></div></div>' +
      '</div>';
  }
  function cpResetQuality() { state.quality = { org: 'ALL', domain: 'ALL', keyword: '' }; renderPage(state.page); }

  function showQualityDetail(id) {
    const r = qualityRecords.find(function (x) { return x.id === id; });
    if (!r) return;
    const peers = qualityRecords.filter(function (x) { return x.code === r.code; })
      .sort(function (a, b) { return r.dir === 'lower' ? a.value - b.value : b.value - a.value; });
    const rank = peers.findIndex(function (x) { return x.id === r.id; }) + 1;
    const fields = [
      ['明细ID', r.id], ['指标编码', r.code], ['指标名称', r.name], ['指标域', QUALITY_DOMAIN[r.domain]],
      ['机构', r.org], ['所属地市', r.city], ['统计周期', r.period],
      ['实测值', n1(r.value) + ' ' + r.unit], ['目标值', n1(r.target) + ' ' + r.unit], ['预警线', n1(r.alert) + ' ' + r.unit],
      ['优劣方向', r.dir === 'lower' ? '越低越好' : '越高越好'],
      ['全省均值', n1(r.provinceAvg) + ' ' + r.unit], ['省内排名', rank + ' / ' + peers.length],
      ['分母', nInt(r.denom) + ' 例'], ['分子', r.numer === null ? '不适用（均值型指标）' : nInt(r.numer) + ' 例'],
      ['判定', r.alerted ? '突破预警线' : r.meet ? '达标' : '未达目标值']
    ].map(function (x) { return '<div class="cp-field"><div class="cp-field-label">' + esc(x[0]) + '</div><div class="cp-value">' + esc(x[1]) + '</div></div>'; }).join('');
    const trendRow = r.trend.map(function (v, i) { return '<td>' + n1(v) + '</td>'; }).join('');
    const body = '<div class="cp-fields">' + fields + '</div>' +
      '<div class="cp-sect"><h4 class="cp-h">计算口径</h4><div class="cp-callout"><strong>公式：</strong>' + esc(r.formula) + '<br><strong>数据来源：</strong>' + esc(r.source) + '</div></div>' +
      '<div class="cp-sect"><h4 class="cp-h">近三年趋势</h4><table class="cp-pivot" style="width:100%"><thead><tr><th>年度</th><th>2023</th><th>2024</th><th>2025</th></tr></thead><tbody><tr><td>' + esc(r.name.slice(0, 12)) + '</td>' + trendRow + '</tbody></table></div>' +
      (r.alerted ? '<div class="cp-sect"><div class="cp-callout warn"><strong>已突破预警线：</strong>该指标已列入 ' + esc(r.org) + ' 的医疗质量整改清单，需在下一评估周期前提交整改方案；在专科能力综合评分中，本指标所属「' + esc(QUALITY_DOMAIN[r.domain]) + '」维度得分相应下调。</div></div>' : '');
    const mask = cpModal('质量指标明细 · ' + r.code, body, '<button class="btn btn-ghost" data-close>关闭</button><button class="btn btn-primary" onclick="cpGoScore(\'' + r.org.replace(/'/g, "\\'") + '\')">查看机构评分</button>');
    mask.querySelector('[data-close]').addEventListener('click', function () { mask.remove(); });
  }

  function showAlertList() {
    const alerted = qualityRecords.filter(function (r) { return r.alerted; })
      .sort(function (a, b) { return a.org.localeCompare(b.org, 'zh-CN'); });
    const rows = alerted.length ? alerted.map(function (r) {
      return '<tr><td style="text-align:left">' + esc(r.org) + '</td><td style="text-align:left">' + esc(r.name) + '</td>' +
        '<td>' + n1(r.value) + ' ' + esc(r.unit) + '</td><td>' + n1(r.alert) + '</td><td style="text-align:left">' + esc(QUALITY_DOMAIN[r.domain]) + '</td></tr>';
    }).join('') : '<tr><td colspan="5"><div class="cp-empty">无突破预警线的指标</div></td></tr>';
    const mask = cpModal('医疗质量整改清单（突破预警线）', '<table class="cp-pivot" style="width:100%"><thead><tr><th>机构</th><th>指标</th><th>实测值</th><th>预警线</th><th>指标域</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="cp-callout warn" style="margin-top:11px">共 ' + alerted.length + ' 项。整改清单由医疗质量管理部门跟踪，与「预警监测与处置」的登记数据质量工单相互独立，不共用责任链。</div>',
      '<button class="btn btn-ghost" data-close>关闭</button><button class="btn btn-primary" onclick="cpToastMsg(\'整改清单已下发至相关机构\')">下发清单</button>');
    mask.querySelector('[data-close]').addEventListener('click', function () { mask.remove(); });
  }

  /* ==================== 页面 4：疑难病例收治特征库 ==================== */
  function renderComplex() {
    const f = state.complex, kw = f.keyword.trim().toLowerCase();
    const list = complexCases.filter(function (c) {
      return (f.org === 'ALL' || c.org === f.org)
        && (f.factor === 'ALL' || c.factors.includes(f.factor))
        && (!kw || [c.id, c.org, c.dx, c.mdt, c.referredFrom].join(' ').toLowerCase().includes(kw));
    });
    const avgCmi = complexCases.reduce(function (a, c) { return a + c.cmiLike; }, 0) / complexCases.length;
    const referred = complexCases.filter(function (c) { return c.referredFrom.indexOf('本院') < 0; }).length;
    const icuCases = complexCases.filter(function (c) { return c.icu > 0; }).length;
    const kpis = [
      cpKpi('疑难病例', complexCases.length, EVAL_YEAR + ' 年度入库样例'),
      cpKpi('平均难度指数', n2(avgCmi), '按收治特征加权（类 CMI）'),
      cpKpi('外院转入', referred, n1(referred / complexCases.length * 100) + '% 为下级机构转诊', 'ok'),
      cpKpi('需 ICU 支持', icuCases, '平均 ' + n1(complexCases.reduce(function (a, c) { return a + c.icu; }, 0) / complexCases.length) + ' 天'),
      cpKpi('平均住院日', n1(complexCases.reduce(function (a, c) { return a + c.los; }, 0) / complexCases.length), '疑难病例显著高于常规'),
      cpKpi('特征维度', Object.keys(COMPLEX_FACTOR).length, '晚期/多原发/罕见/复发/合并症等')
    ].join('');

    const rows = list.map(function (c) {
      return '<tr>' +
        '<td class="cp-nowrap"><button class="cp-id" onclick="showComplexDetail(\'' + c.id + '\')">' + c.id + '</button><div class="cp-sec">' + esc(c.sex) + ' · ' + c.age + ' 岁</div></td>' +
        '<td>' + esc(c.org) + '<div class="cp-sec">' + esc(c.city) + '</div></td>' +
        '<td style="white-space:normal;min-width:260px">' + esc(c.dx) + '</td>' +
        '<td>' + c.factors.map(function (k) { return '<span class="cp-chip ' + (COMPLEX_FACTOR[k].weight >= 1.8 ? 'lv4' : COMPLEX_FACTOR[k].weight >= 1.6 ? 'lv3' : 'lv2') + '">' + esc(COMPLEX_FACTOR[k].label) + '</span>'; }).join('') + '</td>' +
        '<td class="cp-num cp-nowrap"><strong>' + n2(c.cmiLike) + '</strong>' + bar(c.cmiLike / 5.5 * 100, c.cmiLike >= 4.3 ? 'bad' : c.cmiLike >= 3.8 ? 'warn' : '') + '</td>' +
        '<td class="cp-nowrap">' + esc(c.asa) + '</td>' +
        '<td class="cp-num cp-nowrap">' + c.los + ' 日<div class="cp-sec">ICU ' + c.icu + ' 日</div></td>' +
        '<td class="cp-nowrap">' + esc(c.referredFrom) + '</td>' +
        '<td class="cp-nowrap"><button class="btn btn-ghost btn-xs" onclick="showComplexDetail(\'' + c.id + '\')">详情</button></td>' +
        '</tr>';
    }).join('');

    const orgOpts = [['ALL', '全部机构']].concat(ORGS.map(function (o) { return [o.name, o.name]; }))
      .map(function (o) { return '<option value="' + esc(o[0]) + '"' + (f.org === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');
    const fcOpts = [['ALL', '全部特征']].concat(Object.keys(COMPLEX_FACTOR).map(function (k) { return [k, COMPLEX_FACTOR[k].label]; }))
      .map(function (o) { return '<option value="' + o[0] + '"' + (f.factor === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');

    const factorRows = Object.keys(COMPLEX_FACTOR).map(function (k) {
      const cnt = complexCases.filter(function (c) { return c.factors.includes(k); }).length;
      return '<tr><td>' + esc(COMPLEX_FACTOR[k].label) + '</td><td class="cp-num">' + n1(COMPLEX_FACTOR[k].weight) + '</td><td class="cp-num">' + cnt + '</td>' +
        '<td style="text-align:left;white-space:normal">' + esc(COMPLEX_FACTOR[k].note) + '</td></tr>';
    }).join('');

    const orgRows = ORGS.map(function (o) {
      const p = complexProfile(o.name);
      if (!p.list.length) return '<tr><td>' + esc(o.name) + '</td><td class="cp-num">0</td><td class="cp-num">-</td><td class="cp-num">-</td><td class="cp-num">-</td></tr>';
      return '<tr><td>' + esc(o.name) + '</td><td class="cp-num">' + p.list.length + '</td><td class="cp-num">' + n2(p.cmi) + '</td>' +
        '<td class="cp-num">' + p.referredIn + '</td><td class="cp-num">' + n1(p.avgLos) + '</td></tr>';
    }).join('');

    return '<div class="cp-page">' + cpHeader('疑难病例收治特征库',
      '量化机构收治疑难重症的能力，用于<b>专科能力建设评估</b>。每例按晚期转诊、多原发、罕见病理、复发再治疗、重度合并症、高龄、挽救性手术、联合多器官切除等特征加权，得出类 CMI 难度指数；外院转入占比反映机构在区域内的技术承接地位。', [
      '<button class="btn btn-outline btn-sm" onclick="cpToastMsg(\'特征库已导出\')">导出特征库</button>',
      '<button class="btn btn-outline btn-sm" onclick="showFactorRule()">加权规则</button>',
      '<button class="btn btn-primary btn-sm" onclick="navigateTo(\'cap-score\')">能力评分报告</button>'
    ]) +
      '<div class="cp-kpis">' + kpis + '</div>' +
      '<div class="cp-filter">' +
      '<div class="form-group" style="grid-column:span 2"><label>收治机构</label><select onchange="cpSet(\'complex\',\'org\',this.value)">' + orgOpts + '</select></div>' +
      '<div class="form-group"><label>疑难特征</label><select onchange="cpSet(\'complex\',\'factor\',this.value)">' + fcOpts + '</select></div>' +
      '<div class="form-group" style="grid-column:span 2"><label>检索</label><input value="' + esc(f.keyword) + '" placeholder="病例号 / 诊断 / 转诊来源" onchange="cpSet(\'complex\',\'keyword\',this.value)"></div>' +
      '<div class="filter-actions"><button class="btn btn-outline btn-sm" onclick="cpResetComplex()">重置</button></div></div>' +
      '<div class="cp-table-wrap"><table class="cp-table" style="min-width:1240px"><thead><tr><th>病例号</th><th>收治机构</th><th>诊断</th><th>疑难特征</th><th>难度指数</th><th>ASA</th><th>住院日</th><th>转诊来源</th><th>操作</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="9"><div class="cp-empty">暂无符合条件的疑难病例</div></td></tr>') + '</tbody></table></div>' +
      '<div class="cp-grid2" style="margin-top:14px">' +
      '<div class="cp-card"><div class="cp-card-head"><div class="cp-card-title">机构收治难度对比</div></div><div class="cp-card-body" style="overflow:auto">' +
      '<table class="cp-pivot" style="width:100%"><thead><tr><th>机构</th><th>疑难例数</th><th>平均难度</th><th>外院转入</th><th>平均住院日</th></tr></thead><tbody>' + orgRows + '</tbody></table>' +
      '<div class="cp-note" style="margin-top:9px">疑难例数为 0 的机构不代表零疑难收治，而是本年度未有病例达到入库标准（难度指数 ≥ 3.0）。</div></div></div>' +
      '<div class="cp-card"><div class="cp-card-head"><div class="cp-card-title">特征权重与分布</div></div><div class="cp-card-body" style="overflow:auto">' +
      '<table class="cp-pivot" style="width:100%"><thead><tr><th>特征</th><th>权重</th><th>例数</th><th>说明</th></tr></thead><tbody>' + factorRows + '</tbody></table></div></div>' +
      '</div></div>';
  }
  function cpResetComplex() { state.complex = { org: 'ALL', factor: 'ALL', keyword: '' }; renderPage(state.page); }

  function showComplexDetail(id) {
    const c = complexCases.find(function (x) { return x.id === id; });
    if (!c) return;
    const t = techCatalog.find(function (x) { return x.code === c.tech; });
    const fields = [
      ['病例号', c.id], ['收治机构', c.org], ['所属地市', c.city],
      ['性别 / 年龄', c.sex + ' · ' + c.age + ' 岁'], ['ASA 分级', c.asa],
      ['难度指数', n2(c.cmiLike)], ['住院日', c.los + ' 日'], ['ICU 天数', c.icu + ' 日'],
      ['主要技术', t ? t.name : c.tech], ['技术分级', t ? TECH_LEVEL[t.level].label : '-'],
      ['MDT 参与', c.mdt], ['转诊来源', c.referredFrom]
    ].map(function (x) { return '<div class="cp-field"><div class="cp-field-label">' + esc(x[0]) + '</div><div class="cp-value">' + esc(x[1]) + '</div></div>'; }).join('');
    const factorRows = c.factors.map(function (k) {
      const f = COMPLEX_FACTOR[k];
      return '<tr><td style="text-align:left">' + esc(f.label) + '</td><td>' + n1(f.weight) + '</td><td style="text-align:left;white-space:normal">' + esc(f.note) + '</td></tr>';
    }).join('');
    const body = '<div class="cp-callout"><strong>诊断：</strong>' + esc(c.dx) + '</div>' +
      '<div class="cp-sect"><div class="cp-fields">' + fields + '</div></div>' +
      '<div class="cp-sect"><h4 class="cp-h">疑难特征与加权</h4><table class="cp-pivot" style="width:100%"><thead><tr><th>特征</th><th>权重</th><th>说明</th></tr></thead><tbody>' + factorRows + '</tbody></table>' +
      '<div class="cp-note" style="margin-top:7px">难度指数 = 基线 1.0 × 各特征权重连乘后取对数压缩，上限 5.5；用于机构间可比，不用于病例间优劣评价。</div></div>' +
      '<div class="cp-sect"><h4 class="cp-h">诊疗结果</h4><div class="cp-callout">' + esc(c.outcome) + '</div></div>' +
      '<div class="cp-sect"><h4 class="cp-h">评估备注</h4><div class="cp-callout">' + esc(c.note) + '</div></div>';
    const mask = cpModal('疑难病例详情 · ' + c.id, body, '<button class="btn btn-ghost" data-close>关闭</button><button class="btn btn-primary" onclick="cpGoScore(\'' + c.org.replace(/'/g, "\\'") + '\')">查看机构评分</button>');
    mask.querySelector('[data-close]').addEventListener('click', function () { mask.remove(); });
  }

  function showFactorRule() {
    const rows = Object.keys(COMPLEX_FACTOR).map(function (k) {
      const f = COMPLEX_FACTOR[k];
      return '<tr><td style="text-align:left">' + esc(f.label) + '</td><td>' + n1(f.weight) + '</td><td style="text-align:left;white-space:normal">' + esc(f.note) + '</td></tr>';
    }).join('');
    const mask = cpModal('疑难病例加权规则', '<div class="cp-callout">入库标准：难度指数 ≥ 3.0，或具备「多原发癌 / 罕见病理 / 挽救性手术 / 联合多器官切除」中任一特征。</div>' +
      '<div class="cp-sect"><table class="cp-pivot" style="width:100%"><thead><tr><th>特征</th><th>权重</th><th>判定说明</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="cp-sect"><div class="cp-callout warn"><strong>使用边界：</strong>难度指数用于横向比较机构收治结构，不能作为医疗质量或疗效指标；难度高而并发症率同步偏高的机构，需结合「医疗质量核心指标明细」判断是超范围开展还是合理的高难度承接。</div></div>',
      '<button class="btn btn-ghost" data-close>关闭</button>', true);
    mask.querySelector('[data-close]').addEventListener('click', function () { mask.remove(); });
  }

  /* ==================== 页面 5：专科能力综合评分报告 ==================== */
  function renderScore() {
    const target = scoreBoard.find(function (s) { return s.org === state.score.org; }) || scoreBoard[0];
    const dims = SCORE_DIMS.map(function (d) { return d.name; });
    const values = SCORE_DIMS.map(function (d) { return target.parts[d.key]; });
    const avgValues = SCORE_DIMS.map(function (d) { return provinceAvgParts[d.key]; });

    const kpis = [
      cpKpi('综合得分', n1(target.total), EVAL_YEAR + ' 年度 · 满分 100', target.total >= 85 ? 'ok' : target.total >= 70 ? 'warn' : 'danger'),
      cpKpi('省内排名', target.rank + ' / ' + scoreBoard.length, '按综合得分降序'),
      cpKpi('达标技术', target.techCount + ' / ' + target.techTotal, '四级 ' + target.l4Count + ' 项 · 限制类 ' + target.restrictCount + ' 项'),
      cpKpi('年开展例数', nInt(target.volume), '目录内技术合计'),
      cpKpi('超预警线指标', target.alertedIndicators.length, '未达目标 ' + target.unmetIndicators + ' 项', target.alertedIndicators.length ? 'danger' : 'ok'),
      cpKpi('疑难难度指数', target.complex.list.length ? n2(target.complex.cmi) : '-', target.complex.list.length + ' 例入库')
    ].join('');

    const dimRows = SCORE_DIMS.map(function (d) {
      const v = target.parts[d.key];
      const avg = provinceAvgParts[d.key];
      const tone = v >= 85 ? 'ok' : v >= 70 ? 'warn' : 'bad';
      const diff = v - avg;
      return '<div class="cp-dim-row"><div class="cp-dim-name">' + esc(d.name) + '<div class="cp-note">权重 ' + (d.weight * 100).toFixed(0) + '%</div></div>' +
        '<div>' + bar(v, tone) + '<div class="cp-note">省均 ' + n1(avg) + ' · ' + (diff >= 0 ? '高于省均 ' + n1(diff) : '低于省均 ' + n1(-diff)) + ' 分</div></div>' +
        '<div class="cp-dim-score" style="color:' + (v >= 85 ? '#15803d' : v >= 70 ? '#b54708' : '#b42335') + '">' + n1(v) + '</div></div>';
    }).join('');

    const boardRows = scoreBoard.map(function (s) {
      const isCur = s.org === target.org;
      return '<tr' + (isCur ? ' style="background:#f4f9ff"' : '') + '>' +
        '<td class="cp-num cp-nowrap">' + s.rank + '</td>' +
        '<td><button class="cp-id" onclick="cpPickOrg(\'' + s.org.replace(/'/g, "\\'") + '\')">' + esc(s.org) + '</button><div class="cp-sec">' + esc(s.city) + ' · ' + esc(s.level) + '</div></td>' +
        '<td class="cp-num cp-nowrap"><strong>' + n1(s.total) + '</strong>' + bar(s.total, s.total >= 85 ? 'ok' : s.total >= 70 ? 'warn' : 'bad') + '</td>' +
        '<td class="cp-nowrap"><span class="cp-grade ' + s.grade.grade + '">' + esc(s.grade.label) + '</span></td>' +
        SCORE_DIMS.map(function (d) { return '<td class="cp-num cp-nowrap">' + n1(s.parts[d.key]) + '</td>'; }).join('') +
        '<td class="cp-num cp-nowrap">' + s.techCount + '/' + s.techTotal + '</td>' +
        '<td class="cp-nowrap">' + (s.alertedIndicators.length ? '<span class="badge badge-danger">' + s.alertedIndicators.length + '</span>' : '<span class="badge badge-success">0</span>') + '</td>' +
        '</tr>';
    }).join('');

    /* 短板与建议 */
    const sorted = SCORE_DIMS.slice().sort(function (a, b) { return target.parts[a.key] - target.parts[b.key]; });
    const weak = sorted.slice(0, 2);
    const strong = sorted.slice(-2).reverse();
    const advice = weak.map(function (d) {
      const v = target.parts[d.key];
      let text;
      if (d.key === 'tech') {
        const missing = techCatalog.filter(function (t) {
          return t.status === 'ACTIVE' && !techRecords.some(function (r) { return r.org === target.org && r.techCode === t.code && r.reach; });
        });
        text = '目录内尚未达标开展 ' + missing.length + ' 项，其中四级/限制类 ' + missing.filter(function (t) { return t.level === 'L4' || t.level === 'RESTRICT'; }).length + ' 项。建议优先补齐本地高发癌种对应技术：' + missing.slice(0, 3).map(function (t) { return t.name; }).join('、') + '。';
      } else if (d.key === 'volume') {
        text = '多项技术年例数接近目录下限，规模效应不足。建议通过区域转诊协作集中病例，避免低例数高难度技术分散开展。';
      } else if (d.key === 'safety') {
        const al = target.alertedIndicators.filter(function (r) { return r.domain === 'SAFETY'; });
        text = al.length ? '围手术期安全域有 ' + al.length + ' 项指标突破预警线（' + al.map(function (r) { return r.name; }).join('、') + '），须先控制安全风险再扩大技术范围。' : '安全域整体达标但离目标值仍有差距，建议加强术前评估与并发症上报完整性。';
      } else if (d.key === 'process') {
        const al = target.alertedIndicators.filter(function (r) { return r.domain === 'PROCESS'; });
        text = '规范诊疗流程执行不足' + (al.length ? '，突破预警线：' + al.map(function (r) { return r.name; }).join('、') : '') + '。MDT 覆盖率与治疗前病理确诊率是最易改善的两项。';
      } else if (d.key === 'outcome') {
        text = 'R0 切除率或淋巴结清扫达标率偏低，提示手术规范性与病理协作需加强，建议开展术式标准化培训与病理取材规范复训。';
      } else {
        text = '疑难病例收治结构偏简单，区域承接能力有限。建议建立与下级机构的转诊通道，同时提升 ICU 与多学科支撑条件。';
      }
      return '<li><strong>' + esc(d.name) + '（' + n1(v) + ' 分）：</strong>' + esc(text) + '</li>';
    }).join('');

    const alertRows = target.alertedIndicators.length ? target.alertedIndicators.map(function (r) {
      return '<tr><td style="text-align:left">' + esc(r.name) + '</td><td>' + n1(r.value) + ' ' + esc(r.unit) + '</td><td>' + n1(r.alert) + '</td><td style="text-align:left">' + esc(QUALITY_DOMAIN[r.domain]) + '</td></tr>';
    }).join('') : '<tr><td colspan="4"><div class="cp-empty">无突破预警线的指标</div></td></tr>';

    const orgOpts = ORGS.map(function (o) { return '<option value="' + esc(o.name) + '"' + (target.org === o.name ? ' selected' : '') + '>' + esc(o.name) + '</option>'; }).join('');

    return '<div class="cp-page">' + cpHeader('专科能力综合评分报告',
      '自动生成机构肿瘤专科能力评估报告，含<b>多维得分与对标分析</b>。六个维度按权重合成综合得分：技术广度 22%、服务规模 16%、围手术期安全 20%、规范诊疗 18%、治疗结果 14%、疑难收治 10%；对标基准为全省同类机构均值。', [
      '<button class="btn btn-outline btn-sm" onclick="showScoreRule()">评分规则</button>',
      '<button class="btn btn-outline btn-sm" onclick="cpToastMsg(\'评分报告已导出 PDF\')">导出报告</button>',
      '<button class="btn btn-primary btn-sm" onclick="cpToastMsg(\'报告已下发至机构并归档\')">下发报告</button>'
    ]) +
      '<div class="cp-filter" style="grid-template-columns:minmax(260px,1fr) auto">' +
      '<div class="form-group"><label>评估机构</label><select onchange="cpSet(\'score\',\'org\',this.value)">' + orgOpts + '</select></div>' +
      '<div class="filter-actions"><span class="cp-note">评估年度 ' + EVAL_YEAR + ' · 目录版本 V2026.1</span></div></div>' +
      '<div class="cp-kpis">' + kpis + '</div>' +
      '<div class="cp-grid2">' +
      '<div class="cp-card"><div class="cp-card-head"><div class="cp-card-title">多维得分<span class="cp-card-sub">实线为本机构，虚线为全省均值</span></div>' +
      '<span class="cp-grade ' + target.grade.grade + '">' + esc(target.grade.label) + '</span></div>' +
      '<div class="cp-card-body">' +
      '<div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">' +
      '<div style="flex:0 0 auto;text-align:center"><div class="cp-score-big">' + n1(target.total) + '</div><div class="cp-note" style="margin-top:5px">综合得分 · 省内第 ' + target.rank + ' 位</div></div>' +
      '<div style="flex:1 1 260px;min-width:240px">' + radar(dims, values, avgValues) + '</div></div>' +
      '<div style="margin-top:10px">' + dimRows + '</div>' +
      '</div></div>' +
      '<div class="cp-card"><div class="cp-card-head"><div class="cp-card-title">对标分析与改进建议</div></div><div class="cp-card-body">' +
      '<div class="cp-callout"><strong>相对优势：</strong>' + strong.map(function (d) { return esc(d.name) + '（' + n1(target.parts[d.key]) + ' 分，省均 ' + n1(provinceAvgParts[d.key]) + '）'; }).join('；') + '</div>' +
      '<div class="cp-sect"><h4 class="cp-h">主要短板与改进方向</h4><div class="cp-callout warn"><ol style="margin:0 0 0 18px;padding:0">' + advice + '</ol></div></div>' +
      '<div class="cp-sect"><h4 class="cp-h">突破预警线的质量指标</h4><table class="cp-pivot" style="width:100%"><thead><tr><th>指标</th><th>实测</th><th>预警线</th><th>指标域</th></tr></thead><tbody>' + alertRows + '</tbody></table></div>' +
      '<div class="cp-sect"><div class="cp-callout"><strong>疑难收治画像：</strong>' + (target.complex.list.length
        ? '本年度入库疑难病例 ' + target.complex.list.length + ' 例，平均难度指数 ' + n2(target.complex.cmi) + '，其中外院转入 ' + target.complex.referredIn + ' 例，平均住院 ' + n1(target.complex.avgLos) + ' 日。'
        : '本年度无病例达到疑难特征库入库标准，区域技术承接作用有限。') + '</div></div>' +
      '</div></div></div>' +
      '<div class="cp-card"><div class="cp-card-head"><div class="cp-card-title">全省机构能力对标排行<span class="cp-card-sub">' + EVAL_YEAR + ' 年度 · ' + scoreBoard.length + ' 家</span></div>' +
      '<button class="btn btn-ghost btn-xs" onclick="showScoreRule()">评分规则</button></div>' +
      '<div class="cp-card-body" style="padding:0"><div class="cp-table-wrap" style="border:0;border-radius:0"><table class="cp-table" style="min-width:1180px"><thead><tr><th>排名</th><th>机构</th><th>综合得分</th><th>等级</th>' +
      SCORE_DIMS.map(function (d) { return '<th>' + esc(d.name) + '</th>'; }).join('') + '<th>达标技术</th><th>超预警</th></tr></thead><tbody>' + boardRows + '</tbody></table></div></div></div>' +
      '<div class="cp-callout warn"><strong>使用边界：</strong>本报告评估的是机构<b>肿瘤专科诊疗能力</b>，数据来自病案首页、手术与病理记录、MDT 记录与疑难病例特征库，与「预警监测与处置」考核的<b>登记数据质量</b>（MV%、DCO%、M/I 比）是两套独立体系，不得相互替代或合并排名。</div>' +
      '</div>';
  }
  function cpPickOrg(name) { state.score.org = name; renderPage('cap-score'); }

  function showScoreRule() {
    const rows = SCORE_DIMS.map(function (d) {
      return '<tr><td style="text-align:left">' + esc(d.name) + '</td><td>' + (d.weight * 100).toFixed(0) + '%</td><td style="text-align:left;white-space:normal">' + esc(d.desc) + '</td></tr>';
    }).join('');
    const gradeRows = GRADE_RULE.map(function (g) {
      return '<tr><td><span class="cp-grade ' + g.grade + '">' + esc(g.label) + '</span></td><td>' + (g.min ? '≥ ' + g.min + ' 分' : '< 70 分') + '</td>' +
        '<td class="cp-num">' + scoreBoard.filter(function (s) { return s.grade.grade === g.grade; }).length + ' 家</td></tr>';
    }).join('');
    const mask = cpModal('专科能力评分规则', '<table class="cp-pivot" style="width:100%"><thead><tr><th>维度</th><th>权重</th><th>计分内容</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="cp-sect"><h4 class="cp-h">等级划分</h4><table class="cp-pivot" style="width:100%"><thead><tr><th>等级</th><th>综合得分</th><th>本年度机构数</th></tr></thead><tbody>' + gradeRows + '</tbody></table></div>' +
      '<div class="cp-sect"><div class="cp-callout"><strong>关键计分口径：</strong><br>1. 技术广度按难度加权（限制类 2.0、四级 1.7、三级 1.2、常规 1.0），未达最低例数或未完成备案的技术不计分。<br>2. 质量指标先折算为 0-100 分再按域取均值：达目标值起步 90 分，突破预警线降至 60 分以下。<br>3. 服务规模以全省该技术例数中位数为基准，上限封顶 2.2 倍，避免单一机构规模优势掩盖质量短板。<br>4. 疑难收治按难度指数与外院转入占比合成，权重仅 10%，防止诱导收治高难度病例。</div></div>',
      '<button class="btn btn-ghost" data-close>关闭</button>');
    mask.querySelector('[data-close]').addEventListener('click', function () { mask.remove(); });
  }

  /* ==================== 路由与导出 ==================== */
  function renderCapabilityPage(pageId) {
    if (!OWNED_IDS.includes(pageId)) return null;
    closeCpModals();
    state.page = pageId;
    if (pageId === 'cap-catalog') return renderCatalog();
    if (pageId === 'cap-records') return renderRecords();
    if (pageId === 'cap-quality') return renderQuality();
    if (pageId === 'cap-complex') return renderComplex();
    if (pageId === 'cap-score') return renderScore();
    return '<div class="cp-page"><div class="cp-empty">页面开发中</div></div>';
  }

  const publicApi = {
    ORGS, techCatalog, techRecords, qualityDefs, qualityRecords, complexCases, scoreBoard, SCORE_DIMS,
    scoreOrg, domainScore, complexProfile, provinceAvgParts,
    cpSet, cpToastMsg, cpResetCatalog, cpResetRecords, cpResetQuality, cpResetComplex, closeCpModals,
    showTechDetail, showTechOrgs, showCatalogVersion, showRecordDetail, cpGoScore,
    showQualityDetail, showAlertList, showComplexDetail, showFactorRule, showScoreRule, cpPickOrg,
    renderCapabilityPage
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = publicApi;
  if (typeof window !== 'undefined') {
    Object.assign(window, publicApi);
    window.capabilityPageIds = OWNED_IDS.slice();
  }






})();
