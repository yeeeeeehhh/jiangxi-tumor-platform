/* =========================================================================
   报告卡迁移（report-card-migrate.js）
   -------------------------------------------------------------------------
   用途：批量修改报告卡的「归属地」——即这张卡计入哪个登记处的行政区划辖区。

   入口
     · 侧边栏 报告卡管理 › 报告卡列表 下方「报告卡迁移」
     · 报告卡列表工具栏「批量迁移」

   关键约定
     1) 报告卡对象上的 region 是扁平串（既有数据形如 '南昌市东湖区'）。本页不改这个格式，
        只在迁移时按目标级联路径重新拼装，保证与存量数据同构、其它模块无感知。
     2) 只改归属区划，不改报告单位 / 户籍地址 / 常住地址本体。
     3) 提交 ≠ 执行：提交只生成「待审批」批次，审批通过后才真正改写卡片。
     4) 硬约束沿用既有 cardCanEdit 判定（合并卡、已核对卡不可动），避免与重卡/核对流程打架。
     5) 每张卡每次动作（执行 / 回退）都追加一条不可删除的迁移记录。
   ========================================================================= */

/* ===================== 1. 区划码表 =====================
   按 GB/T 2260 行政区划代码。上线前请与「系统管理 › 行政区划管理」的正式字典核对。
   查不到的区划一律显示「区划码待补」，不臆造编码——编码只用于留痕与上报对齐，
   不参与迁移的业务判定，所以缺失不影响功能可用。 */
var MIG_PROVINCE_CODE = '360000';
var MIG_CITY_CODES = {
  '南昌市': '360100', '景德镇市': '360200', '萍乡市': '360300', '九江市': '360400',
  '新余市': '360500', '鹰潭市': '360600', '赣州市': '360700', '吉安市': '360800',
  '宜春市': '360900', '抚州市': '361000', '上饶市': '361100'
};
var MIG_DIST_CODES = {
  '南昌市|东湖区': '360102', '南昌市|西湖区': '360103', '南昌市|青云谱区': '360104',
  '南昌市|青山湖区': '360111', '南昌市|新建区': '360112', '南昌市|红谷滩区': '360113',
  '南昌市|南昌县': '360121', '南昌市|安义县': '360123', '南昌市|进贤县': '360124',
  '景德镇市|昌江区': '360202', '景德镇市|珠山区': '360203', '景德镇市|浮梁县': '360222',
  '景德镇市|乐平市': '360281',
  '萍乡市|安源区': '360302', '萍乡市|湘东区': '360313', '萍乡市|莲花县': '360321',
  '萍乡市|上栗县': '360322', '萍乡市|芦溪县': '360323',
  '九江市|濂溪区': '360402', '九江市|浔阳区': '360403', '九江市|都昌县': '360421',
  '九江市|湖口县': '360422', '九江市|武宁县': '360423', '九江市|修水县': '360424',
  '九江市|永修县': '360425', '九江市|德安县': '360426', '九江市|瑞昌市': '360427',
  '九江市|共青城市': '360428', '九江市|庐山市': '360429', '九江市|彭泽县': '360430',
  '新余市|渝水区': '360502', '新余市|分宜县': '360521',
  '鹰潭市|月湖区': '360602', '鹰潭市|余江区': '360603', '鹰潭市|贵溪市': '360681',
  '赣州市|章贡区': '360702', '赣州市|南康区': '360703', '赣州市|赣县区': '360704',
  '赣州市|信丰县': '360722', '赣州市|大余县': '360723', '赣州市|上犹县': '360724',
  '赣州市|崇义县': '360725', '赣州市|安远县': '360726', '赣州市|定南县': '360728',
  '赣州市|全南县': '360729', '赣州市|宁都县': '360730', '赣州市|于都县': '360731',
  '赣州市|兴国县': '360732', '赣州市|会昌县': '360733', '赣州市|寻乌县': '360734',
  '赣州市|石城县': '360735', '赣州市|瑞金市': '360781', '赣州市|龙南市': '360783',
  '吉安市|吉州区': '360802', '吉安市|青原区': '360803', '吉安市|吉安县': '360821',
  '吉安市|吉水县': '360822', '吉安市|峡江县': '360823', '吉安市|新干县': '360824',
  '吉安市|永丰县': '360825', '吉安市|泰和县': '360826', '吉安市|遂川县': '360827',
  '吉安市|万安县': '360828', '吉安市|安福县': '360829', '吉安市|永新县': '360830',
  '吉安市|井冈山市': '360881',
  '宜春市|袁州区': '360902', '宜春市|奉新县': '360921', '宜春市|万载县': '360922',
  '宜春市|上高县': '360923', '宜春市|宜丰县': '360924', '宜春市|靖安县': '360925',
  '宜春市|铜鼓县': '360926', '宜春市|丰城市': '360981', '宜春市|樟树市': '360982',
  '宜春市|高安市': '360983',
  '抚州市|临川区': '361002', '抚州市|东乡区': '361003', '抚州市|南城县': '361021',
  '抚州市|黎川县': '361022', '抚州市|南丰县': '361023', '抚州市|崇仁县': '361024',
  '抚州市|乐安县': '361025', '抚州市|宜黄县': '361026', '抚州市|金溪县': '361027',
  '抚州市|资溪县': '361028', '抚州市|广昌县': '361030',
  '上饶市|信州区': '361102', '上饶市|广丰区': '361103', '上饶市|广信区': '361104',
  '上饶市|上饶县': '361123', '上饶市|铅山县': '361124', '上饶市|横峰县': '361125',
  '上饶市|弋阳县': '361126', '上饶市|余干县': '361127', '上饶市|鄱阳县': '361128',
  '上饶市|万年县': '361129', '上饶市|婺源县': '361130', '上饶市|德兴市': '361181'
};

/* ===================== 2. 区划解析工具 ===================== */

