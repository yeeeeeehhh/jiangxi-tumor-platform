/* 肿瘤专科画像 V5 - 前端重构版 (江西11设区市 + 4页签详情 + 肿瘤个案统计指标) */
(function(){ 'use strict';

/* ===================== 样式注入 ===================== */
var spStyle = document.createElement('style');
spStyle.textContent = `
.sp-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px}
.sp-header-left h2{font-size:var(--fs-h1);color:var(--color-text-title);margin:0 0 6px}
.sp-header-left p{font-size:var(--fs-sm);color:var(--color-text-muted);margin:0}
.sp-header-actions{display:flex;gap:8px}
.sp-tabs{display:flex;gap:0;border-bottom:2px solid var(--color-border);margin-bottom:18px}
.sp-tab{padding:10px 22px;border:0;background:transparent;color:var(--color-text-muted);cursor:pointer;font-weight:600;font-size:var(--fs-body);border-bottom:2px solid transparent;margin-bottom:-2px;transition:color var(--dur-fast),border-color var(--dur-fast)}
.sp-tab:hover{color:var(--color-primary)}
.sp-tab.active{color:var(--color-primary);border-bottom-color:var(--color-primary)}
.sp-stat-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:18px}
.sp-stat-card{background:var(--surface);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:16px 18px;box-shadow:var(--shadow-xs)}
.sp-stat-label{font-size:var(--fs-sm);color:var(--color-text-muted)}
.sp-stat-value{font-size:var(--fs-stat);font-weight:700;color:var(--color-primary);margin-top:4px;font-family:var(--font-num)}
.sp-stat-sub{font-size:var(--fs-xs);color:var(--color-text-muted);margin-top:4px}
.sp-filter-bar{display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;padding:14px;background:var(--color-bg-subtle);border:1px solid var(--color-border);border-radius:var(--radius-md);margin-bottom:14px}
.sp-filter-bar .form-group{width:180px}
.sp-filter-bar .form-group.wide{width:260px}
.sp-filter-actions{margin-left:auto;display:flex;gap:8px}
.sp-table-wrap{overflow-x:auto}
.sp-qc-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-bottom:18px}
.sp-qc-card{background:var(--surface);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:14px;text-align:center;cursor:pointer;transition:border-color var(--dur-fast)}
.sp-qc-card:hover,.sp-qc-card.active{border-color:var(--color-primary);background:var(--color-primary-soft)}
.sp-qc-card .num{font-size:var(--fs-stat-sm);font-weight:700;color:var(--color-primary);font-family:var(--font-num)}
.sp-qc-card .lbl{font-size:var(--fs-xs);color:var(--color-text-muted);margin-top:2px}
.sp-detail-nav{display:flex;gap:0;border-bottom:2px solid var(--color-border);margin-bottom:16px;flex-wrap:wrap}
.sp-detail-tab{padding:8px 16px;border:0;background:transparent;color:var(--color-text-muted);cursor:pointer;font-weight:500;font-size:var(--fs-sm);border-bottom:2px solid transparent;margin-bottom:-2px;transition:color var(--dur-fast),border-color var(--dur-fast)}
.sp-detail-tab:hover{color:var(--color-primary)}
.sp-detail-tab.active{color:var(--color-primary);border-bottom-color:var(--color-primary);font-weight:600}
.sp-detail-section{display:none}.sp-detail-section.active{display:block}
.sp-kv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px 16px}
.sp-kv-item{display:flex;flex-direction:column;gap:2px;padding:8px 0;border-bottom:1px dashed var(--color-border)}
.sp-kv-item .k{font-size:var(--fs-xs);color:var(--color-text-muted)}
.sp-kv-item .v{font-size:var(--fs-body);color:var(--color-text-body);font-weight:500}
.sp-timeline{position:relative;padding-left:24px;margin:12px 0}
.sp-timeline::before{content:'';position:absolute;left:7px;top:4px;bottom:4px;width:2px;background:var(--color-border)}
.sp-tl-item{position:relative;padding-bottom:16px}
.sp-tl-item::before{content:'';position:absolute;left:-20px;top:6px;width:10px;height:10px;border-radius:50%;background:var(--color-primary);border:2px solid var(--surface)}
.sp-tl-date{font-size:var(--fs-xs);color:var(--color-text-muted);margin-bottom:2px}
.sp-tl-content{font-size:var(--fs-body);color:var(--color-text-body)}
.sp-risk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
.sp-risk-card{border:1px solid var(--color-border);border-radius:var(--radius-md);padding:12px;background:var(--surface)}
.sp-risk-card.high{border-left:3px solid var(--color-danger-solid)}
.sp-risk-card.medium{border-left:3px solid var(--color-caution-solid)}
.sp-risk-card.low{border-left:3px solid var(--color-success-solid)}
.sp-risk-title{font-size:var(--fs-sm);font-weight:600;color:var(--color-text-title);margin-bottom:4px}
.sp-risk-level{font-size:var(--fs-xs);font-weight:600}
.sp-chart-placeholder{height:220px;background:var(--color-bg-subtle);border:1px dashed var(--color-border);border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;color:var(--color-text-muted);font-size:var(--fs-sm);margin-bottom:16px}
@media(max-width:1200px){.sp-stat-row,.sp-qc-summary{grid-template-columns:repeat(2,1fr)}}
@media(max-width:768px){.sp-stat-row,.sp-qc-summary{grid-template-columns:1fr}.sp-filter-bar{flex-direction:column}.sp-filter-bar .form-group,.sp-filter-bar .form-group.wide{width:100%}.sp-filter-actions{margin-left:0;width:100%}}
`;
document.head.appendChild(spStyle);

/* ===================== Mock 数据 (V5 Schema · 江西11设区市) ===================== */
var tumorEvents = [
  {id:'TE001',patient:'陈建国',sex:'男',age:63,idNo:'360102196305121234',diagnosis:'右肺上叶腺癌',site:'肺',stage:'IIIB期',stageDate:'2026-06-18',phase:'治疗中',line:'第2线',regimen:'免疫+化疗(帕博利珠单抗+培美曲塞)',ecog:1,response:'PR',risks:[{type:'营养',level:'中度风险',cls:'badge-orange'},{type:'VTE',level:'高危',cls:'badge-danger'}],qcScore:91,region:'南昌市东湖区'},
  {id:'TE002',patient:'陈建国',sex:'男',age:63,idNo:'360102196305121234',diagnosis:'升结肠腺癌',site:'结肠',stage:'IIA期',stageDate:'2025-11-03',phase:'随访中',line:'第1线',regimen:'XELOX辅助化疗',ecog:0,response:'CR',risks:[{type:'疼痛',level:'轻度',cls:'badge-caution'}],qcScore:84,region:'南昌市东湖区'},
  {id:'TE003',patient:'刘雅琴',sex:'女',age:47,idNo:'360702197808152345',diagnosis:'左乳浸润性导管癌',site:'乳房',stage:'IIB期',stageDate:'2026-03-22',phase:'治疗中',line:'第1线',regimen:'TC×4→内分泌维持',ecog:0,response:'PR',risks:[{type:'焦虑',level:'可疑',cls:'badge-info'}],qcScore:96,region:'赣州市章贡区'},
  {id:'TE004',patient:'赵德顺',sex:'男',age:71,idNo:'360402195502283456',diagnosis:'胃窦低分化腺癌',site:'胃',stage:'IV期',stageDate:'2026-07-10',phase:'进展',line:'第3线',regimen:'纳武利尤单抗+化疗',ecog:2,response:'PD',risks:[{type:'营养',level:'高度风险',cls:'badge-danger'},{type:'跌倒',level:'高风险',cls:'badge-danger'}],qcScore:68,region:'九江市浔阳区'}
];

var qcWorkOrders = [
  {id:'QC-C-006',patient:'陈建国',diagnosis:'右肺上叶腺癌',category:'完整性',level:'低',problem:'建议补充复发发生原因检查',desc:'组织样本已送检，报告未返回'},
  {id:'QC-T-004',patient:'陈建国',diagnosis:'右肺上叶腺癌',category:'一致性',level:'中',problem:'血常规检查超过4小时',desc:'结果延迟11小时入库，相关危险因素未评估'},
  {id:'QC-I-005',patient:'陈建国',diagnosis:'右肺上叶腺癌',category:'一致性',level:'中',problem:'复发部位类型不完整',desc:'缺少常见临床表现记录'},
  {id:'QC-A-002',patient:'陈建国',diagnosis:'右肺上叶腺癌',category:'可追溯性',level:'中',problem:'基因检测待补充',desc:'N06关联的NGS检查缺失'},
  {id:'QC-C-011',patient:'赵德顺',diagnosis:'胃窦低分化腺癌',category:'完整性',level:'高',problem:'缺少疫苗接种表',desc:'治疗效果评估无法计算，需补充并保留历史记录'},
  {id:'QC-T-009',patient:'赵德顺',diagnosis:'胃窦低分化腺癌',category:'一致性',level:'中',problem:'随访记录超期未更新',desc:'最后随访距今超过90天'},
  {id:'QC-A-007',patient:'刘雅琴',diagnosis:'左乳浸润性导管癌',category:'可追溯性',level:'中',problem:'内分泌治疗缺少医嘱证',desc:'TRT要求未关联HIS医嘱'},
  {id:'QC-I-013',patient:'陈建国',diagnosis:'右肺上叶腺癌',category:'一致性',level:'低',problem:'分期类型与证据不匹配',desc:'pTNM记录缺少病理切片图'}
];

/* ===================== 工具函数 ===================== */
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function badge(text,cls){return '<span class="badge '+esc(cls)+'">'+esc(text)+'</span>'}
function scoreDot(score){var color=score>=90?'var(--color-success-solid)':score>=75?'var(--color-caution-solid)':'var(--color-danger-solid)';return '<span style="display:inline-flex;align-items:center;gap:6px"><span style="width:8px;height:8px;border-radius:50%;background:'+color+'"></span>'+score+'</span>'}
function kv(label,value){return '<div class="sp-kv-item"><span class="k">'+esc(label)+'</span><span class="v">'+esc(value||'-')+'</span></div>'}

/* ===================== 子页面：画像工作台 ===================== */
function renderWorkbench(){
  var filter='<div class="sp-filter-bar">'+
    '<div class="form-group wide"><label>关键字</label><input type="text" placeholder="姓名 / 地区 / 诊断" id="spSearch"></div>'+
    '<div class="form-group"><label>疾病阶段</label><select id="spStageFilter"><option value="">全部</option><option>治疗中</option><option>随访中</option><option>进展</option></select></div>'+
    '<div class="form-group"><label>预警</label><select id="spWarnFilter"><option value="">全部</option><option>高危</option><option>中度风险</option><option>可疑</option></select></div>'+
    '<div class="form-group"><label>确认状态</label><select><option value="">全部</option><option>已确认</option><option>待确认</option></select></div>'+
    '<div class="sp-filter-actions"><button class="btn btn-ghost btn-sm" onclick="document.getElementById(\'spSearch\').value=\'\';renderSpecialtyPortrait()">重置</button><button class="btn btn-primary btn-sm" onclick="renderSpecialtyPortrait()">查询</button></div>'+
  '</div>';

  var rows=tumorEvents.map(function(e){
    // 分离风险：营养单独一列，其他风险合并一列
    var nutritionRisk = e.risks.find(function(r){return r.type==='营养'});
    var otherRisks = e.risks.filter(function(r){return r.type!=='营养'});
    
    var nutritionCell = nutritionRisk ? badge(nutritionRisk.level, nutritionRisk.cls) : '<span style="color:var(--color-text-muted)">-</span>';
    var otherRiskCell = otherRisks.length ? otherRisks.map(function(r){return badge(r.type+' '+r.level,r.cls)}).join(' ') : '<span style="color:var(--color-text-muted)">-</span>';

    return '<tr style="cursor:pointer" onclick="window._spOpenDetail && window._spOpenDetail(\''+esc(e.id)+'\')">'+
      '<td><div style="font-weight:600">'+esc(e.patient)+'</div><div style="font-size:12px;color:var(--color-text-muted)">'+esc(e.sex)+' · '+e.age+'岁</div></td>'+
      '<td><div>'+esc(e.diagnosis)+'</div><div style="font-size:12px;color:var(--color-text-muted)">'+esc(e.region)+'</div></td>'+
      '<td>'+esc(e.stage)+'<div style="font-size:11px;color:var(--color-text-muted)">'+esc(e.stageDate)+'</div></td>'+
      '<td>'+badge(e.phase,e.phase==='治疗中'?'badge-info':e.phase==='随访中'?'badge-success':'badge-danger')+'</td>'+
      '<td><div style="font-size:12px;font-weight:500">'+esc(e.line)+'</div><div style="font-size:11px;color:var(--color-text-muted);white-space:normal;line-height:1.4">'+esc(e.regimen)+'</div></td>'+
      '<td>ECOG '+e.ecog+' · '+esc(e.response)+'</td>'+
      '<td>'+nutritionCell+'</td>'+
      '<td>'+otherRiskCell+'</td>'+
      '<td>'+scoreDot(e.qcScore)+'</td>'+
    '</tr>';
  }).join('');

  var table='<div class="panel"><div class="panel-header"><span>肿瘤事件列表</span><span style="font-size:12px;color:var(--color-text-muted)">共 '+tumorEvents.length+' 个事件</span></div>'+
    '<div class="sp-table-wrap"><table class="data-table"><thead><tr><th>患者信息</th><th>诊断与地区</th><th>分期</th><th>阶段</th><th>治疗方案</th><th>体能/疗效</th><th>营养风险</th><th>其他风险</th><th>质控分</th></tr></thead><tbody>'+rows+'</tbody></table></div></div>';

  return filter+table;
}

/* ===================== 子页面：画像质控 ===================== */
function renderQC(){
  // Summary cards removed per user request
  var catTabs='<div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">'+
    ['全部','完整性','一致性','及时性','可追溯性'].map(function(c,i){
      return '<button class="btn '+(i===0?'btn-primary':'btn-ghost')+' btn-sm">'+esc(c)+'</button>';
    }).join('')+'</div>';

  var levelBadge=function(l){return l==='高'?badge('高','badge-danger'):l==='中'?badge('中','badge-orange'):badge('低','badge-info')};
  var rows=qcWorkOrders.map(function(w){
    return '<tr><td style="font-weight:600;font-size:13px">'+esc(w.id)+'</td>'+
      '<td><div style="font-weight:500">'+esc(w.patient)+'</div><div style="font-size:12px;color:var(--color-text-muted)">'+esc(w.diagnosis)+'</div></td>'+
      '<td>'+badge(w.category,'badge-neutral')+'</td>'+
      '<td>'+levelBadge(w.level)+'</td>'+
      '<td style="max-width:260px;white-space:normal;line-height:1.5">'+esc(w.problem)+'</td>'+
      '<td style="max-width:300px;white-space:normal;line-height:1.5;color:var(--color-text-muted)">'+esc(w.desc)+'</td></tr>';
  }).join('');

  var table='<div class="panel"><div class="panel-header"><span>质控工单列表</span></div>'+
    '<div class="sp-table-wrap"><table class="data-table"><thead><tr><th>规则ID</th><th>关联患者</th><th>质控类别</th><th>严重级别</th><th>问题描述</th><th>详细说明</th></tr></thead><tbody>'+rows+'</tbody></table></div></div>';

  return catTabs+table;
}

/* ===================== 子页面：画像统计（肿瘤个案专业指标） ===================== */
function renderStats(){
  // 计算肿瘤个案维度指标
  var stageDist={};
  var pathologyDist={};
  var responseDist={CR:0,PR:0,SD:0,PD:0};
  var riskTypeCount={};
  tumorEvents.forEach(function(e){
    stageDist[e.stage]=(stageDist[e.stage]||0)+1;
    var pathType=e.diagnosis.replace(/.*(癌|瘤|病)/,'$1')||'其他';
    pathologyDist[pathType]=(pathologyDist[pathType]||0)+1;
    if(responseDist.hasOwnProperty(e.response)) responseDist[e.response]++;
    e.risks.forEach(function(r){riskTypeCount[r.type]=(riskTypeCount[r.type]||0)+1});
  });
  var totalEv=tumorEvents.length;
  var treatRespRate=Math.round((responseDist.CR+responseDist.PR)/totalEv*100);
  var medianFollow='4.2个月';
  var lostRate='3.8%';

  var overview='<div class="sp-stat-row">'+
    '<div class="sp-stat-card"><div class="sp-stat-label">本专科在管事件</div><div class="sp-stat-value">'+totalEv+'</div><div class="sp-stat-sub">覆盖 '+new Set(tumorEvents.map(function(e){return e.region.split('市')[0]})).size+' 个设区市</div></div>'+
    '<div class="sp-stat-card"><div class="sp-stat-label">治疗响应率(CR+PR)</div><div class="sp-stat-value">'+treatRespRate+'%</div><div class="sp-stat-sub">国标参考 ≥60%</div></div>'+
    '<div class="sp-stat-card"><div class="sp-stat-label">中位随访时长</div><div class="sp-stat-value">'+medianFollow+'</div><div class="sp-stat-sub">失访率 '+lostRate+'</div></div>'+
    '<div class="sp-stat-card"><div class="sp-stat-label">质控达标率</div><div class="sp-stat-value">87.5%</div><div class="sp-stat-sub">目标 ≥90%</div></div>'+
  '</div>';

  var stageStr=Object.keys(stageDist).map(function(k){return k+' '+stageDist[k]}).join(' · ');
  var pathStr=Object.keys(pathologyDist).map(function(k){return k+' '+pathologyDist[k]}).join(' · ');
  var riskStr=Object.keys(riskTypeCount).map(function(k){return k+' '+riskTypeCount[k]}).join(' · ');
  var respStr='CR '+responseDist.CR+' · PR '+responseDist.PR+' · SD '+responseDist.SD+' · PD '+responseDist.PD;

  var charts='<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px">'+
    '<div class="panel"><div class="panel-header">分期构成比</div><div class="panel-body"><div class="sp-chart-placeholder">📊 饼图：'+esc(stageStr)+'</div></div></div>'+
    '<div class="panel"><div class="panel-header">病理类型分布</div><div class="panel-body"><div class="sp-chart-placeholder">📊 柱状图：'+esc(pathStr)+'</div></div></div>'+
    '<div class="panel"><div class="panel-header">治疗响应评价</div><div class="panel-body"><div class="sp-chart-placeholder">📊 堆叠柱状图：'+esc(respStr)+'</div></div></div>'+
    '<div class="panel"><div class="panel-header">风险标签分布</div><div class="panel-body"><div class="sp-chart-placeholder">📊 横向柱状图：'+esc(riskStr)+'</div></div></div>'+
  '</div>';
  return overview+charts;
}

/* ===================== 详情面板（4核心页签） ===================== */
var _currentDetailEvent = null;
var _currentDetailTab = 'overview';

function renderDetailPanel(eventId){
  var ev = tumorEvents.find(function(e){return e.id===eventId});
  if(!ev) return '<div class="panel"><div class="panel-body">未找到该肿瘤事件</div></div>';
  _currentDetailEvent = ev;

  var tabs=[
    {key:'overview',label:'概览'},
    {key:'treatment-evidence',label:'治疗与证据'},
    {key:'risk-outcome',label:'风险与结局'},
    {key:'qc-version',label:'质控与版本'}
  ];
  var nav='<div class="sp-detail-nav">'+tabs.map(function(t){
    return '<button class="sp-detail-tab'+(t.key===_currentDetailTab?' active':'')+'" onclick="window._spSwitchDetailTab(\''+t.key+'\')">'+esc(t.label)+'</button>';
  }).join('')+'</div>';

  var sections='';

  // === 1. 概览 (合并: 当前决策 + 疾病分期 + 诊疗历程摘要) ===
  sections+='<div class="sp-detail-section'+(_currentDetailTab==='overview'?' active':'')+'" id="sp-dt-overview">';
  sections+='<div class="panel"><div class="panel-header">诊疗概览</div><div class="panel-body"><div class="sp-kv-grid">';
  sections+=kv('当前阶段',ev.phase)+kv('当前治疗方案',ev.line+' '+ev.regimen)+kv('最近疗效评价',ev.response)+kv('ECOG评分',ev.ecog);
  sections+=kv('临床分期',ev.stage)+kv('分期日期',ev.stageDate)+kv('TNM','T2N1'+(ev.stage==='IV期'?'M1':'M0'))+kv('病理类型',ev.diagnosis);
  sections+=kv('主要风险',ev.risks.map(function(r){return r.type+'('+r.level+')'}).join('、'));
  sections+=kv('下一步建议',ev.phase==='进展'?'建议MDT讨论换线':'继续当前方案，按期复查');
  sections+='</div></div></div>';
  // 简要时间线
  sections+='<div class="panel" style="margin-top:12px"><div class="panel-header">关键节点</div><div class="panel-body"><div class="sp-timeline">';
  [{d:'2026-01-15',c:'确诊 '+esc(ev.diagnosis)+'，完成基线评估'},{d:'2026-02-01',c:'启动'+esc(ev.line)+' '+esc(ev.regimen)},{d:'2026-05-20',c:'疗效评价：'+esc(ev.response)}].forEach(function(item){
    sections+='<div class="sp-tl-item"><div class="sp-tl-date">'+item.d+'</div><div class="sp-tl-content">'+item.c+'</div></div>';
  });
  sections+='</div></div></div></div>';

  // === 2. 治疗与证据 (合并: 治疗管理 + 数据证据) ===
  sections+='<div class="sp-detail-section'+(_currentDetailTab==='treatment-evidence'?' active':'')+'" id="sp-dt-treatment-evidence">';
  sections+='<div class="panel"><div class="panel-header">完整治疗历程</div><div class="panel-body"><div class="sp-timeline">';
  sections+='<div class="sp-tl-item"><div class="sp-tl-date">2026-01-15</div><div class="sp-tl-content">确诊 '+esc(ev.diagnosis)+'，完成基线评估</div></div>';
  sections+='<div class="sp-tl-item"><div class="sp-tl-date">2026-02-01</div><div class="sp-tl-content">启动'+esc(ev.line)+' '+esc(ev.regimen)+' 方案</div></div>';
  sections+='<div class="sp-tl-item"><div class="sp-tl-date">2026-05-20</div><div class="sp-tl-content">疗效评价：'+esc(ev.response)+'，ECOG '+ev.ecog+'</div></div>';
  if(ev.phase==='进展'){sections+='<div class="sp-tl-item"><div class="sp-tl-date">2026-07-10</div><div class="sp-tl-content">疾病进展，启动三线方案</div></div>';}
  sections+='</div></div></div>';
  sections+='<div class="panel" style="margin-top:12px"><div class="panel-header">检验检查与影像</div><div class="panel-body">';
  sections+='<table class="data-table"><thead><tr><th>日期</th><th>类型</th><th>项目</th><th>结果</th><th>状态</th></tr></thead><tbody>';
  [['2026-08-20','影像','增强CT','病灶缩小18%','已审核'],['2026-08-18','检验','血常规','WBC 5.2×10⁹/L','已审核'],['2026-08-18','检验','肝肾功能','ALT 28 / Cr 72','已审核'],['2026-07-15','病理','NGS检测','EGFR野生型','已审核'],['2026-06-18','影像','PET-CT','SUVmax 6.8','已审核']].forEach(function(r){
    sections+='<tr><td>'+r[0]+'</td><td>'+badge(r[1],'badge-neutral')+'</td><td>'+r[2]+'</td><td>'+r[3]+'</td><td>'+badge(r[4],'badge-success')+'</td></tr>';
  });
  sections+='</tbody></table></div></div></div>';

  // === 3. 风险与结局 (合并: 风险评估 + 结局随访) ===
  sections+='<div class="sp-detail-section'+(_currentDetailTab==='risk-outcome'?' active':'')+'" id="sp-dt-risk-outcome">';
  sections+='<div class="panel"><div class="panel-header">风险评估面板</div><div class="panel-body"><div class="sp-risk-grid">';
  var allRisks=['营养','VTE','疼痛','焦虑','跌倒','压疮'];
  allRisks.forEach(function(rt){
    var found=ev.risks.find(function(r){return r.type===rt});
    var lvl=found?found.level:'无风险';
    var cls=found?(lvl.indexOf('高')>=0?'high':lvl.indexOf('中')>=0?'medium':'low'):'low';
    sections+='<div class="sp-risk-card '+cls+'"><div class="sp-risk-title">'+esc(rt)+'</div><div class="sp-risk-level" style="color:'+(cls==='high'?'var(--color-danger-solid)':cls==='medium'?'var(--color-caution-solid)':'var(--color-success-solid)')+'">'+esc(lvl)+'</div></div>';
  });
  sections+='</div></div></div>';
  sections+='<div class="panel" style="margin-top:12px"><div class="panel-header">结局与随访</div><div class="panel-body"><div class="sp-kv-grid">';
  sections+=kv('生存状态',ev.phase==='进展'?'带瘤生存':'存活')+kv('末次随访','2026-08-25')+kv('中位随访时长','4.2个月')+kv('下次随访','2026-09-25');
  sections+=kv('PFS','6.2个月')+kv('OS','进行中')+kv('生活质量评分','78/100');
  sections+='</div></div></div></div>';

  // === 4. 质控与版本 (合并: 画像质控 + 版本追溯) ===
  sections+='<div class="sp-detail-section'+(_currentDetailTab==='qc-version'?' active':'')+'" id="sp-dt-qc-version">';
  var evQc=qcWorkOrders.filter(function(w){return w.patient===ev.patient});
  sections+='<div class="panel"><div class="panel-header">该画像质控问题 ('+evQc.length+')</div><div class="panel-body">';
  if(evQc.length===0){sections+='<div style="color:var(--color-text-muted);padding:12px 0">暂无质控问题 ✓</div>';}
  else{
    sections+='<table class="data-table"><thead><tr><th>规则</th><th>类别</th><th>级别</th><th>问题</th><th>说明</th></tr></thead><tbody>';
    evQc.forEach(function(w){
      var lb=w.level==='高'?'badge-danger':w.level==='中'?'badge-orange':'badge-info';
      sections+='<tr><td style="font-weight:600">'+esc(w.id)+'</td><td>'+badge(w.category,'badge-neutral')+'</td><td>'+badge(w.level,lb)+'</td><td>'+esc(w.problem)+'</td><td style="color:var(--color-text-muted)">'+esc(w.desc)+'</td></tr>';
    });
    sections+='</tbody></table>';
  }
  sections+='</div></div>';
  sections+='<div class="panel" style="margin-top:12px"><div class="panel-header">画像版本记录</div><div class="panel-body">';
  sections+='<table class="data-table"><thead><tr><th>版本</th><th>更新时间</th><th>更新人</th><th>变更摘要</th><th>质控分</th></tr></thead><tbody>';
  [['V5.0','2026-08-28 10:00','系统','V5前端重构：4页签+江西化+肿瘤指标',92],['V4.2','2026-08-25 14:30','张医生','更新疗效评价为PR，补充NGS结果',91],['V4.1','2026-07-10 09:15','李医生','新增三线方案记录',85],['V4.0','2026-06-18 16:42','张医生','更新分期至IIIB期',82]].forEach(function(v){
    sections+='<tr><td style="font-weight:600">'+v[0]+'</td><td>'+v[1]+'</td><td>'+v[2]+'</td><td>'+v[3]+'</td><td>'+scoreDot(v[4])+'</td></tr>';
  });
  sections+='</tbody></table></div></div></div>';

  return nav+sections;
}

window._spSwitchDetailTab=function(tab){
  _currentDetailTab=tab;
  if(_currentDetailEvent){
    var container=document.getElementById('spDetailContainer');
    if(container) container.innerHTML=renderDetailPanel(_currentDetailEvent.id);
  }
};

window._spOpenDetail=function(eventId){
  _currentDetailTab='overview';
  var main=document.getElementById('spMainContent');
  if(!main) return;
  var ev=tumorEvents.find(function(e){return e.id===eventId});
  if(!ev) return;
  main.innerHTML='<div style="margin-bottom:14px"><button class="btn btn-ghost btn-sm" onclick="renderSpecialtyPortrait()">← 返回列表</button></div>'+
    '<div class="panel" style="margin-bottom:16px"><div class="panel-body" style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">'+
    '<div style="font-size:var(--fs-h1);font-weight:700;color:var(--color-text-title)">'+esc(ev.patient)+'</div>'+
    '<div style="font-size:var(--fs-body);color:var(--color-text-muted)">'+esc(ev.sex)+' · '+ev.age+'岁 · '+esc(ev.idNo)+'</div>'+
    badge(ev.diagnosis,'badge-info')+badge(ev.stage,'badge-neutral')+badge(ev.phase,ev.phase==='治疗中'?'badge-info':ev.phase==='随访中'?'badge-success':'badge-danger')+
    '<div style="margin-left:auto">'+scoreDot(ev.qcScore)+'</div>'+
    '</div></div>'+
    '<div id="spDetailContainer">'+renderDetailPanel(eventId)+'</div>';
};

/* ===================== 主渲染入口 ===================== */
var _spCurrentSubPage = 'workbench';

function render(subPage){
  if(subPage){_spCurrentSubPage=subPage;}
  
  // Header and Tabs UI removed per user request, but logic preserved for left-nav switching
  var content='';
  if(_spCurrentSubPage==='workbench') content=renderWorkbench();
  else if(_spCurrentSubPage==='qc') content=renderQC();
  else if(_spCurrentSubPage==='stats') content=renderStats();

  return '<div style="padding:0"><div id="spMainContent">'+content+'</div></div>';
}

window._spSwitchSubPage=function(page){
  _spCurrentSubPage=page;
  var pc=document.getElementById('pageContainer');
  if(pc){pc.innerHTML=render();}
  if(typeof updateBreadcrumb==='function')updateBreadcrumb('specialty-portrait',page==='qc'?'画像质控':page==='stats'?'画像统计':'画像工作台');
  if(typeof setActiveMenu==='function'){var menuId=page==='qc'?'sp-qc':page==='stats'?'sp-stats':'sp-workbench';setActiveMenu(menuId);}
};

window.renderSpecialtyPortrait=render;
})();

