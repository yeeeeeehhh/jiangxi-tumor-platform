/* Focused report-card detail renderer: final card view + linked source data. */
(function(){
var detailStyle=document.createElement('style');
detailStyle.textContent='.report-tumor-record{margin-top:18px;border:1px solid #dfe8ed;border-radius:5px;overflow:hidden}.report-tumor-record:first-of-type{margin-top:0}.report-tumor-record-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 14px;background:#f7fafb;border-bottom:1px solid #e3ebef}.report-tumor-record-title{font-size:13px;font-weight:700;color:#17324d}.report-tumor-record-meta{font-size:12px;color:#66809b;margin-top:3px}.report-tumor-record .tumor-form-block{margin:0;padding:14px;border:0}.card-detail-aside:empty{background:transparent;border:0;box-shadow:none;min-height:1px}.card-merge-notice{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;padding:10px 14px;background:#fff;border:1px solid #dbe4ea;border-left:3px solid #168a94;border-radius:5px;font-size:13px;color:#41586e}.card-source-list{display:flex;flex-direction:column;gap:10px}.card-source-item{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 14px;border:1px solid #e0e8ed;border-radius:5px;background:#fbfdfd}.card-source-main{display:flex;align-items:center;gap:10px;flex-wrap:wrap;min-width:0}.card-source-id{color:var(--primary);font-weight:600;font-size:13px;text-decoration:none}.card-source-meta{font-size:12px;color:#66809b}.card-source-side{display:flex;align-items:center;gap:10px;flex-shrink:0}.card-source-version{font-size:12px;font-weight:600;color:#41586e}@media(max-width:760px){.report-tumor-record-head{display:block}.report-tumor-record-head .badge{display:inline-flex;margin-top:8px}.card-merge-notice{flex-direction:column;align-items:flex-start}.card-source-item{flex-direction:column;align-items:flex-start}}';
document.head.appendChild(detailStyle);

/* 合并关系（原型数据）：人工合并卡作为最终报告卡，统一管理同患者的原始卡/补报卡 */
var MERGE_FINAL_ID='JX-2026-000094';
var MERGE_MANAGED_IDS=['JX-2026-000091','JX-2026-000092','JX-2026-000093'];
window.ensureReportCardMergeGroup=function(rows){
  rows=rows||[];
  var final=rows.find(function(card){return card.id===MERGE_FINAL_ID});
  if(!final){
    final={id:MERGE_FINAL_ID,name:'张伟',sex:'男',birth:'1965-03-12',idNo:'360102196503121234',phone:'13800000001',job:'工人',nation:'汉族',marriage:'已婚',workUnit:'南昌第一机械厂',household:'江西省/南昌市/东湖区/董家窑街道',residence:'江西省/南昌市/东湖区/阳明路/民巷社区',site:'肺',pathology:'鳞状细胞癌',icd10:'C34.9',diagnosisDate:'2026-03-15',outpatientNo:'MZ240501',inpatientNo:'ZY240088',reportDate:'2026-06-20',doctor:'王医生',reportUnit:'江西省肿瘤医院',region:'南昌市东湖区',cardType:'<span class="badge badge-success">人工合并卡</span>',checkStatus:'<span class="badge badge-success">通过</span>',auditStatus:'<span class="badge badge-success">已核对</span>',errors:[],managedCards:MERGE_MANAGED_IDS.slice()};
    rows.push(final);
  }
  MERGE_MANAGED_IDS.forEach(function(id){var managed=rows.find(function(card){return card.id===id});if(managed&&!managed.managedBy)managed.managedBy=MERGE_FINAL_ID});
  if(window.reportCardFollowup&&!window.reportCardFollowup[MERGE_FINAL_ID])window.reportCardFollowup[MERGE_FINAL_ID]={dlc:'2026-06-15',state:'存活',deadplace:'-',caus:'-',causicd:'-',deathda:'-',deadDoct:'-'};
  return final;
};
ensureReportCardMergeGroup(window.reportCardListData);

function getMergeGroup(card){
  var cards=window.reportCardListData||[];
  var finalId=card&&card.managedBy?card.managedBy:(card&&card.managedCards?card.id:null);
  if(!finalId)return null;
  var final=cards.find(function(item){return item.id===finalId});
  if(!final)return null;
  var managed=(final.managedCards||[]).map(function(id){return cards.find(function(item){return item.id===id})}).filter(Boolean);
  return {final:final,managed:managed};
}
function getLinkedSources(display,group){
  var ids=[display.id].concat(group?group.managed.map(function(card){return card.id}):[]);
  return (typeof sourceDataRecords==='undefined'?[]:sourceDataRecords).filter(function(record){
    return (record.linkedCards||[]).some(function(cardId){return ids.indexOf(cardId)>-1});
  });
}
function cardTypeOf(card){return (card.cardType||'').replace(/<[^>]+>/g,'').trim()||'-'}
function subsite(card){if(card.site==='肺')return '上叶';if(card.site==='胃')return '胃窦';if(card.site==='肝')return '右叶';if(card.site==='乳房')return '左乳';return '-'}
function tumorFields(card){var diagnosis=(card.site||'-')+'恶性肿瘤（'+(card.icd10||'-')+'）';var topo=card.topoCode||(card.site==='肺'?'C34.9':card.site==='胃'?'C16.9':card.site==='肝'?'C22.0':card.site==='乳房'||card.site==='乳腺'?'C50.9':card.icd10||'-');var morphMap={'鳞状细胞癌':'8070/3','腺癌':'8140/3','小细胞癌':'8041/3','浸润性导管癌':'8500/3','导管癌':'8500/3'};var morph=card.morphCode||morphMap[card.pathology]||'8000/3';return [['发病部位（大类）',card.site],['亚部位',subsite(card)],['病理类型',card.pathology],['肿瘤解剖学部位代码 (ICD-O-3)',topo],['肿瘤形态学代码 (ICD-O-3)',morph],['行为','/3 恶性'],['分级','II级'],['诊断依据','病理学诊断'],['临床分期','IIb期'],['TNM-T','T2'],['TNM-N','N0'],['TNM-M','M0'],['确诊日期',card.diagnosisDate],['自动 ICD10',card.icd10],['ICD10 编码',card.icd10],['治疗信息','手术 + 化疗'],['诊断结果',diagnosis],['详细诊断结果',(card.site||'-')+'部 '+(card.pathology||'-')+'，分级 II 级'],['单位区划',card.region],['诊断单位',card.reportUnit],['门诊号',card.outpatientNo],['住院号',card.inpatientNo],['报告日期',card.reportDate],['报告医师',card.doctor]]}
function tumorRecord(card){var type=cardTypeOf(card);return '<div class="report-tumor-record"><div class="report-tumor-record-head"><div><div class="report-tumor-record-title">报告卡编号：'+cardDetailEscape(card.id)+'</div><div class="report-tumor-record-meta">报告日期：'+cardDetailValue(card.reportDate)+'　报告单位：'+cardDetailValue(card.reportUnit)+'</div></div><span class="badge badge-info">'+cardDetailEscape(type)+'</span></div><div class="tumor-form-block"><div class="tumor-form-grid">'+tumorFields(card).map(function(field){return tumorFormField(field[0],field[1],false,field[0]==='诊断结果'||field[0]==='详细诊断结果',field[0]==='自动 ICD10')}).join('')+'</div></div></div>'}
function sourceRow(record,display){
  var via=(record.linkedCards||[]).filter(function(cardId){return cardId!==display.id});
  return '<div class="card-source-item"><div class="card-source-main"><a class="card-source-id" href="javascript:void(0)" onclick="openSourceDataDetail(\''+record.id+'\')">'+record.id+'</a><span class="badge badge-info">'+cardDetailEscape(record.sourceType)+'</span><span class="card-source-meta">'+cardDetailValue(record.org)+' · '+cardDetailValue(record.batch)+' · '+cardDetailValue(record.fileName)+' 第'+cardDetailValue(record.rowNo)+'行 · 上传 '+cardDetailValue(record.uploadTime)+(via.length?' · 关联卡 '+via.map(function(cardId){return cardDetailEscape(cardId)}).join('、'):'')+'</span></div><div class="card-source-side">'+(typeof sourceBadge==='function'?sourceBadge(record.validation):'')+'<span class="card-source-version">V'+cardDetailValue(record.version)+(typeof sourceHasChange==='function'&&sourceHasChange(record)?'（已修订）':'')+'</span><button class="btn btn-ghost btn-xs" onclick="openSourceDataDetail(\''+record.id+'\')">查看完整信息</button></div></div>'
}
window.openCardDetailDialogById=function(id){
  var card=(window.reportCardListData||[]).find(function(item){return item.id===id});
  if(!card){toast('未找到该报告卡','error');return}
  if(typeof openCardDetailDialog==='function')openCardDetailDialog(card);else toast('打开报告卡详情失败','error')
};

window.cardListDetail=function(id){
  var cards=window.reportCardListData||[];
  var current=cards.find(function(card){return card.id===id});
  if(!current){toast('未找到该报告卡','error');return}
  ensureReportCardMergeGroup(cards);
  var group=getMergeGroup(current);
  var display=group?group.final:current;
  var entered=group&&current.id!==display.id?current:null;
  var follow=window.reportCardFollowup&&window.reportCardFollowup[display.id]?window.reportCardFollowup[display.id]:{};
  var age=display.birth?Math.floor((new Date()-new Date(display.birth))/(365.25*24*3600*1000))+'岁':'-';
  var cardType=cardTypeOf(display);
  var canEdit=typeof cardCanEdit==='function'&&cardCanEdit(display);
  var basic=[['报告卡编号',display.id],['记录类型','发病报告卡'],['报卡类型',cardType],['姓名',display.name],['其它证件类型',display.otherIdType],['其它证件号码',display.otherIdNo],['身份证号码',display.idNo],['性别',display.sex],['出生日期',display.birth],['年龄',age],['联系电话',display.phone],['联系人关系',display.contactRelation],['联系人',display.contactName],['联系人电话',display.contactPhone],['民族',display.nation],['婚姻状况',display.marriage],['职业',display.job],['工作单位',display.workUnit],['户籍地址',display.household],['详细户籍地址',display.householdDetail],['常住地址',display.residence],['详细常住地址',display.residenceDetail]];
  var followFields=[['最后接触日期',follow.dlc],['最后接触状态',follow.state],['生存月数',follow.surmonth],['死亡地点',follow.deadplace],['根本死因',follow.caus],['死因 ICD10',follow.causicd],['死亡日期',follow.deathda],['死亡报告医师',follow.deadDoct]];
  var actions='<button class="btn btn-ghost btn-sm" onclick="switchReportDataView(\'cards\')">返回报告卡列表</button>'+
    (canEdit?'<button class="btn btn-primary btn-sm" onclick="cardListEdit(\''+cardDetailEscape(display.id)+'\')">编辑报告卡</button>':'')+
    '<button class="btn btn-outline btn-sm" onclick="typeof jumpToFollowupByCard===\'function\'&&jumpToFollowupByCard(\''+cardDetailEscape(display.id)+'\')">随访单据</button>'+
    (follow.state==='死亡'?'<button class="btn btn-outline btn-sm" onclick="typeof jumpToDeathByCard===\'function\'&&jumpToDeathByCard(\''+cardDetailEscape(display.id)+'\')">死亡信息列表</button>':'');
  var sources=getLinkedSources(display,group);
  var sourceSection='<section class="card-detail-section" id="report-card-source"><div class="card-detail-section-title">关联上报数据'+(sources.length?'<span style="font-weight:400;font-size:12px;color:#66809b;margin-left:8px">共 '+sources.length+' 条</span>':'')+'</div><div class="card-source-list">'+(sources.length?sources.map(function(record){return sourceRow(record,display)}).join(''):'<div class="card-detail-empty">暂无关联上报数据</div>')+'</div></section>';
  var tumor='<section class="card-detail-section" id="report-card-tumor"><div class="card-detail-section-title">肿瘤报告信息</div>'+tumorRecord(display)+'</section>';
  var followSection='<section class="card-detail-section" id="report-card-follow"><div class="card-detail-section-title">随访信息</div><div class="card-detail-fields">'+followFields.map(function(f){return cardDetailField(f[0],f[1])}).join('')+'</div></section>';
  var notice=entered?'<div class="card-merge-notice"><span>报告卡 '+cardDetailEscape(entered.id)+'（'+cardDetailEscape(cardTypeOf(entered))+'）已纳入最终报告卡 '+cardDetailEscape(display.id)+' 统一管理</span><button class="btn btn-ghost btn-xs" onclick="openCardDetailDialogById(\''+cardDetailEscape(entered.id)+'\')">查看 '+cardDetailEscape(entered.id)+' 完整信息</button></div>':'';
  var nav='<nav class="card-detail-nav" aria-label="报告卡详情导航">'+cardDetailNavItem('report-card-basic','基本信息')+cardDetailNavItem('report-card-tumor','肿瘤报告信息')+cardDetailNavItem('report-card-follow','随访信息')+cardDetailNavItem('report-card-source','关联上报数据',sources.length||'')+'</nav>';
  var main='<main class="card-detail-main" id="card-detail-main"><div class="card-detail-summary"><div><div class="card-detail-patient">'+cardDetailEscape(display.name)+' <span style="font-size:13px;font-weight:500;color:#66809b">'+cardDetailEscape(display.sex||'')+' · '+age+'</span></div><div class="card-detail-meta">报告卡编号：'+cardDetailEscape(display.id)+'　报告日期：'+cardDetailValue(display.reportDate)+'</div></div><span class="badge badge-info">'+cardDetailEscape(cardType)+'</span></div>'+cardDetailSection('report-card-basic','基本信息',basic)+tumor+followSection+sourceSection+'</main>';
  var aside='<aside class="card-detail-aside" aria-hidden="true"></aside>';
  document.getElementById('pageContainer').innerHTML='<div class="card-detail-page"><div class="card-detail-topbar"><div><div class="card-detail-title">报告卡详情</div><div class="card-detail-kicker">'+cardDetailEscape(display.name)+' · '+cardDetailEscape(display.id)+'</div></div><div class="card-detail-actions">'+actions+'</div></div>'+notice+'<div class="card-detail-workspace">'+nav+main+aside+'</div></div>';
  setActiveMenu('datamgmt-card');updateBreadcrumb('datamgmt-card','报告卡详情');window.scrollTo(0,0);scrollCardDetailSection('report-card-basic');
};
})();
