/* ============================================================================
 * qc-l4.js — ④ 数据汇聚与标准化质控
 *
 * 页面：数据质量总览 / 数据源监测 / 标准化质控 / 患者主索引与重复病例
 * 围绕数据接入、数据对账、标准映射、患者主索引、重复病例及关键字段结构化
 * 情况开展质量检查。
 *
 * 下钻链路：
 *   数据质量总览 → 数据源监测 → 批次详情 → 异常记录 → 标准化 / 主索引
 * ========================================================================== */
(function () {
  'use strict';

  var S = window.qcSpine, U = window.qcUI;

  var PAGE_META = {
    'qc-l4-pipeline': { label: '数据质量总览', sub: '数据接入量、入库量、对账一致率与标准化质量' },
    'qc-pipe-sources': { label: '数据源监测', sub: '逐数据源核对源端数量、入库数量与差异' },
    'qc-pipe-standard': { label: '标准化质控', sub: '字段映射、映射质量与关键字段结构化' },
    'qc-pipe-empi': { label: '患者主索引与重复病例', sub: '跨来源患者匹配、重复病例与多原发识别' }
  };

  var ST = {
    year: '2026', source: '', page: 1, per: 20,
    batchKey: '', empiKey: '', stdTab: 'map'
  };

  /* ==================== 页面：数据质量总览 ==================== */
  function renderOverview() {
    var batches = S.allBatches();

    var kpiHtml = U.kpis(S.L4_IND.map(function (d) {
      var v = S.l4Value(d.id);
      var tone = d.dir === 'down' ? (v <= d.base ? 'up' : 'warn') : (v >= d.base ? 'up' : 'warn');
      return {
        l: d.name,
        v: d.unit === '条' ? S.fmt(v) : S.f1(v),
        unit: d.unit,
        tone: tone,
        m: d.unit === '条' ? '报告期内累计' : '基准 ' + d.base + d.unit,
        action: 'l4:toSources'
      };
    }), 3);

    /* 数据质量问题 */
    var ps = S.problems().filter(function (p) { return p.layer === 'L4'; });
    var types = ['数据接入异常', '数据缺失', '对账异常', '标准映射异常', '重复病例', '主索引异常', '关键字段缺失'];
    var typeData = types.map(function (t) {
      return { l: t, v: ps.filter(function (p) { return p.type === t; }).length };
    });
    var probCard = U.card('数据质量问题',
      U.table(['问题类型', '#问题数', '#涉及数据源', '#操作'],
        typeData.map(function (t) {
          var items = ps.filter(function (p) { return p.type === t.l; });
          var srcCount = new Set(items.map(function (p) { return p.objId; })).size;
          return {
            cells: [
              t.l,
              { h: S.fmt(t.v), cls: 'num' },
              { h: S.fmt(srcCount), cls: 'num' },
              { h: t.v > 0 ? U.link('查看异常', 'l4:toSources') : '—' }
            ]
          };
        }), '七类数据质量问题'),
      '来自质控问题中心（④ 层）');

    /* 趋势分析 */
    var tr = [];
    for (var m = 1; m <= 9; m++) {
      tr.push({ l: m + '月', v: Math.round((S.l4Value('CONSIST') + (S.rnd01('l4tr|' + m) - 0.5) * 1.6) * 10) / 10 });
    }
    var trendCard = U.card('趋势分析', U.lineChart(tr), '整体数据质量变化');

    /* 被质控数据：批次列表 */
    var sl = U.slice(batches, ST.page, ST.per);
    var dataCard = U.card('被质控数据',
      U.table(['数据批次', '数据来源', '#病例/记录数', '质控结果', '#问题数量', '#操作'],
        sl.rows.map(function (b) {
          return {
            cls: b.state !== '正常' ? 'abn-row' : '',
            cells: [
              { h: U.link(b.batchNo, 'l4:batch:' + b.id) },
              b.name,
              { h: S.fmt(b.src), cls: 'num' },
              { h: U.statusBadge(b.state) },
              { h: S.fmt(b.diff + b.abn), cls: 'num' },
              { h: U.link('批次详情', 'l4:batch:' + b.id) }
            ]
          };
        }), { compact: true }) +
      U.pager(sl.total, sl.page, ST.per, 'l4'),
      '数据批次 → 来源 → 记录数 → 质控结果');

    return '<div class="qc-page">' +
      U.head('数据质量总览', '围绕数据接入、数据对账、标准映射、患者主索引、重复病例及关键字段结构化情况开展质量检查。',
        'l4', '④ 数据汇聚与标准化质控',
        '<button class="btn btn-ghost btn-sm" data-qc="l4:toSources">数据源监测</button>' +
        '<button class="btn btn-ghost btn-sm" data-qc="l4:toStandard">标准化质控</button>' +
        '<button class="btn btn-ghost btn-sm" data-qc="l4:toEmpi">患者主索引</button>') +
      '<div style="font-size:13px;font-weight:700;color:#1f2937;margin:0 0 10px">核心指标</div>' +
      kpiHtml +
      U.note('说明：源端与入库一致率反映数据在传输与入库过程中的完整性；字典映射率反映标准化覆盖程度；' +
        '重复病例率反映患者主索引（EMPI）的匹配质量。点击指标卡可下钻至数据源监测。') +
      '<div style="height:16px"></div>' +
      U.grid2(probCard, trendCard) +
      dataCard +
      '</div>';
  }

  /* ==================== 页面：数据源监测 ==================== */
  function renderSources() {
    var batches = S.allBatches();
    var sl = U.slice(batches, ST.page, ST.per);

    var rows = sl.rows.map(function (b) {
      return {
        cls: b.state !== '正常' ? 'abn-row' : '',
        cells: [
          { h: U.link(b.name, 'l4:batch:' + b.id) },
          { h: '<span class="mono">' + S.esc(b.batchNo) + '</span>' },
          { h: S.fmt(b.src), cls: 'num' },
          { h: S.fmt(b.stored), cls: 'num' },
          { h: (b.diff > 0 ? '<span style="color:#b42335;font-weight:600">' + S.fmt(b.diff) + '</span>' : '0'), cls: 'num' },
          b.syncTime,
          { h: U.statusBadge(b.state) },
          { h: U.link('查看异常', 'l4:batch:' + b.id) }
        ]
      };
    });

    var totalSrc = 0, totalStored = 0, totalDiff = 0;
    batches.forEach(function (b) { totalSrc += b.src; totalStored += b.stored; totalDiff += b.diff; });

    return '<div class="qc-page">' +
      U.head('数据源监测', '逐数据源核对源端数量、入库数量与差异，支持重新处理异常批次。',
        'l4', '④ 数据汇聚与标准化质控',
        '<button class="btn btn-ghost btn-sm" data-qc="l4:back">返回总览</button>') +
      '<div style="font-size:13px;font-weight:700;color:#1f2937;margin:0 0 10px">数据源列表</div>' +
      U.kpis([
        { l: '数据源数量', v: String(batches.length), unit: '个', tone: 'info', m: '已接入的数据源' },
        { l: '源端总数量', v: S.fmt(totalSrc), unit: '条', tone: 'info', m: '报告期内累计接收' },
        { l: '入库总数量', v: S.fmt(totalStored), unit: '条', tone: 'up', m: '成功入库记录' },
        { l: '差异总数量', v: S.fmt(totalDiff), unit: '条', tone: totalDiff > 0 ? 'bad' : 'up', m: '需核查的记录' }
      ], 4) +
      U.card('', U.table(
        ['数据源', '数据批次', '#源端数量', '#入库数量', '#差异数量', '同步时间', '状态', '操作'], rows, { empty: '暂无数据' }
      ) + U.pager(sl.total, sl.page, ST.per, 'l4s'), '源端与入库逐批对账', null, true) +
      U.note('对账规则：<b>源端数量 − 入库数量 = 差异数量</b>。差异记录可点击「查看异常」逐条核对原始记录与入库记录。', true) +
      '</div>';
  }

  /* ==================== 批次详情（数据源监测下钻） ==================== */
  function renderBatch() {
    var b = null;
    S.allBatches().forEach(function (x) { if (x.id === ST.batchKey) b = x; });
    if (!b) b = S.allBatches()[0];
    var recs = S.batchRecords(b);

    var infoCard = U.card('数据批次详情', U.kv([
      ['数据源', S.esc(b.name)], ['数据批次', '<span class="mono">' + S.esc(b.batchNo) + '</span>'],
      ['同步周期', b.cycle], ['最近同步时间', b.syncTime],
      ['接收量', S.fmt(b.recv)], ['成功量', S.fmt(b.success)],
      ['失败量', S.fmt(b.fail)], ['异常数量', S.fmt(b.abn)],
      ['对账结果', b.diff === 0 ? U.badge('对账一致', 'success') : U.badge('对账存在差异', 'danger')],
      ['异常原因', b.reason || '—']
    ], 3), '接收量 / 成功量 / 失败量 / 对账结果');

    var recCard = U.card('被质控数据 · 异常记录明细',
      U.table(['原始记录', '入库记录', '差异字段', '差异值', '质控结论'],
        recs.map(function (r) {
          return {
            cls: 'abn-row',
            cells: [
              { h: '<span class="mono">' + S.esc(r.id) + '</span><br><span style="font-size:11.5px;color:#94a3b8">' + S.esc(r.name) + ' · ' + r.cancerName + '</span>' },
              { h: r.stored === '' ? '<span style="color:#b42335">（未入库）</span>' : '<span class="mono">' + S.esc(r.stored) + '</span>' },
              r.field,
              { h: r.raw === '' ? '<span style="color:#b42335">（空）</span>' : '<span class="mono">' + S.esc(r.raw) + '</span>' },
              { h: U.badge(r.verdict, r.verdict === '对账差异' ? 'caution' : 'danger') }
            ]
          };
        }), { compact: true }),
      '原始记录 vs 入库记录逐字段比对');

    return '<div class="qc-page">' +
      U.head('数据批次详情 · ' + b.name, '接收量、成功量、失败量、异常原因与对账结果。',
        'l4', '④ 数据汇聚与标准化质控',
        '<button class="btn btn-ghost btn-sm" data-qc="l4:backSources">返回数据源监测</button>' +
        '<button class="btn btn-ghost btn-sm" data-qc="l4:reprocess">重新处理</button>' +
        '<button class="btn btn-ghost btn-sm" data-qc="l4:export">导出异常</button>') +
      infoCard + recCard +
      '</div>';
  }

  /* ==================== 页面：标准化质控 ==================== */
  function renderStandard() {
    var maps = S.fieldMaps();
    var mapped = maps.filter(function (m) { return m.status === '已映射'; }).length;
    var unmapped = maps.filter(function (m) { return m.status === '未映射'; }).length;
    var bad = maps.filter(function (m) { return m.status === '异常映射'; }).length;
    var coverage = maps.length ? mapped / maps.length * 100 : 0;

    var structs = S.structFields();
    var tabs = [['map', '字段映射'], ['quality', '映射质量'], ['struct', '关键字段结构化'], ['data', '被质控数据']];
    var tabHtml = '<div class="qc-tabs">' + tabs.map(function (t) {
      return '<button class="' + (ST.stdTab === t[0] ? 'on' : '') + '" data-qc="l4:stdtab:' + t[0] + '">' + t[1] + '</button>';
    }).join('') + '</div>';

    var body = '';
    if (ST.stdTab === 'map') {
      body = U.card('字段映射', U.table(
        ['源字段', '源字段名', '标准字段', '映射规则', '映射状态', '#样本量'],
        maps.map(function (m) {
          return {
            cells: [
              { h: '<span class="mono">' + S.esc(m.src) + '</span>' },
              m.srcName, m.std, m.rule,
              { h: U.badge(m.status, m.status === '已映射' ? 'success' : m.status === '未映射' ? 'caution' : 'danger') },
              { h: S.fmt(m.samples), cls: 'num' }
            ]
          };
        }), { compact: true }), '源字段 → 标准字段 → 映射规则');
    } else if (ST.stdTab === 'quality') {
      body = U.kpis([
        { l: '已映射', v: String(mapped), unit: '个', tone: 'up', m: '映射规则已生效' },
        { l: '未映射', v: String(unmapped), unit: '个', tone: 'warn', m: '字段落库但未做标准化' },
        { l: '异常映射', v: String(bad), unit: '个', tone: 'bad', m: '映射结果与目标值域不符' },
        { l: '映射覆盖率', v: S.f1(coverage), unit: '%', tone: coverage >= 90 ? 'up' : 'warn', m: '已映射 / 全部字段' }
      ], 4) +
      U.card('映射覆盖率明细', U.table(
        ['源字段', '标准字段', '#覆盖率', '#样本量'],
        maps.map(function (m) {
          return {
            cells: [
              m.srcName, m.std,
              { h: U.progress(m.coverage), cls: '' },
              { h: S.fmt(m.samples), cls: 'num' }
            ]
          };
        }), { compact: true }), '逐字段映射覆盖率');
    } else if (ST.stdTab === 'struct') {
      body = U.card('关键字段结构化',
        U.table(['关键字段', '#结构化率', '#数据总量', '#异常数据量'],
          structs.map(function (s) {
            return {
              cells: [
                s.field,
                { h: '<span style="padding:2px 7px;border-radius:4px;' + U.heat(s.rate, 'up', 92) + '">' + S.f1(s.rate) + '%</span>', cls: 'num' },
                { h: S.fmt(s.total), cls: 'num' },
                { h: S.fmt(s.abn), cls: 'num' }
              ]
            };
          }), '诊断 / 病理 / 分期 / 治疗的结构化率') +
        '<div style="height:12px"></div>' +
        U.barChart(structs.map(function (s) { return { l: s.field, v: s.rate }; }), { height: 170, unit: '%', fmt: function (v) { return S.f1(v) + '%'; } }),
        '四类关键字段的结构化情况');
    } else {
      /* 被质控数据：具体字段的源值 / 标准值 */
      body = U.card('被质控数据 · 字段级',
        U.table(['源字段', '源值', '标准字段', '标准值', '映射状态'],
          maps.map(function (m, i) {
            var samples = ['C34.9', 'C50.9', '8140/3', 'pT2N1M0', '2024-05-16', '男', '存活'];
            var rv = samples[i % samples.length];
            return {
              cells: [
                { h: '<span class="mono">' + S.esc(m.src) + '</span>' },
                { h: '<span class="mono">' + S.esc(rv) + '</span>' },
                m.std,
                { h: '<span class="mono">' + S.esc(rv) + '</span>' },
                { h: U.badge(m.status, m.status === '已映射' ? 'success' : m.status === '未映射' ? 'caution' : 'danger') }
              ]
            };
          }), { compact: true }), '源字段 / 源值 → 标准字段 / 标准值');
    }

    return '<div class="qc-page">' +
      U.head('标准化质控', '字段映射、映射质量与关键字段结构化情况检查。',
        'l4', '④ 数据汇聚与标准化质控',
        '<button class="btn btn-ghost btn-sm" data-qc="l4:back">返回总览</button>') +
      tabHtml +
      U.kpis([
        { l: '映射字段总数', v: String(maps.length), unit: '个', tone: 'info', m: '参与标准化的字段' },
        { l: '已映射', v: String(mapped), unit: '个', tone: 'up' },
        { l: '未映射', v: String(unmapped), unit: '个', tone: 'warn' },
        { l: '异常映射', v: String(bad), unit: '个', tone: 'bad' },
        { l: '映射覆盖率', v: S.f1(coverage), unit: '%', tone: 'info' }
      ], 5) +
      body +
      '</div>';
  }

  /* ==================== 页面：患者主索引与重复病例 ==================== */
  function renderEmpi() {
    var list = S.empiList();
    var sl = U.slice(list, ST.page, ST.per);

    var dupCount = list.filter(function (x) { return x.dup === '疑似重复'; }).length;
    var multiCount = list.filter(function (x) { return x.multi === '疑似多原发'; }).length;
    var pending = list.filter(function (x) { return x.state === '待确认'; }).length;

    var rows = sl.rows.map(function (r) {
      return {
        cls: (r.dup === '疑似重复' || r.dup === '待判断') ? 'abn-row' : '',
        cells: [
          { h: U.link(r.name + '（' + r.id + '）', 'l4:empi:' + r.id) },
          r.srcA + ' / ' + r.srcB,
          { h: '<span class="mono">' + S.esc(r.recA) + '</span><br><span class="mono">' + S.esc(r.recB) + '</span>' },
          { h: U.badge(r.matchStatus, r.dup === '疑似重复' ? 'danger' : r.multi === '疑似多原发' ? 'caution' : 'success') },
          { h: r.dup === '否' ? '否' : U.badge(r.dup, 'warn') },
          { h: r.multi === '否' ? '否' : U.badge(r.multi, 'caution') },
          { h: S.f1(r.similarity) + '%', cls: 'num' },
          { h: U.link('匹配详情', 'l4:empi:' + r.id) }
        ]
      };
    });

    return '<div class="qc-page">' +
      U.head('患者主索引与重复病例', '用于识别多来源数据中的同一患者、重复病例及疑似多原发病例。',
        'l4', '④ 数据汇聚与标准化质控',
        '<button class="btn btn-ghost btn-sm" data-qc="l4:back">返回总览</button>' +
        '<button class="btn btn-ghost btn-sm" data-qc="l4:mergeAll">批量合并</button>') +
      U.kpis([
        { l: '待匹配记录', v: S.fmt(list.length), unit: '组', tone: 'info', m: '跨来源患者记录组' },
        { l: '疑似重复', v: S.fmt(dupCount), unit: '组', tone: 'bad', m: '需人工确认' },
        { l: '疑似多原发', v: S.fmt(multiCount), unit: '组', tone: 'warn', m: '非重复，需标记' },
        { l: '待确认', v: S.fmt(pending), unit: '组', tone: 'warn', m: '等待质控人员判定' }
      ], 4) +
      U.card('患者匹配列表', U.table(
        ['患者', '来源机构', '来源记录', '匹配状态', '疑似重复', '多原发状态', '#相似程度', '操作'], rows, { compact: true }
      ) + U.pager(sl.total, sl.page, ST.per, 'l4e')) +
      '</div>';
  }

  /* ==================== 患者匹配详情 ==================== */
  function renderEmpiDetail() {
    var list = S.empiList(), r = null;
    list.forEach(function (x) { if (x.id === ST.empiKey) r = x; });
    if (!r) r = list[0];

    /* 来源 A / B 对比 */
    var cmpRows = [
      ['患者姓名', r.name, r.name, U.badge('一致', 'success')],
      ['身份证号', r.idNo, r.idNo, U.badge('一致', 'success')],
      ['性别', r.sex, r.sex, U.badge('一致', 'success')],
      ['年龄', r.age + ' 岁', (r.age + S.rndInt('empi|' + r.id, -2, 2)) + ' 岁', r.dup === '疑似重复' ? U.badge('一致', 'success') : U.badge('差异', 'caution')],
      ['诊断信息', r.cancerName, r.cancerName, U.badge('一致', 'success')],
      ['病理信息', '腺癌 · 8140/3', '腺癌 · 8140/3', U.badge('一致', 'success')],
      ['就诊机构', r.srcA, r.srcB, U.badge('不同机构', 'info')],
      ['就诊时间', '2025-03-12', '2025-09-08', r.multi === '疑似多原发' ? U.badge('间隔 > 6 月', 'caution') : U.badge('差异', 'caution')]
    ];

    var cmpCard = U.card('患者匹配详情',
      '<div class="qc-grid2">' +
      '<div><div style="font-size:13px;font-weight:700;color:#1f2937;margin-bottom:8px">来源 A · ' + S.esc(r.srcA) + '</div>' +
      U.table(['项目', '值'], [
        { cells: ['来源记录', '<span class="mono">' + S.esc(r.recA) + '</span>'] },
        { cells: ['患者基本信息', r.name + ' · ' + r.sex + ' · ' + r.age + ' 岁'] },
        { cells: ['诊断信息', r.cancerName] },
        { cells: ['病理信息', '腺癌 · 8140/3'] },
        { cells: ['就诊信息', '住院 · 2025-03-12'] }
      ], { compact: true }) + '</div>' +
      '<div><div style="font-size:13px;font-weight:700;color:#1f2937;margin-bottom:8px">来源 B · ' + S.esc(r.srcB) + '</div>' +
      U.table(['项目', '值'], [
        { cells: ['来源记录', '<span class="mono">' + S.esc(r.recB) + '</span>'] },
        { cells: ['患者基本信息', r.name + ' · ' + r.sex + ' · ' + (r.age + S.rndInt('empi|' + r.id, -2, 2)) + ' 岁'] },
        { cells: ['诊断信息', r.cancerName] },
        { cells: ['病理信息', '腺癌 · 8140/3'] },
        { cells: ['就诊信息', '门诊 · 2025-09-08'] }
      ], { compact: true }) + '</div>' +
      '</div>' +
      '<div style="height:14px"></div>' +
      '<div style="font-size:13px;font-weight:700;color:#1f2937;margin-bottom:8px">匹配字段逐项对比</div>' +
      U.table(['匹配字段', '来源 A', '来源 B', '比对结果'],
        cmpRows.map(function (c) { return { cells: c }; }), { compact: true }),
      '跨数据来源逐字段比对');

    var judgeCard = U.card('判定依据', U.kv([
      ['系统匹配结果', U.badge(r.matchStatus, r.dup === '疑似重复' ? 'danger' : 'success')],
      ['匹配字段', S.esc(r.matchFields)],
      ['相似程度', S.f1(r.similarity) + '%'],
      ['疑似重复原因', S.esc(r.reason)],
      ['多原发判定依据', r.multi === '疑似多原发' ? '两次诊断间隔 6 个月以上，且原发部位不同（ICD-O-3 拓扑码不一致）' : '不适用']
    ], 2), '系统匹配结果与判定依据');

    return '<div class="qc-page">' +
      U.head('患者匹配详情 · ' + r.name, '对比不同数据来源的患者信息，确认是否同一患者。',
        'l4', '④ 数据汇聚与标准化质控',
        '<button class="btn btn-ghost btn-sm" data-qc="l4:backEmpi">返回列表</button>' +
        '<button class="btn btn-ghost btn-sm" data-qc="l4:same">确认同一患者</button>' +
        '<button class="btn btn-ghost btn-sm" data-qc="l4:diff">确认不同患者</button>' +
        '<button class="btn btn-ghost btn-sm" data-qc="l4:dup">确认重复</button>' +
        '<button class="btn btn-ghost btn-sm" data-qc="l4:multi">标记多原发</button>' +
        '<button class="btn btn-ghost btn-sm" data-qc="l4:related">查看关联病例</button>') +
      cmpCard + judgeCard +
      '</div>';
  }

  /* ==================== 路由 ==================== */
  function render(pageId) {
    if (pageId === 'qc-g-pipe') pageId = 'qc-l4-pipeline';
    if (pageId === 'qc-l4-pipeline') return renderOverview();
    if (pageId === 'qc-pipe-sources') return renderSources();
    if (pageId === 'qc-pipe-batch') return renderBatch();
    if (pageId === 'qc-pipe-standard') return renderStandard();
    if (pageId === 'qc-pipe-empi') return renderEmpi();
    if (pageId === 'qc-pipe-empi-detail') return renderEmpiDetail();
    return null;
  }

  /* ==================== 交互 ==================== */
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest ? ev.target.closest('[data-qc]') : null;
    if (!el) return;
    var a = el.getAttribute('data-qc');
    if (a.indexOf('l4') !== 0) return;

    if (a === 'l4:back') { window.navigateTo('qc-l4-pipeline'); return; }
    if (a === 'l4:toSources' || a === 'l4:backSources') { ST.page = 1; window.navigateTo('qc-pipe-sources'); return; }
    if (a === 'l4:toStandard') { window.navigateTo('qc-pipe-standard'); return; }
    if (a === 'l4:toEmpi') { ST.page = 1; window.navigateTo('qc-pipe-empi'); return; }
    if (a === 'l4:backEmpi') { window.navigateTo('qc-pipe-empi'); return; }
    if (a === 'l4:export') { U.toast('已导出异常记录（演示）'); return; }
    if (a === 'l4:reprocess') { U.toast('已提交重新处理请求，批次将重新同步（演示）'); return; }

    if (a.indexOf('l4:batch:') === 0) { ST.batchKey = a.split(':')[2]; window.navigateTo('qc-pipe-batch'); return; }
    if (a.indexOf('l4:empi:') === 0) { ST.empiKey = a.split(':')[2]; window.navigateTo('qc-pipe-empi-detail'); return; }
    if (a.indexOf('l4:stdtab:') === 0) { ST.stdTab = a.split(':')[2]; window.renderPage('qc-pipe-standard'); return; }
    if (a.indexOf('l4:page:') === 0 || a.indexOf('l4s:page:') === 0 || a.indexOf('l4e:page:') === 0) {
      ST.page = parseInt(a.split(':')[2], 10) || 1;
      var cur4 = (a.indexOf('l4s:') === 0) ? 'qc-pipe-sources' : (a.indexOf('l4e:') === 0) ? 'qc-pipe-empi' : 'qc-l4-pipeline';
      window.renderPage(cur4);
      return;
    }

    /* 主索引操作 */
    if (['l4:same', 'l4:diff', 'l4:dup', 'l4:multi', 'l4:related', 'l4:mergeAll'].indexOf(a) >= 0) {
      var msg = {
        'l4:same': '已确认两个来源为同一患者，主索引已合并',
        'l4:diff': '已确认两个来源为不同患者，已解除匹配',
        'l4:dup': '已确认重复病例，重复记录已标记待清理',
        'l4:multi': '已标记为多原发病例，保留两条诊断记录',
        'l4:related': '已打开关联病例列表（演示）',
        'l4:mergeAll': '已批量合并高置信度重复病例（演示）'
      }[a];
      U.toast(msg);
      return;
    }
  });

  window.qcL4 = {
    pageIds: ['qc-g-pipe', 'qc-l4-pipeline', 'qc-pipe-sources', 'qc-pipe-batch',
      'qc-pipe-standard', 'qc-pipe-empi', 'qc-pipe-empi-detail'],
    render: render,
    meta: PAGE_META,
    state: ST
  };
})();