/** 从 regionData 五级树上按扁平标签反查路径，如 '南昌市东湖区' → [江西省,南昌市,东湖区] */
function migWalk(nodes, rest) {
  for (var i = 0; i < nodes.length; i++) {
    var n = nodes[i];
    if (rest === n.label) return [n];
    if (rest.indexOf(n.label) === 0 && n.children && n.children.length) {
      var deeper = migWalk(n.children, rest.slice(n.label.length));
      if (deeper.length) return [n].concat(deeper);
    }
  }
  return [];
}
function migResolveRegion(label) {
  if (!label || label === '-') return [];
  if (typeof regionData === 'undefined' || !regionData.length) return [];
  var prov = regionData[0];
  if (label === prov.label) return [prov];
  var cities = prov.children || [];
  for (var i = 0; i < cities.length; i++) {
    var city = cities[i];
    if (label.indexOf(city.label) === 0) {
      var rest = label.slice(city.label.length);
      if (!rest) return [prov, city];
      var deeper = migWalk(city.children || [], rest);
      if (deeper.length) return [prov, city].concat(deeper);
    }
  }
  return [];
}
/** 路径 → 卡片 region 字段格式（去掉省名后平铺，与存量数据同构） */
function migLabelOfPath(path) {
  if (!path || !path.length) return '';
  if (path.length === 1) return path[0].label;
  return path.slice(1).map(function (n) { return n.label; }).join('');
}
/** 路径 → 展示文本（'江西省 / 南昌市 / 东湖区'） */
function migTextOfPath(path) {
  return (path || []).map(function (n) { return n.label; }).join(' / ');
}
/** 路径 → 区划码；查不到返回 ''（UI 显示「区划码待补」，不臆造） */
function migCodeOfPath(path) {
  if (!path || !path.length) return '';
  if (path.length === 1) return MIG_PROVINCE_CODE;
  var city = path[1].label;
  if (path.length === 2) return MIG_CITY_CODES[city] || '';
  return MIG_DIST_CODES[city + '|' + path[2].label] || '';
}
function migCityOfPath(path) {
  return (path && path.length > 1) ? path[1].label : '';
}
/** 取报告卡的当前归属路径，顺手把解析结果回写进卡片对象供其它模块复用。
    每次都按 card.region 重算，避免迁移改写 region 后读到过期缓存。 */
function migCardRegionPath(card) {
  if (!card) return [];
  var path = migResolveRegion(card.region);
  if (path.length) {
    card.regionPath = path.map(function (n) { return n.label; });
    card.regionCode = migCodeOfPath(path);
  } else {
    delete card.regionPath;
    delete card.regionCode;
  }
  return path;
}

/* ===================== 3. 操作上下文与权限 =====================
   原型没有登录会话，这里用可切换的角色上下文演示权限分级；
   正式环境应由会话注入 MIG_CTX. */
var MIG_CTX = { operator: '省级登记中心·管理员', role: 'PROVINCE' };
var MIG_ROLES = [
  { code: 'PROVINCE', label: '省级登记中心' },
  { code: 'CITY', label: '市级登记处' },
  { code: 'COUNTY', label: '区县登记处' },
  { code: 'HOSPITAL', label: '医院填报' }
];
function migCanSee() { return MIG_CTX.role !== 'HOSPITAL'; }
function migCanSubmit() { return ['PROVINCE', 'CITY', 'COUNTY'].indexOf(MIG_CTX.role) > -1; }
function migCanApprove() { return ['PROVINCE', 'CITY'].indexOf(MIG_CTX.role) > -1; }
function migCanRevert() { return MIG_CTX.role === 'PROVINCE'; }
/** 市级只能审同市批次；省级可审全部 */
function migApproveScope(batch) {
  if (MIG_CTX.role === 'PROVINCE') return true;
  if (MIG_CTX.role === 'CITY') return !!batch.fromCity && batch.fromCity === batch.toCity;
  return false;
}

/* ===================== 4. 迁移原因与状态字典 ===================== */
var MIG_REASONS = [
  { code: 'RESIDENCE_MOVE', label: '患者实际迁出本辖区（户籍/常住地变更）' },
  { code: 'DIVISION_ADJUST', label: '行政区划调整（撤县设区、边界重新划定）' },
  { code: 'REGISTRY_REDIVIDE', label: '登记处管辖范围重新划分' },
  { code: 'INIT_ERROR', label: '初始归属错误纠正' },
  { code: 'SOURCE_MISLINK', label: '上报数据错挂纠正' },
  { code: 'OTHER', label: '其他' }
];
var MIG_STATUS_TEXT = {
  pending: '待审批', executed: '已执行', rejected: '已驳回', reverted: '已回退'
};
var MIG_STATUS_CLS = {
  pending: 'badge-warning', executed: 'badge-success',
  rejected: 'badge-danger', reverted: 'badge-muted'
};
function migReasonLabel(code) {
  for (var i = 0; i < MIG_REASONS.length; i++) if (MIG_REASONS[i].code === code) return MIG_REASONS[i].label;
  return code || '-';
}

/* ===================== 5. 状态与数据 ===================== */
var MIG_STATE = {
  tab: 'cards',
  keyword: '', cardType: '', checkStatus: '', dateType: '报告日期',
  selected: {}
};
var MIG_RECORDS = [];
var MIG_BATCH_SEQ = 0;

/** 演示用历史批次：让批次台账与留痕一开页就有内容 */
function migSeed() {
  var seeds = [
    {
      batchNo: 'MIG-20260920-01', status: 'executed',
      fromRegion: '南昌市东湖区', toRegion: '南昌市西湖区',
      fromCity: '南昌市', toCity: '南昌市',
      cardIds: ['JX-2026-000118', 'JX-2026-000133'],
      reasonCode: 'REGISTRY_REDIVIDE', reasonNote: '东湖区部分网格并入西湖区，登记处辖区重新划分',
      operator: '南昌市登记处·王丽', operateTime: '2026-09-20 10:12:00',
      approver: '省级登记中心·张建国', approveTime: '2026-09-20 15:40:00', approveNote: '同意'
    },
    {
      batchNo: 'MIG-20261005-01', status: 'pending',
      fromRegion: '赣州市章贡区', toRegion: '赣州市南康区',
      fromCity: '赣州市', toCity: '赣州市',
      cardIds: ['JX-2026-000125'], reasonCode: 'RESIDENCE_MOVE',
      reasonNote: '患者 2026-09 已迁居南康区，按常住地变更调整归属',
      operator: '赣州市登记处·李强', operateTime: '2026-10-05 09:05:00',
      approver: '', approveTime: '', approveNote: ''
    },
    {
      batchNo: 'MIG-20261008-01', status: 'rejected',
      fromRegion: '南昌市东湖区', toRegion: '南昌市青云谱区',
      fromCity: '南昌市', toCity: '南昌市',
      cardIds: ['JX-2026-000102'], reasonCode: 'INIT_ERROR',
      reasonNote: '区划字典切换后归属错挂',
      operator: '区县登记处·陈明', operateTime: '2026-10-08 14:20:00',
      approver: '省级登记中心·张建国', approveTime: '2026-10-08 17:02:00',
      approveNote: '证据不足，请补充患者常住地证明后重新提交'
    }
  ];
  MIG_BATCH_SEQ = seeds.length;
  seeds.forEach(function (seed) {
    MIG_BATCHES.push(migBuildBatch(seed));
    migPushRecords(seed.batchNo, seed.cardIds, seed.fromRegion, seed.toRegion, seed.reasonCode,
      seed.reasonNote, seed.operator, seed.operateTime, seed.approver, seed.approveTime,
      seed.status === 'rejected' ? 'rejected' : seed.status);
    /* 已执行的历史批次：把结果落到卡片上，保证与台账自洽 */
    if (seed.status === 'executed') migApplyToCards(seed.batchNo, seed.cardIds, seed.fromRegion, seed.toRegion);
  });
}
var MIG_BATCHES = [];

