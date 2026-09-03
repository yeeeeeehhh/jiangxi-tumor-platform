// survey.js - 问卷管理模块（重构版）

// ==================== 数据 ====================
let surveyData=[
{id:1,title:'肿瘤登记工作满意度调查',desc:'针对全省各医疗机构肿瘤登记工作人员的工作满意度调查',category:'满意度调查',status:'published',questions:6,responses:128,createTime:'2026-06-10',publishTime:'2026-06-12',deadline:'2026-07-15',creator:'管理员',qList:[
{type:'single',title:'您的机构类型是？',required:true,options:['省级肿瘤登记处','市级肿瘤登记处','县级肿瘤登记处','医疗机构']},
{type:'single',title:'您从事肿瘤登记工作年限？',required:true,options:['1年以下','1-3年','3-5年','5-10年','10年以上']},
{type:'multiple',title:'您日常使用系统的哪些功能模块？',required:true,options:['报告卡登记','报告卡维护','查重管理','随访管理','数据分析']},
{type:'rating',title:'请对系统整体易用性评分',required:true,maxScore:5},
{type:'text',title:'您对系统有什么改进建议？',required:false},
{type:'single',title:'您是否愿意参加后续系统培训？',required:true,options:['愿意','不愿意','视情况而定']}
]},
{id:2,title:'随访工作流程调研问卷',desc:'了解各机构随访工作开展情况及难点',category:'工作调研',status:'published',questions:5,responses:56,createTime:'2026-06-05',publishTime:'2026-06-08',deadline:'2026-07-01',creator:'管理员',qList:[
{type:'single',title:'贵机构随访工作由哪个部门负责？',required:true,options:['肿瘤登记科','慢病科','防保科','其他']},
{type:'multiple',title:'随访方式包括哪些？',required:true,options:['电话随访','入户随访','信函随访','门诊随访']},
{type:'single',title:'年度随访完成率约为？',required:true,options:['90%以上','70%-90%','50%-70%','50%以下']},
{type:'rating',title:'随访系统操作便捷性评分',required:true,maxScore:5},
{type:'text',title:'随访工作中遇到的主要困难是什么？',required:false}
]},
{id:3,title:'系统培训需求调查',desc:'收集各机构对系统培训的需求和期望',category:'培训调查',status:'draft',questions:5,responses:0,createTime:'2026-06-20',publishTime:null,deadline:'2026-07-30',creator:'管理员',qList:[
{type:'single',title:'您是否参加过系统培训？',required:true,options:['是，参加过1次','是，参加过多次','否，未参加过']},
{type:'multiple',title:'您希望培训的内容包括？',required:true,options:['系统基础操作','报告卡录入规范','查重与数据质量管理','统计分析功能']},
{type:'single',title:'您偏好的培训方式？',required:true,options:['线上直播','线下集中','录播课程','操作手册']},
{type:'rating',title:'当前系统操作熟练度自评',required:true,maxScore:5},
{type:'text',title:'您对培训有什么其他建议？',required:false}
]},
{id:4,title:'2025年度数据上报质量评估',desc:'评估各机构年度数据上报质量',category:'质量评估',status:'closed',questions:7,responses:89,createTime:'2026-01-10',publishTime:'2026-01-15',deadline:'2026-02-28',creator:'管理员',qList:[
{type:'single',title:'贵机构2025年度上报病例数？',required:true,options:['500以下','500-1000','1000-2000','2000-5000','5000以上']},
{type:'single',title:'数据审核通过率？',required:true,options:['95%以上','90%-95%','80%-90%','80%以下']},
{type:'multiple',title:'常见数据问题包括？',required:true,options:['字段缺失','逻辑错误','编码不规范','重复报告','地址信息不准确']},
{type:'rating',title:'数据质量整体满意度',required:true,maxScore:5},
{type:'text',title:'其他需要说明的问题',required:false}
]},
{id:5,title:'死因数据对接满意度问卷',desc:'评估死因监测系统数据对接效果',category:'满意度调查',status:'published',questions:6,responses:42,createTime:'2026-06-15',publishTime:'2026-06-18',deadline:'2026-07-20',creator:'管理员',qList:[
{type:'single',title:'死因数据自动更新功能是否正常？',required:true,options:['完全正常','基本正常','偶尔异常','经常异常']},
{type:'multiple',title:'死因数据更新涉及哪些字段？',required:true,options:['死亡日期','死亡原因','死亡地点','最后接触日期','最后接触状态']},
{type:'rating',title:'死因数据匹配准确率评分',required:true,maxScore:5},
{type:'text',title:'数据对接中有何问题？',required:false}
]}
];

let surveyState={mode:'list',editingId:null,fillingId:null,filters:{keyword:'',status:'',category:''},page:1,pageSize:10};
let surveyResponseData=[];
let surveyFillAnswers={};

// ==================== 路由 ====================
function renderSurveyPage(id){
if(id==='survey-list')return surveyState.mode==='fill'?renderSurveyFill():renderSurveyList();
if(id==='survey-responses')return renderSurveyResponseList();
if(id==='survey-stats')return renderSurveyStatsList();
return renderSurveyList();
}

// ==================== 工具函数 ====================
function _surveyBtn(label,onclick,variant){
var cls='btn btn-sm btn-primary';
if(variant==='ghost')cls='btn btn-sm btn-ghost';
if(variant==='danger')cls='btn btn-sm btn-danger';
if(variant==='link')cls='btn-link';
if(variant==='export')cls='btn btn-sm btn-export';
return '<button class="'+cls+'" onclick="'+onclick+'">'+label+'</button>';
}
function _surveyStatusBadge(status){
if(status==='draft')return '<span class="badge badge-muted">草稿</span>';
if(status==='published')return '<span class="badge badge-success">已发布</span>';
return '<span class="badge badge-muted">已结束</span>';
}
function _surveyCatTag(cat){
return '<span style="display:inline-block;padding:2px 8px;background:#f0f9ff;color:#0369a1;border-radius:4px;font-size:12px">'+cat+'</span>';
}

