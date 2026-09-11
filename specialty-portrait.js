/* 肿瘤专科画像 V5 - 前端重构版 (江西11设区市 + 患者详情10类记录页签 + 肿瘤个案统计指标) */
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
.sp-chart-body{display:flex;align-items:center;gap:20px;min-height:220px;padding:6px 2px}
.sp-pie{position:relative;width:160px;height:160px;flex:0 0 160px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(15,23,42,.06)}
.sp-pie-center{position:absolute;inset:34%;background:var(--surface);border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:var(--font-num);font-weight:700;font-size:var(--fs-body);color:var(--color-text-title);box-shadow:inset 0 0 0 1px rgba(15,23,42,.05)}
.sp-pie-center small{font-size:var(--fs-xs);font-weight:500;color:var(--color-text-muted)}
.sp-legend{display:flex;flex-direction:column;gap:9px;font-size:var(--fs-sm);flex:1;min-width:0}
.sp-legend-item{display:flex;align-items:center;gap:8px;color:var(--color-text-body)}
.sp-legend-dot{width:10px;height:10px;border-radius:3px;flex:0 0 10px}
.sp-legend-val{margin-left:auto;font-family:var(--font-num);font-weight:700;color:var(--color-text-title)}
.sp-legend-pct{font-size:var(--fs-xs);color:var(--color-text-muted);width:42px;text-align:right;font-family:var(--font-num)}
.sp-vbars{display:flex;align-items:flex-end;gap:20px;height:220px;padding:14px 8px 0;flex:1}
.sp-vbar{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;min-width:0}
.sp-vbar-num{font-size:var(--fs-xs);font-weight:700;color:var(--color-text-title);margin-bottom:5px;font-family:var(--font-num)}
.sp-vbar-fill{width:100%;max-width:48px;border-radius:6px 6px 0 0;background:linear-gradient(180deg,#60a5fa,#2563eb)}
.sp-vbar-lab{font-size:var(--fs-xs);color:var(--color-text-muted);margin-top:8px;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sp-stack-wrap{flex:1;display:flex;flex-direction:column;gap:16px;min-width:0;padding:6px 2px}
.sp-stack-bar{display:flex;height:32px;border-radius:8px;overflow:hidden;background:var(--color-bg-subtle)}
.sp-stack-seg{display:flex;align-items:center;justify-content:center;color:#fff;font-size:var(--fs-xs);font-weight:700;font-family:var(--font-num);min-width:0}
.sp-hbars{flex:1;display:flex;flex-direction:column;gap:13px;min-width:0;padding:10px 2px}
.sp-hbar-row{display:flex;align-items:center;gap:10px}
.sp-hbar-lab{width:58px;flex:0 0 58px;text-align:right;font-size:var(--fs-sm);color:var(--color-text-body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sp-hbar-track{flex:1;height:16px;background:var(--color-bg-subtle);border-radius:8px;overflow:hidden}
.sp-hbar-fill{height:100%;border-radius:8px;background:linear-gradient(90deg,#2563eb,#60a5fa)}
.sp-hbar-num{width:26px;flex:0 0 26px;font-size:var(--fs-sm);font-weight:700;color:var(--color-text-title);font-family:var(--font-num)}
.sp-chart-empty{height:220px;display:flex;align-items:center;justify-content:center;color:var(--color-text-muted);font-size:var(--fs-sm)}
/* ---- 患者详情：记录页签栏（对齐参考界面的顶部记录条） ---- */
.sp-detail-shell{min-width:0}
.sp-detail-back{display:flex;align-items:center;margin-bottom:10px}
.sp-patient-strip{display:grid;grid-template-columns:auto minmax(240px,1.25fr) minmax(300px,1fr) auto;align-items:center;gap:14px;padding:12px 16px;margin-bottom:12px;background:var(--surface);border:1px solid var(--color-border);border-radius:var(--radius-md);box-shadow:var(--shadow-xs)}
.sp-patient-avatar{width:42px;height:42px;border-radius:50%;background:var(--color-primary-soft);color:var(--color-primary);display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:700}
.sp-patient-name{display:flex;align-items:baseline;gap:10px;min-width:0;font-size:var(--fs-h2);font-weight:700;color:var(--color-text-title)}
.sp-patient-meta{font-size:var(--fs-xs);font-weight:500;color:var(--color-text-muted);white-space:nowrap}
.sp-patient-sub{margin-top:3px;font-size:var(--fs-xs);color:var(--color-text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sp-patient-badges{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.sp-patient-score{text-align:right;min-width:50px}
.sp-patient-score .k{font-size:var(--fs-2xs);color:var(--color-text-muted)}
.sp-patient-score .v{font-size:24px;font-weight:700;font-family:var(--font-num);color:var(--color-primary);line-height:1.05}
.sp-rec-nav{display:flex;flex-wrap:nowrap;gap:0;overflow-x:auto;scrollbar-width:thin;border-bottom:1px solid var(--color-border);margin-bottom:16px;background:var(--surface)}
.sp-rec-tab{position:relative;flex:0 0 auto;padding:11px 16px;border:0;background:transparent;color:var(--color-text-body);cursor:pointer;font-size:var(--fs-body);font-weight:500;white-space:nowrap;transition:color var(--dur-fast),background var(--dur-fast)}
.sp-rec-tab:hover{color:var(--color-primary);background:var(--color-primary-soft)}
.sp-rec-tab.active{color:var(--color-primary);font-weight:700}
.sp-rec-tab.active::after{content:"";position:absolute;left:14px;right:14px;bottom:-1px;height:2px;background:var(--color-primary);border-radius:2px}
.sp-rec-tab .cnt{display:inline-block;margin-left:5px;min-width:16px;padding:0 4px;height:16px;line-height:16px;border-radius:8px;background:var(--color-bg-subtle);color:var(--color-text-muted);font-size:var(--fs-2xs);font-family:var(--font-num);font-weight:700;text-align:center}
.sp-rec-tab.active .cnt{background:var(--color-primary-soft);color:var(--color-primary)}
/* ---- 患者档案表单（基本信息 / 地址信息 / 联系人信息 / 其他信息） ---- */
.spf-actions{display:flex;justify-content:flex-end;gap:8px;margin-bottom:8px}
.spf-section{background:var(--surface);margin-bottom:22px}
.spf-sec-head{display:flex;align-items:center;gap:7px;min-height:28px;padding:0 0 8px;border-bottom:1px solid var(--color-border);cursor:pointer;user-select:none}
.spf-section.collapsed .spf-sec-head{border-bottom-color:var(--color-border)}
.spf-caret{width:0;height:0;border-left:5px solid var(--color-text-muted);border-top:4px solid transparent;border-bottom:4px solid transparent;transition:transform var(--dur-fast) var(--ease-in-out);flex:0 0 5px}
.spf-section:not(.collapsed) .spf-caret{transform:rotate(90deg) translateX(1px)}
.spf-sec-icon{width:15px;height:15px;flex:0 0 15px;border-radius:3px;background:var(--color-primary);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:700}
.spf-sec-title{font-size:var(--fs-body);font-weight:700;color:var(--color-primary);letter-spacing:0}
.spf-sec-tools{margin-left:auto;display:flex;gap:8px;align-items:center}
.spf-body{padding:14px 16px 0}
.spf-section.collapsed .spf-body{display:none}
.spf-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px 26px}
.spf-item{display:flex;align-items:center;gap:10px;min-width:0}
.spf-item.span2{grid-column:span 2}
.spf-item.span3{grid-column:1/-1}
.spf-item.area{align-items:flex-start}
.spf-label{flex:0 0 92px;text-align:right;font-size:var(--fs-sm);color:var(--color-text-body);white-space:nowrap}
.spf-label .req{color:var(--color-danger-solid);margin-right:2px}
.spf-ctrl{flex:1;min-width:0}
.spf-ctrl input:not([type=checkbox]):not([type=radio]),.spf-ctrl select,.spf-ctrl textarea{width:100%;min-width:0;height:34px;padding:0 10px;border:1px solid var(--color-border-strong);border-radius:var(--radius-xs);background:var(--surface);color:var(--color-text-title);font-size:var(--fs-body);box-sizing:border-box;transition:border-color var(--dur-fast),box-shadow var(--dur-fast)}
.spf-ctrl textarea{height:auto;min-height:66px;padding:8px 10px;resize:vertical;line-height:1.6}
.spf-ctrl input:focus,.spf-ctrl select:focus,.spf-ctrl textarea:focus{outline:0;border-color:var(--color-primary);box-shadow:var(--shadow-focus)}
.spf-ctrl input[readonly],.spf-ctrl select[disabled],.spf-ctrl textarea[readonly]{background:var(--color-gray-25);border-color:var(--color-border);color:var(--color-text-title);cursor:default}
.spf-ctrl input[readonly]:focus,.spf-ctrl textarea[readonly]:focus{border-color:var(--color-border-strong);box-shadow:none}
.spf-ctrl input::placeholder,.spf-ctrl textarea::placeholder{color:var(--color-text-placeholder)}
.spf-ctrl select{appearance:none;-webkit-appearance:none;padding-right:24px;background-image:linear-gradient(45deg,transparent 50%,var(--color-text-muted) 50%),linear-gradient(135deg,var(--color-text-muted) 50%,transparent 50%);background-position:calc(100% - 13px) 15px,calc(100% - 8px) 15px;background-size:5px 5px,5px 5px;background-repeat:no-repeat}
.spf-region{display:flex;gap:6px;flex-wrap:wrap}
.spf-region select{flex:1 1 84px;min-width:0}
.spf-tags{display:flex;flex-wrap:wrap;gap:6px;align-items:center;min-height:34px;padding:5px 8px;border:1px solid var(--color-border-strong);border-radius:var(--radius-xs);background:var(--color-gray-25)}
.spf-form-actions{display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid var(--color-border);background:var(--color-gray-25)}
/* ---- 记录面板通用 ---- */
.spr-toolbar{display:flex;gap:10px 12px;align-items:flex-end;flex-wrap:wrap;padding:12px 14px;background:var(--color-bg-subtle);border:1px solid var(--color-border);border-radius:var(--radius-md);margin-bottom:12px}
.spr-toolbar .form-group{min-width:0;flex:0 0 auto;width:180px}
.spr-toolbar .form-group.search{flex:1 1 200px;min-width:160px;max-width:260px}
.spr-toolbar .form-group.search input{width:100%}
.spr-toolbar .spr-actions{margin-left:auto;display:flex;gap:8px;flex:0 0 auto}
.spr-count{font-size:var(--fs-xs);color:var(--color-text-muted);font-weight:400;margin-left:8px}
.spr-empty{padding:34px 12px;text-align:center;color:var(--color-text-muted);font-size:var(--fs-sm)}
.spr-cellwrap{max-width:300px;white-space:normal;line-height:1.55}
.spr-op .btn{margin-right:4px}
.spr-op .btn:last-child{margin-right:0}
/* MDT 卡片 */
.spm-list{display:flex;flex-direction:column;gap:12px}
.spm-card{border:1px solid var(--color-border);border-left:3px solid var(--color-primary);border-radius:var(--radius-md);background:var(--surface);overflow:hidden}
.spm-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:11px 14px;background:var(--color-gray-25);border-bottom:1px solid var(--color-border)}
.spm-topic{font-size:var(--fs-h3);font-weight:700;color:var(--color-text-title)}
.spm-date{font-size:var(--fs-sm);color:var(--color-text-muted);font-family:var(--font-num)}
.spm-host{font-size:var(--fs-sm);color:var(--color-text-body)}
.spm-body{padding:12px 14px;display:grid;grid-template-columns:88px 1fr;gap:8px 10px;font-size:var(--fs-sm)}
.spm-body dt{color:var(--color-text-muted);text-align:right}
.spm-body dd{color:var(--color-text-body);line-height:1.6}
/* 康复签约 */
.sph-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px 18px;padding:14px 16px}
.sph-item{display:flex;gap:8px;font-size:var(--fs-sm);min-width:0}
.sph-item .k{color:var(--color-text-muted);flex:0 0 auto}
.sph-item .v{color:var(--color-text-title);font-weight:600;min-width:0}
.sph-services{display:flex;flex-wrap:wrap;gap:8px;padding:0 16px 14px}
.sph-services span{display:inline-flex;align-items:center;height:26px;padding:0 10px;border-radius:var(--radius-pill);background:var(--color-primary-soft);color:var(--color-primary);font-size:var(--fs-xs);font-weight:600}
.sph-services span:before{content:"✓";margin-right:4px;font-size:10px}
/* 详情弹窗 */
#pageContainer .sp-modal-mask{position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;z-index:1200;padding:24px}
#pageContainer .sp-modal{background:var(--surface);border-radius:var(--radius-lg);width:min(860px,100%);max-height:88vh;display:flex;flex-direction:column;box-shadow:var(--shadow-lg)}
#pageContainer .sp-modal.narrow{width:min(620px,100%)}
#pageContainer .sp-modal-head{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--color-border)}
#pageContainer .sp-modal-title{font-size:var(--fs-h2);font-weight:700;color:var(--color-text-title)}
#pageContainer .sp-modal-close{width:30px;height:30px;border:0;border-radius:var(--radius-xs);background:transparent;color:var(--color-text-muted);cursor:pointer;font-size:20px;line-height:1}
#pageContainer .sp-modal-close:hover{background:var(--color-bg-subtle);color:var(--color-danger-solid)}
#pageContainer .sp-modal-body{padding:16px 18px;overflow:auto}
#pageContainer .sp-modal-foot{display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid var(--color-border);background:var(--color-gray-25)}
.spd-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 22px}
.spd-row{display:flex;gap:10px;padding:9px 0;border-bottom:1px dashed var(--color-border);font-size:var(--fs-sm)}
.spd-row .k{flex:0 0 96px;text-align:right;color:var(--color-text-muted)}
.spd-row .v{flex:1;min-width:0;color:var(--color-text-title);font-weight:500;line-height:1.6;white-space:normal}
.spd-row.full{grid-column:1/-1}
.spf-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 20px}
.spf-form-grid .spf-item.span2{grid-column:1/-1}
@media(max-width:1280px){.sp-patient-strip{grid-template-columns:auto minmax(220px,1fr) auto}.sp-patient-badges{grid-column:2/3}.sp-patient-score{grid-column:3;grid-row:1/3}.spf-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.spf-item.span3{grid-column:1/-1}}
@media(max-width:820px){.sp-patient-strip{grid-template-columns:auto 1fr}.sp-patient-badges{grid-column:1/-1}.sp-patient-score{grid-column:2;grid-row:1}.spf-grid,.spd-grid,.spf-form-grid{grid-template-columns:1fr}.spf-item.span2,.spf-item.span3{grid-column:1/-1}.spf-label{flex:0 0 84px}.sp-rec-tab{padding:9px 12px;font-size:var(--fs-sm)}}
@media(max-width:1200px){.sp-stat-row{grid-template-columns:repeat(2,1fr)}}
@media(max-width:768px){.sp-stat-row{grid-template-columns:1fr}.sp-filter-bar{flex-direction:column}.sp-filter-bar .form-group,.sp-filter-bar .form-group.wide{width:100%}.sp-filter-actions{margin-left:0;width:100%}}
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

/* ===================== 患者档案 + 各类记录 Mock ===================== */
/* 档案字段严格对齐参考界面：基本信息 / 地址信息 / 联系人信息 / 其他信息 */
var patientProfiles = {
  TE001:{name:'陈建国',sex:'男',birth:'1963-05-12',idNo:'360102196305121234',phone:'139****7426',otherNo:'ZY2026011842',crowd:'城镇居民',status:'住院管理中',tags:['高危人群','吸烟史≥30年','职工医保','肺结节史'],region:'江西省 / 南昌市 / 东湖区 / 董家窑街道 / 民巷社区',address:'东湖区阳明路128号3栋2单元501室',contact:'陈慧',contactRel:'子女',contactPhone:'137****8812',remark:'患者长期吸烟，戒烟依从性一般；家属可配合随访，通讯畅通。',archiveDate:'2026-01-18',source:'社区筛查',lastScreen:'2026-06-18'},
  TE002:{name:'陈建国',sex:'男',birth:'1963-05-12',idNo:'360102196305121234',phone:'139****7426',otherNo:'MY2025110307',crowd:'城镇居民',status:'居家随访中',tags:['既往恶性肿瘤','术后随访'],region:'江西省 / 南昌市 / 东湖区 / 董家窑街道 / 民巷社区',address:'东湖区阳明路128号3栋2单元501室',contact:'陈慧',contactRel:'子女',contactPhone:'137****8812',remark:'升结肠癌术后，与肺癌个案共用同一居民健康档案。',archiveDate:'2025-11-03',source:'医院登记',lastScreen:'2026-03-12'},
  TE003:{name:'刘雅琴',sex:'女',birth:'1978-08-15',idNo:'360702197808152345',phone:'135****6073',otherNo:'MZ2026032215',crowd:'城镇职工',status:'门诊治疗中',tags:['两癌筛查','乳腺癌家族史'],region:'江西省 / 赣州市 / 章贡区 / 南外街道 / 营角上社区',address:'章贡区红旗大道46号金厦花园2栋1802室',contact:'周建平',contactRel:'配偶',contactPhone:'136****4419',remark:'母亲及姨妈均有乳腺癌病史，患者内分泌治疗耐受良好。',archiveDate:'2026-03-22',source:'社区筛查',lastScreen:'2026-03-20'},
  TE004:{name:'赵德顺',sex:'男',birth:'1955-02-28',idNo:'360402195502283456',phone:'150****2237',otherNo:'ZY2026071009',crowd:'农村居民',status:'住院管理中',tags:['高危人群','重度营养不良','城乡居民医保'],region:'江西省 / 九江市 / 浔阳区 / 甘棠街道 / 白水湖社区',address:'浔阳区庐峰东路12巷7号',contact:'赵磊',contactRel:'子女',contactPhone:'188****3065',remark:'患者独居农村户籍，子女在九江市区务工，随访需电话+上门结合。',archiveDate:'2026-07-10',source:'医院登记',lastScreen:'2026-07-08'}
};

/* 评估记录：营养 / VTE / 疼痛 / 心理 / 跌倒 / 功能状态 等量表 */
var assessRecords = {
  TE001:[
    {date:'2026-08-21',type:'营养风险',tool:'NRS2002',score:'4分',level:'中度风险',cls:'badge-orange',assessor:'营养科 徐敏',advice:'口服营养补充（ONS）400kcal/d，2周后复评'},
    {date:'2026-08-21',type:'VTE血栓',tool:'Caprini',score:'6分',level:'高危',cls:'badge-danger',assessor:'主管医师 张涛',advice:'低分子肝素预防抗凝 + 间歇充气加压装置'},
    {date:'2026-08-19',type:'疼痛',tool:'NRS',score:'3分',level:'轻度',cls:'badge-caution',assessor:'责任护士 李芳',advice:'按三阶梯给药，爆发痛临时处理'},
    {date:'2026-08-19',type:'心理痛苦',tool:'PHQ-9',score:'9分',level:'可疑抑郁',cls:'badge-info',assessor:'心理门诊 王琳',advice:'转心理科评估，家属同步宣教'},
    {date:'2026-08-18',type:'跌倒风险',tool:'Morse',score:'30分',level:'低危',cls:'badge-success',assessor:'责任护士 李芳',advice:'常规防跌倒宣教'},
    {date:'2026-08-18',type:'功能状态',tool:'ECOG/KPS',score:'ECOG 1 / KPS 80',level:'可耐受化疗',cls:'badge-success',assessor:'主管医师 张涛',advice:'维持当前免疫联合化疗强度'}
  ],
  TE002:[
    {date:'2026-03-12',type:'营养风险',tool:'NRS2002',score:'2分',level:'无风险',cls:'badge-success',assessor:'营养科 徐敏',advice:'常规膳食指导'},
    {date:'2026-03-12',type:'疼痛',tool:'NRS',score:'1分',level:'轻度',cls:'badge-caution',assessor:'责任护士 李芳',advice:'腹部隐痛观察，无需镇痛'},
    {date:'2026-03-11',type:'功能状态',tool:'ECOG/KPS',score:'ECOG 0 / KPS 90',level:'正常活动',cls:'badge-success',assessor:'主管医师 张涛',advice:'结束辅助化疗，转入随访'}
  ],
  TE003:[
    {date:'2026-08-25',type:'心理痛苦',tool:'PHQ-9',score:'12分',level:'中度焦虑抑郁',cls:'badge-orange',assessor:'心理门诊 王琳',advice:'每周1次心理支持，必要时药物干预'},
    {date:'2026-08-25',type:'营养风险',tool:'NRS2002',score:'2分',level:'无风险',cls:'badge-success',assessor:'营养科 徐敏',advice:'增加钙与维生素D摄入'},
    {date:'2026-08-24',type:'功能状态',tool:'ECOG/KPS',score:'ECOG 0 / KPS 90',level:'正常活动',cls:'badge-success',assessor:'主管医师 刘颖',advice:'继续TC方案后内分泌维持'},
    {date:'2026-08-24',type:'跌倒风险',tool:'Morse',score:'25分',level:'低危',cls:'badge-success',assessor:'责任护士 陈红',advice:'常规宣教'}
  ],
  TE004:[
    {date:'2026-08-27',type:'营养风险',tool:'NRS2002',score:'6分',level:'高度风险',cls:'badge-danger',assessor:'营养科 徐敏',advice:'空肠营养管置入，肠内+肠外联合支持'},
    {date:'2026-08-27',type:'跌倒风险',tool:'Morse',score:'65分',level:'高风险',cls:'badge-danger',assessor:'责任护士 周燕',advice:'床栏+防滑鞋+专人陪护，床头警示'},
    {date:'2026-08-26',type:'VTE血栓',tool:'Caprini',score:'7分',level:'高危',cls:'badge-danger',assessor:'主管医师 吴强',advice:'低分子肝素抗凝，每日下肢周径监测'},
    {date:'2026-08-26',type:'疼痛',tool:'NRS',score:'6分',level:'中度',cls:'badge-orange',assessor:'责任护士 周燕',advice:'吗啡缓释片滴定，24h疼痛复评'},
    {date:'2026-08-25',type:'心理痛苦',tool:'PHQ-9',score:'15分',level:'中度抑郁',cls:'badge-orange',assessor:'心理门诊 王琳',advice:'精神科会诊，家属沟通治疗目标'},
    {date:'2026-08-25',type:'压疮风险',tool:'Braden',score:'12分',level:'中危',cls:'badge-caution',assessor:'责任护士 周燕',advice:'每2小时翻身，气垫床使用'},
    {date:'2026-08-24',type:'功能状态',tool:'ECOG/KPS',score:'ECOG 2 / KPS 60',level:'生活部分自理',cls:'badge-caution',assessor:'主管医师 吴强',advice:'减量方案，加强支持治疗'}
  ]
};

/* MDT 记录 */
var mdtRecords = {
  TE001:[
    {date:'2026-02-05',topic:'初诊分期与治疗策略',host:'肿瘤内科 张涛',depts:'胸外科 / 放疗科 / 影像科 / 病理科 / 营养科',opinion:'IIIB期，EGFR/ALK阴性，PD-L1 TPS 45%，初始不可手术',plan:'免疫联合含铂化疗4周期后重新评估手术可行性',status:'执行中',cls:'badge-info'},
    {date:'2026-06-20',topic:'疗效再评估与换线讨论',host:'肿瘤内科 张涛',depts:'胸外科 / 放疗科 / 影像科 / 核医学科',opinion:'2周期后评价PR，纵隔淋巴结代谢明显下降，仍不满足R0切除',plan:'继续免疫+化疗至4周期，同步评估放疗时机',status:'已完成',cls:'badge-success'},
    {date:'2026-08-22',topic:'营养与VTE共管',host:'营养科 徐敏',depts:'主管医师 / 护理团队 / 药学部',opinion:'NRS2002 4分，Caprini 6分，存在治疗中断风险',plan:'ONS强化 + 低分子肝素预防，每周联合查房',status:'执行中',cls:'badge-info'}
  ],
  TE002:[
    {date:'2025-11-06',topic:'结肠癌手术方案讨论',host:'胃肠外科 罗刚',depts:'肿瘤内科 / 影像科 / 病理科 / 麻醉科',opinion:'cT3N0M0，无远处转移，可直接行腹腔镜根治术',plan:'腹腔镜右半结肠根治术 + XELOX辅助化疗',status:'已完成',cls:'badge-success'}
  ],
  TE003:[
    {date:'2026-03-26',topic:'乳腺癌保乳可行性讨论',host:'乳腺外科 刘颖',depts:'肿瘤内科 / 放疗科 / 超声科 / 病理科 / 整形外科',opinion:'IIB期，肿瘤位于外上象限，肿瘤/乳房体积比适宜',plan:'改良根治术 + TC×4辅助化疗 + 内分泌维持',status:'已完成',cls:'badge-success'},
    {date:'2026-08-26',topic:'内分泌治疗耐受与心理支持',host:'肿瘤内科 刘颖',depts:'内分泌科 / 心理科 / 护理团队',opinion:'他莫昔芬耐受良好，PHQ-9 12分提示中度焦虑抑郁',plan:'加用心理干预，骨密度基线检查，6个月复查',status:'执行中',cls:'badge-info'}
  ],
  TE004:[
    {date:'2026-07-12',topic:'胃癌 IV 期治疗目标设定',host:'肿瘤内科 吴强',depts:'胃肠外科 / 放疗科 / 影像科 / 营养科 / 姑医学科',opinion:'IV期伴腹膜转移及腹水，无根治性手术指征',plan:'两线全身治疗 + 腹腔热灌注评估 + 早期营养通路建立',status:'已完成',cls:'badge-success'},
    {date:'2026-08-24',topic:'三线方案与最佳支持治疗',host:'肿瘤内科 吴强',depts:'姑医学科 / 营养科 / 疼痛科 / 心理科 / 护理团队',opinion:'第3线治疗中，ECOG 2，疼痛NRS 6分，营养高度风险',plan:'纳武利尤单抗+减量化疗，同步镇痛与肠内营养，明确DNR意愿',status:'执行中',cls:'badge-danger'}
  ]
};

/* 远程会诊记录 */
var consultRecords = {
  TE001:[
    {no:'RC2026021001',applyDate:'2026-02-10',hospital:'复旦大学附属肿瘤医院',expert:'呼吸内科 胡教授',way:'视频会诊',opinion:'同意IIIB期局部晚期诊断，建议免疫联合化疗后再评估降期手术',status:'已完成',cls:'badge-success'},
    {no:'RC2026070502',applyDate:'2026-07-05',hospital:'江西省肿瘤医院',expert:'胸部肿瘤 MDT 组',way:'图文会诊',opinion:'PR后建议维持原方案，放疗时机在4周期后重评',status:'已完成',cls:'badge-success'}
  ],
  TE002:[
    {no:'RC2025120801',applyDate:'2025-12-08',hospital:'江西省肿瘤医院',expert:'胃肠外科 陈主任',way:'图文会诊',opinion:'术后病理 pT3N0M0，建议 XELOX 8周期辅助化疗',status:'已完成',cls:'badge-success'}
  ],
  TE003:[
    {no:'RC2026040201',applyDate:'2026-04-02',hospital:'中国医学科学院肿瘤医院',expert:'乳腺内科 王教授',way:'视频会诊',opinion:'HR阳性HER2阴性，化疗后内分泌治疗为主，无需强化靶向',status:'已完成',cls:'badge-success'},
    {no:'RC2026082802',applyDate:'2026-08-28',hospital:'江西省肿瘤医院',expert:'乳腺科 李主任',way:'图文会诊',opinion:'待回复：请协助评估卵巢功能抑制必要性',status:'待受理',cls:'badge-caution'}
  ],
  TE004:[
    {no:'RC2026071801',applyDate:'2026-07-18',hospital:'中山大学肿瘤防治中心',expert:'胃部肿瘤 黄教授',way:'视频会诊',opinion:'腹膜转移负荷较高，建议全身治疗为主，HIPEC仅在转化成功后考虑',status:'已完成',cls:'badge-success'},
    {no:'RC2026082002',applyDate:'2026-08-20',hospital:'江西省肿瘤医院',expert:'姑息医学科 孙主任',way:'图文会诊',opinion:'建议镇痛方案升级为缓释阿片并联合辅助用药',status:'已回复',cls:'badge-info'}
  ]
};

/* 转诊记录 */
var referralRecords = {
  TE001:[
    {no:'ZR2026012001',dir:'上转',from:'东湖区董家窑街道社区卫生服务中心',to:'南昌市第一医院',reason:'CT提示肺结节Lung-RADS 4B，需穿刺活检明确性质',applyDate:'2026-01-20',acceptDate:'2026-01-21',status:'已接收',cls:'badge-success'},
    {no:'ZR2026020102',dir:'上转',from:'南昌市第一医院',to:'江西省肿瘤医院',reason:'确诊右肺上叶腺癌 IIIB期，需免疫联合化疗及MDT',applyDate:'2026-02-01',acceptDate:'2026-02-02',status:'已接收',cls:'badge-success'},
    {no:'ZR2026090103',dir:'下转',from:'江西省肿瘤医院',to:'东湖区董家窑街道社区卫生服务中心',reason:'治疗稳定期，下转社区做营养与用药随访',applyDate:'2026-09-01',acceptDate:'—',status:'待接收',cls:'badge-caution'}
  ],
  TE002:[
    {no:'ZR2025110501',dir:'上转',from:'东湖区社区卫生服务中心',to:'南昌市第一医院',reason:'便血+肠镜占位，需手术治疗',applyDate:'2025-11-05',acceptDate:'2025-11-05',status:'已接收',cls:'badge-success'},
    {no:'ZR2026032002',dir:'下转',from:'南昌市第一医院',to:'东湖区董家窑街道社区卫生服务中心',reason:'辅助化疗结束，转社区常规随访',applyDate:'2026-03-20',acceptDate:'2026-03-21',status:'已接收',cls:'badge-success'}
  ],
  TE003:[
    {no:'ZR2026032101',dir:'上转',from:'章贡区南外街道社区卫生服务中心',to:'赣州市人民医院',reason:'两癌筛查乳腺BI-RADS 5，需穿刺确诊',applyDate:'2026-03-21',acceptDate:'2026-03-21',status:'已接收',cls:'badge-success'},
    {no:'ZR2026061002',dir:'上转',from:'赣州市人民医院',to:'江西省肿瘤医院',reason:'术后化疗期间出现静脉通路问题',applyDate:'2026-06-10',acceptDate:'2026-06-11',status:'已接收',cls:'badge-success'},
    {no:'ZR2026090203',dir:'下转',from:'江西省肿瘤医院',to:'章贡区南外街道社区卫生服务中心',reason:'进入内分泌维持期，社区季度随访',applyDate:'2026-09-02',acceptDate:'—',status:'待接收',cls:'badge-caution'}
  ],
  TE004:[
    {no:'ZR2026070901',dir:'上转',from:'浔阳区甘棠街道卫生院',to:'九江市第一人民医院',reason:'上消化道出血伴消瘦，需急诊胃镜',applyDate:'2026-07-09',acceptDate:'2026-07-09',status:'已接收',cls:'badge-success'},
    {no:'ZR2026071102',dir:'上转',from:'九江市第一人民医院',to:'江西省肿瘤医院',reason:'胃窦低分化腺癌 IV期，需全身治疗',applyDate:'2026-07-11',acceptDate:'2026-07-12',status:'已接收',cls:'badge-success'},
    {no:'ZR2026082803',dir:'下转',from:'江西省肿瘤医院',to:'浔阳区甘棠街道卫生院',reason:'拟下转做居家安宁疗护与上门护理',applyDate:'2026-08-28',acceptDate:'—',status:'已退回',cls:'badge-danger'}
  ]
};

/* 病理记录 */
var pathRecords = {
  TE001:[
    {no:'BJ26F00412',submitDate:'2026-01-26',reportDate:'2026-01-29',specimen:'CT引导经皮肺穿刺（右肺上叶后段）',diagnosis:'（右肺上叶）浸润性腺癌，腺泡型+乳头型',grade:'中分化',ihc:'CK7(+) TTF-1(+) NapsinA(+) Ki-67 25% P40(-)',molecular:'EGFR/ALK/ROS1 均野生型；PD-L1 TPS 45%',doctor:'病理科 高军',status:'已审核',cls:'badge-success'}
  ],
  TE002:[
    {no:'BJ25F12087',submitDate:'2025-11-12',reportDate:'2025-11-16',specimen:'腹腔镜右半结肠切除标本',diagnosis:'（升结肠）腺癌，侵及浆膜下，未见血管淋巴管侵犯',grade:'中-高分化',ihc:'CK20(+) CDX2(+) MLH1(+) PMS2(+) MSH6(+) MSH2(+)',molecular:'MSI稳定（MSS）；KRAS/NRAS/BRAF 野生型',doctor:'病理科 高军',status:'已审核',cls:'badge-success'}
  ],
  TE003:[
    {no:'BJ26F03341',submitDate:'2026-03-24',reportDate:'2026-03-27',specimen:'超声引导下左乳空芯针穿刺',diagnosis:'（左乳）浸润性非特殊类型导管癌，组织学II级',grade:'II级',ihc:'ER 85%(+) PR 70%(+) HER2 1+(+) Ki-67 15%',molecular:'Oncotype DX 复发评分 18（低-中危）',doctor:'病理科 龚丽',status:'已审核',cls:'badge-success'},
    {no:'BJ26F04022',submitDate:'2026-04-08',reportDate:'2026-04-12',specimen:'左乳改良根治标本 + 前哨淋巴结3枚',diagnosis:'残留浸润癌灶 0.9cm，前哨淋巴结 1/3 微转移',grade:'II级',ihc:'ER 80%(+) PR 65%(+) HER2 1+',molecular:'未行',doctor:'病理科 龚丽',status:'已审核',cls:'badge-success'}
  ],
  TE004:[
    {no:'BJ26F07215',submitDate:'2026-07-09',reportDate:'2026-07-12',specimen:'胃镜活检（胃窦大弯侧）',diagnosis:'（胃窦）低分化腺癌，部分为印戒细胞癌',grade:'低分化',ihc:'CK(+) EMA(+) CDX2(+) Ki-67 55% HER2 0',molecular:'CLDN18.2 阴性；PD-L1 CPS 3；MSI-L',doctor:'病理科 龚丽',status:'已审核',cls:'badge-success'},
    {no:'BJ26F08320',submitDate:'2026-08-26',reportDate:'2026-08-29',specimen:'腹腔积液细胞学',diagnosis:'找到腺癌细胞，符合胃来源',grade:'—',ihc:'—',molecular:'—',doctor:'病理科 龚丽',status:'待审核',cls:'badge-caution'}
  ]
};

/* 随访记录 */
var followupRecords = {
  TE001:[
    {date:'2026-08-25',way:'门诊随访',survival:'存活',status:'治疗中，病灶缩小',exam:'增强CT：病灶缩小18%；血常规、肝肾功能基本正常',next:'2026-09-25 第4周期前复查',nurse:'李芳'},
    {date:'2026-06-25',way:'电话随访',survival:'存活',status:'第2周期化疗后骨髓抑制I度',exam:'WBC 3.4×10⁹/L，已口服升白治疗',next:'2026-07-01 门诊复查',nurse:'李芳'},
    {date:'2026-04-20',way:'门诊随访',survival:'存活',status:'免疫联合化疗耐受良好',exam:'ECOG 1，体重较前增加1.2kg',next:'2026-06-18 PET-CT评估',nurse:'李芳'}
  ],
  TE002:[
    {date:'2026-03-12',way:'门诊随访',survival:'存活',status:'辅助化疗完成8周期，未见复发',exam:'肠镜吻合口光滑；CEA 3.1 正常',next:'2026-09-12 半年复查',nurse:'李芳'},
    {date:'2025-12-15',way:'住院随访',survival:'存活',status:'术后恢复顺利，切口愈合良好',exam:'腹部CT未见复发转移征象',next:'2026-01-10 启动第1周期化疗',nurse:'王婷'}
  ],
  TE003:[
    {date:'2026-08-24',way:'门诊随访',survival:'存活',status:'TC方案完成，转内分泌维持',exam:'乳腺MRI病灶缩小；肝肾功能正常',next:'2026-11-24 季度复查',nurse:'陈红'},
    {date:'2026-06-20',way:'门诊随访',survival:'存活',status:'第3周期化疗后白细胞下降',exam:'WBC 2.9×10⁹/L，G-CSF处理后恢复',next:'2026-07-15 第4周期',nurse:'陈红'},
    {date:'2026-05-10',way:'电话随访',survival:'存活',status:'脱发、恶心，对症处理可缓解',exam:'未行检查',next:'2026-05-20 门诊',nurse:'陈红'}
  ],
  TE004:[
    {date:'2026-08-27',way:'住院随访',survival:'存活',status:'第3线治疗中，疼痛较前缓解',exam:'NRS 6→4分；白蛋白 28g/L，营养风险高',next:'2026-09-10 复评疗效',nurse:'周燕'},
    {date:'2026-07-30',way:'门诊随访',survival:'存活',status:'第1周期免疫联合化疗后乏力',exam:'ECOG 2，腹水量较前减少',next:'2026-08-15 门诊',nurse:'周燕'},
    {date:'2026-07-15',way:'电话随访',survival:'存活',status:'确诊后家属沟通治疗目标',exam:'未行检查',next:'2026-07-20 住院',nurse:'周燕'}
  ]
};

/* 康复签约（家庭医生签约 + 康复计划履约） */
var rehabContracts = {
  TE001:{team:'董家窑街道民巷社区家庭医生第3团队',doctor:'王建军（主治医师）',phone:'0791-8672****',signDate:'2026-02-11',expireDate:'2027-02-10',level:'肿瘤患者康复管理包（高级）',status:'履约中',cls:'badge-success',services:['季度随访','用药与不良反应指导','营养处方','心理支持','绿色通道转诊'],plan:[{date:'2026-03-05',item:'用药指导 + 症状评估',doctor:'王建军',done:'已完成',cls:'badge-success',note:'口服对症用药依从良好'},
    {date:'2026-06-05',item:'营养处方随访',doctor:'社区营养师 刘倩',done:'已完成',cls:'badge-success',note:'体重回升1.2kg'},
    {date:'2026-09-05',item:'Q3康复评估',doctor:'王建军',done:'待履约',cls:'badge-caution',note:'已电话预约'}]},
  TE002:{team:'董家窑街道民巷社区家庭医生第3团队',doctor:'王建军（主治医师）',phone:'0791-8672****',signDate:'2025-11-20',expireDate:'2026-11-19',level:'术后康复管理包（标准）',status:'履约中',cls:'badge-success',services:['半年随访','肠道功能指导','复查提醒'],plan:[{date:'2026-03-20',item:'术后半年复查提醒',doctor:'王建军',done:'已完成',cls:'badge-success',note:'已提醒完成肠镜复查'},
    {date:'2026-09-20',item:'术后一年复查提醒',doctor:'王建军',done:'待履约',cls:'badge-caution',note:'计划电话通知'}]},
  TE003:{team:'南外街道营角上社区家庭医生第1团队',doctor:'张红梅（副主任医师）',phone:'0797-8116****',signDate:'2026-04-15',expireDate:'2027-04-14',level:'乳腺癌康复管理包（高级）',status:'履约中',cls:'badge-success',services:['季度随访','内分泌用药管理','上肢功能锻炼指导','心理支持','淋巴水肿防控'],plan:[{date:'2026-05-18',item:'患肢功能锻炼评估',doctor:'康复师 彭涛',done:'已完成',cls:'badge-success',note:'肩关节活动度恢复至160°'},
    {date:'2026-08-18',item:'内分泌用药依从性随访',doctor:'张红梅',done:'已完成',cls:'badge-success',note:'服药规律，无潮热加重'},
    {date:'2026-11-18',item:'Q4康复评估',doctor:'张红梅',done:'待履约',cls:'badge-caution',note:'待门诊'}]},
  TE004:{team:'甘棠街道白水湖社区家庭医生第2团队',doctor:'李国庆（主治医师）',phone:'0792-8581****',signDate:'2026-07-20',expireDate:'2027-07-19',level:'晚期肿瘤安宁疗护包（高级）',status:'待生效',cls:'badge-caution',services:['上门巡诊','疼痛管理','腹水监测','家属照护培训','哀伤辅导'],plan:[{date:'2026-08-05',item:'首次上门巡诊',doctor:'李国庆',done:'未完成',cls:'badge-danger',note:'患者住院期间暂缓，社区未接收下转'},
    {date:'2026-09-05',item:'疼痛与营养上门评估',doctor:'李国庆 + 区医院姑医学科',done:'待履约',cls:'badge-caution',note:'需先解决下转接收'}]}
};

/* 检验检查与影像（个案证据） */
var examRecords = {
  TE001:[
    {date:'2026-08-20',type:'影像',item:'胸部增强CT',result:'右肺上叶病灶缩小18%',status:'已审核'},
    {date:'2026-08-18',type:'检验',item:'血常规',result:'WBC 5.2×10⁹/L · NEU 3.1 · PLT 214',status:'已审核'},
    {date:'2026-08-18',type:'检验',item:'肝肾功能',result:'ALT 28 U/L · Cr 72 μmol/L · Alb 38 g/L',status:'已审核'},
    {date:'2026-07-15',type:'病理',item:'NGS检测',result:'EGFR野生型，ALK/ROS1阴性',status:'已审核'},
    {date:'2026-06-18',type:'影像',item:'PET-CT',result:'SUVmax 6.8，右肺门及4R淋巴结代谢增高',status:'已审核'}
  ],
  TE002:[
    {date:'2026-03-12',type:'内镜',item:'结肠镜复查',result:'吻合口光滑，未见复发',status:'已审核'},
    {date:'2026-03-10',type:'检验',item:'肿瘤标志物',result:'CEA 3.1 ng/mL · CA19-9 12.6',status:'已审核'},
    {date:'2025-11-16',type:'病理',item:'术后病理',result:'pT3N0M0，淋巴结0/18',status:'已审核'}
  ],
  TE003:[
    {date:'2026-08-24',type:'影像',item:'乳腺MRI',result:'左乳病灶较前缩小，无新发',status:'已审核'},
    {date:'2026-08-22',type:'检验',item:'血常规',result:'WBC 4.6×10⁹/L · PLT 188',status:'已审核'},
    {date:'2026-04-12',type:'病理',item:'术后病理',result:'残留癌0.9cm，前哨LN 1/3微转移',status:'已审核'},
    {date:'2026-03-27',type:'病理',item:'穿刺病理',result:'浸润性导管癌，II级',status:'已审核'}
  ],
  TE004:[
    {date:'2026-08-26',type:'检验',item:'肿瘤标志物',result:'CEA 42.6↑ · CA19-9 128.4↑',status:'已审核'},
    {date:'2026-08-25',type:'检验',item:'生化',result:'Alb 28 g/L↓ · Hb 92 g/L↓',status:'已审核'},
    {date:'2026-08-24',type:'影像',item:'腹部CT',result:'胃壁增厚，腹膜结节较前增多，腹水量增加',status:'已审核'},
    {date:'2026-07-10',type:'影像',item:'腹部增强CT',result:'分期 IV 期（腹膜转移）',status:'已审核'}
  ]
};

/* 生存与结局 */
var outcomeData = {
  TE001:{survival:'存活',lastFu:'2026-08-25',nextFu:'2026-09-25',pfs:'6.2个月',os:'进行中（19个月）',qol:'78/100',follow:'规范随访'},
  TE002:{survival:'存活',lastFu:'2026-03-12',nextFu:'2026-09-12',pfs:'9.4个月',os:'进行中（10个月）',qol:'88/100',follow:'术后无瘤'},
  TE003:{survival:'存活',lastFu:'2026-08-24',nextFu:'2026-11-24',pfs:'5.1个月',os:'进行中（5个月）',qol:'85/100',follow:'规范随访'},
  TE004:{survival:'存活（带瘤）',lastFu:'2026-08-27',nextFu:'2026-09-10',pfs:'1.6个月',os:'进行中（2个月）',qol:'52/100',follow:'密切随访'}
};

/* ===================== 工具函数 ===================== */
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function badge(text,cls){return '<span class="badge '+esc(cls)+'">'+esc(text)+'</span>'}
function scoreDot(score){var color=score>=90?'var(--color-success-solid)':score>=75?'var(--color-caution-solid)':'var(--color-danger-solid)';return '<span style="display:inline-flex;align-items:center;gap:6px"><span style="width:8px;height:8px;border-radius:50%;background:'+color+'"></span>'+score+'</span>'}
function kv(label,value){return '<div class="sp-kv-item"><span class="k">'+esc(label)+'</span><span class="v">'+esc(value||'-')+'</span></div>'}

/* ===================== 子页面：画像工作台 ===================== */
function renderWorkbench(){
  var filter='<div class="sp-filter-bar">'+
    '<div class="form-group wide"><label>关键字</label><input type="text" placeholder="姓名 / 地区 / 诊断" id="spSearch"></div>'+
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

    var respCls=e.response==='CR'||e.response==='PR'?'badge-success':e.response==='SD'?'badge-orange':e.response==='PD'?'badge-danger':'badge-neutral';
    return '<tr style="cursor:pointer" onclick="window._spOpenDetail && window._spOpenDetail(\''+esc(e.id)+'\')">'+
      '<td>'+esc(e.patient)+'</td>'+
      '<td>'+esc(e.sex)+'</td>'+
      '<td>'+e.age+'</td>'+
      '<td>'+esc(e.diagnosis)+'</td>'+
      '<td>'+esc(e.region)+'</td>'+
      '<td>'+esc(e.stage)+'</td>'+
      '<td>'+e.ecog+'</td>'+
      '<td>'+badge(e.response,respCls)+'</td>'+
      '<td>'+nutritionCell+'</td>'+
      '<td>'+otherRiskCell+'</td>'+
      '<td>'+scoreDot(e.qcScore)+'</td>'+
    '</tr>';
  }).join('');

  var table='<div class="panel"><div class="panel-header"><span>肿瘤事件列表</span><span style="font-size:12px;color:var(--color-text-muted)">共 '+tumorEvents.length+' 个事件</span></div>'+
    '<div class="sp-table-wrap"><table class="data-table"><thead><tr><th>患者</th><th>性别</th><th>年龄</th><th>诊断</th><th>地区</th><th>分期</th><th>ECOG</th><th>疗效</th><th>营养风险</th><th>其他风险</th><th>质控分</th></tr></thead><tbody>'+rows+'</tbody></table></div></div>';

  return filter+table;
}

/* ===================== 图表绘制（纯 CSS，无图表库） ===================== */
var SP_COLORS=['#2563eb','#0ea5e9','#10b981','#f59e0b','#8b5cf6','#ef4444','#14b8a6','#f97316'];
function spEmpty(){return '<div class="sp-chart-empty">暂无数据</div>';}
/* 环形饼图 + 图例 */
function spPieChart(dist){
  var keys=Object.keys(dist).filter(function(k){return dist[k]>0});
  var total=keys.reduce(function(s,k){return s+dist[k]},0);
  if(!total) return spEmpty();
  var acc=0,stops=[];
  keys.forEach(function(k,i){
    var c=SP_COLORS[i%SP_COLORS.length];
    var from=acc/total*360; acc+=dist[k]; var to=acc/total*360;
    stops.push(c+' '+from.toFixed(2)+'deg '+to.toFixed(2)+'deg');
  });
  var legend=keys.map(function(k,i){
    var c=SP_COLORS[i%SP_COLORS.length];
    return '<div class="sp-legend-item"><span class="sp-legend-dot" style="background:'+c+'"></span><span>'+esc(k)+'</span><span class="sp-legend-val">'+dist[k]+'</span><span class="sp-legend-pct">'+(dist[k]/total*100).toFixed(0)+'%</span></div>';
  }).join('');
  return '<div class="sp-chart-body"><div class="sp-pie" style="background:conic-gradient('+stops.join(',')+')"><div class="sp-pie-center">'+total+'<small>例</small></div></div><div class="sp-legend">'+legend+'</div></div>';
}
/* 纵向柱状图 */
function spVBarChart(dist){
  var keys=Object.keys(dist).filter(function(k){return dist[k]>0});
  if(!keys.length) return spEmpty();
  var max=Math.max.apply(null,keys.map(function(k){return dist[k]}));
  return '<div class="sp-vbars">'+keys.map(function(k){
    return '<div class="sp-vbar"><div class="sp-vbar-num">'+dist[k]+'</div><div class="sp-vbar-fill" style="height:'+Math.max(6,Math.round(dist[k]/max*100))+'%"></div><div class="sp-vbar-lab" title="'+esc(k)+'">'+esc(k)+'</div></div>';
  }).join('')+'</div>';
}
/* 100% 堆叠条 + 图例（items: [{label,value,color}]） */
function spStackedChart(items){
  var total=items.reduce(function(s,x){return s+x.value},0);
  if(!total) return spEmpty();
  var segs=items.filter(function(x){return x.value>0}).map(function(x){
    var pct=x.value/total*100;
    return '<div class="sp-stack-seg" style="width:'+pct.toFixed(2)+'%;background:'+x.color+'" title="'+esc(x.label)+'：'+x.value+' 例">'+(pct>=9?x.value:'')+'</div>';
  }).join('');
  var legend=items.map(function(x){
    return '<div class="sp-legend-item"><span class="sp-legend-dot" style="background:'+x.color+'"></span><span>'+esc(x.label)+'</span><span class="sp-legend-val">'+x.value+'</span><span class="sp-legend-pct">'+(x.value/total*100).toFixed(0)+'%</span></div>';
  }).join('');
  return '<div class="sp-stack-wrap"><div class="sp-stack-bar">'+segs+'</div><div class="sp-legend">'+legend+'</div></div>';
}
/* 横向柱状图 */
function spHBarChart(dist){
  var keys=Object.keys(dist).filter(function(k){return dist[k]>0});
  if(!keys.length) return spEmpty();
  var max=Math.max.apply(null,keys.map(function(k){return dist[k]}));
  return '<div class="sp-hbars">'+keys.map(function(k){
    return '<div class="sp-hbar-row"><div class="sp-hbar-lab" title="'+esc(k)+'">'+esc(k)+'</div><div class="sp-hbar-track"><div class="sp-hbar-fill" style="width:'+Math.max(4,Math.round(dist[k]/max*100))+'%"></div></div><div class="sp-hbar-num">'+dist[k]+'</div></div>';
  }).join('')+'</div>';
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
    var pm=e.diagnosis.match(/(鳞状细胞癌|腺鳞癌|导管癌|腺癌|鳞癌|细胞癌|母细胞瘤|肉瘤|淋巴瘤|癌|瘤|病)$/);
    var pathType=pm?pm[1]:'其他';
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

  var respItems=[
    {label:'CR 完全缓解',value:responseDist.CR,color:'#10b981'},
    {label:'PR 部分缓解',value:responseDist.PR,color:'#2563eb'},
    {label:'SD 疾病稳定',value:responseDist.SD,color:'#94a3b8'},
    {label:'PD 疾病进展',value:responseDist.PD,color:'#ef4444'}
  ];

  var charts='<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px">'+
    '<div class="panel"><div class="panel-header">分期构成比</div><div class="panel-body">'+spPieChart(stageDist)+'</div></div>'+
    '<div class="panel"><div class="panel-header">病理类型分布</div><div class="panel-body">'+spVBarChart(pathologyDist)+'</div></div>'+
    '<div class="panel"><div class="panel-header">治疗响应评价</div><div class="panel-body">'+spStackedChart(respItems)+'</div></div>'+
    '<div class="panel"><div class="panel-header">风险标签分布</div><div class="panel-body">'+spHBarChart(riskTypeCount)+'</div></div>'+
  '</div>';
  return overview+charts;
}

/* ===================== 患者详情：10 类记录页签 ===================== */
var _currentDetailEvent = null;
var _currentDetailTab = 'basic';
var _spProfileEditing = false;
var _spCollapsed = {};
var _spFilters = {};
var qcStatus = {};

var SP_DETAIL_TABS = [
  {key:'basic',label:'基本信息'},
  {key:'assess',label:'评估记录'},
  {key:'mdt',label:'MDT记录'},
  {key:'consult',label:'远程会诊记录'},
  {key:'referral',label:'转诊记录'},
  {key:'path',label:'病理记录'},
  {key:'fu',label:'随访记录'},
  {key:'rehab',label:'康复签约'},
  {key:'qc',label:'质控元素'}
];

var SP_CITIES = ['南昌市','景德镇市','萍乡市','九江市','新余市','鹰潭市','赣州市','吉安市','宜春市','抚州市','上饶市'];

/* 档案表单结构：段 → 字段（span 为 3 列栅格中的占位宽度） */
var SP_PROFILE_SECTIONS = [
  {key:'base',icon:'①',title:'基本信息',fields:[
    {k:'name',l:'姓名',t:'text',req:1},
    {k:'sex',l:'性别',t:'select',req:1,o:['男','女','不详']},
    {k:'birth',l:'出生日期',t:'date',req:1},
    {k:'idNo',l:'身份证号',t:'text',req:1},
    {k:'phone',l:'手机号',t:'text',req:1},
    {k:'otherNo',l:'其他号码',t:'text'},
    {k:'crowd',l:'人群分类',t:'select',req:1,o:['普通居民','城镇居民','农村居民','城镇职工','城乡居民','低保户','特困供养']},
    {k:'status',l:'患者现状',t:'select',req:1,span:2,o:['门诊治疗中','住院治疗中','住院管理中','居家随访中','门诊随访中','康复期','失访']},
    {k:'tags',l:'标签',t:'tags',span:3}
  ]},
  {key:'addr',icon:'②',title:'地址信息',fields:[
    {k:'region',l:'行政区划',t:'region'},
    {k:'address',l:'家庭地址',t:'text',span:2}
  ]},
  {key:'contact',icon:'③',title:'联系人信息',fields:[
    {k:'contact',l:'联系人姓名',t:'text'},
    {k:'contactRel',l:'联系人关系',t:'select',o:['配偶','子女','父母','兄弟姐妹','亲属','朋友','其他']},
    {k:'contactPhone',l:'联系人电话',t:'text'},
    {k:'remark',l:'备注',t:'textarea',span:3}
  ]},
  {key:'other',icon:'④',title:'其他信息',fields:[
    {k:'archiveDate',l:'建档日期',t:'date',req:1},
    {k:'source',l:'数据来源',t:'select',req:1,o:['社区筛查','医院登记','自检自查','上级下发','门诊登记','死亡补登']},
    {k:'lastScreen',l:'最后筛查日期',t:'date'}
  ]}
];

/* ---------- 通用小工具 ---------- */
function spProfileOf(ev){return patientProfiles[ev.id]||patientProfiles.TE001}
function spPlaceholder(f){
  if(f.t==='select'||f.t==='region')return '请选择'+f.l;
  if(f.t==='date')return '请选择'+f.l;
  if(f.t==='tags')return '请选择'+f.l;
  return '请输入'+f.l;
}
function cText(l,k,w){return {l:l,w:w,r:function(x){return esc(x[k])||'—'}}}
function cNum(l,k,w){return {l:l,w:w,r:function(x){return '<span style="font-family:var(--font-num);font-weight:600">'+esc(x[k])+'</span>'}}}
function cBadge(l,k,clsKey,w){return {l:l,w:w,r:function(x){return badge(x[k],x[clsKey||'cls']||'badge-neutral')}}}
function cWrap(l,k,w){return {l:l,w:w,r:function(x){return '<div class="spr-cellwrap">'+esc(x[k])+'</div>'}}}
function spDetailKv(pairs){
  return '<div class="spd-grid">'+pairs.map(function(p){
    var label=p[0],val=p[1],raw=(p.length>2&&p[2]===true),full=(p.length>3&&p[3]===true);
    return '<div class="spd-row'+(full?' full':'')+'"><span class="k">'+esc(label)+'</span><span class="v">'+(raw?val:esc(val)||'—')+'</span></div>';
  }).join('')+'</div>';
}
function spModal(title,body,foot,narrow){
  var mask=document.createElement('div');
  mask.className='sp-modal-mask';
  mask.innerHTML='<div class="sp-modal'+(narrow?' narrow':'')+'"><div class="sp-modal-head"><div class="sp-modal-title">'+esc(title)+'</div><button class="sp-modal-close" aria-label="关闭">×</button></div><div class="sp-modal-body">'+body+'</div>'+(foot?'<div class="sp-modal-foot">'+foot+'</div>':'')+'</div>';
  mask.addEventListener('click',function(e){if(e.target===mask)mask.remove()});
  mask.querySelector('.sp-modal-close').addEventListener('click',function(){mask.remove()});
  (document.getElementById('pageContainer')||document.body).appendChild(mask);
  return mask;
}
function spCloseModals(){var n=document.querySelectorAll('.sp-modal-mask');for(var i=0;i<n.length;i++)n[i].remove()}
function spMaskIdNo(v){
  var s=String(v||'');
  return s.length>=10?s.slice(0,6)+'********'+s.slice(-4):s;
}
function spIsValidDate(v){return /^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(new Date(v+'T00:00:00').getTime())}
function spValidateProfile(next){
  var required=[['name','姓名'],['sex','性别'],['birth','出生日期'],['idNo','身份证号'],['phone','手机号'],['crowd','人群分类'],['status','患者现状'],['archiveDate','建档日期'],['source','数据来源']];
  for(var i=0;i<required.length;i++){if(!next[required[i][0]])return '请填写「'+required[i][1]+'」'}
  if(!/^\d{17}[\dXx]$/.test(next.idNo||''))return '身份证号应为18位有效格式';
  if(next.phone&&!/^(?:1\d{10}|1\d{2}\*{4}\d{4})$/.test(next.phone))return '手机号格式不正确';
  if(next.contactPhone&&!/^(?:1\d{10}|1\d{2}\*{4}\d{4})$/.test(next.contactPhone))return '联系人电话格式不正确';
  if(next.birth&&!spIsValidDate(next.birth))return '出生日期格式不正确';
  if(next.archiveDate&&!spIsValidDate(next.archiveDate))return '建档日期格式不正确';
  if(next.lastScreen&&!spIsValidDate(next.lastScreen))return '最后筛查日期格式不正确';
  if(next.birth&&next.archiveDate&&next.birth>next.archiveDate)return '建档日期不能早于出生日期';
  if(next.lastScreen&&next.archiveDate&&next.lastScreen<next.archiveDate)return '最后筛查日期不能早于建档日期';
  return '';
}

/* ---------- 页签一：基本信息（档案表单） ---------- */
function spRegionSelects(p,editable){
  var segs=String(p.region||'').split(/\s*\/\s*/);
  if(!editable){
    return '<input type="text" readonly value="'+esc(p.region||'')+'" placeholder="请选择行政区划">';
  }
  var prov=segs[0]||'江西省',city=segs[1]||'',dist=segs[2]||'',town=segs[3]||'',village=segs[4]||'';
  function sel(idx,val,options,ph){
    return '<select id="spf_region_'+idx+'"><option value="">'+ph+'</option>'+options.map(function(o){return '<option'+(o===val?' selected':'')+'>'+esc(o)+'</option>'}).join('')+'</select>';
  }
  return '<div class="spf-region">'+sel(0,prov,['江西省'],'省')+sel(1,city,SP_CITIES,'市')+sel(2,dist,dist?[dist]:[],'区县')+sel(3,town,town?[town]:[],'街道/乡镇')+sel(4,village,village?[village]:[],'村/社区')+'</div>';
}
function spFieldHtml(f,p,editable){
  var val=p[f.k];
  var spanCls=f.span===2?' span2':(f.span===3?' span3':'');
  var label='<span class="spf-label">'+(f.req?'<span class="req">*</span>':'')+esc(f.l)+'</span>';
  var ctrl='';
  if(f.t==='tags'){
    if(editable){
      ctrl='<div class="spf-ctrl"><input type="text" id="spf_'+f.k+'" value="'+esc((val||[]).join('，'))+'" placeholder="多个标签用逗号分隔"></div>';
    }else{
      ctrl='<div class="spf-ctrl"><div class="spf-tags">'+((val&&val.length)?val.map(function(t){return badge(t,'badge-info')}).join(''):'<span style="color:var(--color-text-placeholder);font-size:var(--fs-sm)">请选择标签</span>')+'</div></div>';
    }
  }else if(f.t==='region'){
    ctrl='<div class="spf-ctrl">'+spRegionSelects(p,editable)+'</div>';
  }else if(f.t==='select'){
    var opts='<option value="">'+esc(spPlaceholder(f))+'</option>'+f.o.map(function(o){return '<option'+(o===val?' selected':'')+'>'+esc(o)+'</option>'}).join('');
    ctrl='<div class="spf-ctrl"><select id="spf_'+f.k+'"'+(editable?'':' disabled')+'>'+opts+'</select></div>';
  }else if(f.t==='textarea'){
    ctrl='<div class="spf-ctrl"><textarea id="spf_'+f.k+'" placeholder="'+esc(spPlaceholder(f))+'"'+(editable?'':' readonly')+'>'+esc(val||'')+'</textarea></div>';
    return '<div class="spf-item area span3">'+label+ctrl+'</div>';
  }else{
    var displayVal=!editable&&f.k==='idNo'?spMaskIdNo(val):val;
    ctrl='<div class="spf-ctrl"><input type="'+(f.t==='date'?'date':'text')+'" id="spf_'+f.k+'" value="'+esc(displayVal||'')+'" placeholder="'+esc(spPlaceholder(f))+'"'+(editable?'':' readonly')+'></div>';
  }
  return '<div class="spf-item'+spanCls+'">'+label+ctrl+'</div>';
}
function spProfileHtml(ev){
  var p=spProfileOf(ev),ed=_spProfileEditing;
  var h='';
  h+='<div class="spf-actions">';
  if(ed){
    h+='<button class="btn btn-ghost btn-sm" onclick="window._spCancelProfile()">取消</button>';
    h+='<button class="btn btn-primary btn-sm" onclick="window._spSaveProfile()">保存档案</button>';
  }else{
    h+='<button class="btn btn-ghost btn-sm" onclick="toast(\'档案打印任务已提交\')">打印档案</button>';
    h+='<button class="btn btn-outline btn-sm" onclick="window._spEditProfile()">编辑档案</button>';
  }
  h+='</div>';
  SP_PROFILE_SECTIONS.forEach(function(sec){
    var collapsed=!!_spCollapsed[sec.key];
    h+='<div class="spf-section'+(collapsed?' collapsed':'')+'" id="spf-sec-'+sec.key+'">'+
      '<div class="spf-sec-head" onclick="window._spToggleSec(\''+sec.key+'\')">'+
      '<span class="spf-caret"></span><span class="spf-sec-icon">'+sec.icon+'</span><span class="spf-sec-title">'+esc(sec.title)+'</span>'+
      '</div><div class="spf-body"><div class="spf-grid">';
    sec.fields.forEach(function(f){h+=spFieldHtml(f,p,ed)});
    h+='</div></div></div>';
  });
  return h;
}

/* ---------- 通用记录表 ---------- */
function spIndexRows(arr){
  return arr.map(function(r,i){var o={};for(var k in r){if(r.hasOwnProperty(k))o[k]=r[k]}o._i=i;return o});
}
function spApplyFilter(tab,rows,cfg){
  var f=_spFilters[tab]||{};
  var q=String(f.q||'').trim().toLowerCase();
  return rows.filter(function(x){
    if(q&&cfg.search){
      var hit=cfg.search.keys.some(function(k){return String(x[k]||'').toLowerCase().indexOf(q)>=0});
      if(!hit)return false;
    }
    if(cfg.filters){
      for(var i=0;i<cfg.filters.length;i++){
        var fl=cfg.filters[i];
        if(f[fl.k]&&String(x[fl.k]||'')!==f[fl.k])return false;
      }
    }
    return true;
  });
}
function spToolbarHtml(tab,cfg,shown,total){
  var f=_spFilters[tab]||(_spFilters[tab]={});
  var h='<div class="spr-toolbar">';
  if(cfg.search){
    h+='<div class="form-group search"><label>关键字</label><input placeholder="'+esc(cfg.search.ph)+'" value="'+esc(f.q||'')+'" onchange="window._spRecFilter(\''+tab+'\',\'q\',this.value)"></div>';
  }
  (cfg.filters||[]).forEach(function(fl){
    var sel=f[fl.k]||'';
    h+='<div class="form-group"><label>'+esc(fl.l)+'</label><select onchange="window._spRecFilter(\''+tab+'\',\''+fl.k+'\',this.value)"><option value="">全部</option>'+fl.o.map(function(o){return '<option'+(o===sel?' selected':'')+'>'+esc(o)+'</option>'}).join('')+'</select></div>';
  });
  h+='<div class="spr-actions"><button class="btn btn-ghost btn-sm" onclick="window._spRecReset(\''+tab+'\')">重置</button>';
  if(cfg.add)h+='<button class="btn btn-primary btn-sm" onclick="window._spAddRec(\''+tab+'\')">'+esc(cfg.add)+'</button>';
  h+='</div></div>';
  return h;
}
function spTableHtml(cfg,rows,withOps){
  var cols=cfg.cols;
  var h='<div class="sp-table-wrap"><table class="data-table"><thead><tr>';
  cols.forEach(function(c){h+='<th'+(c.w?' style="width:'+c.w+'"':'')+'>'+esc(c.l)+'</th>'});
  if(withOps)h+='<th style="width:132px">操作</th>';
  h+='</tr></thead><tbody>';
  rows.forEach(function(x){
    h+='<tr>';
    cols.forEach(function(c){h+='<td'+(c.w?' style="width:'+c.w+'"':'')+'>'+(c.r?c.r(x):(esc(x[c.k])||'—'))+'</td>'});
    if(withOps){
      h+='<td class="spr-op"><button class="btn btn-ghost btn-xs" onclick="window._spViewRec(\''+cfg.tab+'\','+x._i+')">查看</button>'+
         '<button class="btn btn-danger btn-xs" onclick="window._spDelRec(\''+cfg.tab+'\','+x._i+')">删除</button></td>';
    }
    h+='</tr>';
  });
  h+='</tbody></table></div>';
  return h;
}
function spRecPanel(tab,cfg,rows,title){
  cfg.tab=tab;
  var idx=spIndexRows(rows),shown=spApplyFilter(tab,idx,cfg);
  var h='<div class="panel"><div class="panel-header"><span>'+esc(title||cfg.title)+
    '<span class="spr-count">共 '+rows.length+' 条'+(shown.length!==rows.length?' · 筛选后 '+shown.length+' 条':'')+'</span></span></div><div class="panel-body">';
  h+=spToolbarHtml(tab,cfg,shown.length,rows.length);
  h+=shown.length?spTableHtml(cfg,shown,true):'<div class="spr-empty">暂无符合条件的记录</div>';
  h+='</div></div>';
  return h;
}

/* ---------- 各记录页签配置 ---------- */
function spRecConfig(tab,ev){
  var cfgs={
    assess:{title:'风险评估记录',rows:assessRecords[ev.id]||[],
      cols:[cText('评估日期','date','106px'),{l:'评估维度',r:function(x){return '<strong style="color:var(--color-text-title)">'+esc(x.type)+'</strong>'}},cText('评估工具','tool','96px'),{l:'得分',w:'96px',r:function(x){return '<span style="font-family:var(--font-num);font-weight:700">'+esc(x.score)+'</span>'}},cBadge('风险等级','level','cls','104px'),cText('评估人','assessor','116px'),cWrap('干预建议','advice')],
      search:{keys:['type','tool','assessor','advice','score'],ph:'评估维度 / 工具 / 评估人 / 建议'},
      filters:[{k:'type',l:'评估维度',o:['营养风险','VTE血栓','疼痛','心理痛苦','跌倒风险','功能状态','压疮风险']}],
      add:'新增评估',
      form:[{k:'date',l:'评估日期',t:'date'},{k:'type',l:'评估维度',t:'select',o:['营养风险','VTE血栓','疼痛','心理痛苦','跌倒风险','功能状态','压疮风险']},{k:'tool',l:'评估工具',t:'text',ph:'如 NRS2002'},{k:'score',l:'得分',t:'text',ph:'如 4分'},{k:'level',l:'风险等级',t:'select',o:['无风险','低危','轻度','可疑抑郁','中度风险','中危','高度风险','高危']},{k:'assessor',l:'评估人',t:'text',ph:'科室 + 姓名'},{k:'advice',l:'干预建议',t:'textarea',span:2}],
      detail:function(x){return spDetailKv([['评估日期',x.date],['评估维度',x.type],['评估工具',x.tool],['得分',x.score],['风险等级',badge(x.level,x.cls||'badge-neutral'),true],['评估人',x.assessor],['干预建议',x.advice,true]])}},
    consult:{title:'远程会诊记录',rows:consultRecords[ev.id]||[],
      cols:[cText('会诊编号','no','132px'),cText('申请日期','applyDate','106px'),cWrap('受邀机构','hospital'),cText('会诊专家','expert','150px'),cText('会诊方式','way','96px'),cWrap('会诊意见','opinion'),cBadge('状态','status','cls','92px')],
      search:{keys:['no','hospital','expert','opinion'],ph:'编号 / 机构 / 专家 / 意见'},
      filters:[{k:'status',l:'状态',o:['待受理','已回复','已完成','已取消']},{k:'way',l:'会诊方式',o:['视频会诊','图文会诊','语音会诊']}],
      add:'发起会诊',
      form:[{k:'no',l:'会诊编号',t:'text'},{k:'applyDate',l:'申请日期',t:'date'},{k:'hospital',l:'受邀机构',t:'text'},{k:'expert',l:'会诊专家',t:'text'},{k:'way',l:'会诊方式',t:'select',o:['视频会诊','图文会诊','语音会诊']},{k:'status',l:'状态',t:'select',o:['待受理','已回复','已完成','已取消']},{k:'opinion',l:'会诊意见',t:'textarea',span:2}],
      detail:function(x){return spDetailKv([['会诊编号',x.no],['申请日期',x.applyDate],['受邀机构',x.hospital],['会诊专家',x.expert],['会诊方式',x.way],['状态',badge(x.status,x.cls||'badge-neutral'),true],['会诊意见',x.opinion,true]])}},
    referral:{title:'转诊记录',rows:referralRecords[ev.id]||[],
      cols:[cText('转诊编号','no','132px'),{l:'方向',w:'72px',r:function(x){return badge(x.dir,x.dir==='上转'?'badge-info':'badge-accent')}},cWrap('转出机构','from'),cWrap('转入机构','to'),cWrap('转诊原因','reason'),cText('申请日期','applyDate','106px'),cText('接收日期','acceptDate','106px'),cBadge('状态','status','cls','92px')],
      search:{keys:['no','from','to','reason'],ph:'编号 / 机构 / 原因'},
      filters:[{k:'dir',l:'转诊方向',o:['上转','下转']},{k:'status',l:'状态',o:['待接收','已接收','已退回','已撤销']}],
      add:'发起转诊',
      form:[{k:'no',l:'转诊编号',t:'text'},{k:'dir',l:'转诊方向',t:'select',o:['上转','下转']},{k:'from',l:'转出机构',t:'text'},{k:'to',l:'转入机构',t:'text'},{k:'applyDate',l:'申请日期',t:'date'},{k:'status',l:'状态',t:'select',o:['待接收','已接收','已退回','已撤销']},{k:'reason',l:'转诊原因',t:'textarea',span:2}],
      detail:function(x){return spDetailKv([['转诊编号',x.no],['转诊方向',x.dir],['转出机构',x.from],['转入机构',x.to],['申请日期',x.applyDate],['接收日期',x.acceptDate],['转诊原因',x.reason,true],['状态',badge(x.status,x.cls||'badge-neutral'),true]])}},
    path:{title:'病理报告记录',rows:pathRecords[ev.id]||[],
      cols:[cText('病理号','no','124px'),cText('送检日期','submitDate','106px'),cText('报告日期','reportDate','106px'),cWrap('标本及部位','specimen'),cWrap('病理诊断','diagnosis'),cText('分级','grade','86px'),cText('状态','status','86px')],
      search:{keys:['no','specimen','diagnosis','ihc','molecular'],ph:'病理号 / 标本 / 诊断'},
      filters:[{k:'grade',l:'分化分级',o:['中分化','中-高分化','低分化','II级','—']},{k:'status',l:'报告状态',o:['已审核','待审核']}],
      add:'新增病理',
      form:[{k:'no',l:'病理号',t:'text'},{k:'submitDate',l:'送检日期',t:'date'},{k:'reportDate',l:'报告日期',t:'date'},{k:'specimen',l:'标本及部位',t:'text'},{k:'diagnosis',l:'病理诊断',t:'textarea',span:2},{k:'grade',l:'分化分级',t:'select',o:['高分化','中-高分化','中分化','低分化','I级','II级','III级']},{k:'doctor',l:'报告医师',t:'text'},{k:'status',l:'报告状态',t:'select',o:['已审核','待审核']},{k:'ihc',l:'免疫组化',t:'textarea',span:2},{k:'molecular',l:'分子检测',t:'textarea',span:2}],
      detail:function(x){return spDetailKv([['病理号',x.no],['送检日期',x.submitDate],['报告日期',x.reportDate],['标本及部位',x.specimen,true],['病理诊断',x.diagnosis,true],['分化分级',x.grade],['报告医师',x.doctor],['报告状态',x.status],['免疫组化',x.ihc,true],['分子检测',x.molecular,true]])}},
    fu:{title:'随访记录',rows:followupRecords[ev.id]||[],
      cols:[cText('随访日期','date','106px'),cText('随访方式','way','100px'),cText('生存状态','survival','96px'),cWrap('现状描述','status'),cWrap('检查结果','exam'),cText('下次随访','next','132px'),cText('随访人','nurse','80px')],
      search:{keys:['way','status','exam','nurse'],ph:'方式 / 现状 / 检查结果'},
      filters:[{k:'way',l:'随访方式',o:['门诊随访','电话随访','住院随访','上门随访','微信随访']},{k:'survival',l:'生存状态',o:['存活','死亡','失访','移居']}],
      add:'新增随访',
      form:[{k:'date',l:'随访日期',t:'date'},{k:'way',l:'随访方式',t:'select',o:['门诊随访','电话随访','住院随访','上门随访','微信随访']},{k:'survival',l:'生存状态',t:'select',o:['存活','死亡','失访','移居']},{k:'nurse',l:'随访人',t:'text'},{k:'next',l:'下次随访',t:'text'},{k:'status',l:'现状描述',t:'textarea',span:2},{k:'exam',l:'检查结果',t:'textarea',span:2}],
      detail:function(x){return spDetailKv([['随访日期',x.date],['随访方式',x.way],['生存状态',x.survival],['随访人',x.nurse],['下次随访',x.next],['现状描述',x.status,true],['检查结果',x.exam,true]])}}
  };
  return cfgs[tab];
}
function spRecRowsOf(tab,ev){
  var m={assess:assessRecords,consult:consultRecords,referral:referralRecords,path:pathRecords,fu:followupRecords};
  return (m[tab]&&m[tab][ev.id])||[];
}

/* ---------- 页签四：MDT 记录 ---------- */
function spMdtPanel(tab,ev){
  var rows=mdtRecords[ev.id]||[];
  var cfg={tab:tab,title:'MDT 讨论记录',rows:rows,
    cols:[],search:{keys:['topic','host','depts','opinion','plan'],ph:'主题 / 主持 / 科室 / 结论'},
    filters:[{k:'status',l:'执行状态',o:['执行中','已完成','已取消']}]};
  var shown=spApplyFilter(tab,spIndexRows(rows),cfg);
  var h='<div class="panel"><div class="panel-header"><span>MDT 讨论记录<span class="spr-count">共 '+rows.length+' 次</span></span></div><div class="panel-body">';
  h+=spToolbarHtml(tab,cfg,shown.length,rows.length);
  if(!shown.length){h+='<div class="spr-empty">暂无符合条件的 MDT 记录</div>';}
  else{
    h+='<div class="spm-list">'+shown.map(function(x){
      return '<div class="spm-card"><div class="spm-head"><span class="spm-topic">'+esc(x.topic)+'</span>'+
        '<span class="spm-date">'+esc(x.date)+'</span><span class="spm-host">主持：'+esc(x.host)+'</span>'+badge(x.status,x.cls)+
        '<span style="margin-left:auto;display:flex;gap:6px"><button class="btn btn-ghost btn-xs" onclick="window._spViewRec(\'mdt\','+x._i+')">查看</button>'+
        '<button class="btn btn-danger btn-xs" onclick="window._spDelRec(\'mdt\','+x._i+')">删除</button></span></div>'+
        '<dl class="spm-body"><dt>参与科室</dt><dd>'+esc(x.depts)+'</dd>'+
        '<dt>讨论结论</dt><dd>'+esc(x.opinion)+'</dd>'+
        '<dt>治疗方案</dt><dd>'+esc(x.plan)+'</dd></dl></div>';
    }).join('')+'</div>';
  }
  h+='</div></div>';
  return h;
}

/* ---------- 页签九：康复签约 ---------- */
function spRehabPanel(tab,ev){
  var c=rehabContracts[ev.id];
  if(!c)return '<div class="panel"><div class="panel-body"><div class="spr-empty">该患者尚未建立康复签约</div></div></div>';
  var h='<div class="panel"><div class="panel-header"><span>家庭医生签约信息</span>'+badge(c.status,c.cls)+'</div><div class="panel-body" style="padding-bottom:6px">';
  h+='<div class="sph-grid">'+
    '<div class="sph-item"><span class="k">签约团队</span><span class="v">'+esc(c.team)+'</span></div>'+
    '<div class="sph-item"><span class="k">责任医师</span><span class="v">'+esc(c.doctor)+'</span></div>'+
    '<div class="sph-item"><span class="k">联系电话</span><span class="v" style="font-family:var(--font-num)">'+esc(c.phone)+'</span></div>'+
    '<div class="sph-item"><span class="k">签约服务包</span><span class="v">'+esc(c.level)+'</span></div>'+
    '<div class="sph-item"><span class="k">签约日期</span><span class="v" style="font-family:var(--font-num)">'+esc(c.signDate)+'</span></div>'+
    '<div class="sph-item"><span class="k">有效期至</span><span class="v" style="font-family:var(--font-num)">'+esc(c.expireDate)+'</span></div>'+
    '</div>';
  h+='<div class="sph-services">'+c.services.map(function(s){return '<span>'+esc(s)+'</span>'}).join('')+'</div>';
  h+='</div></div>';
  var cfg={tab:tab,title:'康复计划履约记录',rows:c.plan,
    cols:[cText('计划日期','date','110px'),cWrap('履约项目','item'),cText('履约人','doctor','150px'),cBadge('履约状态','done','cls','96px'),cWrap('履约备注','note')],
    search:{keys:['item','doctor','note'],ph:'项目 / 履约人 / 备注'},
    filters:[{k:'done',l:'履约状态',o:['已完成','待履约','未完成']}],
    detail:function(x){return spDetailKv([['计划日期',x.date],['履约项目',x.item],['履约人',x.doctor],['履约状态',badge(x.done,x.cls||'badge-neutral'),true],['履约备注',x.note,true]])}};
  var rows=spIndexRows(c.plan),shown=spApplyFilter(tab,rows,cfg);
  h+='<div class="panel"><div class="panel-header"><span>康复计划履约记录<span class="spr-count">共 '+c.plan.length+' 项</span></span></div><div class="panel-body">';
  h+=spToolbarHtml(tab,cfg,shown.length,c.plan.length);
  h+=shown.length?spTableHtml(cfg,shown,true):'<div class="spr-empty">暂无符合条件的履约记录</div>';
  h+='</div></div>';
  return h;
}

/* ---------- 页签十：质控元素 ---------- */
function spQcPanel(tab,ev){
  var p=spProfileOf(ev);
  var els=[
    {n:'姓名',ok:!!p.name},{n:'身份证号',ok:!!p.idNo},{n:'出生日期',ok:!!p.birth},{n:'联系电话',ok:!!p.phone},
    {n:'行政区划',ok:!!p.region},{n:'家庭地址',ok:!!p.address},{n:'联系人及电话',ok:!!(p.contact&&p.contactPhone)},
    {n:'诊断依据',ok:!!ev.diagnosis},{n:'临床分期',ok:!!ev.stage},{n:'分期日期',ok:!!ev.stageDate},
    {n:'病理报告',ok:(pathRecords[ev.id]||[]).length>0},{n:'治疗方案',ok:!!ev.regimen},
    {n:'疗效评价',ok:!!ev.response},{n:'风险评估',ok:(assessRecords[ev.id]||[]).length>0},
    {n:'随访记录',ok:(followupRecords[ev.id]||[]).length>0},{n:'建档与来源',ok:!!(p.archiveDate&&p.source)}
  ];
  var okCnt=els.filter(function(e){return e.ok}).length;
  var rate=Math.round(okCnt/els.length*100);
  var h='<div class="panel"><div class="panel-header"><span>质控要素完整度</span><span style="font-size:var(--fs-sm);font-weight:600;color:'+(rate>=90?'var(--color-success-fg)':rate>=75?'var(--color-caution-fg)':'var(--color-danger-fg)')+'">'+okCnt+' / '+els.length+' · '+rate+'%</span></div><div class="panel-body">';
  h+='<div style="height:8px;border-radius:999px;background:var(--color-bg-subtle);overflow:hidden;margin-bottom:14px"><div style="height:100%;width:'+rate+'%;border-radius:999px;background:'+(rate>=90?'var(--color-success-solid)':rate>=75?'var(--color-caution-solid)':'var(--color-danger-solid)')+'"></div></div>';
  h+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:8px 12px">';
  els.forEach(function(e){
    h+='<div style="display:flex;align-items:center;gap:7px;padding:7px 10px;border:1px solid var(--color-border);border-radius:var(--radius-sm);background:'+(e.ok?'var(--surface)':'var(--color-danger-bg)')+'">'+
      '<span style="width:16px;height:16px;flex:0 0 16px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;background:'+(e.ok?'var(--color-success-solid)':'var(--color-danger-solid)')+'">'+(e.ok?'✓':'!')+'</span>'+
      '<span style="font-size:var(--fs-sm);color:'+(e.ok?'var(--color-text-body)':'var(--color-danger-fg)')+'">'+esc(e.n)+'</span></div>';
  });
  h+='</div></div></div>';

  var list=qcWorkOrders.filter(function(w){return w.patient===ev.patient});
  var cfg={tab:tab,title:'质控工单',rows:list,
    cols:[cText('规则ID','id','112px'),cBadge('质控类别','category','_c','96px'),cBadge('严重级别','level','_l','86px'),cWrap('问题描述','problem'),cWrap('详细说明','desc'),{l:'处置状态',w:'104px',r:function(x){var s=qcStatus[x.id]||'待处理';return badge(s,s==='已处理'?'badge-success':s==='处理中'?'badge-caution':'badge-danger')}}],
    search:{keys:['id','problem','desc','category'],ph:'规则 / 问题 / 说明'},
    filters:[{k:'category',l:'质控类别',o:['完整性','一致性','及时性','可追溯性']},{k:'level',l:'严重级别',o:['高','中','低']}]};
  var shown=spApplyFilter(tab,spIndexRows(list).map(function(x){
    x._c='badge-neutral';x._l=x.level==='高'?'badge-danger':x.level==='中'?'badge-orange':'badge-info';return x;
  }),cfg);
  h+='<div class="panel"><div class="panel-header"><span>该患者质控工单<span class="spr-count">共 '+list.length+' 条</span></span></div><div class="panel-body">';
  h+=spToolbarHtml(tab,cfg,shown.length,list.length);
  if(!shown.length){h+='<div class="spr-empty">'+(list.length?'暂无符合条件的工单':'该画像暂无质控问题 ✓')+'</div>';}
  else{
    h+='<div class="sp-table-wrap"><table class="data-table"><thead><tr>';
    cfg.cols.forEach(function(c){h+='<th'+(c.w?' style="width:'+c.w+'"':'')+'>'+esc(c.l)+'</th>'});
    h+='<th style="width:150px">操作</th></tr></thead><tbody>';
    shown.forEach(function(x){
      var s=qcStatus[x.id]||'待处理';
      h+='<tr>';
      cfg.cols.forEach(function(c){h+='<td'+(c.w?' style="width:'+c.w+'"':'')+'>'+c.r(x)+'</td>'});
      h+='<td class="spr-op">'+(s==='已处理'?'<span style="font-size:var(--fs-sm);color:var(--color-success-fg)">已闭环</span>':'<button class="btn btn-outline btn-xs" onclick="window._spQcStep(\''+esc(x.id)+'\')">'+(s==='待处理'?'开始处理':'标记已处理')+'</button>')+'</td></tr>';
    });
    h+='</tbody></table></div>';
  }
  h+='</div></div>';

  h+='<div class="panel"><div class="panel-header"><span>画像版本记录</span></div><div class="panel-body">';
  h+='<div class="sp-table-wrap"><table class="data-table"><thead><tr><th style="width:88px">版本</th><th style="width:150px">更新时间</th><th style="width:96px">更新人</th><th>变更摘要</th><th style="width:96px">质控分</th></tr></thead><tbody>';
  [['V5.0','2026-08-28 10:00','系统','个案画像模型升级，补充评估与签约要素',92],['V4.2','2026-08-25 14:30','张医生','更新疗效评价为'+ev.response+'，补充分子检测结果',91],['V4.1','2026-07-10 09:15','李医生','新增治疗线数与方案记录',85],['V4.0','2026-06-18 16:42','张医生','分期更新为'+ev.stage,82]].forEach(function(v){
    h+='<tr><td style="font-weight:600">'+v[0]+'</td><td style="font-family:var(--font-num)">'+v[1]+'</td><td>'+v[2]+'</td><td style="white-space:normal">'+v[3]+'</td><td>'+scoreDot(v[4])+'</td></tr>';
  });
  h+='</tbody></table></div></div></div>';
  return h;
}

/* ---------- 评估记录页签附加面板：风险矩阵 + 检验检查 ---------- */
function spAssessExtra(ev){
  var h='';
  var allRisks=['营养','VTE','疼痛','焦虑','跌倒','压疮'];
  h+='<div class="panel"><div class="panel-header"><span>当前风险矩阵</span></div><div class="panel-body"><div class="sp-risk-grid">';
  allRisks.forEach(function(rt){
    var found=ev.risks.find(function(r){return r.type===rt});
    var lvl=found?found.level:'无风险';
    var cls=found?(lvl.indexOf('高')>=0?'high':(lvl.indexOf('中')>=0?'medium':'low')):'low';
    h+='<div class="sp-risk-card '+cls+'"><div class="sp-risk-title">'+esc(rt)+'</div><div class="sp-risk-level" style="color:'+(cls==='high'?'var(--color-danger-solid)':cls==='medium'?'var(--color-caution-solid)':'var(--color-success-solid)')+'">'+esc(lvl)+'</div></div>';
  });
  h+='</div></div></div>';
  var exams=examRecords[ev.id]||[];
  h+='<div class="panel"><div class="panel-header"><span>检验与功能评估依据<span class="spr-count">共 '+exams.length+' 项</span></span></div><div class="panel-body">';
  h+='<div class="sp-table-wrap"><table class="data-table"><thead><tr><th style="width:110px">日期</th><th style="width:88px">类型</th><th style="width:150px">项目</th><th>结果</th><th style="width:96px">状态</th></tr></thead><tbody>';
  exams.forEach(function(r){
    h+='<tr><td style="font-family:var(--font-num)">'+esc(r.date)+'</td><td>'+badge(r.type,'badge-neutral')+'</td><td>'+esc(r.item)+'</td><td style="white-space:normal">'+esc(r.result)+'</td><td>'+badge(r.status,'badge-success')+'</td></tr>';
  });
  h+='</tbody></table></div></div></div>';
  return h;
}

/* ---------- 随访页签附加：结局 + 诊疗历程 ---------- */
function spFuExtra(ev){
  var o=outcomeData[ev.id]||{};
  var h='<div class="panel"><div class="panel-header"><span>生存与结局</span></div><div class="panel-body"><div class="sp-kv-grid">';
  h+=kv('生存状态',o.survival)+kv('末次随访',o.lastFu)+kv('下次随访',o.nextFu)+kv('无进展生存 PFS',o.pfs);
  h+=kv('总生存 OS',o.os)+kv('生活质量评分',o.qol)+kv('随访管理',o.follow);
  h+='</div></div></div>';
  var nodes=[{d:'2026-01-15',c:'确诊 '+ev.diagnosis+'，完成基线评估'}];
  if(ev.id==='TE002')nodes=[{d:'2025-11-03',c:'肠镜确诊 '+ev.diagnosis},{d:'2025-11-12',c:'行腹腔镜右半结肠根治术'},{d:'2025-12-08',c:'启动'+ev.line+' '+ev.regimen},{d:'2026-03-12',c:'辅助化疗完成，疗效评价 '+ev.response}];
  if(ev.id==='TE003')nodes=[{d:'2026-03-20',c:'两癌筛查发现左乳结节 BI-RADS 5'},{d:'2026-03-27',c:'穿刺病理确诊 '+ev.diagnosis},{d:'2026-04-08',c:'行左乳改良根治术'},{d:'2026-04-20',c:'启动'+ev.line+' '+ev.regimen},{d:'2026-08-24',c:'化疗完成转内分泌维持，疗效评价 '+ev.response}];
  if(ev.id==='TE001')nodes=[{d:'2026-01-18',c:'社区低剂量CT筛查发现肺结节'},{d:'2026-01-29',c:'穿刺病理确诊 '+ev.diagnosis},{d:'2026-02-05',c:'MDT制定'+ev.line+'方案：'+ev.regimen},{d:'2026-06-18',c:'PET-CT再分期至 '+ev.stage},{d:'2026-08-25',c:'疗效评价 '+ev.response+'，继续治疗'}];
  if(ev.id==='TE004')nodes=[{d:'2026-07-08',c:'胃镜活检确诊 '+ev.diagnosis},{d:'2026-07-10',c:'增强CT分期 '+ev.stage},{d:'2026-07-12',c:'MDT制定'+ev.line+'方案：'+ev.regimen},{d:'2026-08-24',c:'疾病进展评价 '+ev.response+'，转入三线讨论'}];
  h+='<div class="panel"><div class="panel-header"><span>诊疗历程</span></div><div class="panel-body"><div class="sp-timeline">';
  nodes.forEach(function(n){h+='<div class="sp-tl-item"><div class="sp-tl-date">'+esc(n.d)+'</div><div class="sp-tl-content">'+esc(n.c)+'</div></div>'});
  h+='</div></div></div>';
  return h;
}

/* ---------- 详情主渲染 ---------- */
function renderDetailPanel(eventId){
  var ev=tumorEvents.find(function(e){return e.id===eventId});
  if(!ev)return '<div class="panel"><div class="panel-body">未找到该肿瘤事件</div></div>';
  _currentDetailEvent=ev;
  var nav='<div class="sp-rec-nav">'+SP_DETAIL_TABS.map(function(t){
    var n=spTabCount(ev,t.key);
    return '<button class="sp-rec-tab'+(t.key===_currentDetailTab?' active':'')+'" onclick="window._spSwitchDetailTab(\''+t.key+'\')">'+esc(t.label)+(n?'<span class="cnt">'+n+'</span>':'')+'</button>';
  }).join('')+'</div>';

  var body='';
  var tab=_currentDetailTab;
  if(tab==='basic'){body=spProfileHtml(ev);}
  else if(tab==='assess'){var c=spRecConfig('assess',ev);body=spAssessExtra(ev)+spRecPanel('assess',c,c.rows,'风险评估记录');}
  else if(tab==='mdt'){body=spMdtPanel('mdt',ev);}
  else if(tab==='consult'){var c3=spRecConfig('consult',ev);body=spRecPanel('consult',c3,c3.rows,'远程会诊记录');}
  else if(tab==='referral'){var c4=spRecConfig('referral',ev);body=spRecPanel('referral',c4,c4.rows,'转诊记录');}
  else if(tab==='path'){var c5=spRecConfig('path',ev);body=spRecPanel('path',c5,c5.rows,'病理报告记录');}
  else if(tab==='fu'){var c6=spRecConfig('fu',ev);body=spRecPanel('fu',c6,c6.rows,'随访记录')+spFuExtra(ev);}
  else if(tab==='rehab'){body=spRehabPanel('rehab',ev);}
  else if(tab==='qc'){body=spQcPanel('qc',ev);}
  return nav+body;
}

function spTabCount(ev,key){
  switch(key){
    case 'assess':return (assessRecords[ev.id]||[]).length+(examRecords[ev.id]||[]).length;
    case 'mdt':return (mdtRecords[ev.id]||[]).length;
    case 'consult':return (consultRecords[ev.id]||[]).length;
    case 'referral':return (referralRecords[ev.id]||[]).length;
    case 'path':return (pathRecords[ev.id]||[]).length;
    case 'fu':return (followupRecords[ev.id]||[]).length;
    case 'rehab':return rehabContracts[ev.id]?rehabContracts[ev.id].plan.length:0;
    case 'qc':return qcWorkOrders.filter(function(w){return w.patient===ev.patient}).length;
    default:return 0;
  }
}

/* ---------- 交互 ---------- */
function spRerenderDetail(){
  var container=document.getElementById('spDetailContainer');
  if(container&&_currentDetailEvent)container.innerHTML=renderDetailPanel(_currentDetailEvent.id);
}
window._spSwitchDetailTab=function(tab){
  _currentDetailTab=tab;
  spRerenderDetail();
};
window._spToggleSec=function(key){
  _spCollapsed[key]=!_spCollapsed[key];
  var el=document.getElementById('spf-sec-'+key);
  if(el){if(_spCollapsed[key])el.classList.add('collapsed');else el.classList.remove('collapsed');}
};
window._spEditProfile=function(){_spProfileEditing=true;spRerenderDetail()};
window._spCancelProfile=function(){_spProfileEditing=false;spRerenderDetail()};
window._spSaveProfile=function(){
  var ev=_currentDetailEvent;if(!ev)return;
  var p=patientProfiles[ev.id];if(!p)return;
  var next={};
  for(var pk in p){if(p.hasOwnProperty(pk))next[pk]=Array.isArray(p[pk])?p[pk].slice():p[pk]}
  SP_PROFILE_SECTIONS.forEach(function(sec){
    sec.fields.forEach(function(f){
      if(f.t==='region'){
        var parts=[];
        for(var i=0;i<5;i++){var s=document.getElementById('spf_region_'+i);if(s&&s.value)parts.push(s.value)}
        next.region=parts.join(' / ');
        return;
      }
      var el=document.getElementById('spf_'+f.k);
      if(!el)return;
      if(f.t==='tags')next.tags=el.value.split(/[，,、]/).map(function(s){return s.trim()}).filter(function(s){return s});
      else next[f.k]=String(el.value||'').trim();
    });
  });
  var error=spValidateProfile(next);
  if(error){toast(error,'error');return}
  patientProfiles[ev.id]=next;
  var ev0=tumorEvents.find(function(e){return e.id===ev.id});
  if(ev0){ev0.patient=next.name;ev0.sex=next.sex;ev0.idNo=next.idNo}
  _spProfileEditing=false;
  spRerenderDetail();
  var head=document.getElementById('spDetailHead');
  if(head)head.innerHTML=spDetailHeadHtml(ev0||ev);
  toast('患者档案已保存');
};
window._spRecFilter=function(tab,k,v){
  if(!_spFilters[tab])_spFilters[tab]={};
  _spFilters[tab][k]=v;
  spRerenderDetail();
};
window._spRecReset=function(tab){_spFilters[tab]={};spRerenderDetail()};
window._spViewRec=function(tab,i){
  var ev=_currentDetailEvent;if(!ev)return;
  if(tab==='mdt'){
    var m=(mdtRecords[ev.id]||[])[i];if(!m)return;
    spModal('MDT 讨论详情 · '+m.date,spDetailKv([['讨论主题',m.topic,true],['讨论日期',m.date],['主持人',m.host],['执行状态',badge(m.status,m.cls),true],['参与科室',m.depts,true],['讨论结论',m.opinion,true],['治疗方案',m.plan,true]]),'<button class="btn btn-ghost" onclick="var m=this.closest(\'.sp-modal-mask\');m&&m.remove()">关闭</button>');
    return;
  }
  if(tab==='rehab'){
    var c=rehabContracts[ev.id];if(!c)return;
    var r=c.plan[i];if(!r)return;
    spModal('康复履约详情 · '+r.date,spDetailKv([['计划日期',r.date],['履约项目',r.item],['履约人',r.doctor],['履约状态',badge(r.done,r.cls),true],['履约备注',r.note,true]]),'<button class="btn btn-ghost" onclick="var m=this.closest(\'.sp-modal-mask\');m&&m.remove()">关闭</button>');
    return;
  }
  var cfg=spRecConfig(tab,ev);if(!cfg)return;
  var row=spRecRowsOf(tab,ev)[i];if(!row)return;
  spModal(cfg.title+' · 详情',cfg.detail(row),'<button class="btn btn-ghost" onclick="var m=this.closest(\'.sp-modal-mask\');m&&m.remove()">关闭</button>');
};
window._spDelRec=function(tab,i){
  var ev=_currentDetailEvent;if(!ev)return;
  var nameMap={assess:'评估记录',mdt:'MDT记录',consult:'远程会诊记录',referral:'转诊记录',path:'病理记录',fu:'随访记录',rehab:'康复履约记录'};
  spModal('删除确认','<div style="padding:6px 0;font-size:var(--fs-body);color:var(--color-text-body)">确认删除该条'+esc(nameMap[tab]||'记录')+'？删除后不可恢复。</div>',
    '<button class="btn btn-ghost" onclick="var m=this.closest(\'.sp-modal-mask\');m&&m.remove()">取消</button><button class="btn btn-danger" onclick="window._spDelRecGo(\''+tab+'\','+i+')">确认删除</button>',true);
};
window._spDelRecGo=function(tab,i){
  var ev=_currentDetailEvent;if(!ev)return;
  spCloseModals();
  if(tab==='mdt'){(mdtRecords[ev.id]||[]).splice(i,1)}
  else if(tab==='rehab'){var rc=rehabContracts[ev.id];if(rc&&rc.plan)rc.plan.splice(i,1)}
  else{var m={assess:assessRecords,consult:consultRecords,referral:referralRecords,path:pathRecords,fu:followupRecords};if(m[tab])m[tab][ev.id].splice(i,1)}
  spRerenderDetail();
  toast('记录已删除');
};
window._spQcStep=function(id){
  var s=qcStatus[id]||'待处理';
  qcStatus[id]=s==='待处理'?'处理中':'已处理';
  spRerenderDetail();
  toast('工单 '+id+' 已更新为「'+qcStatus[id]+'」');
};
window._spAddRec=function(tab){
  var ev=_currentDetailEvent;if(!ev)return;
  var cfg,title;
  if(tab==='mdt'){
    title='发起 MDT 讨论';
    cfg=[{k:'date',l:'讨论日期',t:'date'},{k:'topic',l:'讨论主题',t:'text'},{k:'host',l:'主持人',t:'text'},{k:'status',l:'执行状态',t:'select',o:['执行中','已完成']},{k:'depts',l:'参与科室',t:'text',span:2},{k:'opinion',l:'讨论结论',t:'textarea',span:2},{k:'plan',l:'治疗方案',t:'textarea',span:2}];
  }else{
    var c=spRecConfig(tab,ev);if(!c||!c.form)return;
    title='新增'+c.title.replace(/记录$/,'');cfg=c.form;
  }
  var body='<div class="spf-form-grid">'+cfg.map(function(f){
    var spanCls=f.span===2?' span2':'';
    var ctrl='';
    if(f.t==='select')ctrl='<select id="spmf_'+f.k+'"><option value="">请选择'+esc(f.l)+'</option>'+f.o.map(function(o){return '<option>'+esc(o)+'</option>'}).join('')+'</select>';
    else if(f.t==='textarea')ctrl='<textarea id="spmf_'+f.k+'" placeholder="请输入'+esc(f.l)+'"></textarea>';
    else if(f.t==='date')ctrl='<input type="date" id="spmf_'+f.k+'">';
    else ctrl='<input type="text" id="spmf_'+f.k+'" placeholder="'+esc(f.ph||('请输入'+f.l))+'">';
    return '<div class="spf-item'+(f.t==='textarea'?' area':'')+spanCls+'"><span class="spf-label">'+esc(f.l)+'</span><div class="spf-ctrl">'+ctrl+'</div></div>';
  }).join('')+'</div>';
  spModal(title,body,'<button class="btn btn-ghost" onclick="var m=this.closest(\'.sp-modal-mask\');m&&m.remove()">取消</button><button class="btn btn-primary" onclick="window._spAddRecSave(\''+tab+'\')">保存</button>');
};
window._spAddRecSave=function(tab){
  var ev=_currentDetailEvent;if(!ev)return;
  var cfg,title;
  if(tab==='mdt'){
    title='发起 MDT 讨论';
    cfg=[{k:'date',l:'讨论日期',t:'text'},{k:'topic',l:'讨论主题',t:'text'},{k:'host',l:'主持人',t:'text'},{k:'status',l:'执行状态',t:'text'},{k:'depts',l:'参与科室',t:'text'},{k:'opinion',l:'讨论结论',t:'text'},{k:'plan',l:'治疗方案',t:'text'}];
  }else{
    var c=spRecConfig(tab,ev);if(!c)return;cfg=c.form;title=c.title;
  }
  var obj={},missing=null;
  cfg.forEach(function(f){
    var el=document.getElementById('spmf_'+f.k);
    var v=el?String(el.value||'').trim():'';
    if(!v&&f.k!=='note'&&!missing&&f.l.indexOf('备注')<0)missing=f.l;
    obj[f.k]=v;
  });
  if(missing){toast('请填写「'+missing+'」','error');return}
  if(tab==='mdt'){obj.cls=obj.status==='已完成'?'badge-success':'badge-info';(mdtRecords[ev.id]=mdtRecords[ev.id]||[]).push(obj)}
  else{
    var m={assess:assessRecords,consult:consultRecords,referral:referralRecords,path:pathRecords,fu:followupRecords};
    if(tab==='assess')obj.cls=obj.level==='高危'||obj.level==='高度风险'?'badge-danger':(obj.level.indexOf('中')>=0?'badge-orange':'badge-success');
    if(tab==='consult')obj.cls=obj.status==='已完成'?'badge-success':obj.status==='待受理'?'badge-caution':'badge-info';
    if(tab==='referral')obj.cls=obj.status==='已接收'?'badge-success':obj.status==='已退回'?'badge-danger':'badge-caution';
    if(tab==='path')obj.status=obj.status||'待审核';
    (m[tab][ev.id]=m[tab][ev.id]||[]).push(obj);
  }
  spCloseModals();
  spRerenderDetail();
  toast('记录已新增');
};

/* ---------- 详情头部 ---------- */
function spDetailHeadHtml(ev){
  var p=spProfileOf(ev);
  return '<div class="sp-patient-avatar">'+esc(String(ev.patient||'').charAt(0))+'</div>'+
    '<div style="min-width:0"><div class="sp-patient-name">'+esc(ev.patient)+
    '<span class="sp-patient-meta">'+esc(ev.sex)+' · '+ev.age+'岁 · '+esc(spMaskIdNo(p.idNo||ev.idNo))+'</span></div>'+
    '<div class="sp-patient-sub">'+esc(p.region||ev.region)+' · 建档 '+esc(p.archiveDate||'—')+' · '+esc(p.source||'—')+'</div></div>'+
    '<div class="sp-patient-badges">'+badge(ev.diagnosis,'badge-info')+badge(ev.stage,'badge-neutral')+badge(ev.phase,ev.phase==='治疗中'?'badge-info':ev.phase==='随访中'?'badge-success':'badge-danger')+badge(p.status||'—','badge-accent')+'</div>'+
    '<div class="sp-patient-score"><div class="k">质控分</div><div class="v">'+ev.qcScore+'</div></div>';
}
window._spOpenDetail=function(eventId){
  _currentDetailTab='basic';_spProfileEditing=false;_spCollapsed={};_spFilters={};
  var main=document.getElementById('spMainContent');
  if(!main)return;
  var ev=tumorEvents.find(function(e){return e.id===eventId});
  if(!ev)return;
  _currentDetailEvent=ev;
  main.innerHTML='<div class="sp-detail-shell"><div class="sp-detail-back"><button class="btn btn-ghost btn-sm" onclick="renderSpecialtyPortrait()">← 返回画像工作台</button></div>'+
    '<div class="sp-patient-strip" id="spDetailHead">'+spDetailHeadHtml(ev)+'</div>'+
    '<div id="spDetailContainer">'+renderDetailPanel(eventId)+'</div></div>';
  var sc=document.getElementById('spMainContent');
  if(sc&&sc.scrollIntoView)sc.scrollIntoView({block:'start'});
};

/* ===================== 主渲染入口 ===================== */
var _spCurrentSubPage = 'workbench';

function render(subPage){
  if(subPage){_spCurrentSubPage=subPage;}
  
  // Header and Tabs UI removed per user request, but logic preserved for left-nav switching
  var content='';
  if(_spCurrentSubPage==='workbench') content=renderWorkbench();
  else if(_spCurrentSubPage==='stats') content=renderStats();

  return '<div style="padding:0"><div id="spMainContent">'+content+'</div></div>';
}

window._spSwitchSubPage=function(page){
  _spCurrentSubPage=page;
  var pc=document.getElementById('pageContainer');
  if(pc){pc.innerHTML=render();}
  if(typeof updateBreadcrumb==='function')updateBreadcrumb('specialty-portrait',page==='stats'?'画像统计':'画像工作台');
  if(typeof setActiveMenu==='function'){var menuId=page==='stats'?'sp-stats':'sp-workbench';setActiveMenu(menuId);}
};

window.renderSpecialtyPortrait=render;
})();

