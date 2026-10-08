/*
 * county-drill.js — 预警监测 ▸ 患者流向分析 · 省内分布（省→市→区县 三级下钻）
 *
 * 边界：本模块只呈现"就医流向"这一个维度（四分流构成 + 跨省流出率/例数 + 净外流 + 县域内）。
 * 登记量、粗率、MV%、随访率等登记质量口径在「登记运营监测」，不在这里重画。
 *
 * 三级下钻：
 *   Level 1 全省 —— 11 设区市流向表，点有区县数据的市进入市级
 *   Level 2 市级 —— 该市四分流构成 + 摘要 + 区县流向表（面包屑返回全省）
 * 区县级数据目前仅南昌、赣州两市为完整样例，其余市点击提示"区县级数据待接入"。
 *
 * 数值全部来自 window.DKH_DATA（.base / .county），本文件不做任何统计推算。
 * 对外：window.DKD = { render(), bind(root), pick(adcode) }
 */
(function () {
  'use strict';
  if (window.__DKD_LOADED) return;
  window.__DKD_LOADED = 1;

  function DD() { return window.DKH_DATA || null; }
  var S = { cityAdcode: '', sort: 'rate' };

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function f1(v) { return v == null || isNaN(v) ? '—' : (Math.round(v * 10) / 10).toFixed(1); }
  function fmt(n) { return (window.CK && CK.fmtInt) ? CK.fmtInt(n) : String(n); }
  function refresh() { if (window.DKUI) DKUI.refresh(); }
  function toast(m) { if (window.showToast) showToast(m); else if (window.toast) window.toast(m); }
  function panel(title, tools, body) {
    return '<section class="ck-panel"><header class="ck-p-head"><div class="ck-p-title">' + title +
      '</div><div class="ck-p-tools">' + (tools || '') + '</div></header>' + body + '</section>';
  }

  function cityList() { var d = DD(); return (d && d.base) || []; }
  function countyOf(adcode) { var d = DD(); return (d && d.county && d.county[adcode]) || null; }

  /* 四分流构成条（本县区内 / 市内跨县 / 省内跨市 / 跨省流出），恒等于 100% */
  function quadBar(out) {
    var seg = [
      { k: '本县区内', v: out.local, c: '#1f7ea8' },
      { k: '市内跨县', v: out.intraCity, c: '#2fa7b7' },
      { k: '省内跨市', v: out.crossCity, c: '#ffd166' },
      { k: '跨省流出', v: out.outProv, c: '#ff6f85' }
    ];
    return '<span class="dkd-quad" title="' + seg.map(function (s) { return s.k + ' ' + f1(s.v) + '%'; }).join(' · ') + '">' +
      seg.map(function (s) { return '<i style="flex:' + Math.max(0.01, s.v) + ';background:' + s.c + '"></i>'; }).join('') + '</span>';
  }

  function miniBar(v, max) {
    return '<span class="dkd-mini-bar"><i style="width:' + Math.min(100, v / (max || 1) * 100).toFixed(0) + '%"></i></span>';
  }

  function sortRows(rows, getOut, getCase) {
    return rows.slice().sort(function (a, b) {
      return S.sort === 'cases' ? getCase(b) - getCase(a) : getOut(b) - getOut(a);
    });
  }

  function sortSeg() {
    return '<span class="dkd-seg2">' +
      '<button class="' + (S.sort === 'rate' ? 'on' : '') + '" data-dkd-sort="rate">按流出率</button>' +
      '<button class="' + (S.sort === 'cases' ? 'on' : '') + '" data-dkd-sort="cases">按流出例数</button></span>';
  }

  /* ---------------- Level 1：全省 11 设区市流向表 ---------------- */
  function provTable(d) {
    var rows = sortRows(cityList(), function (x) { return x.out.outProv; }, function (x) { return x.outCases; });
    var maxOut = Math.max.apply(null, rows.map(function (x) { return x.out.outProv; }));
    var maxCase = Math.max.apply(null, rows.map(function (x) { return x.outCases; }));
    var head = '<thead><tr><th class="code">排名</th><th class="txt">地市</th>' +
      '<th class="dkd-quad-h">就医去向构成（本县区内 / 市内跨县 / 省内跨市 / 跨省）</th>' +
      '<th class="num">跨省流出率</th><th class="num">流出例数</th><th class="num">净外流率</th>' +
      '<th class="num">县域内</th><th class="num">省外流入</th></tr></thead>';
    var body = rows.map(function (r, i) {
      var net = Math.round((r.out.outProv - r.inRate) * 10) / 10;
      var can = !!countyOf(r.adcode);
      return '<tr' + (can ? ' class="dkd-click" data-dkd-city="' + r.adcode + '"' : ' class="dkd-flat"') + '>' +
        '<td><b class="dkd-rank' + (i < 3 ? ' r' + (i + 1) : '') + '">' + (i + 1) + '</b></td>' +
        '<td class="dkd-city-n">' + esc(r.name) +
        (can ? '<i class="dkd-has">下钻 ▸</i>' : '<i class="dkd-nodata">区县待接入</i>') + '</td>' +
        '<td>' + quadBar(r.out) + '</td>' +
        '<td class="t-right dkd-v">' + miniBar(r.out.outProv, maxOut) + f1(r.out.outProv) + '%</td>' +
        '<td class="t-right">' + fmt(r.outCases) + '</td>' +
        '<td class="t-right ' + (net > 0 ? 'dkd-bad' : 'dkd-good') + '">' + (net > 0 ? '+' : '') + f1(net) + '%</td>' +
        '<td class="t-right ' + (r.out.local < 30 ? 'dkd-bad' : '') + '">' + f1(r.out.local) + '%</td>' +
        '<td class="t-right ' + (r.inRate > 3 ? 'dkd-good' : '') + '">' + f1(r.inRate) + '%</td>' +
        '</tr>';
    }).join('');
    var p = d.prov;
    body += '<tr class="dkd-total"><td></td><td>全省合计</td>' +
      '<td>' + quadBar({ local: p.localShare, intraCity: p.intraCityShare, crossCity: p.crossCityShare, outProv: p.outRate }) + '</td>' +
      '<td class="t-right dkd-v">' + f1(p.outRate) + '%</td>' +
      '<td class="t-right">' + fmt(p.outCases) + '</td>' +
      '<td class="t-right dkd-bad">+' + f1(p.netOutRate) + '%</td>' +
      '<td class="t-right">' + f1(p.localShare) + '%</td>' +
      '<td class="t-right">' + f1(p.inRate) + '%</td></tr>';
    return panel('11 个设区市 · 就医流向', sortSeg(),
      '<div class="ck-tblwrap dkv-wrap"><table class="ck-tbl dkv-tbl dkd-tbl">' + head + '<tbody>' + body + '</tbody></table></div>');
  }

  /* ---------------- Level 2：市级概览 + 区县流向表 ---------------- */
  function cityHead(cc, base) {
    var out = base.out, net = Math.round((out.outProv - base.inRate) * 10) / 10;
    var seg = [
      { k: '本县区内', v: out.local, c: '#1f7ea8' },
      { k: '市内跨县', v: out.intraCity, c: '#2fa7b7' },
      { k: '省内跨市', v: out.crossCity, c: '#ffd166' },
      { k: '跨省流出', v: out.outProv, c: '#ff6f85' }
    ];
    var bar = '<div class="dkd-cityquad">' + seg.map(function (s) {
      return '<div class="dkd-cq-seg" style="flex:' + Math.max(0.01, s.v) + ';background:' + s.c + '"><b>' + f1(s.v) + '%</b><span>' + s.k + '</span></div>';
    }).join('') + '</div>';
    var stats = [
      { l: '跨省流出率', v: f1(out.outProv) + '%', tone: out.outProv >= 10 ? 'bad' : out.outProv >= 9 ? 'warn' : '' },
      { l: '跨省流出例数', v: fmt(base.outCases) + ' 例', tone: '' },
      { l: '净外流率', v: (net > 0 ? '+' : '') + f1(net) + '%', tone: net > 0 ? 'bad' : 'good' },
      { l: '县域内就诊率', v: f1(out.local) + '%', tone: out.local < 30 ? 'bad' : '' },
      { l: '省外流入率', v: f1(base.inRate) + '%', tone: base.inRate > 3 ? 'good' : '' }
    ];
    var cards = '<div class="dkd-citystats">' + stats.map(function (s) {
      return '<div class="dkd-cs' + (s.tone ? ' ' + s.tone : '') + '"><span>' + s.l + '</span><b>' + s.v + '</b></div>';
    }).join('') + '</div>';
    return panel(esc(cc.cityName) + ' · 就医去向构成', '', bar + cards);
  }

  function countyTable(cc) {
    var rows = sortRows(cc.counties, function (x) { return x.out.outProv; }, function (x) { return x.outCases; });
    var maxOut = Math.max.apply(null, rows.map(function (x) { return x.out.outProv; }));
    var maxCase = Math.max.apply(null, rows.map(function (x) { return x.outCases; }));
    var head = '<thead><tr><th class="code">排名</th><th class="txt">区县</th>' +
      '<th class="dkd-quad-h">就医去向构成</th>' +
      '<th class="num">跨省流出率</th><th class="num">流出例数</th><th class="num">净外流率</th>' +
      '<th class="num">县域内</th><th class="num">省外流入</th></tr></thead>';
    var body = rows.map(function (r, i) {
      var net = Math.round((r.out.outProv - r.inRate) * 10) / 10;
      return '<tr>' +
        '<td><b class="dkd-rank' + (i < 3 ? ' r' + (i + 1) : '') + '">' + (i + 1) + '</b></td>' +
        '<td class="dkd-city-n">' + esc(r.n) + '</td>' +
        '<td>' + quadBar(r.out) + '</td>' +
        '<td class="t-right dkd-v">' + miniBar(r.out.outProv, maxOut) + f1(r.out.outProv) + '%</td>' +
        '<td class="t-right">' + fmt(r.outCases) + '</td>' +
        '<td class="t-right ' + (net > 0 ? 'dkd-bad' : 'dkd-good') + '">' + (net > 0 ? '+' : '') + f1(net) + '%</td>' +
        '<td class="t-right ' + (r.out.local < 30 ? 'dkd-bad' : '') + '">' + f1(r.out.local) + '%</td>' +
        '<td class="t-right ' + (r.inRate > 3 ? 'dkd-good' : '') + '">' + f1(r.inRate) + '%</td>' +
        '</tr>';
    }).join('');
    return panel(esc(cc.cityName) + ' · 区县流向明细（' + rows.length + ' 个）', sortSeg(),
      '<div class="ck-tblwrap dkv-wrap"><table class="ck-tbl dkv-tbl dkd-tbl">' + head + '<tbody>' + body + '</tbody></table></div>');
  }

  function crumbs() {
    var cc = countyOf(S.cityAdcode);
    return '<div class="dkd-crumbs"><button data-dkd-back class="' + (cc ? '' : 'cur') + '">全省</button>' +
      (cc ? '<span class="sep">▸</span><span class="cur">' + esc(cc.cityShort || cc.cityName) + '</span>' : '') + '</div>';
  }

  function render() {
    var d = DD();
    if (!d) return '<div class="dkv"><div class="dkv-empty">未加载 DKH_DATA</div></div>';
    var cc = countyOf(S.cityAdcode);
    if (S.cityAdcode && !cc) S.cityAdcode = '';
    if (cc) {
      var base = cityList().filter(function (x) { return x.adcode === S.cityAdcode; })[0];
      return '<div class="dkv">' + crumbs() + cityHead(cc, base) + countyTable(cc) + '</div>';
    }
    return '<div class="dkv">' + crumbs() + provTable(d) + '</div>';
  }

  function bind(root) {
    var sc = root || document;
    sc.querySelectorAll('[data-dkd-sort]').forEach(function (b) {
      b.onclick = function () { S.sort = b.getAttribute('data-dkd-sort'); refresh(); };
    });
    sc.querySelectorAll('[data-dkd-city]').forEach(function (tr) {
      tr.onclick = function () { S.cityAdcode = tr.getAttribute('data-dkd-city'); refresh(); };
    });
    sc.querySelectorAll('tr.dkd-flat').forEach(function (tr) {
      tr.onclick = function () { toast('该地市区县级流向数据待接入'); };
    });
    sc.querySelectorAll('[data-dkd-back]').forEach(function (b) {
      b.onclick = function () { S.cityAdcode = ''; refresh(); };
    });
  }

  window.DKD = {
    render: render,
    bind: bind,
    pick: function (adcode) { S.cityAdcode = countyOf(adcode) ? adcode : ''; },
    state: S
  };

  /* 本模块自有样式（表格结构、面板与双模式皮肤复用 decision-views.js） */
  var css = [
    '.dkd-tbl{min-width:860px;table-layout:auto}',
    '.dkd-tbl th,.dkd-tbl td{padding:9px 12px}',
    '.dkd-tbl th.dkd-quad-h{min-width:220px}',
    '.dkd-click{cursor:pointer}',
    '.dkd-flat{cursor:pointer}',
    '.dkd-tbl tr.on td{font-weight:700}',
    '.dkd-tbl tr.dkd-total td{font-weight:700;border-top:2px solid var(--dk-line)}',
    '.dkd-v{font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}',
    '.dkd-city-n{white-space:nowrap}',
    '.dkd-mini-bar{display:inline-block;width:42px;height:5px;border-radius:3px;margin-right:7px;vertical-align:middle;overflow:hidden}',
    '.dkd-has{font-style:normal;margin-left:8px;font-size:11px;opacity:.7}',
    '.dkd-nodata{font-style:normal;margin-left:8px;font-size:10.5px;opacity:.45}',
    '.dkd-rank{display:inline-block;min-width:20px;text-align:center;font-weight:700}',
    /* 四分流构成条（表格行内） */
    '.dkd-quad{display:flex;height:14px;width:100%;border-radius:3px;overflow:hidden}',
    '.dkd-quad i{display:block;height:100%}',
    /* 市级四分流大条 */
    '.dkd-cityquad{display:flex;height:54px;margin:12px;border-radius:6px;overflow:hidden;gap:2px}',
    '.dkd-cq-seg{display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:0;color:#08202f;font-weight:700;overflow:hidden}',
    '.dkd-cq-seg b{font-size:15px;line-height:1.1;font-variant-numeric:tabular-nums}',
    '.dkd-cq-seg span{font-size:10.5px;white-space:nowrap;opacity:.85}',
    '.dkd-citystats{display:grid;grid-template-columns:repeat(5,1fr);gap:9px;padding:0 12px 12px}',
    '@media(max-width:900px){.dkd-citystats{grid-template-columns:repeat(2,1fr)}}',
    '.dkd-cs{border:1px solid var(--dk-line);border-radius:6px;padding:9px 11px;border-left:3px solid #6b89ad}',
    '.dkd-cs span{display:block;font-size:11px;opacity:.7}',
    '.dkd-cs b{display:block;margin-top:3px;font-size:18px;font-variant-numeric:tabular-nums}',
    '.dkd-cs.bad{border-left-color:#e11d48}.dkd-cs.warn{border-left-color:#d97706}.dkd-cs.good{border-left-color:#15803d}',
    '.dkd-crumbs{display:flex;align-items:center;gap:8px;font-size:13px}',
    '.dkd-crumbs button{appearance:none;border:0;background:transparent;font-family:inherit;cursor:pointer;padding:2px 0;font-size:13px}',
    '.dkd-crumbs .cur{font-weight:700;cursor:default}',
    '.dkd-seg2{display:inline-flex;border:1px solid var(--dk-line2);border-radius:4px;overflow:hidden}',
    '.dkd-seg2 button{appearance:none;border:0;background:transparent;color:inherit;padding:3px 11px;font-size:12.5px;cursor:pointer;font-family:inherit;opacity:.75}',
    '.dkd-seg2 button.on{font-weight:700;opacity:1}',
    /* 浅色 */
    '.dkr .dkd-mini-bar{background:#eef2f7}.dkr .dkd-mini-bar i{display:block;height:100%;background:linear-gradient(90deg,#6b89ad,#e11d48)}',
    '.dkr .dkd-tbl tr.dkd-click:hover td{background:#f1f7ff}',
    '.dkr .dkd-tbl tr.dkd-total td{background:#f8fafc}',
    '.dkr .dkd-has{color:#3d5a80}.dkr .dkd-nodata{color:#94a3b8}',
    '.dkr .dkd-good{color:#15803d}.dkr .dkd-bad{color:#e11d48}',
    '.dkr .dkd-cs b{color:#1b2432}',
    '.dkr .dkd-crumbs button{color:#3d5a80}.dkr .dkd-crumbs .cur{color:#1b2432}.dkr .dkd-crumbs .sep{color:#94a3b8}',
    '.dkr .dkd-seg2 button.on{background:#e8f2ff;color:#31496a}',
    /* 深色 */
    '.dks .dkd-mini-bar{background:rgba(120,190,255,.12)}.dks .dkd-mini-bar i{display:block;height:100%;background:linear-gradient(90deg,#186288,#ff6f85)}',
    '.dks .dkd-tbl tr.dkd-click:hover td{background:rgba(95,225,240,.1)}',
    '.dks .dkd-tbl tr.dkd-total td{background:rgba(14,44,74,.6)}',
    '.dks .dkd-has{color:#5fe1f0}.dks .dkd-nodata{color:#5f7c99}',
    '.dks .dkd-good{color:#6ee7b7}.dks .dkd-bad{color:#ff8fa3}',
    '.dks .dkd-cs b{color:#eafaff}',
    '.dks .dkd-crumbs button{color:#5fe1f0}.dks .dkd-crumbs .cur{color:#eafaff}.dks .dkd-crumbs .sep{color:#5f7c99}',
    '.dks .dkd-seg2 button.on{background:linear-gradient(180deg,#1a6fa0,#124a72);color:#eafaff}',
    '.dks .dkd-rank.r1,.dks .dkd-rank.r2,.dks .dkd-rank.r3{color:#ffd166}'
  ].join('');
  var st = document.createElement('style'); st.id = 'dkd-style'; st.textContent = css;
  if (document.head) document.head.appendChild(st);
})();