// ==================== 问卷列表 ====================
function renderSurveyList(){
var filtered=surveyData.filter(function(s){
var match=true;
if(surveyState.filters.keyword){var kw=surveyState.filters.keyword.toLowerCase();match=match&&(s.title.toLowerCase().indexOf(kw)>=0||s.desc.toLowerCase().indexOf(kw)>=0)}
if(surveyState.filters.status)match=match&&s.status===surveyState.filters.status;
if(surveyState.filters.category)match=match&&s.category===surveyState.filters.category;
return match;
});
var cats=[];
surveyData.forEach(function(s){if(cats.indexOf(s.category)<0)cats.push(s.category)});

var rows=filtered.map(function(s){
var ops=[];
if(s.status==='draft')ops.push(_surveyBtn('发布','surveyPublish('+s.id+')','link'));
if(s.status==='published'){ops.push(_surveyBtn('结束','surveyClose('+s.id+')','link'));ops.push(_surveyBtn('链接','surveyCopyLink('+s.id+')','link'))}
ops.push(_surveyBtn('编辑','surveyEdit('+s.id+')','link'));
ops.push(_surveyBtn('预览','surveyPreview('+s.id+')','link'));
if(s.status==='published')ops.push(_surveyBtn('填写','surveyFill('+s.id+')','link'));
ops.push(_surveyBtn('删除','surveyDelete('+s.id+')','link danger'));

return '<tr>'+
'<td><input type="checkbox" style="width:14px;height:14px"></td>'+
'<td><a href="javascript:void(0)" onclick="surveyEdit('+s.id+')" style="color:#2563eb;font-weight:600">'+s.title+'</a></td>'+
'<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+s.desc+'</td>'+
'<td>'+_surveyCatTag(s.category)+'</td>'+
'<td>'+s.questions+'</td>'+
'<td>'+s.responses+'</td>'+
'<td>'+_surveyStatusBadge(s.status)+'</td>'+
'<td>'+s.createTime+'</td>'+
'<td>'+(s.publishTime||'<span style="color:#cbd5e1">-</span>')+'</td>'+
'<td>'+(s.deadline||'<span style="color:#cbd5e1">-</span>')+'</td>'+
'<td><div class="row-actions">'+ops.join('')+'</div></td>'+
'</tr>';
}).join('');

if(!filtered.length)rows='<tr><td colspan="11" class="empty-row">暂无问卷数据</td></tr>';

return '<div class="page-toolbar"><div class="page-toolbar-title"><span class="icon">\u25CF</span>问卷列表</div><div class="toolbar-actions">'+
_surveyBtn('+ 新建问卷','surveyCreate()')+
_surveyBtn('导出Excel','toast("导出中...")','export')+
'</div></div>'+
'<div class="panel"><div class="panel-body">'+
'<div class="filter-toolbar">'+
'<div class="form-group"><label>问卷标题</label><input type="text" placeholder="请输入关键词" value="'+surveyState.filters.keyword+'" oninput="surveyState.filters.keyword=this.value" onkeypress="if(event.key==="Enter")surveyQuery()"></div>'+
'<div class="form-group"><label>状态</label><select onchange="surveyState.filters.status=this.value;surveyQuery()"><option value="">全部</option><option value="draft" '+(surveyState.filters.status==='draft'?'selected':'')+'>草稿</option><option value="published" '+(surveyState.filters.status==='published'?'selected':'')+'>已发布</option><option value="closed" '+(surveyState.filters.status==='closed'?'selected':'')+'>已结束</option></select></div>'+
'<div class="form-group"><label>分类</label><select onchange="surveyState.filters.category=this.value;surveyQuery()"><option value="">全部</option>'+cats.map(function(c){return '<option value="'+c+'" '+(surveyState.filters.category===c?'selected':'')+'>'+c+'</option>'}).join('')+'</select></div>'+
'<div class="filter-actions">'+_surveyBtn('查询','surveyQuery()')+_surveyBtn('重置','surveyReset()','ghost')+'</div>'+
'</div>'+
'<div class="data-table-wrapper"><table class="data-table"><thead><tr>'+
'<th style="width:36px"><input type="checkbox" style="width:14px;height:14px" onclick="surveyToggleAll(this)"></th>'+
'<th>问卷标题</th><th>描述</th><th>分类</th><th>题目数</th><th>答卷数</th><th>状态</th><th>创建时间</th><th>发布时间</th><th>截止时间</th><th style="width:260px">操作</th>'+
'</tr></thead><tbody>'+rows+'</tbody></table></div>'+
'<div class="void-pagination"><span class="void-pagination-info">共 '+filtered.length+' 条记录</span></div>'+
'</div></div>';
}

function surveyQuery(){renderPage('survey-list')}
function surveyReset(){surveyState.filters={keyword:'',status:'',category:''};renderPage('survey-list');toast('筛选已重置')}
function surveyToggleAll(cb){document.querySelectorAll('.data-table tbody input[type=checkbox]').forEach(function(c){c.checked=cb.checked})}
function surveyCreate(){surveyState.mode='list';surveyState.editingId=null;_surveyShowEditor(null)}
function surveyEdit(id){surveyState.editingId=id;_surveyShowEditor(surveyData.find(function(s){return s.id===id}))}