function migBuildBatch(seed) {
  var fromPath = migResolveRegion(seed.fromRegion);
  var toPath = migResolveRegion(seed.toRegion);
  return {
    batchNo: seed.batchNo,
    status: seed.status,
    fromRegion: seed.fromRegion, toRegion: seed.toRegion,
    fromPath: fromPath.map(function (n) { return n.label; }),
    toPath: toPath.map(function (n) { return n.label; }),
    fromCode: migCodeOfPath(fromPath), toCode: migCodeOfPath(toPath),
    fromCity: seed.fromCity || migCityOfPath(fromPath),
    toCity: seed.toCity || migCityOfPath(toPath),
    cardIds: seed.cardIds.slice(),
    reasonCode: seed.reasonCode, reasonNote: seed.reasonNote || '',
    operator: seed.operator, operateTime: seed.operateTime,
    approver: seed.approver || '', approveTime: seed.approveTime || '', approveNote: seed.approveNote || ''
  };
}

function migNow() {
  var d = new Date();
  var p = function (n) { return String(n).padStart(2, '0'); };
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' +
    p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}
function migNextBatchNo() {
  MIG_BATCH_SEQ += 1;
  var d = new Date();
  var p = function (n) { return String(n).padStart(2, '0'); };
  return 'MIG-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' +
    String(MIG_BATCH_SEQ).padStart(2, '0');
}
function migFindCard(cardId) {
  return migCards().find(function (c) { return c.id === cardId; });
}
/** 报告卡数据是懒加载的：window.reportCardListData 只有渲染过报告卡列表才填充，
    这里沿用 death-module / followup-death 的做法，缺数据时先触发一次列表渲染。 */
function migCards() {
  if ((!window.reportCardListData || !window.reportCardListData.length) &&
    typeof renderReportCardList === 'function') {
    try { renderReportCardList(); } catch (e) { console.error('[migrate] 报告卡数据加载失败', e); }
  }
  return window.reportCardListData || [];
}

/* ===================== 6. 硬约束判定 =====================
   与既有 cardCanEdit 同源：合并卡涉及多来源归属，改判要回退合并关系；
   已核对卡已被人工确认，改判会推翻核对结论。 */
function migBlockReason(card) {
  var type = typeof cardTypeText === 'function' ? cardTypeText(card) : String(card.cardType || '').replace(/<[^>]+>/g, '').trim();
  var audit = typeof cardAuditText === 'function' ? cardAuditText(card) : String(card.auditStatus || '').replace(/<[^>]+>/g, '').trim();
  if (type.indexOf('合并卡') > -1) return '合并卡不可迁移，请在重卡管理中处理合并关系';
  if (audit === '已核对') return '已核对卡不可迁移，需先解锁';
  return '';
}

/* ===================== 7. 筛选 ===================== */
function migTargetPath() { return getRegionSelected('migTo'); }
function migFilterPath() { return getRegionSelected('migFrom'); }
function migCardDate(card) {
  var f = { '报告日期': 'reportDate', '登记日期': 'reportDate', '确诊日期': 'diagnosisDate' }[MIG_STATE.dateType] || 'reportDate';
  return String(card[f] || '');
}
function migPlainCheckStatus(card) {
  return typeof cardCheckText === 'function' ? cardCheckText(card) : String(card.checkStatus || '').replace(/<[^>]+>/g, '').trim();
}
function migVisibleCards() {
  var fromPath = migFilterPath();
  var fromLabels = fromPath.map(function (n) { return n.label; });
  var kw = (MIG_STATE.keyword || '').trim().toLowerCase();
  var dr = typeof getDateRangeValue === 'function' ? getDateRangeValue('dr_migrate') : { start: '', end: '' };
  return migCards().filter(function (card) {
    var path = migCardRegionPath(card).map(function (n) { return n.label; });
    if (fromLabels.length) {
      /* 选了哪一级就按哪一级前缀匹配 */
      var hit = fromLabels.every(function (l, i) { return path[i] === l; });
      if (!hit) return false;
    }
    if (MIG_STATE.cardType) {
      var type = typeof cardTypeText === 'function' ? cardTypeText(card) : '';
      if (type !== MIG_STATE.cardType) return false;
    }
    if (MIG_STATE.checkStatus && migPlainCheckStatus(card) !== MIG_STATE.checkStatus) return false;
    var d = migCardDate(card);
    if (dr.start && d < dr.start) return false;
    if (dr.end && d > dr.end) return false;
    if (kw) {
      var pool = [card.id, card.name, card.idNo].map(function (v) { return String(v || '').toLowerCase(); });
      if (!pool.some(function (v) { return v.indexOf(kw) > -1; })) return false;
    }
    return true;
  });
}
function migSelectedIds() {
  return Object.keys(MIG_STATE.selected).filter(function (id) { return MIG_STATE.selected[id]; });
}

