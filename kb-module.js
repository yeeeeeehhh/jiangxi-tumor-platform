/* ============================================================
   科普与培训 · 内容知识库（kb-module.js）
   ------------------------------------------------------------
   定位：一个内容库，两类内容（科普 / 培训）。医生来看、来拿、来维护。
   侧导航 4 个页面（不用页内页签——板块里有什么，侧栏一眼看全）：
     1. kb-sci    科普内容   面向患者的图文/视频/问答，从这里取用
     2. kb-train  培训内容   课件/操作手册/SOP/教学视频，纯资源列表
     3. kb-mine   我的内容   我收藏的内容，按 科普内容 / 培训材料 分类回看
     4. kb-dict   分类维护   病种 / 使用场景 / 标签 三个字典

   两级库三条规则：
     · 省库对医院只读（省库行不出现编辑类按钮）
     · 收藏：把常用内容挑进「我的内容」，按科普 / 培训两类留着复用
     · 院内内容按 org 隔离，其他机构不可见

   状态只有两态：启用 / 停用。
   只保留一条治理约束：
     · evidence 为空 → 「待补依据」角标，「启用」不可用

   对外导出：window.KB / window.kbPageIds / window.renderKBPage
   兼容：window.renderHealthConsultPage（旧调用名）；kb-library / health-consult 与 17 个咨询旧 id 一律落到「科普内容」
   ============================================================ */
