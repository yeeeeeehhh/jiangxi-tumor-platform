/* ============================================================================
 * 病案首页「补充图片素材 → 文字识别 → 勾选自动填充」
 * ----------------------------------------------------------------------------
 * 纯静态原型实现。项目没有后端、没有构建、没有 CDN 依赖，因此：
 *   - 图片上传只做本地预览（URL.createObjectURL），不上传服务器；原图二进制不持久化；
 *   - 每次识别把上传图片元信息与识别原文写入 localStorage 历史，
 *     可在弹窗「历史识别记录」里回看；
 *   - 文字识别走 ocrRecognizeImages() 这一层「模拟 OCR」：按图片逐张返回
 *     {ok,text,error}，整批里某张失败只把「❌ 识别失败」标在它自己的缩略图下方，
 *     成功的几张照常拼进文本框。日后接 Tesseract.js 或后端 OCR API，只需替换这
 *     一个函数，下面的解析 / 字段匹配 / 回填逻辑完全不用改；
 *   - 识别结果文本框可编辑，方便把真实 OCR 输出粘贴进来演示。
 * 回填全部复用表单现成的 entryFill / entryFillArea / entryFillCascader 等助手，
 * 且整个过程不调用 renderPage()，避免 initEntryWizard() 把回填值重新覆盖掉。
 * ==========================================================================*/

/* ---------- 可识别的表单字段：标题别名 → 表单 label ----------
   label 必须与 renderEntryStepOne/Two/Three() 里的 <label> 文本一致
   （参见 applyEntryPrefill 的同一套映射）。step 用于结果表按步骤分组。 */
var OCR_FIELD_DEFS=[
 /* step 0 发病人口信息 */
 {label:'姓名',step:0,aliases:['患者姓名','病人姓名','患者名','姓名']},
 {label:'身份证号',step:0,aliases:['身份证号码','公民身份号码','身份证','证件号','证件号码']},
 {label:'其他证件',step:0,aliases:['证件类型','其他证件类型']},
 {label:'性别',step:0,aliases:['患者性别','性别']},
 {label:'出生日期',step:0,aliases:['出生年月','出生年月日','生日','出生时间']},
 {label:'联系电话',step:0,aliases:['电话','手机号','手机号码','本人电话','患者电话','联系电话']},
 {label:'其他证件号码',step:0,aliases:['其他证件号']},
 {label:'联系人关系',step:0,aliases:['与患者关系']},
 {label:'联系人',step:0,aliases:['联系人姓名']},
 {label:'联系人电话',step:0,aliases:['联系人手机']},
 {label:'民族',step:0,aliases:['民族']},
 {label:'婚姻状况',step:0,aliases:['婚姻','婚否']},
 {label:'职业',step:0,aliases:['职业']},
 {label:'工作单位',step:0,aliases:['单位','工作单位名称']},
 {label:'户籍地址',step:0,aliases:['户籍所在地','户籍','户口所在地'],kind:'cascader'},
 {label:'户籍详细地址',step:0,aliases:['户籍详细','户籍门牌']},
 {label:'常住地址',step:0,aliases:['现住址','现居住地','常住地'],kind:'cascader'},
 {label:'常驻详细地址',step:0,aliases:['常住详细地址','常驻详细','现住址详细']},
 /* step 1 肿瘤报告信息 */
 {label:'发病部位',step:1,aliases:['原发部位','肿瘤部位','主要部位','部位']},
 {label:'亚部位',step:1,aliases:['具体亚部位','细分部位']},
 {label:'病理类型',step:1,aliases:['病理诊断','病理结果','病理','组织学类型']},
 {label:'肿瘤位置/侧位',step:1,aliases:['侧位','肿瘤位置','左右侧']},
 {label:'行为',step:1,aliases:['肿瘤行为','行为代码']},
 {label:'分级',step:1,aliases:['分化程度','病理分级','分级']},
 {label:'诊断依据',step:1,aliases:['依据']},
 {label:'TNM分期',step:1,aliases:['TNM','临床分期'],kind:'tnm'},
 {label:'确诊日期',step:1,aliases:['诊断日期','确诊时间','首次诊断日期']},
 {label:'ICD10',step:1,aliases:['ICD-10','ICD10编码','主要诊断ICD10','疾病编码','国际疾病分类编码','主要诊断编码'],kind:'manualIcd'},
 {label:'肿瘤解剖学部位代码 (ICD-O-3)',step:1,aliases:['解剖学部位代码','ICD-O-3部位码','Topo编码'],skip:true},
 {label:'肿瘤形态学代码 (ICD-O-3)',step:1,aliases:['形态学代码','ICD-O-3形态码','Morph编码'],skip:true},
 {label:'诊断单位',step:1,aliases:['报告单位','上报医院','医疗机构','诊治医院','医院名称']},
 {label:'诊断单位区划',step:1,aliases:['报告单位区划','区划']},
 {label:'治疗信息',step:1,aliases:['治疗方式','治疗方案','治疗'],kind:'multi'},
 {label:'诊断结果',step:1,aliases:['主要诊断','出院诊断','临床诊断']},
 {label:'详细诊断结果',step:1,aliases:['诊断描述','详细诊断','出院诊断描述'],kind:'area'},
 {label:'门诊号',step:1,aliases:['门诊编号','门诊号']},
 {label:'住院号',step:1,aliases:['病案号','住院编号','住院流水号']},
 {label:'报告日期',step:1,aliases:['上报日期','填表日期'],skip:true},
 {label:'报告医师',step:1,aliases:['报告医生','医师','主治医师','填表医师']},
 {label:'手动ICD10',step:1,aliases:['手动填写ICD10','人工ICD10'],kind:'manualIcd'},
 {label:'备注',step:1,aliases:['说明','附注','备注信息'],kind:'area'},
 /* step 2 随访报告信息（label 来自 followup-death.js 的 renderFollowupReportFormFields） */
 {label:'最后接触日期',step:2,aliases:['末次接触日期','最后随访日期','随访日期']},
 {label:'最后接触状态',step:2,aliases:['随访状态','生存状态','末次接触状态']},
 {label:'失访原因',step:2,aliases:['失访','失访原因说明']},
 {label:'死亡地点',step:2,aliases:['死亡场所']},
 {label:'根本死因',step:2,aliases:['主要死因','死因']},
 {label:'死因ICD10编码',step:2,aliases:['死因ICD10','死因ICD-10','根本死因ICD10','死因编码']},
 {label:'死亡日期',step:2,aliases:['死亡时间']},
 {label:'死亡报告医师',step:2,aliases:['死亡填报医师','死亡报告医生']}
];

/* ---------- 运行时状态（不存原图，纯原型） ---------- */
var OCR={files:[],allRows:[],manualRows:[],rows:[],seq:0,busy:false,lockMode:'',runToken:0,runFiles:[],targetOptions:'',onKey:null,onGuard:null,historyId:null,historyOpen:false,historyPanel:'list',autoParseTimer:null};
var OCR_HISTORY_KEY='jx_ocr_history_v1';
var OCR_HISTORY_LIMIT=50;

function ocrEsc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
function ocrNormKey(s){return String(s==null?'':s).toLowerCase().replace(/[\s\*（）()\[\]【】·．.、,，;；:：\/\\\-_]/g,'')}
function ocrDef(label){for(var i=0;i<OCR_FIELD_DEFS.length;i++)if(OCR_FIELD_DEFS[i].label===label)return OCR_FIELD_DEFS[i];return null}

/* 标题 → 表单字段：先精确别名，再按「标题含字段名 / 字段名含标题」最长优先 */
var OCR_ALIAS_MAP=(function(){var m={};OCR_FIELD_DEFS.forEach(function(d){[d.label].concat(d.aliases||[]).forEach(function(k){var nk=ocrNormKey(k);if(nk&&!m[nk])m[nk]=d.label})});return m})();
function ocrMatchLabel(title){
 var k=ocrNormKey(title);if(!k)return '';
 if(OCR_ALIAS_MAP[k])return OCR_ALIAS_MAP[k];
 var best='',bestLen=0;
 OCR_FIELD_DEFS.forEach(function(d){var lk=ocrNormKey(d.label);if(lk.length>=2&&(k.indexOf(lk)>=0||lk.indexOf(k)>=0)&&lk.length>bestLen){best=d.label;bestLen=lk.length}});
 return best;
}

/* 日期归一化：2026/3/18、2026年3月18日、2026.3.18 → 2026-03-18（date 控件只收这种） */
function ocrNormDate(v){var s=String(v==null?'':v).trim();var m=s.match(/^(\d{4})[\/\.\-年](\d{1,2})[\/\.\-月](\d{1,2})日?$/);return m?(m[1]+'-'+('0'+m[2]).slice(-2)+'-'+('0'+m[3]).slice(-2)):s}

/* ---------- 模拟 OCR 引擎（唯一需要替换的接入点） ----------
   约定：返回「按图片逐张」的数组，某张图失败才能标在它自己的缩略图下面：
     [{ok:true, text:'这张图识别出的文字', error:''},
      {ok:false,text:'', error:'失败原因'}]
   真实接入示例：
     function ocrRecognizeImages(files){
       return Promise.all(files.map(f => Tesseract.recognize(f,'chi_sim')))
         .then(rs => rs.map(r => r.data.text).join('\n'));
     }
   或 POST 到后端 /api/ocr，后端同样每张图返回一条结果。 */
/* 演示模式下「这张图有问题」的判定：空文件 / 内容过小 / 文件名带失败标记。
   真实引擎下换成后端返回的失败原因即可。 */