/* ===================== 8. 通用弹窗 ===================== */
function migDialog(title, bodyHtml, okText, onOk) {
  document.querySelectorAll('.mig-modal').forEach(function (m) { m.remove(); });
  var modal = document.createElement('div');
  modal.className = 'news-confirm-modal mig-modal';
  modal.innerHTML =
    '<div class="news-confirm-box" style="width:760px;max-width:94vw">' +
    '<div class="news-confirm-title">' + title + '</div>' +
    '<div class="news-confirm-body">' + bodyHtml + '</div>' +
    '<div class="news-confirm-actions">' +
    '<button class="btn btn-ghost" data-act="cancel">取消</button>' +
    '<button class="btn btn-primary" data-act="ok">' + (okText || '确认') + '</button>' +
    '</div></div>';
  document.body.appendChild(modal);
  modal.querySelector('[data-act=cancel]').onclick = function () { modal.remove(); };
  modal.querySelector('[data-act=ok]').onclick = function () {
    if (onOk(modal) !== false) modal.remove();
  };
  modal.addEventListener('click', function (e) { if (e.target === modal) modal.remove(); });
  return modal;
}

/* ===================== 9. 页面渲染 ===================== */
function migTabsHtml() {
  var pending = MIG_BATCHES.filter(function (b) { return b.status === 'pending'; }).length;
  return '<div class="report-data-tabs" role="tablist">' +
    '<button class="report-data-tab ' + (MIG_STATE.tab === 'cards' ? 'active' : '') +
    '" onclick="migSwitchTab(\'cards\')">待迁移报告卡<span class="count">' + migVisibleCards().length + '</span></button>' +
    '<button class="report-data-tab ' + (MIG_STATE.tab === 'batches' ? 'active' : '') +
    '" onclick="migSwitchTab(\'batches\')">迁移批次<span class="count">' + MIG_BATCHES.length +
    (pending ? ' · 待审批 ' + pending : '') + '</span></button></div>';
}
function migSwitchTab(tab) { MIG_STATE.tab = tab; migRerender(); }

function migRoleSwitcherHtml() {
  return '<div class="form-group" style="min-width:150px"><label>操作身份</label><select onchange="MIG_CTX.role=this.value;migRerender()">' +
    MIG_ROLES.map(function (r) {
      return '<option value="' + r.code + '"' + (MIG_CTX.role === r.code ? ' selected' : '') + '>' + r.label + '</option>';
    }).join('') + '</select></div>';
}

function migFiltersHtml() {
  var typeOpts = ['', '原始卡', '补报卡', '多原发卡', '重卡(人工)', '重卡(自动)', '重卡(克隆)',
    '合并卡(人工)', '合并卡(自动)', '合并卡(克隆)'];
  var chkOpts = ['', '未校验', '错误', '警告', '通过', '不校验'];
  return '<div class="filter-toolbar">' +
    '<div class="form-group region-filter" style="min-width:200px"><label>当前归属地</label>' + renderRegionCascader('migFrom') + '</div>' +
    '<div class="form-group region-filter" style="min-width:200px"><label>目标归属地</label>' + renderRegionCascader('migTo') + '</div>' +
    '<div class="form-group"><label>报告卡类型</label><select onchange="MIG_STATE.cardType=this.value;migRerender()">' +
    typeOpts.map(function (o) { return '<option value="' + o + '"' + (MIG_STATE.cardType === o ? ' selected' : '') + '>' + (o || '全部类型') + '</option>'; }).join('') +
    '</select></div>' +
    '<div class="form-group"><label>校验状态</label><select onchange="MIG_STATE.checkStatus=this.value;migRerender()">' +
    chkOpts.map(function (o) { return '<option value="' + o + '"' + (MIG_STATE.checkStatus === o ? ' selected' : '') + '>' + (o || '全部状态') + '</option>'; }).join('') +
    '</select></div>' +
    '<div class="form-group"><label>日期类型</label><select onchange="MIG_STATE.dateType=this.value;migRerender()">' +
    ['报告日期', '登记日期', '确诊日期'].map(function (o) { return '<option' + (MIG_STATE.dateType === o ? ' selected' : '') + '>' + o + '</option>'; }).join('') +
    '</select></div>' +
    '<div class="form-group date-group"><label>日期区间</label>' + renderDateRangePicker('dr_migrate', '', '') + '</div>' +
    '<div class="form-group search-group"><label>检索内容</label><input type="text" placeholder="报告卡编号 / 姓名 / 身份证号" value="' +
    MIG_STATE.keyword + '" oninput="MIG_STATE.keyword=this.value;migRerender()"></div>' +
    migRoleSwitcherHtml() +
    '<div class="filter-actions">' +
    '<button class="btn btn-ghost btn-sm" onclick="migResetFilters()">重置</button>' +
    '<button class="btn btn-outline btn-sm" onclick="toast(\'导出Excel中...\')">导出Excel</button>' +
    '</div></div>';
}

function migBatchBarHtml() {
  var n = migSelectedIds().length;
  var hasTarget = migTargetPath().length > 0;
  var dis = (!hasTarget || !migCanSubmit()) ? ' disabled' : '';
  var tip = !migCanSubmit() ? '当前身份不可发起迁移' : (!hasTarget ? '请先选择目标归属地' : '');
  return '<div class="void-batch-bar" id="migBatchBar">' +
    '<div class="void-batch-info">已选择 <strong>' + n + '</strong> 张' +
    (hasTarget ? ' · 目标归属地 <strong>' + migTextOfPath(migTargetPath()) + '</strong>' : ' · <span style="color:var(--danger)">未选择目标归属地</span>') +
    '</div>' +
    '<div class="void-batch-actions">' +
    '<button class="btn btn-ghost btn-sm" onclick="migSelectAllRows(true)">全选本页</button>' +
    '<button class="btn btn-ghost btn-sm" onclick="migSelectAllRows(false)">清空选择</button>' +
    '<button class="btn btn-primary btn-sm"' + dis + (tip ? ' title="' + tip + '"' : '') +
    ' onclick="migOpenSubmitDialog()">发起迁移</button>' +
    '</div></div>';
}