function surveyPublish(id){
var s=surveyData.find(function(x){return x.id===id});
if(s){s.status='published';s.publishTime=new Date().toISOString().slice(0,10);toast('问卷「'+s.title+'」已发布');renderPage('survey-list')}
}
function surveyClose(id){
var s=surveyData.find(function(x){return x.id===id});
if(s){s.status='closed';toast('问卷「'+s.title+'」已结束');renderPage('survey-list')}
}
function surveyDelete(id){
var s=surveyData.find(function(x){return x.id===id});
if(!s)return;
var modal=document.createElement('div');modal.className='news-confirm-modal';
modal.innerHTML='<div class="news-confirm-box"><div class="news-confirm-title">确认删除</div><div class="news-confirm-body">确定要删除问卷「<strong>'+s.title+'</strong>」吗？<br>删除后数据无法恢复。</div><div class="news-confirm-actions">'+
'<button class="btn btn-ghost" onclick="this.closest(\'.news-confirm-modal\').remove()">取消</button>'+
'<button class="btn btn-danger" onclick="surveyConfirmDelete('+id+')">确认删除</button>'+
'</div></div>';
document.body.appendChild(modal);
modal.addEventListener('click',function(e){if(e.target===modal)modal.remove()});
}
function surveyConfirmDelete(id){
surveyData=surveyData.filter(function(s){return s.id!==id});
document.querySelectorAll('.news-confirm-modal').forEach(function(m){m.remove()});
renderPage('survey-list');toast('问卷已删除');
}

// ==================== 问卷编辑器（弹窗） ====================
function _surveyShowEditor(survey){
var editing=!!survey;
var ql=editing?survey.qList:[];
var title=editing?'编辑问卷':'新建问卷';

var qHtml=ql.map(function(q,i){
var typeLabel={'single':'单选题','multiple':'多选题','text':'填空题','rating':'评分题','dropdown':'下拉题'}[q.type]||q.type;
var optHtml='';
if(q.options){
optHtml='<div style="margin-top:8px;padding-left:16px;border-left:2px solid #e2e8f0">';
q.options.forEach(function(o,j){
optHtml+='<div style="padding:4px 0;color:#475569;font-size:13px">'+(q.type==='multiple'?'\u2610':'\u25CB')+' '+o+'</div>';
});
optHtml+='</div>';
}
if(q.type==='rating'){
optHtml='<div style="margin-top:8px;padding-left:16px;border-left:2px solid #e2e8f0"><div style="color:#475569;font-size:13px">'+Array.from({length:q.maxScore||5},function(_,j){return j+1}).join(' ')+' 分（满分'+(q.maxScore||5)+'分）</div></div>';
}
return '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:16px;margin-bottom:12px">'+
'<div style="display:flex;justify-content:space-between;align-items:flex-start">'+
'<div style="flex:1">'+
'<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'+
'<span style="background:#2563eb;color:#fff;width:24px;height:24px;border-radius:4px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:600">'+(i+1)+'</span>'+
'<span style="font-size:11px;color:#fff;background:'+({'single':'#3b82f6','multiple':'#8b5cf6','text':'#10b981','rating':'#f59e0b','dropdown':'#ec4899'}[q.type]||'#64748b')+';padding:2px 8px;border-radius:4px">'+typeLabel+'</span>'+
(q.required?'<span style="color:#ef4444;font-size:12px">必填</span>':'<span style="color:#94a3b8;font-size:12px">选填</span>')+
'</div>'+
'<div style="font-size:14px;font-weight:600;color:#1e293b;margin-bottom:4px">'+q.title+'</div>'+
optHtml+
'</div>'+
'<div style="display:flex;gap:4px">'+
'<button class="btn-link" onclick="surveyMoveQ('+i+',-1)" '+(i===0?'disabled style="opacity:0.4"':'')+'>上移</button>'+
'<button class="btn-link" onclick="surveyMoveQ('+i+',1)" '+(i===ql.length-1?'disabled style="opacity:0.4"':'')+'>下移</button>'+
'<button class="btn-link" onclick="surveyEditQ('+i+')">编辑</button>'+
'<button class="btn-link danger" onclick="surveyDelQ('+i+')">删除</button>'+
'</div></div></div>';
}).join('');

if(!ql.length)qHtml='<div style="text-align:center;padding:48px;color:#94a3b8"><div style="font-size:32px;margin-bottom:8px">?</div>暂无题目，请点击下方按钮添加</div>';

var modal=document.createElement('div');modal.className='news-confirm-modal';modal.style.zIndex='10001';
modal.innerHTML='<div class="news-confirm-box" style="max-width:800px;max-height:90vh;overflow-y:auto"><div class="news-confirm-title">'+title+'</div><div style="padding:20px">'+
'<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">'+
'<div class="form-group"><label>问卷标题 <span class="required">*</span></label><input type="text" id="surveyInputTitle" placeholder="请输入问卷标题" value="'+(editing?survey.title:'')+'" style="width:100%"></div>'+
'<div class="form-group"><label>问卷分类 <span class="required">*</span></label><select id="surveyInputCategory"><option value="满意度调查" '+(editing&&survey.category==='满意度调查'?'selected':'')+'>满意度调查</option><option value="工作调研" '+(editing&&survey.category==='工作调研'?'selected':'')+'>工作调研</option><option value="培训调查" '+(editing&&survey.category==='培训调查'?'selected':'')+'>培训调查</option><option value="质量评估" '+(editing&&survey.category==='质量评估'?'selected':'')+'>质量评估</option><option value="其他" '+(editing&&survey.category==='其他'?'selected':'')+'>其他</option></select></div>'+
'</div>'+
'<div class="form-group" style="margin-bottom:16px"><label>问卷描述</label><textarea id="surveyInputDesc" placeholder="请输入问卷描述" rows="2" style="width:100%">'+(editing?survey.desc:'')+'</textarea></div>'+
'<div class="form-group" style="margin-bottom:16px"><label>截止日期</label><input type="date" id="surveyInputDeadline" value="'+(editing&&survey.deadline?survey.deadline:'')+'" style="width:200px"></div>'+
'<div style="background:#f1f5f9;border-radius:6px;padding:16px;margin-bottom:16px">'+
'<div style="font-size:14px;font-weight:600;margin-bottom:12px">题目列表 <span style="float:right;font-size:13px;color:#94a3b8;font-weight:400">共 '+ql.length+' 题</span></div>'+
qHtml+
'<div style="margin-top:16px;padding-top:16px;border-top:1px solid #e2e8f0"><div style="display:flex;flex-wrap:wrap;gap:8px">'+
_surveyBtn('+ 单选题','surveyAddQ("single")','ghost')+
_surveyBtn('+ 多选题','surveyAddQ("multiple")','ghost')+
_surveyBtn('+ 填空题','surveyAddQ("text")','ghost')+
_surveyBtn('+ 评分题','surveyAddQ("rating")','ghost')+
_surveyBtn('+ 下拉题','surveyAddQ("dropdown")','ghost')+
'</div></div></div>'+
'<div style="display:flex;gap:8px;justify-content:flex-end">'+
_surveyBtn('取消','surveyCancelEditor()','ghost')+
_surveyBtn('保存','surveySaveEditor()')+
'</div></div></div>';
document.body.appendChild(modal);
modal.addEventListener('click',function(e){if(e.target===modal)modal.remove()});
}

