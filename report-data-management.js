// Unified report-data workspace: operational report cards and immutable source records.
var reportDataState={view:'cards',keyword:'',sourceType:'',validation:'',cardStatus:'',cardType:'',selectedSourceId:null,editing:false};
var sourceDataRecords=[
{id:'SRC-20240612-0008',batch:'BAT-20240612-01',sourceType:'HIS',fileName:'HIS_20240612.xlsx',rowNo:8,uploadTime:'2024-06-12 09:18',org:'测试机构',name:'赵伟',idNo:'360102196509051234',original:{site:'肺',pathology:'腺癌',icd10:'-'},current:{site:'肺',pathology:'腺癌',icd10:'-'},validation:'错误',duplicate:'无重卡',linkedCards:[],version:1,history:[]},
{id:'SRC-20240612-0009',batch:'BAT-20240612-01',sourceType:'HIS',fileName:'HIS_20240612.xlsx',rowNo:9,uploadTime:'2024-06-12 09:18',org:'江西省肿瘤医院',name:'张伟',idNo:'360102196503121234',original:{site:'肺',pathology:'鳞状细胞癌',icd10:'C34.9'},current:{site:'肺',pathology:'鳞状细胞癌',icd10:'C34.9'},validation:'通过',duplicate:'无重卡',linkedCards:['JX-2026-000091'],version:1,history:[]},
{id:'SRC-20240612-0010',batch:'BAT-20240612-01',sourceType:'HIS',fileName:'HIS_20240612.xlsx',rowNo:10,uploadTime:'2024-06-12 09:18',org:'南昌大学第一附属医院',name:'李娜',idNo:'360103197808152345',original:{site:'乳腺',pathology:'导管癌',icd10:'C50.9'},current:{site:'乳房',pathology:'浸润性导管癌',icd10:'C50.9'},validation:'警告',duplicate:'无重卡',linkedCards:['JX-2026-000102'],version:2,history:[{version:2,time:'2024-06-13 10:22',operator:'管理员',reason:'按病理报告修正部位和病理类型',changes:'发病部位：乳腺 -> 乳房；病理类型：导管癌 -> 浸润性导管癌'}]},
{id:'SRC-20240612-0011',batch:'BAT-20240612-01',sourceType:'HIS',fileName:'HIS_20240612.xlsx',rowNo:11,uploadTime:'2024-06-12 09:18',org:'南昌大学第一附属医院',name:'张伟',idNo:'360102196503121234',original:{site:'肺',pathology:'腺癌',icd10:'C34.9'},current:{site:'肺',pathology:'腺癌',icd10:'C34.9'},validation:'通过',duplicate:'疑似重卡',linkedCards:['JX-2026-000092','JX-2026-000093'],version:1,history:[]},
/* 以下为报卡查重各报告卡对应的上报数据（按身份证号匹配） */
{id:'SRC-20240620-0031',batch:'BAT-20240620-02',sourceType:'HIS',fileName:'HIS_20240620.xlsx',rowNo:31,uploadTime:'2024-06-20 15:40',org:'南昌市第一医院',name:'张伟',idNo:'360102196503129876',original:{site:'肺上叶',pathology:'鳞状细胞癌',icd10:'C34.1'},current:{site:'肺上叶',pathology:'鳞状细胞癌',icd10:'C34.1'},validation:'警告',duplicate:'疑似重卡',linkedCards:['JX-2026-000093'],version:1,history:[]},
{id:'SRC-20240615-0021',batch:'BAT-20240615-01',sourceType:'HIS',fileName:'HIS_20240615.xlsx',rowNo:21,uploadTime:'2024-06-15 11:05',org:'赣州市肿瘤医院',name:'王强',idNo:'360702199002283456',original:{site:'胃',pathology:'腺癌',icd10:'C16.9'},current:{site:'胃',pathology:'腺癌',icd10:'C16.9'},validation:'通过',duplicate:'疑似重卡',linkedCards:['JX-2026-000111'],version:1,history:[]},
{id:'SRC-20240622-0045',batch:'BAT-20240622-01',sourceType:'HIS',fileName:'HIS_20240622.xlsx',rowNo:45,uploadTime:'2024-06-22 09:30',org:'赣南医学院第一附属医院',name:'王强',idNo:'360702199002283456',original:{site:'结肠',pathology:'腺癌',icd10:'C18.9'},current:{site:'结肠',pathology:'腺癌',icd10:'C18.9'},validation:'通过',duplicate:'多原发',linkedCards:['JX-2026-000112'],version:1,history:[]},
{id:'SRC-20240612-0052',batch:'BAT-20240612-01',sourceType:'HIS',fileName:'HIS_20240612.xlsx',rowNo:52,uploadTime:'2024-06-12 09:18',org:'江西省人民医院',name:'刘洋',idNo:'360104198806074567',original:{site:'肝',pathology:'肝细胞癌',icd10:'C22.0'},current:{site:'肝',pathology:'肝细胞癌',icd10:'C22.0'},validation:'通过',duplicate:'无重卡',linkedCards:['JX-2026-000121'],version:1,history:[]},
{id:'SRC-20240618-0063',batch:'BAT-20240618-01',sourceType:'HIS',fileName:'HIS_20240618.xlsx',rowNo:63,uploadTime:'2024-06-18 14:12',org:'南昌市第二医院',name:'赵敏',idNo:'360102198512125678',original:{site:'甲状腺',pathology:'乳头状癌',icd10:'C73.9'},current:{site:'甲状腺',pathology:'乳头状癌',icd10:'C73.9'},validation:'通过',duplicate:'疑似重卡',linkedCards:['JX-2026-000131'],version:1,history:[]},
{id:'SRC-20240625-0074',batch:'BAT-20240625-01',sourceType:'HIS',fileName:'HIS_20240625.xlsx',rowNo:74,uploadTime:'2024-06-25 10:48',org:'江西省中西医结合医院',name:'赵敏',idNo:'360102198512125678',original:{site:'肺',pathology:'腺癌',icd10:'C34.9'},current:{site:'肺',pathology:'腺癌',icd10:'C34.9'},validation:'通过',duplicate:'多原发',linkedCards:['JX-2026-000132'],version:1,history:[]},
{id:'SRC-20240610-0085',batch:'BAT-20240610-01',sourceType:'HIS',fileName:'HIS_20240610.xlsx',rowNo:85,uploadTime:'2024-06-10 08:55',org:'九江市第一人民医院',name:'陈刚',idNo:'360112197205206789',original:{site:'食管',pathology:'鳞状细胞癌',icd10:'C15.9'},current:{site:'食管',pathology:'鳞状细胞癌',icd10:'C15.9'},validation:'通过',duplicate:'多原发',linkedCards:['JX-2026-000141'],version:1,history:[]},
{id:'SRC-20240628-0096',batch:'BAT-20240628-01',sourceType:'HIS',fileName:'HIS_20240628.xlsx',rowNo:96,uploadTime:'2024-06-28 16:20',org:'九江市肿瘤医院',name:'陈刚',idNo:'360112197205206789',original:{site:'直肠',pathology:'腺癌',icd10:'C20.9'},current:{site:'直肠',pathology:'腺癌',icd10:'C20.9'},validation:'警告',duplicate:'多原发',linkedCards:['JX-2026-000142'],version:1,history:[]},
{id:'SRC-20240620-0107',batch:'BAT-20240620-02',sourceType:'HIS',fileName:'HIS_20240620.xlsx',rowNo:107,uploadTime:'2024-06-20 15:40',org:'南昌市第三医院',name:'李娜',idNo:'360103197808152345',original:{site:'乳房',pathology:'浸润性导管癌',icd10:'C50.9'},current:{site:'乳房',pathology:'浸润性导管癌',icd10:'C50.9'},validation:'通过',duplicate:'疑似重卡',linkedCards:['JX-2026-000103'],version:1,history:[]}
];

var reportDataStyles=document.createElement('style');
reportDataStyles.textContent='.report-data-tabs{display:flex;align-items:center;gap:4px;border-bottom:1px solid var(--border);margin-bottom:16px}.report-data-tab{appearance:none;border:0;background:transparent;color:#667085;padding:11px 16px;font-size:14px;font-weight:600;cursor:pointer;border-bottom:2px solid transparent}.report-data-tab.active{color:var(--primary);border-bottom-color:var(--primary)}.report-data-tab .count{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:18px;padding:0 6px;margin-left:6px;border-radius:9px;background:#eef2f7;color:#667085;font-size:12px}.report-data-tab.active .count{background:#e8f1fb;color:var(--primary)}.source-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));border:1px solid var(--border);border-radius:6px;margin-bottom:14px;background:#fff}.source-summary-item{padding:12px 16px;border-right:1px solid var(--border)}.source-summary-item:last-child{border-right:0}.source-summary-label{font-size:12px;color:#667085}.source-summary-value{font-size:20px;font-weight:700;color:#1f2937;margin-top:3px}.source-link-list{display:flex;gap:6px;flex-wrap:wrap}.source-detail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:18px 20px;border-bottom:1px solid var(--border)}.source-detail-title{font-size:18px;font-weight:700;color:#1f2937}.source-detail-meta{font-size:13px;color:#667085;margin-top:5px}.source-section{padding:18px 20px;border-bottom:1px solid var(--border)}.source-section-title{font-size:15px;font-weight:600;color:#344054;margin-bottom:12px}.source-revision-form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.source-revision-reason{grid-column:1/-1}.source-revision-form label{display:block;font-size:12px;color:#667085;margin-bottom:5px}.source-revision-form input:not([type=checkbox]):not([type=radio]),.source-revision-form textarea{width:100%}@media(max-width:900px){.source-summary{grid-template-columns:repeat(2,1fr)}.source-summary-item:nth-child(2){border-right:0}.source-revision-form{grid-template-columns:1fr}.source-revision-reason{grid-column:auto}}';
document.head.appendChild(reportDataStyles);

var collectionMenu=menuData.find(function(item){return item.id==='collection'});
if(collectionMenu){var reportMenu=collectionMenu.children.find(function(item){return item.id==='datamgmt-card'});if(reportMenu)reportMenu.label='报告卡列表';var sourceMenu=collectionMenu.children.find(function(item){return item.id==='datamgmt-source'});if(sourceMenu)sourceMenu.label='上报数据管理'}
var reportRoleGroup=roleMenuTree.find(function(group){return group.group==='病例上报'});
if(reportRoleGroup){var roleReportMenu=reportRoleGroup.children.find(function(item){return item.id==='datamgmt-card'});if(roleReportMenu)roleReportMenu.label='报告卡列表';var roleSourceMenu=reportRoleGroup.children.find(function(item){return item.id==='datamgmt-source'});if(roleSourceMenu)roleSourceMenu.label='上报数据管理';var roleEntryMenu=reportRoleGroup.children.find(function(item){return item.id==='collection-batch'});if(roleEntryMenu)roleEntryMenu.label='报告卡登记'}
// 报告卡录入入口已下线：侧边栏不再注入 collection-entry（改为经报告卡列表 +添加 进入）

var baseNavigateTo=navigateTo;
navigateTo=function(id){
if(id==='datamgmt-card'){reportDataState.view='cards';reportDataState.editing=false}
if(id==='datamgmt-source'){reportDataState.view='source';reportDataState.editing=false}
if(id==='collection-entry'){reportDataState.view='cards';reportDataState.editing=false}
baseNavigateTo(id)
};

var baseRenderPageForSource=renderPage;
function alignReportDataToolbar(){
var filterActions=document.querySelector('#pageContainer .filter-toolbar .filter-actions');
if(!filterActions)return;
var exportButton=null;
var toolbar=document.querySelector('#pageContainer .page-toolbar .toolbar-actions');
if(toolbar)exportButton=Array.from(toolbar.children).find(function(button){return button.textContent.indexOf('导出')===0});
if(!exportButton)exportButton=Array.from(filterActions.children).find(function(button){return button.textContent.indexOf('导出')===0});
if(exportButton)filterActions.appendChild(exportButton);
}
function normalizeReportListFilters(isSource){
var toolbar=document.querySelector('#pageContainer .filter-toolbar');
if(!toolbar||isSource)return;
var groups=Array.from(toolbar.querySelectorAll(':scope > .form-group'));
var typeGroup=groups.find(function(group){var label=group.querySelector('label');return label&&label.textContent==='类型'});
if(typeGroup){var label=typeGroup.querySelector('label');if(label)label.textContent='报告卡类型';var typeSelect=typeGroup.querySelector('select');if(typeSelect)typeSelect.innerHTML='<option value="">报告卡类型（全部）</option><option>原始卡</option><option>补报卡</option><option>人工合并卡</option><option>自动合并卡</option><option>克隆合并卡</option><option>多原发卡</option>'}
}
renderPage=function(id){
if(id==='datamgmt-source'){
var detailView=reportDataState.view==='source-detail';
document.getElementById('pageContainer').innerHTML=detailView?renderSourceDataDetail():renderSourceDataManagement();
setActiveMenu('datamgmt-source');
updateBreadcrumb('datamgmt-source',detailView?'上报数据详情':'上报数据管理');
if(detailView){var firstSourceNav=document.querySelector('#pageContainer .src-nav-item,#pageContainer .card-detail-nav button');if(firstSourceNav)firstSourceNav.classList.add('active')}
else{autoSizeSelects();alignReportDataToolbar();normalizeReportListFilters(true)}
return;
}
baseRenderPageForSource(id);
if(id==='datamgmt-card'){alignReportDataToolbar();normalizeReportListFilters(false)}
if(id==='collection-death')normalizeReportListFilters(false)
};

var baseRenderReportCardList=renderReportCardList;
renderReportCardList=function(){
if(reportDataState.view==='source-detail')return renderSourceDataDetail();
return baseRenderReportCardList()
};

function renderReportDataTabs(){
return '<div class="report-data-tabs" role="tablist"><button class="report-data-tab '+(reportDataState.view==='cards'?'active':'')+'" onclick="switchReportDataView(\'cards\')">报告卡列表<span class="count">'+((window.reportCardListData||[]).length||7)+'</span></button><button class="report-data-tab '+(reportDataState.view==='source'?'active':'')+'" onclick="switchReportDataView(\'source\')">上报数据管理<span class="count">'+sourceDataRecords.length+'</span></button></div>'
}

function switchReportDataView(view){reportDataState.view=view;reportDataState.editing=false;navigateTo(view==='source'?'datamgmt-source':'datamgmt-card')}