function migCardsTableHtml() {
  var rows = migVisibleCards();
  var targetPath = migTargetPath();
  var targetLabel = migLabelOfPath(targetPath);
  var targetText = migTextOfPath(targetPath) || '—';
  var targetCode = migCodeOfPath(targetPath);

  if (!rows.length) {
    return '<div style="padding:36px;text-align:center;color:#94a3b8">当前筛选条件下没有报告卡</div>';
  }
  var body = rows.map(function (c) {
    var blocked = migBlockReason(c);
    var sameAsTarget = targetLabel && (c.region === targetLabel);
    var disabled = blocked || sameAsTarget;
    var reason = blocked || (sameAsTarget ? '当前归属地与目标一致' : '');
    var checked = MIG_STATE.selected[c.id] ? ' checked' : '';
    var age = c.birth ? Math.floor((new Date() - new Date(c.birth)) / (365.25 * 24 * 3600 * 1000)) : '-';
    return '<tr' + (disabled ? ' style="background:#f8fafc;color:#94a3b8"' : '') + '>' +
      '<td style="width:36px"><input type="checkbox" class="mig-card-check" data-id="' + c.id + '"' + checked +
      (disabled ? ' disabled' : '') + ' onchange="migOnCardCheck(this)" style="cursor:' + (disabled ? 'not-allowed' : 'pointer') + '"></td>' +
      '<td class="txt"><a href="javascript:void(0)" style="color:var(--primary)" onclick="cardListDetail(\'' + c.id + '\')">' + c.id + '</a></td>' +
      '<td class="txt">' + c.name + '</td>' +
      '<td class="txt">' + c.idNo + '</td>' +
      '<td class="code">' + c.sex + '</td>' +
      '<td class="num">' + age + '</td>' +
      '<td class="txt">' + c.reportUnit + '</td>' +
      '<td class="txt"><strong>' + (c.region && c.region !== '-' ? c.region : '<span style="color:var(--danger)">未定位</span>') + '</strong>' +
      (c.regionCode ? ' <span class="badge badge-muted">' + c.regionCode + '</span>' : '') + '</td>' +
      '<td style="text-align:center;color:#94a3b8">→</td>' +
      '<td class="txt">' + (targetText === '—' ? '<span style="color:#94a3b8">未选择</span>' :
        targetText + (targetCode ? ' <span class="badge badge-muted">' + targetCode + '</span>' : '')) + '</td>' +
      '<td>' + c.cardType + '</td>' +
      '<td>' + c.checkStatus + '</td>' +
      '<td>' + c.auditStatus + '</td>' +
      '<td class="txt" style="font-size:12px">' + (reason || '<span style="color:#16a34a">可迁移</span>') + '</td>' +
      '</tr>';
  }).join('');

  return '<div style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;margin-bottom:12px"><div class="table-wrap">' +
    '<table class="data-table" style="margin:0;min-width:1680px"><thead><tr>' +
    '<th style="width:36px"><input type="checkbox" onchange="migSelectAllRows(this.checked)" style="cursor:pointer"></th>' +
    '<th class="txt">报告卡编号</th><th class="txt">姓名</th><th class="txt">身份证号码</th>' +
    '<th class="code">性别</th><th class="num">年龄</th><th class="txt">报告单位</th>' +
    '<th class="txt">当前归属地</th><th style="width:40px"></th><th class="txt">目标归属地</th>' +
    '<th class="code">报卡类型</th><th class="code">校验状态</th><th class="code">审核状态</th><th class="txt">迁移可行性</th>' +
    '</tr></thead><tbody>' + body + '</tbody></table></div></div>';
}

function migBatchesTableHtml() {
  if (!MIG_BATCHES.length) {
    return '<div style="padding:36px;text-align:center;color:#94a3b8">暂无迁移批次</div>';
  }
  var rows = MIG_BATCHES.map(function (b) {
    var ops = [];
    ops.push('<button class="btn btn-ghost btn-xs" onclick="migShowBatchDetail(\'' + b.batchNo + '\')">查看明细</button>');
    if (b.status === 'pending' && migCanApprove() && migApproveScope(b)) {
      ops.push('<button class="btn btn-primary btn-xs" onclick="migApproveBatch(\'' + b.batchNo + '\')">审批</button>');
      ops.push('<button class="btn btn-danger btn-xs" onclick="migRejectBatch(\'' + b.batchNo + '\')">驳回</button>');
    }
    if (b.status === 'executed' && migCanRevert()) {
      ops.push('<button class="btn btn-outline btn-xs" onclick="migRevertBatch(\'' + b.batchNo + '\')">回退</button>');
    }
    ops.push('<button class="btn btn-ghost btn-xs" onclick="toast(\'导出Excel中...\')">导出</button>');
    var crossCity = b.fromCity && b.toCity && b.fromCity !== b.toCity;
    return '<tr>' +
      '<td class="txt"><a href="javascript:void(0)" style="color:var(--primary)" onclick="migShowBatchDetail(\'' + b.batchNo + '\')">' + b.batchNo + '</a></td>' +
      '<td class="txt">' + b.fromRegion + '</td>' +
      '<td class="txt">' + b.toRegion + (crossCity ? ' <span class="badge badge-warning">跨市</span>' : '') + '</td>' +
      '<td class="num">' + b.cardIds.length + '</td>' +
      '<td class="txt">' + migReasonLabel(b.reasonCode) + '</td>' +
      '<td class="txt">' + b.operator + '</td>' +
      '<td class="code">' + b.operateTime + '</td>' +
      '<td class="code"><span class="badge ' + MIG_STATUS_CLS[b.status] + '">' + MIG_STATUS_TEXT[b.status] + '</span></td>' +
      '<td class="txt">' + (b.approver || '-') + '</td>' +
      '<td class="code">' + (b.approveTime || '-') + '</td>' +
      '<td class="ops sticky-col">' + ops.join(' ') + '</td>' +
      '</tr>';
  }).join('');
  return '<div style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden"><div class="table-wrap">' +
    '<table class="data-table" style="margin:0;min-width:1500px"><thead><tr>' +
    '<th class="txt">批次号</th><th class="txt">源归属地</th><th class="txt">目标归属地</th>' +
    '<th class="num">报告卡数</th><th class="txt">迁移原因</th><th class="txt">发起人</th>' +
    '<th class="code">发起时间</th><th class="code">状态</th><th class="txt">审批人</th><th class="code">审批时间</th>' +
    '<th class="ops sticky-col">操作</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
}

