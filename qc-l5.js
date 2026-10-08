/* ============================================================================
 * qc-l5.js — ⑤ 质控工作闭环
 *
 * 页面：质控问题中心（含「问题清单 / 整改任务 / 抽查管理」三页签） / 闭环分析
 * 详情（下钻）：问题详情 / 整改任务详情 / 抽查详情
 *
 * 结构原则（配合导航精简）：
 *   • 整改任务、抽查管理不再作为独立的菜单页，而是「质控问题中心」的页签；
 *     它们只作为下钻入口存在，点击「进入抽查」时切换页签。
 *   • 三处「被质控数据详情」（①②③）、「批次详情/匹配详情」、「问题/任务/抽查详情」
 *     也不在侧栏显示，全部通过「查看被质控数据 / 下钻」进入。
 *   • 问题只来自 window.qcSpine.problems()（①—④ 的异常汇总），
 *     ⑤ 不新增问题源、不另建台账。每条问题都带 layer，可反查被质控数据。
 *
 * 面包屑：隐藏页的路径由 app.html 的 menuPathFallback 给出，
 *        当前页显示「… ▸ 质控问题中心 ▸ 详情」。
 * ========================================================================== */
(function () {
  'use strict';

  var S = window.qcSpine, U = window.qcUI;

  /* 菜单上只暴露这两个；整改任务/抽查管理是「质控问题中心」的页签。 */
  var PAGE_META = {
    'qc-l5-loop': { label: '质控问题中心', sub: '统一问题台账 + 整改任务 + 抽查管理' },
    'qc-loop-analysis': { label: '闭环分析', sub: '整改完成率、及时率与问题闭环率' }
  };

  var ST = {
    layer: '', org: '', cancer: '', type: '', status: '', page: 1, per: 20,
    mainTab: 'problems',          /* 'problems' | 'tasks' | 'sampling' */
    probCode: '', taskId: '', planId: '', taskTab: 'info'
  };

  var LAYER_LABEL = { L1: '诊疗过程与单病种质控', L2: '病案与编码质控', L3: '登记与随访数据质控', L4: '数据汇聚与标准化质控' };
  var LAYER_PAGE = { L1: 'qc-natl-drill', L2: 'qc-enc-issues', L3: 'qc-l3-registry', L4: 'qc-pipe-sources' };

  /* 质控问题中心的页签。抽查管理页签点击「进入抽查」时会切换到抽查详情。 */
  var TABS = [
    ['problems', '问题清单'],
    ['tasks', '整改任务'],
    ['sampling', '抽查管理']
  ];

  /* ==================================================================
   * 页面：质控问题中心（含三页签）
   * ================================================================== */
  function renderCenter() {
    var all = S.problems();
    var st = S.problemStat(all);

    /* 顶层聚合 KPI：跨全部模块、全部状态 */
    var kpiHtml = U.kpis([
      { l: '待处理', v: S.fmt(st.pending), unit: '条', tone: 'warn', m: '等待下发整改', action: 'l5:status:待处理' },
      { l: '整改中', v: S.fmt(st.fixing), unit: '条', tone: 'info', m: '医疗机构整改中', action: 'l5:status:整改中' },
      { l: '待复核', v: S.fmt(st.review), unit: '条', tone: 'info', m: '等待质控中心复核', action: 'l5:status:待复核' },
      { l: '已关闭', v: S.fmt(st.closed), unit: '条', tone: 'up', m: '复核通过并闭环', action: 'l5:status:已关闭' },
      { l: '已逾期', v: S.fmt(st.overdue), unit: '条', tone: 'bad', m: '超过整改期限', action: 'l5:status:已逾期' },
      { l: '问题总数', v: S.fmt(st.total), unit: '条', tone: 'info', m: '闭环率 ' + S.f1(st.closeRate) + '%' }
    ], 6);

    /* 页签条 */
    var tabBar = '<div class="qc-tabs">' + TABS.map(function (t) {
      var cnt = 0;
      if (t[0] === 'problems') cnt = all.length;
      else if (t[0] === 'tasks') cnt = S.tasks().length;
      else cnt = S.samplingPlans().length;
      return '<button class="' + (ST.mainTab === t[0] ? 'on' : '') + '" data-qc="l5:tab:' + t[0] + '">' +
        t[1] + '（' + S.fmt(cnt) + '）</button>';
    }).join('') + '</div>';

    var body;
    if (ST.mainTab === 'problems') body = renderProblemList(all, st);
    else if (ST.mainTab === 'tasks') body = renderTaskList();
    else body = renderSamplingList();

    return '<div class="qc-page">' +
      U.head('质控问题中心', '统一管理各质控模块发现的问题，下发整改、执行抽查、闭环分析。',
        'l5', '⑤ 质控工作闭环',
        '<button class="btn btn-ghost btn-sm" data-qc="l5:toAnalysis">闭环分析</button>') +
      kpiHtml +
      tabBar + body +
      U.note('所有质控模块（①–④）的问题最终进入本中心；<b>整改任务、抽查管理</b>以页签形式呈现。' +
        '形成「发现问题 → 下发整改 → 复核 → 闭环」的完整链条。') +
      '</div>';
  }

  /* --- 页签 1：问题清单 --- */
  function renderProblemList(all, st) {
    var list = filtered(all);
    var sl = U.slice(list, ST.page, ST.per);

    var rows = sl.rows.map(function (p) {
      return {
        cls: p.status === '已逾期' ? 'abn-row' : '',
        cells: [
          { h: U.link(p.code, 'l5:problem:' + p.code) },
          { h: '<span class="qc-tag ' + p.layer.toLowerCase() + '" style="height:22px;font-size:11px">' + S.esc(p.module) + '</span>' },
          p.orgName || p.cityName,
          p.cancerName,
          p.type,
          p.foundDate,
          { h: U.statusBadge(p.status) },
          { h: U.link('详情', 'l5:problem:' + p.code) }
        ]
      };
    });

    var filter = U.filterBar([
      { key: 'layer', label: '来源模块', type: 'select', value: ST.layer, options: [{ v: '', l: '全部模块' }].concat(Object.keys(LAYER_LABEL).map(function (k) { return { v: k, l: LAYER_LABEL[k] }; })) },
      { key: 'org', label: '医疗机构', type: 'select', value: ST.org, options: [{ v: '', l: '全部机构' }].concat(S.orgOptions()) },
      { key: 'cancer', label: '癌种', type: 'select', value: ST.cancer, options: [{ v: '', l: '全部癌种' }].concat(S.cancerOptions()) },
      { key: 'status', label: '状态', type: 'select', value: ST.status, options: ['全部'].concat(S.LOOP_STATUS) },
      { key: 'type', label: '问题类型', type: 'text', value: ST.type, ph: '输入问题类型关键字' }
    ], 'l5');

    return filter +
      U.card('问题列表', U.table(
        ['问题编号', '来源模块', '医疗机构/区域', '癌种', '问题类型', '发现时间', '当前状态', '操作'],
        rows, { compact: true, empty: '暂无符合条件的问题' }) +
        U.pager(sl.total, sl.page, ST.per, 'l5'),
        '共 ' + S.fmt(list.length) + ' 条问题') +
      U.note('点击「详情」或问题编号可下钻至问题详情，查看被质控数据与规则判定；点击「查看被质控数据」可回到对应质控模块。');
  }

  /* --- 页签 2：整改任务 --- */
  function renderTaskList() {
    var tasks = S.tasks();
    var sl = U.slice(tasks, ST.page, ST.per);

    var done = tasks.filter(function (t) { return t.status === '已完成'; }).length;
    var overdue = tasks.filter(function (t) { return t.status === '已逾期'; }).length;
    var doing = tasks.filter(function (t) { return t.status === '整改中'; }).length;
    var totalProbs = 0, closedProbs = 0;
    tasks.forEach(function (t) {
      totalProbs += t.problemCount;
      t.problems.forEach(function (p) { if (p.status === '已关闭') closedProbs++; });
    });

    var rows = sl.rows.map(function (t) {
      return {
        cls: t.status === '已逾期' ? 'abn-row' : '',
        cells: [
          { h: U.link(t.name, 'l5:task:' + t.id) },
          t.orgName,
          { h: S.fmt(t.problemCount), cls: 'num' },
          t.issueDate,
          t.dueDate,
          { h: U.progress(t.progress) },
          { h: U.statusBadge(t.status) },
          { h: U.link('详情', 'l5:task:' + t.id) }
        ]
      };
    });

    return U.kpis([
      { l: '任务总数', v: S.fmt(tasks.length), unit: '个', tone: 'info', m: '已下发的整改任务' },
      { l: '整改中', v: S.fmt(doing), unit: '个', tone: 'warn' },
      { l: '已完成', v: S.fmt(done), unit: '个', tone: 'up', m: '全部问题闭环' },
      { l: '已逾期', v: S.fmt(overdue), unit: '个', tone: 'bad', m: '超过整改期限' },
      { l: '涉及问题', v: S.fmt(totalProbs), unit: '条', tone: 'info', m: '已闭环 ' + S.fmt(closedProbs) + ' 条' }
    ], 5) +
      U.card('任务列表', U.table(
        ['任务名称', '医疗机构', '#问题数', '下发时间', '截止时间', '整改进度', '状态', '操作'],
        rows, { compact: true, empty: '暂无整改任务' }) + U.pager(sl.total, sl.page, ST.per, 'l5t'),
        '共 ' + S.fmt(tasks.length) + ' 个任务');
  }

  /* --- 页签 3：抽查管理 --- */
  function renderSamplingList() {
    var plans = S.samplingPlans();
    var sl = U.slice(plans, ST.page, ST.per);

    var totalCases = 0, doneCases = 0, probs = 0;
    plans.forEach(function (p) { totalCases += p.total; doneCases += p.done; probs += p.problems; });

    var rows = sl.rows.map(function (p) {
      return {
        cells: [
          { h: U.link(p.name, 'l5:plan:' + p.id) },
          p.scope,
          { h: S.fmt(p.orgCount) + ' 家', cls: 'num' },
          { h: S.fmt(p.total), cls: 'num' },
          { h: S.fmt(p.done), cls: 'num' },
          { h: S.fmt(p.problems), cls: 'num' },
          { h: U.progress(p.total ? p.done / p.total * 100 : 0) },
          { h: U.statusBadge(p.status) },
          { h: U.link('进入抽查', 'l5:plan:' + p.id) }
        ]
      };
    });

    return U.kpis([
      { l: '抽查计划', v: S.fmt(plans.length), unit: '个', tone: 'info' },
      { l: '抽查病例数', v: S.fmt(totalCases), unit: '例', tone: 'info' },
      { l: '已完成数量', v: S.fmt(doneCases), unit: '例', tone: 'up', m: '完成率 ' + S.f1(totalCases ? doneCases / totalCases * 100 : 0) + '%' },
      { l: '发现问题数', v: S.fmt(probs), unit: '条', tone: 'bad', m: '问题检出率 ' + S.f1(doneCases ? probs / doneCases * 100 : 0) + '%' }
    ], 4) +
      U.card('抽查计划', U.table(
        ['抽查计划名称', '抽查范围', '#抽查医疗机构', '#抽查病例数', '#已完成数量', '#问题数量', '完成状态', '状态', '操作'],
        rows, { compact: true, empty: '暂无抽查计划' }) + U.pager(sl.total, sl.page, ST.per, 'l5s'),
        '共 ' + S.fmt(plans.length) + ' 个计划');
  }

  function filtered(all) {
    return all.filter(function (p) {
      if (ST.layer && p.layer !== ST.layer) return false;
      if (ST.org && p.org !== ST.org) return false;
      if (ST.cancer && p.cancer !== ST.cancer) return false;
      if (ST.status && p.status !== ST.status) return false;
      if (ST.type && p.type.indexOf(ST.type) < 0) return false;
      return true;
    });
  }

  /* ==================================================================
   * 页面：问题详情（下钻）
   * ================================================================== */
  function renderProblem() {
    var all = S.problems(), p = null;
    all.forEach(function (x) { if (x.code === ST.probCode) p = x; });
    if (!p) p = all[0];

    var infoCard = U.card('问题信息', U.kv([
      ['问题编号', S.esc(p.code)],
      ['来源模块', S.esc(p.module)],
      ['问题类型', S.esc(p.type)],
      ['发现时间', p.foundDate],
      ['质控对象', S.esc(p.obj)],
      ['涉及病例数', S.fmt(p.count) + ' 例'],
      ['医疗机构', S.esc(p.orgName)],
      ['癌种', S.esc(p.cancerName)],
      ['整改期限', p.dueDate],
      ['当前状态', U.statusBadge(p.status)]
    ], 3), '问题描述：' + S.esc(p.desc));

    /* 被质控数据：直接关联产生该问题的病例、字段或数据记录 */
    var dataCard = U.card('被质控数据',
      U.note('以下数据是<b>产生该问题的直接依据</b>。点击可回到对应质控模块，查看完整的被质控数据与规则判定过程。') +
      '<div style="height:10px"></div>' +
      sampleDataTable(p) +
      '<div style="height:10px"></div>' +
      '<button class="btn btn-ghost btn-sm" data-qc="l5:toData">查看被质控数据</button>',
      '关联 ' + S.fmt(p.count) + ' 例');

    var judgeCard = U.card('质控依据',
      U.judgeBlock(p.rule,
        '<div style="font-size:12.5px;line-height:1.8">' +
        '· <b>质控对象</b>：' + S.esc(p.obj) + '<br>' +
        '· <b>判定结果</b>：' + S.esc(p.type) + '<br>' +
        '· <b>涉及病例</b>：' + S.fmt(p.count) + ' 例<br>' +
        '· <b>所属机构</b>：' + S.esc(p.orgName) + '</div>',
        '不符合', p.desc));

    /* 处理记录 */
    var logRows = p.logs.map(function (l) {
      return { cells: [l.t, l.who, l.what] };
    });
    var procCard = U.card('处理记录',
      U.table(['时间', '操作方', '内容'], logRows, { compact: true }) +
      '<div style="height:12px"></div>' +
      U.kv([
        ['整改要求', S.esc(p.status === '待处理' ? '尚未下发' : '逐例核对原始诊疗记录，限期完成整改并上传佐证材料')],
        ['整改反馈', S.esc(['整改中', '待复核', '已关闭', '已逾期'].indexOf(p.status) >= 0 ? '医疗机构已完成部分病例整改，正在补充佐证材料' : '—')],
        ['复核意见', S.esc(p.status === '已关闭' ? '复核通过，问题关闭。' : '—')]
      ], 3), '整改要求 / 整改反馈 / 复核意见 / 操作日志');

    var acts =
      (p.status === '待处理' || p.status === '整改中' ? '<button class="btn btn-primary btn-sm" data-qc="l5:startFix">发起整改</button>' : '') +
      '<button class="btn btn-ghost btn-sm" data-qc="l5:toData">查看被质控数据</button>';

    return '<div class="qc-page">' +
      U.head('问题详情 · ' + p.code, p.module + ' · ' + p.type, 'l5', '⑤ 质控工作闭环',
        '<button class="btn btn-ghost btn-sm" data-qc="l5:backCenter">返回问题清单</button>' + acts) +
      infoCard + dataCard + judgeCard + procCard +
      '</div>';
  }

  /* 问题关联的被质控数据（按层取真实病例） */
  function sampleDataTable(p) {
    var rows = [];
    if (p.layer === 'L1') {
      var cases = S.cases(p.objId, { orgIds: p.org ? [p.org] : null, limit: 8 }).rows;
      rows = cases.slice(0, 6).map(function (c) {
        return {
          cells: [
            { h: U.link(c.name, 'l5:case:' + c.key) }, c.orgName, c.cancerName,
            c.diagDate + ' · 首疗 ' + c.treatDate,
            { h: U.verdictBadge(c.v) },
            { h: c.v === 'ok' ? '—' : S.esc(c.reason) }
          ]
        };
      });
      return U.table(['患者', '医疗机构', '癌种', '关键诊疗数据', '质控结果', '问题原因'], rows, { compact: true });
    }
    if (p.layer === 'L2') {
      var iss = S.l2Issues({ orgIds: p.org ? [p.org] : null }).slice(0, 6);
      rows = iss.map(function (x) {
        return {
          cells: [
            x.name, x.orgName, x.cancerName, x.type, x.field,
            { h: x.current === '' ? '<span style="color:#b42335">（空）</span>' : S.esc(x.current) },
            x.verdict
          ]
        };
      });
      return U.table(['患者', '医疗机构', '癌种', '问题类型', '问题字段', '当前值', '质控结论'], rows, { compact: true });
    }
    if (p.layer === 'L3') {
      var regs = S.regCases({ limit: 20, salt: '' }).slice(0, 6);
      rows = regs.map(function (x) {
        return {
          cells: [
            x.name, x.cancerName, x.county,
            x.basis, x.fuDate || '未随访', x.survive,
            { h: U.verdictBadge(x.v) }
          ]
        };
      });
      return U.table(['患者', '癌种', '登记机构', '诊断依据', '最近随访', '生存状态', '质控结果'], rows, { compact: true });
    }
    /* L4 */
    var b = null;
    S.allBatches().forEach(function (x) { if (x.name === p.obj) b = x; });
    if (!b) b = S.allBatches()[0];
    var recs = S.batchRecords(b).slice(0, 6);
    rows = recs.map(function (x) {
      return {
        cells: [
          { h: '<span class="mono">' + S.esc(x.id) + '</span>' },
          x.name, x.field,
          { h: x.raw === '' ? '（空）' : S.esc(x.raw) },
          { h: x.stored === '' ? '<span style="color:#b42335">未入库</span>' : S.esc(x.stored) },
          { h: U.badge(x.verdict, 'danger') }
        ]
      };
    });
    return U.table(['原始记录', '患者', '差异字段', '原始值', '入库值', '质控结论'], rows, { compact: true });
  }

  /* ==================================================================
   * 页面：整改任务详情（下钻）
   * ================================================================== */
  function renderTaskDetail() {
    var tasks = S.tasks(), t = null;
    tasks.forEach(function (x) { if (x.id === ST.taskId) t = x; });
    if (!t) t = tasks[0];

    var tabs = [['info', '任务信息'], ['cases', '整改病例'], ['feedback', '整改反馈'], ['logs', '操作记录']];
    var tabHtml = '<div class="qc-tabs">' + tabs.map(function (x) {
      return '<button class="' + (ST.taskTab === x[0] ? 'on' : '') + '" data-qc="l5:tasktab:' + x[0] + '">' + x[1] + '</button>';
    }).join('') + '</div>';

    var body = '';
    if (ST.taskTab === 'info') {
      body = U.card('任务基本信息', U.kv([
        ['任务编号', S.esc(t.id)], ['任务名称', S.esc(t.name)],
        ['医疗机构', S.esc(t.orgName)], ['所属区域', S.esc(t.cityName)],
        ['下发时间', t.issueDate], ['截止时间', t.dueDate],
        ['问题数量', S.fmt(t.problemCount) + ' 条'], ['整改进度', S.f1(t.progress) + '%'],
        ['任务状态', U.statusBadge(t.status)], ['整改要求', S.esc(t.requirement)]
      ], 2)) +
      U.card('问题病例', U.table(
        ['问题编号', '问题类型', '质控对象', '涉及病例数', '状态'],
        t.problems.slice(0, 12).map(function (p) {
          return {
            cells: [
              { h: U.link(p.code, 'l5:problem:' + p.code) },
              p.type, p.obj,
              { h: S.fmt(p.count), cls: 'num' },
              { h: U.statusBadge(p.status) }
            ]
          };
        }), { compact: true }), '本任务包含的问题清单');
    } else if (ST.taskTab === 'cases') {
      body = U.card('整改病例',
        U.table(['患者', '问题类型', '被质控数据', '整改后数据', '整改说明', '复核结果'],
          t.problems.slice(0, 10).map(function (p) {
            var closed = p.status === '已关闭';
            return {
              cells: [
                { h: U.link(p.obj, 'l5:problem:' + p.code) },
                p.type,
                { h: S.esc(p.obj) + ' · ' + S.esc(p.desc.slice(0, 22)) + '…' },
                { h: closed ? U.badge('已修正', 'success') : '待整改' },
                { h: closed ? '已核对原始病历并修正字段' : '—' },
                { h: closed ? U.badge('通过', 'success') : U.badge('待复核', 'caution') }
              ]
            };
          }), { compact: true }),
        '原问题 → 被质控数据 → 整改后数据 → 整改说明 → 复核结果') +
        '<div style="height:12px"></div>' +
        U.note('整改病例逐个查看：点击患者可回到产生该问题的质控模块，核对被质控数据与规则判定。');
    } else if (ST.taskTab === 'feedback') {
      body = U.card('整改反馈与复核',
        U.kv([
          ['医疗机构反馈', S.esc(t.feedback || '尚未提交反馈')],
          ['整改材料', t.materials ? U.link(t.materials, 'l5:material') : '—'],
          ['质控中心复核意见', S.esc(t.review || '—')]
        ], 1)) +
        U.card('被质控数据', sampleDataTable(t.problems[0]));
    } else {
      var logs = [];
      t.problems.slice(0, 6).forEach(function (p) {
        p.logs.forEach(function (l) { logs.push([l.t, l.who, l.what, p.code]); });
      });
      logs.sort(function (a, b) { return a[0] < b[0] ? 1 : -1; });
      body = U.card('操作记录', U.table(['时间', '操作方', '内容', '关联问题'],
        logs.map(function (l) { return { cells: l }; }), { compact: true }));
    }

    return '<div class="qc-page">' +
      U.head('整改任务详情 · ' + t.id, t.name, 'l5', '⑤ 质控工作闭环',
        '<button class="btn btn-ghost btn-sm" data-qc="l5:backTasks">返回整改任务</button>' +
        '<button class="btn btn-ghost btn-sm" data-qc="l5:urge">催办</button>' +
        '<button class="btn btn-ghost btn-sm" data-qc="l5:review">复核</button>' +
        '<button class="btn btn-ghost btn-sm" data-qc="l5:reject">退回整改</button>' +
        '<button class="btn btn-primary btn-sm" data-qc="l5:closeTask">关闭任务</button>') +
      U.kpis([
        { l: '问题数量', v: S.fmt(t.problemCount), unit: '条', tone: 'info' },
        { l: '整改进度', v: S.f1(t.progress), unit: '%', tone: t.progress >= 80 ? 'up' : 'warn' },
        { l: '截止时间', v: t.dueDate, tone: 'info' },
        { l: '任务状态', v: t.status, tone: t.status === '已完成' ? 'up' : t.status === '已逾期' ? 'bad' : 'warn' }
      ], 4) +
      tabHtml + body +
      '</div>';
  }

  /* ==================================================================
   * 页面：抽查详情（下钻）
   * ================================================================== */
  function renderPlanDetail() {
    var plans = S.samplingPlans(), p = null;
    plans.forEach(function (x) { if (x.id === ST.planId) p = x; });
    if (!p) p = plans[0];
    var cases = S.samplingCases(p, { limit: 60 });

    /* 完整过程：抽查病例 → 被质控数据 → 指标检查 → 问题记录 → 整改 → 复核 */
    var flow = [
      { title: '抽查病例', date: p.start, desc: '共抽取 ' + S.fmt(p.total) + ' 例，已完成 ' + S.fmt(p.done) + ' 例', state: 'ok' },
      { title: '查看被质控数据', date: p.start, desc: '逐例核对诊疗记录、病案首页与登记信息', state: 'ok' },
      { title: '指标检查', date: p.start, desc: '按抽查项目（' + p.items.join('、') + '）执行质控规则', state: 'ok' },
      { title: '问题记录', date: p.start, desc: '发现问题 ' + S.fmt(p.problems) + ' 条', state: p.problems > 0 ? 'bad' : 'ok' },
      { title: '整改', date: p.start, desc: '下发整改要求并跟踪反馈', state: p.done > 0 ? 'ok' : 'miss' },
      { title: '复核', date: p.status === '已完成' ? p.end : '进行中', desc: p.status === '已完成' ? '抽查完成，问题闭环' : '等待抽查完成', state: p.status === '已完成' ? 'ok' : 'miss' }
    ];

    return '<div class="qc-page">' +
      U.head('抽查详情 · ' + p.name, p.scope + ' · ' + S.fmt(p.orgCount) + ' 家医疗机构',
        'l5', '⑤ 质控工作闭环',
        '<button class="btn btn-ghost btn-sm" data-qc="l5:backSampling">返回抽查管理</button>' +
        '<button class="btn btn-ghost btn-sm" data-qc="l5:record">记录问题</button>' +
        '<button class="btn btn-primary btn-sm" data-qc="l5:submit">提交抽查结果</button>') +
      U.kpis([
        { l: '抽查病例数', v: S.fmt(p.total), unit: '例', tone: 'info' },
        { l: '已完成数量', v: S.fmt(p.done), unit: '例', tone: 'up' },
        { l: '问题数量', v: S.fmt(p.problems), unit: '条', tone: 'bad' },
        { l: '完成状态', v: p.status, tone: p.status === '已完成' ? 'up' : 'warn' }
      ], 4) +
      U.grid2(
        U.card('抽查过程', U.timeline(flow), '完整过程展示'),
        U.card('抽查项目', U.kv(p.items.map(function (it) { return [it, U.badge('已检查', 'success')]; }), 1) +
          '<div style="height:10px"></div>' + U.note('抽查项目覆盖诊疗质量、病案编码与登记完整性。'))
      ) +
      U.card('抽查病例', U.table(
        ['患者', '医疗机构', '癌种', '抽查项目', '质控结果', '问题状态', '操作'],
        cases.map(function (c) {
          return {
            cls: c.v === 'ok' ? '' : 'abn-row',
            cells: [
              c.name, c.orgName, c.cancerName, c.item,
              { h: U.verdictBadge(c.v) },
              { h: c.problemStatus === '—' ? '—' : U.statusBadge(c.problemStatus) },
              { h: U.link('被质控数据', 'l5:dummy') }
            ]
          };
        }), { compact: true }), '抽查病例列表') +
      '</div>';
  }

  /* ==================================================================
   * 页面：闭环分析
   * ================================================================== */
  function renderAnalysis() {
    var k = S.loopKpi();
    var byOrg = S.loopByOrg();
    var byRegion = S.loopByRegion();
    var byType = S.loopByType();
    var trend = S.loopTrend();

    var kpiHtml = U.kpis([
      { l: '问题发现量', v: S.fmt(k.found), unit: '条', tone: 'info', m: '来自四个质控模块' },
      { l: '整改完成量', v: S.fmt(k.fixed), unit: '条', tone: 'up', m: '含待复核' },
      { l: '整改及时率', v: S.f1(k.timelyRate), unit: '%', tone: k.timelyRate >= 90 ? 'up' : 'warn', m: '按期完成整改' },
      { l: '复核完成率', v: S.f1(k.reviewRate), unit: '%', tone: k.reviewRate >= 80 ? 'up' : 'warn', m: '已完成复核' },
      { l: '问题闭环率', v: S.f1(k.closeRate), unit: '%', tone: k.closeRate >= 80 ? 'up' : 'warn', m: '已关闭 / 问题总数' },
      { l: '逾期问题数', v: S.fmt(k.overdue), unit: '条', tone: 'bad', m: '超过整改期限' }
    ], 6);

    /* 医疗机构分析 */
    var orgRows = byOrg.map(function (r) {
      return {
        cls: r.closeRate < 60 ? 'abn-row' : '',
        cells: [
          r.orgName, r.level,
          { h: S.fmt(r.count), cls: 'num' },
          { h: S.fmt(r.closed), cls: 'num' },
          { h: S.f1(r.onTimeRate) + '%', cls: 'num' },
          { h: U.progress(r.closeRate) },
          { h: S.fmt(r.overdue), cls: 'num' },
          { h: U.link('查看机构', 'l5:org:' + r.org) }
        ]
      };
    });
    var orgCard = U.card('医疗机构分析', U.table(
      ['医疗机构', '级别', '#问题数', '#已闭环', '#及时率', '#闭环率', '#逾期数', '操作'],
      orgRows, { compact: true }), '按闭环率排序（升序，便于发现问题机构）');

    /* 区域分析：省 → 市 → 区县 */
    var regionRows = byRegion.map(function (r) {
      return {
        cells: [
          r.name,
          { h: S.fmt(r.count), cls: 'num' },
          { h: S.fmt(r.closed), cls: 'num' },
          { h: U.progress(r.closeRate) },
          { h: S.fmt(r.counties.length) + ' 个区县', cls: 'num' },
          { h: U.link('查看区县', 'l5:region:' + r.code) }
        ]
      };
    });
    var regionCard = U.card('区域分析', U.table(
      ['设区市', '#问题数', '#已闭环', '#闭环率', '#下辖', '操作'],
      regionRows, { compact: true }), '省 → 市 → 区县 → 医疗机构');

    /* 问题类型分析 */
    var typeData = byType.map(function (t) { return { l: t.label, v: t.count }; });
    var typeCard = U.card('问题类型分析',
      U.barChart(typeData, { height: 170, unit: ' 条', colors: ['#244765', '#d98b2b', '#5b8def', '#9a7bc1'] }) +
      '<div style="height:12px"></div>' +
      U.table(['来源模块', '#问题数', '#已闭环', '#闭环率'],
        byType.map(function (t) {
          return {
            cells: [
              { h: '<span class="qc-tag ' + t.layer.toLowerCase() + '" style="height:22px;font-size:11px">' + S.esc(t.label) + '</span>' },
              { h: S.fmt(t.count), cls: 'num' },
              { h: S.fmt(t.closed), cls: 'num' },
              { h: U.progress(t.closeRate) }
            ]
          };
        }), { compact: true }), '四类质控问题分布');

    /* 趋势分析 */
    var trendCard = U.card('趋势分析',
      U.lineChart(null, {
        series: [
          { name: '问题发现', color: '#d1435b', points: trend.map(function (t) { return { l: t.l, v: t.found }; }) },
          { name: '整改完成', color: '#d98b2b', points: trend.map(function (t) { return { l: t.l, v: t.fixed }; }) },
          { name: '闭环', color: '#2e7d32', points: trend.map(function (t) { return { l: t.l, v: t.closed }; }) }
        ]
      }), '问题发现趋势 / 整改趋势 / 闭环趋势');

    return '<div class="qc-page">' +
      U.head('闭环分析', '查看整体质控工作完成情况，支持从统计结果下钻至区域/机构 → 问题 → 被质控数据 → 整改 → 复核。',
        'l5', '⑤ 质控工作闭环',
        '<button class="btn btn-ghost btn-sm" data-qc="l5:backCenter">质控问题中心</button>' +
        '<button class="btn btn-ghost btn-sm" data-qc="l5:export">导出数据</button>') +
      kpiHtml +
      U.grid2(orgCard, typeCard) +
      regionCard +
      trendCard +
      U.note('闭环追溯：从本页的机构或区域统计结果，可逐级下钻至具体问题、产生问题的被质控数据、整改过程与复核意见，' +
        '形成「看结果 → 看数据 → 看依据 → 处理问题 → 验证闭环」的完整链路。') +
      '</div>';
  }

  /* ==================================================================
   * 路由
   * ================================================================== */
  function render(pageId) {
    if (pageId === 'qc-g-loop') pageId = 'qc-l5-loop';
    if (pageId === 'qc-l5-loop') { ST.mainTab = ST.mainTab || 'problems'; return renderCenter(); }
    /* 整改任务 / 抽查管理 是问题中心的页签；旧路由 id 仍兼容（面包屑按问题中心展示）。 */
    if (pageId === 'qc-loop-tasks') { ST.mainTab = 'tasks'; return renderCenter(); }
    if (pageId === 'qc-loop-sampling') { ST.mainTab = 'sampling'; return renderCenter(); }
    if (pageId === 'qc-loop-problem') return renderProblem();
    if (pageId === 'qc-loop-task') return renderTaskDetail();
    if (pageId === 'qc-loop-plan') return renderPlanDetail();
    if (pageId === 'qc-loop-analysis') return renderAnalysis();
    return null;
  }

  /* ==================================================================
   * 交互
   * ================================================================== */
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest ? ev.target.closest('[data-qc]') : null;
    if (!el) return;
    var a = el.getAttribute('data-qc');
    if (a.indexOf('l5') !== 0 && a.indexOf('filter:') !== 0) return;
    if (a.indexOf('filter:') === 0 && a.indexOf('l5') < 0) return;

    /* --- 页签切换 --- */
    if (a.indexOf('l5:tab:') === 0) {
      ST.mainTab = a.split(':')[2];
      ST.page = 1;
      window.renderPage('qc-l5-loop');
      return;
    }

    /* --- 筛选 (仅问题清单页签拥有筛选栏) --- */
    if (a === 'filter:apply:l5' || a === 'filter:reset:l5') {
      if (a.indexOf('reset') > 0) { ST.layer = ''; ST.org = ''; ST.cancer = ''; ST.status = ''; ST.type = ''; }
      else {
        var box = el.closest('.qc-filter'), reads = box ? box.querySelectorAll('[data-qcf]') : [];
        for (var i = 0; i < reads.length; i++) {
          var k = reads[i].getAttribute('data-qcf'), v = reads[i].value;
          ST[k] = v === '全部' ? '' : v;
        }
      }
      ST.page = 1;
      ST.mainTab = 'problems';
      window.renderPage('qc-l5-loop');
      return;
    }

    /* --- 顶层 KPI 状态筛选 --- */
    if (a.indexOf('l5:status:') === 0) { ST.status = a.split(':')[2]; ST.page = 1; ST.mainTab = 'problems'; window.renderPage('qc-l5-loop'); return; }

    /* --- 返回 / 导航 --- */
    if (a === 'l5:backCenter') { ST.layer = ''; ST.org = ''; ST.cancer = ''; ST.status = ''; ST.type = ''; ST.mainTab = 'problems'; ST.page = 1; window.navigateTo('qc-l5-loop'); return; }
    if (a === 'l5:backTasks') { ST.page = 1; ST.mainTab = 'tasks'; window.renderPage('qc-l5-loop'); return; }
    if (a === 'l5:backSampling') { ST.page = 1; ST.mainTab = 'sampling'; window.renderPage('qc-l5-loop'); return; }
    if (a === 'l5:toAnalysis') { window.navigateTo('qc-loop-analysis'); return; }
    if (a === 'l5:export') { U.toast('已导出闭环分析数据（演示）'); return; }

    /* --- 整改任务页签的快速入口 --- */
    if (a === 'l5:toTasks') { ST.page = 1; ST.mainTab = 'tasks'; window.renderPage('qc-l5-loop'); return; }
    if (a === 'l5:toSampling') { ST.page = 1; ST.mainTab = 'sampling'; window.renderPage('qc-l5-loop'); return; }

    /* --- 问题详情 --- */
    if (a.indexOf('l5:problem:') === 0) { ST.probCode = a.slice('l5:problem:'.length); window.navigateTo('qc-loop-problem'); return; }
    if (a === 'l5:startFix') { U.toast('已发起整改，问题状态更新为「整改中」'); return; }

    /* --- 被质控数据下钻：回到对应质控模块 --- */
    if (a === 'l5:toData') {
      var p = null;
      S.problems().forEach(function (x) { if (x.code === ST.probCode) p = x; });
      if (p) {
        var page = LAYER_PAGE[p.layer];
        if (p.layer === 'L1' && p.objId) { window.qcL1.state.ind = p.objId; }
        if (p.layer === 'L2' && p.org) { window.qcL2.state.org = p.org; }
        if (p.layer === 'L3' && p.city) { window.qcL3.state.city = p.city; }
        U.toast('已跳转至「' + LAYER_LABEL[p.layer] + '」查看被质控数据');
        window.navigateTo(page);
      }
      return;
    }
    if (a.indexOf('l5:case:') === 0) {
      var key = a.slice('l5:case:'.length);
      window.qcL1.state.caseKey = key;
      window.navigateTo('qc-mcd-dtx');
      return;
    }

    /* --- 整改任务详情 --- */
    if (a.indexOf('l5:task:') === 0) { ST.taskId = a.split(':')[2]; ST.taskTab = 'info'; window.navigateTo('qc-loop-task'); return; }
    if (a.indexOf('l5:tasktab:') === 0) { ST.taskTab = a.split(':')[2]; window.renderPage('qc-loop-task'); return; }
    if (a === 'l5:newTask') { U.toast('已打开任务下发表单（演示）'); return; }
    if (a === 'l5:urge') { U.toast('已向医疗机构发送催办通知'); return; }
    if (a === 'l5:review') { U.toast('复核通过，相关问题状态更新为「已关闭」'); return; }
    if (a === 'l5:reject') { U.toast('已退回整改，请医疗机构重新提交材料'); return; }
    if (a === 'l5:closeTask') { U.toast('任务已关闭'); return; }
    if (a === 'l5:material') { U.toast('已打开整改材料（演示）'); return; }

    /* --- 抽查 --- */
    if (a.indexOf('l5:plan:') === 0) { ST.planId = a.split(':')[2]; window.navigateTo('qc-loop-plan'); return; }
    if (a === 'l5:newPlan') { U.toast('已打开抽查计划创建表单（演示）'); return; }
    if (a === 'l5:record') { U.toast('已记录抽查问题（演示）'); return; }
    if (a === 'l5:submit') { U.toast('抽查结果已提交'); return; }
    if (a === 'l5:dummy') { U.toast('已打开被质控数据（演示）'); return; }

    /* --- 区域 / 机构下钻 --- */
    if (a.indexOf('l5:region:') === 0) {
      var code = a.split(':')[2];
      ST.org = '';
      window.qcL3.state.city = code;
      U.toast('已跳转至「登记与随访数据质控」查看 ' + S.cityName(code) + ' 的问题');
      window.navigateTo('qc-l3-registry');
      return;
    }
    if (a.indexOf('l5:org:') === 0) {
      var org = a.split(':')[2];
      ST.layer = ST.layer || '';
      U.toast('已筛选机构 ' + (S.org(org) ? S.org(org).name : org) + ' 的问题');
      window.navigateTo('qc-l5-loop');
      ST.layer = ''; ST.org = org; ST.page = 1; ST.mainTab = 'problems';
      window.renderPage('qc-l5-loop');
      return;
    }

    /* --- 分页 --- */
    if (a.indexOf('l5:page:') === 0 || a.indexOf('l5t:page:') === 0 || a.indexOf('l5s:page:') === 0) {
      ST.page = parseInt(a.split(':')[2], 10) || 1;
      if (a.indexOf('l5t:') === 0) ST.mainTab = 'tasks';
      else if (a.indexOf('l5s:') === 0) ST.mainTab = 'sampling';
      else ST.mainTab = 'problems';
      window.renderPage('qc-l5-loop');
      return;
    }

    if (a === 'layer:toggle') {
      var b = el.closest('.qc-layer');
      if (b) {
        b.classList.toggle('collapsed');
        var ar = b.querySelector('.ar');
        if (ar) ar.textContent = b.classList.contains('collapsed') ? '展开 ▾' : '收起 ▴';
      }
    }
  });

  window.qcL5 = {
    pageIds: ['qc-g-loop', 'qc-l5-loop', 'qc-loop-problem',
      'qc-loop-task', 'qc-loop-plan', 'qc-loop-analysis'],
    render: render,
    meta: PAGE_META,
    state: ST
  };
})();
