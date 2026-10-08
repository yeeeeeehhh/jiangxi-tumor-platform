/*
 * registry-ops.js — 登记运营监测（菜单：数据统计 ▸ 业务监测 ▸ 登记运营监测）
 *
 * 为什么要独立于 cockpit-module.js：
 *   本页讲的是"登记业务跑得顺不顺"（工作流流转、上报及时率、录入积压、地市运营排名），
 *   与「预警监测」讲"哪些指标越线了、要派单处置"（A/B/C 三层规则引擎）不是一回事。
 *   此前它挂在「预警监测 ▸ 登记运营监测」下，两处问题已经实际发生：
 *     ① 阈值双标：本页 MV 70 / DCO 5，而同菜单的预警记录是 MV 66 / DCO 15（CI5 与年报口径），
 *        同一个指标在相邻两页给出相反结论；质控侧早已统一到 66/15，本页是第三套。
 *     ② 两页共用一个 mount()，ckExport 导出的永远是预警总览那 12 列（点"导出运营指标"
 *        拿到的是预警表），ckRefresh 的 toast 固定写"预警数据已刷新"。
 *   现在本页自带状态 / 骨架 / 导出 / 刷新，大屏态也独立，与预警模块互不串页。
 *
 * 迁移注意：只挪菜单归属，**不改名**。菜单文案与页头标题沿用「登记运营监测」，
 *   改名会让老用户按记忆找不到入口——那正是本次要修的毛病，不能自己再犯一次。
 *
 * 口径约定：
 *   质控阈值一律从 warning-module.js 的 B 层规则取（单一事实来源），本模块不再硬编码。
 *   地市基线与派生口径复用 cockpit-module.js 导出的 window.CKData，不另存一份 META。
 *   本页只讲"登记业务跑得顺不顺"（工作流、过程指标、地市运营排名）。
 *   预警的判定与派单归「预警监测」：本页不再嵌入在办预警列表（2026-09-29 按评审意见删除），
 *   预警状态请到「预警监测 ▸ 预警记录 / 处置工单」查看，两处不再各画一份。
 */