function renderCardMigrate() {
  migEnsureSeeded();
  if (!migCanSee()) {
    return '<div class="page-toolbar"><div class="page-toolbar-title"><span class="icon">●</span>报告卡迁移</div></div>' +
      '<div class="panel"><div class="panel-body"><div class="entry-alert">' +
      '<div class="entry-alert-title">⚠ 无访问权限</div>' +
      '医院填报角色不参与报告卡归属地调整，归属地迁移由登记处与省级登记中心发起。</div></div></div>';
  }
  var head = '<div class="page-toolbar"><div class="page-toolbar-title"><span class="icon">●</span>报告卡迁移</div>' +
    '<div class="toolbar-actions"><button class="btn btn-outline btn-sm" onclick="migSwitchTab(\'batches\')">迁移批次台账</button>' +
    '<button class="btn btn-ghost btn-sm" onclick="navigateTo(\'datamgmt-card\')">返回报告卡列表</button></div></div>';

  if (MIG_STATE.tab === 'batches') {
    return head + migTabsHtml() +
      '<div class="panel"><div class="panel-body">' +
      '<div style="margin-bottom:10px;color:#667085;font-size:13px">共 ' + MIG_BATCHES.length + ' 个迁移批次；审批人与发起人不能为同一人。</div>' +
      migBatchesTableHtml() +
      '</div></div>';
  }

  var rows = migVisibleCards();
  return head + migTabsHtml() +
    '<div class="panel"><div class="panel-body">' +
    migFiltersHtml() +
    '<div style="margin:4px 0 12px;color:#667085;font-size:13px">共 ' + rows.length + ' 张报告卡 · 当前操作身份：' +
    (MIG_ROLES.filter(function (r) { return r.code === MIG_CTX.role; })[0] || {}).label + '</div>' +
    migBatchBarHtml() +
    migCardsTableHtml() +
    '<div class="void-pagination"><div class="void-pagination-info">共 ' + rows.length + ' 条记录，第1/1页</div>' +
    '<div class="void-pagination-controls"><button onclick="toast(\'已是第一页\')">‹</button>' +
    '<input type="text" value="1" readonly><button onclick="toast(\'已是最后一页\')">›</button></div></div>' +
    '</div></div>';
}

/* ===================== 10. 交互动作 ===================== */
function migRerender() { renderPage('datamgmt-card-migrate'); }
function migResetFilters() {
  MIG_STATE.keyword = ''; MIG_STATE.cardType = ''; MIG_STATE.checkStatus = '';
  MIG_STATE.selected = {};
  resetRegionSelected('migFrom');
  resetRegionSelected('migTo');
  migRerender();
}
function migOnCardCheck(box) {
  MIG_STATE.selected[box.getAttribute('data-id')] = box.checked;
  migRefreshBatchBar();
}
function migSelectAllRows(checked) {
  migVisibleCards().forEach(function (c) {
    if (migBlockReason(c)) return;
    if (checked && migLabelOfPath(migTargetPath()) && c.region === migLabelOfPath(migTargetPath())) return;
    MIG_STATE.selected[c.id] = !!checked;
  });
  migRerender();
}
function migRefreshBatchBar() {
  var bar = document.getElementById('migBatchBar');
  if (bar) bar.outerHTML = migBatchBarHtml();
}

/* ---------- 发起迁移 ---------- */
function migOpenSubmitDialog() {
  var ids = migSelectedIds();
  if (!migCanSubmit()) { toast('当前身份不可发起迁移', 'error'); return; }
  if (!ids.length) { toast('请先选择要迁移的报告卡', 'error'); return; }
  var targetPath = migTargetPath();
  if (!targetPath.length) { toast('请先选择目标归属地', 'error'); return; }

  var fromMap = {};
  ids.forEach(function (id) {
    var c = migFindCard(id); if (!c) return;
    fromMap[c.region || '未定位'] = (fromMap[c.region || '未定位'] || 0) + 1;
  });
  var fromHtml = Object.keys(fromMap).map(function (k) {
    return '<div style="display:flex;justify-content:space-between;padding:3px 0"><span>' + k + '</span><b>' + fromMap[k] + ' 张</b></div>';
  }).join('');

  var crossCity = Object.keys(fromMap).some(function (k) {
    return migCityOfPath(migResolveRegion(k)) !== migCityOfPath(targetPath);
  });

  var detail = ids.map(function (id) {
    var c = migFindCard(id); if (!c) return '';
    return '<tr><td class="txt">' + c.id + '</td><td class="txt">' + c.name + '</td><td class="txt">' +
      (c.region || '-') + '</td><td class="txt">' + migLabelOfPath(targetPath) + '</td></tr>';
  }).join('');

  var body =
    '<div class="form-group" style="margin-bottom:10px"><label>源归属地分布</label>' + fromHtml + '</div>' +
    '<div class="form-group" style="margin-bottom:10px"><label>目标归属地</label>' +
    '<div style="font-weight:600;color:var(--primary)">' + migTextOfPath(targetPath) +
    (migCodeOfPath(targetPath) ? '（' + migCodeOfPath(targetPath) + '）' : '（区划码待补）') + '</div></div>' +
    '<div class="form-group" style="margin-bottom:10px"><label>涉及报告卡</label><div><b>' + ids.length + '</b> 张</div></div>' +
    (crossCity ? '<div class="entry-alert" style="margin-bottom:12px"><div class="entry-alert-title">⚠ 跨设区市迁移</div>' +
      '所选卡片跨设区市，本次迁移需 <b>省级登记中心</b> 审批。</div>' : '') +
    '<div class="form-group" style="margin-bottom:10px"><label>迁移原因 <span class="required">*</span></label>' +
    '<select id="migReason" onchange="migToggleNote()">' +
    MIG_REASONS.map(function (r) { return '<option value="' + r.code + '">' + r.label + '</option>'; }).join('') +
    '</select></div>' +
    '<div class="form-group" style="margin-bottom:10px"><label>原因说明 <span class="required">*</span></label>' +
    '<textarea id="migReasonNote" rows="3" placeholder="说明迁移依据，例：患者 2026-09 已迁居，按常住地变更调整归属"></textarea></div>' +
    '<details style="margin-bottom:10px"><summary style="cursor:pointer;color:var(--primary);font-size:13px">展开明细清单（' + ids.length + ' 张）</summary>' +
    '<div class="table-wrap" style="margin-top:8px;max-height:260px;overflow:auto"><table class="data-table" style="margin:0;min-width:520px">' +
    '<thead><tr><th class="txt">报告卡编号</th><th class="txt">姓名</th><th class="txt">当前归属地</th><th class="txt">迁往</th></tr></thead>' +
    '<tbody>' + detail + '</tbody></table></div></details>' +
    '<div style="font-size:12px;color:#94a3b8">提交后进入<b>待审批</b>，审批通过才会真正改写报告卡归属地。</div>';

  migDialog('确认报告卡归属地迁移', body, '提交迁移申请', function (modal) {
    var reason = modal.querySelector('#migReason').value;
    var note = (modal.querySelector('#migReasonNote').value || '').trim();
    if (!note) { toast('请填写迁移原因说明', 'error'); return false; }
    migCreateBatch(ids, targetPath, reason, note);
    return true;
  });
}
function migToggleNote() {
  var sel = document.getElementById('migReason');
  var ta = document.getElementById('migReasonNote');
  if (!sel || !ta) return;
  ta.placeholder = sel.value === 'OTHER'
    ? '选择「其他」时必须说明具体依据'
    : '说明迁移依据，例：患者 2026-09 已迁居，按常住地变更调整归属';
}

