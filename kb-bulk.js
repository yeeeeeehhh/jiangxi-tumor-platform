/* ============================================================
   批量上传 · 按内容形式（kb-bulk.js）
   ------------------------------------------------------------
   流程：选内容形式 → 传该形式所需物料 → 解析预览 → 导入
   不同内容形式所需物料不同（视频要视频+封面+清单），所以不能共用一套表单。

   清单表用 kb-sheet.js 解析（xlsx / csv），按表头名映射标准字段，不依赖列顺序。
   对外：window.KBBulk.open(track, kind)
   ============================================================ */
(function () {
  'use strict';

  if (!window.KB) { console.warn('[kb-bulk] KB 未就绪'); return; }

  /* ---------- 各内容形式的物料定义 ----------
     每项：label 名称、desc 说明、accept 接受扩展名、required 是否必须、multiple 能否多选 */
  var SPECS = {
    '视频': {
      hint: '一条视频 = 一个视频文件 + 可选封面 + 清单表的一行',
      mats: [
        { key: 'video', label: '视频文件', accept: '.mp4,.mov,.avi,.webm', multiple: true, required: true, tip: '可多选，一行一集' },
        { key: 'cover', label: '封面图', accept: '.jpg,.jpeg,.png,.webp', multiple: true, required: false, tip: '可选，缺省取视频首帧' }
      ]
    },
    '课件': {
      hint: '一份课件 = 一个 pptx/pdf（可再加讲课视频）+ 可选封面 + 清单表的一行',
      mats: [
        /* 课件本体和讲课视频放在同一个区里一起传：清单表「文件名」列写哪个，
           就把哪个当主文件；两个都传时详情页会先放视频、下面再放放映机 */
        { key: 'main', label: '课件文件 / 讲课视频', accept: '.pptx,.ppt,.pdf,.mp4,.mov,.avi,.webm,.mkv', multiple: true, required: true, tip: 'PPT / PDF；讲课视频 MP4 / MOV 可选' },
        { key: 'cover', label: '封面图', accept: '.jpg,.jpeg,.png,.webp', multiple: true, required: false, tip: '可选，缺省取首页' }
      ]
    },
    '操作手册': {
      hint: '一份手册 = 一个 pdf/doc + 清单表的一行',
      mats: [
        { key: 'main', label: '手册文件', accept: '.pdf,.doc,.docx', multiple: true, required: true, tip: '可多选' },
        { key: 'cover', label: '封面图', accept: '.jpg,.jpeg,.png,.webp', multiple: true, required: false, tip: '可选' }
      ]
    },
    '宣传折页': {
      hint: '一份折页 = 1~2 张图片（正面 / 反面）+ 清单表的一行',
      mats: [
        { key: 'main', label: '折页图片', accept: '.jpg,.jpeg,.png,.webp', multiple: true, required: true, tip: '正面命名 _正面，反面 _反面' }
      ]
    },
    '文章': {
      hint: '一篇文章 = 可选 Word 正文 + 清单表的一行',
      mats: [
        { key: 'doc', label: '正文文件', accept: '.docx,.doc', multiple: true, required: false, tip: '可选，也可直接在清单里写正文' }
      ]
    },
    '图文': {
      hint: '一条图文 = 一段正文 + 一组图片 + 清单表的一行（图是主体）',
      mats: [
        { key: 'img', label: '图片', accept: '.jpg,.jpeg,.png,.webp', multiple: true, required: true, tip: '最多 9 张，与清单「文件名」列一一对应' }
      ]
    },
  };

  /* 清单表标准字段（设计文档 §二） */
  /* 「依据出处」列已移除：该字段不再采集，模板里留着只会让人以为必填 */
  var COLS = ['标题', '病种', '使用场景', '受众', '标签', '摘要', '正文', '文件名', '封面文件名', '合集名', '集号'];

  var state = null;

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function $(id) { return document.getElementById(id); }
  function say(msg, type) { if (window.toast) window.toast(msg, type); }
  function fmtSize(b) {
    if (!b && b !== 0) return '—';
    if (b > 1048576) return (b / 1048576).toFixed(1) + ' MB';
    if (b > 1024) return (b / 1024).toFixed(0) + ' KB';
    return b + ' B';
  }
  function splitList(v) {
    return String(v || '').split(/[、,，;；\/]/).map(function (x) { return x.trim(); }).filter(Boolean);
  }

  /* ================= 打开 ================= */
  function open(track, kind) {
    state = { track: track || '科普', kind: kind || '', step: 1, mats: {}, sheet: null, rows: [], result: [] };
    render();
  }

  function close() {
    if (state && state.timers) state.timers.forEach(function (t) { clearTimeout(t); });
    document.querySelectorAll('.kbb').forEach(function (x) { x.remove(); });
    state = null;
  }

  function render() {
    document.querySelectorAll('.kbb').forEach(function (x) { x.remove(); });
    var o = document.createElement('div');
    o.className = 'bi-overlay kbb';
    o.innerHTML = '<div class="bi-dialog kbb-dialog">' +
      '<div class="bi-header"><span>批量上传 · ' + esc(state.track) + '内容' +
      (state.kind ? '<em class="kbb-kind">' + esc(state.kind) + '</em>' : '') + '</span>' +
      '<span class="bi-close" data-kbb="close">×</span></div>' +
      '<div class="kbb-steps">' + stepBar() + '</div>' +
      '<div class="bi-body kbb-body">' + body() + '</div>' +
      '<div class="bi-footer">' + footer() + '</div></div>';
    document.body.appendChild(o);
    bind();
  }

  function stepBar() {
    var steps = ['选择形式', '上传物料', '预览导入'];
    return steps.map(function (s, i) {
      var n = i + 1;
      var cls = state.step === n ? 'on' : (state.step > n ? 'done' : '');
      return '<span class="kbb-step ' + cls + '"><i>' + (state.step > n ? '✓' : n) + '</i>' + s + '</span>';
    }).join('<span class="kbb-step-line"></span>');
  }

  function body() {
    if (state.step === 1) return bodyPickKind();
    if (state.step === 2) return bodyUpload();
    return bodyPreview();
  }

  /* ---------- 第一步：选内容形式 ---------- */
  function bodyPickKind() {
    var kinds = ['文章', '图文', '视频', '课件', '操作手册', '宣传折页'];
    return '<div class="kbb-pick">' +
      '<div class="kbb-pick-hd">选择要上传的内容形式</div>' +
      '<div class="kbb-pick-grid">' + kinds.map(function (k) {
        var s = SPECS[k];
        var mats = s.mats.length ? s.mats.map(function (m) { return m.label; }).join(' + ') : '仅清单表';
        return '<button type="button" class="kbb-kind-card" data-kbb="pickKind" data-arg="' + k + '">' +
          '<b>' + k + '</b><span>' + esc(mats) + '</span></button>';
      }).join('') + '</div>' +
      '<div class="kbb-tip">不同内容形式要传的物料不一样。视频要视频文件，图文可以只写清单。</div>' +
      '</div>';
  }

  /* ---------- 第二步：传物料 ---------- */
  function bodyUpload() {
    var spec = SPECS[state.kind];
    var mats = spec.mats.map(function (m, i) {
      var list = state.mats[m.key] || [];
      return '<div class="kbb-mat">' +
        '<div class="kbb-mat-hd"><span class="kbb-mat-no">' + (i + 1) + '</span><b>' + esc(m.label) + '</b>' +
        (m.required ? '<em class="kbb-req">必传</em>' : '<em class="kbb-opt">可选</em>') +
        '<span class="kbb-mat-tip">' + esc(m.tip) + '</span></div>' +
        '<div class="kbb-drop" data-kbb="drop" data-arg="' + m.key + '">' +
        '<span>拖入或点击选择 ' + esc(m.accept.replace(/\./g, ' ').toUpperCase()) + '</span>' +
        '<input type="file" data-mat="' + m.key + '" accept="' + m.accept + '"' + (m.multiple ? ' multiple' : '') + ' style="display:none">' +
        '</div>' +
        (list.length ? '<div class="kbb-files">' + list.map(function (f, j) {
          return '<span class="kbb-file"><i>' + esc(String(f.name).split('.').pop().toUpperCase()) + '</i>' +
            '<span class="kbb-file-n">' + esc(f.name) + '</span><span class="kbb-file-s">' + fmtSize(f.size) + '</span>' +
            '<button type="button" data-kbb="rmMat" data-arg="' + m.key + '|' + j + '">✕</button></span>';
        }).join('') + '</div>' : '') +
        '</div>';
    }).join('');

    var sheetBlock = '<div class="kbb-mat">' +
      '<div class="kbb-mat-hd"><span class="kbb-mat-no">' + (spec.mats.length + 1) + '</span><b>清单表</b>' +
      '<em class="kbb-req">必传</em><span class="kbb-mat-tip">Excel 一行一条内容</span></div>' +
      '<div class="kbb-sheet-ops">' +
      '<button type="button" class="btn btn-outline btn-sm" data-kbb="tmpl">下载模板</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-kbb="sheetPick">选择清单表（.xlsx / .csv）</button>' +
      '<input type="file" id="kbb-sheet-input" accept=".xlsx,.csv" style="display:none">' +
      (state.sheet ? '<span class="kbb-sheet-ok">已解析 ' + state.rows.length + ' 行：' + esc(state.sheet.name) + '</span>' : '') +
      '</div></div>';

    /* 命名规则必须写在传物料这一步上：解析失败的绝大部分原因是「文件名对不上」，
       而这一步是用户唯一还能改名字的地方，等到预览页再报错就得退回来重传。 */
    var nameNote = spec.mats.length
      ? '<div class="kbb-note">' +
        '<b>文件名必须和清单表一一对应</b>' +
        '<p>系统靠<b>文件名</b>把物料和表格行对应起来，所以清单表「文件名」列填的值，' +
        '要和上传的文件名<b>完全一致</b>——包括扩展名和空格，大小写也要一样。' +
        '例：表里写 <code>放疗护理_第2集.mp4</code>，上传的文件就必须叫这个名字。</p>' +
        '<p>封面同理：「封面文件名」列要与封面图的实际文件名一致，对不上时这条会没有封面。' +
        '对不上的物料不会自动匹配，解析时会报「找不到物料：xxx」。</p>' +
        '</div>'
      : '';
    return '<div class="kbb-upload"><div class="kbb-hint">' + esc(spec.hint) + '</div>' + nameNote + mats + sheetBlock + '</div>';
  }

  /* ---------- 第三步：预览 ---------- */
  function bodyPreview() {
    /* 解析中：只显示进度 */
    if (state.parsing && !state.parsing.done) {
      var stepLabel = PARSE_STEPS[Math.min(state.parsing.step, PARSE_STEPS.length - 1)];
      var pct = Math.round(state.parsing.step / PARSE_STEPS.length * 100);
      return '<div class="kbb-prog">' +
        '<div class="kbb-prog-hd">正在解析清单…</div>' +
        '<div class="kbb-prog-bar"><i style="width:' + pct + '%"></i></div>' +
        '<div class="kbb-prog-label">' + esc(stepLabel) + '…</div>' +
        '<div class="kbb-prog-list">' + PARSE_STEPS.map(function (t, i) {
          var cls = i < state.parsing.step ? 'done' : (i === state.parsing.step ? 'on' : '');
          return '<span class="kbb-prog-item ' + cls + '">' + (i < state.parsing.step ? '✓ ' : '') + esc(t) + '</span>';
        }).join('') + '</div></div>';
    }

    var okRows = state.result.filter(function (r) { return r.ok; });
    var badRows = state.result.filter(function (r) { return !r.ok; });

    function rowCard(r, idx, isBad) {
      /* 每一行都给「删除」：解析成功但不想导的那几行，以前只能整批从头再来。
         失败行多给一个「重试」：补上物料后单独重验这一行，不必重解析整张表。 */
      var ops = (isBad ? '<button type="button" class="kbb-row-op kbb-row-op--retry" data-kbb="retryRow" data-arg="' + r.rid + '">重试</button>' : '') +
        '<button type="button" class="kbb-row-op kbb-row-op--del" data-kbb="rmRow" data-arg="' + r.rid + '" title="不导入这一行">删除</button>';
      return '<div class="kbb-row' + (isBad ? ' is-bad' : '') + '">' +
        '<div class="kbb-row-hd"><span class="kbb-row-no">' + (idx + 1) + '</span>' +
        '<b>' + esc(r.title || '（无标题）') + '</b>' +
        '<span class="kbb-row-line">第 ' + r.row + ' 行</span>' +
        (isBad ? '<em class="kbb-bad">' + esc(r.problem) + '</em>' : '<em class="kbb-ok">可导入</em>') +
        '<span class="kbb-row-ops">' + ops + '</span></div>' +
        (isBad
          ? (r.warn ? '<div class="kbb-row-body"><div class="wide"><span>提示</span>' + esc(r.warn) + '</div></div>' : '')
          : '<div class="kbb-row-body">' +
          '<div><span>形式</span>' + esc(r.kind) + '</div>' +
          '<div><span>物料</span>' + (r.matNames.length ? esc(r.matNames.join('、')) : '<i class="kbb-none">无（纯文字）</i>') + '</div>' +
          '<div><span>病种</span>' + esc(r.sites.join('、') || '通用') + '</div>' +
          '<div><span>场景</span>' + esc(r.scenes.join('、') || '—') + '</div>' +
          '<div><span>标签</span>' + esc(r.tags.join('、') || '—') + '</div>' +
          (r.collection ? '<div><span>合集</span>' + esc(r.collection) + '</div>' : '') +
          '<div class="wide"><span>摘要</span>' + esc(r.summary || '—') + '</div>' +
          (r.warn ? '<div class="wide"><span>提示</span><em class="kbb-warn">' + esc(r.warn) + '</em></div>' : '') +
          '</div>') + '</div>';
    }

    return '<div class="kbb-preview">' +
      '<div class="kbb-sum">解析完成：共 <b>' + state.result.length + '</b> 行' +
      '<span class="kbb-ok">成功 ' + okRows.length + ' 条</span>' +
      (badRows.length ? '<span class="kbb-bad">失败 ' + badRows.length + ' 条</span>' : '') +
      (state.sheet && state.sheet.demo ? '<span class="kbb-demo">演示数据</span>' : '') +
      '</div>' +

      (okRows.length ? '<div class="kbb-group"><div class="kbb-group-hd kbb-group-hd--ok">✓ 解析成功（' + okRows.length + '）</div>' +
        '<div class="kbb-rows">' + okRows.map(function (r, i) { return rowCard(r, i, false); }).join('') + '</div></div>' : '') +

      (badRows.length ? '<div class="kbb-group"><div class="kbb-group-hd kbb-group-hd--bad">✕ 解析失败（' + badRows.length + '）' +
        '<span>这些行不会导入；补上物料后点「重试」，或直接删掉</span></div>' +
        '<div class="kbb-rows">' + badRows.map(function (r, i) { return rowCard(r, i, true); }).join('') + '</div></div>' : '') +

      (!state.result.length ? '<div class="kbb-empty">预览里的行都删完了。点「重新解析」按当前清单重新出一遍。</div>' : '') +
      '</div>';
  }

  function footer() {
    if (state.step === 1) return '<button class="btn btn-ghost btn-sm" data-kbb="close">取消</button>';
    if (state.step === 2) {
      return '<button class="btn btn-ghost btn-sm" data-kbb="prev">上一步</button>' +
        '<button class="btn btn-primary btn-sm" data-kbb="next">解析清单</button>' +
        '<button class="btn btn-ghost btn-sm" data-kbb="close">取消</button>';
    }
    if (state.parsing && !state.parsing.done) {
      return '<span class="kbb-parsing">解析中，请稍候…</span>';
    }
    var ok = state.result.filter(function (r) { return r.ok; }).length;
    return '<button class="btn btn-ghost btn-sm" data-kbb="prev">重新解析</button>' +
      '<button class="btn btn-primary btn-sm" data-kbb="import"' + (ok ? '' : ' disabled') + '>导入 ' + ok + ' 条内容</button>' +
      '<button class="btn btn-ghost btn-sm" data-kbb="close">取消</button>';
  }

  /* ================= 事件 ================= */
  function bind() {
    document.querySelectorAll('.kbb [data-kbb]').forEach(function (el) {
      el.addEventListener('click', function (ev) {
        var act = el.getAttribute('data-kbb');
        var arg = el.getAttribute('data-arg') || '';
        if (act === 'close') { close(); return; }
        if (act === 'pickKind') { state.kind = arg; state.step = 2; render(); return; }
        if (act === 'prev') {
          if (state.timers) state.timers.forEach(function (t) { clearTimeout(t); });
          state.step = Math.max(1, state.step - 1);
          state.parsing = null;
          state.result = [];
          render(); return;
        }
        if (act === 'retryRow') { retryRow(arg); return; }
        if (act === 'rmRow') { rmRow(arg); return; }
        if (act === 'rmMat') {
          var p = arg.split('|');
          (state.mats[p[0]] || []).splice(parseInt(p[1], 10), 1);
          render(); return;
        }
        if (act === 'tmpl') { downloadTemplate(); return; }
        if (act === 'sheetPick') { var si = $('kbb-sheet-input'); if (si) si.click(); return; }
        if (act === 'drop') { var inp = document.querySelector('.kbb [data-mat="' + arg + '"]'); if (inp) inp.click(); return; }
        if (act === 'next') { toPreview(); return; }
        if (act === 'import') { doImport(); return; }
      });
    });
    document.querySelectorAll('.kbb [data-mat]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var key = inp.getAttribute('data-mat');
        state.mats[key] = state.mats[key] || [];
        Array.prototype.forEach.call(inp.files || [], function (f) {
          if (!state.mats[key].some(function (x) { return x.name === f.name; })) state.mats[key].push(f);
        });
        render();
      });
    });
    var si = $('kbb-sheet-input');
    if (si) si.addEventListener('change', function () { onSheet(si.files && si.files[0]); });
  }

  function downloadTemplate() {
    var cols = COLS;
    /* 模板只带受众里的一种写法：培训线写岗位，科普线写人群。示例行取当前内容线的第一个受众选项 */
    var audSample = state.track === '培训' ? '登记员 / 报告卡录入' : '患者本人、家属 / 照护者';
    var sample = [{ 标题: '放疗期间皮肤护理 5 要点', 病种: '通用', 使用场景: '随访宣教、候诊播放', 受众: audSample, 标签: '放疗', 摘要: '放射性皮肤反应的居家护理要点', 正文: '', 文件名: '放疗护理_第2集.mp4', 封面文件名: '', 合集名: '放疗全程护理', 集号: '2' }];
    var csv = window.KBSheet.template(cols, sample);
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '批量上传模板_' + state.kind + '.csv';
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 200);
    say('模板已下载，用 Excel 打开填行即可', 'success');
  }

  async function onSheet(file) {
    if (!file) return;
    try {
      var res = await window.KBSheet.parse(file);
      state.sheet = file;
      state.rows = res.rows;
      state.headers = res.headers;
      var need = ['标题', '摘要'];
      var miss = need.filter(function (c) { return res.headers.indexOf(c) < 0; });
      if (miss.length) { say('清单缺少必需列：' + miss.join('、'), 'error'); state.rows = []; }
      else say('已解析 ' + res.rows.length + ' 行', 'success');
    } catch (e) {
      say('清单解析失败：' + e.message, 'error');
      state.rows = [];
    }
    render();
  }

  /* 物料池：按文件名建索引，供清单「文件名」列关联 */
  function materialPool() {
    var pool = {};
    Object.keys(state.mats).forEach(function (k) {
      (state.mats[k] || []).forEach(function (f) { pool[f.name] = { file: f, role: k }; });
    });
    return pool;
  }

  /* 演示数据：原型阶段不真上传，点「解析清单」直接用这份模拟结果
     覆盖成功 / 失败两类，方便看清预览页的分组 */
  function demoRows(kind) {
    var base = [
      { __row: 2, '标题': '放疗期间皮肤护理 5 要点', '摘要': '放射性皮肤反应的居家护理要点', '病种': '通用', '使用场景': '随访宣教、候诊播放', '受众': '患者本人、家属 / 照护者', '标签': '放疗', '文件名': '放疗护理_第2集.mp4', '封面文件名': '放疗护理_第2集_封面.jpg', '合集名': '放疗全程护理', '集号': '2' },
      { __row: 3, '标题': '放疗结束后如何复查', '摘要': '复查时间表与需要携带的材料', '病种': '通用', '使用场景': '随访宣教', '受众': '患者本人、家属 / 照护者', '标签': '放疗、复查', '文件名': '放疗复查_第4集.mp4', '合集名': '放疗全程护理', '集号': '4' },
      { __row: 4, '标题': '化疗后白细胞下降的饮食', '摘要': '骨髓抑制期的营养支持与防护', '病种': '通用', '使用场景': '随访宣教', '受众': '患者本人、家属 / 照护者', '标签': '化疗、饮食', '文件名': '化疗饮食_第1集.mp4' },
      { __row: 5, '标题': '报告卡填报规范', '摘要': '必填字段口径与常见退回', '病种': '通用', '使用场景': '上岗培训', '受众': '登记员 / 报告卡录入', '标签': '报告卡', '文件名': '不存在的课件.pptx' },
      { __row: 6, '标题': '癌痛用药会不会成瘾', '摘要': '', '病种': '通用', '使用场景': '随访宣教', '文件名': '放疗护理_第2集.mp4' }
    ];
    if (kind === '课件') {
      base.forEach(function (r, i) { r['文件名'] = ['报告卡填报规范.pptx', '随访操作演示.pptx', '死因填写规范.pptx', '缺失.pptx', '重卡合并.pptx'][i]; });
    }
    return base;
  }
  /* 演示用的假物料池：让「文件名」列能对上，从而演示成功路径 */
  function demoMaterials(rows) {
    var pool = {};
    (state.mats.video || []).forEach(function (f) { pool[f.name] = { file: f, role: 'main' }; });
    (state.mats.main || []).forEach(function (f) { pool[f.name] = { file: f, role: 'main' }; });
    (state.mats.cover || []).forEach(function (f) { pool[f.name] = { file: f, role: 'cover' }; });
    /* doc / img 也要进池：以前只收 video/main/cover，
       传了 Word 和图片却在清单里关联不上，等于传了个寂寞 */
    (state.mats.doc || []).forEach(function (f) { pool[f.name] = { file: f, role: 'main' }; });
    (state.mats.img || []).forEach(function (f) { pool[f.name] = { file: f, role: 'img' }; });
    /* 演示：按文件名造占位物料，但故意让「不存在 / 缺失」这类名字匹配不上，
       好让预览页能同时展示成功与失败两组 */
    function looksMissing(n) { return /不存在|缺失|missing/i.test(n); }
    rows.forEach(function (r) {
      var n = String(r['文件名'] || '').trim();
      if (n && !pool[n] && !looksMissing(n)) pool[n] = { file: { name: n, size: 12 * 1024 * 1024 }, role: 'main', demo: true };
      var c = String(r['封面文件名'] || '').trim();
      if (c && !pool[c] && !looksMissing(c)) pool[c] = { file: { name: c, size: 320 * 1024 }, role: 'cover', demo: true };
    });
    return pool;
  }

  /* 解析：演示模式下没有真文件也能走通——用 demoRows 造清单、按文件名造占位物料。
     有真文件时走真实清单，逻辑不变。解析过程分阶段显示进度。 */
  var PARSE_STEPS = ['读取清单', '校验字段', '关联物料', '生成内容'];

  function toPreview() {
    if (state.parsing) return;
    var spec = SPECS[state.kind];
    /* 演示：不强制物料齐全，直接进入解析 */
    if (!state.rows.length) {
      state.rows = demoRows(state.kind);
      state.sheet = { name: '演示清单_' + state.kind + '.xlsx', demo: true };
    }
    state.parsing = { step: 0, done: false };
    state.step = 3;
    render();

    var timers = [];
    PARSE_STEPS.forEach(function (label, i) {
      timers.push(setTimeout(function () {
        if (!state) return;
        state.parsing.step = i + 1;
        var el = document.querySelector('.kbb-prog-label');
        var bar = document.querySelector('.kbb-prog-bar i');
        if (el) el.textContent = label + '…';
        if (bar) bar.style.width = Math.round((i + 1) / PARSE_STEPS.length * 100) + '%';
        if (i === PARSE_STEPS.length - 1) timers.push(setTimeout(finishParse, 260));
      }, 220 * (i + 1)));
    });
    state.timers = timers;
  }

  /* 单行校验：解析与「重试」共用同一套判定，避免两处规则各说各话。
     raw 是清单表里的一行；pool 是「文件名 → 物料」索引。 */
  var RID = 0;
  function validateRow(raw, pool) {
    var spec = SPECS[state.kind];
    var mainName = String(raw['文件名'] || '').trim();
    var coverName = String(raw['封面文件名'] || '').trim();
    var matNames = [];
    var problem = '';
    var warn = '';

    var matsRequired = spec.mats.some(function (m) { return m.required; });
    if (mainName) {
      if (pool[mainName]) matNames.push(mainName);
      else problem = '找不到物料：' + mainName;
    } else if (matsRequired) {
      /* 只有在物料必传时才拦。文章、图文的正文文件/图片是可选的，
         没填不代表有问题（图文若一张图都没有，会在保存时按形式规则再判一次） */
      var needLabel = spec.mats.filter(function (m) { return m.required; })
        .map(function (m) { return m.label; }).join(' / ');
      problem = '清单未填「文件名」列，无法关联' + needLabel;
    }
    /* 图文的图片物料是必传的，但清单里可能整列没填：上面按 matsRequired 已经拦了；
       这里再兜一层——填了名字但对不上图时，同样不能放过。 */
    if (state.kind === '图文' && !problem && !matNames.length) {
      problem = '图文至少要关联 1 张图片';
    }
    if (coverName) {
      if (pool[coverName]) matNames.push(coverName);
      /* 封面缺了不算失败（封面本来就是可选项），但必须说出来：
         静默丢掉的话，导进去才发现没封面，人根本不知道是名字对不上。 */
      else warn = '封面「' + coverName + '」没找到，这条会没有封面';
    }

    var title = String(raw['标题'] || '').trim();
    if (!title && !problem) problem = '缺标题';
    var summary = String(raw['摘要'] || '').trim();
    if (!summary && !problem) problem = '缺摘要';

    return {
      rid: ++RID,
      raw: raw,
      row: raw.__row,
      title: title,
      summary: summary,
      body: String(raw['正文'] || raw['答案'] || ''),
      question: String(raw['问题'] || ''),
      kind: state.kind,
      sites: splitList(raw['病种']).length ? splitList(raw['病种']) : ['通用'],
      scenes: splitList(raw['使用场景']),
      audiences: splitList(raw['受众']),
      tags: splitList(raw['标签']),
      /* 模板已不带依据出处；旧模板多出这一列也只是被忽略，不报错 */
      collection: String(raw['合集名'] || ''),
      episode: parseInt(raw['集号'], 10) || 0,
      matNames: matNames,
      mainName: mainName,
      coverName: coverName,
      ok: !problem,
      problem: problem,
      warn: warn
    };
  }

  function finishParse() {
    var pool = demoMaterials(state.rows);
    state.result = state.rows.map(function (r) { return validateRow(r, pool); });
    state.pool = pool;
    state.parsing.done = true;
    render();
  }

  /* 重试一条：按当前已上传的物料重新校验这一行。
     典型用法是「回去补上缺的那个文件，再点重试」，不用把整张表重解析一遍。 */
  function retryRow(rid) {
    var i = state.result.findIndex(function (r) { return String(r.rid) === String(rid); });
    if (i < 0) return;
    var pool = demoMaterials(state.rows);
    var old = state.result[i];
    var fresh = validateRow(old.raw, pool);
    fresh.rid = old.rid;          /* 保持 rid 不变，按钮的 data-arg 才不会失效 */
    fresh.raw = old.raw;
    state.result[i] = fresh;
    state.pool = pool;
    render();
    if (fresh.ok) say('已通过：' + (fresh.title || '（无标题）'), 'success');
    else say('仍然不行：' + fresh.problem + '（核对文件名后重试，或点上一步补传物料）', 'error');
  }

  /* 删除一行：成功的、失败的都能删。删完底部「导入 N 条」会自动跟着变。 */
  function rmRow(rid) {
    var before = state.result.length;
    state.result = state.result.filter(function (r) { return String(r.rid) !== String(rid); });
    if (state.result.length === before) return;
    render();
  }

  /* 把一个 File 读成 dataURL。图集存的是图片本身（dataURL），不是文件名——
     附件那套只记 name/size，存进去详情页也只有一行下载条目，显示不出图。 */
  function fileToDataUrl(file) {
    return new Promise(function (resolve) {
      if (!file || !/^image\//.test(file.type || '')) { resolve(''); return; }
      if (file.size > 1024 * 1024) { resolve(''); return; }   /* 与单条图集同一上限 */
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result)); };
      r.onerror = function () { resolve(''); };
      r.readAsDataURL(file);
    });
  }
  function doImport() {
    var pool = state.pool || materialPool();
    var okRows = state.result.filter(function (r) { return r.ok; });
    if (!okRows.length) { say('没有可导入的内容', 'error'); return; }

    var KB = window.KB;
    var org = (KB.me && KB.me.org) || '本院';
    /* 批量导入也要记人：「我的上传」按 createdBy 认，「上传人 / 上传机构」按同一账号显示。
       原来这里不写 createdBy，导进来的内容在「我的上传」里查无此人。 */
    var me = (typeof KB.currentUser === 'function' ? KB.currentUser() : null) || { id: '', name: '', org: org };
    /* 同一批导入共用一个时间戳，列表按上传时间排序时不会因毫秒差打乱批次顺序 */
    var importedAt = (function () { var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); })();
    var added = 0;
    var isGallery = (state.kind === '图文');
    okRows.forEach(function (r) {
      var id = 'KB-H-' + (3000 + KB.assets.filter(function (a) { return /^KB-H-/.test(a.id); }).length + added + 1);
      /* 图文：图片进 gallery（本体），不再重复塞进附件；
         其它形式：物料仍是附件（视频/课件/手册要能下载）。 */
      var attachments = isGallery ? [] : r.matNames.map(function (n) {
        var m = pool[n];
        return { name: n, size: fmtSize(m.file.size), role: m.role === 'cover' ? 'cover' : 'main' };
      });
      var body = r.body;
      if (!body && r.question) body = '<p><b>问：</b>' + esc(r.question) + '</p><p><b>答：</b>' + esc(r.summary) + '</p>';
      if (!body) body = '<p>' + esc(r.summary) + '</p>';
      var asset = {
        id: id, track: state.track, kind: r.kind, title: r.title,
        summary: r.summary, body: body,
        sites: r.sites, scenes: r.scenes.length ? r.scenes : ['随访宣教'],
        /* 受众两套按内容线走：培训行的默认是登记员，科普行是患者本人 */
        tags: r.tags, audiences: r.audiences.length ? r.audiences : (state.track === '培训' ? ['登记员 / 报告卡录入'] : ['患者本人']),
        lib: '院内', org: org, status: '停用', publishedAt: '',
        createdBy: me.id, uploader: me.name, uploaderOrg: me.org || org, createdAt: importedAt,
        evidence: r.evidence, attachments: attachments,
        cover: r.coverName || '', note: '批量上传导入'
      };
      KB.assets.push(asset);
      /* 图集：把这一行的图片读成 dataURL 后回填。读图是异步的，
         所以先落库占位，读完再补 gallery 并重绘一次。 */
      if (isGallery && r.matNames.length) {
        (function (target, names) {
          Promise.all(names.map(function (nm) {
            var m = pool[nm];
            return fileToDataUrl(m && m.file).then(function (src) {
              return src ? { src: src, caption: '', name: nm } : null;
            });
          })).then(function (list) {
            var gs = list.filter(Boolean);
            if (gs.length) {
              target.gallery = gs;
              if (window.KBDetail && window.KBDetail.hydrateCollectionCards) { /* noop */ }
              if (window.navigateTo && KB.detail === target.id) window.navigateTo('kb-detail|' + target.id);
            }
          });
        })(asset, r.matNames.slice(0, 9));
      }
      /* 合集：按名字找，找不到就建一个停用的 */
      if (r.collection) {
        var col = KB.collections.filter(function (c) { return c.name === r.collection; })[0];
        if (!col) {
          col = { id: 'CL-' + (900 + KB.collections.length + 1), name: r.collection, track: state.track,
            desc: '批量上传时新建', cover: '', tags: [], lib: '院内', org: org,
            status: '停用', createdAt: '', updatedAt: '', members: [] };
          KB.collections.push(col);
        }
        if (col.members.indexOf(id) < 0) col.members.push(id);
      }
      added++;
    });

    close();
    say('已导入 ' + added + ' 条内容（停用状态），确认无误后上架', 'success');
    if (window.KB_SYNC_HOME_NEWS) window.KB_SYNC_HOME_NEWS();
    var pageId = state ? (state.track === '培训' ? 'kb-train' : 'kb-sci') : 'kb-sci';
    if (window.navigateTo) window.navigateTo(pageId);
    else if (window.renderKBPage) window.renderKBPage(pageId);
  }

  window.KBBulk = { open: open, close: close, SPECS: SPECS };
})();
