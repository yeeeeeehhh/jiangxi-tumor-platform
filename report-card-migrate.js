/* =========================================================================
   报告卡迁移（report-card-migrate.js）
   -------------------------------------------------------------------------
   用途：批量修改报告卡的「归属地」——即这张卡计入哪个登记处的行政区划辖区。

   入口
     · 侧边栏 报告卡管理 › 报告卡迁移

   关键约定
     1) 报告卡对象上的 region 是扁平串（既有数据形如 '南昌市东湖区'）。本页不改这个格式，
        只在迁移时按目标级联路径重新拼装，保证与存量数据同构、其它模块无感知。
        目标归属地可下钻到「社区」，此时 region 形如 '南昌市东湖区董家窑街道民巷社区'。
     2) 只改归属区划，不改报告单位 / 户籍地址 / 常住地址本体。
     3) 提交即执行：不再走审批流。提交后立即改写卡片归属地，并生成一条批次台账。
   4) 台账是只读审计流水：不提供撤销 / 修正入口，任何操作都不会改写既有记录。
      迁错了的处置是回列表重新勾选这些卡、再走一次普通迁移——把"迁回"当成一次新的正常迁移，
      而不是对历史的撤销。这样台账永远是真实发生过的事件序列，A→B→C 也不会打架。
   5) 报告卡列表里的卡都可迁移，不设前置锁定（合并卡 / 已核对卡一视同仁）。
      归属地是行政判定，不是卡片内容核对结论，锁住会让错挂永久改不了。
   6) 每张卡每次动作都追加一条不可删除的迁移记录。
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
/** 路径 → 卡片 region 字段格式（去掉省名后平铺，与存量数据同构）
    市+区县 → '南昌市东湖区'；下钻到社区 → '南昌市东湖区董家窑街道民巷社区' */
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

/* ===================== 3. 操作人 =====================
   原型没有登录会话，本页也不再做身份分级（迁移不再审批），
   操作人取当前工作台上下文里的机构名，取不到时退回中性文案。 */
function migOperator() {
  try {
    if (typeof wbScenario === 'function') {
      var h = wbScenario().header || {};
      if (h.orgName) return h.orgName;
    }
  } catch (e) { /* 上下文不可用时静默退回 */ }
  try {
    var el = document.getElementById('currentUserName');
    if (el && el.textContent && el.textContent.trim()) return el.textContent.trim();
  } catch (e) { /* 同上 */ }
  return '登记处·操作员';
}

/* ===================== 4. 迁移原因与状态字典 ===================== */
var MIG_REASONS = [
  { code: 'RESIDENCE_MOVE', label: '患者实际迁出本辖区（户籍/常住地变更）' },
  { code: 'DIVISION_ADJUST', label: '行政区划调整（撤县设区、边界重新划定）' },
  { code: 'REGISTRY_REDIVIDE', label: '登记处管辖范围重新划分' },
  { code: 'INIT_ERROR', label: '初始归属错误纠正' },
  { code: 'SOURCE_MISLINK', label: '上报数据错挂纠正' },
  { code: 'CORRECT_PREVIOUS', label: '迁回原归属地（纠正此前迁移）' },
  { code: 'OTHER', label: '其他' }
];
/* 迁移即时生效，批次只有"已执行"这一种状态：台账是只读流水，不存在已回退/已撤销。
   状态既是恒值，就不在表头和明细里单列，也不再维护状态字典。 */
function migReasonLabel(code) {
  for (var i = 0; i < MIG_REASONS.length; i++) if (MIG_REASONS[i].code === code) return MIG_REASONS[i].label;
  return code || '-';
}

/* ===================== 5. 状态与数据 =====================
   筛选项与「批量登记」列表页保持一致：
   过滤行政区划 / 重卡状态 / 校验状态 / 日期类型 / 日期 / 检索内容 */
var MIG_STATE = {
  tab: 'cards',
  /* 批次明细：null = 看台账列表；有值 = 看该批次明细（整页，不弹窗） */
  detailBatchNo: null,
  keyword: '',
  dupStatus: '',                 // '' | 无重卡 | 疑似重卡
  checkStatus: '',               // '' | 通过 | 警告 | 错误
  dateType: '确诊日期',           // 确诊日期 | 报告日期 | 上传日期
  dateStart: '', dateEnd: '',    // 日期区间：必须存状态，否则每次重绘都会被清回空值
  selected: {},
  /* 上次在弹窗里选的目标归属地（到社区五级），连批处理时预填 */
  targetPath: []
};
var MIG_BATCHES = [];
var MIG_RECORDS = [];
var MIG_BATCH_SEQ = 0;

/** 挑一个与来源不同的、且能在区划树上解析到的目标地。
    「从 A 迁往 A」是没有意义的空批次，种子数据必须避开。 */
function migPickTarget(fromRegion) {
  var candidates = ['赣州市章贡区', '南昌市西湖区', '九江市浔阳区', '上饶市信州区', '南昌市东湖区'];
  for (var i = 0; i < candidates.length; i++) {
    if (candidates[i] !== fromRegion && migResolveRegion(candidates[i]).length) return candidates[i];
  }
  return '';
}
/** 按归属地分组，保证种子批次「同批同源」，且尽量覆盖多个区划 */
function migGroupByRegion(cards) {
  var order = [], map = {};
  cards.forEach(function (c) {
    var r = c.region || '未定位';
    if (!map[r]) { map[r] = []; order.push(r); }
    map[r].push(c);
  });
  return order.map(function (r) { return { region: r, cards: map[r] }; });
}

function migBuildBatch(seed) {
  var toPath = migResolveRegion(seed.toRegion);
  var toRegion = seed.toRegion;
  /* 逐卡留存原归属地：台账按卡留痕，不能拿批次级 fromRegion 顶替每张卡的真实原值 */
  var items = seed.cardIds.map(function (id) {
    var c = migFindCard(id);
    return {
      cardId: id, name: c ? c.name : '', idNo: c ? c.idNo : '',
      fromRegion: (c && c.region) || seed.fromRegion || '',
      toRegion: toRegion
    };
  });
  /* 批次级 fromRegion 从 items 汇总，不直接沿用 seed：
     一个批次的卡可能来自多个原归属地，单一字段只能是"占位串"或首个归属地。
     展示一律走 migFromBreakdown()，这里只为兼容旧字段保留一个可读值。 */
  var srcList = [];
  items.forEach(function (it) {
    var r = it.fromRegion || '未定位';
    if (srcList.indexOf(r) < 0) srcList.push(r);
  });
  var fromRegion = srcList.length === 1 ? srcList[0] : (srcList.length + ' 个归属地');
  var fromPath = migResolveRegion(srcList.length === 1 ? srcList[0] : (seed.fromRegion || srcList[0]));
  var fromCities = [];
  items.forEach(function (it) {
    var city = migCityOfPath(migResolveRegion(it.fromRegion)) || '未定位';
    if (fromCities.indexOf(city) < 0) fromCities.push(city);
  });
  return {
    batchNo: seed.batchNo,
    /* seq 是执行先后序号：判断"谁在谁之后"靠它，不靠批次号字符串或时间戳排序 */
    seq: seed.seq || 0,
    status: seed.status,
    fromRegion: fromRegion, toRegion: toRegion,
    fromPath: fromPath.map(function (n) { return n.label; }),
    toPath: toPath.map(function (n) { return n.label; }),
    fromCode: migCodeOfPath(fromPath), toCode: migCodeOfPath(toPath),
    fromCity: fromCities.length === 1 ? fromCities[0] : '多地市',
    toCity: migCityOfPath(toPath),
    cardIds: seed.cardIds.slice(), items: items,
    reasonCode: seed.reasonCode, reasonNote: seed.reasonNote || '',
    operator: seed.operator, operateTime: seed.operateTime,
    revertBy: seed.revertBy || '', revertTime: seed.revertTime || '', revertNote: seed.revertNote || ''
  };
}