function surveyCancelEditor(){
document.querySelectorAll('.news-confirm-modal').forEach(function(m){m.remove()});
}

function surveyGetQList(){
var s=surveyState.editingId?surveyData.find(function(x){return x.id===surveyState.editingId}):null;
return s?s.qList:[];
}
function surveySetQList(ql){
if(surveyState.editingId){var s=surveyData.find(function(x){return x.id===surveyState.editingId});if(s)s.qList=ql}
}

function surveyAddQ(type){
var defaultQ={'single':{type:'single',title:'新建单选题',required:true,options:['选项1','选项2']},'multiple':{type:'multiple',title:'新建多选题',required:true,options:['选项1','选项2']},'text':{type:'text',title:'新建填空题',required:false},'rating':{type:'rating',title:'新建评分题',required:true,maxScore:5},'dropdown':{type:'dropdown',title:'新建下拉题',required:true,options:['选项1','选项2','选项3']}}[type];
var ql=surveyGetQList();
ql.push(JSON.parse(JSON.stringify(defaultQ)));
surveySetQList(ql);
document.querySelectorAll('.news-confirm-modal').forEach(function(m){m.remove()});
_surveyShowEditor(surveyState.editingId?surveyData.find(function(x){return x.id===surveyState.editingId}):null);
}

function surveyEditQ(idx){
var ql=surveyGetQList();
var q=ql[idx];
if(!q)return;
var typeLabel={'single':'单选题','multiple':'多选题','text':'填空题','rating':'评分题','dropdown':'下拉题'}[q.type]||q.type;
var optHtml='';
if(q.options){
q.options.forEach(function(o,j){
optHtml+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><input type="text" value="'+o+'" class="survey-opt-input" data-idx="'+j+'" style="flex:1;padding:6px 8px;border:1px solid #cbd5e1;border-radius:4px;font-size:13px"><button class="btn-link danger" onclick="this.parentElement.remove()">删除</button></div>';
});
}
var ratingHtml=q.type==='rating'?'<div class="form-group"><label>最高分</label><input type="number" id="surveyQMaxScore" value="'+(q.maxScore||5)+'" min="1" max="10" style="width:80px"></div>':'';
var modal2=document.createElement('div');modal2.className='news-confirm-modal';modal2.style.zIndex='10002';
modal2.innerHTML='<div class="news-confirm-box" style="max-width:560px"><div class="news-confirm-title">编辑'+typeLabel+' <span style="font-size:13px;color:#94a3b8;font-weight:400">第'+(idx+1)+'题</span></div><div style="padding:20px">'+
'<div class="form-group"><label>题目标题 <span class="required">*</span></label><input type="text" id="surveyQTitle" value="'+q.title+'" style="width:100%;padding:8px 12px;border:1px solid #cbd5e1;border-radius:4px"></div>'+
(q.type!=='text'?'<div id="surveyOptList">'+optHtml+'<button class="btn btn-sm btn-ghost" onclick="surveyAddOpt()">+ 添加选项</button></div>':'')+
ratingHtml+
'<div class="form-group"><label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="surveyQRequired" '+(q.required?'checked':'')+' style="width:14px;height:14px">是否必填</label></div>'+
'<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">'+
_surveyBtn('取消','surveyCloseQEditor()','ghost')+
_surveyBtn('保存','surveySaveQ('+idx+')')+
'</div></div></div>';
document.body.appendChild(modal2);
modal2.addEventListener('click',function(e){if(e.target===modal2)modal2.remove()});
}
function surveyCloseQEditor(){
var mods=document.querySelectorAll('.news-confirm-modal');
if(mods.length>1)mods[mods.length-1].remove();
}
function surveyAddOpt(){
var list=document.getElementById('surveyOptList');
var div=document.createElement('div');
div.style.cssText='display:flex;align-items:center;gap:8px;margin-bottom:8px';
div.innerHTML='<input type="text" placeholder="请输入选项" class="survey-opt-input" style="flex:1;padding:6px 8px;border:1px solid #cbd5e1;border-radius:4px;font-size:13px"><button class="btn-link danger" onclick="this.parentElement.remove()">删除</button>';
list.insertBefore(div,list.querySelector('button'));
}
function surveySaveQ(idx){
var ql=surveyGetQList();
var q=ql[idx];
if(!q)return;
var t=document.getElementById('surveyQTitle').value.trim();
if(!t){toast('请输入题目标题','error');return}
q.title=t;
if(q.type!=='text'&&q.type!=='rating'){
var opts=document.querySelectorAll('.survey-opt-input');
q.options=Array.from(opts).map(function(i){return i.value.trim()}).filter(function(v){return v});
}
if(q.type==='rating'){q.maxScore=parseInt(document.getElementById('surveyQMaxScore').value)||5}
q.required=document.getElementById('surveyQRequired').checked;
surveySetQList(ql);
surveyCloseQEditor();
var mods=document.querySelectorAll('.news-confirm-modal');
if(mods.length>=1)mods[mods.length-1].remove();
if(mods.length>0)mods[0].remove();
_surveyShowEditor(surveyState.editingId?surveyData.find(function(x){return x.id===surveyState.editingId}):null);
toast('题目已保存');
}
function surveyDelQ(idx){
var ql=surveyGetQList();
ql.splice(idx,1);
surveySetQList(ql);
document.querySelectorAll('.news-confirm-modal').forEach(function(m){m.remove()});
_surveyShowEditor(surveyState.editingId?surveyData.find(function(x){return x.id===surveyState.editingId}):null);
toast('题目已删除');
}
function surveyMoveQ(idx,dir){
var ql=surveyGetQList();
var ni=idx+dir;
if(ni<0||ni>=ql.length)return;
var tmp=ql[idx];ql[idx]=ql[ni];ql[ni]=tmp;
surveySetQList(ql);
document.querySelectorAll('.news-confirm-modal').forEach(function(m){m.remove()});
_surveyShowEditor(surveyState.editingId?surveyData.find(function(x){return x.id===surveyState.editingId}):null);
}