(function () {
  'use strict';
  if (window.__ROPS_LOADED) return;
  window.__ROPS_LOADED = 1;

  var PAGE = 'registry-ops';
  var D = window.CKData;
  if (!D) { console.warn('[registry-ops] cockpit-module.js 未加载，登记运营看板暂不可用'); return; }

  var META = D.META, CODES = D.CODES, YEARS = D.YEARS;
  var CUR_YEAR = D.CUR_YEAR, CUR_MONTH = D.CUR_MONTH;
  var esc = D.esc, clamp = D.clamp, fmtInt = D.fmtInt, f1 = D.f1, f2 = D.f2;
  var hash = D.hash, rnd = D.rnd;

  var ST = { year: CUR_YEAR, city: '', fs: false };
  if (CUR_MONTH < 6) ST.year = CUR_YEAR - 1;

  /* ---------- 质控阈值：唯一事实来源 = warning-module.js B 层规则 ----------
     注意：预警模块的种子定义里字段叫 threshold，落库后统一为 thresholdValue，
     这里两个都认；都取不到才退回兜底值（并保持与 B 层一致的 66 / 15）。 */
  function ruleThreshold(id, fallback) {
    try {
      if (typeof window.findRule === 'function') {
        var r = window.findRule(id);
        if (r) {
          if (typeof r.thresholdValue === 'number') return r.thresholdValue;
          if (typeof r.threshold === 'number') return r.threshold;
        }
      }
    } catch (e) { /* 预警模块未就绪时退回兜底值 */ }
    return fallback;
  }
  var TH = {
    mv: ruleThreshold('B-MV-LOW', 66),    // IARC CI5 收录参考下限
    dco: ruleThreshold('B-DCO-HIGH', 15), // 中国肿瘤登记年报 上限
    ub: ruleThreshold('B-UB-HIGH', 5),
    fu: 85,    // 随访完成率目标（运营目标，非国家考核线）
    tim: 95,   // 上报及时率目标
    dup: 3,    // 重卡率上限
    miss: 2,   // 漏报率上限
    nccr: 96   // 国家平台上报率目标
  };

  function panelHead(title, tools) {
    return '<header class="ck-p-head"><div class="ck-p-title">' + title + '</div><div class="ck-p-tools">' + (tools || '') + '</div></header>';
  }
  function scopeLabel() { return ST.city ? META[ST.city].f : '全省'; }
  function cur(year) { return D.agg(ST.city ? [ST.city] : CODES, year || ST.year); }
  function cutoff() { return D.cutoffFor(ST.year); }

  /* ==================== 1. 登记工作流状态 · 本月流转 ==================== */
  function flowPanel() {
    var r = cur();
    var scale = (r.cards / 190);
    var mNew = Math.round(18462 * scale);
    var mEntry = Math.round(mNew * 0.988), mEntryBacklog = mNew - mEntry;
    var mA = Math.round(mEntry * 0.982), mAback = mEntry - mA;
    var mB = Math.round(mA * 0.988), mBback = mA - mB;
    var mProv = mB, mNat = Math.round(mB * 0.995);
    var steps = [
      { n: '数据来源', d: 'HIS / 公卫 / 疾控直报', v: mNew, note: '本月新增', tone: 'good' },
      { n: '录入', d: '医院 / 县区录入岗', v: mEntry, note: '积压 ' + fmtInt(mEntryBacklog), tone: mEntryBacklog > 300 ? 'warn' : 'good' },
      { n: '初审', d: '县区疾控', v: mA, note: '退回 ' + fmtInt(mAback), tone: 'good' },
      { n: '终审', d: '省疾控登记条线', v: mB, note: '复核中 ' + fmtInt(mBback), tone: 'good' },
      { n: '上报省中心', d: '省内集中库', v: mProv, note: '已上报 100%', tone: 'good' },
      { n: '上报国家中枢', d: '国家肿瘤登记平台', v: mNat, note: '待补 ' + fmtInt(mProv - mNat), tone: 'warn' }
    ];
    return '<section class="ck-panel ck-flowpanel">' +
      panelHead('登记工作流状态 · 本月流转', '<span class="ck-panel-meta">' + ST.year + ' 年 · 截至 ' + cutoff() + '</span>') +
      '<div class="ck-flowbody">' +
      steps.map(function (s, i) {
        var conv = i === 0 ? 100 : (s.v / steps[i - 1].v * 100);
        return '<div class="ck-flowstep tone-' + s.tone + '">' +
          (i > 0 ? '<div class="ck-flow-arrow"><span>' + f1(conv) + '%</span></div>' : '') +
          '<div class="ck-flowbox">' +
          '<div class="ck-flowstep-n">' + s.n + '</div>' +
          '<div class="ck-flowstep-v">' + fmtInt(s.v) + '<em>张</em></div>' +
          '<div class="ck-flowstep-note">' + s.note + '</div>' +
          '<div class="ck-flowstep-d">' + s.d + '</div>' +
          '</div></div>';
      }).join('') + '</div></section>';
  }

  /* ==================== 2. 登记运营红绿灯 · 流程层指标 ==================== */
  function lightStrip() {
    var r = cur(), v = D.view(r, 'inc');
    function lamp(val, tgt, dir) {
      var s = dir === 'down' ? (tgt - val) / (tgt || 1) : (val - tgt) / (tgt || 1);
      return s >= 0 ? 'good' : (s >= -0.08 ? 'warn' : 'bad');
    }
    var dup = r.dup, bu = 1.8 + (hash('m' + ST.year) % 10) / 10;
    var tim = 96.2 - (hash('t' + ST.year) % 30) / 10;
    var cards = [
      { k: '登记卡数', v: fmtInt(v.cards), u: '张', sub: '本省年度累计录入', lamp: 'good', go: 'datamgmt-card' },
      { k: '上报及时率', v: f1(tim), u: '%', sub: '月内上报占比 · 目标 ≥ ' + TH.tim + '%', lamp: lamp(tim, TH.tim, 'up'), go: 'warning-records' },
      { k: '重卡率', v: f1(dup), u: '%', sub: '重复录入占比 · 目标 ≤ ' + TH.dup + '%', lamp: lamp(dup, TH.dup, 'down'), go: 'quality-dup-card' },
      { k: '漏报率', v: f1(bu), u: '%', sub: '未登记占比 · 目标 ≤ ' + TH.miss + '%', lamp: lamp(bu, TH.miss, 'down'), go: 'warning-records' },
      { k: 'DCO 占比', v: f1(r.dco), u: '%', sub: '死亡推断源病例 · 考核上限 ' + TH.dco + '%', lamp: lamp(r.dco, TH.dco, 'down'), go: 'analysis-quality' },
      { k: 'MV%', v: f1(r.mv), u: '%', sub: '病理确认率 · 收录下限 ' + TH.mv + '%', lamp: lamp(r.mv, TH.mv, 'up'), go: 'analysis-quality' }
    ];
    return '<section class="ck-opswrap"><div class="ck-opswrap-h">' +
      '<span class="ck-opswrap-t">登记运营红绿灯 · 流程层指标</span>' +
      '<span class="ck-opswrap-s">' + scopeLabel() + ' · ' + ST.year + ' 年</span>' +
      '</div><div class="ck-opsstrip">' +
      cards.map(function (c) {
        return '<div class="ck-opscard lamp-' + c.lamp + '">' +
          '<div class="ck-ops-k">' + c.k + '</div>' +
          '<div class="ck-ops-v">' + c.v + '<em>' + c.u + '</em></div>' +
          '<div class="ck-ops-s">' + c.sub + '</div>' +
          '<div class="ck-ops-f"><button class="ck-ops-btn" onclick="navigateTo(\'' + c.go + '\')">处置 ›</button></div>' +
          '</div>';
      }).join('') + '</div></section>';
  }

  /* ==================== 3. 11 地市登记运营质控矩阵 ==================== */
  function qkPanel() {
    var rows = CODES.map(function (c) { return D.build(c, ST.year); });
    function cell(val, tgt, dir) {
      var ok = dir === 'down' ? val <= tgt : val >= tgt;
      var band = dir === 'down' ? val <= tgt * 1.1 : val >= tgt * 0.92;
      return '<td class="ck-heat ' + (ok ? 'lv-good' : (band ? 'lv-warn' : 'lv-bad')) + '">' + val.toFixed(1) + '</td>';
    }
    var body = rows.map(function (r) {
      return '<tr class="' + (ST.city === r.code ? 'on' : '') + '" data-ro-pick="' + r.code + '">' +
        '<td class="ck-city"><b>' + META[r.code].f + '</b></td>' +
        cell(r.mv, TH.mv, 'up') +
        cell(r.dco, TH.dco, 'down') +
        cell(r.ub, TH.ub, 'down') +
        cell(r.dup, TH.dup, 'down') +
        cell(r.fu, TH.fu, 'up') +
        cell(r.nccr, TH.nccr, 'up') +
        '</tr>';
    }).join('');
    return '<section class="ck-panel ck-qk">' +
      panelHead('11 地市登记运营质控矩阵', '<span class="ck-panel-meta">绿=达标 · 黄=临界 · 红=未达标</span>') +
      '<div class="ck-heatwrap"><table class="ck-heattbl"><thead><tr>' +
      '<th class="ck-city-th">设区市</th><th>MV% ≥' + TH.mv + '</th><th>DCO% ≤' + TH.dco + '</th>' +
      '<th>UB% ≤' + TH.ub + '</th><th>重卡% ≤' + TH.dup + '</th><th>随访% ≥' + TH.fu + '</th><th>上报% ≥' + TH.nccr + '</th>' +
      '</tr></thead><tbody>' + body + '</tbody></table></div></section>';
  }

  /* ==================== 4. 逐月登记卡录入量 ==================== */
  function monthPanel() {
    var r = cur();
    var mr = rnd(hash('opsm' + (ST.city || 'all') + ST.year));
    var W = 460, H = 210, PL = 42, PR = 12, PT = 14, PB = 24;
    var base = D.view(r, 'inc').months;
    var target = base.map(function (v) { return v * 1.12; });
    var vals = base.map(function (x, i) { return (ST.year === CUR_YEAR && i >= CUR_MONTH) ? 0 : x * (1.12 + (mr() - .5) * .08); });
    var hi = Math.max.apply(null, vals.concat(target)) * 1.15 || 1;
    var iw = W - PL - PR, ih = H - PT - PB, bw = iw / 12 * .5;
    var out = '';
    for (var t = 1; t <= 3; t++) {
      var yy = PT + ih - ih * t / 3;
      out += '<line x1="' + PL + '" x2="' + (W - PR) + '" y1="' + yy.toFixed(1) + '" y2="' + yy.toFixed(1) + '" stroke="rgba(120,190,255,.1)"/>' +
        '<text x="' + (PL - 5) + '" y="' + (yy + 3.5).toFixed(1) + '" text-anchor="end" class="ck-ax">' + fmtInt(hi * t / 3) + '</text>';
    }
    function X(i) { return PL + iw / 12 * (i + .5); }
    function Y(v) { return PT + ih - v / hi * ih; }
    vals.forEach(function (val, i) {
      var cx = X(i), hh = val / hi * ih;
      out += '<rect x="' + (cx - bw / 2).toFixed(1) + '" y="' + (PT + ih - hh).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(0, hh).toFixed(1) + '" rx="1.5" fill="url(#ckOpsBar)" opacity="' + (i + 1 === CUR_MONTH ? '1' : '.82') + '"/>';
      out += '<text x="' + cx.toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle" class="ck-ax">' + (i + 1) + '</text>';
    });
    out += '<path d="' + target.map(function (v, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); }).join('') + '" fill="none" stroke="#ffd166" stroke-width="1.4" stroke-dasharray="4 3" opacity=".85"/>';
    return '<section class="ck-panel">' + panelHead(ST.year + ' 年逐月登记卡录入量') +
      '<svg class="ck-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
      '<defs><linearGradient id="ckOpsBar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#66e8f7"/><stop offset="1" stop-color="#1a6c9c"/></linearGradient></defs>' +
      out + '</svg>' +
      '<div class="ck-legend"><span><i style="background:#5fe1f0"></i>实际登记量（张）</span><span><i style="background:#ffd166"></i>计划目标</span></div></section>';
  }

  /* ==================== 5. 地市运营明细 ==================== */
  /* 表格与导出共用 opsRow()，避免此前"导出运营指标"却导出预警表的问题 */
  function opsRow(code) {
    var r = D.build(code, ST.year), prev = D.build(code, ST.year - 1);
    var rr = rnd(hash('opstbl' + ST.year + code));
    var yoy = (r.cards - prev.cards) / (prev.cards || 1) * 100;
    return {
      code: code, name: r.full, hosp: r.hosp, cards: r.cards, yoy: yoy,
      tim: clamp(96.2 - (hash('t' + ST.year + code) % 60) / 10, 88, 99),
      dup: r.dup,
      miss: clamp(1.6 + (hash('b' + code) % 22) / 10, .8, 4.2),
      ret: clamp(1.2 + (hash('r' + code) % 30) / 10, .5, 5.5),
      backlog: Math.round(80 + rr() * 320),
      pending: r.warnPending
    };
  }
  function tablePanel() {
    var body = CODES.map(function (c) {
      var r = opsRow(c);
      function cell(val, ok) { return '<td class="ck-num' + (ok === undefined ? '' : ok ? ' good' : ' bad') + '">' + val + '</td>'; }
      return '<tr class="' + (ST.city === r.code ? 'on' : '') + '" data-ro-pick="' + r.code + '">' +
        '<td class="ck-city"><b>' + esc(r.name) + '</b><em>机构 ' + r.hosp + ' 家</em></td>' +
        '<td class="ck-num strong">' + fmtInt(r.cards) + '</td>' +
        '<td class="ck-num ' + (r.yoy >= 0 ? 'good' : 'bad') + '">' + (r.yoy >= 0 ? '▲' : '▼') + f1(Math.abs(r.yoy)) + '%</td>' +
        cell(f1(r.tim) + '%', r.tim >= TH.tim) +
        cell(f1(r.dup) + '%', r.dup <= TH.dup) +
        cell(f1(r.miss) + '%', r.miss <= TH.miss) +
        cell(f1(r.ret) + '%', r.ret <= 3) +
        cell(fmtInt(r.backlog), r.backlog <= 200) +
        cell(fmtInt(r.pending), r.pending <= 12) +
        '<td class="ck-op"><button class="ck-link" data-ro-pick="' + r.code + '">聚焦</button></td>' +
        '</tr>';
    }).join('');
    return '<section class="ck-panel">' + panelHead(ST.year + ' 年各地市登记运营明细',
      '<button class="ck-btn" onclick="roExport()">导出运营指标</button>') +
      '<div class="ck-tblwrap"><table class="ck-tbl"><thead><tr>' +
      '<th>地市</th><th class="ck-num">登记卡数</th><th class="ck-num">同比</th><th class="ck-num">及时率</th>' +
      '<th class="ck-num">重卡率</th><th class="ck-num">漏报率</th><th class="ck-num">初审退回率</th>' +
      '<th class="ck-num">录入积压</th><th class="ck-num">待处置</th><th>操作</th>' +
      '</tr></thead><tbody>' + body + '</tbody></table></div></section>';
  }

  /* ==================== 7. 骨架与交互 ==================== */
  function header() {
    return '<header class="ck-head"><div class="ck-brand">' +
      '<div class="ck-logo"><svg viewBox="0 0 32 32"><path d="M16 2l12 6v9c0 7-5.4 11.6-12 13.8C9.4 28.6 4 24 4 17V8z" fill="none" stroke="#5fe1f0" stroke-width="1.6" opacity=".85"/>' +
      '<path d="M10 17h3l2-5 3 9 2-4h3" fill="none" stroke="#ffd166" stroke-width="1.8" stroke-linecap="round"/></svg></div>' +
      '<div class="ck-title"><h1>江西省肿瘤登记运营监测</h1>' +
      '<div class="ck-title-sub"><span class="ck-live"><i></i>实时</span><span class="ck-sub-txt">登记业务流水线 · 数据流转与质量</span></div></div></div>' +
      '<div class="ck-tools">' +
      '<label class="ck-tool">年度<select class="ck-sel" data-ro="year">' + YEARS.slice().reverse().map(function (yy) {
        return '<option value="' + yy + '"' + (yy === ST.year ? ' selected' : '') + '>' + yy + '</option>';
      }).join('') + '</select></label>' +
      '<select class="ck-sel" data-ro="city"><option value="">全省 11 个设区市</option>' + CODES.map(function (c) {
        return '<option value="' + c + '"' + (ST.city === c ? ' selected' : '') + '>' + META[c].f + '</option>';
      }).join('') + '</select>' +
      '<span class="ck-clock" id="roClock"></span>' +
      '<button class="ck-btn" onclick="roRefresh()">刷新</button>' +
      '<button class="ck-btn primary" onclick="roToggleFs()">' + (ST.fs ? '退出大屏' : '大屏模式') + '</button>' +
      '</div></header>';
  }
  function shell() {
    return '<div class="ck ck-ro' + (ST.fs ? ' fs' : '') + '">' + header() +
      flowPanel() + lightStrip() +
      '<div class="ck-grid ck-grid-ops">' +
      '<div class="ck-col ck-col-c">' + qkPanel() + '</div>' +
      '<div class="ck-col">' + monthPanel() + '</div>' +
      '</div>' +
      '<div class="ck-tbl-row">' + tablePanel() + '</div>' +
      '<footer class="ck-foot"><span>' + scopeLabel() + ' · ' + ST.year + ' 年度 · 数据截至 ' + cutoff() +
      ' ｜ 质控阈值取自预警模块 B 层规则（MV ' + TH.mv + ' / DCO ' + TH.dco + '）</span>' +
      '<button class="ck-btn" onclick="roExport()">导出运营指标</button></footer>' +
      '</div>';
  }

  var timer = null;
  function tick() {
    var el = document.getElementById('roClock');
    if (!el) { if (timer) clearInterval(timer); timer = null; return; }
    var d = new Date();
    el.textContent = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) + ' ' +
      ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2);
  }
  function mount() {
    var box = document.getElementById('pageContainer');
    if (!box) return;
    box.innerHTML = shell();
    bind();
    var main = document.getElementById('mainContent');
    if (main) main.scrollTop = 0;
    tick();
    if (timer) clearInterval(timer);
    timer = setInterval(tick, 1000);
  }
  function rerender() { mount(); }

  function bind() {
    document.querySelectorAll('#pageContainer [data-ro-pick]').forEach(function (el) {
      el.addEventListener('click', function () {
        var c = el.getAttribute('data-ro-pick');
        if (!c) return;
        ST.city = ST.city === c ? '' : c;
        rerender();
        toast(ST.city ? '已聚焦 ' + META[ST.city].f + '（再次点击该市返回全省）' : '已返回全省视角');
      });
    });
    document.querySelectorAll('#pageContainer [data-ro]').forEach(function (el) {
      el.addEventListener('change', function () {
        var k = el.getAttribute('data-ro');
        if (k === 'year') ST.year = +el.value;
        if (k === 'city') ST.city = el.value;
        rerender();
      });
    });
  }

  function roCity(code) { ST.city = code || ''; rerender(); }
  function roToggleFs() {
    ST.fs = !ST.fs;
    document.body.classList.toggle('ck-fs', ST.fs);
    rerender();
    toast(ST.fs ? '已进入大屏模式，按 Esc 退出' : '已退出大屏模式');
  }
  function roRefresh() { rerender(); toast('运营数据已刷新'); }

  /* 导出：与表格同源（opsRow），表头与列数严格对齐 */
  function roExport() {
    var head = ['地市', '登记卡数', '同比%', '及时率%', '重卡率%', '漏报率%', '初审退回率%', '录入积压', '待处置预警'];
    var rows = CODES.map(function (c) {
      var r = opsRow(c);
      return [r.name, r.cards, f1(r.yoy), f1(r.tim), f1(r.dup), f1(r.miss), f1(r.ret), r.backlog, r.pending].join('\t');
    });
    var total = rows.reduce(function (a, r) { return a + r.backlog; }, 0);
    try {
      var ta = document.createElement('textarea');
      ta.value = ST.year + ' 年 ' + scopeLabel() + ' 登记运营指标\n' + head.join('\t') + '\n' + rows.join('\n') +
        '\n合计\t\t\t\t\t\t\t' + fmtInt(total) + '\n';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      toast('运营指标已复制到剪贴板（' + CODES.length + ' 个地市）');
    } catch (e) { toast('复制失败，请改用 Excel 打开后手动导出', 'error'); }
  }

  /* ==================== 8. 样式（仅本页专属；ck 基础样式由 cockpit-module.js 提供） ==================== */  var css = [
    '.ck-opswrap{margin:12px 20px 0;border:1px solid var(--line);border-radius:8px;background:linear-gradient(180deg,rgba(14,44,74,.5),rgba(7,20,34,.6));overflow:hidden}',
    '.ck-opswrap-h{display:flex;align-items:baseline;justify-content:space-between;padding:9px 14px;border-bottom:1px solid var(--line)}',
    '.ck-opswrap-t{font-size:13px;font-weight:700;color:#dff3ff;letter-spacing:.6px}',
    '.ck-opswrap-s{font-size:11px;color:var(--mu)}',
    '.ck-opsstrip{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;padding:12px 14px}',
    '.ck-opscard{position:relative;padding:12px 13px 10px;border:1px solid var(--line);border-radius:7px;background:rgba(9,26,44,.55);overflow:hidden}',
    '.ck-opscard::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--cy)}',
    '.ck-opscard.lamp-good::before{background:#34d399}.ck-opscard.lamp-warn::before{background:#fbbf24}.ck-opscard.lamp-bad::before{background:#fb7185}',
    '.ck-ops-k{font-size:12px;color:var(--mu);letter-spacing:.4px}',
    '.ck-ops-v{margin-top:5px;font-size:24px;font-weight:800;color:#eafaff;font-variant-numeric:tabular-nums;line-height:1.1}',
    '.ck-ops-v em{font-style:normal;font-size:12px;font-weight:400;color:var(--mu);margin-left:3px}',
    '.ck-opscard.lamp-bad .ck-ops-v{color:#ff8fa3}.ck-opscard.lamp-warn .ck-ops-v{color:#ffd166}',
    '.ck-ops-s{margin-top:5px;font-size:10.5px;color:#8fa6c0;line-height:1.35}',
    '.ck-ops-f{margin-top:8px}',
    '.ck-ops-btn{appearance:none;border:1px solid var(--line2);border-radius:4px;background:rgba(18,58,96,.4);color:#9fd8f2;font-size:11px;padding:3px 9px;cursor:pointer;font-family:inherit}',
    '.ck-ops-btn:hover{border-color:var(--cy);color:#eafcff}',
    '.ck-flowpanel{margin-top:0}',
    '.ck-flowbody{display:flex;align-items:stretch;padding:14px 14px 16px;gap:2px;overflow-x:auto}',
    '.ck-flowstep{display:flex;align-items:center;flex:1;min-width:0}',
    '.ck-flow-arrow{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 6px;color:var(--mu)}',
    '.ck-flow-arrow span{font-size:11px;color:#9fd8f2;font-variant-numeric:tabular-nums}',
    '.ck-flow-arrow::after{content:"→";display:block;font-size:14px;color:var(--line2);margin-top:2px}',
    '.ck-flowbox{flex:1;min-width:0;padding:11px 12px;border:1px solid var(--line);border-radius:7px;background:rgba(9,26,44,.55);position:relative;overflow:hidden}',
    '.ck-flowstep.tone-good .ck-flowbox{border-top:2px solid #34d399}',
    '.ck-flowstep.tone-warn .ck-flowbox{border-top:2px solid #fbbf24}',
    '.ck-flowstep.tone-bad .ck-flowbox{border-top:2px solid #fb7185}',
    '.ck-flowstep-n{font-size:12px;color:#cfe4f7;font-weight:600}',
    '.ck-flowstep-v{margin-top:5px;font-size:19px;font-weight:800;color:#eafaff;font-variant-numeric:tabular-nums;line-height:1.1}',
    '.ck-flowstep-v em{font-style:normal;font-size:11px;font-weight:400;color:var(--mu);margin-left:3px}',
    '.ck-flowstep-note{margin-top:4px;font-size:10.5px;color:#9fd8f2}',
    '.ck-flowstep-d{margin-top:3px;font-size:10px;color:var(--mu)}',
    '.ck-heatwrap{padding:6px 10px 10px;overflow:auto;max-height:430px}',
    '.ck-heattbl{width:100%;border-collapse:separate;border-spacing:3px;font-size:12px}',
    '.ck-heattbl th{position:sticky;top:0;z-index:2;background:#0d2c48;color:#a9c9e6;font-weight:600;font-size:11.5px;padding:7px 6px;text-align:center;white-space:nowrap}',
    '.ck-heattbl th.ck-city-th{text-align:left}',
    '.ck-heattbl td{padding:7px 6px;text-align:center;border-radius:4px;font-variant-numeric:tabular-nums;color:#eafaff}',
    '.ck-heattbl td.ck-city{text-align:left;background:transparent;color:#dff3ff}',
    '.ck-heattbl td.ck-city b{font-size:12.5px}',
    '.ck-heattbl tbody tr{cursor:pointer}',
    '.ck-heattbl tbody tr:hover td.ck-city{color:var(--cy)}',
    '.ck-heattbl tr.on td.ck-city b{color:var(--gd)}',
    '.ck-heat.lv-good{background:rgba(52,211,153,.18);color:#8ff0c8}',
    '.ck-heat.lv-warn{background:rgba(251,191,36,.2);color:#ffdd8a}',
    '.ck-heat.lv-bad{background:rgba(251,113,133,.22);color:#ffa7b6;font-weight:700}',
    '@media(max-width:1400px){.ck-opsstrip{grid-template-columns:repeat(3,1fr)}}',
    '@media(max-width:900px){.ck-opsstrip{grid-template-columns:repeat(2,1fr)}}'
  ].join('');
  var stEl = document.createElement('style');
  stEl.id = 'ro-style';
  stEl.textContent = css;
  document.head.appendChild(stEl);

  /* ==================== 9. 路由接线 ==================== */
  window.roCity = roCity;
  window.roToggleFs = roToggleFs;
  window.roRefresh = roRefresh;
  window.roExport = roExport;
  window.registryOpsPageIds = [PAGE];
  // 对外入口：roOpen({city:'360700',year:2025}) 直达并预置筛选
  window.roOpen = function (opts) {
    opts = opts || {};
    if (opts.year && YEARS.indexOf(+opts.year) >= 0) ST.year = +opts.year;
    if (opts.city !== undefined) ST.city = META[opts.city] ? opts.city : '';
    if (typeof window.navigateTo === 'function') window.navigateTo(PAGE); else mount();
  };

  /* 本模块只拦自己的一页；大屏态是"离开本页必须清理"的隐式契约：
     本页内切换筛选保留大屏，出去到别的模块一律清掉（与 cockpit-module.js 同一约定，
     此前两页共用 mount 导致互相重画对方骨架）。 */
  var _origRender = window.renderPage;
  if (typeof _origRender === 'function') {
    window.renderPage = function (id) {
      if (id === PAGE) { mount(); return; }
      document.body.classList.remove('ck-fs');
      if (ST.fs) { ST.fs = false; }
      return _origRender.apply(this, arguments);
    };
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && ST.fs && document.body.classList.contains('ck-fs')) roToggleFs();
  });
})();