function sourceBadge(text){var cls=text==='通过'?'badge-success':text==='警告'||text==='疑似重卡'?'badge-warning':text==='错误'?'badge-danger':'badge-muted';return '<span class="badge '+cls+'">'+text+'</span>'}
function reportCardTypeBadge(record,card){if(record&&record.duplicate==='疑似重卡')return '<span class="badge badge-warning">重卡</span>';var type=card&&card.cardType?card.cardType.replace(/<[^>]+>/g,'').trim():'';if(!type)type=record&&record.sourceType==='克隆'?'克隆卡':(record&&record.linkedCards.length>1?'合并卡':'原始卡');var cls=type.indexOf('合并')>-1?'badge-success':type.indexOf('重卡')>-1||type==='克隆卡'?'badge-warning':'badge-info';return '<span class="badge '+cls+'">'+type+'</span>'}
function sourceHasChange(record){return record.original.site!==record.current.site||record.original.pathology!==record.current.pathology||record.original.icd10!==record.current.icd10}
function getSourceCardType(record){if(record.duplicate==='疑似重卡')return '重卡';var card=(window.reportCardListData||[]).find(function(item){return item.idNo===record.idNo||record.linkedCards.includes(item.id)});var type=card&&card.cardType?card.cardType.replace(/<[^>]+>/g,'').trim():'';return type||'原始卡'}
function getVisibleSourceData(){var keyword=(reportDataState.keyword||'').toLowerCase();return sourceDataRecords.filter(function(record){if(reportDataState.sourceType&&record.sourceType!==reportDataState.sourceType)return false;if(reportDataState.cardStatus==='linked'&&!record.linkedCards.length)return false;if(reportDataState.cardStatus==='unlinked'&&record.linkedCards.length)return false;if(reportDataState.cardType&&getSourceCardType(record)!==reportDataState.cardType)return false;if(keyword&&![record.id,record.batch,record.name,record.idNo,record.fileName].some(function(value){return String(value).toLowerCase().includes(keyword)}))return false;return true})}

/* First renderSourceDataManagement removed — kept the merged definitive version below */
/* var rows = getVisibleSourceData();  var linked=... (removed) */



function resetSourceFilters(){reportDataState.keyword='';reportDataState.sourceType='';reportDataState.cardStatus='';reportDataState.cardType='';renderPage('datamgmt-source')}

/* 作废源数据：从上报数据列表移除，转入「作废卡管理」。记录作废时间与操作人，便于留痕。 */
var voidedSourceRecords=[];
function voidSourceData(id){
 var record=sourceDataRecords.find(function(item){return item.id===id});
 if(!record){toast('未找到源数据','error');return}
 var card=(window.reportCardListData||[]).find(function(item){return record.linkedCards.indexOf(item.id)>-1})||{};
 var who=record.name||card.name||'-', no=record.idNo||card.idNo||'-';
 showConfirm('作废确认',
  '确定要作废源数据 '+record.id+' 吗？<br><br>'+
  '<span style="color:#475467">姓名：</span><strong>'+who+'</strong>　'+
  '<span style="color:#475467">身份证号：</span><strong>'+no+'</strong><br>'+
  '<span style="color:#475467">来源：</span>'+record.sourceType+' · '+record.org+'<br>'+
  '<span style="color:#475467">上传时间：</span>'+record.uploadTime+'<br><br>'+
  '<span style="color:#b54708">作废后该条源数据将从上报数据列表移除，并转入「作废卡管理」，可在该页查看或恢复。</span>',
  function(){
   record.voidTime=new Date().toLocaleString('zh-CN',{hour12:false});
   record.voidOperator='当前用户';
   record.voidReason='人工作废';
   voidedSourceRecords.push(record);
   sourceDataRecords=sourceDataRecords.filter(function(item){return item.id!==record.id});
   renderPage('datamgmt-source');
   toast('源数据已作废并转入作废卡管理');
  });
}

/* 从作废卡管理恢复源数据：回到上报数据列表 */
function restoreVoidSource(id){
 var record=voidedSourceRecords.find(function(item){return item.id===id});
 if(!record){toast('未找到作废源数据','error');return}
 showConfirm('恢复确认','确定要恢复源数据 '+record.id+' 吗？恢复后将重新出现在上报数据列表中。',function(){
  delete record.voidTime;delete record.voidOperator;delete record.voidReason;
  sourceDataRecords.push(record);
  voidedSourceRecords=voidedSourceRecords.filter(function(item){return item.id!==record.id});
  renderPage('collection-death');
  toast('源数据已恢复');
 });
}

/* 作废卡管理里的「修改」：跳转到报告卡登记页并预填该源数据内容 */
function editVoidSource(id){
 var record=voidedSourceRecords.find(function(item){return item.id===id});
 if(!record){toast('未找到作废源数据','error');return}
 var card=(window.reportCardListData||[]).find(function(item){return item.idNo===record.idNo})||{};
 /* 组装登记表单所需的卡片结构（字段名与 reportCardListData 一致），源数据字段优先 */
 window.editCardId=record.id;
 window.editCardData={
  id:record.id,name:record.name,idNo:record.idNo,
  sex:card.sex||'-',birth:card.birth||'',phone:card.phone||'',
  nation:card.nation||'-',marriage:card.marriage||'-',job:card.job||'-',workUnit:card.workUnit||'-',
  household:card.household||'-',residence:card.residence||'-',
  site:record.current.site,pathology:record.current.pathology,icd10:record.current.icd10,
  diagnosisDate:card.diagnosisDate||'',reportUnit:record.org||card.reportUnit||'-',
  reportDate:record.uploadTime?record.uploadTime.slice(0,10):'',
  cardType:card.cardType||'',checkStatus:card.checkStatus||''
 };
 window.editCardErrors=[];
 navigateTo('collection-entry');
 toast('已载入源数据 '+record.id+'，请核对后提交');
}

var voidCardListData=null;
function getVoidCardListData(){if(voidCardListData)return voidCardListData;var cards=(window.reportCardListData||[]).slice(0,2);if(!cards.length)cards=[{id:'JX-2026-000091',name:'张伟',idNo:'360102196503121234',sex:'男',birth:'1965-03-12',site:'肺',icd10:'C34.9',diagnosisDate:'2026-03-15',reportUnit:'江西省肿瘤医院',checkStatus:'<span class="badge badge-warning">警告</span>',cardType:'<span class="badge badge-info">原始卡</span>'},{id:'JX-2026-000102',name:'李娜',idNo:'360103197808152345',sex:'女',birth:'1978-08-15',site:'乳房',icd10:'C50.9',diagnosisDate:'2026-02-20',reportUnit:'南昌大学第一附属医院',checkStatus:'<span class="badge badge-success">通过</span>',cardType:'<span class="badge badge-info">原始卡</span>'}];cards.forEach(function(card){card.auditStatus=card.cardType||'<span class="badge badge-info">原始卡</span>'});voidCardListData=cards;return voidCardListData}
function deleteVoidCard(id){showConfirm('确认删除','确定要彻底删除报告卡 '+id+' 吗？删除后无法恢复。',function(){voidCardListData=getVoidCardListData().filter(function(card){return card.id!==id});renderPage('collection-death');toast('报告卡已删除')})}
function restoreVoidCard(id){voidCardListData=getVoidCardListData().filter(function(card){return card.id!==id});renderPage('collection-death');toast('报告卡已恢复')}
function renderVoidCardManagement(){var cards=getVoidCardListData();var cols=['报告卡编号','姓名','身份证号码','性别','年龄','出生日期','发病部位','ICD10','确诊日期','最后接触状态','最后接触时间','报告单位','来源类型','上传日期'];var rows=cards.map(function(card){var age=card.birth?Math.floor((new Date()-new Date(card.birth))/(365.25*24*3600*1000)):'-';var follow=(window.reportCardFollowup||{})[card.id]||{};var source=sourceDataRecords.find(function(record){return record.linkedCards.includes(card.id)});return '<tr><td class="txt"><a href="javascript:void(0)" style="color:var(--primary)" onclick="cardListDetail(\''+card.id+'\')">'+card.id+'</a></td><td class="txt">'+card.name+'</td><td class="txt">'+card.idNo+'</td><td class="txt">'+card.sex+'</td><td class="code">'+age+'</td><td class="ops">'+card.birth+'</td><td>'+card.site+'</td><td>'+(card.icd10||'-')+'</td><td>'+card.diagnosisDate+'</td><td>'+(follow.state||'-')+'</td><td>'+(follow.dlc||'-')+'</td><td>'+card.reportUnit+'</td><td>'+(source?source.sourceType:'手工登记')+'</td><td>'+(source?source.uploadTime.slice(0,10):'-')+'</td><td class="sticky-col"><button class="btn btn-danger btn-xs" onclick="deleteVoidCard(\''+card.id+'\')">删除</button> <button class="btn btn-primary btn-xs" onclick="restoreVoidCard(\''+card.id+'\')">恢复</button></td></tr>'}).join('');return '<div class="page-toolbar"><div class="toolbar-actions"><button class="btn btn-primary btn-sm" onclick="cardListAdd()">+ 添加</button><button class="btn btn-import btn-sm" onclick="navigateTo(\'collection-batch\');setTimeout(function(){openBatchImportDialog()},100)">批量添加</button><button class="btn btn-outline btn-sm" onclick="toast(\'导出Excel中...\')">导出Excel</button></div></div><div class="panel"><div class="panel-body"><div class="filter-toolbar"><div class="form-group region-filter" style="min-width:200px"><label>行政区划</label>'+renderRegionCascader()+'</div><div class="form-group"><label>报告卡类型</label><select><option value="">全部</option><option>原始卡</option><option>补报卡</option><option>合并卡</option><option>克隆卡</option><option>多原发卡</option></select></div><div class="form-group"><label>校验状态</label><select><option value="">全部</option><option>已关联</option><option>未关联</option></select></div><div class="form-group"><label>日期类型</label><select><option>报告日期</option><option>登记日期</option><option>确诊日期</option></select></div><div class="form-group date-group"><label>日期区间</label>'+renderDateRangePicker('dr_void','','')+'</div><div class="form-group search-group"><label>检索内容</label><input type="text" placeholder="报告卡编号 / 姓名 / 身份证号"></div><div class="filter-actions"><button class="btn btn-ghost btn-sm" onclick="renderPage(\'collection-death\')">重置</button></div></div><div style="margin-bottom:8px;color:#667085;font-size:13px">共 '+cards.length+' 张报告卡</div><div style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;margin-bottom:12px"><div class="table-wrap"><table class="data-table" style="margin:0;min-width:1780px"><thead><tr>'+cols.map(function(col){return '<th>'+col+'</th>'}).join('')+'<th class="sticky-col">操作</th></tr></thead><tbody>'+(rows||'<tr><td colspan="15" style="text-align:center;padding:36px;color:#98a2b3">暂无作废报告卡</td></tr>')+'</tbody></table></div></div><div class="void-pagination"><div class="void-pagination-info">共'+cards.length+'条记录，第1/1页</div><div class="void-pagination-controls"><button onclick="toast(\'已是第一页\')">‹</button><input type="text" value="1" readonly><button onclick="toast(\'已是最后一页\')">›</button></div></div></div></div>'}

var baseVoidCardManagement=renderVoidCardManagement;
/* 在「作废卡管理」页追加「作废源数据」面板：来源为上报数据管理中作废的记录。
   每行提供「修改」（跳登记页预填）与「恢复」（退回上报数据列表）。 */
function renderVoidSourcePanel(){
 if(!voidedSourceRecords.length)return '';
 var rows=voidedSourceRecords.map(function(record){
  return '<tr>'+
   '<td class="txt">'+record.id+'</td>'+
   '<td class="txt">'+record.name+'</td>'+
   '<td class="txt">'+record.idNo+'</td>'+
   '<td class="txt">'+record.current.site+'</td>'+
   '<td class="txt">'+(record.current.icd10||'-')+'</td>'+
   '<td class="txt">'+record.org+'</td>'+
   '<td class="code">'+record.sourceType+'</td>'+
   '<td class="code">'+record.uploadTime.slice(0,10)+'</td>'+
   '<td class="code">'+(record.voidTime||'-')+'</td>'+
   '<td class="ops sticky-col">'+
     '<button class="btn btn-primary btn-xs" onclick="editVoidSource(\''+record.id+'\')">修改</button> '+
     '<button class="btn btn-ghost btn-xs" onclick="restoreVoidSource(\''+record.id+'\')">恢复</button>'+
   '</td>'+
  '</tr>'}).join('');
 return '<div class="panel" style="margin-top:16px"><div class="panel-header">作废源数据（来自上报数据管理）</div><div class="panel-body">'+
  '<div style="margin-bottom:8px;color:#667085;font-size:13px">共 '+voidedSourceRecords.length+' 条。点击「修改」跳转到报告卡登记页并预填内容，提交后可重新登记。</div>'+
  '<div class="table-wrap"><table class="data-table" style="min-width:1200px"><thead><tr>'+
  '<th class="txt">源数据编号</th><th class="txt">姓名</th><th class="txt">身份证号</th><th class="txt">发病部位</th><th class="txt">ICD10</th>'+
  '<th class="txt">来源机构</th><th class="code">来源类型</th><th class="code">上传日期</th><th class="code">作废时间</th><th class="ops sticky-col">操作</th>'+
  '</tr></thead><tbody>'+rows+'</tbody></table></div></div></div>';
}
renderVoidCardManagement=function(){
 return baseVoidCardManagement()
  .replace(/<button[^>]*>\+ 添加<\/button><button[^>]*>批量添加<\/button>/,'')
  +renderVoidSourcePanel();
};

// Keep the source list interaction model identical to the report card list; only the primary identifier differs.
// 报告卡列表数据原先只在渲染报告卡列表时才生成：直接从侧边栏进「上报数据管理」时它是空的，
// 列表与详情的性别/年龄/确诊日期等字段会整排显示「-」。这里按需补生成一次，
// 走未被包装的 baseRenderReportCardList，避免 source-detail 状态下递归回本函数。
function ensureReportCardListData(){if(window.reportCardListData&&window.reportCardListData.length)return window.reportCardListData;try{if(typeof baseRenderReportCardList==='function')baseRenderReportCardList()}catch(error){}return window.reportCardListData||[]}

