/* DOM 集成测试，不启动或连接浏览器。依赖 linkedom；SP_DOM_MODULE 可指定模块位置。 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {parseHTML}=require(process.env.SP_DOM_MODULE||'linkedom');
const parsed=parseHTML('<!doctype html><html><head></head><body><div id="pageContainer"></div></body></html>');
const document=parsed.document;
const RealDate=Date;
class FixedDate extends RealDate {constructor(...args){super(...(args.length?args:['2026-10-30T12:00:00+08:00']))}static now(){return new RealDate('2026-10-30T12:00:00+08:00').getTime()}}
const window={document,__SP_TEST__:true,innerWidth:1440,innerHeight:960};
const context=vm.createContext({window,document,Date:FixedDate,console,setTimeout,clearTimeout,toast(){}});
for(const name of ['portrait-transfers.js','portrait-cost.js','specialty-portrait.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,name),'utf8'),context,{filename:name});
const api=window.__SP_TEST__;
let checks=0;
function check(name,fn){fn();checks++;console.log('PASS '+name)}
function mount(){document.getElementById('pageContainer').innerHTML=window.renderSpecialtyPortrait('workbench')}
function read(){return document.getElementById('spCostPanel').textContent}
function kpi(i){return document.querySelectorAll('#spCostPanel .sp-cost-kpi .v')[i].textContent}
function sub(i){return document.querySelectorAll('#spCostPanel .sp-cost-kpi .s')[i].textContent}
mount();window._spOpenDetail('TE001');
check('费用概览保留4项核心指标并补充费用占比构成',()=>{
 assert.equal(document.querySelectorAll('.sp-profile-block').length,4);
 const html=document.querySelector('.sp-detail-shell').innerHTML;
 assert.ok(html.indexOf('id="spCostPanel"')<html.indexOf('检查检验记录'));
 assert.equal(document.querySelectorAll('.sp-cost-kpi').length,4);
 assert.deepEqual(Array.from(document.querySelectorAll('.sp-cost-kpi .k')).map(el=>el.textContent),['累计医疗费用','个人支付','次均住院费用','省外医疗费用']);
 assert.ok(read().includes('示例数据'));assert.ok(read().includes('当前瘤例累计'));
 assert.equal(kpi(0),'98,920.00元');assert.equal(kpi(1),'26,100.00元');assert.equal(sub(1),'占总费用 26.4%');
 assert.equal(kpi(2),'48,600.00元');assert.equal(kpi(3),'0.00元');assert.equal(sub(3),'占总费用 0.0%');
 const shares=Array.from(document.querySelectorAll('.sp-cost-breakdown[data-cost-breakdown=\"payment\"] .sp-cost-row-share')).map(el=>el.textContent);
 assert.deepEqual(shares,['68.4%','26.4%','5.3%']);
 assert.equal(document.querySelector('.sp-cost-ring strong').textContent,'26.4%');
 assert.ok(document.querySelector('[data-cost-breakdown=\"items\"] .sp-cost-row-track'));
 assert.deepEqual(Array.from(document.querySelectorAll('.sp-cost-breakdown-heading h4')).map(el=>el.textContent),['支付构成','费用类别构成','就诊类型费用占比','省内外费用占比']);
});
check('费用构成可视化保留，筛选、流水、分页、弹窗与导出已移除',()=>{
 const panel=document.getElementById('spCostPanel');
 assert.equal(panel.querySelectorAll('input,select,button,table,dialog,details,canvas,svg').length,0);
 assert.equal(panel.querySelectorAll('.sp-cost-ring').length,1);
 assert.equal(panel.querySelectorAll('.sp-cost-row-track').length,6);
 for(const text of ['更多筛选','结算明细','导出明细','个人账户支付','个人现金支付','点击月份','查询','重置'])assert.ok(!panel.textContent.includes(text),text);
});
check('切换瘤例自动更新费用且不会混入其他原发和共同费用',()=>{
 window._spSwitchTumor('TE001B');assert.equal(kpi(0),'36,800.00元');
 assert.equal(kpi(1),'10,040.00元');
 const e=api.tumorEvents().find(x=>x.id==='TE001B');assert.equal(api.spInstitutionChanges(e).changes.length,3);
 window._spSwitchTumor('TE001');assert.equal(kpi(0),'98,920.00元');
 assert.ok(read().includes('部分费用归属待确认'));
});
check('历史患者无需选择日期即可看到累计费用和省外费用',()=>{
 window._spOpenDetail('TE013');assert.equal(kpi(0),'58,600.00元');
 assert.equal(kpi(3),'58,600.00元');assert.equal(sub(3),'占总费用 100.0%');
 window._spOpenDetail('TE001');assert.equal(kpi(3),'0.00元');
});
check('全部14份画像、患者列表、群体总览和配置可渲染',()=>{
 for(const e of api.tumorEvents()){
  const html=api.spDetailPage(e);assert.ok(html.includes('spCostPanel'),e.id);assert.ok(!html.includes('NaN'),e.id);
 }
 window._spBackList();assert.equal(document.querySelectorAll('.sp-detail-shell').length,0);
 for(const sub of ['overview','config','workbench'])assert.ok(window.renderSpecialtyPortrait(sub).length>100);
 const aggregate=api.spAgg(api.tumorEvents());assert.equal(aggregate.metrics.referral.statisticalUnit,'患者');assert.equal(aggregate.metrics.referral.denominator,13);
});
check('治疗机构变化规则保持一致，不依赖旧转诊布尔值',()=>{
 const e=api.tumorEvents().find(x=>x.id==='TE001');e.referral=false;
 assert.equal(api.spReferralState(e),true);assert.ok(api.spTimeline(e).includes('治疗机构变化'));
 assert.ok(!api.spRefTable('TE001').includes('接诊状态'));
});
check('真实空数据不回退示例，未接入与零金额分开显示',()=>{
 mount();window._spOpenDetail('TE001');
 window.SPCost.setData({mode:'live',connected:false,updatedAt:'2026-10-30',records:[]});
 assert.ok(read().includes('未接入'));assert.equal(kpi(0),'—元');assert.ok(!read().includes('示例数据'));
 window.SPCost.setData({mode:'live',connected:true,updatedAt:'2026-10-30',records:[]});assert.equal(kpi(0),'0.00元');
 assert.equal(kpi(2),'—元');assert.ok(read().includes('暂无明确关联当前瘤例的有效结算'));
});
const owner=api.spPatientKey(api.tumorEvents()[0]);
const raw={...window.SPCost.demo().records[0],patientKey:owner};
function live(rows,updatedAt='2026-10-30'){window.SPCost.setData({mode:'live',connected:true,updatedAt,records:rows})}
check('独立费用页签显示样例费用指标与占比',()=>{
 window.SPCost.setData(window.SPCost.demo());
 api.spDomainPanel('cost');
 document.getElementById('pageContainer').innerHTML=window.renderSpecialtyPortrait('overview');
 const panel=document.querySelector('.sp-cost-overview'),values=panel.querySelectorAll('.sp-cost-overview-kpis .sp-cost-kpi .v');
 assert.equal(values.length,5);assert.ok(!panel.textContent.includes('未接入'));
 assert.ok(document.querySelector('.sp-overview-title').textContent.includes('示例数据'));
 assert.equal(document.querySelectorAll('[data-overview-field]').length,0);
 assert.ok(values[0].textContent.includes('元'));assert.ok(values[1].textContent.includes(' / 13 人'));
 assert.match(values[3].textContent,/\d+\.\d+%/);assert.match(values[4].textContent,/\d+\.\d+%/);
 assert.equal(panel.querySelectorAll('.sp-cost-overview-distributions section').length,2);
 assert.ok(panel.textContent.includes('医保基金支付'));assert.ok(panel.textContent.includes('药品费'));
 mount();window._spOpenDetail('TE001');
});
check('个人支付缺失和金额冲突时不展示不可靠的负担占比',()=>{
 live([{...raw,account:null}]);assert.equal(kpi(0),'48,600.00元');assert.equal(kpi(1),'—元');assert.equal(sub(1),'个人支付数据待补全');
 assert.ok(document.querySelector('[data-cost-breakdown=\"payment\"] .sp-cost-breakdown-empty').textContent.includes('支付构成数据待补全'));
 live([{...raw,fund:1}]);assert.equal(kpi(1),'12,580.00元');assert.equal(sub(1),'支付数据待核对');
});
check('费用类别与就诊类型占比使用当前瘤例总额为分母',()=>{
 live([{...raw,id:'INPATIENT',type:'住院',total:700,fund:490,other:0,account:70,cash:140,items:[{category:'药品费',amount:420},{category:'治疗费',amount:280}]},{...raw,id:'OUTPATIENT',type:'普通门急诊',date:'2026-03-01',total:300,fund:210,other:0,account:30,cash:60,items:[{category:'药品费',amount:300}]}]);
 const rows=document.querySelectorAll('[data-cost-breakdown=\"visits\"] .sp-cost-distribution-row');
 assert.equal(rows[0].querySelector('.sp-cost-row-share').textContent,'70.0%');assert.equal(rows[2].querySelector('.sp-cost-row-share').textContent,'30.0%');
 const drug=document.querySelector('[data-cost-breakdown=\"items\"] .sp-cost-distribution-row');
 assert.equal(drug.querySelector('.sp-cost-row-amount').textContent,'720.00元');assert.equal(drug.querySelector('.sp-cost-row-share').textContent,'72.0%');
});
check('群体总览按所选患者和瘤例聚合真实结算并更新占比',()=>{
 const events=api.tumorEvents(),first=events.find(e=>e.id==='TE001'),second=events.find(e=>e.id==='TE013');
 const firstKey=api.spPatientKey(first),secondKey=api.spPatientKey(second);
 live([{...raw,id:'OV1',patientKey:firstKey,tumorIds:[first.id],total:48600,fund:34020,other:2000,account:3580,cash:9000,items:[{category:'药品费',amount:8600},{category:'检查检验费',amount:5600},{category:'治疗费',amount:5800},{category:'手术费',amount:12000},{category:'耗材费',amount:13000},{category:'其他费用',amount:3600}]},{...raw,id:'OV2',patientKey:secondKey,tumorIds:[second.id],total:58600,fund:35160,other:3000,account:2440,cash:18000,region:'浙江省',hospitalProvinceCode:'330000',items:[{category:'药品费',amount:8000},{category:'检查检验费',amount:6600},{category:'治疗费',amount:7000},{category:'手术费',amount:16000},{category:'耗材费',amount:16000},{category:'其他费用',amount:5000}]}]);
 document.getElementById('pageContainer').innerHTML=window.renderSpecialtyPortrait('overview');
 const panel=document.querySelector('.sp-cost-overview'),values=panel.querySelectorAll('.sp-cost-overview-kpis .sp-cost-kpi .v');
 assert.equal(values[0].textContent,'107,200.00元');assert.equal(values[1].textContent,'2 / 13 人');assert.equal(values[2].textContent,'53,600.00元');
 assert.equal(values[3].textContent,'30.8%');assert.equal(values[4].textContent,'54.7%');
 assert.equal(panel.querySelectorAll('.sp-cost-overview-distributions section').length,2);
 live([{...raw,id:'OV1',patientKey:firstKey,tumorIds:[first.id],total:48600,fund:34020,other:2000,account:3580,cash:9000,items:[{category:'药品费',amount:8600},{category:'检查检验费',amount:5600},{category:'治疗费',amount:5800},{category:'手术费',amount:12000},{category:'耗材费',amount:13000},{category:'其他费用',amount:3600}]}]);
 assert.equal(panel.querySelector('.sp-cost-overview-kpis .sp-cost-kpi .v').textContent,'48,600.00元');
 assert.equal(panel.querySelectorAll('.sp-cost-overview-kpis .sp-cost-kpi .v')[1].textContent,'1 / 13 人');
 live([]);document.getElementById('pageContainer').innerHTML=window.renderSpecialtyPortrait('overview');
 assert.ok(document.querySelector('.sp-cost-overview').textContent.includes('暂无已关联的有效医保费用'));
 mount();window._spOpenDetail('TE001');
});
check('省外按机构所在地计算，地区未知时金额与占比不补零',()=>{
 live([{...raw,hospitalProvinceCode:'330000'}]);assert.equal(kpi(3),'48,600.00元');assert.equal(sub(3),'占总费用 100.0%');
 live([{...raw,region:null}]);assert.equal(kpi(3),'—元');assert.equal(sub(3),'就医地区待补全');
 assert.ok(document.querySelector('[data-cost-breakdown=\"regions\"] .sp-cost-breakdown-empty').textContent.includes('就医地区待补全'));
 live([{...raw,region:'不详',total:0,fund:0,other:0,account:0,cash:0}]);assert.equal(kpi(3),'0.00元');assert.equal(sub(3),'占总费用 —');
});
check('数据更新日期、跨患者数据隔离和缺失住院标识',()=>{
 live([raw,{...raw,id:'OTHER',patientKey:'another-patient'}]);assert.equal(kpi(0),'48,600.00元');
 live([raw],'2026-01-01');assert.equal(kpi(0),'0.00元');assert.ok(read().includes('2026-01-01'));
 live([{...raw,encounterId:null}]);assert.equal(kpi(2),'—元');assert.equal(sub(2),'住院就诊标识待补全');
});
console.log(checks+' DOM integration checks passed (no browser launched).');
