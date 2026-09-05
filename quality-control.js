/*
 * 肿瘤质控管理模块（完整版）
 * 对应功能域（9 大质控域，页内页签聚合 30 个数据视图）：
 *   肿瘤病案首页质控 / 确诊病例质控 / 病理信息质控 / TNM 分期质控
 *   专病病程质控 / MDT 多学科诊疗质控 / 远程会诊质控
 *   人群纳管与分组质控 / 全域数据质控与绩效监测
 * 交互完整度：真数据数组 → 可用筛选/检索/翻页 → 记录详情弹窗 →
 *   状态流转（复核/整改/归档/处理/启停）→ 新增/编辑/删除 → 关键指标可视化。
 */
(function () {
  'use strict';

  const OWNED_IDS = [
    'qc-homepage', 'qc-confirmed', 'qc-pathology', 'qc-tnm', 'qc-course',
    'qc-mdt', 'qc-remote', 'qc-cohort', 'qc-global'
  ];

  const style = document.createElement('style');
  style.textContent = `
#pageContainer .qc-page{padding-bottom:20px}
#pageContainer .qc-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:12px}
#pageContainer .qc-title{font-size:17px;font-weight:700;color:#1e293b}
#pageContainer .qc-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
#pageContainer .qc-tabs{display:flex;gap:4px;border-bottom:1px solid var(--border);margin-bottom:12px;flex-wrap:wrap}
#pageContainer .qc-tab{appearance:none;border:0;background:transparent;color:#667085;padding:9px 14px;font-size:13px;font-weight:600;cursor:pointer;border-bottom:2px solid transparent}
#pageContainer .qc-tab.active{color:var(--primary);border-bottom-color:var(--primary)}
#pageContainer .qc-tab:hover{color:var(--primary)}
#pageContainer .qc-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:10px;margin-bottom:12px}
#pageContainer .qc-kpi{background:#fff;border:1px solid var(--border);border-radius:6px;padding:11px 13px}
#pageContainer .qc-kpi-label{font-size:12px;color:#667085}
#pageContainer .qc-kpi-value{margin-top:5px;font-size:23px;font-weight:700;color:var(--primary);font-variant-numeric:tabular-nums}
#pageContainer .qc-kpi-value.danger{color:#b42335}
#pageContainer .qc-kpi-value.warn{color:#b54708}
#pageContainer .qc-kpi-value.ok{color:#15803d}
#pageContainer .qc-kpi-meta{margin-top:3px;font-size:11px;color:#94a3b8}
#pageContainer .qc-toolbar{display:flex;flex-wrap:wrap;gap:10px 12px;align-items:flex-end;padding:12px 14px;background:#f8fafc;border:1px solid var(--border);border-radius:6px;margin-bottom:12px}
#pageContainer .qc-field{display:flex;flex-direction:column;gap:5px;min-width:0}
#pageContainer .qc-field.kw{flex:1 1 220px;min-width:180px}
#pageContainer .qc-field-label{font-size:12px;color:#667085}
#pageContainer .qc-field select,#pageContainer .qc-field input:not([type=checkbox]){height:34px;padding:0 10px;border:1px solid var(--border);border-radius:4px;background:#fff;font-size:13px;color:#1e293b;min-width:140px;box-sizing:border-box}
#pageContainer .qc-field.kw input{min-width:0;width:100%}
#pageContainer .qc-field select:focus,#pageContainer .qc-field input:focus{outline:none;border-color:var(--primary)}
#pageContainer .qc-field-actions{display:flex;gap:8px;align-items:flex-end}
#pageContainer .qc-tblwrap{overflow:auto;border:1px solid var(--border);border-radius:6px;background:#fff}
#pageContainer .qc-tbl{width:100%;min-width:960px;border-collapse:collapse}
#pageContainer .qc-tbl th{height:40px;padding:0 11px;text-align:left;background:#f8fafc;color:#5b6673;font-size:12px;font-weight:600;border-bottom:1px solid var(--border);white-space:nowrap}
#pageContainer .qc-tbl td{height:46px;padding:7px 11px;border-bottom:1px solid var(--border);color:#334155;font-size:13px;vertical-align:middle}
#pageContainer .qc-tbl tbody tr:hover{background:#f5f9ff}
#pageContainer .qc-tbl th.num,#pageContainer .qc-tbl td.num{text-align:right;font-variant-numeric:tabular-nums}
#pageContainer .qc-tbl .badge{white-space:nowrap}
#pageContainer .qc-num{font-variant-numeric:tabular-nums;text-align:right}
#pageContainer .qc-bar{height:6px;border-radius:3px;background:#eef2f7;overflow:hidden;margin-top:5px;min-width:70px;max-width:150px}
#pageContainer .qc-bar>i{display:block;height:100%;background:var(--primary)}
#pageContainer .qc-bar>i.warn{background:#f59e0b}
#pageContainer .qc-bar>i.bad{background:#dc2626}
#pageContainer .qc-bar>i.ok{background:#16a34a}
#pageContainer .qc-link{background:none;border:0;padding:0;color:var(--primary);font-weight:600;font-size:13px;cursor:pointer}
#pageContainer .qc-link:hover{text-decoration:underline}
#pageContainer .qc-sub{font-size:11px;color:#94a3b8;margin-top:3px;line-height:1.4}
#pageContainer .qc-opbtn{white-space:nowrap}
#pageContainer .qc-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 4px 2px;font-size:12px;color:#64748b}
#pageContainer .qc-pager{display:inline-flex;align-items:center;gap:6px}
#pageContainer .qc-pager-cur{display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:28px;padding:0 6px;border-radius:4px;background:var(--primary);color:#fff;font-weight:600}
#pageContainer .qc-grid2{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:14px;align-items:start}
@media(max-width:1280px){#pageContainer .qc-grid2{grid-template-columns:minmax(0,1fr)}}
#pageContainer .qc-card{background:#fff;border:1px solid var(--border);border-radius:6px;margin-bottom:12px;overflow:hidden}
#pageContainer .qc-card-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 14px;border-bottom:1px solid var(--border);background:#fbfcfe}
#pageContainer .qc-card-title{font-size:14px;font-weight:600;color:#1e293b}
#pageContainer .qc-card-body{padding:13px 14px}
#pageContainer .qc-cfg{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
#pageContainer .qc-cfg-item{border:1px solid var(--border);border-radius:6px;padding:12px 14px;background:#fff}
#pageContainer .qc-cfg-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}
#pageContainer .qc-cfg-name{font-size:14px;font-weight:600;color:#1e293b}
#pageContainer .qc-cfg-meta{display:flex;flex-direction:column;gap:6px;font-size:12px;color:#475569}
#pageContainer .qc-cfg-meta span{display:flex;justify-content:space-between;gap:10px}
#pageContainer .qc-cfg-meta b{color:#1e293b;font-weight:600;text-align:right}
#pageContainer .qc-cfg-foot{display:flex;gap:8px;margin-top:11px;padding-top:10px;border-top:1px dashed var(--border)}
#pageContainer .qc-switch{position:relative;display:inline-block;width:38px;height:20px;flex:none}
#pageContainer .qc-switch input{opacity:0;width:0;height:0}
#pageContainer .qc-switch i{position:absolute;top:0;left:0;right:0;bottom:0;background:#cbd5e1;border-radius:20px;transition:.2s;cursor:pointer}
#pageContainer .qc-switch i:before{content:'';position:absolute;left:2px;top:2px;width:16px;height:16px;background:#fff;border-radius:50%;transition:.2s}
#pageContainer .qc-switch input:checked+i{background:var(--primary)}
#pageContainer .qc-switch input:checked+i:before{transform:translateX(18px)}
#pageContainer .qc-flow{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:14px;overflow-x:auto;padding:6px 0}
#pageContainer .qc-step{flex:1;min-width:96px;text-align:center;position:relative}
#pageContainer .qc-step-dot{width:26px;height:26px;margin:0 auto;border-radius:50%;background:#eef2f7;color:#94a3b8;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;border:2px solid #e2e8f0}
#pageContainer .qc-step.done .qc-step-dot{background:var(--primary);border-color:var(--primary);color:#fff}
#pageContainer .qc-step.now .qc-step-dot{background:#fff;border-color:var(--primary);color:var(--primary)}
#pageContainer .qc-step-name{margin-top:6px;font-size:12px;color:#475569;font-weight:600}
#pageContainer .qc-step-date{margin-top:2px;font-size:11px;color:#94a3b8}
#pageContainer .qc-step-conn{position:absolute;top:13px;left:calc(50% + 14px);right:calc(-50% + 14px);height:2px;background:#e2e8f0}
#pageContainer .qc-step:last-child .qc-step-conn{display:none}
#pageContainer .qc-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:9px}
#pageContainer .qc-fld{min-width:0;padding:9px 10px;background:#fbfcfe;border:1px solid var(--border);border-radius:5px}
#pageContainer .qc-fld-label{font-size:11px;color:#667085}
#pageContainer .qc-fld-value{margin-top:3px;font-size:13px;color:#1e293b;word-break:break-word}
#pageContainer .qc-empty{padding:30px;text-align:center;color:#94a3b8;font-size:13px}
#pageContainer .qc-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px 14px}
#pageContainer .qc-form-item{display:flex;flex-direction:column;gap:5px}
#pageContainer .qc-form-item label{font-size:12px;color:#667085}
#pageContainer .qc-form-item input,#pageContainer .qc-form-item select,#pageContainer .qc-form-item textarea{height:36px;padding:0 10px;border:1px solid var(--border);border-radius:4px;font-size:13px;color:#1e293b;box-sizing:border-box}
#pageContainer .qc-form-item textarea{height:72px;padding:8px 10px;resize:vertical}
#pageContainer .qc-chart{padding:12px 14px;background:#fff;border:1px solid var(--border);border-radius:6px;margin-bottom:12px}
#pageContainer .qc-chart-t{margin:0 0 12px;font-size:13px;font-weight:600;color:#475569}
#pageContainer .qc-hb{display:grid;grid-template-columns:130px 1fr 52px;gap:10px;align-items:center;padding:6px 0}
#pageContainer .qc-hb-l{font-size:12px;color:#475569;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#pageContainer .qc-hb-track{height:10px;border-radius:5px;background:#eef2f7;overflow:hidden}
#pageContainer .qc-hb-track i{display:block;height:100%;background:var(--primary)}
#pageContainer .qc-hb-track i.warn{background:#f59e0b}
#pageContainer .qc-hb-track i.bad{background:#dc2626}
#pageContainer .qc-hb-track i.ok{background:#16a34a}
#pageContainer .qc-hb-v{font-size:12px;font-weight:700;color:#1e293b;text-align:right;font-variant-numeric:tabular-nums}
#pageContainer .qc-gauge-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
#pageContainer .qc-gauge{padding:12px 14px;background:#fff;border:1px solid var(--border);border-radius:6px}
#pageContainer .qc-gauge-label{font-size:12px;color:#667085}
#pageContainer .qc-gauge-val{margin:6px 0 8px;font-size:22px;font-weight:700;font-variant-numeric:tabular-nums}
#pageContainer .qc-gauge-val.good{color:#15803d}
#pageContainer .qc-gauge-val.warn{color:#b54708}
#pageContainer .qc-gauge-val.bad{color:#b42335}
#pageContainer .qc-gauge-track{height:8px;border-radius:4px;background:#eef2f7;overflow:hidden}
#pageContainer .qc-gauge-track i{display:block;height:100%}
#pageContainer .qc-vcols{display:flex;align-items:flex-end;gap:10px;height:120px}
#pageContainer .qc-vc{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px;height:100%}
#pageContainer .qc-vc i{width:70%;max-width:44px;border-radius:3px 3px 0 0;background:var(--primary)}
#pageContainer .qc-vc-v{font-size:11px;color:#1e293b;font-weight:600}
#pageContainer .qc-vc-l{font-size:11px;color:#94a3b8;white-space:nowrap}
`;
  const modalStyle = document.createElement('style');
  modalStyle.textContent = `
.qc-modal-mask{position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;z-index:1200;padding:24px}
.qc-modal-mask .qc-modal{background:#fff;border-radius:8px;width:min(960px,100%);max-height:88vh;display:flex;flex-direction:column;box-shadow:0 20px 45px rgba(15,23,42,.25)}
.qc-modal-mask .qc-modal-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #e2e8f0}
.qc-modal-mask .qc-modal-title{font-size:15px;font-weight:700;color:#1e293b}
.qc-modal-mask .qc-close{background:none;border:0;font-size:22px;line-height:1;color:#94a3b8;cursor:pointer}
.qc-modal-mask .qc-modal-body{padding:15px 16px;overflow:auto}
.qc-modal-mask .qc-modal-foot{display:flex;justify-content:flex-end;gap:8px;padding:12px 16px;border-top:1px solid #e2e8f0;background:#fbfcfe}
.qc-modal-mask .qc-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:9px}
.qc-modal-mask .qc-fld{min-width:0;padding:9px 11px;background:#fbfcfe;border:1px solid #e2e8f0;border-radius:5px}
.qc-modal-mask .qc-fld-label{font-size:11px;color:#667085}
.qc-modal-mask .qc-fld-value{margin-top:3px;font-size:13px;color:#1e293b;word-break:break-word}
.qc-modal-mask .qc-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px 14px}
.qc-modal-mask .qc-form-item{display:flex;flex-direction:column;gap:5px}
.qc-modal-mask .qc-form-item label{font-size:12px;color:#667085}
.qc-modal-mask .qc-form-item input,.qc-modal-mask .qc-form-item select,.qc-modal-mask .qc-form-item textarea{height:36px;padding:0 10px;border:1px solid #e2e8f0;border-radius:4px;font-size:13px;color:#1e293b;box-sizing:border-box;font-family:inherit;background:#fff}
.qc-modal-mask .qc-form-item textarea{height:76px;padding:8px 10px;resize:vertical}
.qc-modal-mask .required{color:#dc2626}
`;
  document.head.appendChild(style);
  document.head.appendChild(modalStyle);

  /* ==================== 通用工具 ==================== */
  function esc(v) { const d = document.createElement('div'); d.textContent = v == null ? '' : String(v); return d.innerHTML; }
  const TONE = {
    '合格': 'success', '正常': 'success', '完成': 'success', '已归档': 'success', '已关联': 'success', '完整': 'success',
    '达标': 'success', 'A': 'success', '已确诊': 'success', '闭环': 'success', '已生成': 'success', '启用': 'success', '已完成': 'success', '已分组': 'success',
    '待复核': 'warning', '待补': 'warning', '待会诊': 'warning', '待接诊': 'warning', '待整理': 'warning', '观察': 'warning',
    '预警': 'warning', '待反馈': 'warning', '待整改': 'warning', '待闭环': 'warning', 'C': 'warning', '黄色预警': 'warning',
    '质控中': 'info', '进行中': 'info', '已排定': 'info', '纳管中': 'info', '正常接入': 'info', 'B': 'info',
    '整改': 'danger', '缺失': 'danger', '退回': 'danger', '超时': 'danger', '不通过': 'danger', '红色预警': 'danger',
    '待处理': 'orange', '待核': 'orange', '整改中': 'orange', '缺病理': 'orange', '缺检验': 'orange', '缺影像': 'orange', '橙色预警': 'orange'
  };
  function sb(status) { return '<span class="badge badge-' + (TONE[status] || 'info') + '">' + esc(status) + '</span>'; }
  function bar(ratio, tone) {
    return '<div class="qc-bar"><i class="' + (tone || '') + '" style="width:' + Math.min(100, Math.max(0, ratio)) + '%"></i></div>';
  }
  function kpis(items) {
    return '<div class="qc-kpis">' + items.map(function (k) {
      return '<div class="qc-kpi"><div class="qc-kpi-label">' + k.label + '</div><div class="qc-kpi-value ' + (k.tone || '') + '">' + k.value + '</div><div class="qc-kpi-meta">' + (k.meta || '') + '</div></div>';
    }).join('') + '</div>';
  }
  function card(title, body, actions) {
    return '<div class="qc-card"><div class="qc-card-head"><div class="qc-card-title">' + title + '</div>' + (actions || '') + '</div><div class="qc-card-body">' + body + '</div></div>';
  }
  function gf(pairs) {
    return '<div class="qc-fields">' + pairs.map(function (p) {
      return '<div class="qc-fld"><div class="qc-fld-label">' + p[0] + '</div><div class="qc-fld-value">' + p[1] + '</div></div>';
    }).join('') + '</div>';
  }
  function foot(total) {
    return '<div class="qc-foot"><span>共 ' + total + ' 条记录，每页 10 条</span><span class="qc-pager"><button class="btn btn-ghost btn-xs" onclick="toast(\'已是第 1 页\')">‹</button><span class="qc-pager-cur">1</span><button class="btn btn-ghost btn-xs" onclick="toast(\'已跳转下一页（演示）\')">›</button></span></div>';
  }
  function switchHtml(id, view, on) {
    return '<label class="qc-switch"><input type="checkbox"' + (on ? ' checked' : '') + ' onchange="qcToggle(\'' + view + '\',\'' + id + '\')"><i></i></label>';
  }
  function chartBlock(title, inner) {
    return '<div class="qc-chart"><h4 class="qc-chart-t">' + title + '</h4>' + inner + '</div>';
  }
  function hbars(items) {
    const max = Math.max.apply(null, [1].concat(items.map(function (x) { return x.value; })));
    return items.map(function (x) {
      const w = Math.round(x.value / max * 100);
      return '<div class="qc-hb"><span class="qc-hb-l">' + esc(x.label) + '</span><span class="qc-hb-track"><i class="' + (x.tone || '') + '" style="width:' + w + '%"></i></span><span class="qc-hb-v">' + x.value + '</span></div>';
    }).join('');
  }
  function gauges(items) {
    return '<div class="qc-gauge-row">' + items.map(function (g) {
      let tone = 'good', color = '#16a34a';
      if (g.value >= (g.bad || 101)) { tone = 'bad'; color = '#dc2626'; }
      else if (g.value >= (g.warn || 101)) { tone = 'warn'; color = '#f59e0b'; }
      const w = Math.max(4, Math.min(100, g.value));
      return '<div class="qc-gauge"><div class="qc-gauge-label">' + g.label + '</div><div class="qc-gauge-val ' + tone + '">' + g.value + (g.unit || '%') + '</div><div class="qc-gauge-track"><i style="width:' + w + '%;background:' + color + '"></i></div></div>';
    }).join('') + '</div>';
  }
  function vcols(vals, labels) {
    const max = Math.max.apply(null, [1].concat(vals));
    return '<div class="qc-vcols">' + vals.map(function (v, i) {
      const h = Math.round(v / max * 90);
      return '<div class="qc-vc"><span class="qc-vc-v">' + v + '</span><i style="height:' + h + 'px"></i><span class="qc-vc-l">' + labels[i] + '</span></div>';
    }).join('') + '</div>';
  }

  function qcModal(title, body, footHtml) {
    const mask = document.createElement('div');
    mask.className = 'qc-modal-mask';
    mask.innerHTML = '<div class="qc-modal"><div class="qc-modal-head"><div class="qc-modal-title">' + esc(title) + '</div><button class="qc-close" aria-label="关闭">×</button></div><div class="qc-modal-body">' + body + '</div>' + (footHtml ? '<div class="qc-modal-foot">' + footHtml + '</div>' : '') + '</div>';
    mask.addEventListener('click', function (e) { if (e.target === mask) mask.remove(); });
    mask.querySelector('.qc-close').addEventListener('click', function () { mask.remove(); });
    document.body.appendChild(mask);
    return mask;
  }
  function closeModals() { document.querySelectorAll('.qc-modal-mask').forEach(function (m) { m.remove(); }); }
  function showDetail(title, pairs, extra) {
    const mask = qcModal(title, gf(pairs) + (extra || ''), '<button class="btn btn-ghost" data-close>关闭</button>');
    mask.querySelector('[data-close]').addEventListener('click', function () { mask.remove(); });
    return mask;
  }
  function openForm(title, fields, onSave) {
    const body = '<div class="qc-form">' + fields.map(function (f) {
      let ctrl;
      if (f.type === 'select') ctrl = '<select id="qf-' + f.k + '">' + (f.options || []).map(function (o) { return '<option' + (o === f.val ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select>';
      else if (f.type === 'textarea') ctrl = '<textarea id="qf-' + f.k + '">' + esc(f.val || '') + '</textarea>';
      else ctrl = '<input id="qf-' + f.k + '" type="' + (f.type || 'text') + '" value="' + esc(f.val || '') + '">';
      return '<div class="qc-form-item"><label>' + f.label + (f.req ? ' <span class="required">*</span>' : '') + '</label>' + ctrl + '</div>';
    }).join('') + '</div>';
    const mask = qcModal(title, body, '<button class="btn btn-ghost" data-close>取消</button><button class="btn btn-primary" data-save>保存</button>');
    mask.querySelector('[data-close]').addEventListener('click', function () { mask.remove(); });
    mask.querySelector('[data-save]').addEventListener('click', function () {
      const values = {};
      let ok = true;
      fields.forEach(function (f) {
        const el = mask.querySelector('#qf-' + f.k);
        const v = el ? String(el.value).trim() : '';
        if (f.req && !v) { ok = false; return; }
        values[f.k] = v;
      });
      if (!ok) { toast('请填写必填项', 'error'); return; }
      onSave(values); mask.remove();
    });
    return mask;
  }

  /* ==================== 筛选控件 ==================== */
  function fv(page, tab) { const p = state.f[page]; return (p && p[tab]) || {}; }
  function sel(page, tab, key, label, opts) {
    const cur = fv(page, tab)[key] || 'ALL';
    const o = [['ALL', '全部']].concat(opts.map(function (x) { return [x, x]; }))
      .map(function (x) { return '<option value="' + esc(x[0]) + '"' + (cur === x[0] ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join('');
    return '<div class="qc-field"><span class="qc-field-label">' + label + '</span><select onchange="qcSet(\'' + page + '\',\'' + tab + '\',\'' + key + '\',this.value)">' + o + '</select></div>';
  }
  function kwf(page, tab, label, ph) {
    const cur = fv(page, tab).kw || '';
    return '<div class="qc-field kw"><span class="qc-field-label">' + label + '</span><input value="' + esc(cur) + '" placeholder="' + ph + '" onchange="qcSet(\'' + page + '\',\'' + tab + '\',\'kw\',this.value)"></div>';
  }
  function filter(page, tab, fieldsHtml) {
    return '<div class="qc-toolbar">' + fieldsHtml + '<div class="qc-field qc-field-actions"><button class="btn btn-primary btn-sm" onclick="qcQuery(\'' + page + '\',\'' + tab + '\')">查询</button><button class="btn btn-ghost btn-sm" onclick="qcReset(\'' + page + '\',\'' + tab + '\')">重置</button></div></div>';
  }

  /* ==================== 状态与数据集 ==================== */
  const state = { page: 'qc-homepage', tab: {}, f: {} };
  function pageOf(view) { return String(view).split('.')[0]; }

  const CONFIGS = {
    'qc-homepage.storage': [
      { id: 's1', name: '病案首页主数据集', loc: '省中心加密存储', desen: '姓名 / 身份证 / 电话 脱敏', keep: '永久', on: true },
      { id: 's2', name: '病理结构化数据', loc: '机构端专区', desen: '姓名 / 病案号 哈希', keep: '10 年', on: true },
      { id: 's3', name: '影像关联索引', loc: 'PACS 镜像', desen: '仅保留编号索引', keep: '5 年', on: true },
      { id: 's4', name: '患者联系方式', loc: '随访专区', desen: '字段级权限控制', keep: '3 年', on: false },
      { id: 's5', name: '质控过程留痕', loc: '审计日志库', desen: '操作者实名留痕', keep: '2 年', on: true }
    ],
    'qc-tnm.tpl': [
      { id: 't1', name: '肺癌（第 9 版 AJCC）', scope: '肺恶性肿瘤', year: '2024', on: true, count: 412 },
      { id: 't2', name: '胃癌 TNM 分期模板', scope: '胃恶性肿瘤', year: '2024', on: true, count: 198 },
      { id: 't3', name: '乳腺癌 TNM 分期模板', scope: '乳腺恶性肿瘤', year: '2024', on: true, count: 176 },
      { id: 't4', name: '肝癌（巴塞罗那 + TNM）', scope: '肝恶性肿瘤', year: '2023', on: false, count: 121 },
      { id: 't5', name: '宫颈癌 FIGO-TNM 对照', scope: '宫颈恶性肿瘤', year: '2024', on: true, count: 87 }
    ],
    'qc-course.tpl': [
      { id: 'c1', name: '首次病程记录模板', scope: '全部专病', fields: '12 字段', on: true, use: '1,240 次' },
      { id: 'c2', name: '肺癌诊疗病程模板', scope: '肺癌', fields: '18 字段', on: true, use: '586 次' },
      { id: 'c3', name: '乳腺癌围手术期模板', scope: '乳腺癌', fields: '15 字段', on: true, use: '412 次' },
      { id: 'c4', name: '胃癌新辅助治疗模板', scope: '胃癌', fields: '14 字段', on: false, use: '187 次' },
      { id: 'c5', name: '肝癌介入治疗模板', scope: '肝癌', fields: '13 字段', on: true, use: '202 次' }
    ],
    'qc-cohort.group': [
      { id: 'g1', name: '肺癌高危人群', count: 3125, strategy: '低剂量 CT 年度筛查', on: true, tone: 'info' },
      { id: 'g2', name: '乳腺癌确诊人群', count: 2078, strategy: '术后随访 + 定期复查', on: true, tone: 'success' },
      { id: 'g3', name: '肝癌高危人群（乙肝）', count: 1864, strategy: 'AFP + 超声半年度随访', on: true, tone: 'warning' },
      { id: 'g4', name: '待干预人群', count: 64, strategy: '分配干预策略', on: false, tone: 'danger' }
    ]
  };

  const LISTS = {
    'qc-homepage.base': [
      { id: 'ZY20260801001', name: '张桂芳', idNo: '360102********0623', diag: 'C34.9 肺恶性肿瘤', dept: '胸外科', date: '2026-07-28', state: '已归档', result: '合格', source: 'HIS', dr: '王医生' },
      { id: 'ZY20260801002', name: '李水根', idNo: '360702********1134', diag: 'C16.9 胃恶性肿瘤', dept: '普外科', date: '2026-07-29', state: '待复核', result: '待复核', source: 'HIS', dr: '李医生' },
      { id: 'ZY20260801003', name: '王秋香', idNo: '360402********2287', diag: 'C50.9 乳腺恶性肿瘤', dept: '乳腺外科', date: '2026-07-30', state: '质控中', result: '质控中', source: 'HIS', dr: '赵医生' },
      { id: 'ZY20260801004', name: '刘金生', idNo: '360102********3350', diag: 'C22.9 肝恶性肿瘤', dept: '肝胆外科', date: '2026-07-31', state: '已归档', result: '整改', source: '手工补录', dr: '孙医生' },
      { id: 'ZY20260801005', name: '陈晓红', idNo: '360902********1549', diag: 'C53.9 宫颈恶性肿瘤', dept: '妇瘤科', date: '2026-08-01', state: '待复核', result: '待复核', source: 'HIS', dr: '周医生' },
      { id: 'ZY20260801006', name: '徐桂英', idNo: '360702********2811', diag: 'C16.0 贲门恶性肿瘤', dept: '消化内科', date: '2026-08-01', state: '已归档', result: '合格', source: 'HIS', dr: '吴医生' },
      { id: 'ZY20260801007', name: '周艳', idNo: '361102********0418', diag: 'C50.0 乳腺导管原位癌', dept: '乳腺外科', date: '2026-08-02', state: '质控中', result: '质控中', source: 'HIS', dr: '赵医生' },
      { id: 'ZY20260801008', name: '熊小华', idNo: '360102********1152', diag: 'C34.1 肺恶性肿瘤', dept: '胸外科', date: '2026-08-02', state: '已归档', result: '合格', source: 'HIS', dr: '王医生' }
    ],
    'qc-homepage.source': [
      { id: 'src1', name: 'HIS 住院病案首页', type: '病案首页接口', sync: '2026-08-02 06:00', count: 3214, rate: 98.7, status: '正常', tone: 'ok' },
      { id: 'src2', name: '病理信息系统', type: '病理报告接口', sync: '2026-08-02 05:45', count: 1862, rate: 97.2, status: '正常', tone: 'ok' },
      { id: 'src3', name: '影像 PACS', type: '影像报告接口', sync: '2026-08-02 06:10', count: 2401, rate: 96.8, status: '正常接入', tone: 'warn' },
      { id: 'src4', name: '检验 LIS', type: '检验报告接口', sync: '2026-08-02 05:50', count: 4133, rate: 99.1, status: '正常', tone: 'ok' },
      { id: 'src5', name: '手工补录', type: '离线录入', sync: '2026-08-01 18:00', count: 212, rate: 92.4, status: '待核', tone: 'warn' }
    ],
    'qc-homepage.link': [
      { id: 'ZY20260801001', path: 'BL202607290012', img: 'YX202607280088', lab: 'JY202607280152', full: '3 / 3', status: '完整' },
      { id: 'ZY20260801002', path: 'BL202607290021', img: 'YX202607290033', lab: 'JY202607290064', full: '2 / 3', status: '缺影像' },
      { id: 'ZY20260801003', path: 'BL202607300007', img: 'YX202607300019', lab: 'JY202607300071', full: '3 / 3', status: '完整' },
      { id: 'ZY20260801004', path: '-', img: 'YX202607310026', lab: 'JY202607310091', full: '2 / 3', status: '缺病理' },
      { id: 'ZY20260801005', path: 'BL202608010003', img: 'YX202608010010', lab: '-', full: '2 / 3', status: '缺检验' },
      { id: 'ZY20260801006', path: 'BL202608010009', img: 'YX202608010022', lab: 'JY202608010045', full: '3 / 3', status: '完整' }
    ],
    'qc-homepage.result': [
      { id: 'ZY20260801001', rule: '主要诊断与病理一致', verdict: '通过', field: '-', time: '2026-08-02 08:12', who: '陈敏', status: '已处理' },
      { id: 'ZY20260801002', rule: '首页缺手术操作编码', verdict: '不通过', field: '手术操作编码', time: '2026-08-02 08:31', who: '系统自动', status: '待整改' },
      { id: 'ZY20260801004', rule: '出院诊断与首页诊断不一致', verdict: '不通过', field: '出院诊断', time: '2026-08-02 09:02', who: '系统自动', status: '整改中' },
      { id: 'ZY20260801003', rule: '身份证号校验', verdict: '通过', field: '-', time: '2026-08-02 09:15', who: '陈敏', status: '已处理' },
      { id: 'ZY20260801005', rule: '入院病情与诊断依据佐证', verdict: '待复核', field: '诊断依据', time: '2026-08-02 09:40', who: '周敏', status: '待处理' },
      { id: 'ZY20260801007', rule: '手术与首页手术编码比对', verdict: '不通过', field: '手术编码', time: '2026-08-02 10:05', who: '系统自动', status: '待整改' }
    ],
    'qc-confirmed.base': [
      { id: 'QZ2026080001', name: '张桂芳', idNo: '360102********0623', basis: '病理诊断', date: '2026-07-29', diag: 'C34.9 肺恶性肿瘤', org: '江西省肿瘤医院', status: '已确诊', reviewer: '李主任' },
      { id: 'QZ2026080002', name: '李水根', idNo: '360702********1134', basis: '病理诊断', date: '2026-07-30', diag: 'C16.9 胃恶性肿瘤', org: '赣州市人民医院', status: '已确诊', reviewer: '赵专员' },
      { id: 'QZ2026080003', name: '王秋香', idNo: '360402********2287', basis: '临床 + 影像', date: '2026-07-31', diag: 'C50.9 乳腺恶性肿瘤', org: '九江市第一人民医院', status: '质控中', reviewer: '李主任' },
      { id: 'QZ2026080004', name: '刘金生', idNo: '360102********3350', basis: '手术 + 病理', date: '2026-07-31', diag: 'C22.9 肝恶性肿瘤', org: '南昌大学第一附属医院', status: '退回', reviewer: '王医生' },
      { id: 'QZ2026080005', name: '陈晓红', idNo: '360902********1549', basis: '病理诊断', date: '2026-08-01', diag: 'C53.9 宫颈恶性肿瘤', org: '上饶市人民医院', status: '已确诊', reviewer: '赵专员' },
      { id: 'QZ2026080006', name: '徐桂英', idNo: '360702********2811', basis: '病理诊断', date: '2026-08-01', diag: 'C16.0 贲门恶性肿瘤', org: '赣州市人民医院', status: '质控中', reviewer: '赵专员' }
    ],
    'qc-confirmed.flow': [
      { id: 'LC2026080201', zid: 'QZ2026080003', step: '省级终审', who: '李主任', prog: '88%', status: '进行中', note: '还剩 1 个环节' },
      { id: 'LC2026080202', zid: 'QZ2026080004', step: '机构退回整改', who: '王医生', prog: '45%', status: '退回', note: '诊断依据上传缺失' },
      { id: 'LC2026080203', zid: 'QZ2026080005', step: '市级复核', who: '赵专员', prog: '66%', status: '进行中', note: '预计 8-03 完成' },
      { id: 'LC2026080204', zid: 'QZ2026080006', step: '已完成', who: '系统', prog: '100%', status: '完成', note: '3 环节 0 驳回' },
      { id: 'LC2026080205', zid: 'QZ2026080007', step: '机构提交', who: '系统', prog: '22%', status: '进行中', note: '待市级复核' }
    ],
    'qc-confirmed.rule': [
      { id: 'R-101', name: '确诊依据必须包含病理或影像佐证', exec: '系统自动', strong: '强', when: '确诊提交时', hit: 42, fix: 39, rate: 92.9, status: '启用' },
      { id: 'R-102', name: '确诊日期不得晚于报卡日期', exec: '系统自动', strong: '强', when: '确诊提交时', hit: 18, fix: 17, rate: 94.4, status: '启用' },
      { id: 'R-103', name: 'ICD 编码与诊断名称一致性', exec: '系统自动', strong: '强', when: '数据入库时', hit: 28, fix: 20, rate: 71.4, status: '启用' },
      { id: 'R-104', name: '多原发癌双重核算规则', exec: '人工复核', strong: '中', when: '审核环节', hit: 9, fix: 6, rate: 66.7, status: '观察' }
    ],
    'qc-pathology.base': [
      { id: 'BL202607290012', name: '张桂芳', site: 'C34.9', dx: '肺腺癌', item: '免疫组化 + 分子检测', state: '报告完成', result: '合格', org: '江西省肿瘤医院' },
      { id: 'BL202607290021', name: '李水根', site: 'C16.9', dx: '胃腺癌', item: '免疫组化', state: '待补充分子检测', result: '待补', org: '赣州市人民医院' },
      { id: 'BL202607300007', name: '王秋香', site: 'C50.9', dx: '乳腺浸润性导管癌', item: '免疫组化 + HER2', state: '报告完成', result: '合格', org: '九江市第一人民医院' },
      { id: 'BL202607310026', name: '刘金生', site: 'C22.9', dx: '肝细胞癌', item: '免疫组化', state: '缺分化程度', result: '整改', org: '南昌大学第一附属医院' },
      { id: 'BL202608010003', name: '陈晓红', site: 'C53.9', dx: '宫颈鳞状细胞癌', item: '免疫组化', state: '报告完成', result: '合格', org: '上饶市人民医院' },
      { id: 'BL202608010009', name: '徐桂英', site: 'C16.0', dx: '贲门腺癌', item: '免疫组化', state: '报告完成', result: '合格', org: '赣州市人民医院' }
    ],
    'qc-pathology.attach': [
      { id: 'BL202607290012', name: 'HE 切片图像', type: '病理影像', num: '3 张', loc: '省中心存管', status: '已归档' },
      { id: 'BL202607290021', name: '免疫组化报告', type: '扫描件', num: '1 份', loc: '机构端', status: '已归档' },
      { id: 'BL202607300007', name: '分子检测报告（HER2）', type: '扫描件', num: '1 份', loc: '机构端', status: '待补' },
      { id: 'BL202607310026', name: '术中冰冻报告', type: '扫描件', num: '1 份', loc: '机构端', status: '缺失' },
      { id: 'BL202608010003', name: 'HE 切片图像', type: '病理影像', num: '4 张', loc: '省中心存管', status: '已归档' },
      { id: 'BL202608010009', name: '免疫组化报告', type: '扫描件', num: '1 份', loc: '机构端', status: '待补' }
    ],
    'qc-pathology.rule': [
      { id: 'P-01', name: '病理诊断术语规范（ICD-O 形态学）', exec: '系统自动', strong: '强', when: '报告生成时', hit: 258, rate: 96.5, status: '启用' },
      { id: 'P-02', name: '部位编码与形态学编码一致性', exec: '系统自动', strong: '强', when: '报告生成时', hit: 34, rate: 88.2, status: '启用' },
      { id: 'P-03', name: '免疫组化结果完整性', exec: '人工复核', strong: '中', when: '审核环节', hit: 61, rate: 79.4, status: '启用' },
      { id: 'P-04', name: '分子检测（驱动基因）完整性', exec: '人工复核', strong: '中', when: '审核环节', hit: 47, rate: 71.8, status: '观察' }
    ],
    'qc-tnm.base': [
      { id: 'FN2026080001', name: '张桂芳', dx: '肺', tnm: 'T2N1M0', stage: 'ⅡB 期', type: '临床分期', result: '合格', date: '2026-07-29' },
      { id: 'FN2026080002', name: '李水根', dx: '胃', tnm: 'T3N2M0', stage: 'ⅢA 期', type: '病理分期', result: '合格', date: '2026-07-30' },
      { id: 'FN2026080003', name: '王秋香', dx: '乳腺', tnm: 'T2N0M0', stage: 'ⅡA 期', type: '病理分期', result: '待复核', date: '2026-07-31' },
      { id: 'FN2026080004', name: '刘金生', dx: '肝', tnm: 'T3N0M1', stage: 'ⅣB 期', type: '临床分期', result: '整改', date: '2026-07-31' },
      { id: 'FN2026080005', name: '陈晓红', dx: '宫颈', tnm: 'T1B1N0M0', stage: 'ⅠB1 期', type: '病理分期', result: '合格', date: '2026-08-01' },
      { id: 'FN2026080006', name: '徐桂英', dx: '胃', tnm: 'T3N1M0', stage: 'ⅢB 期', type: '病理分期', result: '合格', date: '2026-08-01' }
    ],
    'qc-tnm.attach': [
      { id: 'FN2026080001', name: 'CT 影像报告', type: '影像', link: '已关联', status: '完整' },
      { id: 'FN2026080001', name: '病理报告（淋巴结）', type: '病理', link: '已关联', status: '完整' },
      { id: 'FN2026080002', name: '术后病理报告', type: '病理', link: '已关联', status: '完整' },
      { id: 'FN2026080003', name: '超声 + 影像', type: '影像', link: '部分关联', status: '待补' },
      { id: 'FN2026080004', name: 'CT 影像报告', type: '影像', link: '缺失', status: '缺失' }
    ],
    'qc-course.base': [
      { id: 'BC2026080001', name: '张桂芳', dz: '肺癌', type: '首次病程记录', limit: '入院 8 小时内完成', time: '2026-07-28', result: '合格', org: '江西省肿瘤医院' },
      { id: 'BC2026080002', name: '李水根', dz: '胃癌', type: '术前小结', limit: '术前 24h 内', time: '2026-07-30', result: '合格', org: '赣州市人民医院' },
      { id: 'BC2026080003', name: '王秋香', dz: '乳腺癌', type: '术后首次病程', limit: '术后 8 小时内', time: '2026-08-01', result: '超时', org: '九江市第一人民医院' },
      { id: 'BC2026080004', name: '刘金生', dz: '肝癌', type: '疑难病例讨论记录', limit: '72 小时内', time: '2026-07-31', result: '待补', org: '南昌大学第一附属医院' },
      { id: 'BC2026080005', name: '陈晓红', dz: '宫颈癌', type: '出院记录（含随访）', limit: '24 小时内', time: '2026-08-02', result: '合格', org: '上饶市人民医院' },
      { id: 'BC2026080006', name: '徐桂英', dz: '胃癌', type: '首次病程记录', limit: '入院 8 小时内完成', time: '2026-08-02', result: '合格', org: '赣州市人民医院' }
    ],
    'qc-course.link': [
      { id: 'BC2026080001', src: '病案首页 + 病理报告 + 影像', n: '3 项', time: '2026-08-01 09:20', status: '已关联' },
      { id: 'BC2026080002', src: '病案首页 + 病理报告', n: '2 项', time: '2026-08-01 10:05', status: '已关联' },
      { id: 'BC2026080003', src: '病案首页 + 手术记录', n: '1 项缺影像', time: '2026-08-01 10:30', status: '缺影像' },
      { id: 'BC2026080004', src: '病案首页 + 影像 + 检验', n: '3 项', time: '2026-08-02 09:12', status: '已关联' },
      { id: 'BC2026080005', src: '病案首页 + 病理报告', n: '2 项', time: '2026-08-02 09:55', status: '已关联' }
    ],
    'qc-mdt.apply': [
      { id: 'MDT202608001', name: '张桂芳', dx: 'C34.9 肺', teams: '胸外科 / 肿瘤内科 / 影像 / 病理', dept: '外科', date: '2026-08-01', status: '待会诊', host: '刘教授' },
      { id: 'MDT202608002', name: '李水根', dx: 'C16.9 胃', teams: '普外科 / 消化内科 / 病理', dept: '内科', date: '2026-08-01', status: '已排定', host: '赵主任' },
      { id: 'MDT202608003', name: '王秋香', dx: 'C50.9 乳腺', teams: '乳腺外科 / 放疗 / 病理', dept: '放疗', date: '2026-08-02', status: '待会诊', host: '孙主任' },
      { id: 'MDT202608004', name: '刘金生', dx: 'C22.9 肝', teams: '肝胆外科 / 介入 / 影像', dept: '介入', date: '2026-08-02', status: '已完成', host: '刘教授' },
      { id: 'MDT202608005', name: '陈晓红', dx: 'C53.9 宫颈', teams: '妇瘤 / 放疗 / 影像', dept: '放疗', date: '2026-08-03', status: '已排定', host: '孙主任' },
      { id: 'MDT202608006', name: '徐桂英', dx: 'C16.0 贲门', teams: '普外科 / 消化 / 影像', dept: '外科', date: '2026-08-03', status: '待会诊', host: '赵主任' }
    ],
    'qc-mdt.record': [
      { id: 'MDT202608004', name: '刘金生', date: '2026-08-02', topic: '肝占位性病变综合评估', scale: '6 学科 8 人', conclu: '手术 + 介入综合方案', status: '已归档' },
      { id: 'MDT202608006', name: '张桂芳', date: '2026-07-27', topic: '肺癌围手术期方案制定', scale: '5 学科 6 人', conclu: '新辅助 + 手术', status: '已归档' },
      { id: 'MDT202608007', name: '王秋香', date: '2026-07-26', topic: '乳腺癌保乳 vs 全切', scale: '4 学科 5 人', conclu: '保乳 + 放疗', status: '待整理' },
      { id: 'MDT202608008', name: '徐桂英', date: '2026-07-25', topic: '胃癌新辅助疗效评估', scale: '5 学科 7 人', conclu: '继续新辅助 2 周期', status: '已归档' }
    ],
    'qc-remote.req': [
      { id: 'YC202608001', name: '王秋香', from: '九江市第一人民医院', to: '江西省肿瘤医院', dept: '乳腺肿瘤科', date: '2026-08-01', status: '待接诊' },
      { id: 'YC202608002', name: '刘金生', from: '南昌县人民医院', to: '南昌大学第一附属医院', dept: '肝胆外科', date: '2026-08-01', status: '进行中' },
      { id: 'YC202608003', name: '陈晓红', from: '上饶市人民医院', to: '江西省肿瘤医院', dept: '妇科肿瘤', date: '2026-08-02', status: '已完成' },
      { id: 'YC202608004', name: '徐桂英', from: '南康区人民医院', to: '赣州市人民医院', dept: '消化肿瘤', date: '2026-08-02', status: '待接诊' },
      { id: 'YC202608005', name: '周艳', from: '浮梁县人民医院', to: '九江市第一人民医院', dept: '肿瘤内科', date: '2026-08-03', status: '已排定' }
    ],
    'qc-remote.feedback': [
      { id: 'YC202608003', name: '陈晓红', expert: '刘教授', org: '江西省肿瘤医院', opinion: '建议行根治性手术 + 盆腔放疗', date: '2026-08-02', status: '已反馈' },
      { id: 'YC202608002', name: '刘金生', expert: '赵主任', org: '南昌大学第一附属医院', opinion: '建议行肝段切除，评估肝功能后实施', date: '2026-08-02', status: '已反馈' },
      { id: 'YC202608006', name: '徐桂英', expert: '孙主任', org: '赣州市人民医院', opinion: '完善胃镜 + 超声内镜后决定方案', date: '2026-08-03', status: '待反馈' }
    ],
    'qc-remote.archive': [
      { id: 'YC202608003', name: '陈晓红', date: '2026-08-02', platform: '卫健委远程会诊平台', arc: '已归档', close: '闭环', note: '会诊-执行-随访 全链路完成' },
      { id: 'YC202608001', name: '王秋香', date: '2026-08-01', platform: '院内远程中心', arc: '回执待确认', close: '待闭环', note: '缺执行回执' },
      { id: 'YC202608002', name: '刘金生', date: '2026-08-01', platform: '联盟远程平台', arc: '已归档', close: '闭环', note: '会诊-执行-随访 全链路完成' },
      { id: 'YC202608004', name: '徐桂英', date: '2026-08-02', platform: '卫健委远程会诊平台', arc: '执行待回传', close: '待闭环', note: '缺随访记录' }
    ],
    'qc-cohort.list': [
      { id: 'NG202608001', name: '张桂芳', idNo: '360102********0623', site: '肺', type: '高危', src: '高危人群建档筛查', date: '2026-07-20', status: '纳管中' },
      { id: 'NG202608002', name: '李水根', idNo: '360702********1134', site: '胃', type: '确诊', src: '上消化道癌早筛', date: '2026-07-25', status: '纳管中' },
      { id: 'NG202608003', name: '王秋香', idNo: '360402********2287', site: '乳腺', type: '确诊', src: '两癌筛查', date: '2026-07-28', status: '已分组' },
      { id: 'NG202608004', name: '刘金生', idNo: '360102********3350', site: '肝', type: '高危', src: '乙肝人群肝癌筛查', date: '2026-07-30', status: '待干预' },
      { id: 'NG202608005', name: '陈晓红', idNo: '360902********1549', site: '宫颈', type: '确诊', src: '两癌筛查', date: '2026-08-01', status: '已分组' },
      { id: 'NG202608006', name: '徐桂英', idNo: '360702********2811', site: '胃', type: '高危', src: '上消化道癌早筛', date: '2026-08-01', status: '已分组' },
      { id: 'NG202608007', name: '周艳', idNo: '361102********0418', site: '乳腺', type: '高危', src: '两癌筛查', date: '2026-08-02', status: '纳管中' }
    ],
    'qc-global.indicator': [
      { id: 'KPI-01', name: '病理诊断占比（MV%）', target: '≥ 70%', type: '聚合指标', cycle: '月度', year: '2025', status: '达标', val: 78.6 },
      { id: 'KPI-02', name: '仅死亡证明病例占比（DCO%）', target: '≤ 5%', type: '聚合指标', cycle: '月度', year: '2025', status: '达标', val: 3.2 },
      { id: 'KPI-03', name: '病案首页质控合格率', target: '≥ 90%', type: '过程指标', cycle: '月度', year: '2026', status: '预警', val: 88.9 },
      { id: 'KPI-04', name: 'TNM 分期完备率', target: '≥ 85%', type: '过程指标', cycle: '月度', year: '2026', status: '达标', val: 91.3 },
      { id: 'KPI-05', name: 'MDT 覆盖率（Ⅲ/Ⅳ 期）', target: '≥ 70%', type: '结构指标', cycle: '季度', year: '2026', status: '预警', val: 66.2 }
    ],
    'qc-global.score': [
      { id: 'org1', org: '江西省肿瘤医院', score: 96, warn: 4, grade: 'A' },
      { id: 'org2', org: '南昌大学第一附属医院', score: 92, warn: 4, grade: 'A' },
      { id: 'org3', org: '赣州市人民医院', score: 87, warn: 3, grade: 'B' },
      { id: 'org4', org: '九江市第一人民医院', score: 83, warn: 2, grade: 'B' },
      { id: 'org5', org: '上饶市人民医院', score: 79, warn: 1, grade: 'C' }
    ],
    'qc-global.report': [
      { id: 'REPORT-2026-Q3', name: '2026 年第三季度全域质控报告', unit: '河南省肿瘤防办', time: '2026-08-02', fmt: 'PDF', status: '已生成' },
      { id: 'REPORT-2026-08', name: '2026 年 8 月机构质控绩效月报', unit: '省级质控中心', time: '2026-08-01', fmt: 'PDF', status: '已生成' },
      { id: 'REPORT-2026-07', name: '2026 年 7 月机构质控绩效月报', unit: '省级质控中心', time: '2026-07-31', fmt: 'PDF', status: '已归档' }
    ],
    'qc-global.alert': [
      { id: 'AL1', org: '上饶市人民医院', msg: 'TNM 分期完备率连续 2 个月低于阈值', tone: '红色预警', time: '2026-08-02 08:00' },
      { id: 'AL2', org: '九江市第一人民医院', msg: '病案首页质控合格率跌破 90%', tone: '黄色预警', time: '2026-08-01 18:30' },
      { id: 'AL3', org: '赣州市人民医院', msg: 'MDT 覆盖率未达季度目标', tone: '橙色预警', time: '2026-08-01 10:00' }
    ]
  };

  const PAGES = {
    'qc-homepage': {
      title: '肿瘤病案首页质控',
      tabs: [
        { key: 'base', label: '病案首页基础信息' },
        { key: 'source', label: '数据来源元信息' },
        { key: 'link', label: '报告关联信息' },
        { key: 'result', label: '质控执行结果' },
        { key: 'storage', label: '数据存储与脱敏配置' }
      ],
      actions: ['<button class="btn btn-outline btn-sm" onclick="toast(\'已导出病案首页质控清单\')">导出清单</button>', '<button class="btn btn-primary btn-sm" onclick="toast(\'已触发全量重新质控（演示）\')">重新质控</button>']
    },
    'qc-confirmed': {
      title: '确诊病例质控',
      tabs: [
        { key: 'base', label: '确诊病例主数据' },
        { key: 'flow', label: '确诊审核流程' },
        { key: 'rule', label: '质控规则与修复记录' },
        { key: 'lifecycle', label: '病例生命周期管理' }
      ],
      actions: ['<button class="btn btn-outline btn-sm" onclick="toast(\'已导出确诊病例清单\')">导出清单</button>', '<button class="btn btn-primary btn-sm" onclick="toast(\'已打开新增病例（演示）\')">新增病例</button>']
    },
    'qc-pathology': {
      title: '病理信息质控',
      tabs: [
        { key: 'base', label: '病理核心信息' },
        { key: 'attach', label: '病理附件与佐证' },
        { key: 'rule', label: '病理质控规则' }
      ],
      actions: ['<button class="btn btn-outline btn-sm" onclick="toast(\'已导出病理质控清单\')">导出清单</button>', '<button class="btn btn-primary btn-sm" onclick="toast(\'已批量复核（演示）\')">批量复核</button>']
    },
    'qc-tnm': {
      title: 'TNM 分期质控',
      tabs: [
        { key: 'base', label: 'TNM 分期主记录' },
        { key: 'attach', label: '分期佐证材料' },
        { key: 'tpl', label: 'TNM 模板配置' }
      ],
      actions: ['<button class="btn btn-outline btn-sm" onclick="toast(\'已导出分期质控清单\')">导出清单</button>', '<button class="btn btn-primary btn-sm" onclick="qcOpenTnmTplForm()">新增模板</button>']
    },
    'qc-course': {
      title: '专病病程质控',
      tabs: [
        { key: 'base', label: '专病病程记录' },
        { key: 'tpl', label: '病程模板配置' },
        { key: 'link', label: '病程关联数据' }
      ],
      actions: ['<button class="btn btn-outline btn-sm" onclick="toast(\'已导出病程质控清单\')">导出清单</button>', '<button class="btn btn-primary btn-sm" onclick="qcOpenCourseTplForm()">新增模板</button>']
    },
    'qc-mdt': {
      title: 'MDT 多学科诊疗质控',
      tabs: [
        { key: 'apply', label: 'MDT 会诊申请' },
        { key: 'record', label: 'MDT 会诊记录' },
        { key: 'snapshot', label: 'MDT 全景数据快照' }
      ],
      actions: ['<button class="btn btn-outline btn-sm" onclick="toast(\'已导出 MDT 质控清单\')">导出清单</button>', '<button class="btn btn-primary btn-sm" onclick="qcOpenMdtApplyForm()">发起会诊</button>']
    },
    'qc-remote': {
      title: '远程会诊质控',
      tabs: [
        { key: 'req', label: '远程会诊请求' },
        { key: 'feedback', label: '远程会诊反馈' },
        { key: 'archive', label: '会诊归档记录' }
      ],
      actions: ['<button class="btn btn-outline btn-sm" onclick="toast(\'已导出远程会诊清单\')">导出清单</button>', '<button class="btn btn-primary btn-sm" onclick="qcOpenRemoteReqForm()">发起申请</button>']
    },
    'qc-cohort': {
      title: '人群纳管与分组质控',
      tabs: [
        { key: 'list', label: '高危人群纳管名单' },
        { key: 'profile', label: '患者健康档案' },
        { key: 'group', label: '患者分组与干预' }
      ],
      actions: ['<button class="btn btn-outline btn-sm" onclick="toast(\'已导出人群纳管清单\')">导出清单</button>', '<button class="btn btn-primary btn-sm" onclick="qcOpenGroupForm()">新建分组</button>']
    },
    'qc-global': {
      title: '全域数据质控与绩效监测',
      tabs: [
        { key: 'indicator', label: '质控指标定义' },
        { key: 'score', label: '机构质控绩效快照' },
        { key: 'alert', label: '质控预警与报告' }
      ],
      actions: ['<button class="btn btn-outline btn-sm" onclick="toast(\'已导出绩效监测报告\')">导出报告</button>', '<button class="btn btn-primary btn-sm" onclick="qcOpenIndicatorForm()">新增指标</button>']
    }
  };

  /* ==================== 详情弹窗注册 ==================== */
  function find(view, id) { const a = LISTS[view]; return a ? a.find(function (x) { return x.id === id; }) : null; }
  function detailActions(html) { return '<div class="qc-modal-foot" style="border:0;padding:0;margin-top:14px;background:transparent">' + html + '</div>'; }

  const DETAILS = {};
  DETAILS['qc-homepage.base'] = function (id) {
    const r = find('qc-homepage.base', id); if (!r) return;
    showDetail('病案首页详情 · ' + r.id, [
      ['病案号', r.id], ['患者', r.name], ['身份证号', r.idNo],
      ['主要诊断', r.diag], ['出院科室', r.dept], ['出院日期', r.date],
      ['数据来源', r.source], ['责任医生', r.dr], ['首页状态', r.state], ['质控结论', r.result]
    ]);
  };
  DETAILS['qc-homepage.source'] = function (id) {
    const r = find('qc-homepage.source', id); if (!r) return;
    showDetail('数据来源详情 · ' + r.name, [
      ['来源系统', r.name], ['接口类型', r.type], ['最近同步', r.sync],
      ['本周期记录数', r.count.toLocaleString('zh-CN') + ' 条'], ['字段一致率', r.rate + '%'], ['校验状态', r.status]
    ]);
  };
  DETAILS['qc-homepage.result'] = function (id) {
    const r = find('qc-homepage.result', id); if (!r) return;
    showDetail('质控执行结果 · ' + r.id, [
      ['病案号', r.id], ['质控规则', r.rule], ['判定', r.verdict],
      ['问题字段', r.field === '-' ? '无' : r.field], ['执行时间', r.time], ['处理人', r.who], ['处理状态', r.status]
    ], detailActions('<button class="btn btn-outline btn-sm" onclick="qcStatus(\'qc-homepage.result\',\'' + r.id + '\',\'待整改\')">标记待整改</button><button class="btn btn-primary btn-sm" onclick="qcStatus(\'qc-homepage.result\',\'' + r.id + '\',\'已处理\')">通过并处理</button>'));
  };
  DETAILS['qc-confirmed.base'] = function (id) {
    const r = find('qc-confirmed.base', id); if (!r) return;
    showDetail('确诊病例详情 · ' + r.id, [
      ['确诊编号', r.id], ['患者', r.name], ['身份证号', r.idNo],
      ['确诊依据', r.basis], ['确诊日期', r.date], ['诊断', r.diag],
      ['确诊机构', r.org], ['审核人', r.reviewer], ['状态', r.status]
    ]);
  };
  DETAILS['qc-confirmed.flow'] = function (id) {
    const r = find('qc-confirmed.flow', id); if (!r) return;
    showDetail('审核流程实例 · ' + r.id, [
      ['流程实例', r.id], ['关联确诊', r.zid], ['当前环节', r.step],
      ['待办人', r.who], ['进度', r.prog], ['状态', r.status], ['环节说明', r.note]
    ], detailActions('<button class="btn btn-outline btn-sm" onclick="qcStatus(\'qc-confirmed.flow\',\'' + r.id + '\',\'退回\')">退回</button><button class="btn btn-primary btn-sm" onclick="qcStatus(\'qc-confirmed.flow\',\'' + r.id + '\',\'完成\')">通过进入下一环节</button>'));
  };
  DETAILS['qc-confirmed.rule'] = function (id) {
    const r = find('qc-confirmed.rule', id); if (!r) return;
    showDetail('质控规则详情 · ' + r.id, [
      ['规则编号', r.id], ['规则名称', r.name], ['执行方式', r.exec],
      ['规则强度', r.strong], ['触发时机', r.when], ['触发次数', r.hit + ' 次'],
      ['已修复', r.fix + ' 次'], ['修复率', r.rate + '%'], ['状态', r.status]
    ]);
  };
  DETAILS['qc-pathology.base'] = function (id) {
    const r = find('qc-pathology.base', id); if (!r) return;
    showDetail('病理核心信息 · ' + r.id, [
      ['病理编号', r.id], ['患者', r.name], ['部位编码', r.site],
      ['病理诊断', r.dx], ['检验项目', r.item], ['报告状态', r.state],
      ['质控结论', r.result], ['报告机构', r.org]
    ], detailActions('<button class="btn btn-outline btn-sm" onclick="qcStatus(\'qc-pathology.base\',\'' + r.id + '\',\'整改\')">退回整改</button><button class="btn btn-primary btn-sm" onclick="qcStatus(\'qc-pathology.base\',\'' + r.id + '\',\'合格\')">复核合格</button>'));
  };
  DETAILS['qc-pathology.rule'] = function (id) {
    const r = find('qc-pathology.rule', id); if (!r) return;
    showDetail('病理质控规则 · ' + r.id, [
      ['规则编号', r.id], ['规则名称', r.name], ['执行方式', r.exec],
      ['规则强度', r.strong], ['触发时机', r.when], ['触发次数', r.hit + ' 次'],
      ['通过率', r.rate + '%'], ['状态', r.status]
    ]);
  };
  DETAILS['qc-tnm.base'] = function (id) {
    const r = find('qc-tnm.base', id); if (!r) return;
    showDetail('TNM 分期详情 · ' + r.id, [
      ['分期编号', r.id], ['患者', r.name], ['诊断', r.dx],
      ['TNM', r.tnm], ['临床分期', r.stage], ['分期类型', r.type],
      ['质控结论', r.result], ['质控日期', r.date]
    ], detailActions('<button class="btn btn-outline btn-sm" onclick="qcStatus(\'qc-tnm.base\',\'' + r.id + '\',\'整改\')">退回整改</button><button class="btn btn-primary btn-sm" onclick="qcStatus(\'qc-tnm.base\',\'' + r.id + '\',\'合格\')">复核合格</button>'));
  };
  DETAILS['qc-course.base'] = function (id) {
    const r = find('qc-course.base', id); if (!r) return;
    showDetail('病程记录详情 · ' + r.id, [
      ['病程编号', r.id], ['患者', r.name], ['病种', r.dz],
      ['记录类型', r.type], ['时限要求', r.limit], ['记录时间', r.time],
      ['质控结论', r.result], ['机构', r.org]
    ]);
  };
  DETAILS['qc-mdt.apply'] = function (id) {
    const r = find('qc-mdt.apply', id); if (!r) return;
    showDetail('MDT 会诊申请 · ' + r.id, [
      ['会诊编号', r.id], ['患者', r.name], ['主要诊断', r.dx],
      ['参与学科', r.teams], ['申请科室', r.dept], ['申请日期', r.date],
      ['主持专家', r.host], ['状态', r.status]
    ], detailActions('<button class="btn btn-outline btn-sm" onclick="qcStatus(\'qc-mdt.apply\',\'' + r.id + '\',\'待会诊\')">驳回</button><button class="btn btn-primary btn-sm" onclick="qcStatus(\'qc-mdt.apply\',\'' + r.id + '\',\'已排定\')">排定会诊</button>'));
  };
  DETAILS['qc-mdt.record'] = function (id) {
    const r = find('qc-mdt.record', id); if (!r) return;
    showDetail('MDT 会诊记录 · ' + r.id, [
      ['会诊编号', r.id], ['患者', r.name], ['会诊日期', r.date],
      ['讨论主题', r.topic], ['参会规模', r.scale], ['结论摘要', r.conclu], ['记录状态', r.status]
    ], detailActions('<button class="btn btn-primary btn-sm" onclick="qcStatus(\'qc-mdt.record\',\'' + r.id + '\',\'已归档\')">整理归档</button>'));
  };
  DETAILS['qc-remote.req'] = function (id) {
    const r = find('qc-remote.req', id); if (!r) return;
    showDetail('远程会诊请求 · ' + r.id, [
      ['会诊编号', r.id], ['患者', r.name], ['请求机构', r.from],
      ['受邀机构', r.to], ['会诊科室', r.dept], ['请求日期', r.date], ['状态', r.status]
    ], detailActions('<button class="btn btn-outline btn-sm" onclick="qcStatus(\'qc-remote.req\',\'' + r.id + '\',\'待接诊\')">退回</button><button class="btn btn-primary btn-sm" onclick="qcStatus(\'qc-remote.req\',\'' + r.id + '\',\'已排定\')">接诊排定</button>'));
  };
  DETAILS['qc-remote.feedback'] = function (id) {
    const r = find('qc-remote.feedback', id); if (!r) return;
    showDetail('远程会诊反馈 · ' + r.id, [
      ['会诊编号', r.id], ['患者', r.name], ['反馈专家', r.expert],
      ['受邀机构', r.org], ['反馈意见', r.opinion], ['反馈日期', r.date], ['状态', r.status]
    ]);
  };
  DETAILS['qc-remote.archive'] = function (id) {
    const r = find('qc-remote.archive', id); if (!r) return;
    showDetail('会诊归档记录 · ' + r.id, [
      ['会诊编号', r.id], ['患者', r.name], ['完成日期', r.date],
      ['归档平台', r.platform], ['归档状态', r.arc], ['闭环状态', r.close], ['闭环说明', r.note]
    ], detailActions('<button class="btn btn-primary btn-sm" onclick="qcStatus(\'qc-remote.archive\',\'' + r.id + '\',\'闭环\')">确认闭环归档</button>'));
  };
  DETAILS['qc-cohort.list'] = function (id) {
    const r = find('qc-cohort.list', id); if (!r) return;
    showDetail('纳管对象详情 · ' + r.id, [
      ['纳管编号', r.id], ['患者', r.name], ['身份证号', r.idNo],
      ['部位', r.site], ['人群类型', r.type], ['纳管来源', r.src],
      ['纳管日期', r.date], ['纳管状态', r.status]
    ], detailActions('<button class="btn btn-primary btn-sm" onclick="qcStatus(\'qc-cohort.list\',\'' + r.id + '\',\'已分组\')">完成分组纳管</button>'));
  };
  DETAILS['qc-global.indicator'] = function (id) {
    const r = find('qc-global.indicator', id); if (!r) return;
    showDetail('质控指标定义 · ' + r.id, [
      ['指标编号', r.id], ['指标名称', r.name], ['目标值', r.target],
      ['指标类型', r.type], ['考核周期', r.cycle], ['统计年度', r.year],
      ['当前值', r.val + '%'], ['结果状态', r.status]
    ], detailActions('<button class="btn btn-outline btn-sm" onclick="qcOpenIndicatorForm(\'' + r.id + '\')">编辑指标</button><button class="btn btn-danger btn-sm" onclick="qcDelete(\'qc-global.indicator\',\'' + r.id + '\')">删除</button>'));
  };
  DETAILS['qc-global.report'] = function (id) {
    const r = find('qc-global.report', id); if (!r) return;
    showDetail('质控报告 · ' + r.id, [
      ['报告编号', r.id], ['报告名称', r.name], ['生成单位', r.unit],
      ['生成时间', r.time], ['格式', r.fmt], ['状态', r.status]
    ]);
  };

  function head(title, actions) {
    return '<div class="qc-head"><div class="qc-title">' + title + '</div><div class="qc-actions">' + (actions || []).join('') + '</div></div>';
  }

  const BODIES = {

    'qc-homepage': {
      base: function () {
        const f = fv('qc-homepage', 'base');
        const list = (LISTS['qc-homepage.base'] || []).filter(function (r) {
          return (f.status === undefined || f.status === 'ALL' || r.result === f.status)
            && (!f.kw || [r.id, r.name, r.diag, r.dept].join(' ').indexOf(f.kw) >= 0);
        });
        const rows = list.map(function (r) {
          return '<tr><td class="qc-opbtn"><button class="qc-link" onclick="qcDetail(\'qc-homepage.base\',\'' + r.id + '\')">' + r.id + '</button><div class="qc-sub">' + r.source + '</div></td><td>' + esc(r.name) + '</td><td>' + r.idNo + '</td><td>' + esc(r.diag) + '</td><td>' + r.dept + '</td><td>' + r.date + '</td><td>' + sb(r.state) + '</td><td>' + sb(r.result) + '</td><td class="qc-opbtn"><button class="qc-link" onclick="qcDetail(\'qc-homepage.base\',\'' + r.id + '\')">查看</button></td></tr>';
        }).join('');
        return kpis([
          { label: '首页质控合格率', value: '92.6%', tone: 'ok', meta: '较上周期 +1.2%' },
          { label: '本周期质控首页数', value: '1,248', meta: '覆盖 42 家机构' },
          { label: '待复核首页', value: '47', tone: 'warn', meta: '超 24h 未复核 9 例' },
          { label: '首页完整性得分', value: '96.2', meta: '分 / 100 分' }
        ]) + filter('qc-homepage', 'base',
          sel('qc-homepage', 'base', 'status', '质控结论', ['合格', '待复核', '整改', '质控中']) +
          kwf('qc-homepage', 'base', '病案号 / 患者', '病案号、患者姓名、诊断、科室')) +
        '<div class="qc-tblwrap"><table class="qc-tbl"><thead><tr><th>病案号</th><th>患者</th><th>身份证号</th><th>主要诊断（ICD-10)</th><th>出院科室</th><th>出院日期</th><th>首页状态</th><th>质控结论</th><th>操作</th></tr></thead><tbody>' + (rows || '<tr><td colspan="9"><div class="qc-empty">暂无符合条件的数据</div></td></tr>') + '</tbody></table></div>' + foot(list.length);
      },
      source: function () {
        const rows = (LISTS['qc-homepage.source'] || []).map(function (r) {
          return '<tr><td class="qc-opbtn"><button class="qc-link" onclick="qcDetail(\'qc-homepage.source\',\'' + r.id + '\')">' + r.name + '</button><div class="qc-sub">' + r.type + '</div></td><td>' + r.sync + '</td><td class="num">' + r.count.toLocaleString('zh-CN') + '</td><td class="num">' + r.rate + '%' + bar(r.rate, r.tone) + '</td><td>' + sb(r.status) + '</td><td class="qc-opbtn"><button class="qc-link" onclick="qcDetail(\'qc-homepage.source\',\'' + r.id + '\')">查看</button></td></tr>';
        }).join('');
        return '<div class="qc-grid2"><div>' + filter('qc-homepage', 'source', sel('qc-homepage', 'source', 'status', '校验状态', ['正常', '正常接入', '待核'])) +
          '<div class="qc-tblwrap"><table class="qc-tbl"><thead><tr><th>数据来源系统</th><th>最近同步</th><th class="num">本周期记录数</th><th class="num">字段一致率</th><th>校验状态</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table></div>' + foot(LISTS['qc-homepage.source'].length) + '</div>' +
          '<div>' + chartBlock('各来源字段一致率', hbars([{ label: 'HIS 住院病案首页', value: 98.7, tone: 'ok' }, { label: '检验 LIS', value: 99.1, tone: 'ok' }, { label: '病理信息系统', value: 97.2, tone: 'ok' }, { label: '影像 PACS', value: 96.8, tone: 'warn' }, { label: '手工补录', value: 92.4, tone: 'warn' }])) + '</div></div>';
      },
      link: function () {
        const rows = (LISTS['qc-homepage.link'] || []).map(function (r) {
          return '<tr><td class="qc-opbtn"><button class="qc-link" onclick="qcDetail(\'qc-homepage.base\',\'' + r.id + '\')">' + r.id + '</button></td><td>' + r.path + '</td><td>' + r.img + '</td><td>' + r.lab + '</td><td>' + r.full + '</td><td>' + sb(r.status) + '</td></tr>';
        }).join('');
        return kpis([
          { label: '报告关联完整度', value: '89.4%', tone: 'ok', meta: '病理 / 影像 / 检验' },
          { label: '关联缺失首页', value: '53', tone: 'warn', meta: '缺病理 21 · 缺影像 18 · 缺检验 14' }
        ]) + filter('qc-homepage', 'link', sel('qc-homepage', 'link', 'status', '关联状态', ['完整', '缺病理', '缺影像', '缺检验'])) +
        '<div class="qc-tblwrap"><table class="qc-tbl"><thead><tr><th>病案号</th><th>病理报告编号</th><th>影像报告编号</th><th>检验报告编号</th><th>关联完整度</th><th>关联状态</th></tr></thead><tbody>' + rows + '</tbody></table></div>' + foot(LISTS['qc-homepage.link'].length);
      },
      result: function () {
        const f = fv('qc-homepage', 'result');
        const list = (LISTS['qc-homepage.result'] || []).filter(function (r) {
          return (f.verdict === undefined || f.verdict === 'ALL' || r.verdict === f.verdict);
        });
        const rows = list.map(function (r) {
          return '<tr><td class="qc-opbtn"><button class="qc-link" onclick="qcDetail(\'qc-homepage.result\',\'' + r.id + '\')">' + r.id + '</button></td><td>' + esc(r.rule) + '</td><td>' + sb(r.verdict) + '</td><td>' + (r.field === '-' ? '-' : esc(r.field)) + '</td><td>' + r.time + '</td><td>' + r.who + '</td><td>' + sb(r.status) + '</td><td class="qc-opbtn"><button class="qc-link" onclick="qcDetail(\'qc-homepage.result\',\'' + r.id + '\')">处理</button></td></tr>';
        }).join('');
        return kpis([
          { label: '单卡通过率', value: '87.9%', tone: 'ok', meta: '本周期 1,248 例' },
          { label: '触发规则总数', value: '326', meta: '跨字段逻辑 138 条' },
          { label: '待整改', value: '29', tone: 'warn', meta: '平均整改 3.2 小时' }
        ]) + filter('qc-homepage', 'result', sel('qc-homepage', 'result', 'verdict', '判定结果', ['通过', '不通过', '待复核'])) +
        '<div class="qc-tblwrap"><table class="qc-tbl"><thead><tr><th>病案号</th><th>质控规则</th><th>判定</th><th>问题字段</th><th>执行时间</th><th>处理人</th><th>处理状态</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table></div>' + foot(list.length);
      },
      storage: function () {
        const items = CONFIGS['qc-homepage.storage'] || [];
        const cfg = items.map(function (it) {
          return '<div class="qc-cfg-item"><div class="qc-cfg-top"><div class="qc-cfg-name">' + esc(it.name) + '</div>' + switchHtml(it.id, 'qc-homepage.storage', it.on) + '</div><div class="qc-cfg-meta"><span>存储位置<b>' + esc(it.loc) + '</b></span><span>脱敏策略<b>' + esc(it.desen) + '</b></span><span>保留周期<b>' + esc(it.keep) + '</b></span></div></div>';
        }).join('');
        return '<div class="qc-cfg">' + cfg + '</div>';
      }
    },

    'qc-confirmed': {
      base: function () {
        const f = fv('qc-confirmed', 'base');
        const list = (LISTS['qc-confirmed.base'] || []).filter(function (r) {
          return (f.status === undefined || f.status === 'ALL' || r.status === f.status)
            && (f.org === undefined || f.org === 'ALL' || r.org === f.org);
        });
        const rows = list.map(function (r) {
          return '<tr><td class="qc-opbtn"><button class="qc-link" onclick="qcDetail(\'qc-confirmed.base\',\'' + r.id + '\')">' + r.id + '</button></td><td>' + esc(r.name) + '</td><td>' + r.idNo + '</td><td>' + r.basis + '</td><td>' + r.date + '</td><td>' + esc(r.diag) + '</td><td>' + r.org + '</td><td>' + sb(r.status) + '</td><td class="qc-opbtn"><button class="qc-link" onclick="qcDetail(\'qc-confirmed.base\',\'' + r.id + '\')">查看</button></td></tr>';
        }).join('');
        return kpis([
          { label: '确诊依据完整率', value: '94.8%', tone: 'ok', meta: '病理确诊占比 76%' },
          { label: '本周期确诊', value: '862', meta: '机构上报口径' },
          { label: '待审核', value: '19', tone: 'warn', meta: '超 48h 未审 3 例' }
        ]) + filter('qc-confirmed', 'base',
          sel('qc-confirmed', 'base', 'org', '确诊机构', ['江西省肿瘤医院', '南昌大学第一附属医院', '赣州市人民医院', '九江市第一人民医院', '上饶市人民医院']) +
          sel('qc-confirmed', 'base', 'status', '状态', ['已确诊', '质控中', '退回'])) +
        '<div class="qc-tblwrap"><table class="qc-tbl"><thead><tr><th>确诊编号</th><th>患者</th><th>身份证号</th><th>确诊依据</th><th>确诊日期</th><th>诊断（ICD-10)</th><th>确诊机构</th><th>状态</th><th>操作</th></tr></thead><tbody>' + (rows || '<tr><td colspan="9"><div class="qc-empty">暂无符合条件的数据</div></td></tr>') + '</tbody></table></div>' + foot(list.length);
      },
      flow: function () {
        const rows = (LISTS['qc-confirmed.flow'] || []).map(function (r) {
          const p = parseInt(r.prog, 10) || 0;
          return '<tr><td class="qc-opbtn"><button class="qc-link" onclick="qcDetail(\'qc-confirmed.flow\',\'' + r.id + '\')">' + r.id + '</button></td><td>' + r.zid + '</td><td>' + r.step + '</td><td>' + r.who + '</td><td>' + r.prog + bar(p, p >= 100 ? 'ok' : p >= 66 ? '' : 'warn') + '</td><td>' + sb(r.status) + '</td><td>' + r.note + '</td><td class="qc-opbtn"><button class="qc-link" onclick="qcDetail(\'qc-confirmed.flow\',\'' + r.id + '\')">处理</button></td></tr>';
        }).join('');
        return filter('qc-confirmed', 'flow', sel('qc-confirmed', 'flow', 'status', '流程状态', ['进行中', '退回', '完成'])) +
          '<div class="qc-tblwrap"><table class="qc-tbl"><thead><tr><th>流程实例</th><th>关联确诊</th><th>当前环节</th><th>待办人</th><th>进度</th><th>状态</th><th>环节说明</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table></div>' + foot(LISTS['qc-confirmed.flow'].length);
      },
      rule: function () {
        const rows = (LISTS['qc-confirmed.rule'] || []).map(function (r) {
          return '<tr><td class="qc-opbtn"><button class="qc-link" onclick="qcDetail(\'qc-confirmed.rule\',\'' + r.id + '\')">' + r.id + '</button></td><td>' + esc(r.name) + '</td><td>' + r.exec + '</td><td>' + r.strong + '</td><td class="num">' + r.hit + '</td><td class="num">' + r.fix + '</td><td class="num">' + r.rate + '%' + bar(r.rate, r.rate >= 90 ? 'ok' : 'warn') + '</td><td>' + sb(r.status) + '</td><td class="qc-opbtn"><button class="qc-link" onclick="qcDetail(\'qc-confirmed.rule\',\'' + r.id + '\')">查看</button></td></tr>';
        }).join('');
        return kpis([
          { label: '规则总数', value: '28', meta: '单卡规则 18 · 跨卡规则 10' },
          { label: '本周期触发', value: '237', meta: '规则命中次数' },
          { label: '整体修复率', value: '86.1%', tone: 'ok', meta: '平均修复 4.5 小时' }
        ]) + filter('qc-confirmed', 'rule', sel('qc-confirmed', 'rule', 'status', '规则状态', ['启用', '观察'])) +
        '<div class="qc-tblwrap"><table class="qc-tbl"><thead><tr><th>规则编号</th><th>规则名称</th><th>执行方式</th><th>强度</th><th class="num">触发次数</th><th class="num">已修复</th><th class="num">修复率</th><th>状态</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table></div>' + foot(LISTS['qc-confirmed.rule'].length);
      },
      lifecycle: function () {
        const steps = [
          { name: '初诊登记', date: '2026-07-15', state: 'done' },
          { name: '检查检验', date: '2026-07-20', state: 'done' },
          { name: '确诊判定', date: '2026-07-29', state: 'done' },
          { name: '治疗启动', date: '2026-08-05', state: 'now' },
          { name: '随访管理', date: '—', state: 'todo' }
        ];
        const flow = '<div class="qc-flow">' + steps.map(function (s, i) {
          return '<div class="qc-step ' + s.state + '"><div class="qc-step-conn"></div><div class="qc-step-dot">' + (i + 1) + '</div><div class="qc-step-name">' + s.name + '</div><div class="qc-step-date">' + s.date + '</div></div>';
        }).join('') + '</div>';
        const rows = [
          ['2026-07-15', '初诊登记', '门诊确认为肺部占位', '张桂芳 / 胸外科', '完成'],
          ['2026-07-22', '病理采样', '经皮肺穿刺活检', '放射科', '完成'],
          ['2026-07-29', '确诊', '病理回报腺癌，纳入确诊病例', '病理科', '完成'],
          ['2026-08-05', '治疗计划', 'MDT 制定手术 + 辅助治疗方案', 'MDT 团队', '进行中']
        ].map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td><td>' + r[3] + '</td><td>' + sb(r[4]) + '</td></tr>'; }).join('');
        return card('病例生命周期轨迹（示例：QZ2026080001）', flow + '<div class="qc-tblwrap"><table class="qc-tbl" style="min-width:780px"><thead><tr><th>日期</th><th>阶段</th><th>事件</th><th>责任科室</th><th>状态</th></tr></thead><tbody>' + rows + '</tbody></table></div>',
          '<button class="btn btn-ghost btn-sm" onclick="toast(\'已切换下一示例病例（演示）\')">切换病例</button>');
      }
    },

  'qc-pathology': {
      base: function () {
        const f = fv('qc-pathology', 'base');
        const list = (LISTS['qc-pathology.base'] || []).filter(function (r) {
          return (f.result === undefined || f.result === 'ALL' || r.result === f.result);
        });
        const rows = list.map(function (r) {
          return '<tr><td class="qc-opbtn"><button class="qc-link" onclick="qcDetail(\'qc-pathology.base\',\'' + r.id + '\')">' + r.id + '</button></td><td>' + esc(r.name) + '</td><td>' + r.site + '</td><td>' + esc(r.dx) + '</td><td>' + esc(r.item) + '</td><td>' + r.state + '</td><td>' + sb(r.result) + '</td><td class="qc-opbtn"><button class="qc-link" onclick="qcDetail(\'qc-pathology.base\',\'' + r.id + '\')">复核</button></td></tr>';
        }).join('');
        return kpis([
          { label: '病理报告合格率', value: '95.1%', tone: 'ok', meta: '较上周期 +0.8%' },
          { label: '本周期报告', value: '1,862', meta: '机构上报口径' },
          { label: '待补充 / 整改', value: '41', tone: 'warn', meta: '缺分子检测占比 58%' }
        ]) + filter('qc-pathology', 'base', sel('qc-pathology', 'base', 'result', '质控结论', ['合格', '待补', '整改'])) +
        '<div class="qc-tblwrap"><table class="qc-tbl"><thead><tr><th>病理编号</th><th>患者</th><th>部位编码</th><th>病理诊断</th><th>检验项目</th><th>报告状态</th><th>质控结论</th><th>操作</th></tr></thead><tbody>' + (rows || '<tr><td colspan="8"><div class="qc-empty">暂无符合条件的数据</div></td></tr>') + '</tbody></table></div>' + foot(list.length);
      },
      attach: function () {
        const rows = (LISTS['qc-pathology.attach'] || []).map(function (r) {
          return '<tr><td class="qc-opbtn"><button class="qc-link" onclick="qcDetail(\'qc-pathology.base\',\'' + r.id + '\')">' + r.id + '</button></td><td>' + esc(r.name) + '</td><td>' + r.type + '</td><td>' + r.num + '</td><td>' + r.loc + '</td><td>' + sb(r.status) + '</td></tr>';
        }).join('');
        return filter('qc-pathology', 'attach', sel('qc-pathology', 'attach', 'status', '归档状态', ['已归档', '待补', '缺失'])) +
          '<div class="qc-tblwrap"><table class="qc-tbl"><thead><tr><th>病理编号</th><th>附件名称</th><th>附件类型</th><th>数量</th><th>存放位置</th><th>归档状态</th></tr></thead><tbody>' + rows + '</tbody></table></div>' + foot(LISTS['qc-pathology.attach'].length);
      },
      rule: function () {
        const rows = (LISTS['qc-pathology.rule'] || []).map(function (r) {
          return '<tr><td class="qc-opbtn"><button class="qc-link" onclick="qcDetail(\'qc-pathology.rule\',\'' + r.id + '\')">' + r.id + '</button></td><td>' + esc(r.name) + '</td><td>' + r.exec + '</td><td>' + r.strong + '</td><td>' + r.when + '</td><td class="num">' + r.hit + '</td><td class="num">' + r.rate + '%' + bar(r.rate, r.rate >= 90 ? 'ok' : 'warn') + '</td><td>' + sb(r.status) + '</td><td class="qc-opbtn"><button class="qc-link" onclick="qcDetail(\'qc-pathology.rule\',\'' + r.id + '\')">查看</button></td></tr>';
        }).join('');
        return '<div class="qc-grid2"><div>' + filter('qc-pathology', 'rule', sel('qc-pathology', 'rule', 'status', '规则状态', ['启用', '观察'])) +
          '<div class="qc-tblwrap"><table class="qc-tbl"><thead><tr><th>规则编号</th><th>规则名称</th><th>执行方式</th><th>强度</th><th>触发时机</th><th class="num">触发次数</th><th class="num">通过率</th><th>状态</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table></div>' + foot(LISTS['qc-pathology.rule'].length) + '</div>' +
          '<div>' + chartBlock('规则通过率', hbars([{ label: 'P-01 术语规范', value: 96.5, tone: 'ok' }, { label: 'P-02 编码一致性', value: 88.2, tone: 'warn' }, { label: 'P-03 免疫组化', value: 79.4, tone: 'warn' }, { label: 'P-04 分子检测', value: 71.8, tone: 'warn' }])) +
          kpis([
            { label: '启用规则', value: '12', meta: '自动 6 · 人工 6' },
            { label: '人工复核待办', value: '23', tone: 'warn', meta: '例' }
          ]) + '</div></div>';
      }
    },

    'qc-tnm': {
      base: function () {
        const f = fv('qc-tnm', 'base');
        const list = (LISTS['qc-tnm.base'] || []).filter(function (r) {
          return (f.result === undefined || f.result === 'ALL' || r.result === f.result);
        });
        const rows = list.map(function (r) {
          return '<tr><td class="qc-opbtn"><button class="qc-link" onclick="qcDetail(\'qc-tnm.base\',\'' + r.id + '\')">' + r.id + '</button></td><td>' + esc(r.name) + '</td><td>' + r.dx + '</td><td>' + r.tnm + '</td><td>' + r.stage + '</td><td>' + r.type + '</td><td>' + sb(r.result) + '</td><td>' + r.date + '</td><td class="qc-opbtn"><button class="qc-link" onclick="qcDetail(\'qc-tnm.base\',\'' + r.id + '\')">复核</button></td></tr>';
        }).join('');
        return kpis([
          { label: '分期完备率', value: '91.3%', tone: 'ok', meta: '病理分期占比 63%' },
          { label: '本周期分期记录', value: '1,024', meta: '覆盖 12 大病种' },
          { label: '待复核 / 整改', value: '35', tone: 'warn', meta: 'T 组件差异 14 例' }
        ]) + filter('qc-tnm', 'base', sel('qc-tnm', 'base', 'result', '质控结论', ['合格', '待复核', '整改']) + sel('qc-tnm', 'base', 'type', '分期类型', ['临床分期', '病理分期'])) +
        '<div class="qc-tblwrap"><table class="qc-tbl"><thead><tr><th>分期编号</th><th>患者</th><th>诊断</th><th>TNM</th><th>分期</th><th>分期类型</th><th>质控结论</th><th>日期</th><th>操作</th></tr></thead><tbody>' + (rows || '<tr><td colspan="9"><div class="qc-empty">暂无符合条件的数据</div></td></tr>') + '</tbody></table></div>' + foot(list.length);
      },
      attach: function () {
        const rows = (LISTS['qc-tnm.attach'] || []).map(function (r) {
          return '<tr><td class="qc-opbtn"><button class="qc-link" onclick="qcDetail(\'qc-tnm.base\',\'' + r.id + '\')">' + r.id + '</button></td><td>' + esc(r.name) + '</td><td>' + r.type + '</td><td>' + r.link + '</td><td>' + sb(r.status) + '</td></tr>';
        }).join('');
        return filter('qc-tnm', 'attach', sel('qc-tnm', 'attach', 'status', '关联状态', ['完整', '待补', '缺失'])) +
          '<div class="qc-tblwrap"><table class="qc-tbl"><thead><tr><th>分期编号</th><th>佐证材料</th><th>材料类型</th><th>关联情况</th><th>状态</th></tr></thead><tbody>' + rows + '</tbody></table></div>' + foot(LISTS['qc-tnm.attach'].length);
      },
      tpl: function () {
        const items = CONFIGS['qc-tnm.tpl'] || [];
        const cfg = items.map(function (it) {
          return '<div class="qc-cfg-item"><div class="qc-cfg-top"><div class="qc-cfg-name">' + esc(it.name) + '</div>' + switchHtml(it.id, 'qc-tnm.tpl', it.on) + '</div><div class="qc-cfg-meta"><span>适用范围<b>' + esc(it.scope) + '</b></span><span>版本年份<b>' + esc(it.year) + '</b></span><span>本周期命中<b>' + it.count + ' 例</b></span></div><div class="qc-cfg-foot"><button class="btn btn-ghost btn-xs" onclick="qcEditTnmTpl(\'' + it.id + '\')">编辑</button><button class="btn btn-danger btn-xs" onclick="qcDelete(\'qc-tnm.tpl\',\'' + it.id + '\')">删除</button></div></div>';
        }).join('');
        return '<div class="qc-cfg">' + cfg + '</div>';
      }
    },

    'qc-course': {
      base: function () {
        const f = fv('qc-course', 'base');
        const list = (LISTS['qc-course.base'] || []).filter(function (r) {
          return (f.result === undefined || f.result === 'ALL' || r.result === f.result);
        });
        const rows = list.map(function (r) {
          return '<tr><td class="qc-opbtn"><button class="qc-link" onclick="qcDetail(\'qc-course.base\',\'' + r.id + '\')">' + r.id + '</button></td><td>' + esc(r.name) + '</td><td>' + r.dz + '</td><td>' + r.type + '</td><td>' + r.limit + '</td><td>' + r.time + '</td><td>' + sb(r.result) + '</td><td class="qc-opbtn"><button class="qc-link" onclick="qcDetail(\'qc-course.base\',\'' + r.id + '\')">查看</button></td></tr>';
        }).join('');
        return kpis([
          { label: '病程及时率', value: '93.8%', tone: 'ok', meta: '首次病程达标 96%' },
          { label: '本周期病程记录', value: '3,048', meta: '机构上报口径' },
          { label: '超时 / 待补', value: '62', tone: 'warn', meta: '超时 31 · 待补 31' }
        ]) + filter('qc-course', 'base', sel('qc-course', 'base', 'result', '质控结论', ['合格', '超时', '待补'])) +
        '<div class="qc-tblwrap"><table class="qc-tbl"><thead><tr><th>病程编号</th><th>患者</th><th>病种</th><th>记录类型</th><th>时限要求</th><th>记录时间</th><th>质控结论</th><th>操作</th></tr></thead><tbody>' + (rows || '<tr><td colspan="8"><div class="qc-empty">暂无符合条件的数据</div></td></tr>') + '</tbody></table></div>' + foot(list.length);
      },
      tpl: function () {
        const items = CONFIGS['qc-course.tpl'] || [];
        const cfg = items.map(function (it) {
          return '<div class="qc-cfg-item"><div class="qc-cfg-top"><div class="qc-cfg-name">' + esc(it.name) + '</div>' + switchHtml(it.id, 'qc-course.tpl', it.on) + '</div><div class="qc-cfg-meta"><span>适用范围<b>' + esc(it.scope) + '</b></span><span>字段数<b>' + esc(it.fields) + '</b></span><span>使用量<b>' + esc(it.use) + '</b></span></div><div class="qc-cfg-foot"><button class="btn btn-ghost btn-xs" onclick="qcEditCourseTpl(\'' + it.id + '\')">编辑</button><button class="btn btn-danger btn-xs" onclick="qcDelete(\'qc-course.tpl\',\'' + it.id + '\')">删除</button></div></div>';
        }).join('');
        return '<div class="qc-cfg">' + cfg + '</div>';
      },
      link: function () {
        const rows = (LISTS['qc-course.link'] || []).map(function (r) {
          return '<tr><td class="qc-opbtn"><button class="qc-link" onclick="qcDetail(\'qc-course.base\',\'' + r.id + '\')">' + r.id + '</button></td><td>' + esc(r.src) + '</td><td>' + r.n + '</td><td>' + r.time + '</td><td>' + sb(r.status) + '</td></tr>';
        }).join('');
        return filter('qc-course', 'link', sel('qc-course', 'link', 'status', '关联状态', ['已关联', '缺影像'])) +
          '<div class="qc-tblwrap"><table class="qc-tbl"><thead><tr><th>病程编号</th><th>关联数据源</th><th>关联项数</th><th>最近关联时间</th><th>关联状态</th></tr></thead><tbody>' + rows + '</tbody></table></div>' + foot(LISTS['qc-course.link'].length);
      }
    },

  'qc-mdt': {
      apply: function () {
        const f = fv('qc-mdt', 'apply');
        const list = (LISTS['qc-mdt.apply'] || []).filter(function (r) {
          return (f.status === undefined || f.status === 'ALL' || r.status === f.status);
        });
        const rows = list.map(function (r) {
          return '<tr><td class="qc-opbtn"><button class="qc-link" onclick="qcDetail(\'qc-mdt.apply\',\'' + r.id + '\')">' + r.id + '</button></td><td>' + esc(r.name) + '</td><td>' + esc(r.dx) + '</td><td>' + esc(r.teams) + '</td><td>' + r.dept + '</td><td>' + r.date + '</td><td>' + sb(r.status) + '</td><td class="qc-opbtn"><button class="qc-link" onclick="qcDetail(\'qc-mdt.apply\',\'' + r.id + '\')">处理</button></td></tr>';
        }).join('');
        return '<div class="qc-grid2"><div>' + kpis([
          { label: '本周期 MDT 申请', value: '96', meta: '较上周期 +12%' },
          { label: '待会诊', value: '18', tone: 'warn', meta: '超 72h 未排定 3 例' },
          { label: 'MDT 覆盖率', value: '74.5%', meta: 'Ⅲ / Ⅳ 期病例口径' }
        ]) + filter('qc-mdt', 'apply', sel('qc-mdt', 'apply', 'status', '申请状态', ['待会诊', '已排定', '已完成']) + sel('qc-mdt', 'apply', 'dept', '申请科室', ['外科', '内科', '放疗', '介入'])) +
        '<div class="qc-tblwrap"><table class="qc-tbl"><thead><tr><th>会诊编号</th><th>患者</th><th>主要诊断</th><th>参与学科</th><th>申请科室</th><th>申请日期</th><th>申请状态</th><th>操作</th></tr></thead><tbody>' + (rows || '<tr><td colspan="8"><div class="qc-empty">暂无符合条件的数据</div></td></tr>') + '</tbody></table></div>' + foot(list.length) + '</div>' +
          '<div>' + chartBlock('申请科室分布', hbars([{ label: '外科', value: 34 }, { label: '放疗', value: 27 }, { label: '内科', value: 21 }, { label: '介入', value: 14 }])) + '</div></div>';
      },
      record: function () {
        const rows = (LISTS['qc-mdt.record'] || []).map(function (r) {
          return '<tr><td class="qc-opbtn"><button class="qc-link" onclick="qcDetail(\'qc-mdt.record\',\'' + r.id + '\')">' + r.id + '</button></td><td>' + esc(r.name) + '</td><td>' + r.date + '</td><td>' + esc(r.topic) + '</td><td>' + r.scale + '</td><td>' + esc(r.conclu) + '</td><td>' + sb(r.status) + '</td><td class="qc-opbtn"><button class="qc-link" onclick="qcDetail(\'qc-mdt.record\',\'' + r.id + '\')">归档</button></td></tr>';
        }).join('');
        return filter('qc-mdt', 'record', sel('qc-mdt', 'record', 'status', '记录状态', ['已归档', '待整理'])) +
          '<div class="qc-tblwrap"><table class="qc-tbl"><thead><tr><th>会诊编号</th><th>患者</th><th>会诊日期</th><th>讨论主题</th><th>参会规模</th><th>结论摘要</th><th>记录状态</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table></div>' + foot(LISTS['qc-mdt.record'].length);
      },
      snapshot: function () {
        const fld = gf([
          ['患者', '刘金生 / 男 / 62 岁'], ['身份证号', '360102********3350'],
          ['主要诊断', '肝恶性肿瘤（C22.9，T3N0M0）'], ['既往史', '乙肝 18 年，肝硬化'],
          ['影像', 'CT / MRI 肝右叶占位'], ['病理', '肝细胞癌，中分化'],
          ['检验', 'AFP 1,120 ng/mL'], ['体能状态', 'ECOG 1 分'],
          ['当前方案', 'MDT：手术 + 介入综合'], ['责任团队', '肝胆外科 / 介入科 / 影像科']
        ]);
        const rows = [
          ['2026-07-25', '门诊初诊', '肝占位待查', '正常'],
          ['2026-07-28', '影像评估', 'CT / MRI 完成', '正常'],
          ['2026-07-31', '病理', '穿刺回报肝细胞癌', '观察'],
          ['2026-08-02', 'MDT 会诊', '确定综合治疗方案', '正常']
        ].map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td><td>' + sb(r[3]) + '</td></tr>'; }).join('');
        return card('MDT 患者全景数据快照', fld, '<button class="btn btn-ghost btn-sm" onclick="toast(\'已刷新全景快照（演示）\')">刷新快照</button>') +
          card('诊疗关键节点', '<div class="qc-tblwrap"><table class="qc-tbl" style="min-width:780px"><thead><tr><th>日期</th><th>节点</th><th>内容</th><th>状态</th></tr></thead><tbody>' + rows + '</tbody></table></div>');
      }
    },

    'qc-remote': {
      req: function () {
        const f = fv('qc-remote', 'req');
        const list = (LISTS['qc-remote.req'] || []).filter(function (r) {
          return (f.status === undefined || f.status === 'ALL' || r.status === f.status);
        });
        const rows = list.map(function (r) {
          return '<tr><td class="qc-opbtn"><button class="qc-link" onclick="qcDetail(\'qc-remote.req\',\'' + r.id + '\')">' + r.id + '</button></td><td>' + esc(r.name) + '</td><td>' + r.from + '</td><td>' + r.to + '</td><td>' + r.dept + '</td><td>' + r.date + '</td><td>' + sb(r.status) + '</td><td class="qc-opbtn"><button class="qc-link" onclick="qcDetail(\'qc-remote.req\',\'' + r.id + '\')">处理</button></td></tr>';
        }).join('');
        return '<div class="qc-grid2"><div>' + kpis([
          { label: '本周期请求', value: '54', meta: '较上周期 +8%' },
          { label: '48h 接诊率', value: '91.7%', tone: 'ok', meta: '目标 ≥ 90%' },
          { label: '待接诊', value: '5', tone: 'warn', meta: '超 48h 未接 2 例' }
        ]) + filter('qc-remote', 'req', sel('qc-remote', 'req', 'status', '请求状态', ['待接诊', '已排定', '进行中', '已完成'])) +
        '<div class="qc-tblwrap"><table class="qc-tbl"><thead><tr><th>会诊编号</th><th>患者</th><th>请求机构</th><th>受邀机构</th><th>会诊科室</th><th>请求日期</th><th>状态</th><th>操作</th></tr></thead><tbody>' + (rows || '<tr><td colspan="8"><div class="qc-empty">暂无符合条件的数据</div></td></tr>') + '</tbody></table></div>' + foot(list.length) + '</div>' +
          '<div>' + chartBlock('近 6 周期远程会诊量趋势', vcols([28, 34, 31, 40, 47, 54], ['2月', '3月', '4月', '5月', '6月', '7月'])) + '</div></div>';
      },
      feedback: function () {
        const rows = (LISTS['qc-remote.feedback'] || []).map(function (r) {
          return '<tr><td class="qc-opbtn"><button class="qc-link" onclick="qcDetail(\'qc-remote.feedback\',\'' + r.id + '\')">' + r.id + '</button></td><td>' + esc(r.name) + '</td><td>' + r.expert + '</td><td>' + r.org + '</td><td>' + esc(r.opinion) + '</td><td>' + r.date + '</td><td>' + sb(r.status) + '</td><td class="qc-opbtn"><button class="qc-link" onclick="qcDetail(\'qc-remote.feedback\',\'' + r.id + '\')">查看</button></td></tr>';
        }).join('');
        return filter('qc-remote', 'feedback', sel('qc-remote', 'feedback', 'status', '反馈状态', ['已反馈', '待反馈'])) +
          '<div class="qc-tblwrap"><table class="qc-tbl"><thead><tr><th>会诊编号</th><th>患者</th><th>反馈专家</th><th>受邀机构</th><th>反馈意见</th><th>反馈日期</th><th>状态</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table></div>' + foot(LISTS['qc-remote.feedback'].length);
      },
      archive: function () {
        const rows = (LISTS['qc-remote.archive'] || []).map(function (r) {
          return '<tr><td class="qc-opbtn"><button class="qc-link" onclick="qcDetail(\'qc-remote.archive\',\'' + r.id + '\')">' + r.id + '</button></td><td>' + esc(r.name) + '</td><td>' + r.date + '</td><td>' + r.platform + '</td><td>' + sb(r.arc) + '</td><td>' + sb(r.close) + '</td><td>' + r.note + '</td><td class="qc-opbtn"><button class="qc-link" onclick="qcDetail(\'qc-remote.archive\',\'' + r.id + '\')">归档</button></td></tr>';
        }).join('');
        return kpis([
          { label: '流程闭环率', value: '88.2%', tone: 'warn', meta: '目标 ≥ 95%' },
          { label: '归档完整率', value: '94.6%', tone: 'ok', meta: '材料缺项 6 例' },
          { label: '待闭环', value: '7', tone: 'warn', meta: '需人工督办' }
        ]) + filter('qc-remote', 'archive', sel('qc-remote', 'archive', 'close', '闭环状态', ['闭环', '待闭环'])) +
        '<div class="qc-tblwrap"><table class="qc-tbl"><thead><tr><th>会诊编号</th><th>患者</th><th>完成日期</th><th>归档平台</th><th>归档状态</th><th>闭环状态</th><th>闭环说明</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table></div>' + foot(LISTS['qc-remote.archive'].length);
      }
    },

    'qc-cohort': {
      list: function () {
        const f = fv('qc-cohort', 'list');
        const list = (LISTS['qc-cohort.list'] || []).filter(function (r) {
          return (f.type === undefined || f.type === 'ALL' || r.type === f.type)
            && (f.status === undefined || f.status === 'ALL' || r.status === f.status);
        });
        const rows = list.map(function (r) {
          return '<tr><td class="qc-opbtn"><button class="qc-link" onclick="qcDetail(\'qc-cohort.list\',\'' + r.id + '\')">' + r.id + '</button></td><td>' + esc(r.name) + '</td><td>' + r.idNo + '</td><td>' + r.site + '</td><td>' + r.type + '</td><td>' + r.src + '</td><td>' + r.date + '</td><td>' + sb(r.status) + '</td><td class="qc-opbtn"><button class="qc-link" onclick="qcDetail(\'qc-cohort.list\',\'' + r.id + '\')">查看</button></td></tr>';
        }).join('');
        return kpis([
          { label: '纳管总人数', value: '8,432', meta: '高危 5,102 · 确诊 3,330' },
          { label: '本周期新纳管', value: '218', meta: '较上周期 +6%' },
          { label: '待干预', value: '64', tone: 'warn', meta: '未分配干预策略' }
        ]) + filter('qc-cohort', 'list', sel('qc-cohort', 'list', 'type', '人群类型', ['高危', '确诊']) + sel('qc-cohort', 'list', 'status', '纳管状态', ['纳管中', '已分组', '待干预'])) +
        '<div class="qc-tblwrap"><table class="qc-tbl"><thead><tr><th>纳管编号</th><th>患者</th><th>身份证号</th><th>部位</th><th>人群类型</th><th>纳管来源</th><th>纳管日期</th><th>纳管状态</th><th>操作</th></tr></thead><tbody>' + (rows || '<tr><td colspan="9"><div class="qc-empty">暂无符合条件的数据</div></td></tr>') + '</tbody></table></div>' + foot(list.length);
      },
      profile: function () {
        const fld = gf([
          ['患者', '王秋香 / 女 / 47 岁'], ['身份证号', '360402********2287'],
          ['诊断', '乳腺恶性肿瘤（C50.9）'], ['TNM', 'T2N0M0 ⅡA 期'],
          ['既往史', '无特殊'], ['家族史', '母亲乳腺癌'],
          ['首诊机构', '九江市第一人民医院'], ['责任医生', '周敏'],
          ['最近随访', '2026-07-28'], ['健康档案', '已标准化归档']
        ]);
        const rows = [
          ['2026-07-28', '两癌筛查', '乳腺彩超提示结节', '正常'],
          ['2026-07-31', '病理', '浸润性导管癌', '观察'],
          ['2026-08-02', '影像', '无远处转移', '正常']
        ].map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td><td>' + sb(r[3]) + '</td></tr>'; }).join('');
        return card('患者标准化健康档案', fld, '<button class="btn btn-ghost btn-sm" onclick="toast(\'已触发档案校验（演示）\')">档案校验</button>') +
          card('健康指标轨迹', '<div class="qc-tblwrap"><table class="qc-tbl" style="min-width:680px"><thead><tr><th>日期</th><th>指标</th><th>结果</th><th>状态</th></tr></thead><tbody>' + rows + '</tbody></table></div>');
      },
      group: function () {
        const items = CONFIGS['qc-cohort.group'] || [];
        const cfg = items.map(function (it) {
          return '<div class="qc-cfg-item"><div class="qc-cfg-top"><div class="qc-cfg-name">' + esc(it.name) + '</div>' + switchHtml(it.id, 'qc-cohort.group', it.on) + '</div><div class="qc-cfg-meta"><span>成员人数<b>' + it.count.toLocaleString('zh-CN') + ' 人</b></span><span>干预策略<b>' + esc(it.strategy) + '</b></span></div><div class="qc-cfg-foot"><button class="btn btn-ghost btn-xs" onclick="qcEditGroup(\'' + it.id + '\')">编辑策略</button></div></div>';
        }).join('');
        return '<div class="qc-grid2"><div>' + kpis([
          { label: '分组总数', value: '16', meta: '高风险 7 · 中风险 5 · 低风险 4' },
          { label: '已分组成员', value: '8,368', meta: '纳管人数 8,432' },
          { label: '干预策略覆盖', value: '92.4%', tone: 'warn', meta: '待干预 64 人' }
        ]) + '<div class="qc-cfg">' + cfg + '</div></div>' +
          '<div>' + chartBlock('各分组风险占比', hbars([{ label: '肺癌高危人群', value: 3125, tone: 'info' }, { label: '乳腺癌确诊人群', value: 2078, tone: 'ok' }, { label: '肝癌高危（乙肝）', value: 1864, tone: 'warn' }, { label: '待干预人群', value: 64, tone: 'bad' }])) + '</div></div>';
      }
    },

    'qc-global': {
      indicator: function () {
        const f = fv('qc-global', 'indicator');
        const list = (LISTS['qc-global.indicator'] || []).filter(function (r) {
          return (f.type === undefined || f.type === 'ALL' || r.type === f.type)
            && (f.status === undefined || f.status === 'ALL' || r.status === f.status);
        });
        const rows = list.map(function (r) {
          return '<tr><td class="qc-opbtn"><button class="qc-link" onclick="qcDetail(\'qc-global.indicator\',\'' + r.id + '\')">' + r.id + '</button></td><td>' + esc(r.name) + '</td><td>' + r.target + '</td><td>' + r.type + '</td><td>' + r.cycle + '</td><td>' + r.year + '</td><td class="num">' + r.val + '%</td><td>' + sb(r.status) + '</td><td class="qc-opbtn"><button class="qc-link" onclick="qcDetail(\'qc-global.indicator\',\'' + r.id + '\')">查看</button></td></tr>';
        }).join('');
        return '<div class="qc-grid2"><div>' + filter('qc-global', 'indicator', sel('qc-global', 'indicator', 'type', '指标类型', ['聚合指标', '过程指标', '结构指标']) + sel('qc-global', 'indicator', 'status', '结果状态', ['达标', '预警'])) +
        '<div class="qc-tblwrap"><table class="qc-tbl"><thead><tr><th>指标编号</th><th>指标名称</th><th>目标值</th><th>指标类型</th><th>考核周期</th><th>统计年度</th><th class="num">当前值</th><th>结果状态</th><th>操作</th></tr></thead><tbody>' + (rows || '<tr><td colspan="9"><div class="qc-empty">暂无符合条件的数据</div></td></tr>') + '</tbody></table></div>' + foot(list.length) + '</div>' +
          '<div>' + chartBlock('全省核心指标达成度', gauges([
            { label: '病理诊断占比', value: 78, warn: 70, bad: 85 },
            { label: 'DCO 占比', value: 3, warn: 20, bad: 40 },
            { label: '首页合格率', value: 89, warn: 90, bad: 80 },
            { label: 'TNM 完备率', value: 91, warn: 85, bad: 70 },
            { label: 'MDT 覆盖率', value: 66, warn: 70, bad: 50 }
          ])) + '</div></div>';
      },
      score: function () {
        const rows = (LISTS['qc-global.score'] || []).map(function (r) {
          return '<tr><td class="qc-opbtn"><button class="qc-link" onclick="toast(\'已打开「' + r.org + '」绩效详情（演示）\')">' + r.org + '</button></td><td class="num">' + r.score + '</td><td>' + bar(r.score, r.score >= 90 ? 'ok' : r.score >= 80 ? '' : 'warn') + '<div class="qc-sub">' + r.warn + ' 项指标预警</div></td><td>' + sb(r.grade) + '</td></tr>';
        }).join('');
        return kpis([
          { label: 'A 级机构', value: '2', tone: 'ok', meta: '综合得分 ≥ 90' },
          { label: '全省综合得分', value: '88.4', meta: '较上季度 +1.6' },
          { label: '预警指标机构', value: '4', tone: 'warn', meta: '需整改机构 2 家' }
        ]) + '<div class="qc-tblwrap"><table class="qc-tbl" style="min-width:680px"><thead><tr><th>机构名称</th><th class="num">综合得分</th><th>指标达标分布</th><th>等级</th></tr></thead><tbody>' + rows + '</tbody></table></div>' + foot(LISTS['qc-global.score'].length);
      },
      alert: function () {
        const alerts = (LISTS['qc-global.alert'] || []).map(function (a) {
          return '<div class="qc-cfg-item"><div class="qc-cfg-top"><div class="qc-cfg-name">' + esc(a.org) + '</div>' + sb(a.tone) + '</div><div class="qc-cfg-meta"><span>' + esc(a.msg) + '</span><span>触发时间<b>' + a.time + '</b></span></div></div>';
        }).join('');
        const rows = (LISTS['qc-global.report'] || []).map(function (r) {
          return '<tr><td class="qc-opbtn"><button class="qc-link" onclick="qcDetail(\'qc-global.report\',\'' + r.id + '\')">' + r.id + '</button></td><td>' + esc(r.name) + '</td><td>' + r.unit + '</td><td>' + r.time + '</td><td>' + r.fmt + '</td><td>' + sb(r.status) + '</td><td class="qc-opbtn"><button class="qc-link" onclick="toast(\'已打开报告预览（演示）\')">预览</button></td></tr>';
        }).join('');
        return '<div class="qc-grid2"><div>' + card('实时预警', alerts === '' ? '<div class="qc-empty">暂无预警</div>' : alerts, '<button class="btn btn-ghost btn-sm" onclick="toast(\'已全部标记为已读（演示）\')">全部已读</button>') + '</div>' +
          '<div>' + card('质控报告', '<div class="qc-tblwrap"><table class="qc-tbl" style="min-width:680px"><thead><tr><th>报告编号</th><th>报告名称</th><th>生成单位</th><th>生成时间</th><th>格式</th><th>状态</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table></div>') + '</div></div>';
      }
    }
  };

  /* ==================== 渲染主入口 ==================== */
  function renderInto(page) {
    closeModals();
    const box = document.getElementById('pageContainer');
    if (!box) return;
    state.page = page;
    box.innerHTML = renderQCPage(page);
    try { box.scrollTop = 0; } catch (e) {}
    try { if (window.autoSizeSelects) window.autoSizeSelects(); } catch (e) {}
  }

  function renderQCPage(pageId) {
    const page = PAGES[pageId];
    if (!page) return '<div class="qc-empty">未找到页面：' + esc(pageId) + '</div>';
    const tabKey = state.tab[pageId] || page.tabs[0].key;
    let body;
    if (BODIES[pageId] && BODIES[pageId][tabKey]) body = BODIES[pageId][tabKey]();
    else body = '<div class="qc-empty">视图开发中</div>';
    const tabs = '<div class="qc-tabs">' + page.tabs.map(function (t) {
      return '<button class="qc-tab' + (t.key === tabKey ? ' active' : '') + '" onclick="qcSwitchTab(\'' + pageId + '\',\'' + t.key + '\')">' + t.label + '</button>';
    }).join('') + '</div>';
    return '<div class="qc-page">' + head(page.title, page.actions) + tabs + body + '</div>';
  }

  function qcSwitchTab(page, tab) {
    state.tab[page] = tab;
    const box = document.getElementById('pageContainer');
    if (box) box.innerHTML = renderQCPage(page);
    try { if (window.autoSizeSelects) window.autoSizeSelects(); } catch (e) {}
  }

  /* ==================== 筛选 / 查询 ==================== */
  // 依赖 onChange 惰性写入 + 查询后重渲染
  function fSet(page, tab, key, val) {
    if (!state.f[page]) state.f[page] = {};
    if (!state.f[page][tab]) state.f[page][tab] = {};
    state.f[page][tab][key] = val;
  }
  function qcSet(page, tab, key, val) { fSet(page, tab, key, val); }
  function qcQuery(page, tab) {
    // 界面上的值在 onchange 阶段已写入 state，此处仅触发重渲染
    const box = document.getElementById('pageContainer');
    if (box) box.innerHTML = renderQCPage(page);
    try { if (window.autoSizeSelects) window.autoSizeSelects(); } catch (e) {}
  }
  function qcReset(page, tab) {
    if (state.f[page]) state.f[page][tab] = {};
    const box = document.getElementById('pageContainer');
    if (box) box.innerHTML = renderQCPage(page);
    try { if (window.autoSizeSelects) window.autoSizeSelects(); } catch (e) {}
  }

  /* ==================== 详情 / 状态 / 启停 / 删除 ==================== */
  function qcDetail(view, id) {
    if (DETAILS[view]) { DETAILS[view](id); return; }
    toast('详情：' + view + ' / ' + id);
  }
  function qcStatus(view, id, status) {
    const arr = LISTS[view];
    if (!arr) return;
    const it = arr.find(function (x) { return x.id === id; });
    if (!it) return;
    if (view === 'qc-remote.archive') { it.close = status; it.arc = status === '闭环' ? '已归档' : '执行待回传'; }
    else if (view === 'qc-pathology.base' || view === 'qc-tnm.base' || view === 'qc-course.base') { it.result = status; }
    else { it.status = status; }
    renderInto(pageOf(view));
    toast('状态已更新为「' + status + '」');
  }
  function qcToggle(view, id) {
    const arr = CONFIGS[view];
    if (!arr) return;
    const it = arr.find(function (x) { return x.id === id; });
    if (!it) return;
    it.on = !it.on;
    renderInto(pageOf(view));
    toast((it.on ? '已启用「' : '已停用「') + it.name + '」');
  }
  function qcDelete(view, id) {
    const inC = CONFIGS[view], inL = LISTS[view];
    const item = (inC && inC.find(function (x) { return x.id === id; })) || (inL && inL.find(function (x) { return x.id === id; }));
    const name = item ? (item.name || item.id) : id;
    const doDelete = function () {
      if (inC) { const i = inC.findIndex(function (x) { return x.id === id; }); if (i >= 0) inC.splice(i, 1); }
      if (inL) { const i = inL.findIndex(function (x) { return x.id === id; }); if (i >= 0) inL.splice(i, 1); }
      renderInto(pageOf(view));
      toast('已删除「' + name + '」，审计记录已保留');
    };
    if (window.showConfirm) { showConfirm('删除确认', '确定删除「' + name + '」吗？该操作将记录审计日志。', doDelete); }
    else doDelete();
  }

  /* ==================== 表单：新增 / 编辑 ==================== */
  function qcOpenTnmTplForm() {
    openForm('新增 TNM 分期模板', [
      { k: 'name', label: '模板名称', req: true },
      { k: 'scope', label: '适用范围', req: true, val: '肺恶性肿瘤' },
      { k: 'year', label: '版本年份', type: 'select', options: ['2023', '2024', '2025'], val: '2024' },
      { k: 'count', label: '本周期命中（例）', type: 'number', val: '0' }
    ], function (v) {
      CONFIGS['qc-tnm.tpl'].push({ id: 't' + Date.now(), name: v.name, scope: v.scope, year: v.year, on: true, count: parseInt(v.count || '0', 10) || 0 });
      renderInto('qc-tnm'); toast('已新增模板');
    });
  }
  function qcEditTnmTpl(id) {
    const it = CONFIGS['qc-tnm.tpl'].find(function (x) { return x.id === id; });
    if (!it) return;
    openForm('编辑 TNM 分期模板', [
      { k: 'name', label: '模板名称', req: true, val: it.name },
      { k: 'scope', label: '适用范围', req: true, val: it.scope },
      { k: 'year', label: '版本年份', type: 'select', options: ['2023', '2024', '2025'], val: it.year },
      { k: 'count', label: '本周期命中（例）', type: 'number', val: String(it.count) }
    ], function (v) {
      it.name = v.name; it.scope = v.scope; it.year = v.year; it.count = parseInt(v.count || '0', 10) || 0;
      renderInto('qc-tnm'); toast('已保存模板修改');
    });
  }
  function qcOpenCourseTplForm() {
    openForm('新增病程模板', [
      { k: 'name', label: '模板名称', req: true },
      { k: 'scope', label: '适用范围', req: true, val: '全部专病' },
      { k: 'fields', label: '字段数量', val: '12 字段' },
      { k: 'use', label: '使用量', val: '0 次' }
    ], function (v) {
      CONFIGS['qc-course.tpl'].push({ id: 'c' + Date.now(), name: v.name, scope: v.scope, fields: v.fields || '12 字段', on: true, use: v.use || '0 次' });
      renderInto('qc-course'); toast('已新增模板');
    });
  }
  function qcEditCourseTpl(id) {
    const it = CONFIGS['qc-course.tpl'].find(function (x) { return x.id === id; });
    if (!it) return;
    openForm('编辑病程模板', [
      { k: 'name', label: '模板名称', req: true, val: it.name },
      { k: 'scope', label: '适用范围', req: true, val: it.scope },
      { k: 'fields', label: '字段数量', val: it.fields },
      { k: 'use', label: '使用量', val: it.use }
    ], function (v) {
      it.name = v.name; it.scope = v.scope; it.fields = v.fields; it.use = v.use;
      renderInto('qc-course'); toast('已保存模板修改');
    });
  }
  function qcOpenIndicatorForm(id) {
    const it = id ? LISTS['qc-global.indicator'].find(function (x) { return x.id === id; }) : null;
    openForm(it ? '编辑质控指标' : '新增质控指标', [
      { k: 'name', label: '指标名称', req: true, val: it ? it.name : '' },
      { k: 'target', label: '目标值', req: true, val: it ? it.target : '' },
      { k: 'type', label: '指标类型', type: 'select', options: ['聚合指标', '过程指标', '结构指标'], val: it ? it.type : '过程指标' },
      { k: 'cycle', label: '考核周期', type: 'select', options: ['月度', '季度', '年度'], val: it ? it.cycle : '月度' },
      { k: 'year', label: '统计年度', type: 'select', options: ['2024', '2025', '2026'], val: it ? it.year : '2026' },
      { k: 'val', label: '当前值（%）', type: 'number', val: it ? String(it.val) : '' }
    ], function (v) {
      if (it) {
        it.name = v.name; it.target = v.target; it.type = v.type; it.cycle = v.cycle; it.year = v.year;
        it.val = parseFloat(v.val || '0'); it.status = '达标';
      } else {
        LISTS['qc-global.indicator'].push({ id: 'KPI-' + String(LISTS['qc-global.indicator'].length + 1).padStart(2, '0'), name: v.name, target: v.target, type: v.type, cycle: v.cycle, year: v.year, status: '达标', val: parseFloat(v.val || '0') });
      }
      renderInto('qc-global'); toast(it ? '已保存指标修改' : '已新增指标');
    });
  }
  function qcOpenGroupForm() {
    openForm('新建患者分组', [
      { k: 'name', label: '分组名称', req: true },
      { k: 'count', label: '成员人数', type: 'number', val: '0' },
      { k: 'strategy', label: '干预策略', req: true }
    ], function (v) {
      CONFIGS['qc-cohort.group'].push({ id: 'g' + Date.now(), name: v.name, count: parseInt(v.count || '0', 10) || 0, strategy: v.strategy, on: true, tone: 'info' });
      renderInto('qc-cohort'); toast('已新建分组');
    });
  }
  function qcEditGroup(id) {
    const it = CONFIGS['qc-cohort.group'].find(function (x) { return x.id === id; });
    if (!it) return;
    openForm('编辑分组干预策略', [
      { k: 'name', label: '分组名称', req: true, val: it.name },
      { k: 'count', label: '成员人数', type: 'number', val: String(it.count) },
      { k: 'strategy', label: '干预策略', req: true, val: it.strategy }
    ], function (v) {
      it.name = v.name; it.count = parseInt(v.count || '0', 10) || 0; it.strategy = v.strategy;
      renderInto('qc-cohort'); toast('已保存分组修改');
    });
  }
  function qcOpenMdtApplyForm() {
    openForm('发起 MDT 会诊申请', [
      { k: 'name', label: '患者姓名', req: true },
      { k: 'dx', label: '主要诊断', req: true },
      { k: 'teams', label: '参与学科', req: true, val: '胸外科 / 肿瘤内科 / 影像 / 病理' },
      { k: 'dept', label: '申请科室', type: 'select', options: ['外科', '内科', '放疗', '介入'], val: '外科' },
      { k: 'host', label: '主持专家', val: '刘教授' }
    ], function (v) {
      LISTS['qc-mdt.apply'].push({ id: 'MDT' + Date.now(), name: v.name, dx: v.dx, teams: v.teams, dept: v.dept, date: '2026-08-03', status: '待会诊', host: v.host });
      renderInto('qc-mdt'); toast('已发起会诊申请');
    });
  }
  function qcOpenRemoteReqForm() {
    openForm('发起远程会诊申请', [
      { k: 'name', label: '患者姓名', req: true },
      { k: 'from', label: '请求机构', req: true, val: '九江市第一人民医院' },
      { k: 'to', label: '受邀机构', req: true, type: 'select', options: ['江西省肿瘤医院', '南昌大学第一附属医院', '赣州市人民医院'], val: '江西省肿瘤医院' },
      { k: 'dept', label: '会诊科室', req: true, val: '肿瘤内科' }
    ], function (v) {
      LISTS['qc-remote.req'].push({ id: 'YC' + Date.now(), name: v.name, from: v.from, to: v.to, dept: v.dept, date: '2026-08-03', status: '待接诊' });
      renderInto('qc-remote'); toast('已发起远程会诊申请');
    });
  }

  /* ==================== 对外暴露 ==================== */
  const publicApi = {
    renderQCPage: renderQCPage,
    qcSwitchTab: qcSwitchTab,
    renderInto: renderInto, qcSet: qcSet, qcQuery: qcQuery, qcReset: qcReset,
    qcDetail: qcDetail, qcStatus: qcStatus, qcToggle: qcToggle, qcDelete: qcDelete,
    qcOpenTnmTplForm: qcOpenTnmTplForm, qcEditTnmTpl: qcEditTnmTpl,
    qcOpenCourseTplForm: qcOpenCourseTplForm, qcEditCourseTpl: qcEditCourseTpl,
    qcOpenIndicatorForm: qcOpenIndicatorForm, qcOpenGroupForm: qcOpenGroupForm,
    qcEditGroup: qcEditGroup, qcOpenMdtApplyForm: qcOpenMdtApplyForm, qcOpenRemoteReqForm: qcOpenRemoteReqForm,
    qcPageIds: OWNED_IDS.slice()
  };
  Object.assign(window, publicApi);
  window.qcPageIds = OWNED_IDS.slice();
})();