function renderSourceDataManagement(){
ensureReportCardListData();
var rows=getVisibleSourceData();
var tableRows=rows.map(function(record){var card=(window.reportCardListData||[]).find(function(item){return item.idNo===record.idNo||record.linkedCards.includes(item.id)})||{};var age=card.birth?Math.floor((new Date()-new Date(card.birth))/(365.25*24*3600*1000)):'-';var follow=(window.reportCardFollowup||{})[card.id]||{};var linkedCardId=record.linkedCards.length?record.linkedCards[0]:'';var editAction=linkedCardId?'cardListEdit(\''+linkedCardId+'\')':'toast(\'请先生成报告卡后再编辑\',\'error\')';var viewBtn='<button class="btn btn-ghost btn-xs" onclick="openSourceDataDetail(\''+record.id+'\')">查看</button> ';var editBtn='<button class="btn btn-primary btn-xs" onclick="'+editAction+'">编辑</button> ';var voidBtn='<button class="btn btn-danger btn-xs" onclick="voidSourceData(\''+record.id+'\')">作废</button>';var sourceActions='<td class="sticky-col">'+(linkedCardId?editBtn+voidBtn:'<span class="badge badge-muted">不可编辑</span>'+voidBtn)+'</td>';return '<tr><td><a href="javascript:void(0)" style="color:var(--primary)" onclick="openSourceDataDetail(\''+record.id+'\')">'+record.id+'</a></td><td>'+sourceBadge(record.validation)+'</td><td>'+record.name+'</td><td>'+record.idNo+'</td><td>'+(card.sex||'-')+'</td><td>'+age+'</td><td>'+(card.birth||'-')+'</td><td>'+record.current.site+'</td><td>'+(record.current.icd10||'-')+'</td><td>'+(card.diagnosisDate||'-')+'</td><td>'+(follow.state||'-')+'</td><td>'+(follow.dlc||'-')+'</td><td>'+record.org+'</td><td>'+record.sourceType+'</td><td>'+record.uploadTime.slice(0,10)+'</td>'+sourceActions+'</tr>'}).join('');
/* 「+ 添加」「批量添加」入口已下线：上报数据只能经「批量登记」页面导入（collection-batch）。
   顶部工具条随之整体移除，页面直接从筛选面板开始；导出Excel 仍保留在筛选区操作按钮里。 */
return '<div class="panel"><div class="panel-body"><div class="filter-toolbar"><div class="form-group region-filter" style="min-width:200px"><label>行政区划</label>'+renderRegionCascader()+'</div><div class="form-group"><label>校验状态</label><select onchange="reportDataState.cardStatus=this.value;renderPage(\'datamgmt-source\')"><option value="">全部状态</option><option value="linked" '+(reportDataState.cardStatus==='linked'?'selected':'')+'>已关联报告卡</option><option value="unlinked" '+(reportDataState.cardStatus==='unlinked'?'selected':'')+'>未关联报告卡</option></select></div><div class="form-group"><label>日期类型</label><select><option>上传日期</option><option>确诊日期</option></select></div><div class="form-group date-group"><label>日期区间</label>'+renderDateRangePicker('dr_source','','')+'</div><div class="form-group search-group"><label>检索内容</label><input type="text" placeholder="源数据编号 / 姓名 / 身份证号" value="'+reportDataState.keyword+'" oninput="reportDataState.keyword=this.value;renderPage(\'datamgmt-source\')"></div><div class="filter-actions"><button class="btn btn-ghost btn-sm" onclick="resetSourceFilters()">重置</button><button class="btn btn-outline btn-sm" onclick="toast(\'导出Excel中...\')">导出Excel</button></div></div><div style="margin-bottom:8px;color:#667085;font-size:13px">共 '+rows.length+' 条源数据</div><div class="table-wrap"><table class="data-table" style="margin:0;min-width:1900px"><thead><tr><th class="txt">编号</th><th class="code">校验状态</th><th class="txt">姓名</th><th class="txt">身份证号码</th><th class="code">性别</th><th class="num">年龄</th><th class="code">出生日期</th><th class="txt">发病部位</th><th class="txt">ICD10</th><th class="code">确诊日期</th><th class="code">最后接触状态</th><th class="code">最后接触时间</th><th class="txt">报告单位</th><th class="txt">来源类型</th><th class="code">上传日期</th><th class="sticky-col">操作</th></tr></thead><tbody>'+(tableRows||'<tr><td colspan="16" style="text-align:center;padding:36px;color:#98a2b3">当前筛选条件下没有源数据</td></tr>')+'</tbody></table></div></div></div>'
}

function openSourceDataDetail(id){reportDataState.view='source-detail';reportDataState.selectedSourceId=id;reportDataState.editing=false;renderPage('datamgmt-source');setActiveMenu('datamgmt-source');updateBreadcrumb('datamgmt-source','上报数据详情');window.scrollTo(0,0)}
function startSourceRevision(id){reportDataState.view='source-detail';reportDataState.selectedSourceId=id;reportDataState.editing=true;renderPage('datamgmt-source');setActiveMenu('datamgmt-source');updateBreadcrumb('datamgmt-source','修订上报数据');window.scrollTo(0,0)}

function sourceSubsite(site){if(site==='肺')return '上叶';if(site==='胃')return '胃窦';if(site==='肝')return '右叶';if(site==='乳房'||site==='乳腺')return '左乳';return '-'}
function sourceTopoCode(site,icd10){if(site==='肺')return 'C34.9';if(site==='胃')return 'C16.9';if(site==='肝')return 'C22.0';if(site==='乳房'||site==='乳腺')return 'C50.9';return icd10||'-'}
function sourceMorphCode(pathology){var map={'鳞状细胞癌':'8070/3','腺癌':'8140/3','小细胞癌':'8041/3','浸润性导管癌':'8500/3','导管癌':'8500/3','肝细胞癌':'8170/3','乳头状癌':'8260/3'};return map[pathology]||'8000/3'}

// ============================================================================
// 上报数据详情版式（scoped：全部 src-* 前缀，不动 card-detail-*，
// 因为那套类名同时被报告卡详情 cardListDetail 与患者档案复用，改了会连带动到别的页面）。
//
// 这一版解决的问题：
//   1. 顶部 kicker 的「姓名 · 编号」与下面摘要条的姓名、编号完全重复，白占一行；
//   2. 同一页两套字段语言——基本信息是「标签左对齐 112px」，肿瘤报告信息是「标签在上」，视觉不统一；
//   3. 源数据本身字段缺失多，页面用裸「-」平铺，用户看不出「哪些缺、缺多少、该做什么」；
//   4. 随访信息尚无真实数据，却铺了 8 行「-」占位；
//   5. 左导航无序号无计数，激活态只有一层浅底色。
//
// 改法：顶部只留标题与操作，姓名/编号收进「患者概要条」并配校验、查重、版本、完整度四项指标；
// 全部字段统一成 4 列「标签在上、值在下」卡片，空值显示「未填写」；缺失与校验异常从噪音改成可操作提示条；
// 随访信息换成空状态；导航加序号与计数。
// ============================================================================
var sourceDetailStyles=document.createElement('style');
sourceDetailStyles.textContent='.src-detail{min-height:calc(100vh - 132px)}.src-detail-topbar{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:14px}.src-detail-topbar-main{min-width:0}.src-detail-title{font-size:16px;font-weight:700;color:#16283c;letter-spacing:.2px}.src-detail-topbar-meta{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-top:7px;font-size:12px;color:#7d8fa1}.src-chip{display:inline-flex;align-items:center;height:21px;padding:0 8px;border-radius:4px;background:#eef4f8;color:#476079;font-weight:600}.src-chip.accent{background:#e6f2f3;color:#0a6d7d}.src-detail-actions{display:flex;gap:8px;align-items:center;flex:0 0 auto}.src-detail-workspace{display:grid;grid-template-columns:188px minmax(0,1fr);gap:14px;align-items:start}.src-nav{position:sticky;top:16px;min-width:0;background:#fff;border:1px solid var(--border);border-radius:10px;box-shadow:var(--shadow-xs);padding:8px}.src-nav-item{position:relative;display:flex;align-items:center;gap:9px;width:100%;border:0;background:transparent;border-radius:7px;padding:9px 10px;color:#4b647d;text-align:left;font-size:13px;cursor:pointer;transition:background .15s ease,color .15s ease}.src-nav-item:hover{background:#f2f7fa;color:#0b7180}.src-nav-item.active{background:#e9f4f6;color:#0a6d7d;font-weight:700}.src-nav-item.active:before{content:"";position:absolute;left:0;top:50%;width:3px;height:16px;margin-top:-8px;border-radius:0 2px 2px 0;background:#0b7180}.src-nav-idx{flex:0 0 auto;width:19px;height:19px;border-radius:5px;background:#eef3f6;color:#8496a7;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center}.src-nav-item.active .src-nav-idx{background:#0b7180;color:#fff}.src-nav-label{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.src-nav-count{flex:0 0 auto;font-size:11px;font-weight:600;color:#8496a7;background:#f0f4f7;border-radius:9px;padding:1px 6px}.src-nav-item.active .src-nav-count{background:#fff;color:#0a6d7d}.src-main{min-width:0;display:flex;flex-direction:column;gap:14px}.src-hero{display:flex;align-items:center;justify-content:space-between;gap:22px;flex-wrap:wrap;padding:17px 20px;background:#fff;border:1px solid var(--border);border-radius:10px;box-shadow:var(--shadow-xs)}.src-hero-person{display:flex;align-items:center;gap:13px;min-width:0}.src-hero-avatar{flex:0 0 auto;width:46px;height:46px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:19px;font-weight:700;color:#fff;background:linear-gradient(135deg,#4a86ad,#2b5f86);letter-spacing:1px}.src-hero-name{display:flex;align-items:baseline;flex-wrap:wrap;gap:10px;font-size:20px;font-weight:700;color:#16283c;line-height:1.25}.src-hero-name em{font-style:normal;font-size:13px;font-weight:500;color:#6b7f92}.src-hero-code{margin-top:7px;font-size:12px;color:#5b6f82;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.3px}.src-hero-code b{color:#2b4a63;font-weight:600}.src-hero-metrics{display:flex;align-items:stretch;border:1px solid var(--border);border-radius:8px;overflow:hidden;background:#fbfdfe}.src-metric{min-width:96px;padding:9px 15px;border-right:1px solid var(--border)}.src-metric:last-child{border-right:0}.src-metric .k{display:block;font-size:11px;color:#8496a7;margin-bottom:5px}.src-metric .v{display:block;font-size:13px;font-weight:700;color:#22384f;line-height:1.3}.src-meter{width:100%;height:4px;margin-top:7px;border-radius:2px;background:#e4ecf1;overflow:hidden}.src-meter i{display:block;height:100%;border-radius:2px;background:linear-gradient(90deg,#4a93ad,#2f6f8f)}.src-meter.warn i{background:linear-gradient(90deg,#e09a63,#c9703c)}.src-alert{display:flex;align-items:flex-start;gap:10px;padding:11px 15px;border:1px solid;border-radius:8px;font-size:13px;line-height:1.65}.src-alert-error{background:#fdf4f3;border-color:#f3d6d2;color:#9f4433}.src-alert-warn{background:#fff8ec;border-color:#f3e1bf;color:#8a6118}.src-alert-info{background:#eef5fb;border-color:#d8e6f4;color:#2f5b7f}.src-alert-icon{flex:0 0 auto;width:18px;height:18px;margin-top:2px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700}.src-alert-error .src-alert-icon{background:#b3492f;color:#fff}.src-alert-warn .src-alert-icon{background:#a9761d;color:#fff}.src-alert-info .src-alert-icon{background:#3a6c94;color:#fff}.src-alert b{font-weight:700}.src-alert-actions{margin-left:auto;padding-left:14px;flex:0 0 auto;align-self:center}.src-section{background:#fff;border:1px solid var(--border);border-radius:10px;box-shadow:var(--shadow-xs);scroll-margin-top:18px;overflow:hidden}.src-section-head{display:flex;align-items:center;flex-wrap:wrap;gap:10px;padding:13px 20px;border-bottom:1px solid #eef2f5;background:#fbfdfe}.src-section-title{position:relative;padding-left:11px;font-size:15px;font-weight:700;color:#16283c}.src-section-title:before{content:"";position:absolute;left:0;top:50%;width:3px;height:15px;margin-top:-7px;border-radius:2px;background:var(--primary)}.src-section-note{font-size:12px;color:#8496a7}.src-section-body{padding:2px 20px 18px}.src-group+.src-group{margin-top:2px}.src-group-title{padding:15px 0 0;font-size:12px;font-weight:600;letter-spacing:.5px;color:#93a3b2}.src-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))}.src-field{min-width:0;padding:11px 14px 11px 0;border-bottom:1px solid #f0f4f7}.src-field:nth-child(4n){padding-right:0}.src-field.span2{grid-column:span 2}.src-field.span4{grid-column:span 4}.src-field .k{display:block;font-size:12px;line-height:1.4;color:#8496a7;margin-bottom:5px}.src-field .v{display:block;font-size:13px;font-weight:600;line-height:1.55;color:#22384f;word-break:break-word}.src-field.code .v{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.2px;font-weight:600}.src-field.empty .v{color:#a4b3bf;font-weight:400}.src-field.empty .k{color:#9dabb8}.src-group:last-child .src-field:last-child{border-bottom:0}.src-empty{display:flex;flex-direction:column;align-items:center;gap:9px;padding:32px 20px;text-align:center}.src-empty-icon{width:46px;height:46px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#f1f6f9;color:#a3b8c7;font-size:18px;font-weight:700}.src-empty-title{font-size:13px;font-weight:700;color:#40586d}.src-empty-desc{max-width:420px;font-size:12px;line-height:1.7;color:#8c9dac}.src-revision-form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:16px 20px}.src-revision-form label{display:block;font-size:12px;color:#7d8fa1;margin-bottom:5px}.src-revision-form input,.src-revision-form textarea{width:100%;box-sizing:border-box}.src-revision-reason{grid-column:1/-1}@media(max-width:1240px){.src-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.src-field:nth-child(4n){padding-right:14px}.src-field.span2{grid-column:span 2}}@media(max-width:860px){.src-detail-workspace{grid-template-columns:1fr}.src-nav{position:static;display:flex;gap:6px;overflow-x:auto}.src-nav-item{width:auto;flex:0 0 auto}.src-nav-item.active:before{display:none}.src-field.span2,.src-field.span4{grid-column:auto}.src-hero-metrics{width:100%;flex-wrap:wrap}}@media(max-width:760px){.src-detail-topbar{display:block}.src-detail-actions{margin-top:12px}.src-grid{grid-template-columns:1fr}.src-field{padding-right:0}.src-revision-form{grid-template-columns:1fr}}';
document.head.appendChild(sourceDetailStyles);