/** 演示用历史批次：让批次台账一开页就有内容。
    源归属地一律从卡片实际值分组推导，不硬编码——否则台账里写的「原值」会和卡片对不上。 */
function migSeed() {
  var all = migCards();
  if (!all.length) { MIG_BATCH_SEQ = 0; return; }
  var groups = migGroupByRegion(all);
  var g1 = groups[0], g2 = groups[1] || groups[0], g3 = groups[2] || groups[1] || groups[0];

  var seeds = [
    {
      batchNo: 'MIG-20260920-01', status: 'executed', sameSource: true,
      fromRegion: g1.region, toRegion: migPickTarget(g1.region),
      cardIds: g1.cards.slice(0, 2).map(function (c) { return c.id; }),
      reasonCode: 'REGISTRY_REDIVIDE',
      reasonNote: '部分网格并入邻近辖区，登记处管辖范围重新划分',
      operator: '南昌市登记处·王丽', operateTime: '2026-09-20 10:12:00'
    },
    {
      batchNo: 'MIG-20261005-01', status: 'executed', sameSource: true,
      fromRegion: g2.region, toRegion: migPickTarget(g2.region),
      cardIds: g2.cards.slice(0, 1).map(function (c) { return c.id; }),
      reasonCode: 'RESIDENCE_MOVE',
      reasonNote: '患者 2026-09 已迁居，按常住地变更调整归属',
      operator: '赣州市登记处·李强', operateTime: '2026-10-05 09:05:00'
    },
    {
      /* 这一批刻意做成「多原归属地」：勾选时不要求同源，现实中确实会混着迁，
         台账必须能看出原本各来自哪里、各几张。 */
      batchNo: 'MIG-20261008-01', status: 'executed',
      fromRegion: g3.region, toRegion: migPickTarget(g3.region),
      cardIds: g3.cards.slice(0, 1).map(function (c) { return c.id; })
        .concat(g1.cards.slice(2, 3).map(function (c) { return c.id; })),
      reasonCode: 'INIT_ERROR',
      reasonNote: '区划字典切换后归属错挂，混源批次一并纠正',
      operator: '区县登记处·陈明', operateTime: '2026-10-08 14:20:00'
    }
  ];

  /* 同源校验只对「要求同源」的批次做（seeds 里带 sameSource:true 的）。
     混源批次不能按 seed.fromRegion 过滤，否则第二个来源的卡会被整体丢掉。 */
  var originRegion = {};
  all.forEach(function (c) { originRegion[c.id] = c.region || '未定位'; });
  seeds.forEach(function (seed) {
    if (!seed.sameSource) return;
    seed.cardIds = seed.cardIds.filter(function (id) { return originRegion[id] === seed.fromRegion; });
  });

  MIG_BATCH_SEQ = seeds.length;
  seeds.forEach(function (seed) {
    if (!seed.cardIds.length) return;
    /* 种子批次的 seq 就是它在 seeds 里的先后位置 */
    seed.seq = seed.seq || (MIG_BATCHES.length + 1);
    var batch = migBuildBatch(seed);
    MIG_BATCHES.push(batch);
    migApplyToCards(seed.batchNo, seed.cardIds, batch.fromRegion, batch.toRegion);
    migPushRecords(seed.batchNo, seed.cardIds, batch.fromRegion, batch.toRegion,
      seed.reasonCode, seed.reasonNote, seed.operator, seed.operateTime, 'executed');
  });

  /* 台账按发起时间倒序 */
  MIG_BATCHES.sort(function (x, y) { return y.operateTime < x.operateTime ? -1 : 1; });
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
/** 下一个执行序号：全局单调递增，与批次号里的日期/流水无关，只表示"第几次迁移" */
function migNextSeq() {
  var max = 0;
  MIG_BATCHES.forEach(function (b) { if ((b.seq || 0) > max) max = b.seq || 0; });
  return max + 1;
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

/* ===================== 6. 筛选 =====================
   目标归属地不在筛选区，而是在发起迁移弹窗内选择（见 migOpenSubmitDialog）。

   全部报告卡都可迁移：不再有「合并卡 / 已核对卡」前置锁定。
   归属地是「这张卡计入哪个登记处辖区」的行政判定，不等于卡片内容的核对结论；
   若以核对状态锁死迁移，真实库里绝大多数已核对卡将永远无法纠正错挂。 */
function migFilterPath() { return getRegionSelected('migFrom'); }

/** 卡片关联的上报源数据（用于派生「重卡状态」与「上传日期」） */
function migCardSources(card) {
  var srcs = typeof sourceDataRecords !== 'undefined' ? sourceDataRecords : [];
  return srcs.filter(function (s) { return (s.linkedCards || []).indexOf(card.id) > -1; });
}
function migDupStatus(card) {
  var srcs = migCardSources(card);
  for (var i = 0; i < srcs.length; i++) if (srcs[i].duplicate === '疑似重卡') return '疑似重卡';
  return '无重卡';
}
function migPlainCheckStatus(card) {
  return String(card.checkStatus || '').replace(/<[^>]+>/g, '').trim();
}
/** 日期类型 → 取值。上传日期取自关联的上报源数据，无源数据视为空。 */
function migCardDate(card) {
  if (MIG_STATE.dateType === '上传日期') {
    var s = migCardSources(card)[0];
    return s ? String(s.uploadTime || '').slice(0, 10) : '';
  }
  var f = MIG_STATE.dateType === '确诊日期' ? 'diagnosisDate' : 'reportDate';
  return String(card[f] || '').slice(0, 10);
}
function migVisibleCards() {
  var fromPath = migFilterPath();
  var fromLabels = fromPath.map(function (n) { return n.label; });
  var kw = (MIG_STATE.keyword || '').trim().toLowerCase();
  /* 区间取状态而不是现场读 DOM：重绘后 DOM 里的日期是会丢的 */
  var dr = { start: MIG_STATE.dateStart || '', end: MIG_STATE.dateEnd || '' };
  return migCards().filter(function (card) {
    var path = migCardRegionPath(card).map(function (n) { return n.label; });
    if (fromLabels.length) {
      /* 选了哪一级就按哪一级前缀匹配 */
      var hit = fromLabels.every(function (l, i) { return path[i] === l; });
      if (!hit) return false;
    }
    if (MIG_STATE.dupStatus && migDupStatus(card) !== MIG_STATE.dupStatus) return false;
    if (MIG_STATE.checkStatus && migPlainCheckStatus(card) !== MIG_STATE.checkStatus) return false;
    var d = migCardDate(card);
    if (dr.start && (!d || d < dr.start)) return false;
    if (dr.end && (!d || d > dr.end)) return false;
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

/* ===================== 7. 通用弹窗 ===================== */
function migDialog(title, bodyHtml, okText, onOk) {
  document.querySelectorAll('.mig-modal').forEach(function (m) { m.remove(); });
  var modal = document.createElement('div');
  modal.className = 'news-confirm-modal mig-modal';
  modal.innerHTML =
    '<div class="news-confirm-box" style="width:820px;max-width:94vw">' +
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

/* ===================== 8. 页面渲染 ===================== */
function migTabsHtml() {
  return '<div class="report-data-tabs" role="tablist">' +
    '<button class="report-data-tab ' + (MIG_STATE.tab === 'cards' ? 'active' : '') +
    '" onclick="migSwitchTab(\'cards\')">待迁移报告卡<span class="count">' + migVisibleCards().length + '</span></button>' +
    '<button class="report-data-tab ' + (MIG_STATE.tab === 'batches' ? 'active' : '') +
    '" onclick="migSwitchTab(\'batches\')">迁移批次<span class="count">' + MIG_BATCHES.length +
    '</span></button></div>';
}
function migSwitchTab(tab) { MIG_STATE.tab = tab; MIG_STATE.detailBatchNo = null; migRerender(); }

/* 筛选项与「批量登记」列表页逐项对齐：过滤行政区划 / 重卡状态 / 校验状态 /
   日期类型（确诊·报告·上传）/ 日期 / 检索内容 / 重置。 */
function migFiltersHtml() {
  var dupOpts = ['', '无重卡', '疑似重卡'];
  var chkOpts = ['', '通过', '警告', '错误'];
  var dateTypeOpts = ['确诊日期', '报告日期', '上传日期'];
  return '<div class="filter-toolbar">' +
    '<div class="form-group region-filter"><label>过滤行政区划</label>' + renderRegionCascader('migFrom') + '</div>' +
    '<div class="form-group"><label>重卡状态</label><select onchange="MIG_STATE.dupStatus=this.value;migRerender()">' +
    dupOpts.map(function (o) { return '<option value="' + o + '"' + (MIG_STATE.dupStatus === o ? ' selected' : '') + '>' + (o || '全部') + '</option>'; }).join('') +
    '</select></div>' +
    '<div class="form-group"><label>校验状态</label><select onchange="MIG_STATE.checkStatus=this.value;migRerender()">' +
    chkOpts.map(function (o) { return '<option value="' + o + '"' + (MIG_STATE.checkStatus === o ? ' selected' : '') + '>' + (o || '全部') + '</option>'; }).join('') +
    '</select></div>' +
    '<div class="form-group"><label>日期类型</label><select onchange="MIG_STATE.dateType=this.value;migRerender()">' +
    dateTypeOpts.map(function (o) { return '<option' + (MIG_STATE.dateType === o ? ' selected' : '') + '>' + o + '</option>'; }).join('') +
    '</select></div>' +
    '<div class="form-group date-group"><label>日期</label>' + renderDateRangePicker('dr_migrate', MIG_STATE.dateStart, MIG_STATE.dateEnd) + '</div>' +
    '<div class="form-group search-group"><label>检索内容</label><input type="text" placeholder="报告卡编号 / 姓名 / 身份证号" value="' +
    MIG_STATE.keyword + '" oninput="MIG_STATE.keyword=this.value;migRerender()"></div>' +
    '<div class="filter-actions">' +
    '<button class="btn btn-ghost btn-sm" onclick="migResetFilters()">重置</button>' +
    '</div></div>';
}

function migBatchBarHtml() {
  var n = migSelectedIds().length;
  return '<div class="void-batch-bar" id="migBatchBar">' +
    '<div class="void-batch-info">已勾选 <strong>' + n + '</strong> 张' +
    (n ? '' : ' · <span style="color:#94a3b8">勾选报告卡后发起迁移，提交即生效</span>') +
    '</div>' +
    '<div class="void-batch-actions">' +
    '<button class="btn btn-ghost btn-sm" onclick="migSelectAllRows(false)">清空选择</button>' +
    '<button class="btn btn-primary btn-sm"' + (n ? '' : ' disabled title="请先勾选要迁移的报告卡"') +
    ' onclick="migOpenSubmitDialog()">发起迁移</button>' +
    '</div></div>';
}

/* 表头与「报告卡列表」完全一致（app.html 的 cardCols），一列不多、一列不少。
    归属地不在表头里，「重卡状态」只在筛选区可筛——列表页没有这两列，搬过来就要重新认列。
    迁移前后的归属地写在「报告卡编号」格下方（见 migCardRowCells 的 trail 参数）。 */
var MIG_CARD_COLS = ['报告卡编号', '姓名', '身份证号码', '性别', '年龄', '出生日期', '发病部位', 'ICD10',
  '确诊日期', '最后接触状态', '最后接触时间', '报告单位', '来源类型', '上传日期', '校验状态', '报告卡类型'];

/* 批次明细页的列集：与报告卡列表完全一致（当前不留任何隐藏列）。
   保留这个开关而不是直接删掉，是为了以后真要临时隐藏某列时只改这里一处，
   不必再去动表头与行两边的渲染逻辑。 */
var MIG_DETAIL_HIDDEN_COLS = [];
function migDetailCols() {
  return MIG_CARD_COLS.filter(function (h) { return MIG_DETAIL_HIDDEN_COLS.indexOf(h) < 0; });
}

/* 按列名取单元格内容：表头由列名数组生成，行也按同一数组取值，
   增删列时表头与行不可能错位（手写 td 序列才容易对不上）。 */
function migCellHtml(col, c, opts) {
  c = c || {};
  opts = opts || {};
  var cardId = c.id || opts.cardId || '';
  var follow = (window.reportCardFollowup || {})[cardId] || {};
  var source = migCardSources(c)[0];
  switch (col) {
    case '报告卡编号':
      var seq = migCards().filter(function (r) { return r.idNo === c.idNo; })
        .findIndex(function (r) { return r.id === cardId; }) + 1;
      var trail = opts.trail
        ? '<div style="color:#94a3b8;font-size:12px;line-height:1.5;white-space:normal">' + opts.trail + '</div>' : '';
      return '<td><a href="javascript:void(0)" style="color:var(--primary)" onclick="cardListDetail(\'' + cardId + '\')">' +
        cardId + '</a><span style="color:#94a3b8;font-size:12px;margin-left:2px" title="多原发序号">（' + seq + '）</span>' + trail + '</td>';
    case '姓名': return '<td>' + (c.name || opts.name || '-') + '</td>';
    case '身份证号码': return '<td>' + (c.idNo || opts.idNo || '-') + '</td>';
    case '性别': return '<td>' + (c.sex || '-') + '</td>';
    case '年龄':
      var age = c.birth ? Math.floor((new Date() - new Date(c.birth)) / (365.25 * 24 * 3600 * 1000)) : '-';
      return '<td>' + age + '</td>';
    case '出生日期': return '<td>' + (c.birth || '-') + '</td>';
    case '发病部位': return '<td>' + (c.site || '-') + '</td>';
    case 'ICD10': return '<td>' + (c.icd10 || '-') + '</td>';
    case '确诊日期': return '<td>' + (c.diagnosisDate || '-') + '</td>';
    case '最后接触状态': return '<td>' + (follow.state || '-') + '</td>';
    case '最后接触时间': return '<td>' + (follow.dlc || '-') + '</td>';
    case '报告单位': return '<td>' + (c.reportUnit || '-') + '</td>';
    case '来源类型': return '<td>' + (source ? source.sourceType : '手工登记') + '</td>';
    case '上传日期': return '<td>' + (source ? String(source.uploadTime || '').slice(0, 10) : '-') + '</td>';
    case '校验状态': return '<td>' + (c.checkStatus || '-') + '</td>';
    case '报告卡类型': return '<td>' + (c.cardType || '-') + '</td>';
  }
  return '<td>-</td>';
}

/* 列表页一行：MIG_CARD_COLS 全列。
   opts（可选）：{ cardId, name, idNo, trail }
     · cardId/name/idNo 在卡片已不在库（迁移后作废等）时作兜底
     · trail 是附在「报告卡编号」单元格下方的补充行 */
function migCardRowCells(c, opts) {
  return MIG_CARD_COLS.map(function (h) { return migCellHtml(h, c, opts); }).join('');
}

function migCardsTableHtml() {
  var rows = migVisibleCards();
  if (!rows.length) {
    return '<div style="padding:36px;text-align:center;color:#94a3b8">当前筛选条件下没有报告卡</div>';
  }
  var body = rows.map(function (c) {
    var checked = MIG_STATE.selected[c.id] ? ' checked' : '';
    return '<tr>' +
      '<td><input type="checkbox" class="mig-card-check" data-id="' + c.id + '"' + checked +
      ' onchange="migOnCardCheck(this)" style="cursor:pointer"></td>' +
      migCardRowCells(c) +
      '</tr>';
  }).join('');

  return '<div style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;margin-bottom:12px"><div class="table-wrap">' +
    '<table class="data-table" style="margin:0;min-width:1900px"><thead><tr>' +
    '<th style="width:36px"><input type="checkbox" onchange="migSelectAllRows(this.checked)" style="cursor:pointer"></th>' +
    MIG_CARD_COLS.map(function (h) { return '<th>' + h + '</th>'; }).join('') +
    '</tr></thead><tbody>' + body + '</tbody></table></div></div>';
}

/* 一个批次里的卡可能来自多个原归属地（勾选时并不要求同源），
   所以「原归属地」不能是一个字符串。这里按 items 逐卡汇总成「归属地 + 张数」列表。
   注意不能用 b.fromRegion：多源时它只是一个"N 个归属地"的占位串。 */
function migFromBreakdown(b) {
  var items = b.items && b.items.length ? b.items : b.cardIds.map(function (id) {
    return { cardId: id, fromRegion: b.fromRegion };
  });
  var order = [], map = {};
  items.forEach(function (it) {
    var r = it.fromRegion || '未定位';
    if (!map[r]) { map[r] = 0; order.push(r); }
    map[r] += 1;
  });
  return order.map(function (r) { return { region: r, count: map[r] }; });
}

function migBatchesTableHtml() {
  if (!MIG_BATCHES.length) {
    return '<div style="padding:36px;text-align:center;color:#94a3b8">暂无迁移批次</div>';
  }
  var rows = MIG_BATCHES.map(function (b) {
    /* 台账只读：操作列只留「查看明细」，不提供撤销 / 修正 / 导出 */
    var ops = ['<button class="btn btn-ghost btn-xs" onclick="migOpenBatchDetail(\'' + b.batchNo + '\')">查看明细</button>'];
    var crossCity = b.fromCity && b.toCity && b.fromCity !== b.toCity;
    /* 固定列宽下不裁剪的话，长文本会直接压到相邻列上 */
    var cut = ' style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap"';

    /* 原归属地：固定单行，行高不撑大。
       · 1 个来源：直接写归属地
       · 2 个来源：两个都写，顿号分隔
       · 3 个及以上：写「首个 + 等 N 个归属地」，鼠标悬浮弹出完整清单
    */
    var src = migFromBreakdown(b);
    var srcTitle = src.map(function (x) { return x.region + ' ' + x.count + ' 张'; }).join('、');
    var srcHtml, srcCellAttr;
    if (!src.length) {
      srcHtml = '-';
      srcCellAttr = cut + ' title="-"';
    } else if (src.length <= 2) {
      srcHtml = src.map(function (x) { return x.region; }).join('、');
      srcCellAttr = cut + ' title="' + srcTitle + '"';
    } else {
      /* 多源：单元格里不塞 title（原生提示慢、样式也差），改用自定义悬浮卡片 */
      srcHtml = src[0].region + '<span style="color:#94a3b8"> 等 ' + src.length + ' 个归属地</span>';
      srcCellAttr = cut + ' data-mig-src="' + encodeURIComponent(JSON.stringify(src)) + '"' +
        ' onmouseenter="migSrcTipShow(event,this)" onmouseleave="migSrcTipHide()" style="cursor:help"';
    }

    return '<tr>' +
      '<td class="txt"' + cut + '><a href="javascript:void(0)" style="color:var(--primary)" onclick="migOpenBatchDetail(\'' + b.batchNo + '\')">' + b.batchNo + '</a></td>' +
      '<td class="txt"' + srcCellAttr + '>' + srcHtml + '</td>' +
      '<td class="txt"' + cut + ' title="' + b.toRegion + '">' + b.toRegion + (crossCity ? ' <span class="badge badge-warning">跨市</span>' : '') + '</td>' +
      '<td class="num">' + b.cardIds.length + '</td>' +
      '<td class="txt"' + cut + ' title="' + migReasonLabel(b.reasonCode) + '">' + migReasonLabel(b.reasonCode) + '</td>' +
      '<td class="txt"' + cut + ' title="' + b.operator + '">' + b.operator + '</td>' +
      '<td class="code"' + cut + '>' + b.operateTime + '</td>' +
      '<td class="ops sticky-col">' + ops.join(' ') + '</td>' +
      '</tr>';
  }).join('');
  /* 状态列已去掉：批次只有"已执行"一种状态，这一列全是同值，白占宽度 */
  return '<div style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden"><div class="table-wrap">' +
    /* 原归属地列放 260px：要容得下「A 等 N 个归属地」这种最长文案，否则会被省略号截断；
       操作列只剩「查看明细」一个按钮，宽度相应收到 120px */
    '<table class="data-table" style="margin:0;min-width:1250px;table-layout:fixed;width:100%"><colgroup>' +
    '<col style="width:140px"><col style="width:260px"><col style="width:200px"><col style="width:40px">' +
    '<col style="width:160px"><col style="width:160px"><col style="width:150px">' +
    '<col style="width:120px">' +
    '</colgroup><thead><tr>' +
    '<th class="txt">批次号</th><th class="txt">原归属地</th><th class="txt">新归属地</th>' +
    '<th class="num">卡数</th><th class="txt">迁移原因</th><th class="txt">发起人</th>' +
    '<th class="code">发起时间</th>' +
    '<th class="ops sticky-col">操作</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
}

function renderCardMigrate() {
  migEnsureSeeded();
  /* 明细是整页视图：进来时不挂页签与台账列表，只留返回按钮 */
  if (MIG_STATE.detailBatchNo) return migBatchDetailHtml();
  if (MIG_STATE.tab === 'batches') {
    return migTabsHtml() +
      '<div class="panel"><div class="panel-body">' +
      '<div style="margin-bottom:10px;color:#667085;font-size:13px">共 ' + MIG_BATCHES.length +
      ' 个迁移批次（只读记录）。迁错了请回列表重新勾选这些卡、再走一次迁移。</div>' +
      migBatchesTableHtml() +
      '</div></div>';
  }

  var rows = migVisibleCards();
  return migTabsHtml() +
    '<div class="panel"><div class="panel-body">' +
    migFiltersHtml() +
    '<div style="margin:4px 0 12px;color:#667085;font-size:13px">共 ' + rows.length + ' 张报告卡</div>' +
    migBatchBarHtml() +
    migCardsTableHtml() +
    '<div class="void-pagination"><div class="void-pagination-info">共 ' + rows.length + ' 条记录，第1/1页</div>' +
    '<div class="void-pagination-controls"><button onclick="toast(\'已是第一页\')">‹</button>' +
    '<input type="text" value="1" readonly><button onclick="toast(\'已是最后一页\')">›</button></div></div>' +
    '</div></div>';
}

/* ===================== 9. 交互动作 ===================== */
/* 重绘统一走这里。明细表很长，切进切出必须回到页顶，否则会停在上一页的滚动位置。 */
function migRerender() {
  /* 浮层挂在 body 上、不随页面重绘消失，重绘前必须先清掉，否则会留下一张孤儿卡片 */
  if (typeof migSrcTipHide === 'function') migSrcTipHide();
  renderPage('datamgmt-card-migrate');
  var mc = document.getElementById('mainContent');
  if (mc) mc.scrollTop = 0;
  window.scrollTo(0, 0);
}
function migResetFilters() {
  MIG_STATE.keyword = '';
  MIG_STATE.dupStatus = '';
  MIG_STATE.checkStatus = '';
  MIG_STATE.dateType = '确诊日期';
  MIG_STATE.dateStart = '';
  MIG_STATE.dateEnd = '';
  MIG_STATE.selected = {};
  resetRegionSelected('migFrom');
  migRerender();
}
function migOnCardCheck(box) {
  MIG_STATE.selected[box.getAttribute('data-id')] = box.checked;
  migRefreshBatchBar();
}
function migSelectAllRows(checked) {
  migVisibleCards().forEach(function (c) { MIG_STATE.selected[c.id] = !!checked; });
  migRerender();
}
function migRefreshBatchBar() {
  var bar = document.getElementById('migBatchBar');
  if (bar) bar.outerHTML = migBatchBarHtml();
}

/* ---------- 发起迁移 ---------- */

/* 目标归属地：设区市 → 区县 → 街道 → 社区 四级联动。
   用原生下拉而不用级联组件，是因为 .news-confirm-box 是 overflow:hidden，级联面板会被裁掉。
   设区市与区县必选，街道 / 社区可继续下钻——要精确到社区就一路选下去。 */
function migProvinceNode() { return (typeof regionData !== 'undefined' ? regionData : [])[0] || null; }
function migCityNodes() { var p = migProvinceNode(); return p && p.children ? p.children : []; }
function migChildNode(nodes, label) {
  if (!label) return null;
  return (nodes || []).find(function (n) { return n.label === label || n.value === label; }) || null;
}
function migDistNodes(city) { var n = migChildNode(migCityNodes(), city); return n && n.children ? n.children : []; }
function migStreetNodes(city, dist) { var n = migChildNode(migDistNodes(city), dist); return n && n.children ? n.children : []; }
function migCommNodes(city, dist, street) { var n = migChildNode(migStreetNodes(city, dist), street); return n && n.children ? n.children : []; }

function migOptionsHtml(nodes, placeholder, sel) {
  return '<option value="">' + placeholder + '</option>' + (nodes || []).map(function (n) {
    return '<option value="' + n.label + '"' + (sel === n.label ? ' selected' : '') + '>' + n.label + '</option>';
  }).join('');
}
function migDialogTargetPath(modal) {
  var city = modal.querySelector('#migTgtCity').value;
  var dist = modal.querySelector('#migTgtDist').value;
  var street = modal.querySelector('#migTgtStreet').value;
  var comm = modal.querySelector('#migTgtComm').value;
  if (!city || !dist) return [];
  var prov = migProvinceNode();
  var cityNode = migChildNode(migCityNodes(), city);
  var distNode = migChildNode(migDistNodes(city), dist);
  if (!prov || !cityNode || !distNode) return [];
  var path = [prov, cityNode, distNode];
  var streetNode = street ? migChildNode(migStreetNodes(city, dist), street) : null;
  if (streetNode) path.push(streetNode);
  var commNode = (streetNode && comm) ? migChildNode(migCommNodes(city, dist, street), comm) : null;
  if (commNode) path.push(commNode);
  return path;
}

/** 目标地一变，下级下拉、区划码、「N 张已是该归属地」的卡数都要跟着变。
    每一级重建选项时必须保留「本级当前选中值」，否则选了社区会被自己的 change 事件清掉。 */
function migOnDialogTargetChange() {
  var modal = document.querySelector('.mig-modal');
  if (!modal) return;
  var citySel = modal.querySelector('#migTgtCity');
  var distSel = modal.querySelector('#migTgtDist');
  var streetSel = modal.querySelector('#migTgtStreet');
  var commSel = modal.querySelector('#migTgtComm');
  if (!citySel || !distSel || !streetSel || !commSel) return;

  var prev = {
    city: modal.dataset.tgtCity || '',
    dist: modal.dataset.tgtDist || '',
    street: modal.dataset.tgtStreet || ''
  };
  var city = citySel.value, dist = distSel.value, street = streetSel.value, comm = commSel.value;
  /* 上级变了才清空下级：避免出现「九江市 / 东湖区」这种跨市错配 */
  if (city !== prev.city) { dist = ''; street = ''; comm = ''; }
  else if (dist !== prev.dist) { street = ''; comm = ''; }
  else if (street !== prev.street) { comm = ''; }

  distSel.innerHTML = migOptionsHtml(migDistNodes(city), city ? '请选择区县' : '请先选择设区市', dist);
  streetSel.innerHTML = migOptionsHtml(migStreetNodes(city, dist), dist ? '请选择街道（可选）' : '请先选择区县', street);
  commSel.innerHTML = migOptionsHtml(migCommNodes(city, dist, street), street ? '请选择社区（可选）' : '请先选择街道', comm);
  /* innerHTML 重建后 value 会丢，显式回写一次 */
  distSel.value = dist; streetSel.value = street; commSel.value = comm;

  modal.dataset.tgtCity = city;
  modal.dataset.tgtDist = dist;
  modal.dataset.tgtStreet = street;

  var path = migDialogTargetPath(modal);
  MIG_STATE.targetPath = path;
  var ids = (modal.dataset.ids || '').split(',').filter(Boolean);
  var hint = modal.querySelector('#migTargetHint');

  if (!path.length) {
    if (hint) hint.innerHTML = '<div style="font-size:12px;color:#94a3b8;margin-bottom:12px">至少选到「设区市 + 区县」；需要精确到社区时继续选择街道与社区。</div>';
    return;
  }
  var label = migLabelOfPath(path);
  var code = migCodeOfPath(path);
  var sameCount = ids.filter(function (id) { var c = migFindCard(id); return c && c.region === label; }).length;
  var html = '<div style="font-size:13px;margin-bottom:8px">将迁移到 <strong style="color:var(--primary)">' +
    migTextOfPath(path) + '</strong>' +
    (code ? ' <span class="badge badge-muted">' + code + '</span>' : ' <span class="badge badge-muted">区划码待补</span>') +
    '<span style="color:#94a3b8;margin-left:6px">（' + path.length + ' 级' +
    (path.length >= 5 ? '，已精确到社区' : '，可继续下钻到社区') + '）</span></div>';
  if (sameCount) {
    html += '<div class="entry-alert" style="margin-bottom:10px"><div class="entry-alert-title">⚠ ' + sameCount + ' 张已是该归属地</div>' +
      '这 ' + sameCount + ' 张报告卡的当前归属地与目标一致，提交时会自动跳过。</div>';
  }
  if (hint) hint.innerHTML = html;
}

function migOpenSubmitDialog() {
  var ids = migSelectedIds();
  if (!ids.length) { toast('请先勾选要迁移的报告卡', 'error'); return; }

  /* 沿用上次选的目标地，连批处理时不用每次重选 */
  var prev = MIG_STATE.targetPath || [];
  var prevCity = prev.length > 1 ? prev[1].label : '';
  var prevDist = prev.length > 2 ? prev[2].label : '';
  var prevStreet = prev.length > 3 ? prev[3].label : '';
  var prevComm = prev.length > 4 ? prev[4].label : '';

  var body =
    '<div class="form-group" style="margin-bottom:12px"><label>目标归属地 <span class="required">*</span></label>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
    '<select id="migTgtCity" onchange="migOnDialogTargetChange()" style="flex:1;min-width:150px">' +
    migOptionsHtml(migCityNodes(), '请选择设区市', prevCity) + '</select>' +
    '<select id="migTgtDist" onchange="migOnDialogTargetChange()" style="flex:1;min-width:150px">' +
    migOptionsHtml(migDistNodes(prevCity), prevCity ? '请选择区县' : '请先选择设区市', prevDist) + '</select>' +
    '<select id="migTgtStreet" onchange="migOnDialogTargetChange()" style="flex:1;min-width:150px">' +
    migOptionsHtml(migStreetNodes(prevCity, prevDist), prevDist ? '请选择街道（可选）' : '请先选择区县', prevStreet) + '</select>' +
    '<select id="migTgtComm" onchange="migOnDialogTargetChange()" style="flex:1;min-width:150px">' +
    migOptionsHtml(migCommNodes(prevCity, prevDist, prevStreet), prevStreet ? '请选择社区（可选）' : '请先选择街道', prevComm) + '</select>' +
    '</div></div>' +
    '<div id="migTargetHint" style="margin-bottom:12px"></div>' +
    '<div class="form-group" style="margin-bottom:10px"><label>迁移原因 <span class="required">*</span></label>' +
    '<select id="migReason" onchange="migToggleNote()">' +
    MIG_REASONS.map(function (r) { return '<option value="' + r.code + '">' + r.label + '</option>'; }).join('') +
    '</select></div>' +
    '<div class="form-group" style="margin-bottom:10px"><label>原因说明 <span class="required">*</span></label>' +
    '<textarea id="migReasonNote" rows="3" placeholder="说明迁移依据，例：患者 2026-09 已迁居，按常住地变更调整归属"></textarea></div>' +
    '<div style="font-size:12px;color:#94a3b8">提交后<b>立即生效</b>并改写报告卡归属地，本次操作将记入迁移批次台账。</div>';

  var modal = migDialog('确认报告卡归属地迁移', body, '提交并执行', function (m) {
    var path = migDialogTargetPath(m);
    if (!path.length) { toast('请选择目标归属地（至少选到设区市 + 区县）', 'error'); return false; }
    var reason = m.querySelector('#migReason').value;
    var note = (m.querySelector('#migReasonNote').value || '').trim();
    if (!note) { toast('请填写迁移原因说明', 'error'); return false; }
    var label = migLabelOfPath(path);
    var real = ids.filter(function (id) { var c = migFindCard(id); return c && c.region !== label; });
    if (!real.length) { toast('所选报告卡的当前归属地已等于目标归属地，无需迁移', 'error'); return false; }
    migCreateBatch(real, path, reason, note, ids.length - real.length);
    return true;
  });
  modal.dataset.ids = ids.join(',');
  modal.dataset.tgtCity = prevCity;
  modal.dataset.tgtDist = prevDist;
  modal.dataset.tgtStreet = prevStreet;
  migOnDialogTargetChange();
}
function migToggleNote() {
  var sel = document.getElementById('migReason');
  var ta = document.getElementById('migReasonNote');
  if (!sel || !ta) return;
  ta.placeholder = sel.value === 'OTHER'
    ? '选择「其他」时必须说明具体依据'
    : '说明迁移依据，例：患者 2026-09 已迁居，按常住地变更调整归属';
}

/** 提交即执行：生成批次 → 立即改写卡片归属地 → 写留痕 */
function migCreateBatch(ids, targetPath, reasonCode, reasonNote, skipped) {
  var now = migNow();
  var toRegion = migLabelOfPath(targetPath);
  var operator = migOperator();
  /* 统一走 migBuildBatch：批次级原归属地汇总、fromPath、fromCity 等派生字段
     只在一个地方算，避免提交路径与种子路径各算一套导致口径不一致。 */
  var batch = migBuildBatch({
    batchNo: migNextBatchNo(),
    seq: migNextSeq(),
    status: 'executed',
    fromRegion: '',            // 由 items 汇总，占位
    toRegion: toRegion,
    cardIds: ids.slice(),
    reasonCode: reasonCode, reasonNote: reasonNote,
    operator: operator, operateTime: now
  });
  MIG_BATCHES.unshift(batch);
  migApplyToCards(batch.batchNo, ids, batch.fromRegion, toRegion);
  migPushRecords(batch.batchNo, ids, batch.fromRegion, toRegion, reasonCode, reasonNote,
    operator, now, 'executed');
  MIG_STATE.selected = {};
  migRerender();
  toast('迁移批次 ' + batch.batchNo + ' 已提交并执行，' + ids.length + ' 张报告卡归属地已更新' +
    (skipped ? '（已跳过 ' + skipped + ' 张：当前归属地与目标一致）' : ''));
}

/* ---------- 原归属地悬浮清单 ----------
   台账的表格容器是 .table-wrap{overflow:auto}，用 CSS absolute 定位的浮层会被容器裁掉，
   所以这里用 position:fixed 按鼠标位置贴一张卡片，并把卡片挂到 body 上，避免被裁剪。 */
function migSrcTipShow(ev, cell) {
  migSrcTipHide();
  var raw = cell.getAttribute('data-mig-src');
  if (!raw) return;
  var list;
  try { list = JSON.parse(decodeURIComponent(raw)); } catch (e) { return; }
  if (!list || !list.length) return;

  var tip = document.createElement('div');
  tip.className = 'mig-src-tip';
  tip.style.cssText = 'position:fixed;z-index:9999;pointer-events:none;background:#fff;border:1px solid #d7e0ea;' +
    'border-radius:6px;box-shadow:0 8px 24px rgba(15,23,42,.16);padding:8px 10px;font-size:12px;color:#334155;' +
    'line-height:1.7;min-width:180px;max-width:320px';
  tip.innerHTML = '<div style="font-weight:600;color:#476079;margin-bottom:4px">原归属地（' + list.length + ' 个）</div>' +
    list.map(function (x) {
      return '<div style="display:flex;justify-content:space-between;gap:14px">' +
        '<span>' + x.region + '</span>' +
        '<span style="color:#94a3b8;flex:0 0 auto">' + x.count + ' 张</span></div>';
    }).join('');
  document.body.appendChild(tip);

  /* 贴着单元格右下，超出视口就翻到上方/左侧 */
  var r = cell.getBoundingClientRect();
  var tw = tip.offsetWidth, th = tip.offsetHeight;
  var left = r.left;
  if (left + tw > window.innerWidth - 8) left = Math.max(8, window.innerWidth - tw - 8);
  var top = r.bottom + 6;
  if (top + th > window.innerHeight - 8) top = Math.max(8, r.top - th - 6);
  tip.style.left = left + 'px';
  tip.style.top = top + 'px';
}
function migSrcTipHide() {
  document.querySelectorAll('.mig-src-tip').forEach(function (n) { n.remove(); });
}

/* ---------- 明细与留痕查看 ----------
   批次明细走「整页视图」而不是弹窗：一个批次可能有几十上百张卡，
   弹窗里塞滚动表格既看不清也不好比对。与「上报数据详情」同一套做法——
   进详情隐藏页签与列表，顶部给返回按钮。 */
function migOpenBatchDetail(batchNo) {
  MIG_STATE.detailBatchNo = batchNo;
  migRerender();
}
function migBackToBatchList() {
  MIG_STATE.detailBatchNo = null;
  migRerender();
}

/* 批次明细的逐卡完整清单：每张卡的归属地变更前后、当前卡片状态、操作留痕 */
function migBatchDetailHtml() {
  var b = MIG_BATCHES.find(function (x) { return x.batchNo === MIG_STATE.detailBatchNo; });
  if (!b) {
    return '<div class="panel"><div class="panel-body"><div style="padding:36px;text-align:center;color:#94a3b8">未找到该批次</div></div></div>';
  }
  var items = b.items && b.items.length ? b.items : b.cardIds.map(function (id) {
    return { cardId: id, fromRegion: b.fromRegion, toRegion: b.toRegion };
  });
  /* 每张卡是否还停在"本批次迁往的归属地"：不在就说明此后又被迁过 */
  function currentOf(cardId) {
    var c = migFindCard(cardId);
    return c ? (c.region || '未定位') : '卡片已不存在';
  }
  var driftedCount = items.filter(function (it) { return currentOf(it.cardId) !== b.toRegion; }).length;

  /* 明细页列集与报告卡列表完全一致（MIG_DETAIL_HIDDEN_COLS 当前为空）。
     表头与行都按同一个数组生成，不会错位。 */
  var cols = migDetailCols();

  var rows = items.map(function (it) {
    var c = migFindCard(it.cardId) || {};
    var before = it.fromRegion || '-';
    var after = it.toRegion || '-';
    /* 迁移前/后归属地作为「报告卡编号」单元格的第二行，不单开列 */
    var trail = '迁移前 ' + before + ' · 迁移后 ' + after;
    var opts = { cardId: it.cardId, name: it.name, idNo: it.idNo, trail: trail };
    return '<tr>' + cols.map(function (h) { return migCellHtml(h, c, opts); }).join('') + '</tr>';
  }).join('');

  var topbar =
    '<div class="src-detail-topbar"><div class="src-detail-topbar-main">' +
      '<div class="src-detail-title">迁移批次明细</div>' +
      '<div class="src-detail-topbar-meta">' +
        '<span class="src-chip accent">' + b.batchNo + '</span>' +
        /* 多源时不能直接写 b.fromRegion（那是"N 个归属地"占位串），按汇总结果展示 */
        '<span class="src-chip">' +
          (migFromBreakdown(b).length <= 1
            ? (migFromBreakdown(b).length ? migFromBreakdown(b)[0].region : '-')
            : migFromBreakdown(b).length + ' 个原归属地') +
          ' → ' + b.toRegion + '</span>' +
        '<span class="src-chip">' + b.cardIds.length + ' 张</span>' +
        (driftedCount
          ? '<span class="src-chip">' + driftedCount + ' 张此后已再次迁移</span>'
          : '<span class="src-chip">全部仍在新归属地</span>') +
      '</div>' +
    '</div><div class="src-detail-actions">' +
      '<button class="btn btn-ghost btn-sm" onclick="migBackToBatchList()">返回迁移批次</button>' +
      '<button class="btn btn-outline btn-sm" onclick="toast(\'导出Excel中...\')">导出Excel</button>' +
    '</div></div>';

  /* 批次级信息：发起 / 原因。与逐卡清单分开，避免每行重复同一句话。 */
  var info =
    '<div class="panel" style="margin-bottom:14px"><div class="panel-body">' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px 20px">' +
      '<div><div style="font-size:12px;color:#94a3b8;margin-bottom:4px">迁移原因</div>' +
        '<div style="font-size:13px">' + migReasonLabel(b.reasonCode) + '</div></div>' +
      '<div><div style="font-size:12px;color:#94a3b8;margin-bottom:4px">原因说明</div>' +
        '<div style="font-size:13px">' + (b.reasonNote || '-') + '</div></div>' +
      '<div><div style="font-size:12px;color:#94a3b8;margin-bottom:4px">发起</div>' +
        '<div style="font-size:13px">' + b.operator + '（' + b.operateTime + '）</div></div>' +
    '</div></div></div>';

  var table =
    '<div class="panel"><div class="panel-body">' +
    '<div style="margin-bottom:10px;color:#667085;font-size:13px">共 ' + items.length +
    ' 张报告卡的完整迁移清单（表头与报告卡列表完全一致；每张卡的迁移前后归属地见报告卡编号下方）</div>' +
    '<div class="table-wrap"><table class="data-table" style="margin:0;min-width:1900px"><thead><tr>' +
    cols.map(function (h) { return '<th>' + h + '</th>'; }).join('') +
    '</tr></thead><tbody>' +
    (rows || '<tr><td colspan="' + cols.length + '" style="text-align:center;padding:36px;color:#98a2b3">该批次没有报告卡</td></tr>') +
    '</tbody></table></div></div></div>';

  return '<div class="src-detail">' + topbar + info + table + '</div>';
}

/** 供报告卡详情页挂载：某张卡的归属地变更记录 */
function migRecordsOf(cardId) {
  return MIG_RECORDS.filter(function (r) { return r.cardId === cardId; });
}
/** 供系统审计挂载：全部归属地变更记录 */
function migAuditRows() { return MIG_RECORDS; }

/* ===================== 10. 迁移落卡与留痕 =====================
   原型的报告卡数据是模块级字面量：renderReportCardList() 每渲染一次就整体重建，
   直接改 card.region 会在「报告卡列表」下次渲染时丢失（用户迁移完切回去发现没变）。
   所以迁移结果另存一份覆盖层，每次卡片数据重建后重放。
   接入真实后端后这层可以整个删掉，数据由服务端返回。 */
var MIG_REGION_OVERRIDE = {};
function migReapplyOverrides() {
  var ids = Object.keys(MIG_REGION_OVERRIDE);
  if (!ids.length) return;
  var list = window.reportCardListData || [];
  ids.forEach(function (id) {
    var c = list.find(function (x) { return x.id === id; });
    if (!c) return;
    var o = MIG_REGION_OVERRIDE[id];
    c.region = o.region;
    c.regionPath = o.path;
    c.regionCode = o.code;
  });
}
function migSetOverride(cardId, region) {
  var p = migResolveRegion(region);
  MIG_REGION_OVERRIDE[cardId] = {
    region: region,
    path: p.map(function (n) { return n.label; }),
    code: migCodeOfPath(p)
  };
}

function migApplyToCards(batchNo, ids, fromRegion, toRegion) {
  var toPath = migResolveRegion(toRegion);
  ids.forEach(function (id) {
    var c = migFindCard(id); if (!c) return;
    c.region = toRegion;
    c.regionPath = toPath.map(function (n) { return n.label; });
    c.regionCode = migCodeOfPath(toPath);
    migSetOverride(id, toRegion);
  });
}
function migPushRecords(batchNo, ids, fromRegion, toRegion, reasonCode, reasonNote,
  operator, operateTime, status) {
  ids.forEach(function (id) {
    var c = migFindCard(id);
    MIG_RECORDS.unshift({
      batchNo: batchNo, cardId: id, name: c ? c.name : '', idNo: c ? c.idNo : '',
      fromRegion: fromRegion, toRegion: toRegion,
      reasonCode: reasonCode, reasonNote: reasonNote,
      operator: operator, operateTime: operateTime,
      status: status
    });
  });
}

/* ===================== 12. 路由挂载 ===================== */

/* 日期区间确认后先落进 MIG_STATE 再重绘：内置的 confirmDateRangePicker 只负责改 DOM
   并触发 dateRangeChangeHooks，DOM 在重绘后即被丢弃，不存状态则筛选永远为空。 */
function migDateRangeChange() {
  var dr = typeof getDateRangeValue === 'function' ? getDateRangeValue('dr_migrate') : { start: '', end: '' };
  MIG_STATE.dateStart = dr.start;
  MIG_STATE.dateEnd = dr.end;
  migRerender();
}

/* 报告卡列表每次渲染都会重建卡片数据 → 渲染后重放迁移覆盖层，否则迁移结果会被冲掉 */
var MIG_BASE_RENDER_CARD_LIST = renderReportCardList;
renderReportCardList = function () {
  var r = MIG_BASE_RENDER_CARD_LIST.apply(this, arguments);
  migReapplyOverrides();
  return r;
};

var MIG_BASE_RENDER_PAGE = renderPage;
renderPage = function (id) {
  if (id !== 'datamgmt-card-migrate') { MIG_BASE_RENDER_PAGE(id); return; }
  var host = document.getElementById('pageContainer');
  if (!host) { MIG_BASE_RENDER_PAGE(id); return; }
  host.innerHTML = renderCardMigrate();
  setActiveMenu('datamgmt-card-migrate');
  updateBreadcrumb('datamgmt-card-migrate', '报告卡迁移');
  if (typeof autoSizeSelects === 'function') autoSizeSelects();
  /* 过滤行政区划变更后重绘表格 */
  if (typeof onRegionChange === 'function') onRegionChange('migFrom', migRerender);
  /* 日期区间确认后落状态并重绘（原有组件只特判了 dr_dedup） */
  if (typeof dateRangeChangeHooks === 'object') dateRangeChangeHooks['dr_migrate'] = migDateRangeChange;
};

/* 演示数据延迟到首次渲染迁移页时再灌：此时报告卡数据已就绪，
   「已执行」的历史批次才能真正把归属地落到卡片上，与台账自洽。 */
var MIG_SEEDED = false;
function migEnsureSeeded() {
  if (MIG_SEEDED) return;
  MIG_SEEDED = true;
  migSeed();
}

/* 调试用：window.mig = {MIG_STATE, MIG_BATCHES, MIG_RECORDS} */
window.mig = {
  state: MIG_STATE, batches: MIG_BATCHES, records: MIG_RECORDS,
  operator: migOperator, resolve: migResolveRegion, code: migCodeOfPath
};
