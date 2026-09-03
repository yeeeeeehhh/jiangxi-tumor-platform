// ========== 交互补充函数 ==========

// 报告卡列表 - 查看详情（45 字段：发病人口信息 20 + 肿瘤报告信息 17 + 随访报告信息 8）
function cardListDetail(id){
const data=window.reportCardListData||[];
const fu=(window.reportCardFollowup||{})[id]||{};
const c=data.find(x=>x.id===id)||data[0]||{id};
function f(label,val){return '<div style="background:#f8fafc;border:1px solid #eef2f7;border-radius:8px;padding:10px 12px"><div style="font-size:12px;color:#64748b;margin-bottom:4px">'+label+'</div><div style="font-weight:600;font-size:13px;color:#1f2937;word-break:break-all">'+(val||'-')+'</div></div>'}
function s(title,html,color,n){const c=color||'var(--primary)';return '<div style="background:#fff;border:1px solid #e8eef5;border-radius:10px;box-shadow:0 1px 3px rgba(16,42,67,.05);overflow:hidden;margin-bottom:16px"><div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:'+c+'0f;border-bottom:1px solid #e8eef5"><span style="width:4px;height:18px;background:'+c+';border-radius:2px"></span><span style="font-weight:600;font-size:15px;color:#1f2937">'+title+'（'+n+'字段）</span></div><div style="padding:14px 16px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px">'+html+'</div></div>'}
const ageCalc=c.birth?Math.floor((new Date()-new Date(c.birth))/(365.25*24*3600*1000))+'岁':'-';
const cardTypeText=(c.cardType||'').replace(/<[^>]+>/g,'').trim()||'-';
const householdDet=c.household?c.household.replace(/^([^/]+\/[^/]+\/[^/]+\/[^/]+).*$/,'$1/具体门牌号'):'-';
const residenceDet=c.residence?c.residence.replace(/^([^/]+\/[^/]+\/[^/]+\/[^/]+).*$/,'$1/具体门牌号'):'-';
const subSite=c.site==='肺'?'上叶':c.site==='胃'?'胃窦':c.site==='肝'?'右叶':c.site==='乳房'?'左乳':'未分类';
const surmonth=(fu.state==='死亡'&&fu.deathda&&c.diagnosisDate)?Math.max(0,Math.round((new Date(fu.deathda)-new Date(c.diagnosisDate))/(30*24*3600*1000)))+'月':'-';
// 模块一：发病人口信息（20 字段）
const basic=f('登记编号',c.id)+f('记录类型',cardTypeText)+f('姓名',c.name)+f('其他证件','身份证')+f('身份证号码',c.idNo)+f('性别',c.sex)+f('出生日期',c.birth)+f('年龄',ageCalc)+f('联系电话',c.phone)+f('联系人关系','配偶')+f('联系人',c.name+'的家属')+f('联系人电话','13900000000')+f('民族',c.nation)+f('婚姻状况',c.marriage)+f('职业',c.job)+f('工作单位',c.workUnit)+f('户籍地址',c.household)+f('户籍详细地址',householdDet)+f('常住地址',c.residence)+f('常住详细地址',residenceDet);
// 模块二：肿瘤报告信息（17 字段）
const tumor=f('发病部位',c.site)+f('亚部位',subSite)+f('病理类型',c.pathology)+f('肿瘤解剖学部位代码 (ICD-O-3)',c.icd10||'-')+f('肿瘤形态学代码 (ICD-O-3)',c.pathology==='鳞状细胞癌'?'8070/3':c.pathology==='腺癌'?'8140/3':c.pathology==='小细胞癌'?'8041/3':'8000/3')+f('行为','/3 恶性')+f('分级','II级')+f('诊断依据','病理学诊断')+f('临床分期','IIb期')+f('TNM分期','T2N0M0')+f('确诊日期',c.diagnosisDate)+f('ICD10',c.icd10)+f('治疗信息','手术+化疗')+f('诊断结果',c.site+'恶性肿瘤('+c.icd10+')')+f('详细诊断结果',c.site+'部'+c.pathology+'，分化II级，未见远处转移')+f('住院号',c.inpatientNo)+f('门诊号',c.outpatientNo)+f('报告日期',c.reportDate)+f('报告医师',c.doctor);
// 模块三：随访报告信息（8 字段）
const follow=f('最后接触日期',fu.dlc)+f('最后接触状态',fu.state)+f('生存月数',surmonth)+f('死亡地点',fu.deadplace)+f('根本死因',fu.caus)+f('死因ICD10编码',fu.causicd)+f('死亡日期',fu.deathda)+f('死亡报告医师',fu.deadDoct);
const m=document.createElement('div');m.className='cd-overlay';m.style.zIndex='10000';
m.innerHTML='<div class="cd-dialog" style="max-width:880px;width:95vw"><div style="background:linear-gradient(135deg,#3d5a80 0%,#0b65c2 100%);padding:18px 24px;color:#fff;display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:12px;opacity:.8">报告卡详情</div><div style="font-size:19px;font-weight:700;margin-top:2px">'+(c.name||'')+' <span style="opacity:.85;font-size:14px;font-weight:500">'+id+'</span></div></div><div style="display:flex;align-items:center;gap:10px">'+(c.cardType||'')+'<span style="cursor:pointer;color:#fff;font-size:22px;line-height:1" onclick="this.closest(\'.cd-overlay\').remove()">×</span></div></div><div style="padding:18px 20px;overflow-y:auto;max-height:72vh;background:#f5f7fa">'+s('发病人口信息',basic,'#3d5a80',20)+s('肿瘤报告信息',tumor,'#0b65c2',17)+s('随访报告信息',follow,'#c44569',8)+'</div><div style="padding:14px 24px;border-top:1px solid #e2e8f0;display:flex;justify-content:flex-end;gap:8px;background:#fff"><span style="color:#64748b;font-size:12px;margin-right:auto;align-self:center">共 45 字段（发病人口信息 20 + 肿瘤报告信息 17 + 随访报告信息 8）</span><button class="btn btn-ghost btn-sm" onclick="this.closest(\'.cd-overlay\').remove()">关闭</button><button class="btn btn-primary btn-sm" onclick="this.closest(\'.cd-overlay\').remove();cardListEdit(\''+id+'\')">编辑</button></div></div>';
document.body.appendChild(m);m.addEventListener('click',e=>{if(e.target===m)m.remove()})}

// Report-card detail is a full content view, not a modal. This file loads last.
function cardListDetail(id){
const c=(window.reportCardListData||[]).find(r=>r.id===id);
if(!c){toast('未找到该报告卡','error');return}
openCardDetailDialog(c);
const overlay=document.querySelector('.cd-overlay');
const dialog=overlay&&overlay.querySelector('.cd-dialog');
if(!dialog){toast('打开报告卡详情失败','error');return}
const detailHtml=dialog.innerHTML.replaceAll('closeCardDetailDialog()','navigateTo(\'datamgmt-card\')');
overlay.remove();
document.getElementById('pageContainer').innerHTML='<div class="page-toolbar"><div class="toolbar-actions"><button class="btn btn-ghost btn-sm" onclick="navigateTo(\'datamgmt-card\')">返回报告卡列表</button></div></div><div class="panel" style="overflow:hidden"><div class="panel-body" style="padding:0">'+detailHtml+'</div></div>';
setActiveMenu('datamgmt-card');
updateBreadcrumb('datamgmt-card','报告卡详情');
window.scrollTo(0,0);
}