function surveySaveEditor(){
var title=document.getElementById('surveyInputTitle').value.trim();
var desc=document.getElementById('surveyInputDesc').value.trim();
var category=document.getElementById('surveyInputCategory').value;
var deadline=document.getElementById('surveyInputDeadline').value;
if(!title){toast('请填写问卷标题','error');return}
if(!category){toast('请选择问卷分类','error');return}
var ql=surveyGetQList();
if(!ql.length){toast('请至少添加一道题目','error');return}
if(surveyState.editingId){
var s=surveyData.find(function(x){return x.id===surveyState.editingId});
if(s){s.title=title;s.desc=desc||'';s.category=category;s.deadline=deadline||'';s.qList=ql;s.questions=ql.length}
toast('问卷修改成功');
}else{
var newId=Math.max.apply(null,[0].concat(surveyData.map(function(s){return s.id})))+1;
surveyData.unshift({id:newId,title:title,desc:desc||'',category:category,status:'draft',questions:ql.length,responses:0,createTime:new Date().toISOString().slice(0,10),publishTime:null,deadline:deadline||'',creator:'管理员',qList:ql});
toast('问卷创建成功');
}
document.querySelectorAll('.news-confirm-modal').forEach(function(m){m.remove()});
renderPage('survey-list');
}

// ==================== 问卷预览 ====================
function surveyPreview(id){
var s=surveyData.find(function(x){return x.id===id});
if(!s)return;
var qHtml=s.qList.map(function(q,i){
var typeLabel={'single':'单选题','multiple':'多选题','text':'填空题','rating':'评分题','dropdown':'下拉题'}[q.type]||q.type;
var optHtml='';
if(q.type==='single'||q.type==='dropdown'){optHtml=(q.options||[]).map(function(o){return '<label style="display:block;padding:6px 0;cursor:pointer"><input type="radio" name="preview_q'+i+'" disabled style="margin-right:8px;width:12px;height:12px">'+o+'</label>'}).join('')}
if(q.type==='multiple'){optHtml=(q.options||[]).map(function(o){return '<label style="display:block;padding:6px 0;cursor:pointer"><input type="checkbox" disabled style="margin-right:8px;width:12px;height:12px">'+o+'</label>'}).join('')}
if(q.type==='text'){optHtml='<textarea disabled placeholder="请输入..." rows="3" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:4px"></textarea>'}
if(q.type==='rating'){optHtml='<div style="padding:8px 0">'+Array.from({length:q.maxScore||5},function(_,j){return '<span style="display:inline-block;width:28px;height:28px;border:1px solid #cbd5e1;border-radius:4px;text-align:center;line-height:28px;margin-right:4px;cursor:pointer;color:#94a3b8">'+(j+1)+'</span>'}).join('')+' <span style="color:#94a3b8;font-size:12px;margin-left:8px">满分'+(q.maxScore||5)+'分</span></div>'}
return '<div style="margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #f1f5f9">'+
'<div style="font-size:14px;font-weight:600;margin-bottom:8px"><span style="color:#2563eb">'+(i+1)+'.</span> '+q.title+' '+(q.required?'<span style="color:#ef4444;font-size:12px">*必填</span>':'')+' <span style="font-size:11px;color:#94a3b8;background:#f1f5f9;padding:2px 6px;border-radius:4px;margin-left:4px">'+typeLabel+'</span></div>'+
optHtml+
'</div>';
}).join('');
var modal=document.createElement('div');modal.className='news-confirm-modal';modal.style.zIndex='10001';
modal.innerHTML='<div class="news-confirm-box" style="max-width:680px;max-height:85vh;overflow-y:auto"><div class="news-confirm-title">问卷预览 - '+s.title+'</div><div style="padding:24px">'+
'<div style="background:#f0f9ff;padding:12px;border-radius:6px;margin-bottom:20px;font-size:13px;color:#475569">'+s.desc+'</div>'+
qHtml+
'<div style="display:flex;gap:8px;justify-content:flex-end">'+_surveyBtn('关闭预览','this.closest(\'.news-confirm-modal\').remove()','ghost')+'</div>'+
'</div></div>';
document.body.appendChild(modal);
modal.addEventListener('click',function(e){if(e.target===modal)modal.remove()});
}

// ==================== 问卷填写 ====================
function surveyFill(id){
var s=surveyData.find(function(x){return x.id===id});
if(!s)return;
if(s.status!=='published'){toast('该问卷未发布，无法填写','error');return}
surveyState.mode='fill';surveyState.fillingId=id;surveyFillAnswers={};
renderPage('survey-list');
}