// 字段渲染：空值不再显示裸横杠，而是「未填写」+ 弱化配色，避免与真实值混为一谈。
function srcIsEmpty(value){return value==null||value===''||value==='-'}
function srcField(label,value,opts){opts=opts||{};var empty=srcIsEmpty(value);var cls='src-field'+(empty?' empty':'')+(opts.wide===4?' span4':opts.wide?' span2':'')+(opts.code?' code':'');return '<div class="'+cls+'"><span class="k">'+cardDetailEscape(label)+'</span><span class="v">'+(empty?'未填写':cardDetailEscape(value))+'</span></div>'}
function srcGroup(title,fields){return '<div class="src-group">'+(title?'<div class="src-group-title">'+cardDetailEscape(title)+'</div>':'')+'<div class="src-grid">'+fields.map(function(field){return srcField(field[0],field[1],field[2])}).join('')+'</div></div>'}
function srcNavItem(id,label,index,count,active){return '<button type="button" class="src-nav-item'+(active?' active':'')+'" data-section="'+id+'" onclick="srcScrollSection(\''+id+'\')"><span class="src-nav-idx">'+index+'</span><span class="src-nav-label">'+cardDetailEscape(label)+'</span>'+(count?'<span class="src-nav-count">'+count+'</span>':'')+'</button>'}
function srcScrollSection(id){var target=document.getElementById(id);if(target)target.scrollIntoView({behavior:'smooth',block:'start'});document.querySelectorAll('.src-nav-item').forEach(function(button){button.classList.toggle('active',button.dataset.section===id)})}

// 上报数据详情：患者概要条 + 质量提示 + 三个信息段（基本信息 / 肿瘤报告信息 / 随访信息）+ 修订表单。
// 与报告卡详情的区别：不出现任何报告卡管理内容（关联报告卡 / 生成报告卡 / 编辑报告卡），
// 也不展示来源与版本明细（上传批次、文件行号等）——这些只留在列表页与顶部摘要。
// 随访信息当前没有真实关联数据，整段渲染为空状态，不再铺一屏「-」。
function renderSourceDataDetail(){
var record=sourceDataRecords.find(function(item){return item.id===reportDataState.selectedSourceId});if(!record)return '<div class="empty-state">未找到上报数据</div>';
ensureReportCardListData();
var detailCard=(window.reportCardListData||[]).find(function(item){return item.idNo===record.idNo||record.linkedCards.includes(item.id)})||{};
var age=detailCard.birth?Math.floor((new Date()-new Date(detailCard.birth))/(365.25*24*3600*1000))+'岁':'';
var icd=srcIsEmpty(record.current.icd10)?'':record.current.icd10;
var site=record.current.site||'-';

// 基本信息：姓名与源数据编号已上移到概要条，这里不再重复，避免同一信息出现两次。
// 每组列宽之和都收在 4 的整数倍上，保证没有「只占半行的末行」那种残缺横线。
var basicGroups=[
['人口学特征',[['性别',detailCard.sex],['出生日期',detailCard.birth,{code:1}],['年龄',age],['民族',detailCard.nation]]],
['社会与职业',[['婚姻状况',detailCard.marriage],['职业',detailCard.job],['工作单位',detailCard.workUnit,{wide:2}]]],
['联系方式与地址',[['联系电话',detailCard.phone,{wide:2}],['户籍地址',detailCard.household,{wide:2}],['常住地址',detailCard.residence,{wide:4}]]]
];
// 肿瘤报告信息：按语义分四组，每组都排满整行，避免出现半空的末行。
var tumorGroups=[
['部位与病理',[['发病部位（大类）',record.current.site],['亚部位',sourceSubsite(record.current.site)],['病理类型',record.current.pathology],['行为','/3 恶性']]],
['ICD-O-3 编码',[['肿瘤解剖学部位代码',sourceTopoCode(record.current.site,record.current.icd10),{wide:2,code:1}],['肿瘤形态学代码',sourceMorphCode(record.current.pathology),{wide:2,code:1}]]],
['诊断结论',[['确诊日期',detailCard.diagnosisDate,{code:1}],['ICD10 编码',icd,{code:1}],['诊断结果',site+'恶性肿瘤'+(icd?'（'+icd+'）':''),{wide:2}],['详细诊断结果',site+'部 '+(record.current.pathology||'-'),{wide:4}]]],
['上报信息',[['上报单位',record.org,{wide:2}],['上传时间',record.uploadTime,{wide:2,code:1}]]]
];
var basicCount=basicGroups.reduce(function(sum,group){return sum+group[1].length},0);
var tumorCount=tumorGroups.reduce(function(sum,group){return sum+group[1].length},0);
var allFields=basicGroups.concat(tumorGroups).reduce(function(list,group){return list.concat(group[1])},[]);
var missing=allFields.filter(function(field){return srcIsEmpty(field[1])}).length;
var percent=Math.round((allFields.length-missing)/allFields.length*100);

// 提示条：把「校验异常」和「字段缺失」从页面噪音变成可操作的信息。
var alerts='';
if(record.validation==='错误')alerts+='<div class="src-alert src-alert-error"><span class="src-alert-icon">!</span><div><b>入库校验未通过</b>　该条上报数据质检结果为「错误」，请核对来源文件《'+cardDetailEscape(record.fileName)+'》第 '+record.rowNo+' 行后发起修订，上传原值将永久保留。</div>'+(reportDataState.editing?'':'<div class="src-alert-actions"><button class="btn btn-danger btn-sm" onclick="startSourceRevision(\''+record.id+'\')">去修订</button></div>')+'</div>';
else if(record.validation==='警告')alerts+='<div class="src-alert src-alert-warn"><span class="src-alert-icon">!</span><div><b>入库校验存在警告</b>　生成报告卡前建议先核对来源文件《'+cardDetailEscape(record.fileName)+'》第 '+record.rowNo+' 行。</div>'+(reportDataState.editing?'':'<div class="src-alert-actions"><button class="btn btn-outline btn-sm" onclick="startSourceRevision(\''+record.id+'\')">去核对</button></div>')+'</div>';
if(record.duplicate&&record.duplicate!=='无重卡')alerts+='<div class="src-alert src-alert-warn"><span class="src-alert-icon">!</span><div><b>查重提示</b>　该患者存在'+cardDetailEscape(record.duplicate)+'情况，生成报告卡前请确认是否为同一患者。</div></div>';
if(missing&&!reportDataState.editing)alerts+='<div class="src-alert src-alert-info"><span class="src-alert-icon">i</span><div><b>'+missing+' 项字段未回填</b>　当前完整度 '+percent+'%，缺失字段已在下方以浅色标出。</div><div class="src-alert-actions"><button class="btn btn-outline btn-sm" onclick="srcScrollSection(\'source-basic\')">定位缺失项</button></div></div>';

var revisionForm=reportDataState.editing?'<section class="src-section" id="source-revision"><div class="src-section-head"><div class="src-section-title">新建修订版本</div><div class="src-section-note">保存后生成新版本，上传原值不变</div></div><div class="src-revision-form"><div><label>发病部位</label><input id="sourceEditSite" value="'+cardDetailEscape(record.current.site)+'"></div><div><label>病理类型</label><input id="sourceEditPathology" value="'+cardDetailEscape(record.current.pathology)+'"></div><div><label>ICD10</label><input id="sourceEditIcd10" value="'+cardDetailEscape(record.current.icd10)+'"></div><div class="src-revision-reason"><label>修订原因（必填）</label><textarea id="sourceEditReason" rows="3" placeholder="说明修订依据，原始上传值将永久保留"></textarea></div></div></section>':'';

var actions='<button class="btn btn-ghost btn-sm" onclick="switchReportDataView(\'source\')">返回上报数据列表</button>'+(reportDataState.editing?'<button class="btn btn-ghost btn-sm" onclick="reportDataState.editing=false;renderPage(\'datamgmt-source\')">取消修订</button><button class="btn btn-primary btn-sm" onclick="saveSourceRevision()">保存为新版本</button>':'<button class="btn btn-primary btn-sm" onclick="startSourceRevision(\''+record.id+'\')">修订源数据</button>');
var navItems=[['source-basic','基本信息',basicCount],['source-tumor','肿瘤报告信息',tumorCount],['source-follow','随访信息',0]];
if(reportDataState.editing)navItems.push(['source-revision','新建修订版本',0]);
var nav='<nav class="src-nav" aria-label="上报数据详情导航">'+navItems.map(function(item,index){return srcNavItem(item[0],item[1],index+1,item[2],index===0)}).join('')+'</nav>';
var hero='<section class="src-hero"><div class="src-hero-person"><div class="src-hero-avatar">'+cardDetailEscape((record.name||'?').slice(0,1))+'</div><div><div class="src-hero-name">'+cardDetailEscape(record.name)+((age||detailCard.sex)?'<em>'+cardDetailEscape([detailCard.sex,age].filter(Boolean).join(' · '))+'</em>':'')+'</div><div class="src-hero-code"><b>'+cardDetailEscape(record.id)+'</b>　身份证 '+cardDetailEscape(record.idNo)+'</div></div></div><div class="src-hero-metrics"><div class="src-metric"><span class="k">校验状态</span><span class="v">'+sourceBadge(record.validation)+'</span></div><div class="src-metric"><span class="k">查重结果</span><span class="v">'+sourceBadge(record.duplicate)+'</span></div><div class="src-metric"><span class="k">当前版本</span><span class="v">V'+record.version+(sourceHasChange(record)?'（已修订）':'')+'</span></div><div class="src-metric"><span class="k">字段完整度</span><span class="v">'+percent+'%</span><div class="src-meter'+(percent<60?' warn':'')+'"><i style="width:'+percent+'%"></i></div></div></div></section>';
var main='<main class="src-main" id="card-detail-main">'+hero+(alerts?'<div style="display:flex;flex-direction:column;gap:10px">'+alerts+'</div>':'')+
'<section class="src-section" id="source-basic"><div class="src-section-head"><div class="src-section-title">基本信息</div><div class="src-section-note">姓名与源数据编号见上方概要条</div></div><div class="src-section-body">'+basicGroups.map(function(group){return srcGroup(group[0],group[1])}).join('')+'</div></section>'+
'<section class="src-section" id="source-tumor"><div class="src-section-head"><div class="src-section-title">肿瘤报告信息</div><div class="src-section-note">取自上报数据当前值</div></div><div class="src-section-body">'+tumorGroups.map(function(group){return srcGroup(group[0],group[1])}).join('')+'</div></section>'+
'<section class="src-section" id="source-follow"><div class="src-section-head"><div class="src-section-title">随访信息</div><div class="src-section-note">依赖随访记录关联</div></div><div class="src-empty"><div class="src-empty-icon">—</div><div class="src-empty-title">尚未关联随访记录</div><div class="src-empty-desc">该上报数据尚未与随访管理中的记录建立关联，因此暂不展示最后接触状态、生存月数与死亡相关字段；关联后此处将自动填充。</div></div></section>'+revisionForm+'</main>';
var topbar='<div class="src-detail-topbar"><div class="src-detail-topbar-main"><div class="src-detail-title">上报数据详情</div><div class="src-detail-topbar-meta"><span class="src-chip accent">'+cardDetailEscape(record.sourceType)+'</span><span class="src-chip">上传 '+cardDetailEscape(record.uploadTime)+'</span><span class="src-chip">批次 '+cardDetailEscape(record.batch)+'</span></div></div><div class="src-detail-actions">'+actions+'</div></div>';
return '<div class="src-detail">'+topbar+'<div class="src-detail-workspace">'+nav+main+'</div></div>'
}

function saveSourceRevision(){
var record=sourceDataRecords.find(function(item){return item.id===reportDataState.selectedSourceId});if(!record)return;
var next={site:document.getElementById('sourceEditSite').value.trim(),pathology:document.getElementById('sourceEditPathology').value.trim(),icd10:document.getElementById('sourceEditIcd10').value.trim()};var reason=document.getElementById('sourceEditReason').value.trim();if(!reason){toast('请填写修订原因','error');return}
var changes=[];[['发病部位','site'],['病理类型','pathology'],['ICD10','icd10']].forEach(function(field){if(record.current[field[1]]!==next[field[1]])changes.push(field[0]+'：'+record.current[field[1]]+' -> '+next[field[1]])});if(!changes.length){toast('当前没有字段变化','error');return}
record.version+=1;record.history.push({version:record.version,time:new Date().toLocaleString('zh-CN',{hour12:false}),operator:'当前用户',reason:reason,changes:changes.join('；')});record.current=next;reportDataState.editing=false;renderPage('datamgmt-source');toast('已保存为 V'+record.version+'，上传原值保持不变')
}

function openLinkedReportCard(id){reportDataState.view='cards';renderPage('datamgmt-card');setActiveMenu('datamgmt-card');cardListDetail(id)}

function linkReportCardToSource(cardId){
var card=(window.reportCardListData||[]).find(function(item){return item.id===cardId});if(!card)return;
var candidates=sourceDataRecords.filter(function(record){return record.idNo===card.idNo&&!record.linkedCards.length});
if(!candidates.length){navigateTo('datamgmt-source');toast('未找到可关联的源数据','error');return}
candidates[0].linkedCards=[cardId];renderPage('datamgmt-card');toast('已关联源数据 '+candidates[0].id);
}

function generateReportCardFromSource(id){
var record=sourceDataRecords.find(function(item){return item.id===id});if(!record)return;
var cards=window.reportCardListData||[];var existing=cards.find(function(card){return card.idNo===record.idNo});
if(existing){record.linkedCards=[existing.id];renderPage('datamgmt-source');toast('已关联既有报告卡 '+existing.id);return}
var serial=Math.max.apply(null,cards.map(function(card){return Number((card.id.match(/(\d+)$/)||['',0])[1])||0}).concat([0]))+1;var cardId='JX-2026-'+String(serial).padStart(6,'0');
cards.push({id:cardId,name:record.name,sex:'不详',birth:'',idNo:record.idNo,phone:'-',job:'-',nation:'-',marriage:'-',workUnit:'-',household:'-',residence:'-',site:record.current.site,pathology:record.current.pathology,icd10:record.current.icd10,diagnosisDate:'-',outpatientNo:'-',inpatientNo:'-',reportDate:record.uploadTime.slice(0,10),doctor:'-',reportUnit:record.org,region:'-',cardType:'<span class="badge badge-info">原始卡</span>',checkStatus:sourceBadge(record.validation),auditStatus:'<span class="badge badge-muted">未核对</span>',errors:[]});
record.linkedCards=[cardId];renderPage('datamgmt-source');toast('已由源数据生成报告卡 '+cardId);
}