function ocrMockFileFailure(f){
 if(!f)return '图片无法读取';
 var size=(typeof f.size==='number')?f.size:0;
 if(!size)return '图片为空或已损坏';
 if(size<200)return '图片内容过小，识别不到文字';
 if(/(失败|损坏|模糊|corrupt|broken|fail|error|blur)/i.test(String(f.name||'')))return '图片质量不足，未能识别出文字';
 return '';
}
/* 按图片逐张返回结果，调用方才能把某张图的失败标在它自己的缩略图下面。
   真实接入时每张图独立 try/catch：
     Promise.all(files.map(function(f){
       return Tesseract.recognize(f,'chi_sim').then(
         function(r){return {ok:true,text:r.data.text,error:''}},
         function(e){return {ok:false,text:'',error:(e&&e.message)||'识别失败'}});
     })) */
function ocrRecognizeImages(files){
 return new Promise(function(resolve){
  setTimeout(function(){
   resolve(Array.prototype.map.call(files||[],function(f){
    var why=ocrMockFileFailure(f);
    if(why)return {ok:false,text:'',error:why};
    return {ok:true,text:ocrBuildMockText([]),error:''};
   }));
  },650);
 });
}

/* 演示用识别结果：模拟一张病案首页的完整 OCR 输出。
   ③ 会按「表单未填 + 能映射到字段 + 识别值有效」过滤后展示：
     · 姓名 / 性别 / 身份证号等编辑卡里已有值的字段 → 不出现在清单；
     · 联系人、TNM、门诊号、备注等预填留空的字段 → 作为待补录项列出；
     · ICD10 / 手动ICD10 共用控件，清单里只出现一条；
     · 费别 / 病案首页编码 → 匹配不到字段，不列出；
     · 报告日期 → 系统生成，不列出；死亡报告医师 '-' → 空值，不列出。 */
function ocrBuildMockText(files){
 var c=window.editCardData||{},name=c.name||'张伟';
 var lines=[
  '姓名：'+name,
  '性别：'+(c.sex||'男'),
  '出生日期：'+(c.birth||'1965-03-12'),
  '民族：'+(c.nation||'汉族'),
  '婚姻状况：'+(c.marriage||'已婚'),
  '职业：'+(c.job||'工人'),
  '工作单位：'+(c.workUnit||'南昌第一机械厂'),
  '身份证号：'+(c.idNo||'360102196503121234'),
  '联系电话：13800138000',
  '户籍地址：江西省/南昌市/东湖区/董家窑街道',
  '户籍详细地址：董家窑街道5号3单元201',
  '常住地址：江西省/南昌市/东湖区/阳明路',
  '常驻详细地址：阳明路128号民巷社区6栋',
  '联系人关系：配偶',
  '联系人：'+name+'家属',
  '联系人电话：13900000000',
  '发病部位：肺',
  '病理类型：鳞状细胞癌',
  '行为：/3 恶性原发',
  '分级：II级',
  '诊断依据：病理学诊断',
  'TNM分期：cTNM T2N0M0',
  '确诊日期：2026/03/18',
  'ICD10：C34.1',
  '诊断单位：江西省肿瘤医院',
  '诊断单位区划：江西省/南昌市/东湖区',
  '治疗信息：手术治疗+化学治疗',
  '诊断结果：左肺上叶恶性肿瘤',
  '详细诊断结果：左肺上叶鳞状细胞癌，中分化，未见远处转移',
  '门诊号：MZ240501',
  '住院号：ZY240088',
  '报告日期：2026-06-15',
  '报告医师：陈医生',
  '手动ICD10：C34.1',
  '备注：病案首页图片识别补录，请核对原始材料',
  '最后接触日期：2026-06-01',
  '最后接触状态：存活',
  '死亡报告医师：-',
  '费别：城镇职工医保',
  '病案首页编码：BA20260318'
 ];
 if(files.length)return '# 识别素材：'+files.map(function(f){return f.name||'图片'}).join('、')+'\n'+lines.join('\n');
 return lines.join('\n');
}

/* ---------- 「标题：值」文本解析 ---------- */
function ocrParseText(text){
 var lines=String(text||'').split(/\r?\n/),out=[];
 lines.forEach(function(line){
  var s=line.replace(/\t/g,' ').trim();
  if(!s||s.charAt(0)==='#')return;
  /* 一行里出现多组「标题：值」时，在「值 空格 标题：」处切开 */
  var segs=s.split(/\s+(?=[^\s：:]{2,12}\s*[:：])/);
  segs.forEach(function(seg){
   seg=seg.trim();if(!seg)return;
   var m=seg.match(/^(.+?)\s*[:：]\s*(.+)$/);
   if(!m){var sp=seg.match(/^(\S+)\s+(.+)$/);if(sp&&ocrMatchLabel(sp[1]))m=sp}
   if(!m)return;
   var title=m[1].trim().replace(/[:：\s]+$/,''),value=m[2].trim();
   if(title)out.push({title:title,value:value});
  });
 });
 return out;
}

/* ---------- 历史识别记录（localStorage：图片元信息 + 识别结果） ---------- */
function ocrHistoryAll(){
 try{var v=JSON.parse(localStorage.getItem(OCR_HISTORY_KEY)||'[]');return Array.isArray(v)?v:[]}catch(e){return []}
}
function ocrHistorySave(list){
 try{localStorage.setItem(OCR_HISTORY_KEY,JSON.stringify(list));return true}catch(e){return false}
}
function ocrHistoryFiles(){
 return (OCR.files||[]).map(function(f){
  return {name:f.name||'图片',type:(f.file&&f.file.type)||'',size:(f.file&&f.file.size)||0};
 });
}
function ocrHistoryAdd(text){
 var list=ocrHistoryAll();
 /* 只记录：上传了哪些图片 + 识别出了什么（原文、解析结果） */
 var rec={id:'ocr_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),at:new Date().toISOString(),files:ocrHistoryFiles(),text:String(text||'')};
 list.unshift(rec);
 if(list.length>OCR_HISTORY_LIMIT)list.length=OCR_HISTORY_LIMIT;
 if(!ocrHistorySave(list))return '';
 OCR.historyId=rec.id;
 return rec.id;
}
function ocrHistoryFind(id){var list=ocrHistoryAll();for(var i=0;i<list.length;i++)if(list[i].id===id)return list[i];return null}
function ocrHistoryTime(iso){
 if(!iso)return '时间未记录';
 var d=new Date(iso);if(isNaN(d.getTime()))return String(iso);
 function p(n){return n<10?'0'+n:''+n}
 return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes());
}
/* 追加图片 / 重新识别时，保留用户尚未填充的 ③ 手工编辑值 */
function ocrPendingEdits(){
 var edits={};
 (OCR.rows||[]).forEach(function(r){if(r.edited&&r.target)edits[ocrTargetKey(r.target)]=r.value});
 return edits;
}

/* ---------- 表单可补录字段 ---------- */
/* 以当前 DOM 为准，三个 Tab 一起检查：非当前 Tab 只是折叠，仍属于表单字段；
   被业务联动内联隐藏的字段组（如「其他证件号码」、非死亡时的死亡字段）不算。 */
function ocrIsPlaceholderText(t){
 var s=String(t==null?'':t).trim();
 return !s||(typeof entryPlaceholder==='function'&&entryPlaceholder(s))||/^请选择/.test(s)||/^选择/.test(s);
}
function ocrIsEmptyValue(v){var s=String(v==null?'':v).trim();return !s||s==='-'||ocrIsPlaceholderText(s)}
function ocrIsHiddenField(label){
 var g=typeof entryGroupOf==='function'?entryGroupOf(label):null;
 if(!g)return true;
 for(var n=g;n&&n!==document.body;n=n.parentElement){if(n.style&&n.style.display==='none')return true}
 return false;
}
/* ICD10 与「手动ICD10」共用同一个输入框，统一归一到 ICD10，避免重复补录 */
function ocrCanonicalTarget(label){
 if(!label)return '';
 var d=ocrDef(label);
 return (label==='ICD10'||(d&&d.kind==='manualIcd'))?'ICD10':label;
}
function ocrTargetKey(label){return ocrCanonicalTarget(label)}
function ocrIsEmptyField(label){
 var d=ocrDef(label);
 if(d&&d.skip)return false;
 if(ocrIsHiddenField(label))return false;
 if(label==='ICD10'||(d&&d.kind==='manualIcd')){
  return ocrIsEmptyValue(ocrCurrentValue('手动ICD10'))&&ocrIsEmptyValue(ocrCurrentValue('ICD10'));
 }
 if(d&&d.kind==='multi'&&!document.getElementById('treatment-ms'))return false;
 return ocrIsEmptyValue(ocrCurrentValue(label));
}
function ocrIsMappableField(label){
 var d=ocrDef(label);
 return !!d&&!d.skip&&!ocrIsHiddenField(label)&&ocrIsEmptyField(label);
}
/* 手动改投下拉：只列当前仍为空、可回填的字段；共用控件只保留一个入口 */
function ocrMappableFields(){
 var seen={},out=[];
 OCR_FIELD_DEFS.forEach(function(d){
  var label=ocrCanonicalTarget(d.label);
  if(seen[label])return;
  if(!ocrIsMappableField(label))return;
  seen[label]=1;out.push(label);
 });
 return out;
}

