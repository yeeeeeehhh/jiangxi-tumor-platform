const assert = require('node:assert/strict');
const cost = require('./portrait-cost.js');
const transfers = require('./portrait-transfers.js');
let checks = 0;
function check(name, fn) { fn(); checks++; console.log('PASS '+name); }
const today='2026-10-30';
const fixture=cost.demo();
const patient=fixture.records.filter(r=>r.patientEventId==='TE001');
const normalized=cost.normalize(patient,today);
const lung=cost.scopeRows(normalized.records,'TE001');
check('静态样例的支付、项目与总额一致',()=>{
  assert.equal(normalized.issues.length,0);
  cost.normalize(fixture.records,today).records.forEach(r=>{assert.equal(r.paymentComplete,true,r.id);assert.equal(r.itemsComplete,true,r.id)});
});
check('当前瘤例费用、退款净额、次均住院口径',()=>{
  const a=cost.aggregate(lung);
  assert.equal(a.total,9892000);assert.equal(a.fund,6762000);assert.equal(a.other,520000);
  assert.equal(a.personal,2610000);assert.equal(a.admissions,1);assert.equal(a.average,4860000);
  assert.equal(a.count,6);assert.equal(lung.find(r=>r.id==='D005').refundCount,1);
});
check('当前瘤例不混入其他原发、共同、待归属及非肿瘤费用',()=>{
  const all=normalized.records;
  assert.equal(cost.aggregate(all).total,13836000);assert.equal(all.length,10);
  assert.equal(cost.scopeRows(normalized.records,'TE001B').length,1);
  assert.ok(!lung.some(r=>r.tumorIds.length!==1));
});
check('撤销、重复、退款及退款截止时间',()=>{
  assert.ok(!normalized.records.some(r=>['D010','D011'].includes(r.id)));
  assert.equal(cost.aggregate(cost.normalize(patient.concat(patient),today).records).total,13836000);
  assert.equal(cost.normalize(patient,'2026-06-20').records.find(r=>r.id==='D005').total,1096000);
  const x=patient[0];
  assert.equal(cost.normalize([x,{...x,status:'cancelled',updatedAt:today}],today).records.length,0);
});
check('不同来源以统一结算标识归并，院内编号不跨院合并',()=>{
  const x=patient[0];
  assert.equal(cost.normalize([{...x,canonicalId:'S1',source:'医保'},{...x,canonicalId:'S1',source:'医院'}],today).records.length,1);
  assert.equal(cost.normalize([x,{...x,hospital:'其他医院'}],today).records.length,2);
});
check('累计费用保留一年以前的有效结算，省外按就医机构所在地判断',()=>{
  const all=cost.normalize(fixture.records,today).records;
  const old=cost.scopeRows(all,'TE013');
  assert.equal(cost.aggregate(old).total,5860000);
  assert.equal(cost.aggregate(old).outOfProvince,5860000);
  assert.equal(cost.aggregate(lung).outOfProvince,0);
});
check('省外费用不使用参保地；地区不详不记作省内或省外',()=>{
  const x=normalized.records[0];
  assert.equal(cost.aggregate([{...x,hospitalProvinceCode:'330000',insuranceRegion:'江西省'}]).outOfProvince,x.total);
  assert.equal(cost.aggregate([{...x,hospitalProvinceCode:'36',region:'浙江省'}]).outOfProvince,0);
  for(const region of ['',null,'不详','南昌市']){
    const a=cost.aggregate([{...x,region}]);assert.equal(a.outOfProvince,null);assert.equal(a.regionMissing,1);
  }
  assert.equal(cost.aggregate([{...x,hospitalProvinceCode:'990000'}]).outOfProvince,null);
});
check('省外费用以退款后净额计算，多院就医金额不重复',()=>{
  const x=normalized.records[0];
  const rows=[x,{...x,id:'other',region:'浙江省',total:10000}];
  assert.equal(cost.aggregate(rows).outOfProvince,10000);
  const refund={...patient[0],id:'R-OUT',status:'refund',originalId:patient[0].id,total:100,fund:100,other:0,account:0,cash:0};
  const out=cost.normalize([{...patient[0],region:'浙江省'},refund],today).records;
  assert.equal(cost.aggregate(out).outOfProvince,4850000);
});
check('未知金额不能补零，支付不完整不计算占比',()=>{
  const x=cost.normalize([{...patient[0],account:null}],today).records[0];
  assert.equal(x.account,null);assert.equal(x.personal,null);assert.equal(x.paymentComplete,false);
  assert.equal(cost.aggregate([x]).personal,null);assert.equal(cost.aggregate([x]).total,4860000);
  assert.equal(cost.normalize([{...patient[0],total:-1}],today).records.length,0);
});
check('同一次住院分次结算不增加住院次数，缺少就诊号不计算次均',()=>{
  const x=normalized.records[0],y={...x,id:'extra',total:10000};
  assert.equal(cost.aggregate([x,y]).admissions,1);
  assert.equal(cost.aggregate([x,y]).average,4870000);
  assert.equal(cost.aggregate([{...x,encounterId:null}]).average,null);
  assert.equal(cost.aggregate([{...x,encounterId:null}]).admissions,null);
});
check('全额退款不计有效就诊，异常退款不进入金额统计',()=>{
  const x=patient[0],refund={...x,id:'REF',originalId:x.id,status:'refund'};
  const full=cost.normalize([x,refund],today).records;
  assert.equal(cost.aggregate(full).total,0);assert.equal(cost.aggregate(full).count,0);
  assert.equal(cost.normalize([x,{...refund,total:999999}],today).records.length,0);
});
check('退款只冲减明确匹配的费用项目，不任意分摊到同类药品',()=>{
  const x={...patient[0],items:[{category:'药品费',itemCode:'A',name:'药品A',amount:20000},{category:'药品费',itemCode:'B',name:'药品B',amount:28600}]};
  const refund={...x,id:'R',originalId:x.id,status:'refund',total:100,fund:100,other:0,account:0,cash:0,items:[{category:'药品费',itemCode:'B',amount:100}]};
  const valid=cost.normalize([x,refund],today).records[0];assert.equal(valid.items[0].amount,2000000);assert.equal(valid.items[1].amount,2850000);
  const ambiguous=cost.normalize([x,{...refund,items:[{category:'药品费',amount:100}]}],today).records[0];assert.equal(ambiguous.items,null);assert.equal(ambiguous.total,4850000);
});
check('无有效结算时没有次均分母',()=>{
  assert.equal(cost.aggregate([]).average,null);
  assert.equal(cost.aggregate([]).outOfProvince,0);
});
function tx(date,hospital,extra={}){return {date,hospital,mode:'化疗',...extra}}
check('A→A→B→B→A 保留两次变化，使用前次实际治疗作为依据',()=>{
  const result=transfers.derive([tx('2026-03-05','A'),tx('2026-03-01','A'),tx('2026-03-02','A'),tx('2026-03-03','B'),tx('2026-03-04','B')],today);
  assert.deepEqual(result.changes.map(r=>[r.from,r.to]),[['A','B'],['B','A']]);
  assert.equal(result.changes[0].previous.date,'2026-03-02');
});
check('重复治疗、机构编码和省份括注不会制造机构变化',()=>{
  const a=tx('2026-03-01','甲医院（江西省）',{hospitalCode:'H1'}),b=tx('2026-03-02','甲医院');
  const r=transfers.derive([a,a,b],today);assert.equal(r.records.length,2);assert.equal(r.changes.length,0);
  assert.equal(transfers.derive([tx('2026-03-01','甲医院（东院区）'),tx('2026-03-02','甲医院（西院区）')],today).changes.length,1);
});
check('无机构或无日期、无治疗时为未知；未来与未执行不纳入',()=>{
  assert.equal(transfers.derive([],today).state,null);
  assert.equal(transfers.derive([tx('2026-03-01','')],today).state,null);
  assert.equal(transfers.derive([tx('2026-02-30','A')],today).state,null);
  const r=transfers.derive([tx('2026-03-01','A'),tx('2027-01-01','B'),tx('2026-03-03','B',{status:'planned'})],today);
  assert.equal(r.state,false);assert.equal(r.records.length,1);
});
check('同日多机构没有时分时不伪造顺序；明确时间可生成变化',()=>{
  const r=transfers.derive([tx('2026-03-01','A'),tx('2026-03-01','B')],today);
  assert.equal(r.changes.length,0);assert.equal(r.pending.length,2);assert.equal(r.state,null);
  const timed=transfers.derive([tx('2026-03-01T14:00','B'),tx('2026-03-01T09:00','A')],today);
  assert.equal(timed.changes.length,1);assert.equal(timed.changes[0].from,'A');
});
check('机构别名共享编码不生成变化；同名不同编码保留机构区别',()=>{
  assert.equal(transfers.derive([tx('2026-03-01','甲',{hospitalCode:'H1'}),tx('2026-03-02','甲全称',{hospitalCode:'H1'})],today).changes.length,0);
  assert.equal(transfers.derive([tx('2026-03-01','甲',{hospitalCode:'H1'}),tx('2026-03-02','甲',{hospitalCode:'H2'})],today).changes.length,1);
});
console.log(`\n${checks} business-rule checks passed.`);