var baseCardListDetail=cardListDetail;
cardListDetail=function(id){
baseCardListDetail(id);
var linked=sourceDataRecords.filter(function(record){return record.linkedCards.includes(id)});var container=document.getElementById('pageContainer');if(!container||!linked.length)return;
var rows=linked.map(function(record){return '<tr><td class="txt"><a href="javascript:void(0)" onclick="openSourceDataDetail(\''+record.id+'\')">'+record.id+'</a></td><td class="txt">'+record.sourceType+'</td><td class="txt">'+record.batch+'</td><td class="txt">'+record.fileName+' / 第'+record.rowNo+'行</td><td class="code">V'+record.version+(sourceHasChange(record)?'（已修订）':'')+'</td><td class="ops"><button class="btn btn-ghost btn-xs" onclick="openSourceDataDetail(\''+record.id+'\')">查看源数据</button></td></tr>'}).join('');
container.insertAdjacentHTML('beforeend','<div class="panel" style="margin-top:16px"><div class="panel-header">数据来源 <span style="font-size:12px;color:#667085;font-weight:400;margin-left:8px">报告卡可关联一条或多条源数据</span></div><div class="panel-body"><div class="table-wrap"><table class="data-table" style="min-width:672px"><thead><tr><th class="txt">源数据编号</th><th class="txt">来源</th><th class="txt">上传批次</th><th class="txt">来源文件/行号</th><th class="code">采用版本</th><th class="ops">操作</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></div>')
};

var baseBiParseFile=biParseFile;
biParseFile=function(){
var before=hisRecords.map(function(row){return row.id});baseBiParseFile();var added=hisRecords.filter(function(row){return !before.includes(row.id)});added.forEach(function(row,index){sourceDataRecords.push({id:'SRC-'+String(row.id),batch:'BAT-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-01',sourceType:'批量导入',fileName:row.fileName||biState.fileName,rowNo:row.rowNo||index+1,uploadTime:row.uploadTime,org:row.reportUnit,name:row.name,idNo:row.idNo,original:{site:row.site,pathology:row.pathology,icd10:row.icd10||'-'},current:{site:row.site,pathology:row.pathology,icd10:row.icd10||'-'},validation:row.validation,duplicate:row.duplicate,linkedCards:[],version:1,history:[]})});reportDataState.view='source';renderPage('datamgmt-source');updateBreadcrumb('datamgmt-source','上报数据管理')
};

var reportCardNotes={};
var cardDetailLayoutStyles=document.createElement('style');
cardDetailLayoutStyles.textContent='.card-detail-page{background:#f4f7f9;min-height:calc(100vh - 130px)}.card-detail-topbar{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:12px}.card-detail-kicker{font-size:13px;color:#66809b}.card-detail-title{font-size:15px;line-height:1.3;color:#5b7186;font-weight:600}.card-detail-actions{display:flex;gap:8px;align-items:center}.card-detail-workspace{display:grid;grid-template-columns:174px minmax(0,1fr);gap:16px;align-items:start}.card-detail-nav,.card-detail-main{background:#fff;border:1px solid #dbe4ea;border-radius:6px;box-shadow:0 1px 3px rgba(16,42,67,.05)}.card-detail-nav{position:sticky;top:16px;padding:10px}.card-detail-nav button{display:flex;align-items:center;justify-content:space-between;width:100%;border:0;background:transparent;color:#4b647d;text-align:left;padding:10px 9px;border-radius:5px;font-size:13px;cursor:pointer}.card-detail-nav button:hover{background:#f0f7f8;color:#0b7180}.card-detail-nav button.active{background:#e6f4f3;color:#087c89;font-weight:700}.card-detail-nav .nav-count{font-size:11px;color:#8295a7;background:#edf2f5;border-radius:10px;padding:2px 6px}.card-detail-main{overflow:hidden}.card-detail-summary{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 20px;border-bottom:1px solid #dbe4ea;background:#fbfdfd}.card-detail-patient{font-size:20px;font-weight:700;color:#102a43;line-height:1.25}.card-detail-meta{font-size:12px;color:#66809b;margin-top:6px}.card-detail-summary .badge{flex:0 0 auto}@media(max-width:760px){.card-detail-summary{flex-direction:column;align-items:flex-start;gap:10px}}.card-detail-section{scroll-margin-top:20px;padding:20px;border-bottom:1px solid #e5ebef}.card-detail-section:last-child{border-bottom:0}.card-detail-section-title{display:flex;align-items:center;gap:9px;color:#17324d;font-size:15px;font-weight:700;margin-bottom:14px}.card-detail-section-title:before{content:"";width:4px;height:18px;border-radius:2px;background:#168a94}.card-detail-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 24px}.card-detail-field{display:grid;grid-template-columns:112px minmax(0,1fr);gap:8px;align-items:start;font-size:13px;line-height:1.5}.card-detail-field-label{color:#8295a7}.card-detail-field-value{color:#253b53;font-weight:600;word-break:break-word}.card-detail-aside{position:sticky;top:16px;overflow:hidden}.card-detail-aside-section{padding:16px;border-bottom:1px solid #e5ebef}.card-detail-aside-section:last-child{border-bottom:0}.card-detail-aside-title{font-size:14px;font-weight:700;color:#17324d;margin-bottom:11px}.card-detail-note{width:100%;min-height:168px;resize:vertical;border:1px solid #b9cbd5;border-radius:4px;padding:10px;font:inherit;font-size:13px;line-height:1.6;color:#253b53;box-sizing:border-box}.card-detail-note:focus{outline:2px solid #b9e0e2;border-color:#168a94}.card-detail-source{font-size:12px;color:#5f748a;line-height:1.7}.card-detail-source a{color:#087c89;text-decoration:none}.card-detail-source a:hover{text-decoration:underline}.card-detail-history{font-size:12px;color:#667d91;line-height:1.8}.card-detail-history strong{color:#2d4b64}.card-detail-footer{display:flex;justify-content:flex-end;margin-top:10px}.card-detail-empty{padding:12px;background:#f7fafb;border:1px dashed #ccd9e0;color:#8a9aaa;font-size:12px}@media(max-width:1120px){.card-detail-workspace{grid-template-columns:158px minmax(0,1fr)}}@media(max-width:760px){.card-detail-topbar{display:block}.card-detail-actions{margin-top:12px}.card-detail-workspace{display:block}.card-detail-nav{position:static;margin-bottom:12px}.card-detail-nav{display:flex;overflow-x:auto;gap:4px}.card-detail-nav button{white-space:nowrap;width:auto;flex:0 0 auto}.card-detail-fields{grid-template-columns:1fr}.card-detail-field{grid-template-columns:100px minmax(0,1fr)}}';
document.head.appendChild(cardDetailLayoutStyles);