/* ---------- 读取表单当前值 ---------- */
function ocrCurrentValue(label){
 var d=ocrDef(label);
 if(label==='ICD10'){var el=entryControlOf('ICD10');return el?(el.value||''):''}
 if(d&&d.kind==='manualIcd'){var mi=document.getElementById('entry-manual-icd10');return mi?(mi.value||''):''}
 if(label==='治疗信息'||(d&&d.kind==='multi')){var dd=document.getElementById('treatment-ms');if(!dd)return '';var picks=[];dd.querySelectorAll('.ms-options input[type=checkbox]').forEach(function(b){if(b.checked)picks.push(b.value)});return picks.join(', ')}
 if(d&&d.kind==='cascader'){var g=entryGroupOf(label);if(!g)return '';var parts=[];g.querySelectorAll('select').forEach(function(sel){var o=sel.options[sel.selectedIndex],t=o?o.text.trim():'';if(t&&!entryPlaceholder(t))parts.push(t)});return parts.join('/')}
 var c=entryControlOf(label);if(!c)return '';
 if(c.tagName==='SELECT'){var op=c.options[c.selectedIndex],t2=op?op.text.trim():'';return (t2&&!entryPlaceholder(t2))?t2:''}
 return c.value||'';
}

/* ---------- 单个字段回填 ---------- */
/* ---------- 单个字段回填 ----------
   返回结果码而不是 true/false，「自动填充」才能给出逐项原因：
     ok / skip（系统生成）/ empty / noControl / invalid / optionMissing */
function ocrFillOne(label,value){
 var d=ocrDef(label);
 if(d&&d.skip)return 'skip';                      /* ICD-O-3 / 报告日期为系统生成，不覆盖 */
 var v=ocrNormDate(value);
 if(!v||v==='-')return 'empty';

 /* ICD10 是 readonly，改走「手动ICD10」并由它联动带出 ICD-O-3 */
 if(label==='ICD10'||(d&&d.kind==='manualIcd')){
  var mi=document.getElementById('entry-manual-icd10');if(!mi)return 'noControl';
  mi.value=v;if(typeof applyManualIcd10==='function')applyManualIcd10(mi);return 'ok';
 }
 /* 多组级联 select */
 if(d&&d.kind==='cascader'){
  if(!entryGroupOf(label))return 'noControl';
  return entryFillCascader(label,v)?'ok':'invalid';
 }
 /* 治疗信息多选 */
 if(label==='治疗信息'||(d&&d.kind==='multi'))
  return entryFillMulti('treatment-ms',v.split(/[+＋、,，;；\/]/))?'ok':'optionMissing';
 /* TNM 三联动 select */
 if(d&&d.kind==='tnm'){
  var row=document.querySelector('.entry-form-panel .tnm-row');if(!row)return 'noControl';
  var sels=row.querySelectorAll('select'),ok=false;
  var th=v.match(/[cp]TNM/i),nh=v.match(/N[0-9X]/i),mh=v.match(/M[0-9X]/i);
  if(sels[0]&&th)ok=entryPickOption(sels[0],th[0])||ok;
  if(sels[1]&&nh)ok=entryPickOption(sels[1],nh[0].toUpperCase())||ok;
  if(sels[2]&&mh)ok=entryPickOption(sels[2],mh[0].toUpperCase())||ok;
  return ok?'ok':'invalid';
 }
 /* textarea 字段 */
 if(d&&d.kind==='area'){
  var ag=entryGroupOf(label);
  if(!ag||!ag.querySelector('textarea'))return 'noControl';
  return entryFillArea(label,v)?'ok':'invalid';
 }
 /* 「肺上叶」这类 OCR 值：拆成 发病部位 + 亚部位 */
 if(label==='发病部位'&&typeof entrySplitSite==='function'){
  var sp=entrySplitSite(v),ok1=entryFill('发病部位',sp.base);
  if(sp.sub)entryFill('亚部位',sp.sub);
  if(ok1)return 'ok';
  return entryControlOf('发病部位')?'invalid':'noControl';
 }
 var done=entryFill(label,v);
 if(done){
  /* 下拉联动：证件类型、随访状态、诊断单位外省输入 */
  if(label==='其他证件'){var cs=document.getElementById('otherCertType');if(cs&&typeof toggleOtherCertInput==='function')toggleOtherCertInput(cs)}
  if(label==='最后接触状态'&&typeof toggleFollowupFormFields==='function')toggleFollowupFormFields('cardFu');
  if(label==='诊断单位'){var du=document.getElementById('entry-diag-unit');if(du&&typeof entryDiagUnitChange==='function')entryDiagUnitChange(du)}
  return 'ok';
 }
 return entryControlOf(label)?'invalid':'noControl';
}

/* ---------- ③ 待补录清单 ----------
   allRows 保存完整解析结果；rows 只包含「表单未填充 + 有识别值 + 可映射到控件」的项。
   已填字段、未匹配标题、空值、系统生成字段都不进入 ③。 */
function ocrRefreshRows(){
 var seen={};
 /* 手动新增行始终置顶；空值是待用户填写的状态，不应被过滤掉。
    「有结论但不是已填充」的行（该值已存在 / 未覆盖 / 冲突 / 无法写入）也留着，
    否则自动填充刚给出的原因会随行一起消失，用户什么也看不到。 */
 var keepDeclined=function(r){return r&&r.result&&r.result!=='ok'};
 var manual=(OCR.manualRows||[]).filter(function(r){
  return r&&r.target&&(ocrIsMappableField(r.target)||keepDeclined(r));
 });
 /* 同一控件只保留一条；但「同一字段不同取值」不能静默丢掉 —— 那是冲突，要让人看见 */
 var auto=OCR.allRows.filter(function(r){
  if(ocrIsEmptyValue(r.value)||!r.target)return false;
  if(!ocrIsMappableField(r.target)&&!keepDeclined(r))return false;
  var pk=ocrTargetKey(r.target)+'\u0000'+ocrValueKey(r.target,r.norm||r.value);
  if(seen[pk])return false;
  seen[pk]=1;return true;
 });
 /* 手动行与自动行指向同一字段时：取值相同则自动行让位，取值不同则两条都留，标冲突 */
 OCR.rows=manual.concat(auto.filter(function(r){
  var rkey=ocrTargetKey(r.target),rval=ocrValueKey(r.target,r.norm||r.value);
  return !manual.some(function(m){
   return ocrTargetKey(m.target)===rkey&&ocrValueKey(m.target,m.norm||m.value)===rval;
  });
 }));
 OCR.rows.forEach(function(r){r.current=''});
 ocrMarkConflicts();
}
/* 同一字段出现多组不同取值：清单里直接写明原因，不替用户挑一个，也不把不同值叠写进表单 */
function ocrMarkConflicts(){
 var groups={},order=[];
 OCR.rows.forEach(function(r){
  /* 只重置上一次的冲突结论，其余结果（已填充 / 无效等）保留 */
  if(r.result==='conflict'){r.result='';r.resultNote=''}
  /* 只看勾选的行：取消勾选其中一条，就等于用户自己选定了剩下这条 */
  if(!r.checked||!r.target||ocrIsEmptyValue(r.norm||r.value))return;
  var k=ocrTargetKey(r.target);
  if(!groups[k]){groups[k]=[];order.push(k)}
  groups[k].push(r);
 });
 order.forEach(function(k){
  var g=groups[k],pairs={},vals=[];
  g.forEach(function(r){
   var v=String(r.norm||r.value||'').trim(),vk=ocrValueKey(k,v);
   if(pairs[vk])return;
   pairs[vk]=1;vals.push(v||'（空）');
  });
  if(vals.length<2)return;
  g.forEach(function(r){
   r.result='conflict';
   r.resultNote='同一字段出现 '+vals.length+' 组不同取值：'+vals.join(' / ')+
    '；系统不自动挑选、也不会叠写，请删除多余的行、改投其他字段，或统一成同一个值';
  });
 });
}
function ocrAddManualRow(){
 var fields=ocrMappableFields(),used={};
 (OCR.manualRows||[]).forEach(function(r){if(r&&r.target)used[ocrTargetKey(r.target)]=1});
 /* 允许复用自动识别行占用的空字段；手动行置顶，自动行让位 */
 var first=fields.filter(function(label){return !used[ocrTargetKey(label)]})[0]||fields[0]||'';
 if(!first)return;
 var row={id:++OCR.seq,title:'',value:'',target:first,checked:true,edited:true,manual:true};
 OCR.manualRows.unshift(row);
 ocrRefreshRows();
 ocrRenderResult();
 var box=document.getElementById('ocrResult');
 if(box){var input=box.querySelector('.ocr-row-manual .ocr-value-input');if(input)input.focus()}
}
function ocrBuildTargetOptions(){
 var fields=ocrMappableFields();
 return [[0,'发病人口信息'],[1,'肿瘤报告信息'],[2,'随访报告信息']].map(function(g){
  var opts=OCR_FIELD_DEFS.filter(function(d){
   return d.step===g[0]&&fields.indexOf(ocrCanonicalTarget(d.label))>=0&&ocrCanonicalTarget(d.label)===d.label;
  }).map(function(d){return '<option value="'+ocrEsc(d.label)+'">'+ocrEsc(d.label)+'</option>'}).join('');
  return opts?'<optgroup label="'+g[1]+'">'+opts+'</optgroup>':'';
 }).join('');
}

/* ---------- 规范值：取「自动填充到」那个字段自身的可选值 ----------
   识别值来自图片，写法千奇百怪（「2026/03/18」「/3 恶性原发」「cTNM T2N0M0」）；
   规范值把它收敛成表单下拉里真正存在的那个取值，再拿去回填。
   下拉项来源：目标字段控件的 options（多选/级联/TNM 分别取各自的可选值）。 */