function renderSurveyFill(){
var s=surveyData.find(function(x){return x.id===surveyState.fillingId});
if(!s){surveyState.mode='list';return renderSurveyList()}
var qHtml=s.qList.map(function(q,i){
var typeLabel={'single':'单选题','multiple':'多选题','text':'填空题','rating':'评分题','dropdown':'下拉题'}[q.type]||q.type;
var optHtml='';
if(q.type==='single'){optHtml=(q.options||[]).map(function(o,j){return '<label style="display:block;padding:8px 12px;cursor:pointer;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:6px" onmouseover="this.style.borderColor=\'#2563eb\'" onmouseout="if(!this.querySelector(\'input\').checked)this.style.borderColor=\'#e2e8f0\'"><input type="radio" name="fill_q'+i+'" value="'+j+'" style="margin-right:8px;width:14px;height:14px" onchange="surveyFillAnswers[\'q'+i+'\']=this.value">'+o+'</label>'}).join('')}
if(q.type==='dropdown'){optHtml='<select onchange="surveyFillAnswers[\'q'+i+'\']=this.value" style="width:100%;padding:8px 12px;border:1px solid #cbd5e1;border-radius:4px;font-size:13px"><option value="">请选择...</option>'+(q.options||[]).map(function(o,j){return '<option value="'+j+'">'+o+'</option>'}).join('')+'</select>'}
if(q.type==='multiple'){optHtml=(q.options||[]).map(function(o,j){return '<label style="display:block;padding:8px 12px;cursor:pointer;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:6px"><input type="checkbox" value="'+j+'" style="margin-right:8px;width:14px;height:14px" onchange="if(!surveyFillAnswers[\'q'+i+'\'])surveyFillAnswers[\'q'+i+'\']=[];if(this.checked)surveyFillAnswers[\'q'+i+'\'].push(this.value);else surveyFillAnswers[\'q'+i+'\']=surveyFillAnswers[\'q'+i+'\'].filter(function(v){return v!==this.value}.bind(this))">'+o+'</label>'}).join('')}
if(q.type==='text'){optHtml='<textarea oninput="surveyFillAnswers[\'q'+i+'\']=this.value" placeholder="请输入..." rows="3" style="width:100%;padding:8px 12px;border:1px solid #cbd5e1;border-radius:4px"></textarea>'}
if(q.type==='rating'){
var ms=q.maxScore||5;var stars='';
for(var j=0;j<ms;j++){stars+='<span onclick="surveyRateClick('+i+','+(j+1)+')" data-rate-q="'+i+'" data-rate-val="'+(j+1)+'" style="display:inline-block;width:36px;height:36px;border:1px solid #cbd5e1;border-radius:6px;text-align:center;line-height:36px;margin-right:6px;cursor:pointer;background:#f1f5f9;color:#94a3b8;font-weight:600;transition:all .15s">'+(j+1)+'</span>'}
optHtml='<div style="padding:8px 0">'+stars+' <span style="color:#94a3b8;font-size:12px;margin-left:8px">满分'+ms+'分</span></div>';
}
return '<div style="margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #f1f5f9">'+
'<div style="font-size:15px;font-weight:600;margin-bottom:12px"><span style="color:#2563eb">'+(i+1)+'.</span> '+q.title+' '+(q.required?'<span style="color:#ef4444;font-size:12px">*必填</span>':'')+' <span style="font-size:11px;color:#94a3b8;background:#f1f5f9;padding:2px 6px;border-radius:4px;margin-left:4px">'+typeLabel+'</span></div>'+
optHtml+
'</div>';
}).join('');

return '<div class="page-toolbar"><div class="page-toolbar-title"><span class="icon">\u25CF</span>'+s.title+'</div><div class="toolbar-actions">'+_surveyBtn('\u2190 返回列表','surveyFillCancel()','ghost')+'</div></div>'+
'<div style="max-width:720px;margin:0 auto"><div class="panel"><div class="panel-body">'+
'<div style="background:#f0f9ff;padding:16px;border-radius:8px;margin-bottom:24px"><div style="font-size:14px;font-weight:600;color:#0369a1;margin-bottom:4px">'+s.title+'</div><div style="font-size:13px;color:#475569">'+s.desc+'</div><div style="font-size:12px;color:#94a3b8;margin-top:8px">共 '+s.qList.length+' 题 | 截止日期：'+(s.deadline||'无')+'</div></div>'+
qHtml+
'<div style="text-align:center;padding:24px 0">'+_surveyBtn('提交问卷','surveyFillSubmit()')+'</div>'+
'</div></div></div>';
}

function surveyFillCancel(){surveyState.mode='list';surveyState.fillingId=null;renderPage('survey-list')}
function surveyRateClick(qIdx,val){
surveyFillAnswers['q'+qIdx]=val;
var stars=document.querySelectorAll('[data-rate-q="'+qIdx+'"]');
for(var k=0;k<stars.length;k++){
if(k<val){stars[k].style.background='#2563eb';stars[k].style.color='#fff'}
else{stars[k].style.background='#f1f5f9';stars[k].style.color='#94a3b8'}
}
}
function surveyFillSubmit(){
var s=surveyData.find(function(x){return x.id===surveyState.fillingId});
if(!s)return;
for(var i=0;i<s.qList.length;i++){
if(s.qList[i].required){
var ans=surveyFillAnswers['q'+i];
if(ans===undefined||ans===''||(Array.isArray(ans)&&!ans.length)){toast('第'+(i+1)+'题为必填项，请完成填写','error');return}
}
}
surveyResponseData.push({surveyId:s.id,surveyTitle:s.title,answers:JSON.parse(JSON.stringify(surveyFillAnswers)),submitTime:new Date().toISOString().slice(0,19).replace('T',' '),respondent:'当前用户'});
s.responses=(s.responses||0)+1;
toast('问卷提交成功！');
surveyState.mode='list';surveyState.fillingId=null;
renderPage('survey-list');
}

