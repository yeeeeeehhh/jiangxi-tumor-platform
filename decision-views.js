/*
 * decision-views.js — 数据统计 ▸ 领导决策：患者流向（省级与省际）
 *
 * 边界（本轮重构定稿）：
 *   - 本模块只呈现"预警监测/专科画像给不了"的内容：跨省就医流向。
 *   - 已有展示位置的指标不重画：行内挂跳转箭头，点了去原模块。
 *   - 数值全部来自 window.DKH_DATA（全站唯一事实源，由 gen-decision-kpi.js 生成），
 *     本模块不携带人口、阈值等第二套常量。
 *
 * 对外：window.DKV = { render(view), bind() }

 */
(function () {
  'use strict';
  if (window.__DKV_LOADED) return;
  window.__DKV_LOADED = 1;

  function DD() { return window.DKH_DATA || null; }
  var S = { destProv: '' };   // destProv: 流向图选中的去向省份

  /* ---------------- 通用小工具 ---------------- */
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(/[,%\s]/g, '')); return isNaN(n) ? null : n; }
  function round1(x) { return Math.round(x * 10) / 10; }
  function f1(v) { return (Math.round(v * 10) / 10).toFixed(1); }
  function fmt(n) { return (window.CK && CK.fmtInt) ? CK.fmtInt(n) : String(n); }
  function panel(title, tools, body) {
    return '<section class="ck-panel"><header class="ck-p-head"><div class="ck-p-title">' + title +
      '</div><div class="ck-p-tools">' + (tools || '') + '</div></header>' + body + '</section>';
  }
  function noData() { return '<div class="dkv"><div class="dkv-empty">DKH_DATA</div></div>'; }

  /* ============================================================
   * 视图：患者跨区域就医流向（省级与省际；市级与区县在流向·地市与区县页）
   * ============================================================ */
  function flowView() {
    var d = DD(); if (!d) return noData();
    var p = d.prov;
    return '<div class="dkv">' +
      panel('就医去向四分流 · 分母 ' + fmt(p.cases) + ' 例', '', splitBar(p)) +
      '<div class="dkv-cols">' +
      panel('跨省流出去向 ' + fmt(p.outCases) + ' 例', '点击去向省份查看承接详情', flowMap(d)) +
      panel('省际流出 / 流入 ' + d.provOut.length + ' 省样本', '', provBars(d)) +
      '</div>' +
      destDetailPanel(d) +
      panel('病种流出谱 · ' + d.siteOut.length + ' 病种', '按跨省流出率降序；红 ≥15% · 橙 ≥10%', siteOutTable(d)) +
      panel('11 地市跨省流出排名', '按跨省流出率降序；色阶同地图四档', cityRankBlock(d)) +
      panel('流向归因小结', '', attributionBlock(d)) +
      '</div>';
  }

  /* 去向省份承接详情：点击流向图/图例某省后展开，展示占比、例数、主要接诊机构、主要病种 */
  function destDetailPanel(d) {
    var list = d.outToProv;
    var sel = S.destProv || (list[0] && list[0]['流向省份']) || '';
    var chips = '<div class="dkv-dest-chips">' + list.map(function (o) {
      var name = o['流向省份'];
      return '<button class="dkv-dest-chip' + (name === sel ? ' on' : '') + '" data-dkv-dest="' + esc(name) + '">' +
        esc(name.replace('市', '').replace('省', '')) + '<em>' + esc(o['占跨省流出比']) + '</em></button>';
    }).join('') + '</div>';
    var o = list.filter(function (x) { return x['流向省份'] === sel; })[0] || list[0];
    var cases = num(o['病例数']) || 0;
    var body = '<div class="dkv-dest-body">' +
      '<div class="dkv-dest-nums">' +
      '<div class="dkv-dest-n"><span>流出例数</span><b>' + fmt(cases) + '</b><em>例</em></div>' +
      '<div class="dkv-dest-n"><span>占跨省流出</span><b>' + esc(o['占跨省流出比']) + '</b></div>' +
      '<div class="dkv-dest-n"><span>占全省新发</span><b>' + f1(cases / d.prov.cases * 100) + '%</b></div>' +
      '</div>' +
      '<div class="dkv-dest-kv"><span class="dkv-dest-lb">主要接诊机构</span><div class="dkv-dest-tags">' +
      String(o['主要接诊机构'] || '').split(/[、,，]/).filter(Boolean).map(function (t) { return '<span class="dkv-tag">' + esc(t.trim()) + '</span>'; }).join('') +
      '</div></div>' +
      '<div class="dkv-dest-kv"><span class="dkv-dest-lb">主要外流病种</span><div class="dkv-dest-tags">' +
      String(o['主要病种'] || '').split(/[、,，]/).filter(Boolean).map(function (t) { return '<span class="dkv-tag site">' + esc(t.trim()) + '</span>'; }).join('') +
      '</div></div>' +
      '</div>';
    return panel('承接详情 · ' + esc(sel.replace('市', '').replace('省', '')), chips, body);
  }

  function splitBar(p) {
    var seg = [
      { k: '本县（市、区）内', v: p.localShare, c: '#1f7ea8' },
      { k: '本市内跨县', v: p.intraCityShare, c: '#2fa7b7' },
      { k: '省内跨市', v: p.crossCityShare, c: '#ffd166' },
      { k: '跨省流出', v: p.outRate, c: '#ff6f85' }
    ];
    return '<div class="dkv-split">' + seg.map(function (s) {
      return '<div class="dkv-seg" style="flex:' + s.v + ';background:' + s.c + '"><b>' + s.v + '%</b><span>' + s.k + '</span></div>';
    }).join('') + '</div>' +
      '<div class="dkv-split-foot">' +
      '<span>省内合计 <b>' + p.inProvShare + '%</b>（' + fmt(p.cases - p.outCases) + ' 例）</span>' +
      '<span class="hl">跨省流出 <b>' + p.outRate + '%</b>（' + fmt(p.outCases) + ' 例）</span>' +
      '<span>省外流入 <b>' + p.inRate + '%</b>（' + fmt(p.inCases) + ' 例）</span>' +
      '<span class="bad">净外流 <b>' + p.netOutRate + '%</b></span>' +
      '</div>';
  }

  function provBars(d) {
    var max = 13;
    var h = '<div class="dkv-bars"><div class="dkv-bar dkv-bhead"><span></span><span>省份</span><span>跨省流出率</span><span></span><span>省外流入</span><span>净流入</span></div>';
    d.provOut.forEach(function (r) {
      var out = num(r['跨省流出率']), inf = num(r['省外流入率']), net = num(r['净流入率']);
      var self = r['省份'] === '江西省';
      h += '<div class="dkv-bar' + (self ? ' self' : '') + '">' +
        '<span class="dkv-bk">' + r['全国排名'] + '</span>' +
        '<span class="dkv-bn">' + esc(r['省份']) + '</span>' +
        '<span class="dkv-bt"><i style="width:' + (out / max * 100).toFixed(1) + '%"></i></span>' +
        '<span class="dkv-bv">' + f1(out) + '%</span>' +
        '<span class="dkv-bin">' + f1(inf) + '%</span>' +
        '<span class="dkv-bnet ' + (net >= 0 ? 'good' : 'bad') + '">' + (net >= 0 ? '+' : '') + f1(net) + '%</span>' +
        '</div>';
    });
    return h + '</div>';
  }

  /* 流向示意图：中心为江西真实边界（jx-geo.js），四周为去向省份的示意锚点
     锚点按地理方位布放，不按真实投影 */
  function flowMap(d) {
    var p = d.prov, out = d.outToProv;
    var anchors = {
      '北京市': [0.46, 0.04], '上海市': [0.97, 0.30], '江苏省': [0.93, 0.13], '浙江省': [0.97, 0.52],
      '福建省': [0.86, 0.80], '广东省': [0.52, 0.97], '湖南省': [0.10, 0.66], '湖北省': [0.06, 0.30], '其他省份': [0.10, 0.06]
    };
    var W = 520, H = 360;
    var g = window.CK && window.CK.GEO, geo = null;
    if (g && g.cities) {
      var b = g.bbox, mid = (b[1] + b[3]) / 2, c = Math.cos(mid * Math.PI / 180), k = 106, pad = 10;
      var gw = (b[2] - b[0]) * c * k + pad * 2, gh = (b[3] - b[1]) * k + pad * 2;
      geo = { x: function (lng) { return (W - gw) / 2 + (lng - b[0]) * c * k + pad; }, y: function (la) { return (H - gh) / 2 + (b[3] - la) * k + pad; } };
    }
    var maxCases = Math.max.apply(null, out.map(function (o) { return num(o['病例数']) || 0; }));
    var cx = W * 0.5, cy = H * 0.52;
    var paths = out.map(function (o) {
      var name = o['流向省份'];
      var a = anchors[name] || [0.9, 0.5];
      var tx = W * a[0], ty = H * a[1];
      var w = 1 + (num(o['病例数']) || 0) / maxCases * 7;
      var mx = (cx + tx) / 2 + (tx - cx) * 0.12, my = (cy + ty) / 2 - Math.abs(tx - cx) * 0.18;
      var on = name === S.destProv;
      var col = on ? '#ff8f4d' : name === '上海市' ? '#63e2e6' : name === '北京市' ? '#ffd166' : '#8fb6d8';
      return '<g class="dkv-flowline" data-dkv-dest="' + esc(name) + '" style="cursor:pointer">' +
        '<path d="M' + f1(cx) + ' ' + f1(cy) + ' Q' + f1(mx) + ' ' + f1(my) + ' ' + f1(tx) + ' ' + f1(ty) + '" ' +
        'stroke="' + col + '" stroke-width="' + f1(on ? w + 1.5 : w) + '" fill="none" opacity="' + (on ? '1' : '.72') + '" stroke-linecap="round"/>' +
        '<circle cx="' + f1(tx) + '" cy="' + f1(ty) + '" r="' + f1((on ? 4.5 : 3) + w / 2) + '" fill="' + col + '" opacity="' + (on ? '1' : '.9') + '"/>' +
        '<text class="dkv-fp' + (on ? ' on' : '') + '" x="' + f1(tx) + '" y="' + f1(ty - 9 - w / 2) + '" text-anchor="' + (tx > W * 0.75 ? 'end' : tx < W * 0.25 ? 'start' : 'middle') + '">' +
        esc(name.replace('市', '')) + ' <tspan>' + esc(o['占跨省流出比']) + '</tspan></text></g>';
    }).join('');
    var map = '';
    if (geo) {
      map = g.cities.map(function (ct) {
        var base = d.base.filter(function (x) { return x.adcode === ct.code; })[0];
        var o = base ? base.out.outProv : 8;
        var fill = o >= 10.5 ? 'rgba(255,111,133,.55)' : o >= 9 ? 'rgba(255,209,102,.42)' : o >= 8 ? 'rgba(95,225,240,.28)' : 'rgba(110,231,183,.3)';
        var dd = '';
        ct.rings.forEach(function (poly) {
          poly.forEach(function (ring) {
            for (var i = 0; i < ring.length; i++) dd += (i ? 'L' : 'M') + f1(geo.x(ring[i][0])) + ' ' + f1(geo.y(ring[i][1]));
            dd += 'Z';
          });
        });
        return '<path d="' + dd + '" fill="' + fill + '" stroke="rgba(150,210,255,.5)" stroke-width=".8" data-dkv-city="' + ct.code + '" class="ck-geo"><title>' +
          esc(ct.full) + ' 跨省流出 ' + f1(o) + '% ｜ ' + fmt(base ? base.outCases : 0) + ' 例</title></path>' +
          '<text class="dkv-fc" x="' + f1(geo.x(ct.centroid[0])) + '" y="' + f1(geo.y(ct.centroid[1])) + '">' + esc(ct.name) + '</text>';
      }).join('');
    }
    return '<div class="dkv-mapwrap"><svg class="dkv-map" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">' +
      (map || '') + paths + '<text class="dkv-fj" x="' + f1(cx) + '" y="' + f1(cy + 4) + '">江西</text></svg>' +
      '<div class="dkv-lg"><span><i style="background:rgba(110,231,183,.5)"></i>&lt;8%</span><span><i style="background:rgba(95,225,240,.4)"></i>8~9%</span>' +
      '<span><i style="background:rgba(255,209,102,.5)"></i>9~10.5%</span><span><i style="background:rgba(255,111,133,.6)"></i>≥10.5%</span>' +
      '<span class="dim">线宽＝流出例数</span></div></div>';
  }

  /* ============================================================
   * 流向扩展：病种流出谱 / 地市排名 / 归因小结
   * ============================================================ */

  /* 病种流出谱：14 病种按跨省流出率降序，带横向条形 */
  function siteOutTable(d) {
    var rows = d.siteOut.slice().sort(function (a, b) {
      return num(b['跨省流出率']) - num(a['跨省流出率']);
    });
    var max = Math.max.apply(null, rows.map(function (r) { return num(r['跨省流出率']) || 0; }));
    var head = '<tr><th>病种</th><th class="t-right">新发例数</th><th class="t-right">占全部发病</th>' +
      '<th>跨省流出率</th><th class="t-right">流出例数</th><th class="t-right">早诊率 I+II</th><th class="t-right">次均住院费</th></tr>';
    var body = rows.map(function (r) {
      var rate = num(r['跨省流出率']) || 0;
      var cls = rate >= 15 ? ' dkv-site-high' : rate >= 10 ? ' dkv-site-mid' : '';
      var w = (rate / max * 100).toFixed(1);
      return '<tr>' +
        '<td class="dkv-site-name">' + esc(r['病种']) + '</td>' +
        '<td class="t-right">' + fmt(num(r['新发例数'])) + '</td>' +
        '<td class="t-right">' + esc(r['占全部发病']) + '</td>' +
        '<td><div class="dkv-bar-cell"><i style="width:' + w + '%"></i></div><span class="dkv-bar-v' + cls + '">' + esc(r['跨省流出率']) + '</span></td>' +
        '<td class="t-right">' + fmt(num(r['跨省流出例数'])) + '</td>' +
        '<td class="t-right">' + esc(r['早诊率I加II期']) + '</td>' +
        '<td class="t-right">' + fmt(num(r['次均住院费用元'])) + ' 元</td>' +
        '</tr>';
    }).join('');
    return '<table class="dkv-site-tbl"><thead>' + head + '</thead><tbody>' + body + '</tbody></table>';
  }

  /* 11 地市跨省流出排名：按流出率降序，条形着色同地图四档 */
  function cityRankBlock(d) {
    var rows = d.cityRows.slice().sort(function (a, b) {
      return num(b['跨省流出率']) - num(a['跨省流出率']);
    });
    var max = Math.max.apply(null, rows.map(function (r) { return num(r['跨省流出率']) || 0; }));
    var head = '<tr><th>排名</th><th>地市</th><th>跨省流出率</th><th class="t-right">流出例数</th>' +
      '<th class="t-right">县域内就诊率</th><th class="t-right">省外流入率</th><th class="t-right">省内机构数</th></tr>';
    var body = rows.map(function (r, i) {
      var rate = num(r['跨省流出率']) || 0;
      var fill = rate >= 10.5 ? 'rgba(255,111,133,.55)' : rate >= 9 ? 'rgba(255,209,102,.42)' : rate >= 8 ? 'rgba(95,225,240,.28)' : 'rgba(110,231,183,.3)';
      var w = (rate / max * 100).toFixed(1);
      return '<tr>' +
        '<td class="dkv-rank">' + (i + 1) + '</td>' +
        '<td class="dkv-city-n">' + esc(r['地市']) + '</td>' +
        '<td><div class="dkv-bar-cell"><i style="width:' + w + '%;background:' + fill + '"></i></div><span class="dkv-bar-v">' + esc(r['跨省流出率']) + '</span></td>' +
        '<td class="t-right">' + fmt(num(r['跨省流出例数'])) + '</td>' +
        '<td class="t-right">' + esc(r['县域内就诊率']) + '</td>' +
        '<td class="t-right">' + esc(r['省外流入率']) + '</td>' +
        '<td class="t-right">' + esc(r['省内医疗机构数']) + '</td>' +
        '</tr>';
    }).join('');
    return '<table class="dkv-site-tbl"><thead>' + head + '</thead><tbody>' + body + '</tbody></table>';
  }

  /* 流向归因小结：聚合关键数字的结论面板（仅保留有真实数据支撑的指标） */
  function attributionBlock(d) {
    var p = d.prov;
    var top3 = d.outToProv.slice(0, 3);
    var top3Sum = top3.reduce(function (s, o) { return s + num(o['占跨省流出比']); }, 0);
    var top3Site = d.siteOut.slice().sort(function (a, b) { return num(b['跨省流出率']) - num(a['跨省流出率']); }).slice(0, 3);
    var attrs = [
      { k: '净外流', v: p.netOutRate + '%', d: fmt(p.outCases) + ' 例出 / ' + fmt(p.inCases) + ' 例入', tone: 'bad' },
      { k: '前 3 去向占比', v: round1(top3Sum) + '%', d: top3.map(function (o) { return o['流向省份'].replace('市', '') + ' ' + o['占跨省流出比']; }).join(' · '), tone: '' },
      { k: '前 3 流出病种', v: top3Site[0]['跨省流出率'] + ' / ' + top3Site[1]['跨省流出率'] + ' / ' + top3Site[2]['跨省流出率'], d: top3Site.map(function (s) { return s['病种']; }).join(' · '), tone: 'bad' }
    ];
    return '<div class="dkv-attr-grid">' + attrs.map(function (a) {
      var tc = a.tone === 'bad' ? ' dkv-attr-bad' : a.tone === 'warn' ? ' dkv-attr-warn' : '';
      return '<div class="dkv-attr-item' + tc + '"><span class="dkv-attr-k">' + a.k + '</span>' +
        '<b class="dkv-attr-v">' + a.v + '</b><em class="dkv-attr-d">' + a.d + '</em></div>';
    }).join('') + '</div>';
  }

  /* ---------------- 交互绑定 ---------------- */
  function bind() {
    var box = document.getElementById('pageContainer'); if (!box) return;
    box.querySelectorAll('[data-dkv-city]').forEach(function (el) {
      el.addEventListener('click', function (ev) {
        var code = ev.currentTarget.getAttribute('data-dkv-city');
        if (window.DKD && DKD.pick) DKD.pick(code);
        if (window.DKUI && DKUI.setFlowTab) DKUI.setFlowTab('city');
        if (window.navigateTo) window.navigateTo('decision-flow');
      });
    });
    /* 流向图 / 图例点选去向省份 → 更新承接详情面板 */
    box.querySelectorAll('[data-dkv-dest]').forEach(function (el) {
      el.addEventListener('click', function (ev) {
        ev.preventDefault(); ev.stopPropagation();
        S.destProv = ev.currentTarget.getAttribute('data-dkv-dest');
        if (window.DKUI && DKUI.refresh) DKUI.refresh();
      });
    });
  }

  window.DKV = {
    render: function () { return flowView(); },
    bind: bind,
    state: S
  };

  /* ---------------- 样式：结构共用 + 双模式皮肤 ---------------- */
  var css = [
    /* 结构 */
    '.dkv{display:flex;flex-direction:column;gap:14px}',
    '.dkv-cols{display:grid;grid-template-columns:1.05fr .95fr;gap:14px}',
    '@media (max-width:1280px){.dkv-cols{grid-template-columns:1fr}}',
    '.t-right{text-align:right}.t-center{text-align:center}',
    /* 四分流 */
    '.dkv-split{display:flex;height:56px;margin:12px}',
    '.dkv-seg{display:flex;flex-direction:column;justify-content:center;align-items:center;gap:1px;min-width:0;border-right:1px solid rgba(255,255,255,.35);overflow:hidden}',
    '.dkv-seg b{font-size:16px;color:#fff;font-weight:800;line-height:1.1;text-shadow:0 1px 2px rgba(0,0,0,.25)}',
    '.dkv-seg span{font-size:11px;color:rgba(255,255,255,.95);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}',
    '.dkv-split-foot{display:flex;flex-wrap:wrap;gap:10px 22px;padding:0 12px 10px;font-size:12.5px}',
    '.dkv-split-foot b{font-variant-numeric:tabular-nums}',
    '.dkv-split-foot .hl b{color:#e11d48}.dkv-split-foot .bad b{color:#e11d48}',
    /* 省际条 */
    '.dkv-bars{padding:8px 12px}',
    '.dkv-bar{display:grid;grid-template-columns:26px 1fr 96px 52px 52px 58px;align-items:center;gap:8px;padding:3px 0;font-size:12.5px;font-variant-numeric:tabular-nums}',
    '.dkv-bhead{font-size:11px;opacity:.65;letter-spacing:.2px}',
    '.dkv-bhead span:nth-child(n+3){text-align:right}',
    '.dkv-bk{opacity:.6;text-align:right}',
    '.dkv-bt{height:7px;border-radius:4px;overflow:hidden}',
    '.dkv-bt i{display:block;height:100%}',
    '.dkv-bv{text-align:right;font-weight:700}',
    '.dkv-bin{text-align:right;opacity:.7}',
    '.dkv-bnet{text-align:right}',
    /* 地图 */
    '.dkv-mapwrap{padding:6px 12px 10px}',
    '.dkv-map{display:block;width:100%;height:auto;max-height:360px}',
    '.dkv-fp{font-size:11px;font-weight:600}.dkv-fp tspan{font-weight:700}',
    '.dkv-fp.on{font-weight:800}',
    '.dkv-flowline:hover text{font-weight:800}',
    /* 承接详情面板 */
    '.dkv-dest-chips{display:flex;flex-wrap:wrap;gap:6px}',
    '.dkv-dest-chip{appearance:none;border:1px solid var(--dk-line2);background:transparent;color:inherit;font-family:inherit;cursor:pointer;border-radius:14px;padding:3px 11px;font-size:12px;display:inline-flex;align-items:center;gap:5px}',
    '.dkv-dest-chip em{font-style:normal;opacity:.6;font-variant-numeric:tabular-nums}',
    '.dkv-dest-body{padding:12px 14px}',
    '.dkv-dest-nums{display:flex;gap:26px;flex-wrap:wrap;margin-bottom:12px}',
    '.dkv-dest-n span{display:block;font-size:11.5px;opacity:.65}',
    '.dkv-dest-n b{font-size:24px;font-weight:800;font-variant-numeric:tabular-nums}',
    '.dkv-dest-n em{font-style:normal;font-size:12px;opacity:.6;margin-left:3px}',
    '.dkv-dest-kv{display:flex;align-items:flex-start;gap:12px;padding:8px 0;border-top:1px solid var(--dk-line)}',
    '.dkv-dest-lb{flex:0 0 92px;font-size:12.5px;opacity:.7;padding-top:3px}',
    '.dkv-dest-tags{display:flex;flex-wrap:wrap;gap:6px}',
    '.dkv-tag{font-size:12px;padding:2px 9px;border-radius:4px;border:1px solid var(--dk-line2)}',
    '.dkv-fc{font-size:9px;text-anchor:middle;pointer-events:none}',
    '.dkv-fj{font-size:13px;text-anchor:middle;font-weight:800;opacity:.7}',
    '.ck-geo{cursor:pointer}.ck-geo:hover{filter:brightness(1.3)}',
    '.dkv-lg{display:flex;flex-wrap:wrap;gap:12px;font-size:11.5px;padding:4px 0 0}',
    '.dkv-lg span{display:flex;align-items:center;gap:4px}.dkv-lg i{width:12px;height:8px;border-radius:2px;display:inline-block}',
    '.dkv-empty{padding:48px;text-align:center;font-size:13px}',
    /* ===== 查阅模式（浅色，默认）===== */
    '.ck.dkr{--dk-line:#dfe5ec;--dk-line2:#c7d0dc;--dk-tx:#1b2432;--dk-mu:#667085;--dk-bg:#f3f6fa;--dk-surface:#fff;--dk-accent:#3d5a80;',
    'position:relative;margin:-20px;padding:0 0 20px;background:var(--dk-bg);color:var(--dk-tx);',
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",Arial,sans-serif}',
    '.ck.dkr::before{display:none}',
    '.dkr .ck-panel{background:var(--dk-surface);border:1px solid var(--dk-line);border-radius:8px;box-shadow:0 1px 2px rgba(16,24,40,.05);padding:0 0 6px;animation:none}',
    '.dkr .ck-panel::before,.dkr .ck-panel::after{display:none}',
    '.dkr .ck-p-head{border-bottom:1px solid var(--dk-line);padding:13px 16px}',
    '.dkr .ck-p-title{color:var(--dk-tx);font-size:14.5px;letter-spacing:0;padding-left:10px}',
    '.dkr .ck-p-title::before{background:var(--dk-accent)}',
    '.dkr .ck-p-tools{display:flex;align-items:center;gap:8px;color:var(--dk-mu)}',
    '.dkr .dkv-split-foot{color:#4e5a6e}',
    '.dkr .dkv-bt{background:#eef2f7}.dkr .dkv-bt i{background:linear-gradient(90deg,#6b89ad,#e11d48)}',
    '.dkr .dkv-bnet.good{color:#15803d}.dkr .dkv-bnet.bad{color:#e11d48}',
    '.dkr .dkv-bar.self{background:rgba(61,90,128,.07);border-radius:4px}',
    '.dkr .dkv-fp{fill:#1b2432}.dkr .dkv-fp tspan{fill:#b45309}.dkr .dkv-fc{fill:#475569}.dkr .dkv-fj{fill:#1b2432}',
    '.dkr .dkv-fp.on{fill:#c2410c}',
    '.dkr .dkv-dest-chip.on{background:#e8f2ff;border-color:#3d5a80;color:#1b3a5c;font-weight:700}',
    '.dkr .dkv-dest-chip:hover{border-color:#3d5a80}',
    '.dkr .dkv-dest-n b{color:#1b2432}',
    '.dkr .dkv-tag{background:#f1f5fa;color:#3b4657}.dkr .dkv-tag.site{background:#fdecec;color:#b91c1c;border-color:#f7cccc}',
    '.dkr .ck-geo{stroke:rgba(61,90,128,.4)}',
    '.dkr .dkv-lg{color:#4e5a6e}.dkr .dkv-lg .dim{color:#94a3b8}',
    '.dkr .dkv-empty{color:#94a3b8}',
    /* ===== 汇报模式（深色大屏）===== */
    '.ck.dks{--dk-line:rgba(120,190,255,.16);--dk-line2:rgba(120,190,255,.28);--dk-tx:#cfe4f7;--dk-mu:#7d95b3;--dk-bg:#071726;--dk-surface:rgba(14,44,74,.62);--dk-accent:#5fe1f0}',
    '.dks .dkv-bt{background:rgba(120,190,255,.1)}.dks .dkv-bt i{background:linear-gradient(90deg,#186288,#ff8fa3)}',
    '.dks .dkv-bnet.good{color:#6ee7b7}.dks .dkv-bnet.bad{color:#ff8fa3}',
    '.dks .dkv-bar.self{background:rgba(255,209,102,.1);outline:1px solid rgba(255,209,102,.3);border-radius:3px}',
    '.dks .dkv-fp{fill:#dff3ff}.dks .dkv-fp tspan{fill:#ffd166}.dks .dkv-fc{fill:#cfe4f7}.dks .dkv-fj{fill:#eafaff}',
    '.dks .dkv-fp.on{fill:#ffb877}',
    '.dks .dkv-dest-chip.on{background:linear-gradient(180deg,#1a6fa0,#124a72);border-color:#2fd0e6;color:#eafaff;font-weight:700}',
    '.dks .dkv-dest-chip:hover{border-color:#5fe1f0}',
    '.dks .dkv-dest-n b{color:#eafaff}',
    '.dks .dkv-tag{background:rgba(120,190,255,.1);color:#cfe4f7}.dks .dkv-tag.site{background:rgba(255,143,163,.12);color:#ff8fa3;border-color:rgba(255,143,163,.3)}',
    '.dks .dkv-lg{color:#8fb6d8}.dks .dkv-lg .dim{color:#5f7c99}',
    '.dks .dkv-split-foot{color:#a9c9e6}',
    /* 顶部工具条（由 app.html 外壳输出） */
    '.dk-bar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 20px;margin:0 0 14px;border-bottom:1px solid var(--dk-line)}',
    '.dk-bar h2{margin:0;font-size:16px;font-weight:700;letter-spacing:.3px}',
    '.dk-bar .dk-meta{font-size:12.5px;color:var(--dk-mu);font-variant-numeric:tabular-nums}',
    '.dk-bar .dk-sp{margin-left:auto}',
    '.dk-bar .dk-btn{appearance:none;height:30px;padding:0 13px;border:1px solid var(--dk-line2);border-radius:4px;background:transparent;color:var(--dk-tx);font-size:12.5px;cursor:pointer;font-family:inherit}',
    '.dk-bar .dk-btn:hover{border-color:var(--dk-accent)}',
    '.dk-bar .dk-btn.on{background:var(--dk-accent);border-color:var(--dk-accent);color:#04202e;font-weight:700}',
    '.dkr .dk-bar{background:#fff;border-bottom:1px solid var(--dk-line);margin:0 0 16px;padding:14px 22px}',
    '.dkr .dk-bar h2{color:#1b2432}',
    '.dkr .dk-bar .dk-btn{border-color:#c7d0dc;color:#3b4657}',
    '.dkr .dk-bar .dk-btn.on{background:#3d5a80;border-color:#3d5a80;color:#fff}',
    '.dks .dk-bar h2{color:#eafaff}',
    '.dks .dk-bar .dk-btn.on{background:#5fe1f0;border-color:#5fe1f0;color:#04202e}',
    /* 流向页 Tab 工具条（由 app.html 外壳输出） */
    '.dk-flowbar{padding:0 20px 12px}',
    '.dk-flowtabs button{padding:4px 14px}',
    /* 页面容器左右留白 */
    '.dkv{padding:0 20px}',
    /* ===== 流向扩展面板：病种表 / 地市排名 / 归因小结 ===== */
    '.dkv-site-tbl{width:100%;border-collapse:collapse;font-size:12.5px}',
    '.dkv-site-tbl th{padding:8px 10px;text-align:left;font-weight:600;white-space:nowrap}',
    '.dkv-site-tbl td{padding:7px 10px;border-bottom:1px solid var(--dk-line)}',
    '.dkv-site-name{font-weight:700;white-space:nowrap}',
    '.dkv-bar-cell{display:flex;align-items:center;gap:7px;height:18px}',
    '.dkv-bar-cell i{display:block;height:7px;border-radius:4px;background:#eef2f7;min-width:4px}',
    '.dkv-bar-v{font-variant-numeric:tabular-nums;font-weight:700;white-space:nowrap}',
    '.dkv-site-high{color:#e11d48}.dkv-site-mid{color:#b45309}',
    '.dkv-rank{text-align:center;font-weight:700;opacity:.6;width:32px}',
    '.dkv-city-n{font-weight:700;white-space:nowrap}',
    '.dkv-attr-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;padding:12px}',
    '.dkv-attr-item{padding:10px 12px;border-left:3px solid #6b89ad;border-radius:0 5px 5px 0;background:rgba(127,150,180,.06)}',
    '.dkv-attr-item span{display:block;font-size:12px;opacity:.75}',
    '.dkv-attr-item b{display:block;font-size:18px;font-weight:700;font-variant-numeric:tabular-nums;margin:3px 0 2px}',
    '.dkv-attr-item em{display:block;font-style:normal;font-size:11.5px;opacity:.7;line-height:1.45}',
    '.dkv-attr-bad{border-left-color:#e11d48}.dkv-attr-warn{border-left-color:#f59e0b}',
    /* 浅色模式覆盖 */
    '.dkr .dkv-site-tbl th{background:#f8fafc;color:#5b6673;border-bottom:1px solid var(--dk-line)}',
    '.dkr .dkv-site-tbl td{border-bottom-color:#eef2f7;color:#1b2432}',
    '.dkr .dkv-bar-cell i{background:#eef2f7}',
    '.dkr .dkv-bar-cell i[style*="background"]{background:inherit!important}',
    '.dkr .dkv-attr-item{background:#f8fafc;border-left-color:#3d5a80}',
    '.dkr .dkv-attr-bad{border-left-color:#e11d48}.dkr .dkv-attr-warn{border-left-color:#f59e0b}',
    /* 深色模式覆盖 */
    '.dks .dkv-site-tbl th{background:rgba(120,190,255,.08);color:#7d95b3}',
    '.dks .dkv-site-tbl td{border-bottom-color:var(--dk-line);color:#dff3ff}',
    '.dks .dkv-bar-cell i{background:rgba(120,190,255,.1)}',
    '.dks .dkv-site-high{color:#ff8fa3}.dks .dkv-site-mid{color:#ffd166}',
    '.dks .dkv-attr-item{background:rgba(14,44,74,.45);border-left-color:#5fe1f0}',
    '.dks .dkv-attr-bad{border-left-color:#ff8fa3}.dks .dkv-attr-warn{border-left-color:#ffd166}',
    '.dks .dkv-attr-item b{color:#dff3ff}.dks .dkv-attr-item span{color:#7d95b3}'
  ].join('');
  var st = document.createElement('style'); st.id = 'dkv-style'; st.textContent = css;
  if (document.head) document.head.appendChild(st);
})();