function ocrFieldOptions(label){
 if(!label)return [];
 var d=ocrDef(label);
 if(d&&d.skip)return [];
 /* 治疗信息：多选项来自 ms-dropdown 的 checkbox */
 if(d&&d.kind==='multi'){
  var ms=document.getElementById('treatment-ms');if(!ms)return [];
  var picks=[];ms.querySelectorAll('.ms-options input[type=checkbox]').forEach(function(b){if(b.value)picks.push(b.value)});
  return picks;
 }
 /* TNM：三个联动 select 做笛卡尔组合，如「cTNM N0 M0」 */
 if(d&&d.kind==='tnm'){
  var row=document.querySelector('.entry-form-panel .tnm-row');if(!row)return [];
  var sels=row.querySelectorAll('select');if(sels.length<3)return [];
  var cols=[[],[],[]];
  for(var i=0;i<3;i++){
   sels[i].querySelectorAll('option').forEach(function(o){var t=o.text.trim();if(t&&!ocrIsPlaceholderText(t))cols[i].push(t)});
  }
  var tnm=[];cols[0].forEach(function(a){cols[1].forEach(function(b){cols[2].forEach(function(c){tnm.push(a+' '+b+' '+c)})})});
  return tnm;
 }
 /* 级联地址由多级 select 组成，拼不成一个下拉，交给识别原值兜底 */
 if(d&&d.kind==='cascader')return [];
 var c=entryControlOf(label);
 if(!c||c.tagName!=='SELECT')return [];   /* 文本框 / 日期 / 文本域：无固定取值 */
 var out=[];c.querySelectorAll('option').forEach(function(o){var t=o.text.trim();if(t&&!ocrIsPlaceholderText(t))out.push(t)});
 return out;
}
/* 比较用的归一 key：TNM 只比 类型/N/M，其余走 ocrNormKey */
function ocrValueKey(label,v){
 var d=ocrDef(label);
 if(d&&d.kind==='tnm'){
  var s=String(v==null?'':v).toUpperCase();
  var t=s.match(/[CP]TNM/),n=s.match(/N[0-9X]/),m=s.match(/M[0-9X]/);
  return [t?t[0]:'',n?n[0]:'',m?m[0]:''].join(' ').trim();
 }
 return ocrNormKey(v);
}
/* 识别值 → 规范值：精确 → 归一 key → 部位别名 → 包含匹配，都不中则保留原值 */
function ocrDefaultNorm(label,value){
 var v=ocrNormDate(String(value==null?'':value).trim());
 if(!v||v==='-')return '';
 var opts=ocrFieldOptions(label);
 if(!opts.length)return v;
 var i;
 for(i=0;i<opts.length;i++)if(opts[i]===v)return opts[i];
 var k=ocrValueKey(label,v);
 for(i=0;i<opts.length;i++)if(ocrValueKey(label,opts[i])===k)return opts[i];
 if(label==='发病部位'&&typeof entrySplitSite==='function'){
  var base=entrySplitSite(v).base;if(base)for(i=0;i<opts.length;i++)if(opts[i]===base)return opts[i];
 }
 for(i=0;i<opts.length;i++){
  var ok=ocrValueKey(label,opts[i]);
  if(ok&&k&&(ok.indexOf(k)>=0||k.indexOf(ok)>=0))return opts[i];
 }
 return v;   /* 不在规范列表：保留识别原值 */
}
function ocrNormOptionsHtml(label,value,cur){
 var opts=ocrFieldOptions(label).slice();
 var v=ocrNormDate(String(value==null?'':value).trim());
 var extra='';
 if(v&&v!=='-'&&!opts.some(function(o){return ocrValueKey(label,o)===ocrValueKey(label,v)}))extra=v;
 var html=opts.map(function(o){
  return '<option value="'+ocrEsc(o)+'">'+ocrEsc(o)+'</option>';
 }).join('');
 /* 识别值不在该字段的规范选项里：置顶保留原值并标注，避免信息丢失又不冒充规范值 */
 if(extra)html='<option value="'+ocrEsc(extra)+'">'+ocrEsc(extra)+'（原识别值）</option>'+html;
 return html||'<option value="">—</option>';
}

/* ---------- 弹窗 ---------- */
/* 全局 toast 容器 z-index 是 50，OCR 弹窗是 10000：弹窗开着时提示会被压到遮罩下面看不见。
   打开弹窗时把 toast 临时提到最上层，关闭时还原原本的行内值。 */
function ocrToastLayer(on){
 var box=document.getElementById('toastContainer');if(!box)return;
 if(on){
  if(box.getAttribute('data-ocr-z')===null)box.setAttribute('data-ocr-z',box.style.zIndex||'');
  box.style.zIndex='10060';
 }else{
  var prev=box.getAttribute('data-ocr-z');
  box.style.zIndex=(prev===null?'':prev);
  box.removeAttribute('data-ocr-z');
 }
}
function openOcrDialog(){
 if(!window.editCardId||!document.querySelector('.entry-form-panel'))return;
 closeOcrDialog();
 OCR={files:[],allRows:[],manualRows:[],rows:[],seq:0,busy:false,hasRecognized:false,runToken:0,runFiles:[],targetOptions:'',onKey:null,historyId:null,historyOpen:false,historyPanel:'list',autoParseTimer:null};
 var overlay=document.createElement('div');
 overlay.className='ocr-overlay';overlay.id='ocrOverlay';
 /* 弹窗层级高于全局 toast：把 toast 容器临时提到最上层，关闭时还原，否则提示被遮住看不到 */
 ocrToastLayer(true);
 overlay.innerHTML=
  '<div class="ocr-dialog">'+
   '<div class="ocr-header"><span class="ocr-title">补充图片素材 · 文字识别自动填充</span>'+
    '<span class="ocr-sub">编辑中：'+ocrEsc(window.editCardId)+'</span>'+
    '<button type="button" class="ocr-history-btn" onclick="ocrToggleHistory()" title="查看本机保存的识别记录">🕘 历史识别记录</button>'+
    '<span class="ocr-close" onclick="closeOcrDialog()" title="关闭">×</span></div>'+
   '<div class="ocr-lock-bar" id="ocrLockBar" hidden><span class="ocr-lock-text" id="ocrLockText"></span>'+
    '<button type="button" class="btn btn-ghost btn-sm" id="ocrStopBtn" onclick="ocrStopRecognize()">停止识别</button></div>'+
   '<div class="ocr-history" id="ocrHistory" hidden></div>'+
   '<div class="ocr-main" id="ocrMain"><div class="ocr-body">'+
    '<div class="ocr-section">'+
     '<div class="ocr-section-title">① 上传图片素材</div>'+
     '<div class="ocr-upload-zone" id="ocrDrop" onclick="document.getElementById(\'ocrFileInput\').click()">'+
      '<div class="ocr-upload-icon">🖼</div><div class="ocr-upload-text">点击选择，或把病案首页 / 检查报告图片拖到这里</div></div>'+
     '<input type="file" id="ocrFileInput" accept="image/*" multiple style="display:none" onchange="ocrPickFiles(this.files);this.value=\'\'">'+
     '<div class="ocr-thumbs" id="ocrThumbs"></div>'+
     '<div class="ocr-actions-inline"><button class="btn btn-primary btn-sm" id="ocrRunBtn" onclick="ocrRunRecognize()">开始文字识别</button>'+
       '<button class="btn btn-ghost btn-sm" id="ocrClearBtn" onclick="ocrClearAll()" title="清空图片、识别文本与待补录清单（历史记录保留）">🗑 清空</button>'+
       '<span class="ocr-hint">首次点「开始文字识别」，识别后同一按钮变为「重新识别」（丢弃手动修改，按当前图片重跑）；清空只清当前内容，历史记录保留。</span></div>'+
    '</div>'+
    '<div class="ocr-section">'+
     '<div class="ocr-section-title">② 识别文本</div>'+
     '<textarea class="ocr-text" id="ocrText" placeholder="姓名：张伟&#10;性别：男&#10;确诊日期：2026/03/18&#10;ICD10：C34.1" oninput="ocrTextAutoParse()"></textarea>'+
    '</div>'+
    '<div class="ocr-section">'+
     '<div class="ocr-section-title">③ 待补录字段 <span class="ocr-count-pill" id="ocrCounts">待补录 <b>0</b> 项</span>'+
      '<span class="ocr-mini-actions"><button class="btn btn-outline btn-xs" onclick="ocrAddManualRow()">＋ 增加一行</button>'+
      '<button class="btn btn-ghost btn-xs" onclick="ocrToggleAll(true)">全选可填充</button>'+
      '<button class="btn btn-ghost btn-xs" onclick="ocrToggleAll(false)">全部取消</button></span></div>'+
     '<div class="ocr-fill-report" id="ocrFillReport" hidden></div>'+
     '<div id="ocrResult"></div>'+
    '</div>'+
   '</div>'+
   '<div class="ocr-footer">'+
    '<button class="btn btn-ghost ocr-close-btn" onclick="closeOcrDialog()">关闭</button>'+
    '<button class="btn btn-primary" onclick="ocrApplySelected()">自动填充所选值</button>'+
   '</div></div>'+
  '</div>';
 overlay.addEventListener('click',function(e){if(e.target===overlay)closeOcrDialog()});
 /* 锁定态用捕获阶段拦截一切点击/输入，避免 disabled 之外的键盘与拖放路径绕过 */
 ['mousedown','click','input','change','keydown','drop','dragover','dragenter'].forEach(function(ev){
  overlay.addEventListener(ev,ocrGuardEvent,true);
 });
 OCR.onGuard=ocrGuardEvent;
 document.body.appendChild(overlay);
 /* 拖拽上传 */
 var dz=document.getElementById('ocrDrop');
 ['dragenter','dragover'].forEach(function(ev){dz.addEventListener(ev,function(e){e.preventDefault();dz.classList.add('dragover')})});
 ['dragleave','drop'].forEach(function(ev){dz.addEventListener(ev,function(e){e.preventDefault();dz.classList.remove('dragover')})});
 dz.addEventListener('drop',function(e){if(e.dataTransfer)ocrPickFiles(e.dataTransfer.files)});
 OCR.onKey=function(e){
  if(e.key!=='Escape')return;
  if(OCR.lockMode==='fill'){e.preventDefault();e.stopImmediatePropagation();return}
  if(OCR.lockMode==='recognize'){e.preventDefault();e.stopImmediatePropagation();closeOcrDialog();return}
  if(OCR.historyOpen)ocrToggleHistory(false);else closeOcrDialog();
 };
 document.addEventListener('keydown',OCR.onKey);
 ocrRenderThumbs();ocrRenderResult();ocrRenderHistory();
}