// ==================== 答卷管理 ====================
function renderSurveyResponseList(){
var surveys=surveyData.filter(function(s){return s.responses>0});
var allResp=[];
surveys.forEach(function(s){
for(var i=0;i<Math.min(s.responses,5);i++){
allResp.push({id:allResp.length+1,surveyId:s.id,surveyTitle:s.title,respondent:'用户'+(i+1),submitTime:s.publishTime?new Date(new Date(s.publishTime).getTime()+i*86400000).toISOString().slice(0,10):'',ip:'115.198.'+(50+i)+'.'+(200+i),answers:{}});
}
});
surveyResponseData.forEach(function(r,i){allResp.push(Object.assign({},r,{id:allResp.length+i+1,ip:'127.0.0.1'}))});

if(!allResp.length)return '<div class="panel"><div class="panel-body"><div class="empty-state">暂无答卷数据</div></div></div>';
var surveyOpts=surveys.map(function(s){return '<option value="'+s.id+'">'+s.title+'</option>'}).join('');

var rows=allResp.map(function(r){
return '<tr><td>'+r.id+'</td><td><a href="javascript:void(0)" onclick="surveyViewResponse('+r.id+')" style="color:#2563eb">'+r.surveyTitle+'</a></td><td>'+r.respondent+'</td><td>'+r.submitTime+'</td><td>'+(r.ip||'-')+'</td><td><span class="badge badge-success">已完成</span></td><td><div class="row-actions">'+_surveyBtn('查看','surveyViewResponse('+r.id+')','link')+_surveyBtn('删除','toast("答卷已删除")','link danger')+'</div></td></tr>';
}).join('');

return '<div class="page-toolbar"><div class="page-toolbar-title"><span class="icon">\u25CF</span>答卷管理</div><div class="toolbar-actions">'+_surveyBtn('导出Excel','toast("导出中...")','export')+'</div></div>'+
'<div class="panel"><div class="panel-body">'+
'<div class="filter-toolbar">'+
'<div class="form-group"><label>问卷</label><select><option value="">全部问卷</option>'+surveyOpts+'</select></div>'+
'<div class="form-group"><label>提交时间</label><input type="date" style="width:130px"></div>'+
'<div class="form-group search-group"><label>检索</label><input type="text" placeholder="搜索答卷人/问卷标题"></div>'+
'<div class="filter-actions">'+_surveyBtn('查询','toast("查询完成")')+_surveyBtn('重置','toast("已重置")','ghost')+'</div>'+
'</div>'+
'<div class="data-table-wrapper"><table class="data-table"><thead><tr><th>序号</th><th>问卷标题</th><th>填写人</th><th>提交时间</th><th>IP地址</th><th>状态</th><th style="width:140px">操作</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
'<div class="void-pagination"><span class="void-pagination-info">共 '+allResp.length+' 份答卷</span><div class="void-pagination-controls"><button disabled>首页</button><button disabled>\u2039</button><input type="text" value="1" readonly><button disabled>\u203A</button><button disabled>尾页</button></div></div>'+
'</div></div>';
}

function surveyViewResponse(respId){
var surveys=surveyData.filter(function(s){return s.responses>0});
var allResp=[];
surveys.forEach(function(s){
for(var i=0;i<Math.min(s.responses,5);i++){
allResp.push({id:allResp.length+1,surveyId:s.id,surveyTitle:s.title,respondent:'用户'+(i+1),submitTime:s.publishTime?new Date(new Date(s.publishTime).getTime()+i*86400000).toISOString().slice(0,10):'',ip:'115.198.'+(50+i)+'.'+(200+i),answers:{}});
}
});
surveyResponseData.forEach(function(r,i){allResp.push(Object.assign({},r,{id:allResp.length+i+1,ip:'127.0.0.1'}))});
var resp=allResp.find(function(r){return r.id===respId});
if(!resp)return;
var s=surveyData.find(function(x){return x.id===resp.surveyId});
if(!s)return;
var qHtml=s.qList.map(function(q,i){
var ans=resp.answers&&resp.answers['q'+i];
var ansHtml='';
if(ans!==undefined){
if(q.type==='single'||q.type==='dropdown'){ansHtml=q.options[ans]||'-'}
else if(q.type==='multiple'){ansHtml=ans.map(function(a){return q.options[a]}).join('、')}
else if(q.type==='rating'){ansHtml=ans+'分'}
else{ansHtml=ans}
}else{
if(s.responses>5){var ri=respId%3;if(q.type==='single'||q.type==='dropdown')ansHtml=q.options?q.options[ri%q.options.length]:'-';else if(q.type==='rating')ansHtml=(ri+3)+'分';else if(q.type==='multiple')ansHtml=q.options?q.options.slice(0,ri+1).join('、'):'-';else ansHtml='（用户填写内容）'}
else{ansHtml='<span style="color:#cbd5e1">未填写</span>'}
}
return '<tr><td style="width:40px;text-align:center;color:#2563eb;font-weight:600">'+(i+1)+'</td><td style="font-weight:600">'+q.title+'</td><td>'+ansHtml+'</td></tr>';
}).join('');
var modal=document.createElement('div');modal.className='news-confirm-modal';modal.style.zIndex='10001';
modal.innerHTML='<div class="news-confirm-box" style="max-width:680px;max-height:85vh;overflow-y:auto"><div class="news-confirm-title">答卷详情 - '+resp.surveyTitle+'</div><div style="padding:20px">'+
'<div style="display:flex;gap:24px;margin-bottom:16px;padding:12px;background:#f8fafc;border-radius:6px;font-size:13px"><span><strong>填写人：</strong>'+resp.respondent+'</span><span><strong>提交时间：</strong>'+resp.submitTime+'</span><span><strong>IP：</strong>'+(resp.ip||'-')+'</span></div>'+
'<table class="data-table"><thead><tr><th style="width:40px">序号</th><th>题目</th><th>回答</th></tr></thead><tbody>'+qHtml+'</tbody></table>'+
'<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">'+_surveyBtn('关闭','this.closest(\'.news-confirm-modal\').remove()','ghost')+'</div>'+
'</div></div>';
document.body.appendChild(modal);
modal.addEventListener('click',function(e){if(e.target===modal)modal.remove()});
}