function migCreateBatch(ids, targetPath, reasonCode, reasonNote) {
  var now = migNow();
  var items = ids.map(function (id) {
    var c = migFindCard(id);
    return {
      cardId: id, name: c ? c.name : '', idNo: c ? c.idNo : '',
      fromRegion: c ? (c.region || '') : '', toRegion: migLabelOfPath(targetPath)
    };
  });
  var fromRegions = {};
  items.forEach(function (i) { fromRegions[i.fromRegion || '未定位'] = true; });
  var fromCity = migCityOfPath(migResolveRegion(items[0].fromRegion));
  var batch = {
    batchNo: migNextBatchNo(), status: 'pending',
    fromRegion: items.length === 1 ? (items[0].fromRegion || '未定位') : '多归属地',
    toRegion: migLabelOfPath(targetPath),
    fromPath: migResolveRegion(items[0].fromRegion).map(function (n) { return n.label; }),
    toPath: targetPath.map(function (n) { return n.label; }),
    fromCode: migCodeOfPath(migResolveRegion(items[0].fromRegion)),
    toCode: migCodeOfPath(targetPath),
    fromCity: fromCity, toCity: migCityOfPath(targetPath),
    cardIds: ids.slice(), items: items,
    reasonCode: reasonCode, reasonNote: reasonNote,
    operator: MIG_CTX.operator, operateTime: now,
    approver: '', approveTime: '', approveNote: ''
  };
  MIG_BATCHES.unshift(batch);
  MIG_RECORDS.unshift({
    batchNo: batch.batchNo, cardId: '（批次级）', name: '', idNo: '',
    fromRegion: batch.fromRegion, toRegion: batch.toRegion,
    reasonCode: reasonCode, reasonNote: reasonNote,
    operator: MIG_CTX.operator, operateTime: now,
    approver: '', approveTime: '', status: 'pending'
  });
  MIG_STATE.selected = {};
  migRerender();
  toast('迁移申请 ' + batch.batchNo + ' 已提交，等待审批');
}

/* ---------- 审批 / 驳回 / 回退 ---------- */
function migApplyToCards(batchNo, ids, fromRegion, toRegion) {
  var toPath = migResolveRegion(toRegion);
  ids.forEach(function (id) {
    var c = migFindCard(id); if (!c) return;
    c.region = toRegion;
    c.regionPath = toPath.map(function (n) { return n.label; });
    c.regionCode = migCodeOfPath(toPath);
  });
}
function migPushRecords(batchNo, ids, fromRegion, toRegion, reasonCode, reasonNote,
  operator, operateTime, approver, approveTime, status) {
  ids.forEach(function (id) {
    var c = migFindCard(id);
    MIG_RECORDS.unshift({
      batchNo: batchNo, cardId: id, name: c ? c.name : '', idNo: c ? c.idNo : '',
      fromRegion: fromRegion, toRegion: toRegion,
      reasonCode: reasonCode, reasonNote: reasonNote,
      operator: operator, operateTime: operateTime,
      approver: approver || '', approveTime: approveTime || '', status: status
    });
  });
}
function migApproveBatch(batchNo) {
  var b = MIG_BATCHES.find(function (x) { return x.batchNo === batchNo; });
  if (!b) return;
  if (b.status !== 'pending') { toast('该批次不在待审批状态', 'error'); return; }
  if (!migCanApprove()) { toast('当前身份无审批权限', 'error'); return; }
  if (!migApproveScope(b)) {
    toast(MIG_CTX.role === 'CITY' ? '跨设区市迁移需省级登记中心审批' : '当前身份无审批权限', 'error');
    return;
  }
  migDialog('审批通过', '<div>确认通过迁移批次 <b>' + batchNo + '</b>？</div>' +
    '<div style="margin-top:8px">' + b.cardIds.length + ' 张报告卡的归属地将由 <b>' + b.fromRegion +
    '</b> 变更为 <b>' + b.toRegion + '</b>。</div>', '通过并执行', function () {
      var now = migNow();
      migApplyToCards(b.batchNo, b.cardIds, b.fromRegion, b.toRegion);
      migPushRecords(b.batchNo, b.cardIds, b.fromRegion, b.toRegion, b.reasonCode, b.reasonNote,
        b.operator, b.operateTime, MIG_CTX.operator, now, 'executed');
      b.status = 'executed'; b.approver = MIG_CTX.operator; b.approveTime = now; b.approveNote = '同意';
      migRerender();
      toast('批次 ' + batchNo + ' 已审批通过并执行');
    });
}
function migRejectBatch(batchNo) {
  var b = MIG_BATCHES.find(function (x) { return x.batchNo === batchNo; });
  if (!b || b.status !== 'pending') return;
  var body = '<div class="form-group"><label>驳回意见 <span class="required">*</span></label>' +
    '<textarea id="migRejectNote" rows="3" placeholder="说明驳回原因，便于发起人修改后重新提交"></textarea></div>';
  migDialog('驳回迁移申请', body, '确认驳回', function (modal) {
    var note = (modal.querySelector('#migRejectNote').value || '').trim();
    if (!note) { toast('请填写驳回意见', 'error'); return false; }
    var now = migNow();
    b.status = 'rejected'; b.approver = MIG_CTX.operator; b.approveTime = now; b.approveNote = note;
    MIG_RECORDS.forEach(function (r) {
      if (r.batchNo === batchNo && r.status === 'pending') { r.status = 'rejected'; r.approver = MIG_CTX.operator; r.approveTime = now; }
    });
    migRerender();
    toast('批次 ' + batchNo + ' 已驳回');
  });
}
function migRevertBatch(batchNo) {
  var b = MIG_BATCHES.find(function (x) { return x.batchNo === batchNo; });
  if (!b || b.status !== 'executed') return;
  if (!migCanRevert()) { toast('仅省级登记中心可回退迁移批次', 'error'); return; }
  migDialog('回退迁移批次',
    '<div>将把 <b>' + b.cardIds.length + '</b> 张报告卡的归属地从 <b>' + b.toRegion + '</b> 还原为 <b>' + b.fromRegion + '</b>。</div>' +
    '<div style="margin-top:8px;color:var(--danger)">回退会再次改写卡片归属地，并保留完整审计记录。</div>',
    '确认回退', function () {
      var now = migNow();
      var items = b.items || b.cardIds.map(function (id) { return { cardId: id, fromRegion: b.fromRegion }; });
      items.forEach(function (it) {
        var c = migFindCard(it.cardId); if (!c) return;
        c.region = it.fromRegion;
        var p = migResolveRegion(it.fromRegion);
        c.regionPath = p.map(function (n) { return n.label; });
        c.regionCode = migCodeOfPath(p);
      });
      migPushRecords(b.batchNo, b.cardIds, b.toRegion, b.fromRegion, b.reasonCode,
        '批次 ' + batchNo + ' 回退：' + b.reasonNote, b.operator, b.operateTime, MIG_CTX.operator, now, 'reverted');
      b.status = 'reverted';
      b.revertBy = MIG_CTX.operator; b.revertTime = now;
      migRerender();
      toast('批次 ' + batchNo + ' 已回退');
    });
}

