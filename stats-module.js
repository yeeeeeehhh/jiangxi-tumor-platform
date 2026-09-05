/* stats-module.js — 统计分析 */
(function () {
  'use strict';

  var PAGES = {
    'analysis-stats': 1,
    'analysis-survival': 1
  };

  /* ========== 标准人口与常量 ========== */
  var AGE_LABELS = [
    '0-4', '5-9', '10-14', '15-19', '20-24', '25-29',
    '30-34', '35-39', '40-44', '45-49', '50-54', '55-59',
    '60-64', '65-69', '70-74', '75-79', '80-84', '85+'
  ];
  var SEGI_W = [
    12000, 10000, 9000, 9000, 8000, 8000,
    6000, 6000, 6000, 6000, 5000, 4000,
    4000, 3000, 2000, 1000, 500, 500
  ];
  var CN2000_W = [
    7015, 7523, 8491, 8559, 7598, 7559,
    8212, 8870, 8120, 7302, 5911, 4578,
    3388, 2657, 1948, 1328, 712, 345
  ];
  var STD_META = {
    cn: { name: '2000年中国标准人口（国家癌症中心）', weights: CN2000_W },
    world: { name: "Segi's 世界标准人口（1960 / IARC）", weights: SEGI_W }
  };
  var QC_THRESH = { mvMin: 70, dcoMax: 5, miMin: 0.55, miMax: 0.85, ubMax: 5 };

  /* ========== 主数据（确定性） ========== */
  var REGIONS = [
    { id: '360000', name: '江西省', level: 'prov', parent: null },
    { id: '360100', name: '南昌市', level: 'city', parent: '360000' },
    { id: '360700', name: '赣州市', level: 'city', parent: '360000' },
    { id: '360400', name: '九江市', level: 'city', parent: '360000' },
    { id: '360103', name: '西湖区', level: 'dist', parent: '360100' },
    { id: '360102', name: '东湖区', level: 'dist', parent: '360100' },
    { id: '360704', name: '赣县区', level: 'dist', parent: '360700' },
    { id: '360703', name: '南康区', level: 'dist', parent: '360700' },
    { id: '360402', name: '濂溪区', level: 'dist', parent: '360400' },
    { id: '360403', name: '浔阳区', level: 'dist', parent: '360400' }
  ];
  /* 简化寿命表：年龄组 → 年预期生存概率（用于相对生存） */
  var LIFE_TABLE = [
    0.998, 0.999, 0.999, 0.998, 0.997, 0.996,
    0.995, 0.993, 0.990, 0.985, 0.978, 0.968,
    0.955, 0.935, 0.905, 0.860, 0.790, 0.700
  ];
  var SITES = [
    { id: 'ALL', name: '全部恶性肿瘤', icd: 'C00-C97' },
    { id: 'C34', name: '肺', icd: 'C33-C34' },
    { id: 'C50', name: '乳腺', icd: 'C50' },
    { id: 'C16', name: '胃', icd: 'C16' },
    { id: 'C18', name: '结肠', icd: 'C18' },
    { id: 'C22', name: '肝', icd: 'C22' },
    { id: 'C15', name: '食管', icd: 'C15' },
    { id: 'C53', name: '宫颈', icd: 'C53' },
    { id: 'C61', name: '前列腺', icd: 'C61' },
    { id: 'C67', name: '膀胱', icd: 'C67' },
    { id: 'C73', name: '甲状腺', icd: 'C73' }
  ];

  // 人口：year → regionId → { total, age:[18], missing? }
  var POP = {};
  (function buildPop() {
    var base = {
      '360000': 99400000,
      '360100': 12800000,
      '360700': 7000000,
      '360400': 4800000,
      '360103': 980000,
      '360102': 1600000,
      '360704': 220000,
      '360703': 380000,
      '360402': 260000,
      '360403': 180000
    };
    var ageShare = [
      0.055, 0.057, 0.060, 0.064, 0.068, 0.071,
      0.074, 0.071, 0.068, 0.066, 0.064, 0.060,
      0.055, 0.049, 0.044, 0.033, 0.022, 0.019
    ];
    for (var y = 2014; y <= 2023; y++) {
      POP[y] = {};
      Object.keys(base).forEach(function (rid) {
        // 九江市及下辖区县 2023 人口缺失（验收用）
        if ((rid === '360400' || rid === '360402' || rid === '360403') && y === 2023) {
          POP[y][rid] = { total: null, age: null, missing: true };
          return;
        }
        var growth = 1 + (y - 2018) * 0.004;
        var total = Math.round(base[rid] * growth);
        var age = ageShare.map(function (s) { return Math.round(total * s); });
        POP[y][rid] = { total: total, age: age, missing: false };
      });
    }
  })();

  function hash(s) {
    var h = 2166136261;
    String(s).split('').forEach(function (c) {
      h ^= c.charCodeAt(0);
      h = Math.imul(h, 16777619);
    });
    return Math.abs(h);
  }

  function siteBase(siteId) {
    var map = {
      ALL: 1, C34: 0.22, C50: 0.14, C16: 0.12, C18: 0.09,
      C22: 0.08, C15: 0.07, C53: 0.05, C61: 0.04, C67: 0.03, C73: 0.04
    };
    return map[siteId] || 0.02;
  }

  function regionShare(rid) {
    return {
      '360000': 1, '360100': 0.32, '360700': 0.18, '360400': 0.12,
      '360103': 0.08, '360102': 0.12, '360704': 0.03, '360703': 0.05,
      '360402': 0.04, '360403': 0.03
    }[rid] || 0.05;
  }

  /** 某年某地某癌种：发病/死亡按年龄组 */
  function casesOf(year, regionId, siteId, sex) {
    var pop = POP[year] && POP[year][regionId];
    var popTotal = pop && !pop.missing ? pop.total : 5000000;
    var baseInc = popTotal / 100000 * 220 * siteBase(siteId) * regionShare(regionId);
    var trend = 1 + (year - 2014) * 0.018;
    if (year >= 2019) trend = (1 + 4 * 0.018) + (year - 2018) * 0.006;
    var sexF = sex === '男' ? 1.15 : sex === '女' ? 0.88 : 1;
    var h = hash(year + '|' + regionId + '|' + siteId);
    var noise = 0.92 + (h % 17) / 100;
    var incTotal = Math.max(0, Math.round(baseInc * trend * sexF * noise));
    var deathRatio = 0.42 + (hash('d' + siteId) % 20) / 100;
    if (siteId === 'C50' || siteId === 'C73') deathRatio = 0.22;
    if (siteId === 'C22' || siteId === 'C15') deathRatio = 0.58;
    var deathTotal = Math.max(0, Math.round(incTotal * deathRatio * (0.96 + (h % 9) / 100)));

    var ageW = [
      0.002, 0.003, 0.004, 0.008, 0.012, 0.02,
      0.03, 0.04, 0.055, 0.07, 0.09, 0.105,
      0.115, 0.12, 0.11, 0.09, 0.07, 0.056
    ];
    var sumW = ageW.reduce(function (a, b) { return a + b; }, 0);
    var incAge = ageW.map(function (w, i) {
      return Math.round(incTotal * w / sumW * (0.9 + (hash(siteId + i) % 21) / 100));
    });
    var deathAge = ageW.map(function (w, i) {
      return Math.round(deathTotal * w / sumW * (0.9 + (hash('x' + siteId + i) % 21) / 100));
    });
    // 微调使合计对齐
    var fix = function (arr, total) {
      var s = arr.reduce(function (a, b) { return a + b; }, 0);
      if (s === 0 || s === total) return arr;
      arr[arr.length - 1] = Math.max(0, arr[arr.length - 1] + (total - s));
      return arr;
    };
    return {
      inc: fix(incAge, incTotal),
      death: fix(deathAge, deathTotal),
      incTotal: incTotal,
      deathTotal: deathTotal
    };
  }

  function getPop(year, regionId) {
    return (POP[year] && POP[year][regionId]) || { total: null, age: null, missing: true };
  }

  function crude(n, pop) {
    if (pop == null || pop === 0) return null;
    return n / pop * 100000;
  }

  function ageRates(counts, popAge) {
    if (!popAge) return counts.map(function () { return null; });
    return counts.map(function (c, i) {
      var p = popAge[i];
      if (!p) return null;
      return c / p * 100000;
    });
  }

  function asr(rates, weights) {
    var num = 0, den = 0, ok = true;
    for (var i = 0; i < rates.length; i++) {
      if (rates[i] == null) { ok = false; break; }
      num += rates[i] * weights[i];
      den += weights[i];
    }
    if (!ok || !den) return null;
    return num / den;
  }

  function truncRate(rates, weights, from, to) {
    var num = 0, den = 0;
    for (var i = from; i <= to; i++) {
      if (rates[i] == null) return null;
      num += rates[i] * weights[i];
      den += weights[i];
    }
    return den ? num / den : null;
  }

  function fmtNum(n) {
    if (n == null || isNaN(n)) return '—';
    return Math.round(n).toLocaleString('zh-CN');
  }
  function fmtRate(v, d) {
    if (v == null || isNaN(v)) return '—';
    return Number(v).toFixed(d == null ? 2 : d);
  }
  function rateCell(v, missingPop) {
    if (missingPop || v == null) {
      return '<span class="st-miss" title="人口数据缺失，率无法计算">—</span>';
    }
    return fmtRate(v);
  }
  function htmlEsc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function stripHtml(s) {
    return String(s == null ? '' : s).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
  }
  function downloadBlob(filename, blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 800);
  }
  function downloadText(filename, text, mime) {
    downloadBlob(filename, new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' }));
  }
  function downloadCSV(filename, headers, rows) {
    var esc = function (c) {
      var t = stripHtml(c);
      if (/[",\n]/.test(t)) return '"' + t.replace(/"/g, '""') + '"';
      return t;
    };
    var lines = ['\uFEFF' + headers.map(esc).join(',')];
    rows.forEach(function (r) { lines.push(r.map(esc).join(',')); });
    downloadText(filename, lines.join('\r\n'), 'text/csv');
  }
  function exportSvgAsPng(svgEl, filename) {
    if (!svgEl) { toast('未找到可导出图表', 'error'); return; }
    var xml = new XMLSerializer().serializeToString(svgEl);
    var svg64 = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
    var img = new Image();
    img.onload = function () {
      var canvas = document.createElement('canvas');
      canvas.width = Math.max(640, img.width || 640);
      canvas.height = Math.max(280, img.height || 280);
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(function (blob) {
        if (!blob) { toast('PNG 导出失败', 'error'); return; }
        downloadBlob(filename || 'chart.png', blob);
        toast('已下载 ' + (filename || 'chart.png'));
      }, 'image/png');
    };
    img.onerror = function () { toast('图表导出失败', 'error'); };
    img.src = svg64;
  }
  /* ========== 状态 ========== */
  var state = {
    page: 'analysis-stats',
    mode: 'burden', // burden | survival
    yearMode: 'single',
    year: 2023,
    yearStart: 2014,
    yearEnd: 2023,
    regionId: '360000',
    regionIds: ['360000'],
    siteId: 'ALL',
    sex: '合计',
    cardStatus: '有效主档',
    std: 'cn',
    viewMode: 'table',
    survSite: 'C34',
    survYears: 5,
    survStrata: 'stage',
    survRegion: '360000',
    drill: null
  };

  function injectStyles() {
    var s = document.getElementById('st-styles');
    if (!s) {
      s = document.createElement('style');
      s.id = 'st-styles';
      document.head.appendChild(s);
    }
    s.textContent = [
      /* —— 数据中台工作台壳 —— */
      '.st-page{display:flex;flex-direction:column;gap:0;background:#f5f7fa;margin:-4px -4px 0;padding:0 0 16px;min-height:calc(100vh - 120px);border-radius:0}',
      '.st-workspace{display:flex;flex-direction:column;gap:10px;padding:12px 14px 0}',
      '.st-workspace-da{padding-top:10px}',
      '.st-workspace-da .da-page{gap:10px}',
      '.st-workspace-da .da-filter{background:#fff;border-color:#e5e6eb;border-radius:2px}',
      '.st-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px 0}',
      '.st-head h3{margin:0;font-size:16px;font-weight:600;color:#1f2329;letter-spacing:.02em}',
      '.st-head-meta{font-size:12px;color:#86909c;display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.st-head-meta .dot{width:3px;height:3px;border-radius:50%;background:#c9cdd4}',
      '.st-tabs{display:flex;flex-wrap:nowrap;gap:0;overflow-x:auto;padding:0 14px;background:#fff;border-bottom:1px solid #e5e6eb;scrollbar-width:thin}',
      '.st-tab{padding:11px 16px;border:0;background:transparent;color:#4e5969;font-weight:500;font-size:13px;cursor:pointer;position:relative;white-space:nowrap;flex:0 0 auto}',
      '.st-tab:hover{color:#165dff}',
      '.st-tab.active{color:#165dff;font-weight:600}',
      '.st-tab.active:after{content:"";position:absolute;left:16px;right:16px;bottom:0;height:2px;background:#165dff;border-radius:1px}',
      '.st-year-chips{display:none}',
      '.st-multi{position:relative;width:120px;flex:0 0 120px}',
      '.st-multi.wide{width:120px;flex:0 0 120px}',
      '.st-multi-btn{width:100%;height:30px;padding:0 28px 0 8px;border:1px solid #e5e6eb;border-radius:2px;background:#fff url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%2386909c\' d=\'M3 4.5L6 8l3-3.5\'/%3E%3C/svg%3E") no-repeat right 8px center;font-size:13px;color:#1f2329;text-align:left;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.st-multi-btn:hover,.st-multi-btn.open{border-color:#165dff}',
      '.st-multi-panel{position:absolute;left:0;top:calc(100% + 4px);z-index:50;min-width:168px;width:max-content;max-width:260px;background:#fff;border:1px solid #e5e6eb;border-radius:2px;box-shadow:0 6px 16px rgba(0,0,0,.08);padding:6px 0;max-height:280px;overflow-x:hidden;overflow-y:auto;box-sizing:border-box}',
      '.st-filter .st-multi-panel label,.st-multi-panel label{display:flex!important;flex-direction:row!important;align-items:center;gap:8px;margin:0;padding:7px 12px;font-size:13px;font-weight:400;color:#4e5969;cursor:pointer;white-space:nowrap;line-height:1.3;writing-mode:horizontal-tb}',
      '.st-multi-panel label:hover{background:#f7f8fa}',
      '.st-filter .st-multi-panel input[type=checkbox],.st-multi-panel input[type=checkbox]{width:14px!important;height:14px!important;min-width:14px;max-width:14px;margin:0;padding:0;flex:0 0 14px;accent-color:#165dff;cursor:pointer;box-sizing:border-box}',
      '.st-multi-panel label span{flex:1 1 auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;writing-mode:horizontal-tb}',
      '.st-year-multi{position:relative;width:200px;flex:0 0 200px}',
      '.st-year-btn{width:100%;height:30px;padding:0 28px 0 8px;border:1px solid #e5e6eb;border-radius:2px;background:#fff url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%2386909c\' d=\'M3 4.5L6 8l3-3.5\'/%3E%3C/svg%3E") no-repeat right 8px center;font-size:13px;color:#1f2329;text-align:left;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.st-year-btn:hover,.st-year-btn.open{border-color:#165dff}',
      '.st-year-panel{position:absolute;left:0;top:calc(100% + 4px);z-index:50;width:160px;background:#fff;border:1px solid #e5e6eb;border-radius:2px;box-shadow:0 6px 16px rgba(0,0,0,.08);padding:6px 0;max-height:260px;overflow-x:hidden;overflow-y:auto}',
      '.st-filter .st-year-panel label,.st-year-panel label{display:flex!important;flex-direction:row!important;align-items:center;gap:8px;margin:0;padding:7px 12px;font-size:13px;color:#4e5969;cursor:pointer;white-space:nowrap}',
      '.st-year-panel label:hover{background:#f7f8fa}',
      '.st-filter .st-year-panel input[type=checkbox],.st-year-panel input[type=checkbox]{width:14px!important;height:14px!important;min-width:14px;max-width:14px;margin:0;padding:0;flex:0 0 14px;accent-color:#165dff}',
      '.st-legend{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:8px;font-size:12px;color:#4e5969}',
      '.st-legend i{display:inline-block;width:10px;height:10px;border-radius:1px;margin-right:4px;vertical-align:-1px}',
      '.st-line-wrap{width:100%;max-width:920px;height:200px;overflow:hidden;background:#fafbfc;border:1px solid #f2f3f5;border-radius:2px}',
      '.st-line{width:100%;height:auto;display:block}',
      '.st-line-chart{width:100%;height:200px;display:block;vertical-align:top}',
      /* 查询条：单行工具栏，弱背景 */
      '.st-filter{display:flex;flex-wrap:wrap;align-items:flex-end;gap:8px 8px;padding:10px 12px;background:#fff;border:1px solid #e5e6eb;border-radius:2px;overflow:visible}',
      '.st-filter .form-group{margin:0;width:108px;position:relative}',
      '.st-filter .form-group.grow{width:auto;flex:1 1 180px;min-width:140px}',
      '.st-filter .form-group label{font-size:12px;color:#86909c;line-height:1.2;margin-bottom:2px;display:block}',
      '.st-filter select,.st-filter input:not([type=checkbox]):not([type=radio]){width:100%;height:30px;padding:0 8px;font-size:13px;box-sizing:border-box;border:1px solid #e5e6eb;border-radius:2px;background:#fff;color:#1f2329}',
      '.st-filter select:focus,.st-filter input:not([type=checkbox]):not([type=radio]):focus{outline:none;border-color:#165dff;box-shadow:0 0 0 2px rgba(22,93,255,.12)}',
      '.st-actions{display:flex;gap:6px;margin-left:auto;align-items:center;padding-bottom:1px}',
      '.st-actions .btn{height:30px;border-radius:2px;font-size:13px}',
      '.st-note{font-size:12px;color:#86909c;margin-top:8px;line-height:1.5}',
      '.st-miss{color:#f53f3f;font-weight:600;cursor:help}',
      '.st-alert{padding:8px 12px;border:1px solid #ffe4ba;background:#fff7e8;border-radius:2px;color:#d25f00;font-size:12px;margin:0}',
      /* 指标条带：FineBI / 监控大盘风格 */
      '.st-metrics{display:flex;flex-wrap:wrap;background:#fff;border:1px solid #e5e6eb;border-radius:2px;padding:2px 0}',
      '.st-metrics-group{display:flex;flex:1 1 auto;min-width:0;align-items:stretch}',
      '.st-metrics-group + .st-metrics-group{border-left:1px solid #e5e6eb}',
      '.st-metric{flex:1 1 0;min-width:96px;padding:10px 14px;position:relative}',
      '.st-metric + .st-metric:before{content:"";position:absolute;left:0;top:14px;bottom:14px;width:1px;background:#f2f3f5}',
      '.st-metric .l{font-size:12px;color:#86909c;line-height:1.2}',
      '.st-metric .v{font-size:20px;font-weight:600;color:#1f2329;margin-top:4px;font-variant-numeric:tabular-nums;letter-spacing:-.02em;line-height:1.25}',
      '.st-metric .v.accent{color:#165dff}',
      '.st-metric .v.warn{color:#f53f3f}',
      '.st-metric-tag{display:inline-block;font-size:11px;color:#86909c;background:#f2f3f5;padding:1px 6px;border-radius:2px;margin-bottom:6px}',
      /* 结果面板 */
      '.st-panel{background:#fff;border:1px solid #e5e6eb;border-radius:2px;display:flex;flex-direction:column;min-width:0}',
      '.st-panel-hd{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 12px;border-bottom:1px solid #f2f3f5;min-height:40px}',
      '.st-panel-title{font-size:13px;font-weight:600;color:#1f2329;display:flex;align-items:center;gap:8px}',
      '.st-panel-title .sub{font-weight:400;color:#86909c;font-size:12px}',
      '.st-panel-tools{display:flex;align-items:center;gap:8px}',
      '.st-panel-bd{padding:0;min-width:0}',
      '.st-panel-bd.pad{padding:12px}',
      '.st-panel-bd .table-wrap{border:0;border-radius:0}',
      '.st-panel-bd .data-table{margin:0}',
      '.st-seg{display:inline-flex;height:26px;border:1px solid #e5e6eb;border-radius:2px;overflow:hidden;background:#fff}',
      '.st-seg button{height:26px;padding:0 10px;border:0;border-right:1px solid #e5e6eb;background:#fff;color:#4e5969;font-size:12px;cursor:pointer}',
      '.st-seg button:last-child{border-right:0}',
      '.st-seg button:hover{color:#165dff}',
      '.st-seg button.on{background:#e8f3ff;color:#165dff;font-weight:600}',
      '.st-grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
      '.st-chart{background:transparent;padding:0;min-height:0;border:0}',
      '.st-chart h4{margin:0 0 10px;font-size:13px;color:#1f2329;font-weight:600}',
      '.st-bars .row{display:grid;grid-template-columns:92px 1fr 56px;gap:8px;align-items:center;margin-bottom:8px;font-size:12px;color:#4e5969}',
      '.st-bars .track{height:8px;background:#f2f3f5;border-radius:1px;overflow:hidden}',
      '.st-bars .fill{height:100%;background:linear-gradient(90deg,#4080ff,#165dff);border-radius:1px}',
      '.st-bars .num{text-align:right;font-variant-numeric:tabular-nums;color:#1f2329;font-weight:500}',
      '.st-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}',
      '.st-card{border:1px solid #e5e6eb;border-radius:2px;background:#fff;padding:14px;display:flex;flex-direction:column;gap:8px}',
      '.st-card h4{margin:0;font-size:14px;font-weight:600}.st-card p{margin:0;font-size:12px;color:#86909c;line-height:1.5;flex:1}',
      '.st-modal-mask{position:fixed;inset:0;background:rgba(29,33,41,.45);z-index:240;display:flex;align-items:center;justify-content:center}',
      '.st-modal{background:#fff;border-radius:4px;width:720px;max-width:94vw;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,.18)}',
      '.st-modal-h{padding:14px 18px;border-bottom:1px solid #e5e6eb;font-weight:600;display:flex;justify-content:space-between;align-items:center}',
      '.st-modal-b{padding:16px 18px;overflow:auto;flex:1}',
      '.st-modal-f{padding:12px 18px;border-top:1px solid #e5e6eb;display:flex;justify-content:flex-end;gap:8px}',
      '.st-danger{color:#f53f3f;font-weight:600}',
      '.st-ok{color:#00b42a}',
      '.st-page .data-table thead th{background:#f7f8fa;color:#4e5969;font-weight:600;font-size:12px;border-bottom:1px solid #e5e6eb}',
      '.st-page .data-table td,.st-page .data-table th{padding:8px 10px;border-color:#f2f3f5}',
      '.st-page .data-table tbody tr:hover{background:#f7f8fa}',
      '.st-page .data-table tr.total{background:#f7f8fa;font-weight:600}',
      '.st-crumb{font-size:12px;color:#86909c;margin-bottom:8px}',
      '.st-crumb a{color:#165dff;text-decoration:none}',
      '@media(max-width:1100px){.st-grid2,.st-cards{grid-template-columns:1fr}.st-metrics-group{flex:1 1 100%;border-left:0!important;border-top:1px solid #e5e6eb}.st-metrics-group:first-child{border-top:0}}'
    ].join('');
  }

  function shell(title, body) {
    return '<div class="st-page"><div class="st-head"><h3>' + htmlEsc(title) + '</h3>' +
      '<div class="st-head-meta"><span>' + state.year + ' 年</span><span class="dot"></span><span>' +
      htmlEsc(regionName(state.regionId)) + '</span><span class="dot"></span><span>' +
      htmlEsc(siteName(state.siteId)) + '</span><span class="dot"></span><span>' + htmlEsc(state.sex) + '</span></div></div>' +
      body + '</div>';
  }

  function regionOptions(selected, levels) {
    var allow = levels || { prov: 1, city: 1 };
    return REGIONS.filter(function (r) { return allow[r.level]; }).map(function (r) {
      return '<option value="' + r.id + '"' + (r.id === selected ? ' selected' : '') + '>' + r.name + '</option>';
    }).join('');
  }
  function siteOptions(selected, withAll) {
    return SITES.filter(function (s) { return withAll || s.id !== 'ALL' || true; }).map(function (s) {
      return '<option value="' + s.id + '"' + (s.id === selected ? ' selected' : '') + '>' + s.name + (s.id === 'ALL' ? '' : ' (' + s.icd + ')') + '</option>';
    }).join('');
  }
  function yearOptions(selected, from, to) {
    var html = '';
    for (var y = to; y >= from; y--) {
      html += '<option value="' + y + '"' + (y === selected ? ' selected' : '') + '>' + y + '</option>';
    }
    return html;
  }

  /* ========== 工作台 ========== */
  function filterBar(extra) {
    return '<div class="st-filter">' +
      '<div class="form-group"><label>统计年度</label><select onchange="STATS.set(\'year\',+this.value)">' + yearOptions(state.year, 2014, 2023) + '</select></div>' +
      '<div class="form-group"><label>地区</label><select onchange="STATS.set(\'regionId\',this.value)">' + regionOptions(state.regionId) + '</select></div>' +
      '<div class="form-group"><label>癌种</label><select onchange="STATS.set(\'siteId\',this.value)">' + siteOptions(state.siteId) + '</select></div>' +
      '<div class="form-group"><label>性别</label><select onchange="STATS.set(\'sex\',this.value)"><option' + (state.sex === '合计' ? ' selected' : '') + '>合计</option><option' + (state.sex === '男' ? ' selected' : '') + '>男</option><option' + (state.sex === '女' ? ' selected' : '') + '>女</option></select></div>' +
      '<div class="form-group"><label>登记状态</label><select onchange="STATS.set(\'cardStatus\',this.value)"><option>有效主档</option><option>全部未作废</option></select></div>' +
      (extra || '') +
      '<div class="st-actions"><button class="btn btn-ghost btn-sm" onclick="STATS.resetStats()">重置</button><button class="btn btn-primary btn-sm" onclick="STATS.query()">统计</button><button class="btn btn-outline btn-sm" onclick="STATS.exportCurrent()">导出</button></div></div>';
  }

  function viewSeg() {
    return '<div class="st-seg">' +
      '<button type="button" class="' + (state.viewMode !== 'chart' ? 'on' : '') + '" onclick="STATS.set(\'viewMode\',\'table\')">表格</button>' +
      '<button type="button" class="' + (state.viewMode === 'chart' ? 'on' : '') + '" onclick="STATS.set(\'viewMode\',\'chart\')">图表</button></div>';
  }

  function metricItem(label, valueHtml, accent) {
    return '<div class="st-metric"><div class="l">' + label + '</div><div class="v' + (accent ? ' accent' : '') + '">' + valueHtml + '</div></div>';
  }

  function panel(title, tools, body, pad) {
    return '<div class="st-panel"><div class="st-panel-hd"><div class="st-panel-title">' + title +
      '</div><div class="st-panel-tools">' + (tools || '') + '</div></div>' +
      '<div class="st-panel-bd' + (pad ? ' pad' : '') + '">' + body + '</div></div>';
  }

  function computeBundle(year, regionId, siteId, sex) {
    var pop = getPop(year, regionId);
    var c = casesOf(year, regionId, siteId, sex);
    var missing = !!(pop && pop.missing);
    var ratesInc = ageRates(c.inc, missing ? null : pop.age);
    var ratesDeath = ageRates(c.death, missing ? null : pop.age);
    return {
      year: year, regionId: regionId, siteId: siteId, sex: sex,
      pop: pop, missing: missing,
      inc: c.incTotal, death: c.deathTotal,
      incAge: c.inc, deathAge: c.death,
      crudeInc: crude(c.incTotal, missing ? null : pop.total),
      crudeDeath: crude(c.deathTotal, missing ? null : pop.total),
      mi: c.incTotal ? c.deathTotal / c.incTotal : null,
      ageInc: ratesInc, ageDeath: ratesDeath,
      asrCnInc: asr(ratesInc, CN2000_W),
      asrWorldInc: asr(ratesInc, SEGI_W),
      asrCnDeath: asr(ratesDeath, CN2000_W),
      asrWorldDeath: asr(ratesDeath, SEGI_W),
      truncCn: truncRate(ratesInc, CN2000_W, 7, 12) // 35-64 → index 7..12
    };
  }

  function regionName(id) {
    var r = REGIONS.find(function (x) { return x.id === id; });
    return r ? r.name : id;
  }
  function siteName(id) {
    var s = SITES.find(function (x) { return x.id === id; });
    return s ? s.name : id;
  }

  function renderBurdenMode() {
    var b = computeBundle(state.year, state.regionId, state.siteId, state.sex);
    var emptyCases = b.inc === 0 && b.death === 0;
    var alert = '';
    if (b.missing) {
      alert = '<div class="st-alert">人口数据缺失，率无法计算。已显示病例数；率字段为「—」。</div>';
    } else if (emptyCases) {
      alert = '<div class="st-alert">该地区该时段暂无登记数据。</div>';
    }

    var kpis =
      '<div class="st-metrics">' +
      '<div class="st-metrics-group">' +
      '<div class="st-metric"><div class="st-metric-tag">发病</div><div class="l">发病数</div><div class="v accent">' + fmtNum(b.inc) + '</div></div>' +
      metricItem('粗发病率', rateCell(b.crudeInc, b.missing)) +
      metricItem('中标发病率', rateCell(b.asrCnInc, b.missing)) +
      metricItem('世标发病率', rateCell(b.asrWorldInc, b.missing)) +
      metricItem('M/I', b.mi == null ? '—' : b.mi.toFixed(2)) +
      '</div>' +
      '<div class="st-metrics-group">' +
      '<div class="st-metric"><div class="st-metric-tag">死亡</div><div class="l">死亡数</div><div class="v accent">' + fmtNum(b.death) + '</div></div>' +
      metricItem('粗死亡率', rateCell(b.crudeDeath, b.missing)) +
      metricItem('中标死亡率', rateCell(b.asrCnDeath, b.missing)) +
      metricItem('世标死亡率', rateCell(b.asrWorldDeath, b.missing)) +
      metricItem('截缩发病(35-64)', rateCell(b.truncCn, b.missing)) +
      '</div></div>';

    var rows = [];
    if (state.siteId === 'ALL') {
      SITES.filter(function (s) { return s.id !== 'ALL'; }).forEach(function (s) {
        var x = computeBundle(state.year, state.regionId, s.id, state.sex);
        rows.push({ name: s.name, id: s.id, kind: 'site', x: x });
      });
    } else {
      REGIONS.filter(function (r) { return r.level === 'city'; }).forEach(function (r) {
        var x = computeBundle(state.year, r.id, state.siteId, state.sex);
        rows.push({ name: r.name, id: r.id, kind: 'region', x: x });
      });
    }
    rows.sort(function (a, b2) {
      var av = a.x.asrCnInc == null ? -1 : a.x.asrCnInc, bv = b2.x.asrCnInc == null ? -1 : b2.x.asrCnInc;
      return bv - av;
    });

    var maxInc = Math.max.apply(null, rows.map(function (r) { return r.x.inc; }).concat([1]));
    var bars = rows.slice(0, 10).map(function (r) {
      var pct = Math.round(r.x.inc / maxInc * 100);
      return '<div class="row"><div>' + htmlEsc(r.name) + '</div><div class="track"><div class="fill" style="width:' + pct + '%"></div></div><div class="num">' + fmtNum(r.x.inc) + '</div></div>';
    }).join('');

    var totalRow = {
      name: '合计',
      x: state.siteId === 'ALL' ? b : computeBundle(state.year, state.regionId, state.siteId, state.sex)
    };

    function epiCells(x) {
      return '<td class="num">' + fmtNum(x.inc) + '</td><td class="num">' + rateCell(x.crudeInc, x.missing) +
        '</td><td class="num">' + rateCell(x.asrCnInc, x.missing) + '</td><td class="num">' + rateCell(x.asrWorldInc, x.missing) +
        '</td><td class="num">' + fmtNum(x.death) + '</td><td class="num">' + rateCell(x.crudeDeath, x.missing) +
        '</td><td class="num">' + rateCell(x.asrCnDeath, x.missing) + '</td><td class="num">' + rateCell(x.asrWorldDeath, x.missing) +
        '</td><td class="num">' + (x.mi == null ? '—' : x.mi.toFixed(2)) + '</td>';
    }

    var table = '<div class="table-wrap" style="max-height:440px;overflow:auto"><table class="data-table"><thead>' +
      '<tr><th rowspan="2">对象</th><th class="num" colspan="4">发病</th><th class="num" colspan="4">死亡</th><th class="num" rowspan="2">M/I</th><th rowspan="2">操作</th></tr>' +
      '<tr><th class="num">发病数</th><th class="num">粗率</th><th class="num">中标率</th><th class="num">世标率</th>' +
      '<th class="num">死亡数</th><th class="num">粗率</th><th class="num">中标率</th><th class="num">世标率</th></tr>' +
      '</thead><tbody>' +
      rows.map(function (r) {
        return '<tr><td>' + htmlEsc(r.name) + '</td>' + epiCells(r.x) +
          '<td><button class="btn btn-ghost btn-xs" onclick="STATS.drillDown(\'' + r.kind + '\',\'' + r.id + '\')">下钻</button></td></tr>';
      }).join('') +
      '<tr class="total"><td><strong>合计</strong></td>' + epiCells(totalRow.x) + '<td>—</td></tr>' +
      '</tbody></table></div>';

    var chartBody = '<div class="st-bars" style="max-width:720px">' + (bars || '<div style="color:#86909c;font-size:13px;padding:24px 0">暂无数据</div>') + '</div>';
    var resultBody = state.viewMode === 'chart' ? chartBody : table;
    var dimLabel = state.siteId === 'ALL' ? '按癌种' : '按地区';

    return (alert ? alert : '') + kpis +
      panel('结果明细 <span class="sub">' + dimLabel + ' · 按中标发病率排序</span>', viewSeg(), resultBody, state.viewMode === 'chart');
  }
function renderStats() {
    var mode = state.mode;
    if (mode === 'asr' || mode === 'compare' || mode === 'age' || mode === 'map' || mode === 'joinpoint') {
      mode = 'burden';
      state.mode = 'burden';
    }
    var content = '';
    if (state.mode === 'survival') content = renderSurvival();
    else {
      content = (window.DA && typeof window.DA.renderBurdenBody === 'function')
        ? window.DA.renderBurdenBody()
        : filterBar() + renderBurdenMode();
    }
    var headMeta = state.mode === 'burden'
      ? ''
      : '<div class="st-head-meta"><span>' + state.year + ' 年</span><span class="dot"></span><span>' +
        htmlEsc(regionName(state.regionId)) + '</span><span class="dot"></span><span>' +
        htmlEsc(siteName(state.siteId)) + '</span><span class="dot"></span><span>' + htmlEsc(state.sex) + '</span></div>';
    return '<div class="st-page"><div class="st-head"><h3>统计分析</h3>' + headMeta + '</div>' +
      '<div class="st-workspace' + (state.mode === 'burden' ? ' st-workspace-da' : '') + '">' + content + '</div></div>';
  }

  /* ========== 生存 ========== */
  function expectedSurvival(years, ageIdx) {
    var p = 1;
    var idx = Math.max(0, Math.min(LIFE_TABLE.length - 1, ageIdx == null ? 10 : ageIdx));
    for (var y = 0; y < years; y++) {
      var i = Math.min(LIFE_TABLE.length - 1, idx + Math.floor(y / 5));
      p *= LIFE_TABLE[i];
    }
    return p;
  }

  function simulatePatients(siteId, strataKey, nTarget) {
    var base = { C34: 0.42, C50: 0.78, C16: 0.48, C18: 0.62, C22: 0.28, ALL: 0.55 }[siteId] || 0.5;
    var groups = strataKey === 'stage'
      ? [{ id: 'I-II', name: '早期(I-II)', f: 1.35 }, { id: 'III-IV', name: '晚期(III-IV)', f: 0.65 }]
      : strataKey === 'sex'
        ? [{ id: '男', name: '男', f: 0.92 }, { id: '女', name: '女', f: 1.1 }]
        : [{ id: 'all', name: '合计', f: 1 }];
    var patients = [];
    groups.forEach(function (g) {
      var n = Math.round((nTarget || 400) / groups.length);
      for (var i = 0; i < n; i++) {
        var h = hash(siteId + '|' + g.id + '|' + i);
        var ageIdx = 6 + (h % 10);
        var u = ((h % 10000) / 10000);
        // 指数分布生存时间（月），与分组因子相关
        var lambda = 0.018 / (base * g.f);
        var time = Math.min(state.survYears * 12, -Math.log(Math.max(0.001, 1 - u)) / lambda);
        var followMax = state.survYears * 12;
        var censored = time >= followMax || ((h >> 3) % 7) === 0;
        if (censored && time >= followMax) time = followMax;
        if (censored && time < followMax) time = Math.max(1, time * 0.85);
        patients.push({
          group: g.id, groupName: g.name, time: time, event: censored ? 0 : 1, ageIdx: ageIdx
        });
      }
    });
    return { groups: groups, patients: patients };
  }

  function kmFromPatients(patients) {
    var times = {};
    patients.forEach(function (p) {
      var t = Math.round(p.time);
      if (!times[t]) times[t] = { t: t, d: 0, c: 0 };
      if (p.event) times[t].d++; else times[t].c++;
    });
    var keys = Object.keys(times).map(Number).sort(function (a, b) { return a - b; });
    var n = patients.length, s = 1, points = [{ month: 0, surv: 1 }], varSum = 0;
    keys.forEach(function (t) {
      var row = times[t];
      if (n > 0 && row.d > 0) {
        s *= (1 - row.d / n);
        if (n > row.d) varSum += row.d / (n * (n - row.d));
      }
      points.push({ month: t, surv: Math.max(0, s), se: s * Math.sqrt(varSum) });
      n -= (row.d + row.c);
    });
    // 阶梯终点对齐随访年限
    var endM = state.survYears * 12;
    var last = points[points.length - 1];
    if (last.month < endM) points.push({ month: endM, surv: last.surv, se: last.se });
    var atEnd = points.filter(function (p) { return p.month <= endM; }).pop() || last;
    var se = atEnd.se || 0.02;
    return {
      points: points,
      rate: atEnd.surv,
      ratePct: atEnd.surv * 100,
      ciLo: Math.max(0, (atEnd.surv - 1.96 * se) * 100),
      ciHi: Math.min(100, (atEnd.surv + 1.96 * se) * 100),
      n: patients.length,
      censor: patients.filter(function (p) { return !p.event; }).length
    };
  }

  function logRankTest(groupsPatients) {
    // Mantel-Haenszel Log-rank（两组）
    if (groupsPatients.length < 2) return null;
    var a = groupsPatients[0], b = groupsPatients[1];
    var allTimes = {};
    a.concat(b).forEach(function (p) {
      var t = Math.round(p.time);
      if (!allTimes[t]) allTimes[t] = 1;
    });
    var times = Object.keys(allTimes).map(Number).sort(function (x, y) { return x - y; });
    var n1 = a.length, n2 = b.length, O1 = 0, E1 = 0, V = 0;
    var i1 = 0, i2 = 0;
    var aSorted = a.slice().sort(function (x, y) { return x.time - y.time; });
    var bSorted = b.slice().sort(function (x, y) { return x.time - y.time; });
    times.forEach(function (t) {
      var d1 = 0, d2 = 0, c1 = 0, c2 = 0;
      while (i1 < aSorted.length && Math.round(aSorted[i1].time) === t) {
        if (aSorted[i1].event) d1++; else c1++;
        i1++;
      }
      while (i2 < bSorted.length && Math.round(bSorted[i2].time) === t) {
        if (bSorted[i2].event) d2++; else c2++;
        i2++;
      }
      var d = d1 + d2, n = n1 + n2;
      if (n > 1 && d > 0) {
        var e1 = d * (n1 / n);
        O1 += d1; E1 += e1;
        V += (n1 * n2 * d * (n - d)) / (n * n * (n - 1));
      }
      n1 -= (d1 + c1); n2 -= (d2 + c2);
    });
    if (V <= 0) return { p: 1, chi2: 0 };
    var chi2 = Math.pow(O1 - E1, 2) / V;
    // 卡方 1df 近似 p
    var p = Math.exp(-0.5 * chi2) / Math.sqrt(2 * Math.PI * Math.max(chi2, 0.01));
    p = Math.min(1, Math.max(0.0001, p));
    return { p: p, chi2: chi2 };
  }

  function kmCurve(siteId, strataKey) {
    var sim = simulatePatients(siteId, strataKey, 800);
    var byGroup = {};
    sim.patients.forEach(function (p) {
      if (!byGroup[p.group]) byGroup[p.group] = [];
      byGroup[p.group].push(p);
    });
    var curves = sim.groups.map(function (g) {
      var km = kmFromPatients(byGroup[g.id] || []);
      // 相对生存：OS / 期望生存（按平均年龄组）
      var avgAge = Math.round(((byGroup[g.id] || []).reduce(function (s, p) { return s + p.ageIdx; }, 0) / Math.max(1, (byGroup[g.id] || []).length)));
      var expS = expectedSurvival(state.survYears, avgAge);
      var rel = expS > 0 ? Math.min(1, km.rate / expS) : null;
      return {
        id: g.id, name: g.name, n: km.n, censor: km.censor, points: km.points,
        rate: km.rate, ratePct: km.ratePct, ciLo: km.ciLo, ciHi: km.ciHi,
        relPct: rel == null ? null : rel * 100, expS: expS, patients: byGroup[g.id] || []
      };
    });
    return curves;
  }

  function stairPath(points, w, h, pad, maxM) {
    if (!points.length) return '';
    var d = '';
    var prevY = null;
    points.forEach(function (p, i) {
      var x = pad + (p.month / maxM) * (w - pad * 2);
      var y = h - pad - p.surv * (h - pad * 2);
      if (i === 0) { d += 'M' + x + ' ' + y; prevY = y; }
      else { d += ' H' + x + ' V' + y; prevY = y; }
    });
    return d;
  }

  function renderSurvival() {
    var hasLife = LIFE_TABLE && LIFE_TABLE.length === 18;
    var filter = '<div class="st-filter">' +
      '<div class="form-group"><label>地区</label><select onchange="STATS.set(\'survRegion\',this.value)">' + regionOptions(state.survRegion || '360000') + '</select></div>' +
      '<div class="form-group"><label>癌种</label><select onchange="STATS.set(\'survSite\',this.value)">' + siteOptions(state.survSite) + '</select></div>' +
      '<div class="form-group"><label>随访终点</label><select onchange="STATS.set(\'survYears\',+this.value)"><option value="1"' + (state.survYears === 1 ? ' selected' : '') + '>1年</option><option value="3"' + (state.survYears === 3 ? ' selected' : '') + '>3年</option><option value="5"' + (state.survYears === 5 ? ' selected' : '') + '>5年</option></select></div>' +
      '<div class="form-group"><label>分层</label><select onchange="STATS.set(\'survStrata\',this.value)"><option value="none"' + (state.survStrata === 'none' ? ' selected' : '') + '>不分层</option><option value="stage"' + (state.survStrata === 'stage' ? ' selected' : '') + '>分期</option><option value="sex"' + (state.survStrata === 'sex' ? ' selected' : '') + '>性别</option></select></div>' +
      '<div class="st-actions"><button class="btn btn-primary btn-sm" onclick="STATS.query()">计算</button><button class="btn btn-outline btn-sm" onclick="STATS.exportSurvival()">导出</button></div></div>';

    var curves = kmCurve(state.survSite, state.survStrata === 'none' ? 'none' : state.survStrata);
    var w = 560, h = 220, pad = 28, maxM = state.survYears * 12;
    var colors = ['#0b65c2', '#c44569', '#16a34a'];
    var paths = curves.map(function (c, i) {
      return '<path fill="none" stroke="' + colors[i] + '" stroke-width="2" d="' + stairPath(c.points, w, h, pad, maxM) + '"/>';
    }).join('');
    var legend = curves.map(function (c, i) {
      return '<span style="margin-right:12px;font-size:12px;color:' + colors[i] + '">● ' + htmlEsc(c.name) + '</span>';
    }).join('');

    var table = '<div class="table-wrap"><table class="data-table"><thead><tr><th>分组</th><th class="num">例数</th><th class="num">删失</th><th class="num">' + state.survYears + '年观察生存率</th><th class="num">95%CI</th><th class="num">相对生存率</th></tr></thead><tbody>' +
      curves.map(function (c) {
        return '<tr><td>' + htmlEsc(c.name) + '</td><td class="num">' + c.n + '</td><td class="num">' + c.censor +
          '</td><td class="num">' + c.ratePct.toFixed(1) + '%</td><td class="num">' + c.ciLo.toFixed(1) + '% ~ ' + c.ciHi.toFixed(1) + '%</td>' +
          '<td class="num">' + (c.relPct == null ? '—' : c.relPct.toFixed(1) + '%') + '</td></tr>';
      }).join('') + '</tbody></table></div>';

    var logrank = '';
    if (curves.length >= 2) {
      var lr = logRankTest([curves[0].patients, curves[1].patients]);
      var p = lr ? lr.p : 1;
      logrank = '<div style="margin-top:10px;font-size:13px">Log-rank χ²=' + (lr ? lr.chi2.toFixed(2) : '—') +
        '，P=<span class="' + (p < 0.05 ? 'st-danger' : '') + '">' + p.toFixed(4) + '</span>' +
        '，删失 ' + curves.reduce(function (s, c) { return s + c.censor; }, 0) + ' 例</div>';
    }

    var lifeNote = hasLife ? '' : '<div class="st-alert">缺少预期生存率（寿命表），无法计算相对生存率。</div>';

    return filter + lifeNote +
      '<div class="st-grid2">' +
      panel('Kaplan-Meier 曲线', '', '<div>' + legend + '</div><svg id="stSurvSvg" class="st-line" viewBox="0 0 ' + w + ' ' + h + '">' + paths + '</svg>', true) +
      panel('生存率表', '', table + logrank, false) +
      '</div>';
  }

  /* ========== 下钻弹层 ========== */
  function showDrill(kind, id) {
    closeStModal();
    var title = kind === 'site' ? siteName(id) : regionName(id);
    var regionId = kind === 'region' ? id : state.regionId;
    var siteId = kind === 'site' ? id : state.siteId;
    var b = computeBundle(state.year, regionId, siteId, state.sex);
    var rows = '';
    for (var i = 0; i < 8; i++) {
      var sex = i % 2 ? '女' : '男';
      rows += '<tr><td>JX' + state.year + String(1000 + hash(id + i) % 9000) + '</td><td>病例' + (i + 1) +
        '</td><td>' + sex + '</td><td>' + (40 + (hash(id + i) % 40)) + '</td><td>' + htmlEsc(siteName(siteId)) +
        '</td><td>' + state.year + '-' + String(1 + i % 12).padStart(2, '0') + '-15</td></tr>';
    }
    document.body.insertAdjacentHTML('beforeend',
      '<div class="st-modal-mask" onclick="if(event.target===this)STATS.closeModal()"><div class="st-modal">' +
      '<div class="st-modal-h"><span>下钻明细 · ' + htmlEsc(title) + '（' + state.year + '）</span><span class="cd-close" onclick="STATS.closeModal()">×</span></div>' +
      '<div class="st-modal-b"><div style="margin-bottom:8px;font-size:13px">发病 ' + fmtNum(b.inc) + ' · 死亡 ' + fmtNum(b.death) +
      ' · 粗发病率 ' + rateCell(b.crudeInc, b.missing) + '</div>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>登记编号</th><th>姓名</th><th>性别</th><th>年龄</th><th>癌种</th><th>确诊日期</th></tr></thead><tbody>' +
      rows + '</tbody></table></div></div>' +
      '<div class="st-modal-f"><button class="btn btn-ghost btn-sm" onclick="STATS.closeModal()">关闭</button></div></div></div>');
  }

  function closeStModal() {
    document.querySelectorAll('.st-modal-mask').forEach(function (el) { el.remove(); });
  }

  function nowStr() {
    var d = new Date();
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  /* ========== 渲染路由 ========== */
  function render(id) {
    injectStyles();
    // 旧独立菜单入口并入同页 Tab
    var modeByPage = {
      'analysis-survival': 'survival'
    };
    if (modeByPage[id]) {
      state.mode = modeByPage[id];
      id = 'analysis-stats';
    }
    state.page = id;
    return renderStats();
  }

  function refresh() {
    var box = document.getElementById('pageContainer');
    if (!box) return;
    box.innerHTML = render(state.page);
  }

  window.STATS = {
    handles: function (id) { return !!PAGES[id]; },
    render: render,
    refresh: refresh,
    isBurdenTabActive: function () {
      return state.page === 'analysis-stats' && state.mode === 'burden';
    },
    prime: function (obj) {
      if (!obj) return;
      Object.keys(obj).forEach(function (k) { state[k] = obj[k]; });
    },
    set: function (key, value) {
      if (key === 'mode') {
        if (value === 'asr' || value === 'compare' || value === 'age' || value === 'map' || value === 'joinpoint') value = 'burden';
      }
      state[key] = value;
      refresh();
    },
    query: function () {
      toast('已按当前条件完成统计');
      refresh();
    },
    resetStats: function () {
      state.year = 2023;
      state.regionId = '360000';
      state.siteId = 'ALL';
      state.sex = '合计';
      state.mode = 'burden';
      state.viewMode = 'table';
      state.std = 'cn';
      toast('已重置');
      refresh();
    },
    exportCurrent: function () {
      var b = computeBundle(state.year, state.regionId, state.siteId, state.sex);
      downloadCSV('stats_' + state.year + '_' + state.regionId + '.csv',
        ['年度', '地区', '癌种', '性别', '发病数', '死亡数', '粗发病率', '粗死亡率', '中标发病率', '中标死亡率', 'M/I'],
        [[state.year, regionName(state.regionId), siteName(state.siteId), state.sex, b.inc, b.death,
          b.crudeInc == null ? '' : b.crudeInc.toFixed(4), b.crudeDeath == null ? '' : b.crudeDeath.toFixed(4),
          b.asrCnInc == null ? '' : b.asrCnInc.toFixed(4), b.asrCnDeath == null ? '' : b.asrCnDeath.toFixed(4),
          b.mi == null ? '' : b.mi.toFixed(4)]]);
      toast('已下载统计结果 CSV');
    },
    drillDown: function (kind, id) { showDrill(kind, id); },
    closeModal: closeStModal,
    exportSurvival: function () {
      exportSvgAsPng(document.getElementById('stSurvSvg'), 'survival_km.png');
      var curves = kmCurve(state.survSite, state.survStrata === 'none' ? 'none' : state.survStrata);
      downloadCSV('survival_' + state.survSite + '.csv',
        ['分组', '例数', '删失', '观察生存率%', 'CI下限', 'CI上限', '相对生存率%'],
        curves.map(function (c) {
          return [c.name, c.n, c.censor, c.ratePct.toFixed(2), c.ciLo.toFixed(2), c.ciHi.toFixed(2),
            c.relPct == null ? '' : c.relPct.toFixed(2)];
        }));
    }
  };

  document.addEventListener('click', function (e) {
    if (!state.agePanel) return;
    var wrap = e.target && e.target.closest ? e.target.closest('[data-st-multi],[data-st-year]') : null;
    if (!wrap) {
      state.agePanel = '';
      refresh();
    }
  });

  // 补丁：String.padStart for older env already used — provide fallback in drill
  if (!String.prototype.padStart) {
    // eslint-disable-next-line no-extend-native
    String.prototype.padStart = function (t, p) {
      p = p || ' ';
      var s = String(this);
      while (s.length < t) s = p + s;
      return s;
    };
  }
})();