(function () {
  'use strict';

  /* ================= 样式 ================= */
  var CSS = [
    '.kb-page{min-width:0}',
    '.kb-note{border:1px solid #dbe6f5;border-left:4px solid #244765;border-radius:6px;background:#f4f8ff;padding:10px 14px;font-size:12.5px;color:#334155;line-height:1.65;margin-bottom:14px}',
    '.kb-note b{color:#244765}',
    /* 弹窗 */
    '.kb-mask{position:fixed;inset:0;z-index:1300;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(15,23,42,.5)}',
    '.kb-modal{width:min(820px,96vw);max-height:88vh;display:flex;flex-direction:column;background:#fff;border-radius:10px;box-shadow:0 18px 50px rgba(15,23,42,.25)}',
    '.kb-modal.narrow{width:min(560px,96vw)}',
    '.kb-modal .hd{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:13px 18px;border-bottom:1px solid var(--border,#dfe5ec)}',
    '.kb-modal .hd .t{font-size:15px;font-weight:700;color:#1f2937}',
    '.kb-modal .hd .sub{font-size:11px;color:#94a3b8;font-weight:400;margin-left:8px}',
    '.kb-modal .x{width:28px;height:28px;border:0;border-radius:5px;background:#f2f4f7;color:#667085;font-size:16px;cursor:pointer}',
    '.kb-modal .bd{padding:16px 18px;overflow:auto;flex:1}',
    '.kb-modal .ft{display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid var(--border,#dfe5ec);background:#fbfcfe;flex-wrap:wrap}',
    '.kb-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 14px}',
    '.kb-form .full{grid-column:1/-1}',
    '.kb-form label{display:block;font-size:12px;color:#475569;font-weight:600;margin-bottom:5px}',
    '.kb-form input:not([type=checkbox]),.kb-form select,.kb-form textarea{width:100%;border:1px solid #d1d8e0;border-radius:5px;background:#fff;color:#1f2937;font-size:13px;box-sizing:border-box;padding:0 9px;height:34px;font-family:inherit}',
    '.kb-form textarea{height:auto;min-height:86px;padding:8px 9px;resize:vertical;line-height:1.6}',
    '.kb-form .hint{font-size:11px;color:#94a3b8;margin-top:4px;line-height:1.5}',
    '.kb-form .req{color:#b42335}',
    '.kb-kv{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 18px;margin-bottom:14px}',
    '.kb-kv .k{font-size:12px;color:#667085}',
    '.kb-kv .vl{font-size:13px;font-weight:600;color:#1f2937;margin-top:2px}',
    '.kb-body{border:1px solid #e5eaf1;border-radius:6px;background:#fbfcfe;padding:12px 14px;font-size:13px;line-height:1.75;color:#24313f;max-height:300px;overflow:auto}',
    '.kb-body h2{font-size:15px;margin:0 0 8px}',
    '.kb-body h3{font-size:13.5px;margin:12px 0 6px}',
    '.kb-body p{margin:6px 0}',
    '.kb-picks{display:flex;gap:6px;flex-wrap:wrap}',
    '.kb-picks button{border:1px solid #d1d8e0;background:#fff;color:#475569;border-radius:999px;padding:4px 11px;font-size:12px;cursor:pointer}',
    '.kb-picks button.on{background:#244765;border-color:#244765;color:#fff}',
    '.kb-bulk .data-table{min-width:0}',
    '.kb-bulk .data-table th:nth-child(1),.kb-bulk .data-table td:nth-child(1){width:44px}',
    '.kb-bulk .data-table th:nth-child(3),.kb-bulk .data-table td:nth-child(3){width:230px}',
    '.kb-bulk .data-table th:nth-child(4),.kb-bulk .data-table td:nth-child(4){width:104px}',
    '.kb-bulk .data-table th:nth-child(5),.kb-bulk .data-table td:nth-child(5){width:64px}',
    '.kb-bulk .data-table td{white-space:normal}',
    '.kb-file{display:flex;justify-content:space-between;align-items:center;gap:10px;border:1px solid #e5eaf1;border-radius:6px;padding:8px 12px;font-size:12.5px;color:#334155;margin-bottom:6px}',
    '.kb-file .nm{font-weight:600}',
    '.kb-file .sz{color:#94a3b8}',
  ].join('\n');
  var styleEl = document.createElement('style');
  styleEl.id = 'kb-module-styles';
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  /* ================= 工具 ================= */
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function val(id) { var e = $(id); return e ? String(e.value).trim() : ''; }
  function say(msg, type) { if (window.toast) { window.toast(msg, type); } else { window.alert(msg); } }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function nowStr() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function today() { return nowStr().slice(0, 10); }
  function md(s) { return String(s || '').slice(5, 10); }
  var SEQ = 3000;
  function nextId(p) { SEQ += 1; return p + SEQ; }
  function nextKbHId() { var seq = nextId(''); return 'KB-H-' + seq.slice(-4); } // 生成院内编号：KB-H-3001..
  function find(list, id) { for (var i = 0; i < list.length; i++) { if (list[i].id === id) return list[i]; } return null; }
  function log(by, action, target) { KB.logs.unshift({ id: nextId('LOG-'), by: by, action: action, target: target, time: nowStr() }); }

  /* 状态色 */
  var STATUS_CLS = { '启用': 'ok', '停用': 'muted' };
  function stBadge(s) { return '<span class="badge badge-' + (STATUS_CLS[s] || 'neutral') + '">' + esc(s) + '</span>'; }

  /* ================= 当前用户（原型单人演示，写死一个院内身份） ================= */
  var ME = { name: '李医生', org: '南昌市肿瘤医院', role: '医院用户' };

  /* ================= 字典（分类维护页管理的四类字典） =================
     项结构对齐全站字典管理：{code, name, sort, status, remark}，status 只有 启用/禁用 */
  function d(code, name, sort, status, remark) {
    return { code: code, name: name, sort: sort, status: status || '启用', remark: remark || '' };
  }
  var DICT_TYPES = [
    { v: 'sites', t: '病种', prefix: 'SITE' },
    { v: 'scenes', t: '使用场景', prefix: 'SCENE' },
    { v: 'tags', t: '标签', prefix: 'TAG' },
    { v: 'kinds', t: '内容形式', prefix: 'KIND' }
  ];
  var DICT = {
    sites: [
      d('C34', '肺', 1), d('C50', '乳腺', 2), d('C16', '结直肠', 3), d('C22', '肝', 4), d('C16.1', '胃', 5),
      d('C15', '食管', 6), d('C53', '宫颈', 7), d('C61', '前列腺', 8), d('ALL', '通用', 9, '启用', '不区分病种的通用材料')
    ],
    scenes: [
      d('S01', '随访宣教', 1), d('S02', '报告解读', 2), d('S03', '候诊播放', 3), d('S04', '公众号推文', 4),
      d('S05', '入院宣教', 5), d('S06', '编码答疑', 6), d('S07', '上岗培训', 7), d('S08', '填报规范', 8)
    ],
    tags: [
      d('T01', '随访', 1), d('T02', '复查', 2), d('T03', '饮食', 3), d('T04', '化疗', 4), d('T05', '放疗', 5),
      d('T06', '疼痛', 6), d('T07', '疫苗', 7), d('T08', '筛查', 8), d('T09', '编码', 9), d('T10', '报告卡', 10),
      d('T11', '重卡', 11), d('T12', '上报', 12), d('T13', '接口', 13)
    ],
    kinds: [
      d('K01', '图文', 1), d('K02', '视频', 2), d('K03', '问答', 3),
      d('K04', '课件', 4), d('K05', '操作手册', 5), d('K06', '宣传折页', 6)
    ],
    audiences: ['患者及家属', '登记人员', '临床医生', '基层公卫']
  };
  /* 启用的项名（检索条件与新建表单的下拉/点选只认启用项） */
  function dictNames(dim) {
    return (DICT[dim] || []).filter(function (x) { return x.status === '启用'; })
      .slice().sort(function (a, b) { return a.sort - b.sort; }).map(function (x) { return x.name; });
  }
  function dictTypeMeta(dim) { for (var i = 0; i < DICT_TYPES.length; i++) { if (DICT_TYPES[i].v === dim) return DICT_TYPES[i]; } return { v: dim, t: dim, prefix: 'X' }; }

  /* ================= 数据 ================= */
  var KB = {
    me: ME,
    dict: DICT,
    assets: [],
    logs: [],
    tab: 'sci',
    filters: {},
    pageNo: {}
  };
  window.KB = KB;

  /* ---------- 种子：科普 5 条（迁自旧 DB.edu）+ 院内 2 条 ---------- */
  KB.assets = [
    {
      id: 'KB-P-0001', track: '科普', kind: '图文', title: '肺结节随访指南：多大需要复查？',
      summary: '按结节大小与密度给出复查间隔建议，帮助体检人群正确看待肺结节。',
      body: '<h2>肺结节大多是良性的</h2><p>肺结节绝大多数为良性。一般小于 6mm 建议年度复查；6-8mm 建议 6-12 个月复查；大于 8mm 需 3 个月内复查并结合临床评估。</p><h3>就诊提示</h3><p>具体复查间隔请以胸外科或呼吸科主治医生意见为准。</p>',
      sites: ['肺'], scenes: ['报告解读', '随访宣教'], tags: ['随访', '复查'], audiences: ['患者及家属'],
      lib: '省库', org: '江西省肿瘤登记中心', 
      status: '启用', publishedAt: '2026-08-20',
      evidence: '《肺结节诊治中国专家共识（2024 年版）》', attachments: [{ name: '肺结节随访间隔对照表.pdf', size: '216 KB' }],
      note: '按 2024 版共识调整 8mm 以上复查间隔'
    },
    {
      id: 'KB-P-0002', track: '科普', kind: '图文', title: '化疗后白细胞下降的饮食与防护',
      summary: '骨髓抑制期的营养支持与感染防护要点。',
      body: '<p>保证足量优质蛋白，食物彻底加热，避免生冷；外出佩戴口罩，勤洗手，减少去人群密集场所。</p><h3>什么时候要就诊</h3><p>体温超过 38℃ 或持续乏力加重，请立即联系主治医生。</p>',
      sites: ['通用'], scenes: ['随访宣教', '公众号推文'], tags: ['化疗', '饮食'], audiences: ['患者及家属'],
      lib: '省库', org: '江西省肿瘤登记中心', 
      status: '启用', publishedAt: '2026-08-18',
      evidence: '', attachments: [], note: ''
    },
    {
      id: 'KB-P-0003', track: '科普', kind: '视频', title: '放疗期间皮肤护理 5 要点',
      summary: '放射性皮肤反应的居家护理示范视频（时长 4 分 10 秒）。',
      body: '<p>保持清洁干燥、穿柔软棉质衣物、避免暴晒与摩擦、不自行涂抹刺激性药膏、及时告知放疗科医生。</p>',
      sites: ['通用'], scenes: ['候诊播放', '随访宣教'], tags: ['放疗'], audiences: ['患者及家属'],
      lib: '省库', org: '江西省肿瘤登记中心', 
      status: '启用', publishedAt: '2025-08-15',
      evidence: '《肿瘤放射治疗护理规范》', attachments: [{ name: '放疗皮肤护理示范.mp4', size: '48.2 MB' }], note: ''
    },
    {
      id: 'KB-P-0004', track: '科普', kind: '问答', title: '乳腺癌术后可以接种流感疫苗吗？',
      summary: '术后患者接种灭活疫苗的注意事项问答。',
      body: '<p><b>问：</b>乳腺癌术后两年，能打流感疫苗吗？</p><p><b>答：</b>病情稳定、化疗结束 3 个月以上且免疫功能恢复者，通常可接种灭活疫苗；减毒活疫苗需先评估。接种前请咨询主治医生。</p>',
      sites: ['乳腺'], scenes: ['随访宣教', '公众号推文'], tags: ['疫苗', '复查'], audiences: ['患者及家属'],
      lib: '省库', org: '江西省肿瘤登记中心', 
      status: '停用', publishedAt: '',
      evidence: '《中国肿瘤患者疫苗接种专家共识》', attachments: [], note: ''
    },
    {
      id: 'KB-P-0005', track: '科普', kind: '图文', title: '癌痛规范化用药：会不会成瘾？',
      summary: '澄清癌痛治疗中最常见的用药误区。',
      body: '<p>在规范剂量与医嘱下使用阿片类药物治疗癌痛，成瘾发生率极低，不应因恐惧成瘾而忍痛。</p>',
      sites: ['通用'], scenes: ['随访宣教'], tags: ['疼痛'], audiences: ['患者及家属'],
      lib: '省库', org: '江西省肿瘤登记中心', 
      status: '停用', publishedAt: '',
      evidence: '', attachments: [], note: ''
    },
    {
      id: 'KB-H-0101', track: '科普', kind: '宣传折页', title: '复查别忘带这三样（本院版）',
      summary: '本院复查流程须知折页，含挂号窗口与影像科位置。',
      body: '<p>复查请携带：既往病理报告、影像胶片、医保卡。</p><h3>本院流程</h3><p>1) 门诊 3 号楼 2 层自助机取号；2) 影像科 4 层；3) 结果当日回诊室。咨询电话 {{本院电话}}。</p>',
      sites: ['通用'], scenes: ['入院宣教', '随访宣教'], tags: ['复查', '随访'], audiences: ['患者及家属'],
      lib: '院内', org: '南昌市肿瘤医院', 
      status: '启用', publishedAt: '2026-09-02',
      evidence: '院内门诊流程（2026 版）', attachments: [{ name: '复查须知折页.ai', size: '3.1 MB' }],
      note: '增加本院位置与电话占位符'
    },
    {
      id: 'KB-H-0102', track: '培训', kind: '操作手册', title: '本院报告卡退回复报操作指引',
      summary: '针对本院被退回报告卡的处置流程说明。',
      body: '<p>退回卡片须在 5 个工作日内处理：核对退回原因 → 修正字段 → 重新提交。</p>',
      sites: ['通用'], scenes: ['填报规范', '编码答疑'], tags: ['报告卡', '上报'], audiences: ['登记人员'],
      lib: '院内', org: '南昌市肿瘤医院', 
      status: '停用', publishedAt: '',
      evidence: '', attachments: [], note: ''
    }
  ];

  /* ---------- 种子：培训 14 条（收编自 app.html 首页 wbNewsData 的 common/train/tech） ---------- */
  var TRAIN_SEED = [
    /* 原 common：高频业务问答 6 条 */
    { id: 'KB-T-0001', title: 'ICD10 编码为何显示为空？', kind: '问答', tags: ['编码'],
      body: '<h2>ICD10 编码为何显示为空？</h2><p>ICD-10 编码为空通常由以下原因造成：</p><ol><li>报告卡已填写诊断名称但未点击「自动编码」按钮；</li><li>诊断名称包含特殊字符或不规范用语，系统无法匹配编码库；</li><li>编码表（ICD-10 国标版）未更新到最新版本。</li></ol><h3>处理建议</h3><p>1) 在诊断字段中输入规范医学术语后点击「自动编码」；<br>2) 若仍为空，可手动从编码下拉中选择或联系编码维护员补录；<br>3) 定期同步国家癌症中心发布的 ICD-10 编码表。</p>',
      scenes: ['编码答疑'], publishedAt: '2026-08-12', evidence: '国家癌症中心 ICD-10 编码表（2026 同步版）' },
    { id: 'KB-T-0002', title: '如何判断并处理疑似重卡？', kind: '问答', tags: ['重卡'],
      body: '<h2>如何判断并处理疑似重卡？</h2><p>系统通过「身份证号 + 姓名 + 性别」三要素自动识别疑似重复卡，可能的命中规则：</p><ul><li>完全三要素一致；</li><li>身份证号一致但姓名/性别不一致（疑似录入错误）；</li><li>姓名+性别+出生日期一致但身份证号为空。</li></ul><h3>处理流程</h3><p>进入「质控工作台 → 重卡管理」，逐条对比发病部位、确诊日期、报告单位等信息后选择「合并」「保留主卡」或「作废」并填写处理说明。</p>',
      scenes: ['编码答疑', '填报规范'], publishedAt: '2026-08-10', evidence: '重卡管理模块分析报告' },
    { id: 'KB-T-0003', title: '被退回的报告卡如何修改并重新提交？', kind: '问答', tags: ['报告卡', '上报'],
      body: '<h2>被退回的报告卡如何修改并重新提交？</h2><p>报告卡被退回后，可在「报告卡管理 → 待处理」列表中查看退回原因。处理步骤：</p><ol><li>点击卡片查看审核员填写的退回说明；</li><li>根据说明修改对应字段（常见：身份证号、地址、ICD 编码、确诊日期）；</li><li>点击「重新提交」进入下一级审核流程；</li><li>若对退回原因有异议，可通过「申诉」通道提交说明。</li></ol>',
      scenes: ['填报规范'], publishedAt: '2026-08-06', evidence: '' },
    { id: 'KB-T-0004', title: '随访任务逾期未完成如何处理？', kind: '问答', tags: ['随访'],
      body: '<h2>随访任务逾期未完成如何处理？</h2><p>随访任务逾期常见原因：患者失联、患者已迁出辖区、家属拒绝随访等。处理建议：</p><ul><li>优先通过电话、短信、家属联系等多种方式尝试联系；</li><li>若连续 3 次无法联系，标记为「失访」并填写失访原因；</li><li>迁出辖区的患者，转出到新辖区登记处；</li><li>确属死亡的，联动「死亡信息」模块补录死亡资料。</li></ul>',
      scenes: ['填报规范'], publishedAt: '2026-07-28', evidence: '随访结局管理需求文档' },
    { id: 'KB-T-0005', title: '确诊日期与报告日期逻辑校验规则说明', kind: '问答', tags: ['报告卡'],
      body: '<h2>确诊日期与报告日期逻辑校验规则说明</h2><p>系统强制约束：确诊日期 ≤ 报告日期 ≤ 当前日期。三者关系必须符合时间先后顺序。</p><h3>常见错误情形</h3><ul><li>补报卡确诊日期晚于报告日期；</li><li>录入年份错误（手误将 2025 写成 2026）；</li><li>使用病理报告签发日期而非病理确诊日期。</li></ul><h3>处理建议</h3><p>以病历/病理报告上的「确诊日期」字段为准，修正后重新校验。</p>',
      scenes: ['编码答疑', '填报规范'], publishedAt: '2026-07-15', evidence: '' },
    { id: 'KB-T-0006', title: '现住址行政区划编码如何查询？', kind: '问答', tags: ['编码'],
      body: '<h2>现住址行政区划编码如何查询？</h2><p>行政区划编码采用国家统计局发布的 12 位统计用区划代码，可在系统中通过以下方式查询：</p><ol><li>在地址输入框逐级选择「省/市/县/乡镇/村」自动回填编码；</li><li>使用快捷搜索：输入乡镇/街道名称关键字；</li><li>从「基础数据 → 区划管理」下载最新区划对照表离线查询。</li></ol><p>注意：编码每年会因区划调整更新，请定期同步。</p>',
      scenes: ['编码答疑'], publishedAt: '2026-07-02', evidence: '国家统计局统计用区划代码' },
    /* 原 train：培训资料 4 条 */
    { id: 'KB-T-0007', title: '2026 肿瘤随访登记操作培训（视频）', kind: '视频', tags: ['随访', '上报'],
      body: '<p>覆盖随访任务列表、批量上传、计划制定与死因证填写的完整操作演示，时长 42 分钟。</p>',
      scenes: ['上岗培训'], publishedAt: '2026-08-10', evidence: '', attachments: [{ name: '随访登记操作培训.mp4', size: '1.2 GB' }] },
    { id: 'KB-T-0008', title: '报告卡填报规范 PPT 合集', kind: '课件', tags: ['报告卡'],
      body: '<p>含必填字段口径、常见退回复种、编码规范三部分，可直接用于院内集中学习。</p>',
      scenes: ['上岗培训', '填报规范'], publishedAt: '2026-08-05', evidence: '', attachments: [{ name: '报告卡填报规范.pptx', size: '18.4 MB' }] },
    { id: 'KB-T-0009', title: '重卡识别与合并实操演示', kind: '视频', tags: ['重卡'],
      body: '<p>从查重结果列表到合并/保留主卡的逐步演示，含 3 个真实疑难样例。</p>',
      scenes: ['上岗培训'], publishedAt: '2026-07-30', evidence: '', attachments: [{ name: '重卡合并演示.mp4', size: '620 MB' }] },
    { id: 'KB-T-0010', title: '国家上报门禁校验规则讲解', kind: '课件', tags: ['上报'],
      body: '<p>逐条讲解国家上报平台的字段级校验与拦截规则，附错误码对照。</p>',
      scenes: ['上岗培训', '填报规范'], publishedAt: '2026-07-25', evidence: '国家肿瘤登记上报平台校验说明' },
    /* 原 tech：技术指导 4 条 */
    { id: 'KB-T-0011', title: '医院 HIS 接口对接技术指引 v2.3', kind: '操作手册', tags: ['接口'],
      body: '<p>字段映射表、传输频次、异常重传机制与联调用例。</p>',
      scenes: ['上岗培训'], publishedAt: '2026-08-09', evidence: '', attachments: [{ name: 'HIS对接指引v2.3.pdf', size: '1.8 MB' }] },
    { id: 'KB-T-0012', title: '重卡自动合并规则与人工复核说明', kind: '操作手册', tags: ['重卡'],
      body: '<p>自动合并的三档置信度阈值、必须人工复核的情形、回滚方式。</p>',
      scenes: ['编码答疑', '填报规范'], publishedAt: '2026-08-03', evidence: '' },
    { id: 'KB-T-0013', title: '数据校验引擎错误码对照表', kind: '操作手册', tags: ['上报', '编码'],
      body: '<p>校验引擎全部错误码的含义、触发条件、修正建议一览。</p>',
      scenes: ['编码答疑'], publishedAt: '2026-07-26', evidence: '' },
    { id: 'KB-T-0014', title: '随访数据上报 API 接入示例', kind: '操作手册', tags: ['接口', '上报'],
      body: '<p>鉴权方式、上报接口入参出参、批量与幂等处理示例代码。</p>',
      scenes: ['上岗培训'], publishedAt: '2026-07-20', evidence: '' }
  ];
  TRAIN_SEED.forEach(function (t) {
    KB.assets.push({
      id: t.id, track: '培训', kind: t.kind, title: t.title,
      summary: String(t.body).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').slice(0, 42) + '…',
      body: t.body, sites: ['通用'], scenes: t.scenes, tags: t.tags, audiences: ['登记人员', '基层公卫'],
      lib: '省库', org: '江西省肿瘤登记中心', 
      status: '启用', publishedAt: t.publishedAt,
      evidence: t.evidence || '', attachments: t.attachments || [], note: ''
    });
  });

  /* 种子收藏：让「我的内容」开页不空（科普 1 条 + 培训 2 条） */
  [['KB-P-0001', '2026-10-06 09:12'], ['KB-T-0001', '2026-10-07 14:02'], ['KB-T-0011', '2026-10-05 16:40']].forEach(function (x) {
    var a = find(KB.assets, x[0]); if (a) { a.fav = true; a.favAt = x[1]; }
  });

  /* ================= 派生与门禁 ================= */
  function isMine(a) { return a.lib === '院内' && a.org === ME.org; }
  function visibleIn(a) { return a.lib === '省库' || a.org === ME.org; }   /* 院内内容按机构隔离 */
  function noEvidence(a) { return !a.evidence; }
  function canSeeBody(a) { return true; }

  /* ================= 筛选 / 分页 ================= */
  function fget(key, f) { return KB.filters[key] && KB.filters[key][f] != null ? String(KB.filters[key][f]) : ''; }
  function filterBar(key, track) {
    var f = KB.filters[key] || (KB.filters[key] = {});
    function sel(name, label, opts, def) {
      var cur = f[name] != null ? f[name] : (def || '');
      return '<div class="form-group"><label>' + label + '</label><select data-kbf="' + name + '">' +
        opts.map(function (o) { return '<option' + (o === cur ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') +
        '</select></div>';
    }
    var kw = f.kw || '';
    return '<div class="filter-toolbar" data-kbfilter="' + key + '">' +
      '<div class="form-group search-group"><label>关键词</label><input data-kbf="kw" value="' + esc(kw) + '" placeholder="标题 / 摘要 / 标签"></div>' +
      sel('site', '病种', ['全部病种'].concat(dictNames('sites'))) +
      sel('scene', '使用场景', ['全部场景'].concat(dictNames('scenes'))) +
      sel('kind', '形式', ['全部形式'].concat(dictNames('kinds'))) +
      sel('status', '状态', ['全部状态', '启用', '停用'], '全部状态') +
      '<div class="filter-actions"><button class="btn btn-ghost btn-sm" data-kb="filterReset" data-arg="' + key + '">重置</button>' +
      '<button class="btn btn-primary btn-sm" data-kb="filter" data-arg="' + key + '">查询</button></div></div>';
  }
  /* 按字段表渲染筛选条（收藏页用） */
  function filterBarCustom(key, fields) {
    var f = KB.filters[key] || (KB.filters[key] = {});
    var html = fields.map(function (fd) {
      var cur = f[fd.k] != null ? f[fd.k] : (fd.def || '');
      if (fd.type === 'select') {
        return '<div class="form-group"><label>' + fd.label + '</label><select data-kbf="' + fd.k + '">' +
          fd.options.map(function (o) { return '<option' + (o === cur ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') +
          '</select></div>';
      }
      return '<div class="form-group search-group"><label>' + fd.label + '</label><input data-kbf="' + fd.k + '" value="' + esc(cur) + '" placeholder="' + esc(fd.ph || '') + '"></div>';
    }).join('');
    return '<div class="filter-toolbar" data-kbfilter="' + key + '">' + html +
      '<div class="filter-actions"><button class="btn btn-ghost btn-sm" data-kb="filterReset" data-arg="' + key + '">重置</button>' +
      '<button class="btn btn-primary btn-sm" data-kb="filter" data-arg="' + key + '">查询</button></div></div>';
  }
  function readFilter(key) {
    var box = document.querySelector('[data-kbfilter="' + key + '"]');
    if (!box) return;
    var f = KB.filters[key] || (KB.filters[key] = {});    box.querySelectorAll('[data-kbf]').forEach(function (el) { f[el.getAttribute('data-kbf')] = el.value; });
  }
  function pager(key, total, size) {
    var pages = Math.max(1, Math.ceil(total / size));
    var cur = KB.pageNo[key] || 1;
    if (cur > pages) cur = pages;
    return '<div style="display:flex;gap:8px;align-items:center;justify-content:flex-end;padding:12px 2px 0;font-size:12px;color:#64748b">' +
      '<span>第 ' + cur + ' / ' + pages + ' 页</span>' +
      '<button class="btn btn-ghost btn-xs" data-kb="page" data-arg="' + key + '|' + (cur - 1) + '"' + (cur <= 1 ? ' disabled' : '') + '>上一页</button>' +
      '<button class="btn btn-ghost btn-xs" data-kb="page" data-arg="' + key + '|' + (cur + 1) + '"' + (cur >= pages ? ' disabled' : '') + '>下一页</button></div>';
  }
  function slice(list, key, size) {
    var cur = KB.pageNo[key] || 1;
    return list.slice((cur - 1) * size, cur * size);
  }
  function applyFilter(list, key) {
    var f = KB.filters[key] || {};
    var kw = (f.kw || '').toLowerCase();
    return list.filter(function (a) {
      if (!visibleIn(a)) return false;
      if (f.site && f.site !== '全部病种' && a.sites.indexOf(f.site) < 0) return false;
      if (f.scene && f.scene !== '全部场景' && a.scenes.indexOf(f.scene) < 0) return false;
      if (f.kind && f.kind !== '全部形式' && a.kind !== f.kind) return false;
      if (f.status && f.status !== '全部状态' && a.status !== f.status) return false;
      if (kw && (a.title + a.summary + a.tags.join('')).toLowerCase().indexOf(kw) < 0) return false;
      return true;
    });
  }

  /* ================= 通用构件 ================= */
  /* 原生列表页形制：page-toolbar 只承载右上按钮（page-toolbar-title 全站 display:none，标题靠面包屑） */
  function heads(title, sub, acts) {
    return '<div class="page-toolbar"><div class="page-toolbar-title">' + title + '</div><div class="toolbar-actions">' + acts + '</div></div>';
  }
  function card(title, body, sub) {
    return '<div class="panel"><div class="panel-body">' + body + '</div></div>';
  }
  function table(headers, rows, emptyText, tight) {
    if (!rows.length) return '<div style="padding:22px;text-align:center;color:#64748b">' + (emptyText || '没有符合条件的内容') + '</div>';
    return '<div class="table-wrap"><table class="data-table"><thead><tr>' +
      headers.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
  }
  /* 原生 badge 承载病种/场景标签；blue 走 badge-info，其余 badge-neutral */
  function chips(arr, cls) { return (arr || []).map(function (t) { return '<span class="badge ' + (cls === 'blue' ? 'badge-info' : 'badge-neutral') + '" style="margin:0 4px 4px 0">' + esc(t) + '</span>'; }).join(''); }
  function act(text, action, arg, cls) { return '<button class="btn ' + (cls || 'btn-outline') + ' btn-sm" data-kb="' + action + '" data-arg="' + esc(arg) + '">' + text + '</button>'; }
  function opCell() { return '<div class="ops">' + Array.prototype.slice.call(arguments).filter(Boolean).join('') + '</div>'; }

  /* ---------- 弹窗 ---------- */
  function closeModal() { var m = document.querySelector('.kb-mask'); if (m) m.remove(); }
  function modal(title, sub, bodyHtml, ftHtml, wide) {
    var mask = document.createElement('div');
    mask.className = 'kb-mask';
    mask.innerHTML = '<div class="kb-modal' + (wide === false ? ' narrow' : '') + '">' +
      '<div class="hd"><div class="t">' + esc(title) + (sub ? '<span class="sub">' + esc(sub) + '</span>' : '') + '</div>' +
      '<button class="x" data-kb="close">×</button></div>' +
      '<div class="bd">' + bodyHtml + '</div>' +
      (ftHtml ? '<div class="ft">' + ftHtml + '</div>' : '') + '</div>';
    document.body.appendChild(mask);
    mask.addEventListener('click', function (e) { if (e.target === mask) closeModal(); });
    var first = mask.querySelector('input,textarea,select');
    if (first) setTimeout(function () { first.focus(); }, 30);
    return mask;
  }
  function confirmBox(title, msg, onOk) {
    modal(title, '', '<div style="font-size:13px;line-height:1.7;color:#334155">' + msg + '</div>',
      '<button class="btn btn-outline btn-sm" data-kb="close">取消</button><button class="btn btn-primary btn-sm" data-kb="confirmOk">确定</button>', false);
    KB._confirm = onOk;
  }

  /* 表单构件 */
  function fld(label, inner, full) { return '<div' + (full ? ' class="full"' : '') + '><label>' + label + '</label>' + inner + '</div>'; }
  function inp(id, v, ph) { return '<input id="' + id + '" value="' + esc(v == null ? '' : v) + '" placeholder="' + esc(ph || '') + '">'; }
  function sel1(id, opts, v) { return '<select id="' + id + '">' + opts.map(function (o) { return '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>'; }
  function ta(id, v, ph, rows) { return '<textarea id="' + id + '" rows="' + (rows || 4) + '" placeholder="' + esc(ph || '') + '">' + esc(v || '') + '</textarea>'; }
  function R(t) { return '<span class="req">*</span> ' + t; }
  /* 多选：以可点选 chip 承载，选中态写 data-pick */
  function pickBox(id, opts, chosen) {
    chosen = chosen || [];
    return '<div class="kb-picks" id="' + id + '">' + opts.map(function (o) {
      return '<button type="button" data-pick="' + esc(o) + '" class="' + (chosen.indexOf(o) >= 0 ? 'on' : '') + '">' + esc(o) + '</button>';
    }).join('') + '</div>';
  }
  function picked(id) { var out = []; var box = $(id); if (box) box.querySelectorAll('[data-pick].on').forEach(function (b) { out.push(b.getAttribute('data-pick')); }); return out; }

  /* ================= 行渲染 ================= */
  function statusCell(a) {
    var x = stBadge(a.status);
    if (noEvidence(a)) x += ' <span class="badge badge-warning" title="缺依据出处，启用按钮不可用">待补依据</span>';
    return x;
  }
  function assetRow(a, inMine) {
    /* 省库内容给一枚只读标记（院内内容本身有编辑按钮，不需标记） */
    var libBadge = a.lib === '省库' ? '<span class="badge badge-muted">省库·只读</span>' : '';
    var opsBtn = [act('预览', 'view', a.id, 'btn-outline')];
    if (inMine) opsBtn.push(act('取消收藏', 'fav', a.id));
    else opsBtn.push(a.fav ? act('★ 已收藏', 'fav', a.id, 'btn-outline') : act('☆ 收藏', 'fav', a.id));
    if (isMine(a)) {
      /* 院内内容：编辑 + 启用/停用 + 删除；省库内容只读，这三颗都不出现 */
      opsBtn.push(act('编辑', 'edit', a.id));
      opsBtn.push(a.status === '启用'
        ? act('停用', 'toggleStatus', a.id)
        : act('启用', 'toggleStatus', a.id, 'btn-primary'));
      opsBtn.push(act('删除', 'del', a.id));
    }
    return '<tr><td>' + esc(a.id) + '</td>' +
      '<td><span style="font-weight:600;color:var(--primary);cursor:pointer" data-kb="view" data-arg="' + esc(a.id) + '">' + esc(a.title) + '</span>' +
      '<div style="font-size:11px;color:#94a3b8;font-weight:400;white-space:normal;max-width:360px">' + esc(a.summary) + '</div></td>' +
      '<td>' + esc(a.kind) + '</td>' +
      '<td>' + chips(a.sites, 'blue') + '</td>' +
      '<td>' + chips(a.scenes) + '</td>' +
      '<td>' + statusCell(a) + (libBadge ? ' ' + libBadge : '') + '</td>' +
      '<td class="ops">' + opCell.apply(null, opsBtn) + '</td></tr>';
  }

  /* ================= 页面 1 / 2：科普内容、培训内容 ================= */
  function libraryTab(track, key, tabId) {
    var list = applyFilter(KB.assets.filter(function (a) { return a.track === track; }), key);
    /* 启用在前，其次按启用时间倒序 */
    list.sort(function (x, y) {
      var sx = x.status === '启用' ? 0 : 1, sy = y.status === '启用' ? 0 : 1;
      if (sx !== sy) return sx - sy;
      return String(y.publishedAt).localeCompare(String(x.publishedAt));
    });
    var isTrain = track === '培训';
    var rows = slice(list, key, 8).map(function (a) { return assetRow(a, false); });
    return filterBar(key, track) +
      card('', table(['编号', '标题 / 摘要', '形式', '病种', '场景', '状态', '操作'], rows, '没有符合条件的内容') +
        pager(key, list.length, 8));
  }

  /* ================= 页面 3：我的内容（我收藏的内容，按科普 / 培训分类） ================= */
  var FAV_FILTER = [
    { k: 'kw', label: '关键词', type: 'text', ph: '标题 / 摘要 / 标签' },
    { k: 'cat', label: '分类', type: 'select', options: ['全部分类', '科普内容', '培训材料'], def: '全部分类' },
    { k: 'kind', label: '形式', type: 'select', options: ['全部形式'].concat(dictNames('kinds')) },
    { k: 'site', label: '病种', type: 'select', options: ['全部病种'].concat(dictNames('sites')) },
    { k: 'scene', label: '使用场景', type: 'select', options: ['全部场景'].concat(dictNames('scenes')) }
  ];
  function favList() {
    var f = KB.filters['kb-library:mine'] || {};
    var kw = (f.kw || '').toLowerCase();
    return KB.assets.filter(function (a) { return a.fav && visibleIn(a); }).filter(function (a) {
      if (f.cat === '科普内容' && a.track !== '科普') return false;
      if (f.cat === '培训材料' && a.track !== '培训') return false;
      if (f.kind && f.kind !== '全部形式' && a.kind !== f.kind) return false;
      if (f.site && f.site !== '全部病种' && a.sites.indexOf(f.site) < 0) return false;
      if (f.scene && f.scene !== '全部场景' && a.scenes.indexOf(f.scene) < 0) return false;
      if (kw && (a.title + a.summary + a.tags.join('')).toLowerCase().indexOf(kw) < 0) return false;
      return true;
    }).sort(function (x, y) { return String(y.favAt || '').localeCompare(String(x.favAt || '')); });
  }
  function mineTab() {
    var key = 'kb-library:mine';
    var list = favList();
    var rows = slice(list, key, 8).map(function (a) { return assetRow(a, true); });
    return filterBarCustom(key, FAV_FILTER) +
      card('',
        table(['编号', '标题 / 摘要', '形式', '病种', '场景', '状态', '操作'], rows,
          '还没有收藏内容。到「科普内容」或「培训内容」页面点 ☆ 收藏即可。') +
        pager(key, list.length, 8));
  }

  /* ================= 页面 4：分类维护（对齐全站字典管理形制） ================= */
  function dictRefs(dim, name) {
    return KB.assets.filter(function (a) { return a.status === '启用' && (a[dim] || []).indexOf(name) >= 0; }).length;
  }
  function dictTab() {
    var st = KB.dictState || (KB.dictState = { type: 'sites', kw: '' });
    var dim = st.type, data = DICT[dim] || [], q = (st.kw || '').trim().toLowerCase();
    var list = data.filter(function (x) { return !q || x.code.toLowerCase().indexOf(q) >= 0 || x.name.toLowerCase().indexOf(q) >= 0; })
      .slice().sort(function (a, b) { return a.sort - b.sort; });
    var body = list.map(function (x, n) {
      var i = data.indexOf(x), refs = dictRefs(dim, x.name);
      return '<tr><td>' + (n + 1) + '</td><td>' + esc(x.code) + '</td><td>' + esc(x.name) + '</td>' +
        '<td>' + x.sort + '</td>' +
        '<td><span class="badge ' + (x.status === '启用' ? 'badge-success' : 'badge-muted') + '">' + esc(x.status) + '</span></td>' +
        '<td>' + (refs ? '<span class="badge badge-info">' + refs + ' 篇在架引用</span>' : '<span style="color:#94a3b8">—</span>') + '</td>' +
        '<td>' + esc(x.remark || '—') + '</td>' +
        '<td class="ops">' +
        '<button class="btn btn-primary btn-xs" data-kb="dictEdit" data-arg="' + dim + '|' + i + '">编辑</button> ' +
        '<button class="btn btn-xs ' + (x.status === '启用' ? 'btn-ghost' : 'btn-primary') + '" data-kb="dictToggle" data-arg="' + dim + '|' + i + '">' + (x.status === '启用' ? '禁用' : '启用') + '</button> ' +
        '<button class="btn btn-danger btn-xs" data-kb="dictDel" data-arg="' + dim + '|' + i + '">删除</button>' +
        '</td></tr>';
    }).join('') || '<tr><td colspan="8" style="text-align:center;color:#64748b;padding:22px">暂无匹配字典项</td></tr>';

    var filter = '<div class="filter-toolbar">' +
      '<div class="form-group"><label>字典类型</label><select data-kbd="type" onchange="kbDictType()">' +
      DICT_TYPES.map(function (t) { return '<option value="' + t.v + '"' + (t.v === dim ? ' selected' : '') + '>' + t.t + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="form-group search-group"><label>检索内容</label><input value="' + esc(st.kw) + '" placeholder="编码 / 名称" data-kbd="kw"></div>' +
      '<div class="filter-actions">' +
      '<button class="btn btn-primary btn-sm" data-kb="dictQuery">查询</button>' +
      '<button class="btn btn-ghost btn-sm" data-kb="dictReset">重置</button>' +
      '<button class="btn btn-primary btn-sm" data-kb="dictAdd" data-arg="' + dim + '">+ 添加</button>' +
      '</div></div>';

    return '<div class="page-toolbar"><div class="page-toolbar-title"><span class="icon">●</span>分类维护' +
      '<span style="font-size:12px;color:#64748b;font-weight:400;margin-left:10px">当前字典：' + esc(dictTypeMeta(dim).t) + '</span></div></div>' +
      '<div class="panel"><div class="panel-body">' + filter +
      '<div class="table-wrap"><table class="data-table"><thead><tr>' +
      ['序号', '编码', '名称', '排序', '状态', '在架引用', '备注', '操作'].map(function (h) { return '<th>' + h + '</th>'; }).join('') +
      '</tr></thead><tbody>' + body + '</tbody></table></div>' +
      '</div></div>';
  }

  /* 新增 / 编辑弹窗（form-grid 对齐全站字典表单） */
  function dictForm(dim, index) {
    var data = DICT[dim] || [], meta = dictTypeMeta(dim);
    var r = index == null
      ? { code: meta.prefix + '-' + pad(data.length + 1), name: '', sort: data.length + 1, status: '启用', remark: '' }
      : data[index];
    function fg(label, inner, req) {
      return '<div class="form-group"><label>' + label + (req ? ' <span class="required">*</span>' : '') + '</label>' + inner + '</div>';
    }
    var body = '<div class="form-grid">' +
      fg('编码', '<input id="kb-df-code" value="' + esc(r.code) + '">', true) +
      fg('名称', '<input id="kb-df-name" value="' + esc(r.name) + '">', true) +
      fg('排序', '<input id="kb-df-sort" type="number" value="' + r.sort + '">') +
      fg('状态', '<select id="kb-df-status"><option' + (r.status === '启用' ? ' selected' : '') + '>启用</option><option' + (r.status === '禁用' ? ' selected' : '') + '>禁用</option></select>') +
      '<div class="form-group full"><label>备注</label><textarea id="kb-df-remark">' + esc(r.remark || '') + '</textarea></div>' +
      '<div class="form-group full"><span style="font-size:11px;color:#94a3b8">改名会同步改写已引用该字典项的内容；被在架内容引用的项不能删除，只能先禁用。</span></div>' +
      '</div>';
    modal((index == null ? '新增' : '编辑') + meta.t + '字典项', meta.t + '字典', body,
      '<button class="btn btn-ghost btn-sm" data-kb="close">取消</button>' +
      '<button class="btn btn-primary btn-sm" data-kb="dictSave" data-arg="' + dim + '|' + (index == null ? '' : index) + '">保存</button>', false);
  }
  function dictSave(dim, index) {
    var data = DICT[dim], meta = dictTypeMeta(dim);
    var code = val('kb-df-code'), name = val('kb-df-name');
    if (!code || !name) { say('编码与名称为必填', 'error'); return; }
    if (data.some(function (x, i) { return x.code === code && i !== index; })) { say('同一字典下编码不能重复', 'error'); return; }
    if (data.some(function (x, i) { return x.name === name && i !== index; })) { say('同一字典下名称不能重复', 'error'); return; }
    var item = { code: code, name: name, sort: Number(val('kb-df-sort')) || data.length + 1, status: val('kb-df-status'), remark: val('kb-df-remark') };
    if (index == null) { data.push(item); log(ME.name, '新增字典项', meta.t + '/' + name); }
    else {
      var old = data[index].name;
      data[index] = item;
      if (old !== name) {
        /* 改名 → 同步已引用该内容字段，避免内容静默失去分类 */
        var n = 0;
        KB.assets.forEach(function (a) {
          var arr = a[dim];
          if (arr && arr.indexOf) {
            var k = arr.indexOf(old);
            if (k >= 0) { arr[k] = name; n++; }
          }
        });
        if (n) say('已同步 ' + n + ' 条内容的分类引用', 'info');
      }
      log(ME.name, '编辑字典项', meta.t + '/' + name);
    }
    closeModal(); refresh();
    say('保存成功', 'success');
  }
  function dictToggle(dim, index) {
    var x = DICT[dim][index];
    x.status = x.status === '启用' ? '禁用' : '启用';
    log(ME.name, x.status === '禁用' ? '禁用字典项' : '启用字典项', dictTypeMeta(dim).t + '/' + x.name);
    say('已' + x.status + '「' + x.name + '」，' + (x.status === '禁用' ? '检索条件与新建表单不再出现' : '重新可用'), 'success');
    refresh();
  }
  function dictDel(dim, index) {
    var data = DICT[dim], x = data[index], refs = dictRefs(dim, x.name);
    if (refs) { say('「' + x.name + '」被 ' + refs + ' 篇在架内容引用，不能删除；如不再使用请点「禁用」', 'error'); return; }
    if (window.showConfirm) {
      showConfirm('确认删除', '确定删除字典项「' + x.name + '（' + x.code + '）」？', function () {
        data.splice(index, 1); log(ME.name, '删除字典项', dictTypeMeta(dim).t + '/' + x.name);
        say('已删除', 'success'); refresh();
      });
    } else {
      data.splice(index, 1); say('已删除', 'success'); refresh();
    }
  }

  /* ================= 主渲染：4 个侧导航页面 ================= */
  var PAGES = {
    'kb-sci': {
      tab: 'sci', title: '科普内容',
      acts: '<button class="btn btn-outline btn-sm" data-kb="exportList">导出内容清单</button>' +
        '<button class="btn btn-import btn-sm" data-kb="bulk" data-arg="科普">批量上传</button>' +
        '<button class="btn btn-primary btn-sm" data-kb="new" data-arg="科普">+ 新增科普内容</button>'
    },
    'kb-train': {
      tab: 'train', title: '培训内容',
      acts: '<button class="btn btn-outline btn-sm" data-kb="exportList">导出内容清单</button>' +
        '<button class="btn btn-import btn-sm" data-kb="bulk" data-arg="培训">批量上传</button>' +
        '<button class="btn btn-primary btn-sm" data-kb="new" data-arg="培训">+ 新增培训内容</button>'
    },
    'kb-mine': {
      tab: 'mine', title: '我的内容',
      acts: ''
    },
    'kb-dict': {
      tab: 'dict', title: '分类维护', shell: true,
      acts: ''
    }
  };
  KB.page = 'kb-sci';
  function refresh() { renderKBPage(KB.page); }
  /* 跨页跳转走 navigateTo，保证侧导航高亮与面包屑一致 */
  function goPage(pageId) {
    if (window.navigateTo) { navigateTo(pageId); }
    else { KB.page = pageId; KB.tab = PAGES[pageId].tab; refresh(); }
  }
  function renderKBPage(pageId) {
    var el = $('pageContainer');
    if (!el) return;
    if (pageId === 'kb-library' || pageId === 'health-consult') pageId = 'kb-sci';
    var cfg = PAGES[pageId] || PAGES[KB.page] || PAGES['kb-sci'];
    KB.page = PAGES[pageId] ? pageId : KB.page;
    KB.tab = cfg.tab;

    var body = cfg.tab === 'sci' ? libraryTab('科普', 'kb-library:sci', false)
      : cfg.tab === 'train' ? libraryTab('培训', 'kb-library:train', true)
        : cfg.tab === 'mine' ? mineTab()
          : dictTab();

    /* 配置页（分类维护）自带 page-toolbar，不再叠一层模块标题 */
    el.innerHTML = '<div class="kb-page">' + (cfg.shell ? body : heads(cfg.title, '', cfg.acts) + body) + '</div>';

    var mc = $('mainContent');
    if (mc) mc.scrollTop = 0;
  }

  /* ================= 动作：看 / 拿 / 改 / 养 / 补 ================= */
  /* 看 —— 预览 */
  function viewAsset(id) {
    var a = find(KB.assets, id); if (!a) { say('未找到该内容', 'error'); return; }
    var meta = '<div class="kb-kv">' +
      '<div><div class="k">内容线 / 形式</div><div class="vl">' + esc(a.track) + ' · ' + esc(a.kind) + '</div></div>' +
      '<div><div class="k">归属机构</div><div class="vl">' + esc(a.org) + '</div></div>' +
      '<div><div class="k">状态</div><div class="vl">' + stBadge(a.status) + '</div></div>' +
      '<div><div class="k">启用时间</div><div class="vl">' + esc(a.publishedAt || '未启用') + '</div></div>' +
      '<div><div class="k">依据出处</div><div class="vl">' + (a.evidence ? esc(a.evidence) : '<span style="color:#b42335">未填（发布不可用）</span>') + '</div></div>' +
      '<div><div class="k">最近更新说明</div><div class="vl">' + esc(a.note || '—') + '</div></div>' +
      '</div>' +
      '<div style="font-size:12px;color:#667085;font-weight:600;margin:0 0 6px">病种 · 场景 · 受众 · 标签</div>' +
      '<div style="margin-bottom:12px">' + chips(a.sites, 'blue') + chips(a.scenes) + chips(a.audiences, 'green') + chips(a.tags) + '</div>' +
      '<div style="font-size:12px;color:#667085;font-weight:600;margin-bottom:6px">正文</div>' +
      '<div class="kb-body">' + (a.body || '（正文为空）') + '</div>';
    var files = (a.attachments || []).length
      ? '<div style="font-size:12px;color:#667085;font-weight:600;margin:14px 0 6px">附件</div>' +
      a.attachments.map(function (f) {
        return '<div class="kb-file"><span class="nm">' + esc(f.name) + '</span><span class="sz">' + esc(f.size || '') + '</span></div>';
      }).join('')
      : '';
    var ft = '<button class="btn btn-outline btn-sm" data-kb="close">关闭</button>';
    ft += a.fav ? act('★ 已收藏', 'fav', a.id) : act('☆ 收藏', 'fav', a.id);
    if (a.status === '启用') ft += act('取用（复制 / 下载）', 'pick', a.id, 'btn-primary');
    modal(a.title, a.id + ' · ' + a.status, '<div class="kb-note"><b>' + esc(a.summary) + '</b></div>' + meta + files, ft);
  }

  /* 拿 —— 取用：复制正文 / 下载文本，不写台账 */
  function pickAsset(id) {
    var a = find(KB.assets, id); if (!a) return;
    var plain = a.title + '\n\n' + String(a.body).replace(/<br\s*\/?>/g, '\n').replace(/<\/p>|<\/h2>|<\/h3>|<\/li>/g, '\n').replace(/<[^>]*>/g, '').replace(/\n{3,}/g, '\n\n').trim();
    var fileRow = (a.attachments || []).map(function (f) {
      return '<div class="kb-file"><span class="nm">' + esc(f.name) + ' <span style="color:#94a3b8;font-weight:400">' + esc(f.size || '') + '</span></span>' + act('下载', 'dl', a.id + '|' + f.name) + '</div>';
    }).join('');
    modal('取用「' + a.title + '」', a.id,
      '<div style="font-size:12px;color:#667085;font-weight:600;margin-bottom:6px">正文（可编辑后复制）</div>' +
      '<textarea id="kb-pick-text" rows="12" style="width:100%;border:1px solid #d1d8e0;border-radius:6px;padding:10px;font-size:13px;line-height:1.7;box-sizing:border-box;font-family:inherit">' + esc(plain) + '</textarea>' +
      (fileRow ? '<div style="font-size:12px;color:#667085;font-weight:600;margin:14px 0 6px">附件</div>' + fileRow : '') +
      (noEvidence(a) ? '<div class="hint" style="margin-top:10px;font-size:11px;color:#94a3b8">该内容尚未填写依据出处，转发前请先补</div>' : ''),
      '<button class="btn btn-outline btn-sm" data-kb="close">关闭</button>' +
      '<button class="btn btn-outline btn-sm" data-kb="dl" data-arg="' + esc(a.id) + '|' + esc(a.title) + '.txt">下载 TXT</button>' +
      '<button class="btn btn-primary btn-sm" data-kb="copy">复制正文</button>', false);
  }
  function copyPickText() {
    var ta = $('kb-pick-text'); if (!ta) return;
    var txt = ta.value;
    function fallback() {
      ta.select();
      try { document.execCommand('copy'); say('已复制正文，可直接粘贴', 'success'); }
      catch (e) { say('浏览器不支持自动复制，请手动全选复制', 'error'); }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function () { say('已复制正文，可直接粘贴', 'success'); }, fallback);
    } else { fallback(); }
  }
  function downloadText(filename, text) {
    try {
      var blob = new Blob(['\ufeff' + text], { type: 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url; link.download = filename;
      document.body.appendChild(link); link.click();
      setTimeout(function () { document.body.removeChild(link); URL.revokeObjectURL(url); }, 120);
      say('已下载 ' + filename, 'success');
    } catch (e) { say('当前环境不支持下载，请用复制', 'error'); }
  }

  /* 收藏 —— 我在库里挑出来留着用的内容 */
  function toggleFav(id) {
    var a = find(KB.assets, id); if (!a) return;
    a.fav = !a.fav;
    a.favAt = a.fav ? nowStr() : '';
    log(ME.name, a.fav ? '收藏内容' : '取消收藏', a.id);
    say(a.fav ? '已收藏《' + a.title + '》，在「我的内容」里可查' : '已取消收藏', 'success');
    refresh();
  }

  /* 养 —— 新建 / 编辑 */
  function assetForm(track, a) {
    var isTrain = track === '培训';
    return '<div class="kb-form">' +
      fld(R('标题'), inp('kb-a-title', a ? a.title : '', isTrain ? '例如：报告卡填报规范（本院补充）' : '例如：复查为什么要空腹？'), true) +
      fld(R('内容线'), sel1('kb-a-track', ['科普', '培训'], track) + '<div class="hint">决定出现在「科普内容」还是「培训内容」页面</div>') +
      fld(R('形式'), sel1('kb-a-kind', dictNames('kinds'), a ? a.kind : (isTrain ? '操作手册' : '图文'))) +
      fld(R('病种'), pickBox('kb-a-sites', dictNames('sites'), a ? a.sites : ['通用']) + '<div class="hint">点选，可多选；决定按病种检索能否命中</div>', true) +
      fld(R('使用场景'), pickBox('kb-a-scenes', dictNames('scenes'), a ? a.scenes : (isTrain ? ['上岗培训'] : ['随访宣教'])) + '<div class="hint">点选，可多选</div>', true) +
      fld('受众', pickBox('kb-a-aud', DICT.audiences, a ? a.audiences : (isTrain ? ['登记人员'] : ['患者及家属']))) +
      fld('标签', inp('kb-a-tags', a ? a.tags.join('、') : '', '多个用、分隔') + '<div class="hint">用于检索命中，建议从「分类维护」里现成标签选</div>') +
      fld(R('摘要'), ta('kb-a-summary', a ? a.summary : '', '列表里显示的一句话，写清这篇解决什么问题', 2), true) +
      fld(R('正文'), ta('kb-a-body', a ? String(a.body).replace(/<br\s*\/?>/g, '\n') : '', '支持简单 HTML（<p>/<h3>/<ul>），留空则直接编辑纯文本', 8), true) +
      fld('依据出处', inp('kb-a-evidence', a ? a.evidence : '', '指南名 + 版本 + 年份，或权威来源')) +
      fld('附件名（可选）', inp('kb-a-file', a && a.attachments && a.attachments[0] ? a.attachments[0].name : '', '例如：随访对照表.pdf')) +
      '<div class="full hint">保存后为<b>停用</b>状态，确认无误后点「启用」上线。<b>依据出处未填写的内容无法启用。</b></div>' +
      '</div>';
  }
  function collectForm(exist) {
    var t = val('kb-a-title'), s = val('kb-a-summary'), b = val('kb-a-body');
    if (!t || !s || !b) { say('标题、摘要、正文为必填', 'error'); return null; }
    var sites = picked('kb-a-sites'), scenes = picked('kb-a-scenes');
    if (!sites.length) { say('请至少选择 1 个病种，否则按病种检索永远搜不到', 'error'); return null; }
    if (!scenes.length) { say('请至少选择 1 个使用场景', 'error'); return null; }
    var file = val('kb-a-file');
    return {
      track: val('kb-a-track'), kind: val('kb-a-kind'), title: t, summary: s,
      body: /<[a-z][a-z]*>/i.test(b) ? b : '<p>' + b.replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>') + '</p>',
      sites: sites, scenes: scenes, audiences: picked('kb-a-aud'),
      tags: val('kb-a-tags').split(/[、,，]/).map(function (x) { return x.trim(); }).filter(Boolean),
      evidence: val('kb-a-evidence'),
      attachments: file ? [{ name: file, size: '—' }] : (exist ? exist.attachments : [])
    };
  }
  function newAsset(track) {
    KB._editing = null;
    modal('新增内容 · ' + track, '保存后为停用状态，补全依据出处再启用', assetForm(track, null),
      '<button class="btn btn-outline btn-sm" data-kb="close">取消</button>' +
      '<button class="btn btn-primary btn-sm" data-kb="saveNew">保存</button>');
  }
  function saveNewAsset() {
    var d = collectForm(null); if (!d) return;
    var id = nextKbHId();
    KB.assets.push({
      id: id, track: d.track, kind: d.kind, title: d.title, summary: d.summary, body: d.body,
      sites: d.sites, scenes: d.scenes, tags: d.tags, audiences: d.audiences,
      lib: '院内', org: ME.org,
      status: '停用', publishedAt: '',
      evidence: d.evidence, attachments: d.attachments, note: '本院新建'
    });
    log(ME.name, '新建内容', id);
    closeModal(); syncHomeNews();
    /* 状态筛选默认就是「全部状态」，新建的停用内容直接可见，不用再动筛选 */
    say('已保存 ' + id + '（停用状态，可继续编辑后启用）', 'success');
    goPage(d.track === '培训' ? 'kb-train' : 'kb-sci');
  }
  function editAsset(id) {
    var a = find(KB.assets, id); if (!a) return;
    if (a.lib === '省库') { say('省库内容只读；需要本院口径请在页头新建院内内容', 'error'); return; }
    KB._editing = id;
    modal('编辑内容 · ' + a.id, a.status === '启用' ? '该内容处于启用中，修改即时生效' : '停用状态', assetForm(a.track, a),
      '<button class="btn btn-outline btn-sm" data-kb="close">取消</button>' +
      '<button class="btn btn-primary btn-sm" data-kb="saveEdit">保存</button>');
  }
  function saveEditAsset() {
    var a = find(KB.assets, KB._editing); if (!a) return;
    var d = collectForm(a); if (!d) return;
    ['track', 'kind', 'title', 'summary', 'body', 'sites', 'scenes', 'tags', 'audiences', 'evidence', 'attachments'].forEach(function (k) { a[k] = d[k]; });
    a.note = nowStr() + ' 由 ' + ME.name + ' 更新';
    log(ME.name, '更新内容', a.id);
    closeModal(); syncHomeNews();
    say('已保存', 'success');
    refresh();
  }

  /* 养 —— 启用 / 停用（只有两态） */
  function setAssetStatus(id) {
    var a = find(KB.assets, id); if (!a) return;
    if (a.status === '启用') {
      confirmBox('停用确认', '停用后《' + esc(a.title) + '》不再出现在库内取用列表，已按它做过的宣教不受影响。', function () {
        a.status = '停用';
        log(ME.name, '停用内容', a.id);
        closeModal(); syncHomeNews(); say('已停用', 'success'); refresh();
      });
      return;
    }
    /* 启用：依据出处为空则拦下并就地补填 */
    if (!a.evidence) { say('启用被拦下：依据出处为空。医学内容没有出处不能上线。', 'error'); openEvidenceFix(id); return; }
    a.status = '启用';
    if (!a.publishedAt) a.publishedAt = today();
    log(ME.name, '启用内容', a.id);
    syncHomeNews(); say('已启用：' + a.title, 'success'); refresh();
  }
  function openEvidenceFix(id) {
    var a = find(KB.assets, id); if (!a) return;
    modal('补填依据出处', a.id + ' · 启用门禁未通过',
      '<div class="kb-note">这条内容没有写依据出处。医学科普没有出处就是隐患，<b>补上才能启用</b>。</div>' +
      fld('依据出处', inp('kb-ev', '', '例如：《中国肿瘤患者疫苗接种专家共识（2025）》'), true) +
      '<div class="hint" style="margin-top:8px">填完直接启用；不想现在补可以关掉窗口，内容仍是停用状态。</div>',
      '<button class="btn btn-outline btn-sm" data-kb="close">先不启用</button>' +
      '<button class="btn btn-primary btn-sm" data-kb="saveEv" data-arg="' + esc(id) + '">保存并启用</button>', false);
  }
  function saveEvidenceAndPublish(id) {
    var v = val('kb-ev');
    if (!v) { say('依据出处不能为空', 'error'); return; }
    var a = find(KB.assets, id); if (!a) return;
    a.evidence = v;
    closeModal();
    setAssetStatus(id);
  }
  function delAsset(id) {
    var a = find(KB.assets, id); if (!a) return;
    confirmBox('删除确认', '确认删除 <b>' + esc(a.title) + '</b>？删除后不可恢复。', function () {
      for (var i = 0; i < KB.assets.length; i++) { if (KB.assets[i].id === id) { KB.assets.splice(i, 1); break; } }
      log(ME.name, '删除内容', id);
      closeModal(); syncHomeNews(); say('已删除', 'success'); refresh();
    });
  }

  /* 读回分类维护页的筛选条（字典类型 / 检索词） */
  function readDictBar() {
    var st = KB.dictState || (KB.dictState = { type: 'sites', kw: '' });
    var t = document.querySelector('[data-kbd="type"]'), k = document.querySelector('[data-kbd="kw"]');
    if (t) st.type = t.value;
    if (k) st.kw = k.value;
  }

  /* ================= 批量上传（科普 / 培训两页页头入口） =================
     复用全站 .bi-* 弹窗类，形制对齐报告卡「批量登记」：
     选文件（点击或拖拽，支持多选）→ 文件清单（可改标题/移除）→ 统一设定 → 导入为停用状态 */
  var BULK_ACCEPT = '.doc,.docx,.ppt,.pptx,.pdf,.txt,.md,.mp4,.mov,.avi,.webm,.png,.jpg,.jpeg,.webp,.gif';
  function kindByExt(name) {
    var e = String(name).toLowerCase().split('.').pop();
    if (['mp4', 'mov', 'avi', 'webm'].indexOf(e) >= 0) return '视频';
    if (['ppt', 'pptx'].indexOf(e) >= 0) return '课件';
    if (e === 'pdf') return '操作手册';
    if (['png', 'jpg', 'jpeg', 'webp', 'gif'].indexOf(e) >= 0) return '宣传折页';
    return '图文';
  }
  function fmtSize(b) {
    if (!b && b !== 0) return '—';
    if (b > 1048576) return (b / 1048576).toFixed(1) + ' MB';
    if (b > 1024) return (b / 1024).toFixed(0) + ' KB';
    return b + ' B';
  }
  function openBulk(track) {
    KB.bulk = { track: track || '科普', files: [] };
    renderBulk();
  }
  function bulkTitle(name) { return String(name).replace(/\.[^.]+$/, '').replace(/[_\-]+/g, ' ').trim() || name; }
  function bulkAddFiles(nodeList) {
    var st = KB.bulk; if (!st) return;
    var arr = Array.prototype.slice.call(nodeList || []);
    arr.forEach(function (fl) {
      if (!fl) return;
      var dupExt = BULK_ACCEPT.split(',').some(function (x) { return fl.name.toLowerCase().endsWith(x); });
      if (!dupExt) { say('已跳过不支持的格式：' + fl.name, 'error'); return; }
      if (st.files.some(function (x) { return x.name === fl.name; })) { say('清单里已有同名文件：' + fl.name, 'error'); return; }
      st.files.push({ name: fl.name, size: fl.size, title: bulkTitle(fl.name), kind: kindByExt(fl.name) });
    });
    renderBulk();
  }
  function bulkRemove(i) { KB.bulk.files.splice(i, 1); renderBulk(); }
  function renderBulk() {
    var st = KB.bulk; if (!st) return;
    document.querySelectorAll('.kb-bulk').forEach(function (o) { o.remove(); });
    var isTrain = st.track === '培训';
    var body;
    if (!st.files.length) {
      body = '<div class="bi-upload-zone" id="kb-bulk-zone">' +
        '<div class="bi-upload-icon">⬆</div>' +
        '<div class="bi-upload-text">点击选择文件，或直接拖拽到此处</div>' +
        '<div class="bi-upload-hint">支持 Word / PPT / PDF / 文本 / 视频 / 图片，可多选；' +
        '导入后为<b>停用</b>状态，形式按扩展名自动判定，需补齐病种、场景与依据出处后才能启用</div></div>';
    } else {
      var rows = st.files.map(function (x, i) {
        return '<tr><td>' + (i + 1) + '</td>' +
          '<td>' + esc(x.name) + '<span class="td-sub">' + fmtSize(x.size) + '</span></td>' +
          '<td><input value="' + esc(x.title) + '" data-kbb="title" data-i="' + i + '" style="width:100%;height:30px;border:1px solid #d1d8e0;border-radius:4px;padding:0 8px;font-size:13px;box-sizing:border-box"></td>' +
          '<td><select data-kbb="kind" data-i="' + i + '" style="height:30px;border:1px solid #d1d8e0;border-radius:4px;font-size:13px">' +
          dictNames('kinds').map(function (k) { return '<option' + (k === x.kind ? ' selected' : '') + '>' + esc(k) + '</option>'; }).join('') +
          '</select></td>' +
          '<td><button class="btn btn-danger btn-xs" data-kb="bulkRm" data-arg="' + i + '">移除</button></td></tr>';
      }).join('');
      body = '<div class="table-wrap" style="margin-bottom:14px"><table class="data-table"><thead><tr>' +
        ['序号', '文件', '内容标题（可改）', '形式', '操作'].map(function (h) { return '<th>' + h + '</th>'; }).join('') +
        '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '<div class="form-grid">' +
        '<div class="form-group"><label>默认病种</label><select id="kb-bulk-site">' +
        dictNames('sites').map(function (v) { return '<option' + (v === '通用' ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join('') + '</select></div>' +
        '<div class="form-group"><label>默认使用场景</label><select id="kb-bulk-scene">' +
        dictNames('scenes').map(function (v) { return '<option>' + esc(v) + '</option>'; }).join('') + '</select></div>' +
        '<div class="form-group"><label>依据出处（可留空，但留空不能发布）</label><input id="kb-bulk-ev" placeholder="指南名 + 版本 + 年份"></div>' +
        '<div class="form-group full"><span style="font-size:11px;color:#94a3b8">导入的 ' + st.files.length + ' 个文件将归入 <b>' + esc(ME.org) + '</b> 院内内容，' +
        '内容线为 <b>' + esc(st.track) + '</b>，状态为停用；同名内容自动跳过。</span></div>' +
        '</div>';
    }
    var o = document.createElement('div');
    o.className = 'bi-overlay kb-bulk';
    o.innerHTML = '<div class="bi-dialog" style="width:860px;max-width:96vw">' +
      '<div class="bi-header"><span>批量上传 · ' + esc(st.track) + '内容</span><span class="bi-close" data-kb="bulkClose">×</span></div>' +
      '<div class="bi-body">' + body + '</div>' +
      '<div class="bi-footer">' +
      (st.files.length ? '<button class="btn btn-ghost btn-sm" data-kb="bulkMore">继续添加文件</button>' : '') +
      '<button class="btn btn-ghost btn-sm" data-kb="bulkClose">取消</button>' +
      '<button class="btn btn-primary btn-sm" data-kb="bulkGo"' + (st.files.length ? '' : ' disabled') + '>导入 ' + st.files.length + ' 个文件</button>' +
      '</div></div>';
    document.body.appendChild(o);
    o.addEventListener('click', function (e) { if (e.target === o) closeBulk(); });
    var zone = document.getElementById('kb-bulk-zone');
    if (zone) zone.addEventListener('click', function () { pick.click(); });
    if (zone) {
      zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.style.borderColor = 'var(--primary)'; });
      zone.addEventListener('dragleave', function () { zone.style.borderColor = ''; });
      zone.addEventListener('drop', function (e) { e.preventDefault(); bulkAddFiles(e.dataTransfer.files); });
    }
    var pick = document.getElementById('kb-bulk-input');
    if (!pick) {
      pick = document.createElement('input');
      pick.type = 'file'; pick.id = 'kb-bulk-input'; pick.multiple = true; pick.accept = BULK_ACCEPT;
      pick.style.display = 'none';
      pick.addEventListener('change', function () { bulkAddFiles(pick.files); pick.value = ''; });
      o.appendChild(pick);
    }
  }
  function closeBulk() { document.querySelectorAll('.kb-bulk').forEach(function (x) { x.remove(); }); KB.bulk = null; }
  function bulkImport() {
    var st = KB.bulk; if (!st || !st.files.length) { say('请先选择文件', 'error'); return; }
    /* 先把用户在表格里改过的标题/形式收回内存 */
    document.querySelectorAll('[data-kbb="title"]').forEach(function (el) {
      var i = Number(el.getAttribute('data-i')); if (st.files[i]) st.files[i].title = el.value.trim() || st.files[i].title;
    });
    document.querySelectorAll('[data-kbb="kind"]').forEach(function (el) {
      var i = Number(el.getAttribute('data-i')); if (st.files[i]) st.files[i].kind = el.value;
    });
    var site = val('kb-bulk-site') || '通用', scene = val('kb-bulk-scene') || (st.track === '培训' ? '上岗培训' : '随访宣教');
    var ev = val('kb-bulk-ev');
    var added = 0, skipped = 0;
    st.files.forEach(function (x) {
      if (KB.assets.some(function (a) { return a.title === x.title && a.lib === '院内' && a.org === ME.org; })) { skipped++; return; }
      KB.assets.push({
        id: nextKbHId(), track: st.track, kind: x.kind, title: x.title,
        summary: '由批量上传导入，正文待补充。源文件：' + x.name,
        body: '<p>正文待补充。源文件：<b>' + esc(x.name) + '</b>（' + fmtSize(x.size) + '）</p>',
        sites: [site], scenes: [scene], tags: [], audiences: st.track === '培训' ? ['登记人员'] : ['患者及家属'],
        lib: '院内', org: ME.org,
        status: '停用', publishedAt: '',
        evidence: ev, attachments: [{ name: x.name, size: fmtSize(x.size) }], note: '批量上传导入'
      });
      added++;
    });
    log(ME.name, '批量上传', st.track + ' ' + added + ' 个文件');
    closeBulk(); syncHomeNews();
    var key = st.track === '培训' ? 'kb-library:train' : 'kb-library:sci';
    KB.filters[key] = { status: '全部状态' };
    KB.pageNo[key] = 1;
    say('已导入 ' + added + ' 个文件（停用状态）' + (skipped ? '，跳过同名 ' + skipped + ' 个' : '') + '；补齐依据出处后才能启用', added ? 'success' : 'error');
    refresh();
  }

  /* ================= 首页资讯栏同源 ================= */
  /* 首页「常用信息 / 培训资料 / 技术指导」三块从库里实时取，不再用硬编码 */
  function homePick(rule) {
    return KB.assets
      .filter(function (a) {
        if (a.status !== '启用' || a.track !== '培训') return false;
        if (rule.kind && a.kind !== rule.kind) return false;
        if (rule.kinds && rule.kinds.indexOf(a.kind) < 0) return false;
        if (rule.scene && a.scenes.indexOf(rule.scene) < 0) return false;
        return true;
      })
      .sort(function (x, y) { return String(y.publishedAt).localeCompare(String(x.publishedAt)); })
      .slice(0, rule.limit);
  }
  var HOME_RULES = {
    common: { kind: '问答', limit: 6 },
    train: { kinds: ['视频', '课件'], limit: 4 },
    tech: { kinds: ['操作手册'], limit: 4 }
  };
  function syncHomeNews() {
    var data;
    try { data = (typeof wbNewsData !== 'undefined') ? wbNewsData : null; } catch (e) { data = null; }
    if (!data) return;
    var common = homePick(HOME_RULES.common).map(function (a) {
      return { id: 'c-' + a.id, title: a.title, meta: md(a.publishedAt), content: a.body };
    });
    var toRow = function (a) { return { title: a.title, meta: md(a.publishedAt), go: a.track === '培训' ? 'kb-train' : 'kb-sci' }; };
    if (common.length) data.common = common;
    data.train = homePick(HOME_RULES.train).map(toRow);
    data.tech = homePick(HOME_RULES.tech).map(toRow);
  }

  /* ================= 事件委托 ================= */
  document.addEventListener('click', function (ev) {
    if (!ev.target || !ev.target.closest) return;

    /* 表单里的多选 chip */
    var pick = ev.target.closest('[data-pick]');
    if (pick) { pick.classList.toggle('on'); return; }

    var el = ev.target.closest('[data-kb]');
    if (!el) return;
    var a = el.getAttribute('data-kb');
    var g = el.getAttribute('data-arg') || '';

    switch (a) {
      case 'close': closeModal(); return;
      case 'confirmOk': { var fn = KB._confirm; KB._confirm = null; closeModal(); if (fn) fn(); return; }
      case 'filter': readFilter(g); KB.pageNo[g] = 1; say('查询完成'); refresh(); return;
      case 'filterReset': KB.filters[g] = {}; KB.pageNo[g] = 1; refresh(); return;
      case 'page': { var p = g.split('|'); KB.pageNo[p[0]] = Math.max(1, parseInt(p[1], 10) || 1); refresh(); return; }
      case 'exportList': say('内容清单导出任务已提交（原型演示）', 'info'); return;
      case 'bulk': openBulk(g); return;
      case 'bulkClose': closeBulk(); return;
      case 'bulkMore': { var zi = document.getElementById('kb-bulk-input'); if (zi) zi.click(); return; }
      case 'bulkRm': bulkRemove(parseInt(g, 10)); return;
      case 'bulkGo': bulkImport(); return;

      case 'view': viewAsset(g); return;
      case 'pick': pickAsset(g); return;
      case 'copy': copyPickText(); return;
      case 'dl': {
        var dp = g.split('|');
        var art = find(KB.assets, dp[0]);
        if (art) downloadText(dp[1] || (art.title + '.txt'), String(art.body).replace(/<[^>]*>/g, ''));
        return;
      }
      case 'fav': toggleFav(g); return;

      case 'new': newAsset(g || '科普'); return;
      case 'saveNew': saveNewAsset(); return;
      case 'edit': editAsset(g); return;
      case 'saveEdit': saveEditAsset(); return;
      case 'toggleStatus': setAssetStatus(g); return;
      case 'del': delAsset(g); return;
      case 'saveEv': saveEvidenceAndPublish(g); return;


      case 'dictAdd': KB.dictState = KB.dictState || { type: 'sites', kw: '' }; readDictBar(); KB.dictState.type = g; dictForm(g, null); return;
      case 'dictEdit': { var p1 = g.split('|'); dictForm(p1[0], p1[1] === '' ? null : parseInt(p1[1], 10)); return; }
      case 'dictSave': { var p2 = g.split('|'); dictSave(p2[0], p2[1] === '' ? null : parseInt(p2[1], 10)); return; }
      case 'dictToggle': { var p3 = g.split('|'); dictToggle(p3[0], parseInt(p3[1], 10)); return; }
      case 'dictDel': { var p4 = g.split('|'); dictDel(p4[0], parseInt(p4[1], 10)); return; }
      case 'dictQuery': readDictBar(); refresh(); return;
      case 'dictReset': readDictBar(); KB.dictState.kw = ''; refresh(); return;

      default: say('功能演示：' + a); return;
    }
  });

  /* Enter 触发筛选输入框查询 */
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter') return;
    var t = ev.target;
    if (t && t.getAttribute && t.getAttribute('data-kbf') && t.tagName === 'INPUT') {
      var box = t.closest('[data-kbfilter]');
      if (box) { var key = box.getAttribute('data-kbfilter'); readFilter(key); KB.pageNo[key] = 1; refresh(); }
    }
  });

  /* ================= 注册到全局 ================= */
  var LEGACY_IDS = [
    'consult-sessions', 'consult-analysis', 'community-management', 'consult-education',
    'consult-session', 'consult-message', 'consult-category', 'consult-assign-log',
    'analysis-raw-text', 'analysis-ai-result', 'analysis-hotspot', 'analysis-insight',
    'community-board', 'community-post', 'community-comment', 'community-user-log', 'community-recommend'
  ];
  window.kbPageIds = ['kb-sci', 'kb-train', 'kb-mine', 'kb-dict', 'kb-library', 'health-consult'].concat(LEGACY_IDS);
  /* 分类维护页的字典类型下拉即时切换（对齐全站字典页的 onchange 写法） */
  window.kbDictType = function () { readDictBar(); refresh(); };
  window.renderKBPage = renderKBPage;
  /* 旧调用名保留：菜单/面包屑里可能还写着旧 id */
  window.renderHealthConsultPage = function (id) { renderKBPage(id); };
  window.KB_SYNC_HOME_NEWS = syncHomeNews;

  syncHomeNews();
})();