function ocrGuardEvent(e){
 if(!OCR.lockMode)return;
 var t=e.target;
 var onClose=t&&t.classList&&(t.classList.contains('ocr-close')||t.classList.contains('ocr-close-btn'));
 var allowClose=e.type==='click'&&OCR.lockMode==='recognize'&&onClose;
 var allowStop=t&&t.id==='ocrStopBtn'&&OCR.lockMode==='recognize';
 if(allowClose||allowStop)return;
 e.preventDefault();e.stopImmediatePropagation();
}
function ocrSetLock(mode){
 OCR.lockMode=mode||'';
 var dlg=document.querySelector('#ocrOverlay .ocr-dialog');if(!dlg)return;
 dlg.classList.toggle('ocr-dialog-locked',!!OCR.lockMode);
 var bar=document.getElementById('ocrLockBar'),text=document.getElementById('ocrLockText'),stop=document.getElementById('ocrStopBtn');
 if(bar){
  bar.hidden=!OCR.lockMode;
  if(OCR.lockMode==='recognize')bar.classList.remove('ocr-lock-fill');
  else if(OCR.lockMode==='fill')bar.classList.add('ocr-lock-fill');
 }
 if(text)text.textContent=OCR.lockMode==='recognize'?'正在识别，停止后可继续操作':(OCR.lockMode==='fill'?'正在自动填充':'');
 if(stop)stop.hidden=OCR.lockMode!=='recognize';
 /* 识别中：只保留「停止识别」和关闭；填充中：全部控件禁用 */
 dlg.querySelectorAll('button,input,select,textarea').forEach(function(el){
  if(el.id==='ocrStopBtn'){el.disabled=false;return}
  if(el.classList.contains('ocr-close-btn')){el.disabled=OCR.lockMode==='fill';return}
  el.disabled=!!OCR.lockMode;
 });
 dlg.querySelectorAll('.ocr-upload-zone,.ocr-thumb-del,.ocr-close').forEach(function(el){
  el.classList.toggle('ocr-locked',!!OCR.lockMode);
 });
}
function ocrStopRecognize(){
 if(OCR.lockMode!=='recognize'&&!OCR.busy)return;
 OCR.runToken++;  /* 作废在途 Promise 的回写 */
 OCR.busy=false;
 /* 停止后这批图不再有结果，把「识别中」清掉，避免停在半路的状态 */
 (OCR.runFiles||[]).forEach(function(f){if(f&&f.status==='pending')ocrSetFileStatus(f,'','')});
 OCR.runFiles=[];
 var btn=document.getElementById('ocrRunBtn');if(btn){btn.disabled=false;ocrUpdateRunBtn()}
 ocrSetLock('');ocrRenderThumbs();
}
function closeOcrDialog(){
 if(OCR.lockMode==='fill')return;  /* 自动填充期间不允许关闭 */
 if(OCR.lockMode==='recognize')ocrStopRecognize();  /* 关闭即停止识别 */
 var o=document.getElementById('ocrOverlay');if(o)o.remove();
 (OCR.files||[]).forEach(function(f){if(f.url)URL.revokeObjectURL(f.url)});
 if(OCR.onKey){document.removeEventListener('keydown',OCR.onKey);OCR.onKey=null}
 if(OCR.autoParseTimer){clearTimeout(OCR.autoParseTimer);OCR.autoParseTimer=null}
 OCR.runToken++;
 OCR.files=[];OCR.runFiles=[];OCR.busy=false;OCR.lockMode='';OCR.historyOpen=false;
 ocrToastLayer(false);
}

/* ---------- 历史识别记录面板 ---------- */
function ocrToggleHistory(force){
 if(OCR.lockMode)return;
 OCR.historyOpen=(force===undefined)?!OCR.historyOpen:!!force;
 var panel=document.getElementById('ocrHistory'),main=document.getElementById('ocrMain'),dlg=document.querySelector('#ocrOverlay .ocr-dialog');
 if(panel)panel.hidden=!OCR.historyOpen;
 if(main)main.hidden=OCR.historyOpen;
 if(dlg)dlg.classList.toggle('ocr-dialog-history',OCR.historyOpen);
 if(OCR.historyOpen){OCR.historyPanel='list';OCR.historyDetailId='';ocrRenderHistory()}
}
function ocrRenderHistory(){
 var panel=document.getElementById('ocrHistory');if(!panel||panel.hidden)return;
 var list=ocrHistoryAll();
 panel.innerHTML='<div class="ocr-history-head"><strong>'+(OCR.historyPanel==='detail'?'识别结果':'历史识别记录')+'</strong>'+
  '<button type="button" class="btn btn-ghost btn-xs" onclick="ocrToggleHistory(false)">返回弹窗</button></div>'+
  '<div class="ocr-history-content">'+(OCR.historyPanel==='detail'?ocrHistoryDetailHtml(list):ocrHistoryListHtml(list))+'</div>';
}
function ocrHistoryListHtml(list){
 if(!list.length)return '<div class="ocr-empty">暂无记录</div>';
 return '<div class="ocr-history-list">'+list.map(function(r){
  return '<div class="ocr-history-card">'+
   '<div class="ocr-history-card-time">'+ocrEsc(ocrHistoryTime(r.at))+'</div>'+
   ((r.files||[]).length?'<div class="ocr-history-files">图片：'+ocrEsc(r.files.map(function(f){return f.name}).join('、'))+'</div>':'')+
   '<div class="ocr-history-actions"><button type="button" class="btn btn-ghost btn-xs" onclick="ocrHistoryDetail(\''+ocrEsc(r.id)+'\')">查看识别结果</button></div></div>';
 }).join('')+'</div>';
}
function ocrHistoryDetailHtml(list){
 var r=ocrHistoryFind(OCR.historyDetailId);
 if(!r)return '<div class="ocr-empty">暂无记录</div>';
 var images=(r.files||[]).map(function(f){
  return '<div class="ocr-history-file-item">'+ocrEsc(f.name)+(f.size?('<span>'+Math.round(f.size/1024)+' KB</span>'):'')+'</div>';
 }).join('');
 return '<div class="ocr-history-detail">'+
  '<div class="ocr-history-detail-top"><button type="button" class="btn btn-ghost btn-xs" onclick="ocrHistoryBack()">← 返回列表</button>'+
   '<span class="ocr-history-card-time">'+ocrEsc(ocrHistoryTime(r.at))+'</span></div>'+
  '<div class="ocr-history-block"><div class="ocr-history-block-title">上传的图片</div>'+
   (images?'<div class="ocr-history-file-list">'+images+'</div>':'<div class="ocr-empty">未选择图片</div>')+'</div>'+
  '<div class="ocr-history-block"><div class="ocr-history-block-title">识别出的内容</div><pre class="ocr-history-pre">'+ocrEsc(r.text||'（空）')+'</pre></div>'+
  '</div>';
}
function ocrHistoryDetail(id){OCR.historyPanel='detail';OCR.historyDetailId=id;ocrRenderHistory()}
function ocrHistoryBack(){OCR.historyPanel='list';OCR.historyDetailId='';ocrRenderHistory()}