function cardDetailEscape(value){return String(value==null?'':value).replace(/[&<>"']/g,function(char){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]})}
function cardDetailValue(value){return value==null||value===''?'-':cardDetailEscape(value)}
function cardDetailField(label,value){return '<div class="card-detail-field"><span class="card-detail-field-label">'+label+'</span><span class="card-detail-field-value">'+cardDetailValue(value)+'</span></div>'}
function cardDetailSection(id,title,fields){return '<section class="card-detail-section" id="'+id+'"><div class="card-detail-section-title">'+title+'</div><div class="card-detail-fields">'+fields.map(function(field){return cardDetailField(field[0],field[1])}).join('')+'</div></section>'}
function cardDetailNavItem(id,label,count){return '<button type="button" data-section="'+id+'" onclick="scrollCardDetailSection(\''+id+'\')"><span>'+label+'</span>'+(count?'<span class="nav-count">'+count+'</span>':'')+'</button>'}
function scrollCardDetailSection(id){var target=document.getElementById(id);if(target)target.scrollIntoView({behavior:'smooth',block:'start'});document.querySelectorAll('.card-detail-nav button').forEach(function(button){button.classList.toggle('active',button.dataset.section===id)})}

function saveReportCardNote(id){var input=document.getElementById('reportCardNoteInput');if(!input)return;reportCardNotes[id]={text:input.value.trim(),time:new Date().toLocaleString('zh-CN',{hour12:false})};var status=document.getElementById('reportCardNoteStatus');if(status)status.textContent='已保存于 '+reportCardNotes[id].time;toast('备注已保存')}

cardListDetail=function(id){
var cards=window.reportCardListData||[];var c=cards.find(function(item){return item.id===id});if(!c){toast('未找到该报告卡','error');return}
var follow=window.reportCardFollowup&&window.reportCardFollowup[id]?window.reportCardFollowup[id]:{};var age=c.birth?Math.floor((new Date()-new Date(c.birth))/(365.25*24*3600*1000))+'岁':'-';var type=(c.cardType||'').replace(/<[^>]+>/g,'').trim()||'-';var linked=sourceDataRecords.filter(function(record){return record.linkedCards.includes(id)});var note=reportCardNotes[id]||{};
var basic=[['登记编号',c.id],['记录类型',type],['姓名',c.name],['其他证件','身份证'],['身份证号码',c.idNo],['性别',c.sex],['出生日期',c.birth],['年龄',age],['联系电话',c.phone],['联系人关系','配偶'],['联系人',c.name+'的家属'],['联系人电话','13900000000'],['民族',c.nation],['婚姻状况',c.marriage],['职业',c.job],['工作单位',c.workUnit],['户籍地址',c.household],['户籍详细地址',c.household?c.household.replace(/^([^/]+\/[^/]+\/[^/]+\/[^/]+).*$/,'$1/具体门牌号'):'-'],['常住地址',c.residence],['常住详细地址',c.residence?c.residence.replace(/^([^/]+\/[^/]+\/[^/]+\/[^/]+).*$/,'$1/具体门牌号'):'-']];
var tumor=[['发病部位',c.site],['亚部位',c.site==='肺'?'上叶':c.site==='胃'?'胃窦':c.site==='肝'?'右叶':c.site==='乳房'?'左乳':'未分类'],['病理类型',c.pathology],['行为','/3 恶性'],['分级','II级'],['诊断依据','病理学诊断'],['临床分期','IIb期'],['TNM分期','T2N0M0'],['确诊日期',c.diagnosisDate],['ICD10',c.icd10],['治疗信息','手术+化疗'],['诊断结果',c.site+'恶性肿瘤('+c.icd10+')'],['详细诊断结果',c.site+'部'+c.pathology+'，分化II级，未见远处转移'],['住院号',c.inpatientNo],['门诊号',c.outpatientNo],['报告日期',c.reportDate],['报告医师',c.doctor]];
var followFields=[['最后接触日期',follow.dlc],['最后接触状态',follow.state],['生存月数',follow.surmonth||'-'],['死亡地点',follow.deadplace],['根本死因',follow.caus],['死因ICD10编码',follow.causicd],['死亡日期',follow.deathda],['死亡报告医师',follow.deadDoct]];
var sourceHtml=linked.length?linked.map(function(record){return '<div class="card-detail-source"><a href="javascript:void(0)" onclick="openSourceDataDetail(\''+record.id+'\')">'+record.id+'</a> · '+record.sourceType+' · '+record.batch+'<br>'+record.fileName+' / 第'+record.rowNo+'行 · 采用 V'+record.version+(sourceHasChange(record)?'（已修订）':'')+'</div>'}).join('<div style="height:10px"></div>'):'<div class="card-detail-empty">暂无关联源数据</div>';
var historyHtml=linked.reduce(function(html,record){return html+(record.history.length?record.history.slice().reverse().map(function(item){return '<div class="card-detail-history"><strong>V'+item.version+'</strong> · '+item.time+'<br>'+item.reason+'</div>'}).join(''):'')},'');
var aside='<aside class="card-detail-aside"><div class="card-detail-aside-section"><div class="card-detail-aside-title">备注说明</div><textarea id="reportCardNoteInput" class="card-detail-note" placeholder="记录核对结论、补充说明或后续处理建议">'+cardDetailEscape(note.text||'')+'</textarea><div class="card-detail-footer"><button class="btn btn-primary btn-sm" onclick="saveReportCardNote(\''+c.id+'\')">保存备注</button></div><div id="reportCardNoteStatus" style="font-size:11px;color:#8a9aaa;margin-top:7px">'+(note.time?'已保存于 '+note.time:'备注仅对当前报告卡生效')+'</div></div><div class="card-detail-aside-section"><div class="card-detail-aside-title">数据来源</div>'+sourceHtml+'</div><div class="card-detail-aside-section"><div class="card-detail-aside-title">处理状态</div><div class="card-detail-history">校验状态：'+(c.checkStatus||'-')+'<br>审核状态：'+(c.auditStatus||'-')+'<br>来源记录：'+linked.length+' 条'+(historyHtml?'<br><br>'+historyHtml:'')+'</div></div></aside>';
var canEdit=typeof cardCanEdit==='function'&&cardCanEdit(c);var actions='<button class="btn btn-ghost btn-sm" onclick="switchReportDataView(\'cards\')">返回报告卡列表</button>'+(canEdit?'<button class="btn btn-primary btn-sm" onclick="cardListEdit(\''+c.id+'\')">编辑报告卡</button>':'');
var nav='<nav class="card-detail-nav" aria-label="报告卡详情导航">'+cardDetailNavItem('card-detail-overview','概览')+cardDetailNavItem('card-detail-basic','基本信息','20')+cardDetailNavItem('card-detail-tumor','诊断病理','17')+cardDetailNavItem('card-detail-follow','随访信息','8')+cardDetailNavItem('card-detail-source','证据溯源',linked.length)+cardDetailNavItem('card-detail-history','变更历史')+'</nav>';
var cardVersion=c.version||'1.0';var main='<main class="card-detail-main" id="card-detail-main"><div class="card-detail-summary"><div><div class="card-detail-patient">'+cardDetailEscape(c.name)+' <span style="font-size:13px;font-weight:500;color:#66809b">'+cardDetailEscape(c.sex||'')+' · '+age+'</span></div><div class="card-detail-meta">'+cardDetailEscape(c.id)+' · 报告日期 '+cardDetailEscape(c.reportDate||'-')+' · '+cardDetailEscape(c.doctor||'-')+'</div></div><div style="display:flex;align-items:center;gap:8px;flex:0 0 auto">'+((c.checkStatus||'').replace('<span','<span style="margin-right:6px"'))+'</div></div><section class="card-detail-section" id="card-detail-overview"><div class="card-detail-section-title">概览</div><div class="card-detail-fields">'+cardDetailField('登记编号',c.id)+cardDetailField('患者姓名',c.name)+cardDetailField('诊断',c.site+' / '+c.pathology)+cardDetailField('当前版本','V'+cardVersion)+'</div></section>'+cardDetailSection('card-detail-basic','基本信息',basic)+cardDetailSection('card-detail-tumor','诊断病理',tumor)+cardDetailSection('card-detail-follow','随访信息',followFields)+'<section class="card-detail-section" id="card-detail-source"><div class="card-detail-section-title">证据溯源</div>'+sourceHtml+'</section><section class="card-detail-section" id="card-detail-history"><div class="card-detail-section-title">变更历史</div>'+(historyHtml||'<div class="card-detail-empty">暂无报告卡变更记录</div>')+'</section></main>';
document.getElementById('pageContainer').innerHTML='<div class="card-detail-page"><div class="card-detail-topbar"><div class="card-detail-title">报告卡详情 <span style="color:#9fb0bf;font-weight:400;margin:0 6px">/</span> <span style="color:#8295a7;font-weight:500">'+cardDetailEscape(c.id)+' · V'+cardDetailEscape(cardVersion)+'</span></div><div class="card-detail-actions">'+actions+'</div></div><div class="card-detail-workspace">'+nav+main+aside+'</div></div>';
setActiveMenu('datamgmt-card');updateBreadcrumb('datamgmt-card','报告卡详情');window.scrollTo(0,0);scrollCardDetailSection('card-detail-overview')
};

var patientArchiveStyles=document.createElement('style');
patientArchiveStyles.textContent='.archive-summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border:1px solid #dbe4ea;border-radius:5px;margin-bottom:16px}.archive-summary-item{padding:13px 15px;border-right:1px solid #e5ebef}.archive-summary-item:last-child{border-right:0}.archive-summary-label{font-size:12px;color:#8295a7}.archive-summary-value{font-size:19px;font-weight:700;color:#17324d;margin-top:4px}.archive-toolbar{display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;margin-bottom:12px;padding:12px;background:#f7fafb;border:1px solid #e0e8ed;border-radius:5px}.archive-toolbar .form-group{margin:0}.archive-timeline{border-top:1px solid #e2e8ed}.archive-event{display:grid;grid-template-columns:92px 88px minmax(0,1fr) 96px;gap:12px;align-items:start;padding:14px 4px;border-bottom:1px solid #e8eef2}.archive-event-date{font-size:12px;color:#60788f;font-weight:600}.archive-event-type{font-size:12px}.archive-event-title{font-size:14px;font-weight:700;color:#17324d}.archive-event-desc{font-size:12px;color:#66809b;line-height:1.6;margin-top:4px}.archive-event-hospital{font-size:12px;color:#4f697f;margin-top:5px}.archive-event-action{text-align:right}.archive-treatment{border:1px solid #dbe4ea;border-radius:5px;margin-bottom:12px;overflow:hidden}.archive-treatment-head{display:grid;grid-template-columns:minmax(0,1fr) 150px 88px;gap:12px;align-items:center;padding:13px 15px;background:#fbfdfd}.archive-treatment-title{font-size:14px;font-weight:700;color:#17324d}.archive-treatment-meta{font-size:12px;color:#66809b;margin-top:4px}.archive-treatment-body{padding:14px 15px;border-top:1px solid #e5ebef}.archive-treatment-body.hidden{display:none}.archive-treatment-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.archive-treatment-field{font-size:12px;color:#8295a7}.archive-treatment-field strong{display:block;color:#2d4b64;font-size:13px;margin-top:4px}.archive-record-table{width:100%;min-width:760px}.archive-abnormal{color:#c2413b;font-weight:700}.archive-normal{color:#34875c}.archive-task{display:flex;gap:9px;align-items:flex-start;padding:9px 0;border-bottom:1px solid #edf1f4;font-size:12px;color:#415d75;line-height:1.5}.archive-task:last-child{border-bottom:0}.archive-task input{margin-top:2px}.archive-hospital-list{display:grid;gap:9px}.archive-hospital{padding-bottom:9px;border-bottom:1px solid #edf1f4;font-size:12px;color:#60788f;line-height:1.6}.archive-hospital:last-child{border-bottom:0;padding-bottom:0}.archive-hospital strong{display:block;color:#28475f}.archive-report-current{background:#eff8f7}.archive-section-note{font-size:12px;color:#71869a;margin:-7px 0 13px}.archive-record-link{color:#087c89;text-decoration:none}.archive-record-link:hover{text-decoration:underline}@media(max-width:1120px){.archive-summary-grid{grid-template-columns:repeat(2,1fr)}.archive-summary-item:nth-child(2){border-right:0}.archive-treatment-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:760px){.archive-summary-grid{grid-template-columns:1fr}.archive-summary-item{border-right:0;border-bottom:1px solid #e5ebef}.archive-event{grid-template-columns:80px minmax(0,1fr)}.archive-event-type,.archive-event-action{grid-column:2}.archive-treatment-head{grid-template-columns:1fr}.archive-treatment-grid{grid-template-columns:1fr}}';
document.head.appendChild(patientArchiveStyles);

function getPatientArchiveData(c,patientCards){
var primaryHospital=c.reportUnit||'江西省肿瘤医院';
var treatments=[
{id:'TR-2026-001',hospital:'江西省肿瘤医院',department:'胸外科',start:'2026-03-20',end:'2026-04-02',type:'手术治疗',status:'已完成',doctor:'王医生',plan:'右肺上叶切除术 + 淋巴结清扫',cycles:'1次手术',response:'术后恢复良好',adverse:'无严重并发症'},
{id:'TR-2026-002',hospital:'南昌大学第一附属医院',department:'肿瘤内科',start:'2026-04-18',end:'2026-06-30',type:'化学治疗',status:'进行中',doctor:'李医生',plan:'培美曲塞 + 铂类',cycles:'已完成 3 / 4 周期',response:'病灶稳定',adverse:'轻度乏力、白细胞下降'},
{id:'TR-2026-003',hospital:'南昌市中心医院',department:'放疗科',start:'2026-07-05',end:'2026-07-19',type:'放射治疗',status:'计划中',doctor:'赵医生',plan:'胸部调强放疗',cycles:'计划 10 次',response:'待评估',adverse:'暂无'}
];
var followups=[
{date:'2026-07-15',hospital:'南昌大学第一附属医院',method:'电话随访',doctor:'李医生',status:'存活',result:'完成第 3 周期化疗，轻度乏力，无发热',next:'2026-08-15'},
{date:'2026-06-15',hospital:primaryHospital,method:'门诊随访',doctor:c.doctor||'王医生',status:'存活',result:'术后恢复稳定，建议继续辅助化疗',next:'2026-07-15'},
{date:'2026-05-18',hospital:'江西省肿瘤医院',method:'门诊随访',doctor:'王医生',status:'存活',result:'切口愈合良好，未见明显复发征象',next:'2026-06-15'}
];
var labs=[
{date:'2026-07-01',hospital:'南昌大学第一附属医院',name:'血常规',item:'白细胞计数',value:'2.8 ×10^9/L',range:'3.5–9.5',status:'异常偏低'},
{date:'2026-07-01',hospital:'南昌大学第一附属医院',name:'血常规',item:'血红蛋白',value:'108 g/L',range:'130–175',status:'异常偏低'},
{date:'2026-06-28',hospital:'南昌大学第一附属医院',name:'肝功能',item:'ALT',value:'42 U/L',range:'9–50',status:'正常'},
{date:'2026-06-20',hospital:'江西省肿瘤医院',name:'肿瘤标志物',item:'CEA',value:'8.2 ng/mL',range:'0–5.0',status:'异常偏高'}
];
var images=[
{date:'2026-06-25',hospital:'南昌大学第一附属医院',type:'胸部 CT',part:'胸部',conclusion:'右肺术后改变，未见明确新发占位',compare:'较 2026-04-15 稳定'},
{date:'2026-04-15',hospital:'江西省肿瘤医院',type:'胸部增强 CT',part:'胸部',conclusion:'右肺上叶占位，伴纵隔淋巴结增大',compare:'首次基线检查'},
{date:'2026-03-12',hospital:'南昌市中心医院',type:'PET-CT',part:'全身',conclusion:'右肺上叶高代谢灶，未见明确远处转移',compare:'术前分期检查'}
];
var events=[
{date:'2026-07-15',type:'随访',hospital:'南昌大学第一附属医院',title:'电话随访',desc:'完成第 3 周期化疗，轻度乏力，计划 8 月复诊',status:'已完成'},
{date:'2026-07-05',type:'治疗',hospital:'南昌市中心医院',title:'放射治疗计划',desc:'拟行胸部调强放疗，共 10 次',status:'计划中'},
{date:'2026-07-01',type:'检验',hospital:'南昌大学第一附属医院',title:'血常规检查',desc:'白细胞 2.8 ×10^9/L，低于参考范围',status:'异常'},
{date:'2026-06-25',type:'影像',hospital:'南昌大学第一附属医院',title:'胸部 CT',desc:'术后改变，未见明确新发占位',status:'已出报告'},
{date:'2026-06-15',type:'随访',hospital:primaryHospital,title:'门诊随访',desc:'术后恢复稳定，建议继续辅助化疗',status:'已完成'},
{date:'2026-04-18',type:'治疗',hospital:'南昌大学第一附属医院',title:'开始辅助化疗',desc:'培美曲塞 + 铂类方案，第 1 周期',status:'进行中'},
{date:'2026-03-20',type:'治疗',hospital:'江西省肿瘤医院',title:'右肺上叶切除术',desc:'肺叶切除术 + 淋巴结清扫',status:'已完成'},
{date:c.diagnosisDate||'2026-03-15',type:'诊断',hospital:primaryHospital,title:c.site+' '+c.pathology,desc:'ICD10 '+c.icd10+'，病理学诊断',status:'已确诊'}
];
patientCards.forEach(function(card){events.push({date:card.reportDate,type:'报告卡',hospital:card.reportUnit,title:'报告卡 '+card.id,desc:card.site+' / '+card.pathology+' / '+((card.cardType||'').replace(/<[^>]+>/g,'').trim()),status:'已入库'})});
events.sort(function(a,b){return b.date.localeCompare(a.date)});
return {treatments:treatments,followups:followups,labs:labs,images:images,events:events}
}

function archiveBadge(text){var cls=text==='已完成'||text==='已入库'||text==='正常'||text==='存活'?'badge-success':text==='异常'||text.indexOf('异常')===0?'badge-danger':text==='进行中'||text==='已出报告'?'badge-info':'badge-warning';return '<span class="badge '+cls+'">'+cardDetailEscape(text)+'</span>'}
function filterPatientTimeline(){var type=document.getElementById('archiveTimelineType')?.value||'';var hospital=document.getElementById('archiveTimelineHospital')?.value||'';var visible=0;document.querySelectorAll('.archive-event').forEach(function(row){var show=(!type||row.dataset.type===type)&&(!hospital||row.dataset.hospital===hospital);row.style.display=show?'grid':'none';if(show)visible++});var count=document.getElementById('archiveTimelineCount');if(count)count.textContent='显示 '+visible+' 条记录'}
function toggleTreatmentDetails(id,button){var body=document.getElementById('archiveTreatment_'+id);if(!body)return;var hidden=body.classList.toggle('hidden');button.textContent=hidden?'展开':'收起'}
function archiveTaskChanged(input){toast(input.checked?'待办已完成':'待办已恢复')}
function viewArchiveRecord(name){toast('查看记录：'+name)}
var patientBasicStyles=document.createElement('style');
patientBasicStyles.textContent='.archive-basic-group{padding:2px 0 18px}.archive-basic-group+.archive-basic-group{padding-top:18px;border-top:1px solid #e6edf1}.archive-basic-group-title{font-size:13px;font-weight:700;color:#45627a;margin-bottom:12px}.archive-basic-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0 24px}.archive-basic-cell{min-width:0;padding:8px 0 11px;border-bottom:1px solid #edf2f5}.archive-basic-cell.wide{grid-column:span 2}.archive-basic-grid>.archive-basic-cell:last-child:nth-child(4n+1){grid-column:span 4}.archive-basic-grid>.archive-basic-cell:nth-last-child(2):nth-child(4n+1),.archive-basic-grid>.archive-basic-cell:last-child:nth-child(4n+2){grid-column:span 2}.archive-basic-label{font-size:12px;color:#8295a7;margin-bottom:5px}.archive-basic-value{font-size:14px;line-height:1.5;color:#17324d;font-weight:600;word-break:break-word}.archive-basic-value.muted{color:#71869a;font-weight:500}@media(max-width:1180px){.archive-basic-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:760px){.archive-basic-grid{grid-template-columns:1fr}.archive-basic-cell.wide{grid-column:auto}}';
document.head.appendChild(patientBasicStyles);
function archiveBasicCell(label,value,wide){return '<div class="archive-basic-cell'+(wide?' wide':'')+'"><div class="archive-basic-label">'+cardDetailEscape(label)+'</div><div class="archive-basic-value'+(value==null||value===''?' muted':'')+'">'+cardDetailValue(value)+'</div></div>'}
function archiveBasicGroup(title,fields){return '<div class="archive-basic-group"><div class="archive-basic-group-title">'+cardDetailEscape(title)+'</div><div class="archive-basic-grid">'+fields.map(function(field){return archiveBasicCell(field[0],field[1],field[2])}).join('')+'</div></div>'}

cardListDetail=function(id){
var cards=window.reportCardListData||[];var c=cards.find(function(item){return item.id===id});if(!c){toast('未找到该患者档案','error');return}
var patientCards=cards.filter(function(item){return item.idNo===c.idNo});var archive=getPatientArchiveData(c,patientCards);var linked=sourceDataRecords.filter(function(record){return patientCards.some(function(card){return record.linkedCards.includes(card.id)})});var age=c.birth?Math.floor((new Date()-new Date(c.birth))/(365.25*24*3600*1000))+'岁':'-';var noteKey=c.idNo||c.id;var note=reportCardNotes[noteKey]||{};var type=(c.cardType||'').replace(/<[^>]+>/g,'').trim()||'-';
var hospitals=Array.from(new Set(archive.events.map(function(event){return event.hospital})));var timelineRows=archive.events.map(function(event){return '<div class="archive-event" data-type="'+cardDetailEscape(event.type)+'" data-hospital="'+cardDetailEscape(event.hospital)+'"><div class="archive-event-date">'+event.date+'</div><div class="archive-event-type">'+archiveBadge(event.type)+'</div><div><div class="archive-event-title">'+cardDetailEscape(event.title)+'</div><div class="archive-event-desc">'+cardDetailEscape(event.desc)+'</div><div class="archive-event-hospital">'+cardDetailEscape(event.hospital)+'</div></div><div class="archive-event-action">'+archiveBadge(event.status)+'</div></div>'}).join('');
var treatments=archive.treatments.map(function(record){return '<div class="archive-treatment"><div class="archive-treatment-head"><div><div class="archive-treatment-title">'+record.type+' · '+record.hospital+'</div><div class="archive-treatment-meta">'+record.start+' 至 '+record.end+' · '+record.department+' · '+record.doctor+'</div></div><div>'+archiveBadge(record.status)+'</div><div><button class="btn btn-ghost btn-xs" onclick="toggleTreatmentDetails(\''+record.id+'\',this)">展开</button></div></div><div class="archive-treatment-body hidden" id="archiveTreatment_'+record.id+'"><div class="archive-treatment-grid"><div class="archive-treatment-field">治疗方案<strong>'+record.plan+'</strong></div><div class="archive-treatment-field">疗程/次数<strong>'+record.cycles+'</strong></div><div class="archive-treatment-field">疗效评估<strong>'+record.response+'</strong></div><div class="archive-treatment-field">不良反应<strong>'+record.adverse+'</strong></div><div class="archive-treatment-field">关联检验<strong>'+archive.labs.filter(function(lab){return lab.hospital===record.hospital}).length+' 条</strong></div><div class="archive-treatment-field">关联影像<strong>'+archive.images.filter(function(image){return image.hospital===record.hospital}).length+' 条</strong></div></div></div></div>'}).join('');
var followRows = archive.followups.map(function(record){return '<tr><td class="code">'+record.date+'</td><td class="txt">'+record.hospital+'</td><td class="code">'+record.method+'</td><td class="txt">'+record.doctor+'</td><td class="code">'+archiveBadge(record.status)+'</td><td class="code">'+record.result+'</td><td class="code">'+record.next+'</td></tr>'}).join('');
var labRows = archive.labs.map(function(record){return '<tr><td class="code">'+record.date+'</td><td class="txt">'+record.hospital+'</td><td class="txt">'+record.name+'</td><td class="txt">'+record.item+'</td><td class="'+(record.status==='正常'?'archive-normal':'archive-abnormal')+'">'+record.value+'</td><td class="txt">'+record.range+'</td><td class="code">'+archiveBadge(record.status)+'</td></tr>'}).join('');
var imageRows = archive.images.map(function(record){return '<tr><td class="code">'+record.date+'</td><td class="txt">'+record.hospital+'</td><td class="code">'+record.type+'</td><td class="txt">'+record.part+'</td><td class="txt">'+record.conclusion+'</td><td class="code">'+record.compare+'</td><td class="ops"><button class="btn btn-ghost btn-xs" onclick="viewArchiveRecord(\''+record.type+' '+record.date+'\')">查看</button></td></tr>'}).join('');
var reportRows = patientCards.map(function(card){var cardType=(card.cardType||'').replace(/<[^>]+>/g,'').trim();return '<tr class="'+(card.id===id?'archive-report-current':'')+'"><td class="txt"><a class="archive-record-link" href="javascript:void(0)" onclick="cardListDetail(\''+card.id+'\')">'+card.id+'</a></td><td class="code">'+card.reportDate+'</td><td class="txt">'+card.reportUnit+'</td><td class="txt">'+card.site+' / '+card.pathology+'</td><td class="code">'+cardType+'</td><td class="code">'+card.checkStatus+'</td><td class="ops">'+(card.id===id?'<span class="badge badge-info">当前查看</span>':'<button class="btn btn-ghost btn-xs" onclick="cardListDetail(\''+card.id+'\')">查看</button>')+'</td></tr>'}).join('');
var sourceHtml=linked.length?linked.map(function(record){return '<div class="card-detail-source"><a href="javascript:void(0)" onclick="openSourceDataDetail(\''+record.id+'\')">'+record.id+'</a> · '+record.sourceType+' · '+record.batch+'<br>'+record.fileName+' / 第'+record.rowNo+'行 · V'+record.version+'</div>'}).join('<div style="height:10px"></div>'):'<div class="card-detail-empty">暂无关联源数据</div>';
var householdDetail=c.household?c.household+'/具体门牌号':'-';var residenceDetail=c.residence?c.residence+'/具体门牌号':'-';
var basicFields=[['患者主索引','MPI-'+c.idNo.slice(-8)],['登记编号',c.id],['记录类型',type],['姓名',c.name],['证件类型','身份证'],['身份证号码',c.idNo],['性别',c.sex],['出生日期',c.birth],['年龄',age],['联系电话',c.phone],['联系人关系','配偶'],['联系人',c.name+'的家属'],['联系人电话','13900000000'],['民族',c.nation],['婚姻状况',c.marriage],['职业',c.job],['工作单位',c.workUnit,true],['户籍地址',c.household,true],['户籍详细地址',householdDetail,true],['常住地址',c.residence,true],['常住详细地址',residenceDetail,true]];
var diagnosisRows = patientCards.map(function(card){return '<tr><td class="code">'+card.diagnosisDate+'</td><td class="txt">'+card.site+'</td><td class="code">'+card.pathology+'</td><td class="txt">'+card.icd10+'</td><td class="txt">'+card.reportUnit+'</td><td class="txt"><a class="archive-record-link" href="javascript:void(0)" onclick="cardListDetail(\''+card.id+'\')">'+card.id+'</a></td></tr>'}).join('');
var timelineSection='<section class="card-detail-section" id="archive-timeline"><div class="card-detail-section-title">诊疗过程</div><div class="archive-toolbar"><div class="form-group"><label>记录类型</label><select id="archiveTimelineType" onchange="filterPatientTimeline()"><option value="">全部记录</option><option>诊断</option><option>治疗</option><option>随访</option><option>检验</option><option>影像</option><option>报告卡</option></select></div><div class="form-group"><label>医疗机构</label><select id="archiveTimelineHospital" onchange="filterPatientTimeline()"><option value="">全部机构</option>'+hospitals.map(function(hospital){return '<option>'+hospital+'</option>'}).join('')+'</select></div><div id="archiveTimelineCount" style="font-size:12px;color:#71869a;padding-bottom:7px">显示 '+archive.events.length+' 条记录</div></div><div class="archive-timeline">'+timelineRows+'</div></section>';
var basicSection='<section class="card-detail-section" id="archive-basic"><div class="card-detail-section-title">基本信息</div><div class="archive-basic-grid">'+basicFields.map(function(field){return archiveBasicCell(field[0],field[1],field[2])}).join('')+'</div></section>';
var diagnosis='<section class="card-detail-section" id="archive-diagnosis"><div class="card-detail-section-title">诊断与病理</div><div class="archive-section-note">汇总该患者不同机构、不同时间形成的诊断和报告卡记录。</div><div class="table-wrap"><table class="data-table archive-record-table"><thead><tr><th class="code">确诊日期</th><th class="txt">发病部位</th><th class="code">病理类型</th><th class="txt">ICD10</th><th class="txt">报告机构</th><th class="txt">报告卡</th></tr></thead><tbody>'+diagnosisRows+'</tbody></table></div></section>';
var latestFollow=archive.followups[0]||{};var followSource=window.reportCardFollowup&&window.reportCardFollowup[c.id]?window.reportCardFollowup[c.id]:{};var followState=followSource.state||latestFollow.status||'存活';var followResultSection='<section class="card-detail-section" id="archive-follow-result"><div class="card-detail-section-title">随访结果</div><div class="tumor-form-grid">'+tumorFormField('最后接触日期',followSource.dlc||latestFollow.date,true)+tumorFormField('最后接触状态',followState,true)+tumorFormField('死亡地点',followSource.deadplace||'-',followState==='死亡')+tumorFormField('根本死因',followSource.caus||'-',followState==='死亡')+tumorFormField('死因ICD10编码',followSource.causicd||'-',followState==='死亡')+tumorFormField('死亡日期',followSource.deathda||'-',followState==='死亡')+tumorFormField('死亡报告医师',followSource.deadDoct||'-',false)+'</div></section>';
var treatmentSection='<section class="card-detail-section" id="archive-treatment"><div class="card-detail-section-title">治疗记录</div><div class="archive-section-note">每家医院、每个疗程单独形成治疗周期，互不覆盖。</div>'+treatments+'</section>';
var followSection='<section class="card-detail-section" id="archive-follow"><div class="card-detail-section-title">随访记录</div><div class="table-wrap"><table class="data-table archive-record-table"><thead><tr><th class="code">随访日期</th><th class="txt">随访机构</th><th class="code">方式</th><th class="txt">医生</th><th class="code">状态</th><th class="code">随访结果</th><th class="code">下次随访</th></tr></thead><tbody>'+followRows+'</tbody></table></div></section>';
var labSection='<section class="card-detail-section" id="archive-lab"><div class="card-detail-section-title">检验检查</div><div class="table-wrap"><table class="data-table archive-record-table"><thead><tr><th class="code">检查日期</th><th class="txt">检查机构</th><th class="txt">检验单</th><th class="txt">检验项目</th><th class="code">结果</th><th class="txt">参考范围</th><th class="code">状态</th></tr></thead><tbody>'+labRows+'</tbody></table></div></section>';
var imageSection='<section class="card-detail-section" id="archive-image"><div class="card-detail-section-title">影像资料</div><div class="table-wrap"><table class="data-table archive-record-table"><thead><tr><th class="code">检查日期</th><th class="txt">检查机构</th><th class="code">检查类型</th><th class="txt">部位</th><th class="txt">影像结论</th><th class="code">对比结果</th><th class="ops">操作</th></tr></thead><tbody>'+imageRows+'</tbody></table></div></section>';
var reportSection='<section class="card-detail-section" id="archive-report"><div class="card-detail-section-title">报告卡记录</div><div class="table-wrap"><table class="data-table archive-record-table"><thead><tr><th class="txt">登记编号</th><th class="code">报告日期</th><th class="txt">报告机构</th><th class="txt">诊断</th><th class="code">记录类型</th><th class="code">校验状态</th><th class="ops">操作</th></tr></thead><tbody>'+reportRows+'</tbody></table></div></section>';
var sourceSection='<section class="card-detail-section" id="archive-source"><div class="card-detail-section-title">证据溯源</div>'+sourceHtml+'</section>';
var historySection='<section class="card-detail-section" id="archive-history"><div class="card-detail-section-title">变更历史</div><div class="card-detail-history"><strong>2026-07-15</strong> 更新随访记录与治疗状态<br><strong>2026-06-25</strong> 关联南昌大学第一附属医院胸部 CT 报告<br><strong>2026-06-15</strong> 报告卡 '+c.id+' 完成校验入库</div></section>';
var nav='<nav class="card-detail-nav" aria-label="患者诊疗档案导航">'+cardDetailNavItem('archive-basic','基本信息')+cardDetailNavItem('archive-diagnosis','诊断与病理',patientCards.length)+cardDetailNavItem('archive-timeline','诊疗过程',archive.events.length)+cardDetailNavItem('archive-treatment','治疗记录',archive.treatments.length)+cardDetailNavItem('archive-follow','随访记录',archive.followups.length)+cardDetailNavItem('archive-lab','检验检查',archive.labs.length)+cardDetailNavItem('archive-image','影像资料',archive.images.length)+cardDetailNavItem('archive-report','报告卡记录',patientCards.length)+cardDetailNavItem('archive-source','证据溯源',linked.length)+cardDetailNavItem('archive-history','变更历史')+'</nav>';
var tasks='<label class="archive-task"><input type="checkbox" onchange="archiveTaskChanged(this)"><span>补充 AJCC 分期信息</span></label><label class="archive-task"><input type="checkbox" checked onchange="archiveTaskChanged(this)"><span>核对病理诊断依据</span></label><label class="archive-task"><input type="checkbox" onchange="archiveTaskChanged(this)"><span>上传下一次胸部 CT 报告</span></label><label class="archive-task"><input type="checkbox" onchange="archiveTaskChanged(this)"><span>安排 2026-08-15 随访</span></label>';
var aside='<aside class="card-detail-aside"><div class="card-detail-aside-section"><div class="card-detail-aside-title">备注说明</div><textarea id="reportCardNoteInput" class="card-detail-note" placeholder="记录患者层面的核对结论、跨院诊疗说明或后续处理建议">'+cardDetailEscape(note.text||'')+'</textarea><div class="card-detail-footer"><button class="btn btn-primary btn-sm" onclick="savePatientArchiveNote(\''+noteKey+'\')">保存备注</button></div><div id="reportCardNoteStatus" style="font-size:11px;color:#8a9aaa;margin-top:7px">'+(note.time?'已保存于 '+note.time:'备注对患者档案生效')+'</div></div><div class="card-detail-aside-section"><div class="card-detail-aside-title">待办事项</div>'+tasks+'</div><div class="card-detail-aside-section"><div class="card-detail-aside-title">当前状态</div><div class="card-detail-history">当前诊断：<strong>'+c.site+' '+c.pathology+'</strong><br>治疗阶段：<strong>辅助化疗进行中</strong><br>最近随访：<strong>'+archive.followups[0].date+'</strong><br>最近异常：<strong>白细胞计数偏低</strong></div></div><div class="card-detail-aside-section"><div class="card-detail-aside-title">就诊机构</div><div class="archive-hospital-list">'+hospitals.map(function(hospital){return '<div class="archive-hospital"><strong>'+hospital+'</strong>'+archive.events.filter(function(event){return event.hospital===hospital}).length+' 条诊疗记录</div>'}).join('')+'</div></div></aside>';
var main='<main class="card-detail-main" id="card-detail-main"><div class="card-detail-summary"><div><div class="card-detail-patient">'+cardDetailEscape(c.name)+' <span style="font-size:13px;font-weight:500;color:#66809b">'+c.sex+' · '+age+'</span></div><div class="card-detail-meta">MPI-'+c.idNo.slice(-8)+' · '+c.site+' '+c.pathology+' · 最近记录 '+archive.events[0].date+'</div></div><div>'+archiveBadge('治疗中')+'</div></div>'+basicSection+diagnosis+followResultSection+timelineSection+treatmentSection+followSection+labSection+imageSection+reportSection+sourceSection+historySection+'</main>';
var actions='<button class="btn btn-ghost btn-sm" onclick="switchReportDataView(\'cards\')">返回报告卡列表</button><button class="btn btn-primary btn-sm" onclick="cardListEdit(\''+c.id+'\')">编辑当前报告卡</button>';
document.getElementById('pageContainer').innerHTML='<div class="card-detail-page"><div class="card-detail-topbar"><div><div class="card-detail-title">患者诊疗档案</div><div class="card-detail-kicker">'+c.name+' · '+c.id+' · 聚合 '+hospitals.length+' 家医疗机构</div></div><div class="card-detail-actions">'+actions+'</div></div><div class="card-detail-workspace">'+nav+main+aside+'</div></div>';
setActiveMenu('datamgmt-card');updateBreadcrumb('datamgmt-card','患者诊疗档案');window.scrollTo(0,0);scrollCardDetailSection('archive-basic')
};

function savePatientArchiveNote(key){var input=document.getElementById('reportCardNoteInput');if(!input)return;reportCardNotes[key]={text:input.value.trim(),time:new Date().toLocaleString('zh-CN',{hour12:false})};var status=document.getElementById('reportCardNoteStatus');if(status)status.textContent='已保存于 '+reportCardNotes[key].time;toast('患者档案备注已保存')}

var canonicalDiagnosisStyles=document.createElement('style');
canonicalDiagnosisStyles.textContent='.diagnosis-canonical{display:flex;align-items:center;justify-content:center;gap:22px;padding:16px 4px 22px;flex-wrap:wrap}.diagnosis-node{width:126px;height:126px;border:1px solid #b8d7db;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;background:#f5fbfb;color:#17324d;padding:14px;box-sizing:border-box}.diagnosis-node.main{width:154px;height:154px;border-color:#168a94;background:#e8f6f5;box-shadow:0 0 0 6px #f2fbfb}.diagnosis-node-label{font-size:12px;color:#66809b;margin-bottom:7px}.diagnosis-node strong{font-size:15px;line-height:1.4}.diagnosis-node small{font-size:11px;color:#087c89;margin-top:6px}.diagnosis-evidence{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;background:#f8fafb;border:1px solid #e0e8ed;border-radius:5px;font-size:12px;color:#60788f}.diagnosis-evidence strong{color:#2d4b64}.archive-normalize-note{padding:10px 12px;margin:-2px 0 12px;background:#f7fafb;border-left:3px solid #8bbfc4;color:#60788f;font-size:12px;line-height:1.6}.archive-treatment-source{font-size:12px;color:#66809b;margin-top:12px;padding-top:10px;border-top:1px solid #edf2f5}.archive-treatment-source strong{color:#2d4b64}@media(max-width:650px){.diagnosis-canonical{gap:10px}.diagnosis-node{width:112px;height:112px}.diagnosis-node.main{width:136px;height:136px}.diagnosis-evidence{display:block}.diagnosis-evidence button{margin-top:8px}}';
document.head.appendChild(canonicalDiagnosisStyles);
function buildCanonicalDiagnosis(current,patientCards){var ordered=patientCards.slice().sort(function(a,b){return String(a.reportDate||'').localeCompare(String(b.reportDate||''))});var first=ordered[0]||current;return {diagnosis:(current.site||'未明确')+'恶性肿瘤',site:current.site||'未明确',pathology:current.pathology||'未明确',icd10:current.icd10||'-',diagnosisDate:first.diagnosisDate||current.diagnosisDate||'-',basis:'病理学诊断',stage:'IIb期',tnm:'T2N0M0',evidenceCount:patientCards.length,status:'当前有效'} }
function openDiagnosisEvidence(){var target=document.getElementById('archive-report');if(target)target.scrollIntoView({behavior:'smooth',block:'start'})}
var canonicalArchiveDetail=cardListDetail;
cardListDetail=function(id){
canonicalArchiveDetail(id);
var cards=window.reportCardListData||[];var current=cards.find(function(item){return item.id===id});if(!current)return;var patientCards=cards.filter(function(item){return item.idNo===current.idNo});var diagnosis=buildCanonicalDiagnosis(current,patientCards);var section=document.getElementById('archive-diagnosis');if(section){section.innerHTML='<div class="card-detail-section-title">诊断与病理</div><div class="archive-section-note">这里展示患者当前有效的规范化诊断；不同医院的报告保留为证据，不在此重复平铺。</div><div class="diagnosis-canonical"><div class="diagnosis-node"><div class="diagnosis-node-label">发病部位</div><strong>'+cardDetailEscape(diagnosis.site)+'</strong><small>当前部位</small></div><div class="diagnosis-node main"><div class="diagnosis-node-label">当前诊断</div><strong>'+cardDetailEscape(diagnosis.diagnosis)+'</strong><small>'+cardDetailEscape(diagnosis.status)+'</small></div><div class="diagnosis-node"><div class="diagnosis-node-label">病理类型</div><strong>'+cardDetailEscape(diagnosis.pathology)+'</strong><small>'+cardDetailEscape(diagnosis.icd10)+'</small></div></div><div class="diagnosis-evidence"><span><strong>规范化结果：</strong>'+cardDetailEscape(diagnosis.diagnosis)+' · '+cardDetailEscape(diagnosis.stage)+' · '+cardDetailEscape(diagnosis.tnm)+' · 确诊 '+cardDetailEscape(diagnosis.diagnosisDate)+'</span><button class="btn btn-ghost btn-xs" onclick="openDiagnosisEvidence()">查看 '+diagnosis.evidenceCount+' 份证据报告</button></div>'}
var diagnosisNav=Array.from(document.querySelectorAll('.card-detail-nav button')).find(function(button){return button.textContent.indexOf('诊断与病理')>-1});if(diagnosisNav){var count=diagnosisNav.querySelector('.nav-count');if(count)count.remove()}
var timeline=document.getElementById('archive-timeline');if(timeline&&!timeline.querySelector('.archive-normalize-note'))timeline.querySelector('.card-detail-section-title').insertAdjacentHTML('afterend','<div class="archive-normalize-note"><strong>汇总规则：</strong>系统以患者主索引 + 事件类型 + 发生日期建立标准化诊疗事件；每条事件保留医疗机构、原始记录和来源版本，不把不同医院的数据覆盖成一条记录。</div>')
var treatment=document.getElementById('archive-treatment');if(treatment&&!treatment.querySelector('.archive-normalize-note'))treatment.querySelector('.card-detail-section-title').insertAdjacentHTML('afterend','<div class="archive-normalize-note"><strong>治疗周期规则：</strong>一次住院/门诊治疗形成一个治疗周期，跨医院或跨疗程分别建档；周期内的检验、影像和随访通过关联 ID 连接。</div>')
};

var tumorFormStyles=document.createElement('style');
tumorFormStyles.textContent='.tumor-form-block{margin-top:18px;padding-top:16px;border-top:1px solid #e6edf1}.tumor-form-block-title{font-size:13px;font-weight:700;color:#45627a;margin-bottom:11px}.tumor-form-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0 24px}.tumor-form-field{min-width:0;padding:8px 0 11px;border-bottom:1px solid #edf2f5}.tumor-form-field.wide{grid-column:span 2}.tumor-form-grid>.tumor-form-field:nth-last-child(2):nth-child(4n+1),.tumor-form-grid>.tumor-form-field:last-child:nth-child(4n+2){grid-column:span 2}.tumor-form-label{font-size:12px;color:#8295a7;margin-bottom:5px}.tumor-form-label em{font-style:normal;color:#c2413b;margin-left:3px}.tumor-form-value{font-size:13px;line-height:1.5;color:#17324d;font-weight:600;word-break:break-word}.tumor-form-value.readonly{color:#087c89}@media(max-width:1180px){.tumor-form-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:760px){.tumor-form-grid{grid-template-columns:1fr}.tumor-form-field.wide{grid-column:auto}}';
document.head.appendChild(tumorFormStyles);
function tumorFormField(label,value,required,wide,readonly){return '<div class="tumor-form-field'+(wide?' wide':'')+'"><div class="tumor-form-label">'+cardDetailEscape(label)+(required?'<em>*</em>':'')+'</div><div class="tumor-form-value'+(readonly?' readonly':'')+'">'+cardDetailValue(value)+'</div></div>'}
var canonicalDiagnosisWithTumForm=cardListDetail;
cardListDetail=function(id){
canonicalDiagnosisWithTumForm(id);
var cards=window.reportCardListData||[];var c=cards.find(function(item){return item.id===id});if(!c)return;var section=document.getElementById('archive-diagnosis');if(!section)return;
var subsite=c.site==='肺'?'上叶':c.site==='胃'?'胃窦':c.site==='肝'?'右叶':c.site==='乳房'?'左乳':'未分类';var diagnosisResult=(c.site||'')+'恶性肿瘤('+((c.icd10||'-'))+')';var detailed=(c.site||'')+'部'+(c.pathology||'')+'，分化II级，未见远处转移';
var pathologyBlock='<div class="tumor-form-block"><div class="tumor-form-grid">'+tumorFormField('发病部位（大类）',c.site,true)+tumorFormField('亚部位',subsite,true)+tumorFormField('病理类型',c.pathology,true)+tumorFormField('肿瘤解剖学部位代码 (ICD-O-3)',c.icd10||'-',true)+tumorFormField('肿瘤形态学代码 (ICD-O-3)',(c.pathology==='鳞状细胞癌'?'8070/3':c.pathology==='腺癌'?'8140/3':c.pathology==='小细胞癌'?'8041/3':c.pathology==='浸润性导管癌'||c.pathology==='导管癌'?'8500/3':'8000/3'),true)+tumorFormField('行为','/3 恶性',true)+tumorFormField('分级','II级',true)+tumorFormField('诊断依据','病理学诊断',true)+tumorFormField('临床分期','IIb期',false)+tumorFormField('TNM-T','T2',false)+tumorFormField('TNM-N','N0',false)+tumorFormField('TNM-M','M0',false)+'</div></div>';
var resultBlock='<div class="tumor-form-block"><div class="tumor-form-grid">'+tumorFormField('确诊日期',c.diagnosisDate,true)+tumorFormField('自动 ICD10',c.icd10,true,false,true)+tumorFormField('ICD10 编码',c.icd10,true)+tumorFormField('治疗信息','手术 + 化疗',false)+tumorFormField('诊断结果',diagnosisResult,true,true)+tumorFormField('详细诊断结果',detailed,false,true)+'</div></div>';
var reportBlock='<div class="tumor-form-block"><div class="tumor-form-grid">'+tumorFormField('单位区划',c.region||'南昌市东湖区',false,true)+tumorFormField('诊断单位',c.reportUnit,true)+tumorFormField('门诊号',c.outpatientNo,false)+tumorFormField('住院号',c.inpatientNo,false)+tumorFormField('报告日期',c.reportDate,true)+tumorFormField('报告医师',c.doctor,false)+'</div></div>';
section.insertAdjacentHTML('beforeend',pathologyBlock+resultBlock+reportBlock)
};

var archiveWithoutTimeline=cardListDetail;
cardListDetail=function(id){
archiveWithoutTimeline(id);
var timeline=document.getElementById('archive-timeline');if(timeline)timeline.remove();
var timelineNav=Array.from(document.querySelectorAll('.card-detail-nav button')).find(function(button){return button.dataset.section==='archive-timeline'});if(timelineNav)timelineNav.remove();
};

var archiveWithoutDiagnosis=cardListDetail;
cardListDetail=function(id){
archiveWithoutDiagnosis(id);
var diagnosisSection=document.getElementById('archive-diagnosis');if(diagnosisSection)diagnosisSection.remove();
var diagnosisNav=Array.from(document.querySelectorAll('.card-detail-nav button')).find(function(button){return button.dataset.section==='archive-diagnosis'});if(diagnosisNav)diagnosisNav.remove();
};

var archiveWithoutDiagnosisCircles=cardListDetail;
cardListDetail=function(id){
archiveWithoutDiagnosisCircles(id);
var cards=window.reportCardListData||[];var c=cards.find(function(item){return item.id===id});if(!c)return;var section=document.createElement('section');section.className='card-detail-section';section.id='archive-diagnosis';
var subsite=c.site==='肺'?'上叶':c.site==='胃'?'胃窦':c.site==='肝'?'右叶':c.site==='乳房'?'左乳':'未分类';var diagnosisResult=(c.site||'')+'恶性肿瘤('+((c.icd10||'-'))+')';var detailed=(c.site||'')+'部'+(c.pathology||'')+'，分化II级，未见远处转移';
section.innerHTML='<div class="card-detail-section-title">诊断与病理</div><div class="tumor-form-block"><div class="tumor-form-grid">'+tumorFormField('发病部位（大类）',c.site,true)+tumorFormField('亚部位',subsite,true)+tumorFormField('病理类型',c.pathology,true)+tumorFormField('肿瘤解剖学部位代码 (ICD-O-3)',c.icd10||'-',true)+tumorFormField('肿瘤形态学代码 (ICD-O-3)',(c.pathology==='鳞状细胞癌'?'8070/3':c.pathology==='腺癌'?'8140/3':c.pathology==='小细胞癌'?'8041/3':c.pathology==='浸润性导管癌'||c.pathology==='导管癌'?'8500/3':'8000/3'),true)+tumorFormField('行为','/3 恶性',true)+tumorFormField('分级','II级',true)+tumorFormField('诊断依据','病理学诊断',true)+tumorFormField('临床分期','IIb期',false)+tumorFormField('TNM-T','T2',false)+tumorFormField('TNM-N','N0',false)+tumorFormField('TNM-M','M0',false)+'</div></div><div class="tumor-form-block"><div class="tumor-form-grid">'+tumorFormField('确诊日期',c.diagnosisDate,true)+tumorFormField('自动 ICD10',c.icd10,true,false,true)+tumorFormField('ICD10 编码',c.icd10,true)+tumorFormField('治疗信息','手术 + 化疗',false)+tumorFormField('诊断结果',diagnosisResult,true,true)+tumorFormField('详细诊断结果',detailed,false,true)+'</div></div><div class="tumor-form-block"><div class="tumor-form-grid">'+tumorFormField('单位区划',c.region||'南昌市东湖区',false,true)+tumorFormField('诊断单位',c.reportUnit,true)+tumorFormField('门诊号',c.outpatientNo,false)+tumorFormField('住院号',c.inpatientNo,false)+tumorFormField('报告日期',c.reportDate,true)+tumorFormField('报告医师',c.doctor,false)+'</div></div>';
var main=document.getElementById('card-detail-main');var followResult=document.getElementById('archive-follow-result');var treatment=document.getElementById('archive-treatment');if(main)main.insertBefore(section,followResult||treatment||null);var nav=document.querySelector('.card-detail-nav');var treatmentNav=nav&&nav.querySelector('[data-section="archive-treatment"]');if(treatmentNav)treatmentNav.insertAdjacentHTML('beforebegin',cardDetailNavItem('archive-diagnosis','诊断与病理'));
};
