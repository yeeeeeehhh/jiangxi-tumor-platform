/* 肿瘤专科画像 V6 — 患者画像 / 指标汇总 / 配置质控 三层架构
   01 患者专科画像：五维画像（患者特征/疾病特征/诊疗特征/患者状态/随访与结局）+ 画像时间线
   02 画像指标汇总：卫健委视角，全省→地市→医院→病种聚合
   03 画像配置：要素元数据 / 映射规则 / 智能校验 / 质控报告 / 预警 / 版本 / 归档
   全部指标由患者画像字段实时聚合，不重复采集数据 */
(function(){ 'use strict';
var SP_BUILD='V6.4-tabs@20260911g';
if(typeof console!=='undefined')console.log('[specialty-portrait] '+SP_BUILD+' loaded');

/* ===================== 样式 ===================== */
var spStyle=document.createElement('style');
spStyle.textContent=`
.sp-filter-bar{display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;padding:14px;background:var(--color-bg-subtle);border:1px solid var(--color-border);border-radius:var(--radius-md);margin-bottom:14px}
.sp-filter-bar .form-group{width:170px}
.sp-filter-bar .form-group.wide{width:240px}
.sp-filter-actions{margin-left:auto;display:flex;gap:8px}
.sp-table-wrap{overflow-x:auto}
.sp-stat-row{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:14px;margin-bottom:18px}
.sp-stat-card{background:var(--surface);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:14px 16px;box-shadow:var(--shadow-xs)}
.sp-stat-label{font-size:var(--fs-sm);color:var(--color-text-muted)}
.sp-stat-value{font-size:var(--fs-stat);font-weight:700;color:var(--color-primary);margin-top:4px;font-family:var(--font-num)}
.sp-stat-sub{font-size:var(--fs-xs);color:var(--color-text-muted);margin-top:4px}
.sp-mini-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.sp-mini{background:var(--color-bg-subtle);border-radius:var(--radius-sm);padding:10px 12px}
.sp-mini .k{font-size:var(--fs-xs);color:var(--color-text-muted)}
.sp-mini .v{font-size:18px;font-weight:700;font-family:var(--font-num);color:var(--color-text-title);margin-top:3px}
.sp-mini .v em{font-style:normal;font-size:11px;color:var(--color-text-muted)}
.sp-ov-grid{display:grid;grid-template-columns:minmax(340px,1.05fr) minmax(300px,1fr);gap:16px;margin-bottom:16px}
.sp-map-tip{display:flex;gap:6px;align-items:center;margin-bottom:10px;flex-wrap:wrap}
.sp-map-tip .btn-sm{height:26px;padding:0 10px;font-size:12px}
.sp-mapsvg{display:block;width:100%;height:360px}
.sp-map-legend{display:flex;gap:14px;align-items:center;flex-wrap:wrap;padding:8px 4px 0;font-size:var(--fs-xs);color:var(--color-text-muted)}
.sp-map-legend i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:5px;vertical-align:-1px}
.sp-ov-side{display:flex;flex-direction:column;gap:12px;min-width:0}
.sp-ov-side .panel{margin:0}
.sp-map-rank{display:flex;flex-direction:column;gap:9px}
.sp-map-rank-item{display:flex;align-items:center;gap:10px;cursor:pointer;border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:7px 10px;background:var(--surface);transition:border-color var(--dur-fast),background var(--dur-fast)}
.sp-map-rank-item:hover{border-color:var(--color-primary)}
.sp-map-rank-item.sel{border-color:var(--color-primary);background:var(--color-primary-soft)}
.sp-map-rank-idx{width:20px;height:20px;border-radius:6px;background:var(--color-bg-subtle);color:var(--color-text-muted);font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;font-family:var(--font-num);flex:0 0 20px}
.sp-map-rank-name{flex:1;min-width:0;font-size:var(--fs-sm);font-weight:600;color:var(--color-text-title);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sp-map-rank-val{font-size:var(--fs-sm);font-weight:700;color:var(--color-primary);font-family:var(--font-num)}
.sp-map-rank-sub{font-size:var(--fs-xs);color:var(--color-text-muted);font-family:var(--font-num)}
.sp-site-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:14px}
.sp-site-card{background:var(--surface);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:14px 16px;box-shadow:var(--shadow-xs);cursor:pointer;transition:border-color var(--dur-fast)}
.sp-site-card:hover{border-color:var(--color-primary)}
.sp-site-card.sel{border-color:var(--color-primary);box-shadow:0 0 0 1px var(--color-primary)}
.sp-site-head{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.sp-site-dot{width:10px;height:10px;border-radius:3px;flex:0 0 10px}
.sp-site-name{font-size:var(--fs-body);font-weight:700;color:var(--color-text-title)}
.sp-site-head .spr-count{margin-left:auto}
.sp-site-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}
.sp-site-kpi{background:var(--color-bg-subtle);border-radius:var(--radius-xs);padding:8px 10px}
.sp-site-kpi .k{font-size:var(--fs-2xs);color:var(--color-text-muted)}
.sp-site-kpi .v{font-size:16px;font-weight:700;font-family:var(--font-num);color:var(--color-text-title);margin-top:2px}
.sp-site-kpi .v em{font-style:normal;font-size:11px;color:var(--color-text-muted);margin-left:2px}
.sp-domain-tabs{display:flex;gap:2px;border-bottom:2px solid var(--color-border);margin-bottom:16px;overflow-x:auto}
.sp-domain-tab{flex:0 0 auto;padding:10px 18px;border:0;background:transparent;color:var(--color-text-muted);cursor:pointer;font-weight:600;font-size:var(--fs-body);border-bottom:2px solid transparent;margin-bottom:-2px}
.sp-domain-tab:hover{color:var(--color-primary)}
.sp-domain-tab.active{color:var(--color-primary);border-bottom-color:var(--color-primary)}
.sp-2col{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.spr-count{font-size:var(--fs-xs);color:var(--color-text-muted);font-weight:400;margin-left:8px}
/* ---- 配置质控补充组件 ---- */
.sp-progress{height:8px;border-radius:999px;background:var(--color-bg-subtle);overflow:hidden}
.sp-progress i{display:block;height:100%;border-radius:999px;transition:width .3s}
.sp-chart-empty{height:220px;display:flex;align-items:center;justify-content:center;color:var(--color-text-muted);font-size:var(--fs-sm)}
.sp-btn-red{background:#dc2626!important;color:#fff!important;border-color:#dc2626!important}
.sp-btn-red:hover{background:#b91c1c!important;border-color:#b91c1c!important}
.sp-form-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px 16px}
.sp-form-row{display:flex;flex-direction:column;gap:5px}
.sp-form-row label{font-size:var(--fs-xs);color:var(--color-text-muted)}
.sp-form-row input:not([type=checkbox]):not([type=radio]),.sp-form-row select{height:34px;padding:0 10px;border:1px solid var(--color-border-strong);border-radius:6px;font-size:var(--fs-body);background:var(--surface);color:var(--color-text-body)}
/* ---- 01 患者详情：摘要条 + 五块画像 + 时间线 ---- */
.sp-detail-shell{min-width:0}
.sp-detail-back{display:flex;align-items:center;margin-bottom:10px}
.sp-patient-strip{display:grid;grid-template-columns:auto minmax(240px,1.25fr) minmax(300px,1fr) auto;align-items:center;gap:14px;padding:12px 16px;margin-bottom:14px;background:var(--surface);border:1px solid var(--color-border);border-radius:var(--radius-md);box-shadow:var(--shadow-xs)}
.sp-patient-avatar{width:42px;height:42px;border-radius:50%;background:var(--color-primary-soft);color:var(--color-primary);display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:700}
.sp-patient-name{display:flex;align-items:baseline;gap:10px;min-width:0;font-size:var(--fs-h2);font-weight:700;color:var(--color-text-title);flex-wrap:wrap}
.sp-patient-meta{font-size:var(--fs-xs);font-weight:500;color:var(--color-text-muted);white-space:nowrap}
.sp-patient-sub{margin-top:3px;font-size:var(--fs-xs);color:var(--color-text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sp-patient-badges{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.sp-patient-score{text-align:right;min-width:50px}
.sp-patient-score .k{font-size:var(--fs-2xs);color:var(--color-text-muted)}
.sp-patient-score .v{font-size:24px;font-weight:700;font-family:var(--font-num);color:var(--color-primary);line-height:1.05}
.sp-profile-blocks{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-bottom:16px}
.sp-profile-block{background:var(--surface);border:1px solid var(--color-border);border-radius:var(--radius-md);box-shadow:var(--shadow-xs);min-width:0}
.sp-block-head{display:flex;align-items:center;gap:8px;padding:11px 14px;border-bottom:1px solid var(--color-border);flex-wrap:wrap}
.sp-block-idx{width:22px;height:22px;border-radius:6px;background:var(--color-primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex:0 0 22px}
.sp-block-title{font-size:var(--fs-body);font-weight:700;color:var(--color-text-title)}
.sp-block-tags{margin-left:auto;display:flex;gap:5px;flex-wrap:wrap}
.sp-block-body{padding:12px 14px}
.sp-kv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px 16px}
.sp-kv-item{display:flex;flex-direction:column;gap:2px;padding:7px 0;border-bottom:1px dashed var(--color-border);min-width:0}
.sp-kv-item .k{font-size:var(--fs-xs);color:var(--color-text-muted)}
.sp-kv-item .v{font-size:var(--fs-body);color:var(--color-text-title);font-weight:500;word-break:break-all}
.sp-timeline{position:relative;padding-left:24px;margin:12px 0}
.sp-timeline::before{content:'';position:absolute;left:7px;top:4px;bottom:4px;width:2px;background:var(--color-border)}
.sp-tl-item{position:relative;padding-bottom:14px}
.sp-tl-item::before{content:'';position:absolute;left:-20px;top:6px;width:10px;height:10px;border-radius:50%;background:var(--color-primary);border:2px solid var(--surface)}
.sp-tl-date{font-size:var(--fs-xs);color:var(--color-text-muted);margin-bottom:2px}
.sp-tl-content{font-size:var(--fs-body);color:var(--color-text-body)}
@media(max-width:1280px){.sp-stat-row{grid-template-columns:repeat(3,1fr)}.sp-ov-grid{grid-template-columns:1fr}}
@media(max-width:900px){.sp-2col{grid-template-columns:1fr}.sp-profile-blocks{grid-template-columns:1fr}.sp-patient-strip{grid-template-columns:auto 1fr}.sp-patient-badges{grid-column:1/-1}}
@media(max-width:768px){.sp-stat-row{grid-template-columns:repeat(2,1fr)}.sp-filter-bar{flex-direction:column}.sp-filter-bar .form-group,.sp-filter-bar .form-group.wide{width:100%}.sp-filter-actions{margin-left:0;width:100%}.sp-mini-grid{grid-template-columns:repeat(2,1fr)}}
`;
document.head.appendChild(spStyle);


/* ===================== 一、数据层：患者画像 Schema（五维） ===================== */
var SP_CITIES=['南昌市','景德镇市','萍乡市','九江市','新余市','鹰潭市','赣州市','吉安市','宜春市','抚州市','上饶市'];
var SP_SITES=['肺','乳腺','肝','胃','结直肠','宫颈','食管'];
var SP_STAGE_GROUPS=['I期','II期','III期','IV期'];
var SP_STAGE_COLORS={'I期':'#10b981','II期':'#2563eb','III期':'#f59e0b','IV期':'#ef4444'};
var SP_HOSP_CITY={'江西省肿瘤医院':'南昌市','南昌市第一医院':'南昌市','赣州市人民医院':'赣州市','九江市第一人民医院':'九江市','上饶市肿瘤医院':'上饶市','宜春市人民医院':'宜春市','吉安市中心医院':'吉安市','抚州市第一医院':'抚州市','景德镇市第一医院':'景德镇市','萍乡市人民医院':'萍乡市','新余市人民医院':'新余市','鹰潭市人民医院':'鹰潭市'};

var tumorEvents=[
{id:'TE001',patient:'陈建国',sex:'男',age:63,idNo:'360102196305121234',region:'南昌市东湖区',city:'南昌市',insurance:'职工医保',firstHosp:'东湖区董家窑街道社区卫生服务中心',firstDate:'2026-01-18',source:'社区筛查',hospital:'南昌市第一医院',
 site:'肺',laterality:'右肺上叶',path:'腺癌',grade:'中分化',tNm:'cT2aN2M0',stage:'III期',stageDate:'2026-06-18',metastasis:'区域淋巴结转移',multiPrimary:false,
 treatMode:['手术','化疗'],mdt:true,referral:true,curPhase:'辅助化疗中',phaseTimeline:'手术(2026-02-05)→辅助化疗中(第3/6周期)',
 symptom:'偶有干咳',pain:'轻度疼痛',nutrition:'中度营养风险',physical:'ECOG 1',complication:'无严重并发症',ae:'I度骨髓抑制',rehab:'康复中',supportive:'营养支持',
 lastFu:'2026-08-25',followStatus:'随访中',recurrence:false,metaProgress:'无',diseaseProgress:false,vitalStatus:'存活',deathCause:'',lostFollow:false},
{id:'TE002',patient:'刘雅琴',sex:'女',age:47,idNo:'360702197808152345',region:'赣州市章贡区',city:'赣州市',insurance:'职工医保',firstHosp:'章贡区南外街道社区卫生服务中心',firstDate:'2026-03-20',source:'两癌筛查',hospital:'江西省肿瘤医院',
 site:'乳腺',laterality:'左乳',path:'浸润性导管癌',grade:'II级',tNm:'cT2N1M0',stage:'II期',stageDate:'2026-03-27',metastasis:'同侧腋窝淋巴结转移',multiPrimary:false,
 treatMode:['手术','化疗','内分泌'],mdt:true,referral:true,curPhase:'内分泌维持中',phaseTimeline:'手术(2026-04-08)→化疗完成(2026-08-24)→内分泌维持中',
 symptom:'无',pain:'无痛',nutrition:'无营养风险',physical:'ECOG 0',complication:'无严重并发症',ae:'无',rehab:'康复良好',supportive:'无',
 lastFu:'2026-08-24',followStatus:'随访中',recurrence:false,metaProgress:'无',diseaseProgress:false,vitalStatus:'存活',deathCause:'',lostFollow:false},
{id:'TE003',patient:'赵德顺',sex:'男',age:74,idNo:'360402195502283456',region:'九江市浔阳区',city:'九江市',insurance:'城乡居民',firstHosp:'浔阳区甘棠街道卫生院',firstDate:'2026-07-08',source:'医院登记',hospital:'九江市第一人民医院',
 site:'胃',laterality:'胃窦',path:'低分化腺癌',grade:'低分化',tNm:'cT4aN2M1',stage:'IV期',stageDate:'2026-07-10',metastasis:'腹膜转移',multiPrimary:false,
 treatMode:['化疗'],mdt:true,referral:true,curPhase:'姑息治疗中',phaseTimeline:'MDT评估(2026-07-12)→姑息一线化疗中(第3/6周期)',
 symptom:'上腹隐痛',pain:'中度疼痛',nutrition:'高度营养风险',physical:'ECOG 2',complication:'不全肠梗阻',ae:'II度骨髓抑制',rehab:'支持治疗为主',supportive:'肠外营养+安宁疗护',
 lastFu:'2026-08-26',followStatus:'随访中',recurrence:false,metaProgress:'腹膜转移',diseaseProgress:true,vitalStatus:'存活（带瘤）',deathCause:'',lostFollow:false},
{id:'TE004',patient:'王秀兰',sex:'女',age:54,idNo:'361100198006125871',region:'上饶市信州区',city:'上饶市',insurance:'职工医保',firstHosp:'信州区西市街道社区卫生服务中心',firstDate:'2026-02-15',source:'社区筛查',hospital:'上饶市肿瘤医院',
 site:'肝',laterality:'右肝后叶',path:'肝细胞癌',grade:'中分化',tNm:'cT3N0M0',stage:'III期',stageDate:'2026-02-20',metastasis:'无远处转移',multiPrimary:false,
 treatMode:['手术','介入'],mdt:true,referral:true,curPhase:'术后随访中',phaseTimeline:'手术(2026-03-02)→TACE介入(2026-06-15)→术后随访中',
 symptom:'无',pain:'无痛',nutrition:'无营养风险',physical:'ECOG 0',complication:'无严重并发症',ae:'无',rehab:'康复良好',supportive:'无',
 lastFu:'2026-07-20',followStatus:'随访中',recurrence:false,metaProgress:'无',diseaseProgress:false,vitalStatus:'存活',deathCause:'',lostFollow:false},
{id:'TE005',patient:'李志强',sex:'男',age:66,idNo:'361000196011152330',region:'宜春市袁州区',city:'宜春市',insurance:'职工医保',firstHosp:'袁州区化成街道社区卫生服务中心',firstDate:'2026-04-12',source:'门诊登记',hospital:'宜春市人民医院',
 site:'肺',laterality:'左肺下叶',path:'鳞状细胞癌',grade:'中分化',tNm:'cT2bN2M0',stage:'III期',stageDate:'2026-04-18',metastasis:'区域淋巴结转移',multiPrimary:false,
 treatMode:['手术','放疗','化疗'],mdt:true,referral:true,curPhase:'同步放化疗中',phaseTimeline:'手术(2026-05-10)→同步放化疗中(第4/6周期)',
 symptom:'偶有胸闷',pain:'轻度疼痛',nutrition:'无营养风险',physical:'ECOG 1',complication:'无严重并发症',ae:'II度放射性食管炎',rehab:'康复中',supportive:'营养支持',
 lastFu:'2026-08-30',followStatus:'随访中',recurrence:false,metaProgress:'无',diseaseProgress:false,vitalStatus:'存活',deathCause:'',lostFollow:false},
{id:'TE006',patient:'周桂香',sex:'女',age:69,idNo:'360300196509120826',region:'景德镇市珠山区',city:'景德镇市',insurance:'城镇居民',firstHosp:'珠山区里村街道社区卫生服务中心',firstDate:'2026-05-06',source:'社区筛查',hospital:'景德镇市第一医院',
 site:'宫颈',laterality:'宫颈',path:'鳞状细胞癌',grade:'中分化',tNm:'cT2bN1M0',stage:'II期',stageDate:'2026-05-11',metastasis:'区域淋巴结转移',multiPrimary:false,
 treatMode:['手术','放疗'],mdt:false,referral:true,curPhase:'根治性放疗中',phaseTimeline:'手术(2026-05-20)→根治性放疗中(第3/6周期)',
 symptom:'偶有接触性出血',pain:'轻度疼痛',nutrition:'无营养风险',physical:'ECOG 1',complication:'无严重并发症',ae:'I度骨髓抑制',rehab:'康复中',supportive:'无',
 lastFu:'2026-08-25',followStatus:'随访中',recurrence:false,metaProgress:'无',diseaseProgress:false,vitalStatus:'存活',deathCause:'',lostFollow:false},
{id:'TE007',patient:'吴建国',sex:'男',age:58,idNo:'360500198108203456',region:'萍乡市安源区',city:'萍乡市',insurance:'职工医保',firstHosp:'安源区后埠街道社区卫生服务中心',firstDate:'2026-06-20',source:'医院登记',hospital:'南昌市第一医院',
 site:'结直肠',laterality:'直肠',path:'腺癌',grade:'中分化',tNm:'cT3N1M0',stage:'III期',stageDate:'2026-06-25',metastasis:'区域淋巴结转移',multiPrimary:false,
 treatMode:['手术','化疗'],mdt:true,referral:true,curPhase:'辅助化疗中',phaseTimeline:'手术(2026-07-02)→辅助化疗中(第2/6周期)',
 symptom:'无',pain:'无痛',nutrition:'无营养风险',physical:'ECOG 0',complication:'无严重并发症',ae:'无',rehab:'康复良好',supportive:'无',
 lastFu:'2026-09-05',followStatus:'随访中',recurrence:false,metaProgress:'无',diseaseProgress:false,vitalStatus:'存活',deathCause:'',lostFollow:false},
{id:'TE008',patient:'胡爱莲',sex:'女',age:61,idNo:'360800198209165234',region:'抚州市临川区',city:'抚州市',insurance:'城镇居民',firstHosp:'临川区青云街道社区卫生服务中心',firstDate:'2026-07-25',source:'门诊登记',hospital:'江西省肿瘤医院',
 site:'乳腺',laterality:'右乳',path:'浸润性导管癌',grade:'III级',tNm:'cT2N2M1',stage:'IV期',stageDate:'2026-07-28',metastasis:'骨转移/肝转移',multiPrimary:false,
 treatMode:['化疗','靶向'],mdt:true,referral:true,curPhase:'一线治疗中',phaseTimeline:'MDT评估(2026-07-30)→化疗+靶向治疗中(第2/6周期)',
 symptom:'骨转移灶疼痛',pain:'重度疼痛',nutrition:'中度营养风险',physical:'ECOG 2',complication:'病理性骨折(肋骨)',ae:'II度骨髓抑制',rehab:'支持治疗为主',supportive:'镇痛治疗',
 lastFu:'2026-09-02',followStatus:'随访中',recurrence:false,metaProgress:'骨转移/肝转移',diseaseProgress:true,vitalStatus:'存活（带瘤）',deathCause:'',lostFollow:false},
{id:'TE009',patient:'欧阳明轩',sex:'男',age:52,idNo:'362400197403121243',region:'吉安市吉州区',city:'吉安市',insurance:'城镇居民',firstHosp:'吉州区古南镇卫生院',firstDate:'2026-08-01',source:'医院登记',hospital:'吉安市中心医院',
 site:'食管',laterality:'胸中段食管',path:'鳞状细胞癌',grade:'中分化',tNm:'cT3N1M0',stage:'III期',stageDate:'2026-08-05',metastasis:'区域淋巴结转移',multiPrimary:false,
 treatMode:['放疗','化疗'],mdt:true,referral:true,curPhase:'根治性同步放化疗中',phaseTimeline:'确诊(2026-08-05)→根治性同步放化疗中(第3/6周期)',
 symptom:'进食梗阻感',pain:'轻度疼痛',nutrition:'中度营养风险',physical:'ECOG 1',complication:'无严重并发症',ae:'II度放射性食管炎',rehab:'康复中',supportive:'营养支持',
 lastFu:'2026-09-08',followStatus:'随访中',recurrence:false,metaProgress:'无',diseaseProgress:false,vitalStatus:'存活',deathCause:'',lostFollow:false},
{id:'TE010',patient:'邓三妹',sex:'女',age:63,idNo:'360800196306128475',region:'抚州市临川区',city:'抚州市',insurance:'城镇居民',firstHosp:'临川区青云街道社区卫生服务中心',firstDate:'2026-06-01',source:'社区筛查',hospital:'抚州市第一医院',
 site:'宫颈',laterality:'宫颈',path:'鳞状细胞癌',grade:'中分化',tNm:'cT2bN1M0',stage:'II期',stageDate:'2026-06-05',metastasis:'区域淋巴结转移',multiPrimary:false,
 treatMode:['手术','化疗'],mdt:true,referral:true,curPhase:'辅助化疗中',phaseTimeline:'手术(2026-06-12)→辅助化疗中(第2/6周期)',
 symptom:'无',pain:'无痛',nutrition:'无营养风险',physical:'ECOG 1',complication:'无严重并发症',ae:'I度骨髓抑制',rehab:'康复良好',supportive:'无',
 lastFu:'2026-08-20',followStatus:'随访中',recurrence:false,metaProgress:'无',diseaseProgress:false,vitalStatus:'存活',deathCause:'',lostFollow:false},
{id:'TE011',patient:'赵梅英',sex:'女',age:59,idNo:'360200196602056578',region:'鹰潭市月湖区',city:'鹰潭市',insurance:'职工医保',firstHosp:'月湖区交通街道社区卫生服务中心',firstDate:'2026-05-18',source:'门诊登记',hospital:'鹰潭市人民医院',
 site:'结直肠',laterality:'乙状结肠',path:'腺癌',grade:'中分化',tNm:'cT3N1M0',stage:'III期',stageDate:'2026-05-22',metastasis:'区域淋巴结转移',multiPrimary:false,
 treatMode:['手术','化疗'],mdt:false,referral:true,curPhase:'术后随访中',phaseTimeline:'手术(2026-06-01)→辅助化疗完成(2026-08-28)→术后随访中',
 symptom:'无',pain:'无痛',nutrition:'无营养风险',physical:'ECOG 0',complication:'无严重并发症',ae:'无',rehab:'康复良好',supportive:'无',
 lastFu:'2026-09-01',followStatus:'随访中',recurrence:false,metaProgress:'无',diseaseProgress:false,vitalStatus:'存活',deathCause:'',lostFollow:false},
{id:'TE012',patient:'章含韵',sex:'女',age:45,idNo:'360502198301125628',region:'新余市渝水区',city:'新余市',insurance:'职工医保',firstHosp:'渝水区城北街道社区卫生服务中心',firstDate:'2026-06-08',source:'社区筛查',hospital:'新余市人民医院',
 site:'乳腺',laterality:'左乳',path:'浸润性导管癌',grade:'II级',tNm:'cT1N0M0',stage:'I期',stageDate:'2026-06-12',metastasis:'无',multiPrimary:false,
 treatMode:['手术','放疗'],mdt:false,referral:false,curPhase:'术后随访中',phaseTimeline:'手术(2026-06-20)→术后随访中',
 symptom:'无',pain:'无痛',nutrition:'无营养风险',physical:'ECOG 0',complication:'无严重并发症',ae:'无',rehab:'康复良好',supportive:'无',
 lastFu:'2026-06-21',followStatus:'失访',recurrence:false,metaProgress:'无',diseaseProgress:false,vitalStatus:'失访',deathCause:'',lostFollow:true},
{id:'TE013',patient:'陈爱国',sex:'男',age:78,idNo:'360103194805121234',region:'南昌市西湖区',city:'南昌市',insurance:'职工医保',firstHosp:'浙江大学医学院附属第一医院',provOut:true,firstDate:'2024-12-15',source:'医院登记',hospital:'南昌市第一医院',
 site:'肝',laterality:'右肝后叶',path:'肝细胞癌',grade:'中分化',tNm:'pT3N0M0',stage:'III期',stageDate:'2024-12-20',metastasis:'无远处转移',multiPrimary:false,
 treatMode:['手术'],mdt:false,referral:true,curPhase:'术后随访中',phaseTimeline:'外省手术(2024-12-28)→回赣随访',
 symptom:'无',pain:'无痛',nutrition:'未填',physical:'ECOG 1',complication:'无严重并发症',ae:'无',rehab:'康复良好',supportive:'无',
 lastFu:'2026-06-10',followStatus:'死亡结案',recurrence:false,metaProgress:'无',diseaseProgress:false,vitalStatus:'死亡',deathCause:'肝功能衰竭',lostFollow:false}
];

/* 病种费用参数（经济负担板块） */
var SP_SITE_COST={
 '肺':{ip:52000,drug:38,ins:58},'乳腺':{ip:46000,drug:42,ins:61},'肝':{ip:58000,drug:35,ins:55},
 '胃':{ip:49000,drug:40,ins:57},'结直肠':{ip:44000,drug:36,ins:60},'宫颈':{ip:36000,drug:31,ins:64},'食管':{ip:41000,drug:33,ins:59}
};
var SP_MODE_COST=[
 {mode:'手术',cost:46000,unit:'次'},{mode:'放疗',cost:33000,unit:'全程'},{mode:'化疗',cost:21000,unit:'年累计'},
 {mode:'靶向',cost:86000,unit:'年累计'},{mode:'免疫',cost:92000,unit:'年累计'},{mode:'内分泌',cost:12000,unit:'年累计'},{mode:'介入',cost:38000,unit:'次'}
];


/* ===================== 二、工具与聚合引擎 ===================== */
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function badge(text,cls){return '<span class="badge '+(cls||'badge-neutral')+'">'+esc(text)+'</span>'}
function spHasMode(e,m){return (e.treatMode||[]).indexOf(m)>=0}
function spEarly(e){return e.stage==='I期'||e.stage==='II期'}
function spLate(e){return e.stage==='IV期'}
function spOutCity(e){var hc=SP_HOSP_CITY[e.hospital];return !!hc&&hc!==e.city}
function spDistant(e){return /(骨|肝|肺|脑|腹膜)转移/.test(e.metastasis||'')}
function spMaskIdNo(v){var s=String(v||'');return s.length>=10?s.slice(0,6)+'********'+s.slice(-4):s}
function spScopeEvents(sc){
  sc=sc||{};
  return tumorEvents.filter(function(e){
    if(sc.city&&e.city!==sc.city)return false;
    if(sc.site&&e.site!==sc.site)return false;
    return true;
  });
}
function spAgg(list){
  var n=list.length;
  function rate(f){return n?+(list.filter(f).length/n*100).toFixed(1):0}
  var alive=list.filter(function(e){return e.vitalStatus.indexOf('存活')>=0}).length;
  var lost=list.filter(function(e){return e.lostFollow}).length;
  return {
    total:n,
    male:list.filter(function(e){return e.sex==='男'}).length,
    female:list.filter(function(e){return e.sex==='女'}).length,
    newYear:list.filter(function(e){return (e.stageDate||'').indexOf('2026')===0}).length,
    earlyRate:rate(spEarly),lateRate:rate(spLate),
    crossCityRate:rate(spOutCity),crossProvRate:rate(function(e){return !!e.provOut}),
    localTreatRate:rate(function(e){return !spOutCity(e)}),
    surgeryRate:rate(function(e){return spHasMode(e,'手术')}),
    radioRate:rate(function(e){return spHasMode(e,'放疗')}),
    chemoRate:rate(function(e){return spHasMode(e,'化疗')}),
    targetRate:rate(function(e){return spHasMode(e,'靶向')}),
    immunoRate:rate(function(e){return spHasMode(e,'免疫')}),
    endocrineRate:rate(function(e){return spHasMode(e,'内分泌')}),
    interRate:rate(function(e){return spHasMode(e,'介入')}),
    mdtRate:rate(function(e){return !!e.mdt}),
    referralRate:rate(function(e){return !!e.referral}),
    comboRate:rate(function(e){return (e.treatMode||[]).length>=2}),
    pallRate:rate(function(e){return e.curPhase.indexOf('姑息')>=0||e.supportive.indexOf('安宁')>=0}),
    fuRate:rate(function(e){return e.followStatus!=='失访'}),
    lostRate:rate(function(e){return e.lostFollow}),
    recurRate:rate(function(e){return !!e.recurrence}),
    metaRate:rate(function(e){return !!e.metaProgress&&e.metaProgress!=='无'}),
    progRate:rate(function(e){return !!e.diseaseProgress}),
    distantRate:rate(spDistant),
    deathRate:rate(function(e){return e.vitalStatus==='死亡'}),
    alive:alive,lost:lost,dead:list.filter(function(e){return e.vitalStatus==='死亡'}).length,
    effSurvival:(n-lost)?+(alive/(n-lost)*100).toFixed(1):0
  };
}
function spAgeDist(list){
  var groups=[['0-39',0,39],['40-49',40,49],['50-59',50,59],['60-69',60,69],['70及以上',70,200]];
  return groups.map(function(g){
    var sub=list.filter(function(e){return e.age>=g[1]&&e.age<=g[2]});
    return {k:g[0],m:sub.filter(function(e){return e.sex==='男'}).length,f:sub.filter(function(e){return e.sex==='女'}).length,n:sub.length};
  });
}
function spSiteRows(list){
  return SP_SITES.map(function(s){
    var sub=list.filter(function(e){return e.site===s});
    return {site:s,n:sub.length,agg:spAgg(sub),list:sub};
  }).filter(function(r){return r.n>0});
}
function spCityRows(list){
  return SP_CITIES.map(function(c){
    var sub=list.filter(function(e){return e.city===c});
    return {city:c,n:sub.length,agg:spAgg(sub),list:sub};
  });
}
function spStageItems(list){
  return SP_STAGE_GROUPS.map(function(s){
    return {k:s,v:list.filter(function(e){return e.stage===s}).length,color:SP_STAGE_COLORS[s]};
  });
}
function spKpiCard(label,value,sub){
  return '<div class="sp-stat-card"><div class="sp-stat-label">'+esc(label)+'</div><div class="sp-stat-value">'+value+'</div>'+(sub?'<div class="sp-stat-sub">'+esc(sub)+'</div>':'')+'</div>';
}
function spMini(label,value){
  return '<div class="sp-mini"><div class="k">'+esc(label)+'</div><div class="v">'+value+'</div></div>';
}
function spPanel(title,body){
  return '<div class="panel"><div class="panel-header"><span>'+esc(title)+'</span></div><div class="panel-body">'+body+'</div></div>';
}


/* ===================== 三、图表构件（纯 CSS/SVG，无依赖） ===================== */
var SP_CHART_COLORS=['#2563eb','#0ea5e9','#10b981','#f59e0b','#8b5cf6','#ef4444','#14b8a6','#f97316'];
function spChartEmpty(){return '<div style="height:170px;display:flex;align-items:center;justify-content:center;color:var(--color-text-muted);font-size:var(--fs-sm)">暂无数据</div>'}
/* 环形饼图 items:[{k,v}] */
function spPie(items){
  items=(items||[]).filter(function(x){return x.v>0});
  var total=items.reduce(function(s,x){return s+x.v},0);
  if(!total)return spChartEmpty();
  var acc=0,stops=[];
  items.forEach(function(x,i){
    var c=x.color||SP_CHART_COLORS[i%SP_CHART_COLORS.length];
    var from=acc/total*360;acc+=x.v;var to=acc/total*360;
    stops.push(c+' '+from.toFixed(2)+'deg '+to.toFixed(2)+'deg');
  });
  var legend=items.map(function(x,i){
    var c=x.color||SP_CHART_COLORS[i%SP_CHART_COLORS.length];
    return '<div class="sp-legend-item"><span class="sp-legend-dot" style="background:'+c+'"></span><span>'+esc(x.k)+'</span><span class="sp-legend-val">'+x.v+'</span><span class="sp-legend-pct">'+(x.v/total*100).toFixed(0)+'%</span></div>';
  }).join('');
  return '<div class="sp-chart-body"><div class="sp-pie" style="background:conic-gradient('+stops.join(',')+')"><div class="sp-pie-center">'+total+'<small>例</small></div></div><div class="sp-legend">'+legend+'</div></div>';
}
/* 横向柱 items:[{k,v,suffix}] suffix 默认 ' 例'；pct=true 时值为百分比 */
function spHBar(items,pct){
  items=(items||[]).filter(function(x){return x.v>0});
  if(!items.length)return spChartEmpty();
  var max=Math.max.apply(null,items.map(function(x){return x.v}));
  return '<div class="sp-hbars">'+items.map(function(x){
    var val=pct?x.v+'%':x.v;
    return '<div class="sp-hbar-row"><div class="sp-hbar-lab" title="'+esc(x.k)+'">'+esc(x.k)+'</div><div class="sp-hbar-track"><div class="sp-hbar-fill" style="width:'+Math.max(4,Math.round(x.v/max*100))+'%"></div></div><div class="sp-hbar-num">'+val+'</div></div>';
  }).join('')+'</div>';
}
/* 纵向柱 items:[{k,v}] */
function spVBar(items){
  items=(items||[]).filter(function(x){return x.v>0});
  if(!items.length)return spChartEmpty();
  var max=Math.max.apply(null,items.map(function(x){return x.v}));
  return '<div class="sp-vbars">'+items.map(function(x){
    return '<div class="sp-vbar"><div class="sp-vbar-num">'+x.v+'</div><div class="sp-vbar-fill" style="height:'+Math.max(6,Math.round(x.v/max*100))+'%"></div><div class="sp-vbar-lab" title="'+esc(x.k)+'">'+esc(x.k)+'</div></div>';
  }).join('')+'</div>';
}
/* 100% 堆叠条 items:[{k,v,color}]，withLegend 控制图例 */
function spStack(items,withLegend){
  items=(items||[]).filter(function(x){return x.v>0});
  var total=items.reduce(function(s,x){return s+x.v},0);
  if(!total)return spChartEmpty();
  var segs=items.map(function(x){
    var pct=x.v/total*100;
    return '<div class="sp-stack-seg" style="width:'+pct.toFixed(2)+'%;background:'+x.color+'" title="'+esc(x.k)+'：'+x.v+' 例">'+(pct>=9?x.v:'')+'</div>';
  }).join('');
  var h='<div class="sp-stack-bar">'+segs+'</div>';
  if(withLegend!==false){
    h+='<div class="sp-legend" style="margin-top:10px">'+items.map(function(x){
      return '<div class="sp-legend-item"><span class="sp-legend-dot" style="background:'+x.color+'"></span><span>'+esc(x.k)+'</span><span class="sp-legend-val">'+x.v+'</span><span class="sp-legend-pct">'+(x.v/total*100).toFixed(0)+'%</span></div>';
    }).join('')+'</div>';
  }
  return h;
}
/* 图表 CSS（饼/柱/堆叠等） */
var spChartStyle=document.createElement('style');
spChartStyle.textContent=`
.sp-chart-body{display:flex;align-items:center;gap:20px;min-height:200px;padding:6px 2px}
.sp-pie{position:relative;width:160px;height:160px;flex:0 0 160px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(15,23,42,.06)}
.sp-pie-center{position:absolute;inset:34%;background:var(--surface);border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:var(--font-num);font-weight:700;font-size:var(--fs-body);color:var(--color-text-title);box-shadow:inset 0 0 0 1px rgba(15,23,42,.05)}
.sp-pie-center small{font-size:var(--fs-xs);font-weight:500;color:var(--color-text-muted)}
.sp-legend{display:flex;flex-direction:column;gap:9px;font-size:var(--fs-sm);flex:1;min-width:0}
.sp-legend-item{display:flex;align-items:center;gap:8px;color:var(--color-text-body)}
.sp-legend-dot{width:10px;height:10px;border-radius:3px;flex:0 0 10px}
.sp-legend-val{margin-left:auto;font-family:var(--font-num);font-weight:700;color:var(--color-text-title)}
.sp-legend-pct{font-size:var(--fs-xs);color:var(--color-text-muted);width:42px;text-align:right;font-family:var(--font-num)}
.sp-hbars{display:flex;flex-direction:column;gap:13px;padding:6px 2px}
.sp-hbar-row{display:flex;align-items:center;gap:10px}
.sp-hbar-lab{width:72px;flex:0 0 72px;text-align:right;font-size:var(--fs-sm);color:var(--color-text-body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sp-hbar-track{flex:1;height:16px;background:var(--color-bg-subtle);border-radius:8px;overflow:hidden}
.sp-hbar-fill{height:100%;border-radius:8px;background:linear-gradient(90deg,#2563eb,#60a5fa)}
.sp-hbar-num{width:52px;flex:0 0 52px;font-size:var(--fs-sm);font-weight:700;color:var(--color-text-title);font-family:var(--font-num)}
.sp-vbars{display:flex;align-items:flex-end;gap:20px;height:200px;padding:10px 8px 0;flex:1}
.sp-vbar{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;min-width:0}
.sp-vbar-num{font-size:var(--fs-xs);font-weight:700;color:var(--color-text-title);margin-bottom:5px;font-family:var(--font-num)}
.sp-vbar-fill{width:100%;max-width:48px;border-radius:6px 6px 0 0;background:linear-gradient(180deg,#60a5fa,#2563eb)}
.sp-vbar-lab{font-size:var(--fs-xs);color:var(--color-text-muted);margin-top:8px;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sp-stack-bar{display:flex;height:30px;border-radius:8px;overflow:hidden;background:var(--color-bg-subtle)}
.sp-stack-seg{display:flex;align-items:center;justify-content:center;color:#fff;font-size:var(--fs-xs);font-weight:700;font-family:var(--font-num);min-width:0}
`;
document.head.appendChild(spChartStyle);


/* ===================== 四、江西地图（复用 jx-geo.js 边界数据） ===================== */
var _spMapProjCache=null;
function spProject(){
  if(_spMapProjCache)return _spMapProjCache;
  var G=window.JX_GEO;
  if(!G)return null;
  var b=G.bbox,midLat=(b[1]+b[3])/2,c=Math.cos(midLat*Math.PI/180),k=118,pad=30;
  var lon=(b[2]-b[0])*c,lat=b[3]-b[1];
  _spMapProjCache={w:Math.round(lon*k+pad*2),h:Math.round(lat*k+pad*2),
    x:function(lng){return (lng-b[0])*c*k+pad},
    y:function(la){return (b[3]-la)*k+pad}};
  return _spMapProjCache;
}
var _spMapPathCache=null;
function spCityPath(city){
  var p=spProject();if(!p)return '';
  var d=[];
  city.rings.forEach(function(poly){poly.forEach(function(ring){
    for(var i=0;i<ring.length;i++)d.push((i?'L':'M')+p.x(ring[i][0]).toFixed(1)+' '+p.y(ring[i][1]).toFixed(1));
    d.push('Z');
  })});
  return d.join('');
}
var _spMapPathCache=null;
function spMapPaths(){
  if(_spMapPathCache||!window.JX_GEO)return _spMapPathCache;
  _spMapPathCache={};
  window.JX_GEO.cities.forEach(function(c){_spMapPathCache[c.full]=spCityPath(c)});
  return _spMapPathCache;
}
var SP_MAP_NUDGE={'萍乡市':[-16,4],'新余市':[16,-2],'鹰潭市':[14,-4],'景德镇市':[10,-12],'南昌市':[-10,0]};
var SP_MAP_RAMP=['#eff6ff','#dbeafe','#bfdbfe','#93c5fd','#60a5fa','#3b82f6','#1d4ed8'];
function spMapRamp(vals,v){
  var lo=Math.min.apply(null,vals),hi=Math.max.apply(null,vals);
  if(hi===lo)return SP_MAP_RAMP[3];
  var t=(v-lo)/(hi-lo);
  return SP_MAP_RAMP[Math.max(0,Math.min(6,Math.round(t*6)))];
}
/* 地图面板：scope 事件列表 + 指标(metric) + 回调 */
var SP_MAP_METRICS={'患者规模':{get:function(r){return r.n},fmt:function(v){return v+' 例'},w:0},
 '晚期占比':{get:function(r){return r.agg.lateRate},fmt:function(v){return v+'%'},w:1},
 '随访覆盖率':{get:function(r){return r.agg.fuRate},fmt:function(v){return v+'%'},w:1},
 '跨市就医率':{get:function(r){return r.agg.crossCityRate},fmt:function(v){return v+'%'},w:1}};
function spMapPanel(list,metric,scopeCity){
  var paths=spMapPaths(),p=spProject();
  if(!paths||!p)return '<div class="sp-chart-empty">地图组件未加载</div>';
  var rows=spCityRows(list);
  var vals=rows.map(function(r){return SP_MAP_METRICS[metric].get(r)});
  var g='',labels='';
  rows.forEach(function(r,i){
    var v=vals[i],col=spMapRamp(vals,v),on=r.city===scopeCity;
    g+='<path d="'+paths[r.city]+'" data-sp-city="'+esc(r.city)+'" fill="'+col+'" stroke="'+(on?'#1d4ed8':'#ffffff')+'" stroke-width="'+(on?2.2:1.2)+'" style="cursor:pointer"/>';
    var nud=SP_MAP_NUDGE[r.city]||[0,0];
    var cx=p.x(window.JX_GEO.cities[i]&&0),cy=0;
    var geo=window.JX_GEO.cities.filter(function(c){return c.full===r.city})[0];
    if(geo){cx=p.x(geo.centroid[0])+nud[0];cy=p.y(geo.centroid[1])+nud[1];}
    labels+='<g style="pointer-events:none"><text x="'+cx.toFixed(1)+'" y="'+(cy-5).toFixed(1)+'" text-anchor="middle" font-size="11" fill="#334155" font-weight="600">'+r.city.replace('市','')+'</text>'+
      '<text x="'+cx.toFixed(1)+'" y="'+(cy+9).toFixed(1)+'" text-anchor="middle" font-size="10" fill="#1d4ed8" font-family="var(--font-num)">'+SP_MAP_METRICS[metric].fmt(v)+'</text></g>';
  });
  var tip='<div class="sp-map-tip">'+
    Object.keys(SP_MAP_METRICS).map(function(m){
      return '<button class="btn '+(m===metric?'btn-primary':'btn-ghost')+' btn-sm" onclick="window._spMapMetric(\''+m+'\')">'+m+'</button>';
    }).join('')+'</div>';
  var legend='<div class="sp-map-legend"><span>低</span>'+SP_MAP_RAMP.map(function(c){return '<i style="background:'+c+'"></i>'}).join('')+'<span>高</span><span style="margin-left:auto">点击地市可下钻查看该地市画像指标</span></div>';
  return tip+'<svg class="sp-mapsvg" viewBox="0 0 '+p.w+' '+p.h+'" preserveAspectRatio="xMidYMid meet">'+g+labels+'</svg>'+legend;
}
/* 绑定地图点击（渲染后调用一次，全局委托） */
(function(){
  var bound=false;
  window._spBindMap=function(){
    if(bound)return;bound=true;
    document.addEventListener('click',function(e){
      var t=e.target.closest?e.target.closest('[data-sp-city]'):null;
      if(t)window._spDrillCity(t.getAttribute('data-sp-city'));
    });
  };
})();


/* ===================== 五、02 画像指标汇总（卫健委视角） ===================== */
var _spScope={city:'',site:''};
var _spMapMetricKey='患者规模';
var _spDomain='base';
var SP_DOMAINS=[
 {key:'base',label:'人群底数'},{key:'flow',label:'就医流向'},{key:'stage',label:'病情分期'},
 {key:'treat',label:'诊疗模式'},{key:'fu',label:'随访与结局'},{key:'cost',label:'经济负担'}
];

function spScopeBar(){
  var cityOpts='<option value="">全省</option>'+SP_CITIES.map(function(c){return '<option'+(c===_spScope.city?' selected':'')+'>'+c+'</option>'}).join('');
  var siteOpts='<option value="">全部病种</option>'+SP_SITES.map(function(s){return '<option'+(s===_spScope.site?' selected':'')+'>'+s+'</option>'}).join('');
  return '<div class="sp-filter-bar">'+
    '<div class="form-group"><label>地市</label><select id="spScopeCity" onchange="window._spSetScope(this.value,\'\')">'+cityOpts+'</select></div>'+
    '<div class="form-group"><label>瘤种</label><select onchange="window._spSetScope(\'\',this.value)">'+siteOpts+'</select></div>'+
    '<div class="sp-filter-actions"><button class="btn btn-ghost btn-sm" onclick="window._spSetScope(\'\',\'\')">重置</button></div>'+
  '</div>';
}
function spScopeLabel(){
  var a=[];
  a.push(_spScope.city||'全省');
  if(_spScope.site)a.push(_spScope.site+'癌');
  return a.join(' · ');
}

function renderOverview(){
  var list=spScopeEvents(_spScope);
  var agg=spAgg(list);
  var siteRows=spSiteRows(list);
  var cityRows=spCityRows(list);
  var h=spScopeBar();
  /* 顶部核心指标 */
  h+='<div class="sp-stat-row">'+
    spKpiCard('患者总数',agg.total,'覆盖 '+cityRows.filter(function(r){return r.n>0}).length+' 个设区市')+
    spKpiCard('新发患者（本年度）',agg.newYear+'<em style="font-style:normal;font-size:12px"> 例</em>','占在管患者 '+(agg.total?Math.round(agg.newYear/agg.total*100):0)+'%')+
    spKpiCard('早期占比（I+II期）',agg.earlyRate+'<em style="font-style:normal;font-size:12px">%</em>','晚期(IV期) '+agg.lateRate+'%')+
    spKpiCard('跨市就医率',agg.crossCityRate+'<em style="font-style:normal;font-size:12px">%</em>','首诊跨省 '+agg.crossProvRate+'%')+
    spKpiCard('随访覆盖率',agg.fuRate+'<em style="font-style:normal;font-size:12px">%</em>','失访 '+agg.lost+' 例')+
    spKpiCard('观察生存率',agg.effSurvival+'<em style="font-style:normal;font-size:12px">%</em>','有效随访口径')+
  '</div>';
  /* 中部：地图 + 排行 */
  h+='<div class="sp-ov-grid">'+
    '<div class="panel"><div class="panel-header"><span>全省分布 · '+esc(_spMapMetricKey)+'</span></div><div class="panel-body">'+spMapPanel(list,_spMapMetricKey,_spScope.city)+'</div></div>'+
    '<div class="sp-ov-side"><div class="panel"><div class="panel-header"><span>地市排行'+(_spScope.city?'<span class="spr-count">当前：'+esc(_spScope.city)+'</span>':'')+'</span></div><div class="panel-body">'+
      '<div class="sp-map-rank">'+cityRows.filter(function(r){return r.n>0}).sort(function(a,b){return SP_MAP_METRICS[_spMapMetricKey].get(b)-SP_MAP_METRICS[_spMapMetricKey].get(a)}).slice(0,6).map(function(r,i){
        var v=SP_MAP_METRICS[_spMapMetricKey].get(r);
        return '<div class="sp-map-rank-item'+(r.city===_spScope.city?' sel':'')+'" onclick="window._spDrillCity(\''+esc(r.city)+'\')">'+
          '<span class="sp-map-rank-idx">'+(i+1)+'</span><span class="sp-map-rank-name">'+esc(r.city)+'</span>'+
          '<span class="sp-map-rank-sub">'+r.n+' 例</span><span class="sp-map-rank-val">'+SP_MAP_METRICS[_spMapMetricKey].fmt(v)+'</span></div>';
      }).join('')+'</div></div></div>'+
    '<div class="panel"><div class="panel-header"><span>当前范围</span></div><div class="panel-body"><div class="sp-kv-grid">'+
      '<div class="sp-kv-item"><span class="k">统计范围</span><span class="v">'+esc(spScopeLabel())+'</span></div>'+
      '<div class="sp-kv-item"><span class="k">在管患者</span><span class="v">'+agg.total+' 例</span></div>'+
      '<div class="sp-kv-item"><span class="k">男性 / 女性</span><span class="v">'+agg.male+' / '+agg.female+'</span></div>'+
      '<div class="sp-kv-item"><span class="k">死亡 / 失访</span><span class="v">'+agg.dead+' / '+agg.lost+' 例</span></div>'+
    '</div></div></div></div>'+
  '</div>';
  /* 重点病种画像卡 */
  h+='<div class="panel" style="margin-bottom:16px"><div class="panel-header"><span>重点病种画像<span class="spr-count">点击病种卡可按病种筛选本页指标</span></span></div><div class="panel-body">'+
    '<div class="sp-site-cards">'+siteRows.map(function(r){
      var share=agg.total?Math.round(r.n/agg.total*100):0;
      var dotColor=SP_CHART_COLORS[SP_SITES.indexOf(r.site)%SP_CHART_COLORS.length];
      return '<div class="sp-site-card'+(_spScope.site===r.site?' sel':'')+'" onclick="window._spSetScope(\'\',\''+esc(r.site)+'\')">'+
        '<div class="sp-site-head"><span class="sp-site-dot" style="background:'+dotColor+'"></span><span class="sp-site-name">'+esc(r.site)+'</span><span class="spr-count">'+r.n+' 例 · '+share+'%</span></div>'+
        '<div class="sp-site-kpis">'+
          '<div class="sp-site-kpi"><div class="k">早期占比</div><div class="v">'+r.agg.earlyRate+'<em>%</em></div></div>'+
          '<div class="sp-site-kpi"><div class="k">MDT覆盖</div><div class="v">'+r.agg.mdtRate+'<em>%</em></div></div>'+
          '<div class="sp-site-kpi"><div class="k">随访覆盖</div><div class="v">'+r.agg.fuRate+'<em>%</em></div></div>'+
        '</div>'+
        '<div class="sp-site-stage">'+spStack(spStageItems(r.list),false)+'</div>'+
      '</div>';
    }).join('')+'</div></div></div>';
  /* 六大板块 Tabs */
  h+='<div class="sp-domain-tabs">'+SP_DOMAINS.map(function(d){
    return '<button class="sp-domain-tab'+(_spDomain===d.key?' active':'')+'" onclick="window._spSetDomain(\''+d.key+'\')">'+d.label+'</button>';
  }).join('')+'</div>';
  h+='<div id="spDomainBody">'+spDomainPanel(list,agg,siteRows,cityRows)+'</div>';
  /* 重点问题 */
  h+=spIssuesPanel(list,siteRows,cityRows);
  return h;
}


/* ---- 六大板块面板 ---- */
function spDomainPanel(list,agg,siteRows,cityRows){
  if(_spDomain==='base'){
    var ages=spAgeDist(list);
    var insDist={};list.forEach(function(e){insDist[e.insurance]=(insDist[e.insurance]||0)+1});
    var insItems=Object.keys(insDist).map(function(k){return {k:k,v:insDist[k]}});
    var maxAge=Math.max.apply(null,ages.map(function(a){return Math.max(a.m,a.f)}))||1;
    var ageRows=ages.map(function(a){
      return '<div class="sp-hbar-row"><div class="sp-hbar-lab">'+esc(a.k)+'</div><div style="flex:1;display:flex;align-items:center;gap:6px">'+
        '<div style="height:10px;border-radius:5px;background:#60a5fa;width:'+Math.round(a.m/maxAge*100)+'%"></div><span class="sp-map-rank-sub">男'+a.m+'</span>'+
        '<div style="height:10px;border-radius:5px;background:#f7a7c3;width:'+Math.round(a.f/maxAge*100)+'%"></div><span class="sp-map-rank-sub">女'+a.f+'</span>'+
        '</div><div class="sp-hbar-num">'+a.n+'</div></div>';
    }).join('');
    return '<div class="sp-2col">'+
      spPanel('年龄结构（男/女）','<div class="sp-hbars">'+ageRows+'</div>')+
      spPanel('瘤种构成',spPie(siteRows.map(function(r){return {k:r.site+'癌',v:r.n}})))+
      spPanel('地区分布',spHBar(cityRows.filter(function(r){return r.n>0}).sort(function(a,b){return b.n-a.n}).map(function(r){return {k:r.city,v:r.n}})))+
      spPanel('医保类型构成',spPie(insItems))+
    '</div>';
  }
  if(_spDomain==='flow'){
    var hospDist={};list.forEach(function(e){hospDist[e.hospital]=(hospDist[e.hospital]||0)+1});
    var outEvents=list.filter(spOutCity);
    var outSites={};outEvents.forEach(function(e){outSites[e.site]=(outSites[e.site]||0)+1});
    var outRows=Object.keys(outSites).map(function(s){
      var siteRow=siteRows.filter(function(r){return r.site===s})[0]||{n:1};
      var tos={};list.filter(function(e){return e.site===s&&spOutCity(e)}).forEach(function(e){tos[e.hospital]=(tos[e.hospital]||0)+1});
      return '<tr><td>'+esc(s+'癌')+'</td><td>'+siteRow.n+'</td><td style="color:var(--color-danger-fg);font-weight:600">'+Math.round(outSites[s]/siteRow.n*100)+'%</td><td>'+esc(Object.keys(tos).join('、')||'—')+'</td></tr>';
    }).join('');
    return '<div class="sp-mini-grid" style="margin-bottom:16px">'+
      spMini('县域内就诊率',agg.localTreatRate+'<em>%</em>')+spMini('跨市就医率',agg.crossCityRate+'<em>%</em>')+
      spMini('首诊跨省率',agg.crossProvRate+'<em>%</em>')+spMini('转诊率',agg.referralRate+'<em>%</em>')+
    '</div><div class="sp-2col">'+
      spPanel('主要治疗医院',spHBar(Object.keys(hospDist).map(function(k){return {k:k,v:hospDist[k]}}).sort(function(a,b){return b.v-a.v})))+
      spPanel('主要流出病种','<div class="sp-table-wrap"><table class="data-table"><thead><tr><th>病种</th><th>患者数</th><th>跨市占比</th><th>主要流向医院</th></tr></thead><tbody>'+(outRows||'<tr><td colspan="4" style="text-align:center;color:var(--color-text-muted)">无跨市就医患者</td></tr>')+'</tbody></table></div>')+
    '</div>';
  }
  if(_spDomain==='stage'){
    var siteStageRows=siteRows.map(function(r){
      return '<div style="margin-bottom:12px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:5px"><span style="font-size:var(--fs-sm);font-weight:600;color:var(--color-text-title)">'+esc(r.site)+'癌</span><span class="spr-count">'+r.n+' 例</span></div>'+spStack(spStageItems(r.list),false)+'</div>';
    }).join('');
    var cityLate=cityRows.filter(function(r){return r.n>0}).sort(function(a,b){return b.agg.lateRate-a.agg.lateRate}).map(function(r){
      return '<tr><td>'+esc(r.city)+'</td><td>'+r.n+'</td><td>'+r.agg.earlyRate+'%</td><td'+(r.agg.lateRate>=50?' style="color:var(--color-danger-fg);font-weight:700"':'')+'>'+r.agg.lateRate+'%</td></tr>';
    }).join('');
    return '<div class="sp-mini-grid" style="margin-bottom:16px">'+
      spMini('早期占比（I+II期）',agg.earlyRate+'<em>%</em>')+spMini('晚期占比（IV期）',agg.lateRate+'<em>%</em>')+
      spMini('首诊远处转移率',agg.distantRate+'<em>%</em>')+spMini('未分期',0+'<em> 例</em>')+
    '</div><div class="sp-2col">'+
      spPanel('分期构成',spPie(spStageItems(list)))+
      spPanel('不同地区晚期占比差异','<div class="sp-table-wrap"><table class="data-table"><thead><tr><th>地市</th><th>患者数</th><th>早期占比</th><th>晚期占比</th></tr></thead><tbody>'+cityLate+'</tbody></table></div>')+
    '</div><div class="panel" style="margin-top:16px"><div class="panel-header"><span>不同病种分期结构</span></div><div class="panel-body">'+siteStageRows+
      '<div class="sp-legend" style="margin-top:6px">'+SP_STAGE_GROUPS.map(function(s){return '<div class="sp-legend-item"><span class="sp-legend-dot" style="background:'+SP_STAGE_COLORS[s]+'"></span><span>'+s+'</span></div>'}).join('')+'</div></div></div>';
  }
  if(_spDomain==='treat'){
    var modeRates=[['手术治疗率',agg.surgeryRate],['放疗率',agg.radioRate],['化疗率',agg.chemoRate],['靶向治疗率',agg.targetRate],['免疫治疗率',agg.immunoRate],['内分泌治疗率',agg.endocrineRate],['介入治疗率',agg.interRate]];
    var comboDist={};list.forEach(function(e){comboDist[e.treatMode.join('+')||'未治疗']=(comboDist[e.treatMode.join('+')||'未治疗']||0)+1});
    var comboRows=Object.keys(comboDist).map(function(k){return {k:k,v:comboDist[k]}}).sort(function(a,b){return b.v-a.v});
    return '<div class="sp-mini-grid" style="margin-bottom:16px">'+
      spMini('MDT覆盖率',agg.mdtRate+'<em>%</em>')+spMini('综合治疗率（≥2种）',agg.comboRate+'<em>%</em>')+
      spMini('转诊治疗率',agg.referralRate+'<em>%</em>')+spMini('姑息/安宁占比',agg.pallRate+'<em>%</em>')+
    '</div><div class="sp-2col">'+
      spPanel('治疗方式应用率',spHBar(modeRates.map(function(x){return {k:x[0],v:x[1]}}),true))+
      spPanel('治疗模式组合','<div class="sp-table-wrap"><table class="data-table"><thead><tr><th>治疗组合</th><th>例数</th><th>占比</th></tr></thead><tbody>'+comboRows.map(function(x){return '<tr><td>'+esc(x.k)+'</td><td>'+x.v+'</td><td>'+Math.round(x.v/list.length*100)+'%</td></tr>'}).join('')+'</tbody></table></div>')+
    '</div>';
  }
  if(_spDomain==='fu'){
    var siteFuRows=siteRows.map(function(r){
      var alive=r.list.filter(function(e){return e.vitalStatus.indexOf('存活')>=0}).length;
      var dead=r.list.filter(function(e){return e.vitalStatus==='死亡'}).length;
      var lost=r.list.filter(function(e){return e.lostFollow}).length;
      return '<tr><td>'+esc(r.site+'癌')+'</td><td>'+r.n+'</td><td style="color:var(--color-success-fg)">'+alive+'</td><td'+(dead?' style="color:var(--color-danger-fg);font-weight:600"':'')+'>'+dead+'</td><td'+(lost?' style="color:var(--color-caution-fg);font-weight:600"':'')+'>'+lost+'</td><td>'+(r.n-lost?Math.round(alive/(r.n-lost)*100):0)+'%</td></tr>';
    }).join('');
    return '<div class="sp-mini-grid" style="margin-bottom:16px">'+
      spMini('随访覆盖率',agg.fuRate+'<em>%</em>')+spMini('失访率',agg.lostRate+'<em>%</em>')+
      spMini('复发率',agg.recurRate+'<em>%</em>')+spMini('远处转移率',agg.metaRate+'<em>%</em>')+
      spMini('疾病进展率',agg.progRate+'<em>%</em>')+spMini('死亡率',agg.deathRate+'<em>%</em>')+
      spMini('观察生存率',agg.effSurvival+'<em>%</em>')+spMini('在管存活',agg.alive+'<em> 例</em>')+
    '</div><div class="panel"><div class="panel-header"><span>不同病种结局差异</span></div><div class="panel-body"><div class="sp-table-wrap"><table class="data-table"><thead><tr><th>病种</th><th>患者数</th><th>存活</th><th>死亡</th><th>失访</th><th>观察生存率</th></tr></thead><tbody>'+siteFuRows+'</tbody></table></div></div></div>';
  }
  if(_spDomain==='cost'){
    var siteCost=siteRows.map(function(r){var c=SP_SITE_COST[r.site];return {k:r.site+'癌',v:Math.round(c.ip/1000)}}).sort(function(a,b){return b.v-a.v});
    var avg={drug:0,ins:0,op:0};
    siteRows.forEach(function(r){avg.drug+=SP_SITE_COST[r.site].drug*r.n;avg.ins+=SP_SITE_COST[r.site].ins*r.n});
    if(list.length){avg.drug=Math.round(avg.drug/list.length);avg.ins=Math.round(avg.ins/list.length);avg.op=100-avg.ins;}
    var localAvg=Math.round(list.filter(function(e){return !spOutCity(e)}).reduce(function(s,e){return s+SP_SITE_COST[e.site].ip},0)/Math.max(1,list.filter(function(e){return !spOutCity(e)}).length));
    var outAvg=Math.round(localAvg*1.28/1000);
    var modeRows=SP_MODE_COST.map(function(m){
      var used=list.filter(function(e){return spHasMode(e,m.mode)}).length;
      return '<tr><td>'+esc(m.mode)+'</td><td style="font-family:var(--font-num);font-weight:600">¥'+m.cost.toLocaleString()+'</td><td>'+esc(m.unit)+'</td><td>'+(used?used+' 例':'—')+'</td></tr>';
    }).join('');
    return '<div class="sp-2col">'+
      spPanel('病种次均住院费用（千元）',spHBar(siteCost))+
      spPanel('费用结构（加权平均）',spStack([{k:'药品费用占比',v:avg.drug,color:'#2563eb'},{k:'医保支付比例',v:avg.ins,color:'#10b981'},{k:'患者自付比例',v:avg.op,color:'#f59e0b'}]))+
      spPanel('不同治疗模式费用','<div class="sp-table-wrap"><table class="data-table"><thead><tr><th>治疗方式</th><th>次/年均费用</th><th>口径</th><th>应用患者</th></tr></thead><tbody>'+modeRows+'</tbody></table></div>')+
      spPanel('跨区域就医费用差异（千元）',spVBar([{k:'本地就诊',v:Math.round(localAvg/1000)},{k:'跨市就诊',v:outAvg}]))+
    '</div>';
  }
  return '';
}

/* ---- 重点问题（自动扫描画像数据） ---- */
function spIssuesPanel(list,siteRows,cityRows){
  var issues=[];
  cityRows.filter(function(r){return r.n>0&&r.agg.lateRate>=50}).forEach(function(r){
    issues.push({level:'高',cls:'badge-danger',type:'病情分期',msg:esc(r.city)+'晚期（IV期）占比 '+r.agg.lateRate+'%，高于全省平均（'+spAgg(list).lateRate+'%）',act:'stage',city:r.city,site:''});
  });
  siteRows.filter(function(r){var out=r.list.filter(spOutCity).length;return r.n>=2&&out/r.n>=0.5}).forEach(function(r){
    issues.push({level:'中',cls:'badge-caution',type:'就医流向',msg:esc(r.site)+'癌患者跨市就医率 '+Math.round(r.list.filter(spOutCity).length/r.n*100)+'%，存在明显外流',act:'flow',city:'',site:r.site});
  });
  var hospLost={};list.filter(function(e){return e.lostFollow}).forEach(function(e){hospLost[e.hospital]=(hospLost[e.hospital]||0)+1});
  Object.keys(hospLost).forEach(function(hp){
    issues.push({level:'中',cls:'badge-caution',type:'随访结局',msg:esc(hp)+'在管患者中出现 '+hospLost[hp]+' 例失访，随访覆盖不足',act:'fu',city:'',site:''});
  });
  if(!issues.length)issues.push({level:'低',cls:'badge-success',type:'综合',msg:'当前范围内未扫描出需关注的画像异常',act:'base',city:'',site:''});
  var rows=issues.map(function(it,i){
    return '<tr><td>'+badge(it.level,it.cls)+'</td><td>'+esc(it.type)+'</td><td style="white-space:normal">'+it.msg+'</td><td><button class="btn btn-outline btn-xs" onclick="window._spGoIssue(\''+it.act+'\',\''+esc(it.city)+'\',\''+esc(it.site)+'\')">查看</button></td></tr>';
  }).join('');
  return '<div class="panel" style="margin-top:16px"><div class="panel-header"><span>重点问题（自动扫描）</span></div><div class="panel-body"><div class="sp-table-wrap"><table class="data-table"><thead><tr><th style="width:72px">程度</th><th style="width:96px">类型</th><th>问题</th><th style="width:80px">操作</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></div>';
}


/* ===================== 六、01 患者专科画像 ===================== */
var _wbFilters={q:'',site:'',stage:'',city:'',fu:''};
var _wbDetail=null;

function spWbFiltered(){
  return tumorEvents.filter(function(e){
    var q=_wbFilters.q;
    if(q){
      var hit=[e.patient,e.region,e.site,e.path,e.hospital].some(function(x){return String(x||'').indexOf(q)>=0});
      if(!hit)return false;
    }
    if(_wbFilters.site&&e.site!==_wbFilters.site)return false;
    if(_wbFilters.stage&&e.stage!==_wbFilters.stage)return false;
    if(_wbFilters.city&&e.city!==_wbFilters.city)return false;
    if(_wbFilters.fu&&e.followStatus!==_wbFilters.fu)return false;
    return true;
  });
}
function spPhaseCls(e){
  if(e.curPhase.indexOf('姑息')>=0)return 'badge-danger';
  if(e.curPhase.indexOf('随访')>=0)return 'badge-success';
  return 'badge-info';
}
function spFuCls(e){
  if(e.followStatus==='失访')return 'badge-danger';
  if(e.followStatus==='死亡结案')return 'badge-neutral';
  return 'badge-success';
}
function renderWorkbench(){
  if(_wbDetail){
    var ev=tumorEvents.filter(function(e){return e.id===_wbDetail})[0];
    if(ev)return spDetailPage(ev);
  }
  var list=spWbFiltered();
  var bar='<div class="sp-filter-bar">'+
    '<div class="form-group wide"><label>关键字</label><input id="spWbQ" placeholder="姓名 / 地区 / 瘤种 / 医院" value="'+esc(_wbFilters.q)+'"></div>'+
    '<div class="form-group"><label>瘤种</label><select id="spWbSite"><option value="">全部</option>'+SP_SITES.map(function(s){return '<option'+(s===_wbFilters.site?' selected':'')+'>'+s+'</option>'}).join('')+'</select></div>'+
    '<div class="form-group"><label>分期</label><select id="spWbStage"><option value="">全部</option>'+SP_STAGE_GROUPS.map(function(s){return '<option'+(s===_wbFilters.stage?' selected':'')+'>'+s+'</option>'}).join('')+'</select></div>'+
    '<div class="form-group"><label>地市</label><select id="spWbCity"><option value="">全部</option>'+SP_CITIES.map(function(c){return '<option'+(c===_wbFilters.city?' selected':'')+'>'+c+'</option>'}).join('')+'</select></div>'+
    '<div class="form-group"><label>随访状态</label><select id="spWbFu"><option value="">全部</option>'+['随访中','失访','死亡结案'].map(function(s){return '<option'+(s===_wbFilters.fu?' selected':'')+'>'+s+'</option>'}).join('')+'</select></div>'+
    '<div class="sp-filter-actions"><button class="btn btn-ghost btn-sm" onclick="window._spWbReset()">重置</button><button class="btn btn-primary btn-sm" onclick="window._spWbQuery()">查询</button></div>'+
  '</div>';
  var rows=list.map(function(e){
    return '<tr style="cursor:pointer" onclick="window._spOpenDetail(\''+e.id+'\')">'+
      '<td style="font-weight:600">'+esc(e.patient)+'</td><td>'+esc(e.sex)+'</td><td>'+e.age+'</td>'+
      '<td>'+esc(e.city)+'</td><td>'+esc(e.site)+'</td><td>'+esc(e.laterality+e.path)+'</td>'+
      '<td>'+esc(e.stage)+'</td><td>'+e.treatMode.map(function(m){return badge(m,'badge-info')}).join(' ')+'</td>'+
      '<td>'+badge(e.curPhase,spPhaseCls(e))+'</td><td>'+badge(e.followStatus,spFuCls(e))+'</td><td>'+esc(e.vitalStatus)+'</td>'+
    '</tr>';
  }).join('');
  var table='<div class="panel"><div class="panel-header"><span>患者列表<span class="spr-count">共 '+list.length+' 例 · 全部 '+tumorEvents.length+' 例</span></span></div>'+
    '<div class="sp-table-wrap"><table class="data-table"><thead><tr><th>患者</th><th>性别</th><th>年龄</th><th>户籍地市</th><th>瘤种</th><th>部位+病理</th><th>分期</th><th>治疗方式</th><th>当前阶段</th><th>随访状态</th><th>生存状态</th></tr></thead><tbody>'+
    (rows||'<tr><td colspan="11" style="text-align:center;color:var(--color-text-muted);padding:30px 0">无符合条件的患者</td></tr>')+
    '</tbody></table></div></div>';
  return bar+table;
}

/* ---- 详情：摘要条 + 五块画像 + 时间线 ---- */
function spProfileCompleteness(e){
  var req=[e.age,e.sex,e.region,e.insurance,e.firstHosp,e.firstDate,e.site,e.laterality,e.path,e.tNm,e.stage,e.metastasis,e.treatMode.length,e.curPhase,e.symptom,e.pain,e.nutrition,e.complication,e.ae,e.lastFu,e.followStatus,e.vitalStatus];
  var ok=req.filter(Boolean).length;
  return {ok:ok,n:req.length,rate:Math.round(ok/req.length*100)};
}
function spStableBadge(e){
  if(e.pain==='重度疼痛'||e.nutrition==='高度营养风险'||(e.complication&&e.complication.indexOf('无')<0&&e.complication!=='—'))
    return badge('需重点关注','badge-danger');
  return badge('状态稳定','badge-success');
}
function spKv(label,value,raw){
  return '<div class="sp-kv-item"><span class="k">'+esc(label)+'</span><span class="v">'+(raw?value:(esc(value)||'—'))+'</span></div>';
}
function spTimeline(e){
  var nodes=[{d:e.firstDate,c:'首诊 · '+e.firstHosp}];
  if(e.stageDate)nodes.push({d:e.stageDate,c:'明确诊断 · '+e.site+e.path+' '+e.stage});
  var segs=(e.phaseTimeline||'').split('→');
  segs.forEach(function(s){
    var m=s.match(/(.+?)\((\d{4}-\d{2}-\d{2})\)/);
    if(m)nodes.push({d:m[2],c:m[1]});
  });
  nodes.push({d:e.lastFu,c:'最近随访 · '+e.followStatus});
  var seen={},uniq=[];
  nodes.forEach(function(nd){
    var k=nd.d+'|'+nd.c;
    if(!seen[k]){seen[k]=1;uniq.push(nd)}
  });
  uniq.sort(function(a,b){return a.d<b.d?-1:1});
  return '<div class="sp-timeline">'+uniq.map(function(nd){
    return '<div class="sp-tl-item"><div class="sp-tl-date">'+esc(nd.d)+'</div><div class="sp-tl-content">'+esc(nd.c)+'</div></div>';
  }).join('')+'</div>';
}
function spBlock(idx,title,tags,bodyHtml){
  return '<div class="sp-profile-block"><div class="sp-block-head"><span class="sp-block-idx">'+idx+'</span><span class="sp-block-title">'+esc(title)+'</span><span class="sp-block-tags">'+tags+'</span></div><div class="sp-block-body">'+bodyHtml+'</div></div>';
}
function spDetailPage(e){
  var cmp=spProfileCompleteness(e);
  var head='<div class="sp-detail-back"><button class="btn btn-ghost btn-sm" onclick="window._spBackList()">← 返回患者列表</button></div>'+
    '<div class="sp-patient-strip">'+
    '<div class="sp-patient-avatar">'+esc(e.patient.charAt(0))+'</div>'+
    '<div style="min-width:0"><div class="sp-patient-name">'+esc(e.patient)+'<span class="sp-patient-meta">'+esc(e.sex)+' · '+e.age+'岁 · '+esc(spMaskIdNo(e.idNo))+'</span></div>'+
    '<div class="sp-patient-sub">'+esc(e.region)+' · '+esc(e.insurance)+' · 首诊 '+esc(e.firstDate)+'</div></div>'+
    '<div class="sp-patient-badges">'+badge(e.laterality+e.path,'badge-info')+badge(e.stage,'badge-neutral')+badge(e.metastasis,'badge-caution')+badge(e.curPhase,spPhaseCls(e))+'</div>'+
    '<div class="sp-patient-score"><div class="k">画像完整度</div><div class="v">'+cmp.rate+'%</div></div>'+
    '</div>';
  var b1='<div class="sp-kv-grid">'+
    spKv('年龄',e.age+'岁')+spKv('性别',e.sex)+spKv('地区/户籍',e.region)+spKv('医保类型',e.insurance)+
    spKv('首诊医院',e.firstHosp)+spKv('首诊时间',e.firstDate)+spKv('就诊来源',e.source)+spKv('当前管理机构',e.hospital)+'</div>';
  var b2='<div class="sp-kv-grid">'+
    spKv('肿瘤部位',e.laterality)+spKv('瘤种',e.site)+spKv('原发部位',e.site)+spKv('病理类型',e.path)+
    spKv('分化程度',e.grade)+spKv('TNM',e.tNm)+spKv('临床/病理分期',e.stage+'（'+e.stageDate+'）')+spKv('转移',e.metastasis)+
    spKv('多原发',e.multiPrimary?'是':'否')+'</div>';
  var b3='<div class="sp-kv-grid">'+
    spKv('治疗方式',e.treatMode.join('、'))+spKv('MDT',e.mdt?'已完成MDT评估':'未记录MDT')+spKv('转诊',e.referral?'有转诊记录':'无转诊记录')+
    spKv('远程会诊','—')+spKv('当前治疗阶段',e.curPhase)+'</div>'+
    '<div class="sp-kv-item" style="border-bottom:0"><span class="k">治疗时间线</span><span class="v" style="white-space:normal;color:var(--color-text-muted)">'+esc(e.phaseTimeline)+'</span></div>';
  var b4='<div class="sp-kv-grid">'+
    spKv('症状',e.symptom)+spKv('疼痛',e.pain)+spKv('营养',e.nutrition)+spKv('体能',e.physical)+
    spKv('并发症',e.complication)+spKv('治疗不良反应',e.ae)+spKv('康复',e.rehab)+spKv('支持治疗',e.supportive)+'</div>';
  var b5='<div class="sp-kv-grid">'+
    spKv('最近随访时间',e.lastFu)+spKv('随访状态',e.followStatus)+spKv('复发',e.recurrence?'有复发记录':'暂无复发记录')+
    spKv('转移',e.metaProgress)+spKv('疾病进展',e.diseaseProgress?'有进展':'无进展')+spKv('生存状态',e.vitalStatus)+
    (e.deathCause?spKv('死亡原因',e.deathCause):'')+(e.lostFollow?spKv('失访','是'):'')+'</div>';
  var blocks='<div class="sp-profile-blocks">'+
    spBlock(1,'患者特征',badge(e.insurance,'badge-accent'),b1)+
    spBlock(2,'疾病特征',badge(e.stage,spEarly(e)?'badge-success':'badge-caution'),b2)+
    spBlock(3,'诊疗特征',badge(e.curPhase,spPhaseCls(e))+(e.mdt?badge('MDT','badge-info'):''),b3)+
    spBlock(4,'患者状态',spStableBadge(e),b4)+
    spBlock(5,'随访与结局',badge(e.followStatus,spFuCls(e))+badge(e.vitalStatus,'badge-neutral'),b5)+
    '</div>';
  var tl=spPanel('画像时间线',spTimeline(e));
  return '<div class="sp-detail-shell">'+head+blocks+tl+'</div>';
}


/* ===================== 七、03 画像配置 ===================== */
var _spCfgTab='elem';
var SP_CFG_TABS=[{key:'elem',label:'画像要素'},{key:'rule',label:'映射规则'},{key:'nlp',label:'NLP 提取'},{key:'ver',label:'版本与归档'}];

/* 覆盖判定字段库：新增要素时从下拉选择，覆盖率按数据实时计算 */
var SP_ELEM_FIELD_MAP=[
 {key:'age_sex',name:'年龄/性别',fn:function(e){return e.age&&e.sex}},
 {key:'region',name:'户籍地区',fn:function(e){return e.region}},
 {key:'insurance',name:'医保类型',fn:function(e){return e.insurance}},
 {key:'first',name:'首诊机构/时间',fn:function(e){return e.firstHosp&&e.firstDate}},
 {key:'site',name:'瘤种/部位',fn:function(e){return e.site&&e.laterality}},
 {key:'path',name:'病理类型/分化程度',fn:function(e){return e.path&&e.grade}},
 {key:'stage',name:'TNM/临床分期',fn:function(e){return e.tNm&&e.stage}},
 {key:'meta2',name:'转移/多原发',fn:function(e){return e.metastasis}},
 {key:'treat',name:'治疗方式组合',fn:function(e){return e.treatMode&&e.treatMode.length}},
 {key:'mdt',name:'MDT/转诊记录',fn:function(e){return e.mdt!==undefined&&e.referral!==undefined}},
 {key:'phase',name:'当前治疗阶段',fn:function(e){return e.curPhase}},
 {key:'status',name:'症状/疼痛/营养/体能',fn:function(e){return e.symptom&&e.pain&&e.nutrition&&e.physical}},
 {key:'comp',name:'并发症/不良反应',fn:function(e){return e.complication&&e.ae}},
 {key:'fu',name:'最近随访时间/状态',fn:function(e){return e.lastFu&&e.followStatus}},
 {key:'vital',name:'生存状态/结局',fn:function(e){return e.vitalStatus}}
];
function spFieldFn(fkey){var f=SP_ELEM_FIELD_MAP.filter(function(x){return x.key===fkey})[0];return f?f.fn:function(){return true};}
var SP_DIMS=['患者特征','疾病特征','诊疗特征','患者状态','随访与结局'];
var SP_SOURCES=['登记报告卡','门诊登记数据','病理报告数据','TNM分期质控','病案首页数据','医保结算数据','MDT与转诊管理','护理评估数据','随访管理数据','随访与死亡登记','治疗记录数据','诊断与病理数据'];

/* 画像要素元数据（工作副本：可新增/编辑/启停） */
var _spElements=[
 {id:'PE01',dim:'患者特征',name:'年龄/性别',src:'登记报告卡',fkey:'age_sex',on:true},
 {id:'PE02',dim:'患者特征',name:'户籍地区',src:'登记报告卡',fkey:'region',on:true},
 {id:'PE03',dim:'患者特征',name:'医保类型',src:'医保结算数据',fkey:'insurance',on:true},
 {id:'PE04',dim:'患者特征',name:'首诊机构/时间',src:'门诊登记数据',fkey:'first',on:true},
 {id:'DE01',dim:'疾病特征',name:'瘤种/部位',src:'登记报告卡',fkey:'site',on:true},
 {id:'DE02',dim:'疾病特征',name:'病理类型/分化程度',src:'病理报告数据',fkey:'path',on:true},
 {id:'DE03',dim:'疾病特征',name:'TNM/临床分期',src:'TNM分期质控',fkey:'stage',on:true},
 {id:'DE04',dim:'疾病特征',name:'转移/多原发',src:'诊断与病理数据',fkey:'meta2',on:true},
 {id:'TR01',dim:'诊疗特征',name:'治疗方式组合',src:'病案首页数据',fkey:'treat',on:true},
 {id:'TR02',dim:'诊疗特征',name:'MDT/转诊记录',src:'MDT与转诊管理',fkey:'mdt',on:true},
 {id:'TR03',dim:'诊疗特征',name:'当前治疗阶段',src:'治疗记录数据',fkey:'phase',on:true},
 {id:'ST01',dim:'患者状态',name:'症状/疼痛/营养/体能',src:'护理评估数据',fkey:'status',on:true},
 {id:'ST02',dim:'患者状态',name:'并发症/不良反应',src:'病案首页数据',fkey:'comp',on:true},
 {id:'FU01',dim:'随访与结局',name:'最近随访时间/状态',src:'随访管理数据',fkey:'fu',on:true},
 {id:'FU02',dim:'随访与结局',name:'生存状态/结局',src:'随访与死亡登记',fkey:'vital',on:true}
];
/* 画像维度映射规则（工作副本） */
var _spMapRules=[
 {id:'MR01',dim:'患者特征',input:'户籍地区 + 医保类型',out:'人群属性分组',logic:'按设区市 × 医保类型自动归组',on:true},
 {id:'MR02',dim:'疾病特征',input:'部位 + 病理类型 + 分化程度',out:'瘤种画像结论',logic:'拼接生成「部位+病理」结论行',on:true},
 {id:'MR03',dim:'疾病特征',input:'TNM + 临床/病理分期',out:'早期/晚期分层',logic:'I/II期 → 早期；IV期 → 晚期',on:true},
 {id:'MR04',dim:'疾病特征',input:'转移记录',out:'远处转移标记',logic:'含骨/肝/肺/脑/腹膜转移 → 远处转移',on:true},
 {id:'MR05',dim:'诊疗特征',input:'治疗方式组合',out:'治疗模式分类',logic:'≥2种方式 → 综合治疗；含靶向/免疫 → 精准治疗',on:true},
 {id:'MR06',dim:'诊疗特征',input:'MDT记录 + 转诊记录',out:'MDT覆盖率/转诊流向',logic:'有MDT记录即计入覆盖分母',on:true},
 {id:'MR07',dim:'患者状态',input:'疼痛 + 营养 + 并发症',out:'状态稳定度标签',logic:'重度疼痛/高度营养风险/严重并发症 → 需重点关注',on:true},
 {id:'MR08',dim:'随访与结局',input:'最近随访时间 + 随访状态',out:'随访状态结论',logic:'失访标记 → 失访率分母',on:true},
 {id:'MR09',dim:'随访与结局',input:'复发/转移/进展记录',out:'结局事件标记',logic:'任一阳性即标记结局事件',on:true},
 {id:'MR10',dim:'指标汇总',input:'患者画像全量字段',out:'省/市/院/病种聚合指标',logic:'按行政区划、机构、瘤种三维实时聚合',on:true}
];
var SP_RULE_TEMPLATES=['按行政区划聚合','拼接生成结论行','区间映射为分层','关键字匹配打标','计数聚合为占比','任一阳性即标记'];
/* NLP 结构化提取结果：原文片段 → 画像要素，状态可采纳/忽略 */
var _spNlp=[
 {id:'NLP01',src:'病理报告 · 陈建国',snippet:'（右肺上叶）浸润性腺癌，腺泡型+乳头型，中分化',el:'病理类型/分化程度',val:'腺癌 · 中分化',conf:96,st:'已采纳'},
 {id:'NLP02',src:'出院小结 · 赵德顺',snippet:'胃窦低分化腺癌，腹膜多发转移结节',el:'转移',val:'腹膜转移',conf:92,st:'已采纳'},
 {id:'NLP03',src:'影像报告 · 王秀兰',snippet:'右肝后叶占位，考虑 HCC，邻近无卫星灶',el:'瘤种/部位',val:'肝 · 右肝后叶',conf:89,st:'待确认'},
 {id:'NLP04',src:'门诊病历 · 欧阳明轩',snippet:'进食梗阻感 2 月，胸中段食管占位',el:'症状',val:'进食梗阻感',conf:85,st:'待确认'},
 {id:'NLP05',src:'检验报告 · 李志强',snippet:'血常规 WBC 3.2×10⁹/L，II 度骨髓抑制',el:'治疗不良反应',val:'II度骨髓抑制',conf:91,st:'已采纳'},
 {id:'NLP06',src:'随访记录 · 刘雅琴',snippet:'内分泌维持中，未见复发征象',el:'复发',val:'暂无复发记录',conf:94,st:'已采纳'}
];
/* 智能校验：实时按数据执行 */
var SP_CHECKS=[
 {id:'R001',name:'分期完整性',run:function(){var bad=tumorEvents.filter(function(e){return !e.stage});return {bad:bad,detail:bad.length?bad.map(function(e){return e.patient}).join('、'):'全部患者分期完整'}}},
 {id:'R002',name:'病理类型完整性',run:function(){var bad=tumorEvents.filter(function(e){return !e.path});return {bad:bad,detail:bad.length?bad.map(function(e){return e.patient}).join('、'):'全部患者病理完整'}}},
 {id:'R003',name:'随访超90天未更新',run:function(){var bad=tumorEvents.filter(function(e){return e.followStatus==='随访中'&&e.lastFu<'2026-06-13'});return {bad:bad,detail:bad.length?bad.map(function(e){return e.patient+'（'+e.lastFu+'）'}).join('、'):'随访更新及时'}}},
 {id:'R004',name:'死亡原因未填写',run:function(){var bad=tumorEvents.filter(function(e){return e.vitalStatus==='死亡'&&!e.deathCause});return {bad:bad,detail:bad.length?bad.map(function(e){return e.patient}).join('、'):'死亡原因均已登记'}}},
 {id:'R005',name:'治疗方式缺失',run:function(){var bad=tumorEvents.filter(function(e){return !e.treatMode||!e.treatMode.length});return {bad:bad,detail:bad.length?bad.map(function(e){return e.patient}).join('、'):'全部患者均有治疗记录'}}},
 {id:'R006',name:'逻辑一致性（分期与转移）',run:function(){var bad=tumorEvents.filter(function(e){return e.stage==='IV期'&&!spDistant(e)});return {bad:bad,detail:bad.length?bad.map(function(e){return e.patient+'（IV期无远处转移记录）'}).join('、'):'分期与转移记录一致'}}}
];
var _spCheckTime='2026-09-11 08:30';
var SP_ELEM_CHECK={stage:'R001',path:'R002',fu:'R003',vital:'R004',treat:'R005',meta2:'R006'};
function spCheck(id){return SP_CHECKS.filter(function(c){return c.id===id})[0];}
/* 画像版本：含变更明细 */
var SP_VERSIONS=[
 {v:'V6.0',time:'2026-09-11 10:00',by:'系统',desc:'画像架构升级：五维患者画像 + 指标汇总 + 配置质控三层',cur:true,changes:['新增五维患者画像页（含画像时间线）','新增画像指标汇总六大板块与全省地图','画像配置迁移为四页签管理','要素/映射规则支持增删改与启停']},
 {v:'V5.1',time:'2026-09-03 15:20',by:'管理员',desc:'患者详情记录页签精简，质控子页并入详情页签',changes:['删除独立质控子页','详情页签合并筛查记录','时间线增加疗效评价节点']},
 {v:'V5.0',time:'2026-08-28 10:00',by:'系统',desc:'个案画像模型升级，新增评估与治疗要素',changes:['新增患者状态维度','新增营养/疼痛评估要素','随访要素扩展结局事件']},
 {v:'V4.2',time:'2026-08-25 14:30',by:'张医生',desc:'更新疗效评价，补充分子检测要素',changes:['补充分子检测字段','疗效评价规则更新','修正分期字段字典']}
];
/* 画像归档：含归档时点统计 */
var SP_ARCHIVES=[
 {id:'AR-2026-08',range:'2026-08 全省月度归档',events:86,note:'含死亡结案与失访封存',stats:{cities:11,sites:7,fuRate:92.4,earlyRate:31.2,score:94.2}},
 {id:'AR-2026-Q2',range:'2026年二季度归档',events:241,note:'季度画像基线',stats:{cities:11,sites:7,fuRate:91.8,earlyRate:30.5,score:92.9}},
 {id:'AR-2025-Y',range:'2025年度终末归档',events:913,note:'年终画像归档快照',stats:{cities:11,sites:7,fuRate:90.2,earlyRate:29.8,score:91.3}}
];
var _spMetaFilter={q:'',dim:''};
var _spRuleFilter={q:'',dim:''};

function renderConfig(){
  var h='<div class="sp-domain-tabs">'+SP_CFG_TABS.map(function(t){
    return '<button class="sp-domain-tab'+(_spCfgTab===t.key?' active':'')+'" onclick="window._spCfgTabSwitch(\''+t.key+'\')">'+t.label+'</button>';
  }).join('')+'</div><div id="spCfgBody">'+spCfgPanel()+'</div>';
  return h;
}
function spCfgPanel(){
  function spSel(id,cur,opts,placeholder,fn){
    return '<select id="'+id+'" onchange="'+fn+'"><option value="">'+esc(placeholder)+'</option>'+opts.map(function(o){return '<option'+(cur===o?' selected':'')+'>'+esc(o)+'</option>'}).join('')+'</select>';
  }
  /* ---- 页签一：要素与规则 ---- */
if(_spCfgTab==='elem'){
    var f=_spMetaFilter;
    var els=_spElements.filter(function(el){
      if(f.dim&&el.dim!==f.dim)return false;
      if(f.q&&(el.id+el.name+el.src).indexOf(f.q)<0)return false;
      return true;
    });
    var elRows=els.map(function(el){
      var ok=tumorEvents.filter(spFieldFn(el.fkey)).length;
      var cov=Math.round(ok/tumorEvents.length*100);
      var col=cov>=95?'var(--color-success-solid)':cov>=80?'var(--color-caution-solid)':'var(--color-danger-solid)';
      return '<tr><td>'+esc(el.id)+'</td><td>'+esc(el.dim)+'</td><td style="font-weight:600">'+esc(el.name)+'</td><td>'+esc(el.src)+'</td>'+
        '<td><div style="display:flex;align-items:center;gap:8px"><div class="sp-progress" style="flex:1"><i style="width:'+cov+'%;background:'+col+'"></i></div><span style="font-family:var(--font-num);font-weight:700;color:'+col+'">'+cov+'%</span></div></td>'+
        '<td>'+(function(){var rid=SP_ELEM_CHECK[el.fkey];if(!rid)return '—';var cr=spCheck(rid).run(),cb=cr.bad.length;return cb?'<button class="btn btn-ghost btn-xs" style="color:var(--color-danger-fg)" onclick="window._spCheckView(\''+rid+'\')">异常 '+cb+' 例</button>':badge('通过','badge-success')})()+'</td>'+
        '<td>'+(el.on?badge('已启用','badge-success'):badge('已停用','badge-gray'))+'</td>'+
        '<td style="white-space:nowrap">'+
          '<button class="btn btn-ghost btn-xs" onclick="window._spElemView(\''+esc(el.id)+'\')">查看</button> '+
          '<button class="btn btn-ghost btn-xs" onclick="window._spElemEdit(\''+esc(el.id)+'\')">编辑</button> '+
          '<button class="btn btn-ghost btn-xs" onclick="window._spElemToggle(\''+esc(el.id)+'\')">'+(el.on?'停用':'启用')+'</button>'+
        '</td></tr>';
    }).join('');
    if(!elRows)elRows='<tr><td colspan="8" style="text-align:center;color:var(--color-text-muted);padding:24px 0">无匹配要素</td></tr>';
    return '<div class="panel">'+
        '<div class="panel-header"><span>画像要素元数据<span class="spr-count">'+els.length+' 条</span></span></div>'+
        '<div class="panel-body">'+
          '<div class="sp-filter-bar">'+
            '<div class="form-group wide"><label>关键字</label><input id="spMetaQ" placeholder="编号 / 名称 / 来源" value="'+esc(f.q)+'"></div>'+
            '<div class="form-group"><label>维度</label>'+spSel('spMetaDim',f.dim,SP_DIMS,'全部维度','window._spMetaFilterSet()')+'</div>'+
            '<div class="sp-filter-actions"><button class="btn btn-outline" onclick="window._spMetaReset()">重置</button><button class="btn btn-primary" onclick="window._spElemAdd()">新增要素</button></div>'+
          '</div>'+
          '<div class="sp-table-wrap"><table class="data-table"><thead><tr><th style="width:72px">编号</th><th style="width:90px">维度</th><th>要素名称</th><th style="width:120px">数据来源</th><th style="width:190px">覆盖率</th><th style="width:96px">校验</th><th style="width:76px">状态</th><th style="width:150px">操作</th></tr></thead><tbody>'+elRows+'</tbody></table></div>'+
        '</div>'+
      '</div>';
  }
  if(_spCfgTab==='rule'){
    var rf=_spRuleFilter;
    var rules=_spMapRules.filter(function(r){
      if(rf.dim&&r.dim!==rf.dim)return false;
      if(rf.q&&(r.id+r.input+r.out+r.logic).indexOf(rf.q)<0)return false;
      return true;
    });
    var ruleRows=rules.map(function(r){
      return '<tr><td>'+esc(r.id)+'</td><td>'+esc(r.dim)+'</td><td>'+esc(r.input)+'</td><td style="font-weight:600">'+esc(r.out)+'</td><td style="white-space:normal">'+esc(r.logic)+'</td>'+
        '<td>'+(r.on?badge('已启用','badge-success'):badge('已停用','badge-gray'))+'</td>'+
        '<td style="white-space:nowrap">'+
          '<button class="btn btn-ghost btn-xs" onclick="window._spRuleView(\''+esc(r.id)+'\')">查看</button> '+
          '<button class="btn btn-ghost btn-xs" onclick="window._spRuleEdit(\''+esc(r.id)+'\')">编辑</button> '+
          '<button class="btn btn-ghost btn-xs" onclick="window._spToggleRule(\''+esc(r.id)+'\')">'+(r.on?'停用':'启用')+'</button>'+
        '</td></tr>';
    }).join('');
    if(!ruleRows)ruleRows='<tr><td colspan="7" style="text-align:center;color:var(--color-text-muted);padding:24px 0">无匹配规则</td></tr>';
    return '<div class="panel">'+
        '<div class="panel-header"><span>画像维度映射规则<span class="spr-count">'+rules.length+' 条</span></span></div>'+
        '<div class="panel-body">'+
          '<div class="sp-filter-bar">'+
            '<div class="form-group wide"><label>关键字</label><input id="spRuleQ" placeholder="编号 / 输入 / 结论" value="'+esc(rf.q)+'"></div>'+
            '<div class="form-group"><label>维度</label>'+spSel('spRuleDim',rf.dim,SP_DIMS.concat(['指标汇总']),'全部维度','window._spRuleFilterSet()')+'</div>'+
            '<div class="sp-filter-actions"><button class="btn btn-outline" onclick="window._spRuleReset()">重置</button><button class="btn btn-primary" onclick="window._spRuleAdd()">新增规则</button></div>'+
          '</div>'+
          '<div class="sp-table-wrap"><table class="data-table"><thead><tr><th style="width:72px">规则号</th><th style="width:90px">维度</th><th>输入要素</th><th>画像结论</th><th>映射逻辑</th><th style="width:76px">状态</th><th style="width:150px">操作</th></tr></thead><tbody>'+ruleRows+'</tbody></table></div>'+
        '</div>'+
      '</div>';
  }
  if(_spCfgTab==='nlp'){
    var nlpRows=_spNlp.map(function(n){
      var stCol=n.st==='已采纳'?'badge-success':n.st==='已忽略'?'badge-gray':'badge-warning';
      return '<tr><td>'+esc(n.id)+'</td><td>'+esc(n.src)+'</td><td style="white-space:normal;color:var(--color-text-muted)">'+esc(n.snippet)+'</td><td style="font-weight:600">'+esc(n.el)+' → '+esc(n.val)+'</td>'+
        '<td><span style="font-family:var(--font-num);font-weight:700;color:'+(n.conf>=90?'var(--color-success-solid)':'var(--color-caution-solid)')+'">'+n.conf+'%</span></td>'+
        '<td>'+badge(n.st,stCol)+'</td>'+
        '<td style="white-space:nowrap">'+(n.st==='待确认'?
          '<button class="btn btn-ghost btn-xs" onclick="window._spNlpSet(\''+n.id+'\',\'已采纳\')">采纳</button> <button class="btn btn-ghost btn-xs" onclick="window._spNlpSet(\''+n.id+'\',\'已忽略\')">忽略</button>':'—')+'</td></tr>';
    }).join('');
    return '<div class="panel">'+
        '<div class="panel-header"><span>NLP 结构化提取结果<span class="spr-count">待确认 '+_spNlp.filter(function(n){return n.st==='待确认'}).length+' 条</span></span></div>'+
        '<div class="panel-body"><div class="sp-table-wrap"><table class="data-table"><thead><tr><th style="width:74px">编号</th><th style="width:130px">来源</th><th>原文片段</th><th style="width:200px">提取要素 → 值</th><th style="width:70px">置信度</th><th style="width:76px">状态</th><th style="width:110px">操作</th></tr></thead><tbody>'+nlpRows+'</tbody></table></div></div>'+
      '</div>';
  }

  /* ---- 页签四：版本与归档 ---- */
  if(_spCfgTab==='ver'){
    var verRows=SP_VERSIONS.map(function(v){
      return '<tr><td style="font-weight:700">'+esc(v.v)+(v.cur?' '+badge('当前','badge-success'):'')+'</td><td>'+esc(v.time)+'</td><td>'+esc(v.by)+'</td><td style="white-space:normal">'+esc(v.desc)+'</td>'+
        '<td><button class="btn btn-ghost btn-xs" onclick="window._spVerView(\''+esc(v.v)+'\')">查看</button></td></tr>';
    }).join('');
    var arcRows=SP_ARCHIVES.map(function(a){
      return '<tr><td>'+esc(a.id)+'</td><td>'+esc(a.range)+'</td><td>'+a.events+' 例</td><td style="white-space:normal">'+esc(a.note)+'</td>'+
        '<td style="white-space:nowrap"><button class="btn btn-ghost btn-xs" onclick="window._spArcView(\''+esc(a.id)+'\')">查看</button> <button class="btn btn-ghost btn-xs" onclick="window._spArcDownload(\''+esc(a.id)+'\')">下载</button></td></tr>';
    }).join('');
    return '<div class="sp-2col">'+
      '<div class="panel"><div class="panel-header"><span>画像版本</span></div><div class="panel-body"><div class="sp-table-wrap"><table class="data-table"><thead><tr><th style="width:110px">版本</th><th style="width:140px">更新时间</th><th style="width:80px">更新人</th><th>变更摘要</th><th style="width:60px">操作</th></tr></thead><tbody>'+verRows+'</tbody></table></div></div></div>'+
      '<div class="panel"><div class="panel-header"><span>画像归档</span><button class="btn btn-outline btn-sm" onclick="window._spDoArchive()">执行归档</button></div><div class="panel-body"><div class="sp-table-wrap"><table class="data-table"><thead><tr><th style="width:110px">归档编号</th><th>归档范围</th><th style="width:80px">画像数</th><th>说明</th><th style="width:120px">操作</th></tr></thead><tbody>'+arcRows+'</tbody></table></div></div></div>'+
    '</div>';
  }
  return '';
}

/* ===================== 八、交互与主入口 ===================== */
function spRefresh(){
  var main=document.getElementById('spMainContent');
  if(main)main.innerHTML=render();
}
window._spSetScope=function(city,site){
  if(city!==''&&city!==null&&city!==undefined)_spScope.city=city;
  if(site!==''&&site!==null&&site!==undefined)_spScope.site=site;
  if(city===''&&site===''){_spScope={city:'',site:''}}
  spRefresh();
};
window._spDrillCity=function(city){
  _spScope.city=(_spScope.city===city?'':city);
  spRefresh();
};
window._spMapMetric=function(m){
  _spMapMetricKey=m;spRefresh();
  window._spBindMap();
};
window._spSetDomain=function(d){
  _spDomain=d;
  var body=document.getElementById('spDomainBody');
  if(body){
    var list=spScopeEvents(_spScope);
    body.innerHTML=spDomainPanel(list,spAgg(list),spSiteRows(list),spCityRows(list));
    var tabs=document.querySelectorAll('.sp-domain-tab');
    for(var i=0;i<tabs.length;i++){
      if(tabs[i].getAttribute('onclick').indexOf("'"+d+"'")>=0)tabs[i].classList.add('active');
      else tabs[i].classList.remove('active');
    }
    body.scrollIntoView({block:'start'});
  }
};
window._spGoIssue=function(domain,city,site){
  if(city)_spScope.city=city;
  if(site)_spScope.site=site;
  spRefresh();
  window._spSetDomain(domain);
};
window._spWbQuery=function(){
  var g=function(id){var el=document.getElementById(id);return el?String(el.value||'').trim():''};
  _wbFilters={q:g('spWbQ'),site:g('spWbSite'),stage:g('spWbStage'),city:g('spWbCity'),fu:g('spWbFu')};
  spRefresh();
};
window._spWbReset=function(){
  _wbFilters={q:'',site:'',stage:'',city:'',fu:''};spRefresh();
};
window._spOpenDetail=function(id){
  _wbDetail=id;spRefresh();
  var sc=document.getElementById('spMainContent');
  if(sc&&sc.scrollIntoView)sc.scrollIntoView({block:'start'});
};
window._spBackList=function(){
  _wbDetail=null;spRefresh();
};
function spModal(title,bodyHtml,foot){
  var mask=document.createElement('div');
  mask.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;z-index:1200;padding:24px';
  var box=document.createElement('div');
  box.style.cssText='background:var(--surface);border-radius:12px;width:min(720px,100%);max-height:86vh;display:flex;flex-direction:column;box-shadow:0 20px 50px rgba(15,23,42,.3)';
  box.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--color-border)"><div style="font-size:16px;font-weight:700;color:var(--color-text-title)">'+esc(title)+'</div><button style="width:30px;height:30px;border:0;border-radius:6px;background:transparent;color:var(--color-text-muted);cursor:pointer;font-size:20px">×</button></div>'+
    '<div style="padding:16px 18px;overflow:auto">'+bodyHtml+'</div>'+
    (foot?'<div style="display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid var(--color-border)">'+foot+'</div>':'');
  mask.appendChild(box);
  mask.addEventListener('click',function(e){if(e.target===mask)mask.remove()});
  box.querySelector('button').addEventListener('click',function(){mask.remove()});
  box.querySelectorAll('[data-sp-close]').forEach(function(btn){btn.addEventListener('click',function(){mask.remove()})});
  (document.getElementById('pageContainer')||document.body).appendChild(mask);
  return mask;
}
window._spCfgTabSwitch=function(t){
  _spCfgTab=t;spRefresh();
};
/* ---- 要素 CRUD ---- */
window._spMetaFilterSet=function(){
  var g=function(id){var el=document.getElementById(id);return el?String(el.value||'').trim():''};
  _spMetaFilter={q:g('spMetaQ'),dim:g('spMetaDim')};spRefresh();
};
window._spMetaReset=function(){_spMetaFilter={q:'',dim:''};spRefresh();};
window._spElemToggle=function(id){
  var el=_spElements.filter(function(x){return x.id===id})[0];if(!el)return;
  el.on=!el.on;spRefresh();toast('要素 '+id+' 已'+(el.on?'启用':'停用'));
};
function spElemFormBody(el){
  var dimOpts=SP_DIMS.map(function(d){return '<option'+(el&&el.dim===d?' selected':'')+'>'+esc(d)+'</option>'}).join('');
  var srcOpts=SP_SOURCES.map(function(s){return '<option'+(el&&el.src===s?' selected':'')+'>'+esc(s)+'</option>'}).join('');
  var fOpts=SP_ELEM_FIELD_MAP.map(function(f){return '<option value="'+f.key+'"'+(el&&el.fkey===f.key?' selected':'')+'>'+esc(f.name)+'</option>'}).join('');
  return '<div class="sp-form-grid">'+
    '<div class="sp-form-row"><label>维度</label><select id="spf_dim">'+dimOpts+'</select></div>'+
    '<div class="sp-form-row"><label>要素名称</label><input id="spf_name" placeholder="如：治疗不良反应" value="'+(el?esc(el.name):'')+'"></div>'+
    '<div class="sp-form-row"><label>数据来源</label><select id="spf_src">'+srcOpts+'</select></div>'+
    '<div class="sp-form-row"><label>覆盖判定</label><select id="spf_fkey">'+fOpts+'</select></div>'+
  '</div>';
}
window._spElemAdd=function(){
  spModal('新增画像要素',spElemFormBody(null),
    '<button class="btn btn-ghost" data-sp-close>取消</button><button class="btn btn-primary" onclick="window._spElemSave()">保存</button>');
};
window._spElemEdit=function(id){
  var el=_spElements.filter(function(x){return x.id===id})[0];if(!el)return;
  spModal('编辑画像要素 · '+id,spElemFormBody(el),
    '<button class="btn btn-ghost" data-sp-close>取消</button><button class="btn btn-primary" onclick="window._spElemSave(\''+id+'\')">保存</button>');
};
window._spElemSave=function(id){
  var g=function(x){var el=document.getElementById(x);return el?String(el.value||'').trim():''};
  var name=g('spf_name');
  if(!name){toast('请填写要素名称');return;}
  var rec={dim:g('spf_dim'),name:name,src:g('spf_src'),fkey:g('spf_fkey'),on:true};
  if(id){
    var el=_spElements.filter(function(x){return x.id===id})[0];
    if(el){el.dim=rec.dim;el.name=rec.name;el.src=rec.src;el.fkey=rec.fkey;}
    toast('要素 '+id+' 已更新');
  }else{
    var n=1;_spElements.forEach(function(x){var m=/\d+$/.exec(x.id);if(m)n=Math.max(n,parseInt(m[0],10)+1)});
    var nid='PE'+String(n).padStart(2,'0');
    _spElements.push({id:nid,dim:rec.dim,name:rec.name,src:rec.src,fkey:rec.fkey,on:true});
    toast('新增要素 '+nid+' 成功');
  }
  document.querySelectorAll('[data-sp-close]').forEach(function(b){b.click()});
  spRefresh();
};
window._spElemView=function(id){
  var el=_spElements.filter(function(x){return x.id===id})[0];if(!el)return;
  var fn=spFieldFn(el.fkey);
  var ok=tumorEvents.filter(fn),miss=tumorEvents.filter(function(e){return !fn(e)});
  var cov=Math.round(ok.length/tumorEvents.length*100);
  var body='<div class="sp-kv-grid" style="grid-template-columns:repeat(2,1fr)">'+
    spKv('编号',el.id)+spKv('维度',el.dim)+spKv('数据来源',el.src)+spKv('覆盖判定',el.name)+
    spKv('覆盖率',cov+'%（'+ok.length+'/'+tumorEvents.length+'）')+spKv('状态',el.on?'已启用':'已停用')+
    '</div>'+
    '<div style="margin-top:14px"><div style="font-weight:700;margin-bottom:8px">缺失该要素的患者（'+miss.length+' 例）</div>'+
    (miss.length?'<div class="sp-table-wrap"><table class="data-table"><thead><tr><th>姓名</th><th>医院</th><th>地区</th><th>操作</th></tr></thead><tbody>'+
      miss.map(function(e){return '<tr><td>'+esc(e.patient)+'</td><td>'+esc(e.hospital)+'</td><td>'+esc(e.city)+'</td><td><button class="btn btn-ghost btn-xs" onclick="window._spGoPatient(\''+e.id+'\')">打开画像</button></td></tr>'}).join('')+
      '</tbody></table></div>':'<div style="color:var(--color-success-fg);font-size:13px">全部患者均已覆盖</div>')+'</div>';
  spModal('画像要素明细 · '+el.id,body,'<button class="btn btn-ghost" data-sp-close>关闭</button>');
};
/* ---- 映射规则 CRUD ---- */
window._spRuleFilterSet=function(){
  var g=function(id){var el=document.getElementById(id);return el?String(el.value||'').trim():''};
  _spRuleFilter={q:g('spRuleQ'),dim:g('spRuleDim')};spRefresh();
};
window._spRuleReset=function(){_spRuleFilter={q:'',dim:''};spRefresh();};
window._spToggleRule=function(id){
  var r=_spMapRules.filter(function(x){return x.id===id})[0];if(!r)return;
  r.on=!r.on;spRefresh();toast('映射规则 '+id+' 已'+(r.on?'启用':'停用'));
};
function spRuleFormBody(r){
  var dimOpts=SP_DIMS.concat(['指标汇总']).map(function(d){return '<option'+(r&&r.dim===d?' selected':'')+'>'+esc(d)+'</option>'}).join('');
  var logics=SP_RULE_TEMPLATES.slice();
  if(r&&logics.indexOf(r.logic)<0)logics.push(r.logic);
  var lOpts=logics.map(function(t){return '<option'+(r&&r.logic===t?' selected':'')+'>'+esc(t)+'</option>'}).join('');
  return '<div class="sp-form-grid">'+
    '<div class="sp-form-row"><label>维度</label><select id="spf_rdim">'+dimOpts+'</select></div>'+
    '<div class="sp-form-row"><label>映射逻辑</label><select id="spf_rlogic">'+lOpts+'</select></div>'+
    '<div class="sp-form-row"><label>输入要素</label><input id="spf_rin" placeholder="如：TNM + 临床分期" value="'+(r?esc(r.input):'')+'"></div>'+
    '<div class="sp-form-row"><label>画像结论</label><input id="spf_rout" placeholder="如：早期/晚期分层" value="'+(r?esc(r.out):'')+'"></div>'+
  '</div>';
}
window._spRuleAdd=function(){
  spModal('新增映射规则',spRuleFormBody(null),
    '<button class="btn btn-ghost" data-sp-close>取消</button><button class="btn btn-primary" onclick="window._spRuleSave()">保存</button>');
};
window._spRuleEdit=function(id){
  var r=_spMapRules.filter(function(x){return x.id===id})[0];if(!r)return;
  spModal('编辑映射规则 · '+id,spRuleFormBody(r),
    '<button class="btn btn-ghost" data-sp-close>取消</button><button class="btn btn-primary" onclick="window._spRuleSave(\''+id+'\')">保存</button>');
};
window._spRuleSave=function(id){
  var g=function(x){var el=document.getElementById(x);return el?String(el.value||'').trim():''};
  var input=g('spf_rin'),out=g('spf_rout');
  if(!input||!out){toast('请填写输入要素与画像结论');return;}
  if(id){
    var r=_spMapRules.filter(function(x){return x.id===id})[0];
    if(r){r.dim=g('spf_rdim');r.input=input;r.out=out;r.logic=g('spf_rlogic');}
    toast('规则 '+id+' 已更新');
  }else{
    var n=1;_spMapRules.forEach(function(x){var m=/\d+$/.exec(x.id);if(m)n=Math.max(n,parseInt(m[0],10)+1)});
    var nid='MR'+String(n).padStart(2,'0');
    _spMapRules.push({id:nid,dim:g('spf_rdim'),input:input,out:out,logic:g('spf_rlogic'),on:true});
    toast('新增规则 '+nid+' 成功');
  }
  document.querySelectorAll('[data-sp-close]').forEach(function(b){b.click()});
  spRefresh();
};
window._spRuleView=function(id){
  var r=_spMapRules.filter(function(x){return x.id===id})[0];if(!r)return;
  var body='<div class="sp-kv-grid" style="grid-template-columns:1fr">'+
    spKv('规则号',r.id)+spKv('维度',r.dim)+spKv('输入要素',r.input)+spKv('画像结论',r.out)+spKv('映射逻辑',r.logic)+spKv('状态',r.on?'已启用':'已停用')+
    '</div>';
  spModal('映射规则明细 · '+r.id,body,'<button class="btn btn-ghost" data-sp-close>关闭</button>');
};
/* ---- NLP 提取 ---- */
window._spNlpSet=function(id,st){
  var n=_spNlp.filter(function(x){return x.id===id})[0];if(!n)return;
  n.st=st;spRefresh();toast('提取结果 '+id+' 已'+st);
};
/* ---- 校验与报告 ---- */
window._spCheckView=function(id){
  var c=SP_CHECKS.filter(function(x){return x.id===id})[0];if(!c)return;
  var res=c.run();
  var body='<div class="sp-kv-grid" style="grid-template-columns:repeat(2,1fr)">'+
    spKv('校验项',c.name)+spKv('执行时间',_spCheckTime)+spKv('异常数',res.bad.length+' 例')+spKv('结论',res.detail)+
    '</div>'+
    (res.bad.length?'<div style="margin-top:14px"><div style="font-weight:700;margin-bottom:8px">异常患者</div>'+
      '<div class="sp-table-wrap"><table class="data-table"><thead><tr><th>姓名</th><th>医院</th><th>地区</th><th>操作</th></tr></thead><tbody>'+
      res.bad.map(function(e){return '<tr><td>'+esc(e.patient)+'</td><td>'+esc(e.hospital)+'</td><td>'+esc(e.city)+'</td><td><button class="btn btn-ghost btn-xs" onclick="window._spGoPatient(\''+e.id+'\')">打开画像</button></td></tr>'}).join('')+
      '</tbody></table></div>':'');
  spModal('校验明细 · '+id+' '+c.name,body,'<button class="btn btn-ghost" data-sp-close>关闭</button>');
};
window._spGoPatient=function(pid){
  document.querySelectorAll('[data-sp-close]').forEach(function(b){b.click()});
  _wbDetail=pid;
  if(typeof navigateTo==='function')navigateTo('sp-patients');
  else{_spSub='workbench';spRefresh();}
};
function spDownload(name,text){
  var blob=new Blob(['\ufeff'+text],{type:'text/plain;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();
  setTimeout(function(){URL.revokeObjectURL(a.href)},4000);
}
/* ---- 版本与归档 ---- */
window._spVerView=function(v){
  var ver=SP_VERSIONS.filter(function(x){return x.v===v})[0];if(!ver)return;
  var body='<div class="sp-kv-grid" style="grid-template-columns:repeat(2,1fr)">'+
    spKv('版本号',ver.v)+spKv('更新时间',ver.time)+spKv('更新人',ver.by)+spKv('变更摘要',ver.desc)+
    '</div>'+
    '<div style="margin-top:14px"><div style="font-weight:700;margin-bottom:8px">变更明细</div><ul style="margin:0;padding-left:20px">'+
    (ver.changes||[]).map(function(c){return '<li style="font-size:13px;color:var(--color-text-body);padding:3px 0">'+esc(c)+'</li>'}).join('')+'</ul></div>';
  spModal('画像版本 · '+ver.v,body,'<button class="btn btn-ghost" data-sp-close>关闭</button>');
};
window._spArcView=function(id){
  var a=SP_ARCHIVES.filter(function(x){return x.id===id})[0];if(!a)return;
  var s=a.stats||{};
  var body='<div class="sp-kv-grid" style="grid-template-columns:repeat(2,1fr)">'+
    spKv('归档编号',a.id)+spKv('归档范围',a.range)+spKv('画像数',a.events+' 例')+spKv('说明',a.note)+
    spKv('覆盖地市',(s.cities||11)+' 个')+spKv('覆盖病种',(s.sites||7)+' 种')+
    spKv('随访覆盖率',(s.fuRate!=null?s.fuRate+'%':'—'))+spKv('早期占比',(s.earlyRate!=null?s.earlyRate+'%':'—'))+
    spKv('归档质量分',(s.score!=null?s.score+'%':'—'))+
    '</div>';
  spModal('画像归档 · '+a.id,body,'<button class="btn btn-ghost" data-sp-close>关闭</button><button class="btn btn-primary" onclick="window._spArcDownload(\''+id+'\')">下载归档包</button>');
};
window._spArcDownload=function(id){
  var a=SP_ARCHIVES.filter(function(x){return x.id===id})[0];if(!a)return;
  var s=a.stats||{};
  spDownload(id+'.txt','江西省肿瘤专科画像归档\n归档编号：'+a.id+'\n归档范围：'+a.range+'\n画像数：'+a.events+' 例\n覆盖地市：'+(s.cities||11)+' 个\n覆盖病种：'+(s.sites||7)+' 种\n随访覆盖率：'+(s.fuRate!=null?s.fuRate+'%':'—')+'\n早期占比：'+(s.earlyRate!=null?s.earlyRate+'%':'—')+'\n归档质量分：'+(s.score!=null?s.score+'%':'—')+'\n—— 江西省肿瘤防治中心');
  toast('归档包 '+id+' 已下载');
};
window._spDoArchive=function(){
  var scopeSel='<select id="spf_arcScope"><option>全省 · 2026-09</option><option>南昌市</option><option>赣州市</option><option>九江市</option></select>';
  spModal('执行画像归档','<div class="sp-form-grid"><div class="sp-form-row"><label>归档范围</label>'+scopeSel+'</div></div><div style="margin-top:10px;font-size:13px;color:var(--color-text-muted)">归档将按当前数据实时计算统计量并封存快照。</div>',
    '<button class="btn btn-ghost" data-sp-close>取消</button><button class="btn btn-primary" onclick="window._spArchiveConfirm()">确认归档</button>');
};
window._spArchiveConfirm=function(){
  var el=document.getElementById('spf_arcScope');
  var scope=el?el.value:'全省 · 2026-09';
  var list=scope.indexOf('全省')>=0?tumorEvents:tumorEvents.filter(function(e){return e.city===scope});
  var a=spAgg(list);
  var ym='2026-09';
  SP_ARCHIVES.unshift({id:'AR-'+ym+'-'+scope.slice(0,2),range:scope+' 实时归档',events:a.total,note:'刚刚执行 · 实时画像封存',stats:{cities:scope.indexOf('全省')>=0?11:1,sites:7,fuRate:a.fuRate,earlyRate:a.earlyRate,score:Math.round((a.fuRate*0.4+a.earlyRate*0.3+95*0.3)*10)/10}});
  document.querySelectorAll('[data-sp-close]').forEach(function(b){b.click()});
  spRefresh();
  toast('画像归档完成：共 '+SP_ARCHIVES.length+' 份归档快照');
};

/* ---- 主入口：app.html 传入 sub = workbench / overview / config ---- */
var _spSub='workbench';
function render(sub){
  if(sub)_spSub=sub;
  window._spBindMap();
  var content='';
  if(_spSub==='workbench')content=renderWorkbench();
  else if(_spSub==='overview')content=renderOverview();
  else if(_spSub==='config')content=renderConfig();
  return '<div style="padding:0"><div id="spMainContent">'+content+'</div></div>';
}
window.renderSpecialtyPortrait=render;
})();