function ocrRenderThumbs(){
 var box=document.getElementById('ocrThumbs');if(!box)return;
 if(!OCR.files.length){box.innerHTML='';return}
 box.innerHTML=OCR.files.map(function(f,i){
  /* 每张图独立状态：识别失败要标在它自己的缩略图下面，不能整批一起报 */
  var st=f.status||'';
  var text=st==='fail'?'❌ 识别失败':(st==='ok'?'✓ 已识别':(st==='pending'?'识别中…':''));
  var tip=st==='fail'?('识别失败：'+(f.err||'未识别出文字')):text;
  var statusHtml=text?'<div class="ocr-thumb-status is-'+st+'" title="'+ocrEsc(tip)+'">'+ocrEsc(text)+'</div>':'';
  return '<div class="ocr-thumb'+(st==='fail'?' ocr-thumb-fail':'')+'" title="'+ocrEsc(tip||f.name)+'"><button class="ocr-thumb-del" onclick="ocrRemoveThumb('+i+')" title="移除">×</button>'+
   '<img src="'+ocrEsc(f.url)+'" alt="'+ocrEsc(f.name)+'"><div class="ocr-thumb-name" title="'+ocrEsc(f.name)+'">'+ocrEsc(f.name)+'</div>'+statusHtml+'</div>';
 }).join('');
}
function ocrPickFiles(list){
 if(OCR.busy||OCR.lockMode)return;  /* 锁定期间不接受图片变更 */
 Array.prototype.forEach.call(list||[],function(f){
  if(!/^image\//.test(f.type||'')&&!/\.(png|jpe?g|gif|webp|bmp)$/i.test(f.name||''))return;
  OCR.files.push({file:f,name:f.name||'图片',url:URL.createObjectURL(f),status:'',err:''});
 });
 ocrRenderThumbs();  /* 追加图片只更新素材预览，不动 ② 文本与 ③ 已编辑值 */
}
function ocrRemoveThumb(i){if(OCR.busy||OCR.lockMode)return;var f=OCR.files[i];if(f&&f.url)URL.revokeObjectURL(f.url);OCR.files.splice(i,1);ocrRenderThumbs()}
/* 统一改某张图的识别状态；识别结果的回写只认快照里的对象，图片被移除后自然失效 */
function ocrSetFileStatus(entry,status,err){
 if(!entry)return;entry.status=status||'';entry.err=err||'';
}

function ocrUpdateRunBtn(){
 var btn=document.getElementById('ocrRunBtn');if(!btn)return;
 btn.textContent=OCR.busy?'识别中…':(OCR.hasRecognized?'↻ 重新识别':'开始文字识别');
 btn.title=OCR.hasRecognized?'丢弃手动修改，按当前图片重新识别':'按当前图片开始文字识别';
}
function ocrRunRecognize(preserveEdits){
 if(OCR.busy||OCR.lockMode)return;
 /* 一张图都没有就点识别：以前什么都不发生，看起来像按钮坏了 */
 if(!OCR.files.length){
  if(typeof toast==='function')toast('请先选择要识别的图片，再点「开始文字识别」','error');
  return;
 }
 /* 主按钮二次点击（已识别过）按「重新识别」处理：丢弃手工修改后重跑 */
 if(preserveEdits===undefined&&OCR.hasRecognized)return ocrRedoRecognize();
 OCR.busy=true;
 var btn=document.getElementById('ocrRunBtn'),token=++OCR.runToken;
 /* 冻结本次参与识别的素材快照；识别期间新增/删除图片不影响这次结果 */
 OCR.runFiles=OCR.files.slice();
 var snapshot=OCR.runFiles.map(function(f){return f.file});
 /* 逐张置为「识别中」，用户能看出这批里哪几张在跑 */
 OCR.runFiles.forEach(function(f){ocrSetFileStatus(f,'pending','')});
 ocrRenderThumbs();
 ocrUpdateRunBtn();
 ocrSetLock('recognize');
 ocrRecognizeImages(snapshot).then(function(results){
  if(token!==OCR.runToken||!document.getElementById('ocrText'))return;
  /* 每张图的成败各自落到它的缩略图上；文本只拼识别成功的那几张 */
  var list=Array.isArray(results)?results:[{ok:true,text:String(results||''),error:''}];
  var texts=[],failed=[],okCount=0;
  OCR.runFiles.forEach(function(entry,i){
   var r=list[i]||{ok:false,error:'未返回识别结果'};
   var ok=(r.ok!==false)&&String(r.text||'').trim()!=='';
   if(ok){okCount++;texts.push(r.text);ocrSetFileStatus(entry,'ok','')}
   else{failed.push(entry);ocrSetFileStatus(entry,'fail',r.error||'未识别出文字')}
  });
  var ta=document.getElementById('ocrText');
  if(texts.length){
   if(ta)ta.value=texts.join('\n');
   ocrParseFromText(false,preserveEdits===false?{}:ocrPendingEdits());
   ocrHistoryAdd(ta?ta.value:'');
   OCR.hasRecognized=true;
  }
  OCR.busy=false;OCR.runFiles=[];ocrSetLock('');ocrUpdateRunBtn();
  ocrRenderThumbs();
  if(failed.length&&typeof toast==='function'){
   toast(okCount?(failed.length+' 张图片识别失败，失败标记已标在对应缩略图下方'):'全部图片识别失败，请检查图片或换一张重试','error');
  }
 }).catch(function(){
  if(token!==OCR.runToken||!document.getElementById('ocrText'))return;
  /* 整体失败（引擎异常）：所有参与本次识别的图都标失败 */
  OCR.runFiles.forEach(function(entry){ocrSetFileStatus(entry,'fail','识别服务异常')});
  OCR.busy=false;OCR.runFiles=[];ocrSetLock('');ocrUpdateRunBtn();ocrRenderThumbs();
  if(typeof toast==='function')toast('识别失败，失败标记已标在对应缩略图下方','error');
 });
}

/* 重新识别：丢弃 ② 手工改的文本、③ 手工行/手选字段/改过的识别值，
   按当前图片快照重跑 OCR，结果完全以新识别文本为准 */
function ocrRedoRecognize(){
  if(OCR.busy||OCR.lockMode)return;
  if(OCR.autoParseTimer){clearTimeout(OCR.autoParseTimer);OCR.autoParseTimer=null}
  var ta=document.getElementById('ocrText');if(ta)ta.value='';
  OCR.manualRows=[];OCR.allRows=[];OCR.rows=[];
  ocrRenderResult();
  ocrRunRecognize(false);
}
/* 清空：图片、识别文本、待补录清单全部复位；历史识别记录（localStorage）保留 */
function ocrClearAll(){
  if(OCR.busy||OCR.lockMode)return;
  if(OCR.autoParseTimer){clearTimeout(OCR.autoParseTimer);OCR.autoParseTimer=null}
  OCR.runToken++;                       /* 作废任何在途识别的回写 */
  (OCR.files||[]).forEach(function(f){if(f.url)URL.revokeObjectURL(f.url)});
  OCR.files=[];OCR.runFiles=[];
  OCR.manualRows=[];OCR.allRows=[];OCR.rows=[];
  var ta=document.getElementById('ocrText');if(ta)ta.value='';
  ocrRenderThumbs();ocrRenderResult();
  if(typeof toast==='function')toast('已清空当前图片、识别文本与待补录清单');OCR.hasRecognized=false;ocrUpdateRunBtn();
}

function ocrParseFromText(saveHistory,edits){
 var ta=document.getElementById('ocrText');if(!ta)return;
 var pairs=ocrParseText(ta.value),old=OCR.allRows,keep=edits||ocrPendingEdits();
 OCR.allRows=pairs.map(function(p){
  /* 重新解析时尽量保留用户已手选的目标字段，以及 ③ 里未填充的手工编辑值 */
  var prev=null;for(var i=0;i<old.length;i++)if(old[i].title===p.title&&!prev)prev=old[i];
  var target=ocrCanonicalTarget(prev&&prev.target?prev.target:ocrMatchLabel(p.title));
  var key=ocrTargetKey(target),value=p.value,edited=false;
  if(target&&Object.prototype.hasOwnProperty.call(keep,key)){value=keep[key];edited=true}
  /* 用户给这一行手选过规范值：重新解析后仍按他的选择，不被默认匹配刷掉 */
  var normKept=!!(prev&&prev.normEdited&&prev.target===target&&prev.norm);
  return {id:++OCR.seq,title:p.title,value:value,norm:target?(normKept?prev.norm:ocrDefaultNorm(target,value)):'',normEdited:normKept,target:target,checked:true,edited:edited};
 });
 ocrRefreshRows();
 ocrRenderResult();
 if(saveHistory!==false)ocrHistoryAdd(ta.value);
}
/* ② 文本变化后自动生成 ③ 清单：保留未填充的手工编辑值，短防抖避免每次按键重排表格 */
function ocrTextAutoParse(){
 if(OCR.lockMode)return;
 if(OCR.autoParseTimer)clearTimeout(OCR.autoParseTimer);
 OCR.autoParseTimer=setTimeout(function(){OCR.autoParseTimer=null;ocrParseFromText(false)},180);
}

function ocrRenderResult(){
 var box=document.getElementById('ocrResult');if(!box)return;
 if(!OCR.rows.length){
  box.innerHTML='<div class="ocr-empty">没有需要补录的字段。</div>';
  ocrUpdateCounts();return;
 }
 OCR.targetOptions=ocrBuildTargetOptions();
 var html='<div class="ocr-table-wrap"><table class="ocr-table"><thead><tr>'+
  '<th style="width:36px"><input type="checkbox" id="ocrCheckAll" title="全选/取消" onchange="ocrToggleAll(this.checked)"></th>'+
  '<th style="width:110px">识别标题</th><th>识别值</th><th style="width:160px">规范值</th><th style="width:160px">自动填充到</th>'+
  '<th style="width:110px">状态</th><th style="width:46px"></th></tr></thead><tbody>'+
  OCR.rows.map(function(r){
   var titleCell=r.manual
    ? '<input class="ocr-title-input" value="'+ocrEsc(r.title)+'" oninput="ocrOnTitleInput('+r.id+',this.value)" aria-label="识别标题">'
    : ocrEsc(r.title);
   /* 规范值下拉：选项来自「自动填充到」那个字段本身的可选值，改目标字段时整列跟着换；
      文本框 / 日期 / 级联地址没有固定选项，标注「自由填写」，回填仍用识别值 */
   var normCell;
   if(!r.target)normCell='<span class="ocr-norm-na">—</span>';
   else if(ocrFieldOptions(r.target).length)
    normCell='<select class="ocr-norm-sel" data-rid="'+r.id+'" onchange="ocrOnNormChange('+r.id+',this)" aria-label="规范值：'+ocrEsc(r.target)+'">'+ocrNormOptionsHtml(r.target,r.value)+'</select>';
   else normCell='<span class="ocr-norm-free" title="该字段为自由填写，没有固定选项，回填时使用识别值">自由填写</span>';
   return '<tr data-rid="'+r.id+'"'+(r.manual?' class="ocr-row-manual"':'')+'>'+
    '<td><input type="checkbox" '+(r.checked?'checked':'')+' onchange="ocrOnCheck('+r.id+',this.checked)"></td>'+
    '<td>'+titleCell+'</td>'+
    '<td><input class="ocr-value-input" value="'+ocrEsc(r.value)+'" oninput="ocrOnValueInput('+r.id+',this.value)" onchange="ocrOnValueCommit('+r.id+',this.value)" aria-label="识别值：'+ocrEsc(r.title||r.target||'')+'"></td>'+
    '<td>'+normCell+'</td>'+
    '<td><select class="ocr-target-sel" onchange="ocrOnTargetChange('+r.id+',this)"><option value="">— 不填充 —</option>'+OCR.targetOptions+'</select></td>'+
    '<td>'+ocrStatusHtml(r)+'</td>'+
    '<td>'+(r.manual?'<button type="button" class="ocr-row-del" onclick="ocrDeleteManualRow('+r.id+')" title="删除该行">×</button>':'')+'</td></tr>';
  }).join('')+'</tbody></table></div>';
 box.innerHTML=html;
 /* select 的选中态用赋值设置，避免把动态文本拼进 selected 属性 */
 box.querySelectorAll('select.ocr-target-sel').forEach(function(sel,i){
  var r=OCR.rows[i];if(!r)return;
  var want=r.target||'';
  if(want){
   var hit=false;
   for(var n=0;n<sel.options.length;n++)if(sel.options[n].value===want){hit=true;break}
   if(!hit){
    /* 该字段此刻已有值 / 不再是空字段，下拉选项里没有它：补一项，别让目标看起来被清空 */
    var o=document.createElement('option');
    o.value=want;
    /* 只有「字段此刻已有值」才是（已有值）；其它未填充原因不带这个后缀，免得误导 */
    o.textContent=want+((r.result==='same'||r.result==='occupied')?'（已有值）':'');
    sel.appendChild(o);
   }
  }
  sel.value=want;
 });
 /* 规范值下拉按行 id 定位（没有下拉的行不会出现在 NodeList 里，不能用下标对齐） */
 box.querySelectorAll('select.ocr-norm-sel').forEach(function(sel){
  var r=ocrFindRow(parseInt(sel.getAttribute('data-rid'),10));
  if(!r||!r.target)return;
  var want=r.norm||ocrDefaultNorm(r.target,r.value);
  var hit=false;
  for(var n=0;n<sel.options.length;n++)if(sel.options[n].value===want){hit=true;break}
  if(!hit&&want){   /* 规范列表里没有（用户手填过别的值）：补一项，避免选择被静默丢掉 */
   var o=document.createElement('option');o.value=want;o.textContent=want;sel.appendChild(o);
  }
  sel.value=want;
  /* 重渲染后按当前值重算差异高亮，否则改目标/改识别值后标记会丢失 */
  sel.classList.toggle('ocr-norm-diff',!!r.value&&!!want&&ocrValueKey(r.target,want)!==ocrValueKey(r.target,r.value));
 });
 ocrUpdateCounts();
}
function ocrUpdateCounts(){
 var pill=document.getElementById('ocrCounts');
 var eligible=OCR.rows.length,checked=OCR.rows.filter(function(r){return r.checked}).length;
 var all=document.getElementById('ocrCheckAll');
 if(all){all.checked=eligible>0&&checked===eligible;all.indeterminate=checked>0&&checked<eligible;all.disabled=!eligible}
 if(pill)pill.innerHTML='待补录 <b>'+eligible+'</b> 项 · 已勾选 <b>'+checked+'</b> 项';
}
function ocrFindRow(id){
 var lists=[OCR.rows,OCR.allRows,OCR.manualRows||[]];
 for(var n=0;n<lists.length;n++)for(var i=0;i<lists[n].length;i++)if(lists[n][i].id===id)return lists[n][i];
 return null;
}
function ocrFindIn(list,id){for(var i=0;i<(list||[]).length;i++)if(list[i].id===id)return i;return -1}
function ocrOnCheck(id,on){
 var r=ocrFindRow(id);if(r)r.checked=!!on;
 /* 勾选状态影响冲突判定：取消勾选其中一条，剩下的这条应立刻回到可填充状态 */
 ocrMarkConflicts();
 ocrRenderResult();
}
function ocrOnTitleInput(id,value){
 var r=ocrFindRow(id);if(!r)return;
 r.title=value;r.edited=true;
}
function ocrDeleteManualRow(id){
 var i=ocrFindIn(OCR.manualRows,id);if(i>=0)OCR.manualRows.splice(i,1);
 ocrRefreshRows();ocrRenderResult();
}
function ocrOnValueInput(id,value){
 var r=ocrFindRow(id);if(!r)return;
 r.value=value;r.edited=true;
}
function ocrOnValueCommit(id,value){
 var r=ocrFindRow(id);if(!r)return;
 r.value=value;r.edited=true;
 /* 识别值改动后重新推规范值，除非用户已手动选过规范值 */
 if(!r.normEdited)r.norm=r.target?ocrDefaultNorm(r.target,value):'';
 r.result='';r.resultNote='';
 ocrRefreshRows();
 ocrRenderResult();
}
/* 规范值：用户手选后固定下来，回填以它为准 */
function ocrOnNormChange(id,sel){
 var r=ocrFindRow(id);if(!r)return;
 r.norm=sel.value||'';r.normEdited=true;r.result='';r.resultNote='';
 sel.classList.toggle('ocr-norm-diff',!!r.value&&!!r.norm&&ocrValueKey(r.target,r.norm)!==ocrValueKey(r.target,r.value));
}
function ocrOnTargetChange(id,sel){
 var r=ocrFindRow(id);if(!r)return;
 var oldKey=ocrTargetKey(r.target),newTarget=ocrCanonicalTarget(sel.value||'');
 r.target=newTarget;r.checked=!!r.target;r.result='';r.resultNote='';
 /* 目标字段换了 → 规范值必须按新字段的可选值重算（旧字段的规范值对新字段无意义） */
 if(ocrTargetKey(newTarget)!==oldKey)r.normEdited=false;
 if(!r.normEdited)r.norm=r.target?ocrDefaultNorm(r.target,r.value):'';
 if(!r.target)r.norm='';
 ocrRefreshRows();
 ocrRenderResult();
}
function ocrToggleAll(on){OCR.rows.forEach(function(r){r.checked=!!on});ocrRenderResult()}

/* ---------- 自动填充结果反馈 ----------
   每种结果码对应 ③ 状态列的文案与是否需要人工处理。
   同一字段多组不同取值、表单已有值、提交时选项已变，都要说清楚，不能静默跳过。 */
var OCR_FILL_RESULTS={
 ok:{text:'✓ 已填充',cls:'ocr-st-ok',bad:false},
 same:{text:'该值已存在',cls:'ocr-st-same',bad:false},
 skip:{text:'系统生成，不覆盖',cls:'ocr-st-skip',bad:false},
 occupied:{text:'已有其他值，未覆盖',cls:'ocr-st-skip',bad:true},
 conflict:{text:'取值冲突，未填充',cls:'ocr-st-conflict',bad:true},
 optionMissing:{text:'当前已无该选项',cls:'ocr-st-conflict',bad:true},
 empty:{text:'识别值为空',cls:'ocr-st-empty',bad:true},
 noControl:{text:'找不到该字段',cls:'ocr-st-skip',bad:true},
 invalid:{text:'取值无效，无法写入',cls:'ocr-st-skip',bad:true},
 error:{text:'写入异常',cls:'ocr-st-skip',bad:true}
};
function ocrFillResult(code){return OCR_FILL_RESULTS[code]||OCR_FILL_RESULTS.error}
function ocrClearResults(){
 [OCR.rows,OCR.allRows,OCR.manualRows||[]].forEach(function(list){
  (list||[]).forEach(function(r){r.result='';r.resultNote=''});
 });
}
/* 以提交当下为准：字段有固定选项时，值必须还在当前选项里（期间选项可能被联动改过） */
function ocrMissingOption(label,value){
 var d=ocrDef(label),opts=ocrFieldOptions(label);
 if(!opts.length)return '';
 var test=String(value==null?'':value);
 if(label==='发病部位'&&typeof entrySplitSite==='function')test=entrySplitSite(test).base||test;
 var toks=(d&&d.kind==='multi')
  ?test.split(/[+＋、,，;；\/]/).map(function(s){return s.trim()}).filter(Boolean)
  :[test];
 for(var i=0;i<toks.length;i++){
  var k=ocrValueKey(label,toks[i]),hit=false;
  for(var n=0;n<opts.length;n++)if(ocrValueKey(label,opts[n])===k){hit=true;break}
  if(!hit)return toks[i];
 }
 return '';
}
/* 单行判定 + 写入：返回结果码，同时把原因写进 r.resultNote（悬停与汇总明细都用它） */
function ocrApplyOne(r,value){
 var label=r.target,d=ocrDef(label);
 r.resultNote='';
 if(ocrIsEmptyValue(value)){r.resultNote='识别值与规范值都是空的';return 'empty'}
 if(d&&d.skip){r.resultNote='该系统生成字段不在自动填充范围';return 'skip'}
 var cur=ocrCurrentValue(label);
 if(!ocrIsEmptyValue(cur)){
  if(ocrValueKey(label,cur)===ocrValueKey(label,value)){r.resultNote='表单里已经是「'+cur+'」';return 'same'}
  r.resultNote='表单已有「'+cur+'」，不覆盖';
  return 'occupied';
 }
 var miss=ocrMissingOption(label,value);
 if(miss){r.resultNote='当前表单选项里已没有「'+miss+'」（以提交当下为准）';return 'optionMissing'}
 var code='error';
 try{code=ocrFillOne(label,value)||'error'}catch(e){code='error'}
 if(!r.resultNote){
  if(code==='optionMissing')r.resultNote='当前表单选项里已没有「'+value+'」（以提交当下为准）';
  else if(code==='invalid')r.resultNote='「'+value+'」不是该字段允许的取值';
  else if(code==='noControl')r.resultNote='表单里没有找到这个字段的控件';
  else if(code==='empty')r.resultNote='识别值与规范值都是空的';
  else if(code==='skip')r.resultNote='该系统生成字段不在自动填充范围';
  else if(code==='error')r.resultNote='写入时发生异常，请手动填写';
 }
 return code;
}
function ocrStatusHtml(r){
 if(!r||!r.result)return '<span class="ocr-st ocr-st-ok">待补录</span>';
 var f=ocrFillResult(r.result);
 var title=r.resultNote?' title="'+ocrEsc(r.resultNote)+'"':'';
 return '<span class="ocr-st '+f.cls+'"'+title+'>'+ocrEsc(f.text)+'</span>';
}
/* 弹窗内的汇总条：只列需要人工处理的项，成功项给计数 */
function ocrRenderReport(stat){
 var box=document.getElementById('ocrFillReport');if(!box)return;
 if(!stat||(!stat.ok&&!stat.same&&!stat.skip&&!stat.fail&&!stat.conflict)){
  box.hidden=true;box.innerHTML='';return;
 }
 var pills=[];
 if(stat.ok)pills.push('<span class="ocr-fill-pill is-ok">已填充 '+stat.ok+' 项</span>');
 if(stat.same)pills.push('<span class="ocr-fill-pill is-same">该值已存在 '+stat.same+' 项</span>');
 if(stat.skip)pills.push('<span class="ocr-fill-pill is-same">无需覆盖 '+stat.skip+' 项</span>');
 if(stat.fail)pills.push('<span class="ocr-fill-pill is-fail">未填充 '+stat.fail+' 项</span>');
 if(stat.conflict)pills.push('<span class="ocr-fill-pill is-fail">其中取值冲突 '+stat.conflict+' 项</span>');
 var bad=stat.items.filter(function(it){return ocrFillResult(it.code).bad});
 var listHtml=bad.map(function(it){
  return '<div class="ocr-fill-report-item"><b>'+ocrEsc(it.label)+'</b><span>'+ocrEsc(it.note||it.text)+'</span></div>';
 }).join('');
 if(bad.some(function(it){return it.code==='conflict'}))
  listHtml+='<div class="ocr-fill-report-tip">同一字段出现多组不同取值时，系统不会自动挑一个、也不会把不同值叠写进表单：请删掉多余的行、把它们改投到别的字段，或统一成同一个值后再点「自动填充所选值」。</div>';
 box.hidden=false;
 box.innerHTML='<div class="ocr-fill-report-head"><span class="ocr-fill-report-title">上次自动填充结果</span>'+pills.join('')+
  '<button type="button" class="btn btn-ghost btn-xs" onclick="ocrClearReport()">收起提示</button></div>'+
  '<div class="ocr-fill-report-list'+(bad.length?'':' ocr-fill-report-none')+'">'+
    (bad.length?listHtml:(stat.same||stat.skip?'没有需要写入的项：其余项与表单已有值一致，或属于不需覆盖的字段。':'全部写入成功。'))+'</div>';
}
function ocrClearReport(){
 var box=document.getElementById('ocrFillReport');
 if(box){box.hidden=true;box.innerHTML=''}
 /* 收起汇总条，同时清掉上一轮的结论（该值已存在 / 未覆盖 / 无此选项都是当时的判断，会过期）。
    取值冲突是当前清单本身的状态，重算后仍在，保留。 */
 OCR.rows.forEach(function(r){if(r.result&&r.result!=='conflict'){r.result='';r.resultNote=''}});
 (OCR.manualRows||[]).forEach(function(r){if(r.result&&r.result!=='conflict'){r.result='';r.resultNote=''}});
 (OCR.allRows||[]).forEach(function(r){if(r.result&&r.result!=='conflict'){r.result='';r.resultNote=''}});
 ocrRefreshRows();
 ocrRenderResult();
}

/* ---------- 执行自动填充 ---------- */
function ocrFlash(label){
 var g=entryGroupOf(label);if(!g)return;
 g.classList.remove('ocr-filled');void g.offsetWidth;g.classList.add('ocr-filled');
 setTimeout(function(){g.classList.remove('ocr-filled')},2300);
}
function ocrApplySelected(){
 if(OCR.lockMode)return;
 ocrSetLock('fill');
 /* 先按当前渲染顺序同步 ③ 输入值，再收口 ② 自动解析防抖（用户可能未失焦就直接点按钮） */
 var box=document.getElementById('ocrResult');
 if(box){
  var values=box.querySelectorAll('.ocr-value-input'),titles=box.querySelectorAll('.ocr-title-input');
  var manualIndex=0;
  OCR.rows.forEach(function(r){
   var index=OCR.rows.indexOf(r),input=values[index];
   if(input){r.value=input.value;r.edited=true}
   if(r.manual&&titles[manualIndex]){r.title=titles[manualIndex].value;r.edited=true;manualIndex++}
  });
 }
 if(OCR.autoParseTimer){clearTimeout(OCR.autoParseTimer);OCR.autoParseTimer=null;ocrParseFromText(false)}
 /* 先抓候选：清单是「字段此刻为空」时生成的，用户改完再点按钮的这段时间里，
    字段可能已经被别处补上值。先刷新再取行，那些行会被剔除，
    「该值已存在 / 已有其他值未覆盖」就永远报不出来。 */
 var pool=OCR.rows.slice();
 ocrRefreshRows();
 ocrClearResults();

 var rows=pool.filter(function(r){
  return r.checked&&r.target&&!ocrIsEmptyValue(r.norm||r.value);
 });
 if(!rows.length){
  var checked=pool.filter(function(r){return r.checked&&r.target});
  ocrRenderResult();
  ocrRenderReport(null);
  ocrSetLock('');
  if(typeof toast==='function'){
   toast(checked.length?'勾选的项没有可用的值：请填写「识别值」或「规范值」':'没有可填充的项：请先勾选，并确认「自动填充到」','error');
  }
  return;
 }

 /* 同一字段出现多组不同规范值：不自动挑一个、不叠写，逐条写明原因交给人处理。
    只看勾选的行：用户取消勾选其中一条，就等于自己选定了剩下这条。 */
 var groups={},order=[];
 rows.forEach(function(r){
  var k=ocrTargetKey(r.target);
  if(!groups[k]){groups[k]=[];order.push(k)}
  groups[k].push(r);
 });
 order.forEach(function(k){
  var g=groups[k];if(g.length<2)return;
  var keys={},vals=[];
  g.forEach(function(r){
   var v=String(r.norm||r.value||'').trim(),vk=ocrValueKey(k,v);
   if(!keys[vk]){keys[vk]=1;vals.push(v||'（空）')}
  });
  if(vals.length<2)return;   /* 同一个值的多行不算冲突，交给后面的「该值已存在」处理 */
  g.forEach(function(r){
   r.result='conflict';
   r.resultNote='同一字段出现 '+vals.length+' 组不同取值：'+vals.join(' / ')+'；系统不自动挑选，请删除多余行、改投其他字段或统一取值后重试';
  });
 });

 var firstStep=null,stat={ok:0,same:0,skip:0,fail:0,conflict:0,items:[]};
 rows.forEach(function(r){
  var value=String(r.norm||r.value||'');
  if(r.result!=='conflict')r.result=ocrApplyOne(r,value);
  if(r.result==='ok'){
   stat.ok++;
   ocrFlash(r.target);
   if(firstStep===null){var el=entryControlOf(r.target),sec=el?el.closest('.entry-section'):null;if(sec&&sec.dataset&&sec.dataset.step!=null)firstStep=parseInt(sec.dataset.step,10)}
  }else if(r.result==='same'||r.result==='skip'){
   stat[r.result]++;
  }else{
   stat.fail++;
   if(r.result==='conflict')stat.conflict++;
  }
  stat.items.push({label:r.target,code:r.result,text:ocrFillResult(r.result).text,note:r.resultNote||'',value:value});
 });

 /* 回填可能落在未激活的 Tab，静默切过去让用户看得见（silent=true 不触发必填校验） */
 if(firstStep!==null&&typeof goEntryStep==='function'&&firstStep!==entryStep)goEntryStep(firstStep,true);
 ocrRefreshRows();  /* 已写入的字段不再为空，从 ③ 清单中移除 */
 ocrRenderResult();
 ocrRenderReport(stat);
 if(OCR.historyOpen)ocrRenderHistory();
 ocrSetLock('');  /* 自动填充结束后恢复弹窗 */

 if(typeof toast==='function'){
  var skipN=stat.same+stat.skip;
  if(stat.fail&&stat.ok)toast('自动填充：成功 '+stat.ok+' 项，未填充 '+stat.fail+' 项，原因见清单「状态」列','error');
  else if(stat.fail)toast('自动填充失败：'+stat.fail+' 项没有写入，原因见清单「状态」列','error');
  else if(stat.ok)toast('已自动填充 '+stat.ok+' 个字段'+(skipN?'，跳过 '+skipN+' 项':''));
  else if(skipN)toast('没有写入新值：'+skipN+' 项已存在或无需覆盖');
 }
}