// ==================== 统计分析 ====================
function renderSurveyStatsList(){
var surveys=surveyData.filter(function(s){return s.responses>0});
if(!surveys.length)return '<div class="panel"><div class="panel-body"><div class="empty-state">暂无统计数据</div></div></div>';
var cards=surveys.map(function(s){
return '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:20px;cursor:pointer;transition:all .15s" onmouseover="this.style.borderColor=\'#2563eb\'" onmouseout="this.style.borderColor=\'#e2e8f0\'" onclick="surveyViewStats('+s.id+')">'+
'<div style="font-size:15px;font-weight:600;color:#1e293b;margin-bottom:8px">'+s.title+'</div>'+
'<div style="font-size:13px;color:#64748b;margin-bottom:12px">'+s.desc+'</div>'+
'<div style="display:flex;gap:16px;font-size:13px"><span><span style="color:#94a3b8">题目数：</span><strong>'+s.questions+'</strong></span><span><span style="color:#94a3b8">答卷数：</span><strong style="color:#2563eb">'+s.responses+'</strong></span><span><span style="color:#94a3b8">分类：</span>'+s.category+'</span></div></div>';
}).join('');
return '<div class="page-toolbar"><div class="page-toolbar-title"><span class="icon">\u25CF</span>统计分析</div><div class="toolbar-actions">'+_surveyBtn('导出Excel','toast("导出中...")','export')+'</div></div>'+
'<div class="panel"><div class="panel-body"><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px">'+cards+'</div></div></div>';
}

function surveyViewStats(id){
var s=surveyData.find(function(x){return x.id===id});
if(!s)return;
var total=s.responses||1;
var qHtml=s.qList.map(function(q,i){
var typeLabel={'single':'单选题','multiple':'多选题','text':'填空题','rating':'评分题','dropdown':'下拉题'}[q.type]||q.type;
var statHtml='';
if(q.type==='single'||q.type==='dropdown'){
var data=[35,28,22,15];
statHtml=(q.options||[]).map(function(o,j){
var pct=data[j%data.length];var bar=Math.round(pct*total/100);
return '<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="font-size:13px;color:#475569">'+o+'</span><span style="font-size:13px;color:#64748b">'+bar+'票 ('+pct+'%)</span></div><div style="background:#f1f5f9;border-radius:4px;height:8px;overflow:hidden"><div style="background:linear-gradient(90deg,#3b82f6,#60a5fa);height:100%;width:'+pct+'%;border-radius:4px"></div></div></div>';
}).join('');
}else if(q.type==='multiple'){
var data=[45,38,25,18,12];
statHtml=(q.options||[]).map(function(o,j){
var pct=data[j%data.length];var bar=Math.round(pct*total/100);
return '<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="font-size:13px;color:#475569">'+o+'</span><span style="font-size:13px;color:#64748b">'+bar+'票 ('+pct+'%)</span></div><div style="background:#f1f5f9;border-radius:4px;height:8px;overflow:hidden"><div style="background:linear-gradient(90deg,#8b5cf6,#a78bfa);height:100%;width:'+pct+'%;border-radius:4px"></div></div></div>';
}).join('');
}else if(q.type==='rating'){
var avg=(3.8+(i*0.2)).toFixed(1);var dist=[10,15,25,30,20];
statHtml='<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px"><span style="font-size:28px;font-weight:700;color:#f59e0b">'+avg+'</span><span style="color:#94a3b8;font-size:13px">/ '+(q.maxScore||5)+' 分</span><span style="color:#94a3b8;font-size:12px;margin-left:8px">'+total+'人评分</span></div>';
statHtml+=dist.map(function(pct,j){
return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><span style="font-size:12px;width:24px;color:#64748b">'+(j+1)+'星</span><div style="background:#f1f5f9;border-radius:4px;height:6px;flex:1;overflow:hidden"><div style="background:#f59e0b;height:100%;width:'+pct+'%;border-radius:4px"></div></div><span style="font-size:12px;width:40px;text-align:right;color:#64748b">'+pct+'%</span></div>';
}).join('');
}else if(q.type==='text'){
statHtml='<div style="color:#94a3b8;font-size:13px;padding:12px;background:#f8fafc;border-radius:6px">'+Math.round(total*0.6)+' 人填写了文字回答，点击查看详情</div>';
}
return '<div style="margin-bottom:24px;padding:16px;background:#f8fafc;border-radius:8px"><div style="font-size:14px;font-weight:600;margin-bottom:12px"><span style="color:#2563eb">'+(i+1)+'.</span> '+q.title+' <span style="font-size:11px;color:#94a3b8;background:#e2e8f0;padding:2px 6px;border-radius:4px;margin-left:4px">'+typeLabel+'</span></div>'+statHtml+'</div>';
}).join('');
var modal=document.createElement('div');modal.className='news-confirm-modal';modal.style.zIndex='10001';
modal.innerHTML='<div class="news-confirm-box" style="max-width:720px;max-height:85vh;overflow-y:auto"><div class="news-confirm-title">统计详情 - '+s.title+'</div><div style="padding:24px">'+
'<div style="display:flex;gap:24px;margin-bottom:20px;padding:16px;background:linear-gradient(135deg,#eff6ff,#dbeafe);border-radius:8px">'+
'<div style="text-align:center"><div style="font-size:24px;font-weight:700;color:#2563eb">'+s.responses+'</div><div style="font-size:12px;color:#64748b">总答卷数</div></div>'+
'<div style="text-align:center"><div style="font-size:24px;font-weight:700;color:#8b5cf6">'+s.questions+'</div><div style="font-size:12px;color:#64748b">题目数</div></div>'+
'<div style="text-align:center"><div style="font-size:24px;font-weight:700;color:#22c55e">98.5%</div><div style="font-size:12px;color:#64748b">完成率</div></div>'+
'<div style="text-align:center"><div style="font-size:24px;font-weight:700;color:#f59e0b">3.9</div><div style="font-size:12px;color:#64748b">平均评分</div></div></div>'+
qHtml+
'<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">'+_surveyBtn('导出Excel','toast("导出中...")','export')+_surveyBtn('关闭','this.closest(\'.news-confirm-modal\').remove()','ghost')+'</div>'+
'</div></div>';
document.body.appendChild(modal);
modal.addEventListener('click',function(e){if(e.target===modal)modal.remove()});
}

function surveyCopyLink(id){
var s=surveyData.find(function(x){return x.id===id});
if(!s)return;
var link='https://survey.hntumor.org.cn/q/'+id;
var ta=document.createElement('textarea');ta.value=link;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);
toast('问卷链接已复制：'+link);
}