/* ---------- 明细与留痕查看 ---------- */
function migShowBatchDetail(batchNo) {
  var b = MIG_BATCHES.find(function (x) { return x.batchNo === batchNo; });
  if (!b) { toast('未找到该批次', 'error'); return; }
  var items = b.items || b.cardIds.map(function (id) {
    return { cardId: id, fromRegion: b.fromRegion, toRegion: b.toRegion };
  });
  var rows = items.map(function (it) {
    return '<tr><td class="txt">' + it.cardId + '</td><td class="txt">' + (it.name || '-') + '</td>' +
      '<td class="txt">' + (it.idNo || '-') + '</td><td class="txt">' + (it.fromRegion || '-') + '</td>' +
      '<td class="txt">' + it.toRegion + '</td></tr>';
  }).join('');
  var body =
    '<div class="form-group" style="margin-bottom:8px"><label>状态</label><span class="badge ' + MIG_STATUS_CLS[b.status] + '">' + MIG_STATUS_TEXT[b.status] + '</span></div>' +
    '<div class="form-group" style="margin-bottom:8px"><label>源 → 目标</label><b>' + b.fromRegion + '</b> → <b>' + b.toRegion + '</b></div>' +
    '<div class="form-group" style="margin-bottom:8px"><label>迁移原因</label>' + migReasonLabel(b.reasonCode) + '：' + b.reasonNote + '</div>' +
    '<div class="form-group" style="margin-bottom:8px"><label>发起 / 审批</label>' + b.operator + '（' + b.operateTime + '） / ' +
    (b.approver ? b.approver + '（' + b.approveTime + '）' : '待审批') +
    (b.approveNote ? ' · ' + b.approveNote : '') + '</div>' +
    '<div class="table-wrap" style="max-height:300px;overflow:auto"><table class="data-table" style="margin:0;min-width:640px">' +
    '<thead><tr><th class="txt">报告卡编号</th><th class="txt">姓名</th><th class="txt">身份证号</th>' +
    '<th class="txt">原归属地</th><th class="txt">新归属地</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  migDialog('迁移批次 ' + batchNo, body, '关闭', function () { return true; });
}

/** 供报告卡详情页挂载：某张卡的归属地变更记录 */
function migRecordsOf(cardId) {
  return MIG_RECORDS.filter(function (r) { return r.cardId === cardId; });
}
/** 供系统审计挂载：全部归属地变更记录 */
function migAuditRows() { return MIG_RECORDS; }

/* ===================== 11. 路由挂载 ===================== */
var MIG_BASE_RENDER_PAGE = renderPage;
renderPage = function (id) {
  if (id !== 'datamgmt-card-migrate') { MIG_BASE_RENDER_PAGE(id); return; }
  var host = document.getElementById('pageContainer');
  if (!host) { MIG_BASE_RENDER_PAGE(id); return; }
  host.innerHTML = renderCardMigrate();
  setActiveMenu('datamgmt-card-migrate');
  updateBreadcrumb('datamgmt-card-migrate', '报告卡迁移');
  if (typeof autoSizeSelects === 'function') autoSizeSelects();
  /* 目标归属地变更后重绘表格：行可行性、目标列、批量条都依赖它 */
  if (typeof onRegionChange === 'function') {
    onRegionChange('migFrom', migRerender);
    onRegionChange('migTo', migRerender);
  }
  /* 日期区间确认后同样要重绘（原有组件只特判了 dr_dedup） */
  if (typeof dateRangeChangeHooks === 'object') dateRangeChangeHooks['dr_migrate'] = migRerender;
};

/* 演示数据延迟到首次渲染迁移页时再灌：此时报告卡数据已就绪，
   「已执行」的历史批次才能真正把归属地落到卡片上，与台账自洽。 */
var MIG_SEEDED = false;
function migEnsureSeeded() {
  if (MIG_SEEDED) return;
  MIG_SEEDED = true;
  migSeed();
}

/* 调试用：window.mig = {MIG_STATE, MIG_BATCHES, MIG_RECORDS, MIG_CTX} */
window.mig = {
  state: MIG_STATE, batches: MIG_BATCHES, records: MIG_RECORDS,
  ctx: MIG_CTX, resolve: migResolveRegion, code: migCodeOfPath
};
