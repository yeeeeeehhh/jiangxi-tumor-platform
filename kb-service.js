/* ============================================================
   科普与培训 · 社区咨询（kb-service.js）
   ------------------------------------------------------------
   侧导航「科普与培训 → 社区咨询」下的二级节点，三级是 10 个业务页面：

     在线咨询    咨询会话 / 咨询问题分类 / 分配与处理日志
     咨询问题分析 咨询问题分类统计（数量、占比、高紧急度、主要话题）
     互动社区    社区主页（用户侧）/ 社区板块配置 / 社区主帖内容 /
                 社区评论与回复 / 社区用户行为日志 / 社区优质内容推荐配置

   社区主页是「互动社区」的数据生产端：用户在那里浏览、点赞、评论、举报、发起咨询，
   每个动作都写回对应的后台表并留行为日志；它只展示「已发布」内容，
   所以后台的审核、下架、屏蔽在主页上真实生效。

   最小可用口径：每个三级页 = 「筛选 → 一张表 → 该业务必须具备的动作」。
   · 不做代录入、不做自动分配、不做批量分析、不做人工复核、不做图表、
     不做导出、不做快捷话术、不做行内互跳——这些都不是业务闭环所必需。
   · 会话闭环 = 分配 → 回复 → 办结；三者缺一不可，其余动作只保留
     每页绕不开的那一个（分类增改、板块增改、主帖审核、评论治理、推荐开关）。
   · 「咨询原始问题文本」页连同它的「待分析」状态一起下线：那页的唯一用武之地
     是手动分析单条文本，既然留了它就得养一个永远无法自然进入的状态机，
     现在分析结果只由会话回复时自动产生。分析类页面只统计、不生产。
   · 分析类三页（智能分析结果 / 热点统计 / 洞察建议）合并为一页：它们本是同一批
     分析数据的三个切面，运营要的维度只有一个——问题分类。热点的话题排行并进
     「主要话题」列；统计页只统计、不生产，「科普转化」与行内采纳动作一并下线。
   · 社区主页是唯一面向用户的页面，也是社区各后台页的数据来源：它在浏览器里
     直接读写 DB，与后台页共用同一份内存数据，所以「主页发帖 → 后台审核 →
     主页可见」这条链路是真的通的，不是两套假数据。

   对外导出：window.HCService（DB、pageIds、pages、legacy、overview、render、
   pageOf、tabOf、labelOf）——app.html 与 kb-module.js 依赖这些名字，不可改名。
   ============================================================ */
(function () {
  'use strict';

  /* ================= 样式（只补 KB 里没有的几件） ================= */
  var CSS = [
    '.hcs-bar{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px}',
    '.hcs-bar .l{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
    '.hcs-clip{display:inline-block;max-width:280px;overflow:hidden;text-overflow:ellipsis;vertical-align:middle;white-space:nowrap}',
    '.hcs-sub{display:block;font-size:11.5px;color:#94a3b8;line-height:1.5;white-space:normal}',
    '.hcs-ops{display:flex;gap:6px;flex-wrap:wrap}',
    '.hcs-empty{padding:26px;text-align:center;color:#64748b;font-size:13px}',
    '.hcs-thread{display:flex;flex-direction:column;gap:10px;max-height:320px;overflow:auto;padding:4px 2px;margin-bottom:12px}',
    '.hcs-msg{display:flex;flex-direction:column;gap:3px;max-width:84%}',
    '.hcs-msg .who{font-size:11px;color:#94a3b8}',
    '.hcs-msg .bub{padding:8px 11px;border-radius:8px;background:#f3f6fa;color:#24313f;font-size:13px;line-height:1.6;white-space:pre-wrap;word-break:break-word}',
    '.hcs-msg.mine{align-items:flex-end;margin-left:auto}',
    '.hcs-msg.mine .bub{background:#e8f2ff;color:#1a3450}',
    '.hcs-msg.sys .bub{background:#fff7db;color:#8a6100;font-size:12px}',
    '.hcs-note{border:1px solid #dbe6f5;border-left:4px solid #244765;border-radius:6px;background:#f4f8ff;padding:10px 13px;font-size:12.5px;color:#334155;line-height:1.65;margin-bottom:12px}',
    '.hcs-note b{color:#244765}',
    '.hcs-kv{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 18px;margin-bottom:12px}',
    '.hcs-kv .k{font-size:12px;color:#667085}',
    '.hcs-kv .v{font-size:13px;font-weight:600;color:#1f2937;margin-top:2px}',
    '.hcs-item{border:1px solid var(--border,#dfe5ec);border-radius:6px;padding:10px 12px;margin-bottom:8px}',
    '.hcs-item .tt{font-size:13px;font-weight:700;color:#1f2937}',
    '.hcs-item .ds{font-size:12.5px;color:#64748b;margin-top:4px;line-height:1.6}',
    /* ---- 社区主页：与「科普内容」同形制（工具栏 → 筛选条 → 4 列卡片网格 → 分页）。
       卡片直接用 .kb-cards / .kbx-card，这里只补社区特有的两层：
       封面上叠板块名与浏览数，卡片底部放互动（点赞 / 评论 / 举报）。
       不设右栏：科普内容页也没有右栏，加了会把 4 列挤成 3 列，卡片规格就不一致了。 ---- */
    '.hcs-home-cards .kbx-card-cover-wrap{height:150px}',
    '.hcs-cover-board{position:absolute;right:10px;bottom:10px;z-index:2;height:22px;padding:0 9px;border-radius:11px;' +
    'background:rgba(15,32,48,.72);color:#fff;font-size:11.5px;font-weight:700;display:inline-flex;align-items:center}',
    '.hcs-cover-word{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
    'font-size:34px;font-weight:800;color:rgba(255,255,255,.42);letter-spacing:3px}',
    '.hcs-metabar{display:flex;align-items:center;gap:14px;padding:0 14px 12px;margin-top:auto;font-size:11.5px;color:#8494a5;min-height:32px}',
    '.hcs-metabar .lk{display:inline-flex;align-items:center;gap:3px;cursor:pointer;user-select:none}',
    '.hcs-metabar .lk:hover{color:var(--primary,#244765)}',
    '.hcs-metabar .lk.on{color:#b42335;font-weight:700}',
    '.hcs-metabar .lk.rp{margin-left:auto}',
    /* 咨询弹窗 */
    '.hcs-askf select,.hcs-askf input,.hcs-askf textarea{width:100%;border:1px solid #d1d8e0;border-radius:6px;' +
    'padding:0 10px;font-size:13px;background:#fff;box-sizing:border-box;font-family:inherit;height:36px}',
    '.hcs-askf textarea{padding:9px 10px;height:auto;line-height:1.65;resize:vertical}',
    '.hcs-askf .row{margin-bottom:11px}',
    '.hcs-askf label{display:block;font-size:12.5px;color:#475569;font-weight:600;margin-bottom:6px}',
    /* 富文本正文在详情弹窗里的排版：与知识库详情页同档字号，行距放宽便于阅读 */
    '.hcs-body{font-size:13.5px;line-height:1.78;color:#334155;margin-top:6px}',
    '.hcs-body p{margin:0 0 9px}',
    '.hcs-body p:last-child{margin-bottom:0}',
    '.hcs-body h2{font-size:15.5px;font-weight:700;color:#1f2937;margin:14px 0 8px}',
    '.hcs-body h3{font-size:14px;font-weight:700;color:#1f2937;margin:12px 0 7px}',
    '.hcs-body ul,.hcs-body ol{margin:0 0 9px;padding-left:22px}',
    '.hcs-body li{margin-bottom:4px}',
    '.hcs-body a{color:#244765;font-weight:600;text-decoration:underline}',
    '.hcs-body img{max-width:100%;height:auto;border-radius:6px;margin:6px 0}',
    '.hcs-body blockquote{margin:0 0 9px;padding:6px 12px;border-left:3px solid #c2d4e6;background:#f6f9fc;color:#475569}',
    /* ---- 在线咨询聊天窗（悬浮，挂在 body 上，不随页面切换销毁） ---- */
    '.hcs-chat-fab{position:fixed;right:26px;bottom:26px;z-index:900;height:48px;padding:0 18px;border:0;border-radius:24px;' +
    'background:#244765;color:#fff;font-size:13.5px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:8px;' +
    'box-shadow:0 6px 20px rgba(36,71,101,.34);transition:transform .16s,box-shadow .16s}',
    '.hcs-chat-fab:hover{transform:translateY(-2px);box-shadow:0 10px 26px rgba(36,71,101,.42)}',
    '.hcs-chat-fab .n{min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:#e5484d;color:#fff;font-size:11.5px;' +
    'font-weight:800;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box}',
    '.hcs-chat{position:fixed;right:26px;bottom:86px;z-index:901;width:376px;height:534px;display:flex;flex-direction:column;' +
    'background:#fff;border:1px solid #dbe4ee;border-radius:12px;overflow:hidden;box-shadow:0 18px 48px rgba(20,40,60,.22)}',
    '.hcs-chat-hd{flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:12px 14px;background:#244765;color:#fff}',
    '.hcs-chat-hd .t{font-size:13.5px;font-weight:700}',
    '.hcs-chat-hd .s{font-size:11.5px;opacity:.78;margin-left:2px}',
    '.hcs-chat-hd .back{border:0;background:rgba(255,255,255,.16);color:#fff;width:24px;height:24px;border-radius:5px;' +
    'cursor:pointer;font-size:13px;line-height:1;display:inline-flex;align-items:center;justify-content:center}',
    '.hcs-chat-hd .x{margin-left:auto;border:0;background:transparent;color:#fff;font-size:19px;line-height:1;cursor:pointer;opacity:.8}',
    '.hcs-chat-hd .x:hover{opacity:1}',
    '.hcs-chat-bd{flex:1 1 auto;overflow:auto;background:#f7f9fc;padding:12px}',
    '.hcs-chat-ft{flex:0 0 auto;border-top:1px solid #e6edf5;background:#fff;padding:9px 10px}',
    '.hcs-chat-ft .row{display:flex;gap:8px;align-items:flex-end}',
    '.hcs-chat-ft textarea{flex:1;border:1px solid #d1d8e0;border-radius:8px;padding:8px 10px;font-size:13px;line-height:1.55;' +
    'resize:none;height:58px;box-sizing:border-box;font-family:inherit}',
    '.hcs-chat-ft .tip{font-size:11px;color:#94a3b8;margin-top:6px}',
    '.hcs-chat-item{display:flex;gap:10px;align-items:flex-start;background:#fff;border:1px solid #e3e9f0;border-radius:9px;' +
    'padding:11px 12px;margin-bottom:9px;cursor:pointer;transition:border-color .15s,box-shadow .15s}',
    '.hcs-chat-item:hover{border-color:#b9cde0;box-shadow:0 3px 10px rgba(27,36,50,.07)}',
    '.hcs-chat-item .av{width:32px;height:32px;flex:0 0 32px;border-radius:50%;background:#e8f2ff;color:#244765;font-size:13px;' +
    'font-weight:800;display:inline-flex;align-items:center;justify-content:center}',
    '.hcs-chat-item .cn{min-width:0;flex:1}',
    '.hcs-chat-item .ct{display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;color:#1f2937}',
    '.hcs-chat-item .ct .n{margin-left:auto;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#e5484d;color:#fff;' +
    'font-size:11px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box}',
    '.hcs-chat-item .cm{font-size:12px;color:#8494a5;margin-top:4px;line-height:1.5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.hcs-chat-new{width:100%;height:36px;border:1px dashed #b9cde0;border-radius:8px;background:#fff;color:#244765;' +
    'font-size:12.5px;font-weight:700;cursor:pointer}',
    '.hcs-chat-new:hover{background:#f4f8ff}',
    '.hcs-cmsg{display:flex;flex-direction:column;gap:3px;margin-bottom:11px;max-width:84%}',
    '.hcs-cmsg .who{font-size:11px;color:#94a3b8}',
    '.hcs-cmsg .bub{padding:8px 11px;border-radius:9px;background:#fff;border:1px solid #e3e9f0;color:#24313f;font-size:13px;' +
    'line-height:1.62;white-space:pre-wrap;word-break:break-word}',
    '.hcs-cmsg.mine{align-items:flex-end;margin-left:auto}',
    '.hcs-cmsg.mine .bub{background:#244765;border-color:#244765;color:#fff}',
    '.hcs-cmsg.sys{align-items:center;max-width:100%;margin-left:0}',
    '.hcs-cmsg.sys .bub{background:#fff7db;border-color:#f0e0a8;color:#8a6100;font-size:11.5px;padding:5px 10px;border-radius:999px}',
    '.hcs-chat-empty{padding:34px 16px;text-align:center;color:#94a3b8;font-size:12.5px;line-height:1.8}'
  ].join('\n');
  var styleEl = document.createElement('style');
  styleEl.id = 'kb-service-styles';
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  /* ================= 基础工具 ================= */
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function $(id) { return document.getElementById(id); }
  function val(id) { var e = $(id); return e ? String(e.value).trim() : ''; }
  function say(msg, type) { if (window.toast) { window.toast(msg, type); } else { window.alert(msg); } }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function now() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  var SEQ = 7000;
  function nextId(p) { SEQ += 1; return p + SEQ; }
  function find(list, id) { for (var i = 0; i < list.length; i++) { if (list[i].id === id) return list[i]; } return null; }
  function cnt(list, fn) { var n = 0; for (var i = 0; i < list.length; i++) { if (fn(list[i])) n += 1; } return n; }
  function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }
  function has(list, x) { return (list || []).indexOf(x) >= 0; }

  /* 状态色：KB 只给了 启用/停用，咨询侧的取值在这里补 */
  var TONE = {
    '待分配': 'orange', '处理中': 'info', '已回复': 'success', '已办结': 'neutral',
    '待审核': 'orange', '已发布': 'success', '已驳回': 'danger', '已下架': 'neutral',
    '正常': 'success', '已屏蔽': 'danger',
    /* 举报处置：待处置 → 已处置 / 举报不成立。与主帖的「已驳回」分开命名，
       避免把"举报不成立"误读成"内容被驳回"。 */
    '待处置': 'orange', '已处置': 'success', '举报不成立': 'neutral',
    '启用': 'success', '停用': 'neutral', '已推荐': 'success', '未推荐': 'neutral'
  };
  function badge(text, tone) { return '<span class="badge badge-' + (tone || TONE[text] || 'neutral') + '">' + esc(text) + '</span>'; }
  function priBadge(p) { return badge(p, p === '高' ? 'danger' : p === '中' ? 'caution' : 'neutral'); }

  /* ---------- 知识库接线 ----------
     只保留「读」：社区发帖时可引用知识库已上架科普（见 openPost 里的 eduOpts）。
     咨询问题分类统计页不再生成科普草稿，所以 kbAdd / kbOpen / kbSites / kbAuthors
     一并删掉——留着就是永远不会被调用的死代码。 */


  /* ================= 数据（内存态） ================= */
  var DOCTORS = ['王医生', '李医生', '赵医生', '孙医生', '周医生', '吴医生'];
  var TOPICS = ['肺部结节', '化疗后调理', '乳腺复查', '放射治疗', '术后饮食', '免疫治疗', '心理支持', '复诊随访', '疼痛管理', '营养支持'];
  var CAT_OF_TOPIC = { '肺部结节': '肿瘤防治', '化疗后调理': '康复随访', '乳腺复查': '健康科普', '放射治疗': '康复随访', '术后饮食': '肿瘤防治', '免疫治疗': '康复随访', '心理支持': '心理支持', '复诊随访': '健康科普', '疼痛管理': '肿瘤防治', '营养支持': '康复随访' };

  var DB = {
    sessions: [
      { id: 'HC-2026-0001', user: '张女士', phone: '138****2210', cat: '肿瘤防治', topic: '肺部结节', q: '确诊肺腺癌后饮食方面需要注意什么？', status: '已回复', time: '2026-08-27 09:12', assignee: '王医生', priority: '低', msgs: [{ id: 'MSG-1001', from: '张女士', role: '用户', content: '确诊肺腺癌后，家人每天做很多补品，有没有需要忌口的？', time: '2026-08-27 09:12' }, { id: 'MSG-1002', from: '王医生', role: '客服', content: '建议清淡饮食，保证优质蛋白（鱼、蛋、瘦肉、豆制品），腌制与烟熏类尽量少吃。补品不建议自行大量服用，请把成分单带给主治医生确认。', time: '2026-08-27 09:30' }] },
      { id: 'HC-2026-0002', user: '李先生', phone: '139****8871', cat: '康复随访', topic: '化疗后调理', q: '化疗结束后白细胞偏低如何调理？', status: '处理中', time: '2026-08-27 10:45', assignee: '李医生', priority: '中', msgs: [{ id: 'MSG-1003', from: '李先生', role: '用户', content: '化疗后白细胞 2.8，请问怎么提升？需要打升白针吗？', time: '2026-08-27 10:45' }, { id: 'MSG-1004', from: '李医生', role: '客服', content: '白细胞 2.8×10⁹/L 属于中度下降，建议 3 天内复查血常规，增加优质蛋白摄入，注意避免去人群密集处。是否使用升白药物需由主治医生判断。', time: '2026-08-27 11:02' }] },
      { id: 'HC-2026-0003', user: '赵阿姨', phone: '136****3345', cat: '健康科普', topic: '乳腺复查', q: '乳腺癌术后可以接种流感疫苗吗？', status: '待分配', time: '2026-08-27 13:20', assignee: '', priority: '低', msgs: [{ id: 'MSG-1009', from: '赵阿姨', role: '用户', content: '乳腺癌术后两年了，今年想打流感疫苗，不知道行不行。', time: '2026-08-27 13:20' }] },
      { id: 'HC-2026-0004', user: '王先生', phone: '137****9023', cat: '肿瘤防治', topic: '肺部结节', q: '体检发现 8mm 肺结节，需要立即复查吗？会不会是恶性的？', status: '待分配', time: '2026-08-27 15:03', assignee: '', priority: '高', msgs: [{ id: 'MSG-1005', from: '王先生', role: '用户', content: '8mm 肺结节会不会是恶性的？多久复查一次？', time: '2026-08-27 15:03' }] },
      { id: 'HC-2026-0005', user: '陈女士', phone: '158****1109', cat: '康复随访', topic: '放射治疗', q: '放疗期间皮肤出现红肿脱皮如何处理？', status: '已办结', time: '2026-08-26 15:40', assignee: '孙医生', priority: '中', msgs: [{ id: 'MSG-1006', from: '陈女士', role: '用户', content: '放疗第 12 次，照射区域皮肤发红还有点脱皮，能涂东西吗？', time: '2026-08-26 15:40' }, { id: 'MSG-1007', from: '孙医生', role: '客服', content: '属于常见放射性皮肤反应。保持局部清洁干燥、穿柔软棉质衣物，可在放疗科指导下使用医用保湿敷料，切勿自行涂抹刺激性药膏。', time: '2026-08-26 16:05' }] },
      { id: 'HC-2026-0006', user: '刘先生', phone: '135****7788', cat: '心理支持', topic: '心理支持', q: '确诊后整夜失眠，总想着最坏的结果，怎么办？', status: '处理中', time: '2026-08-26 20:11', assignee: '周医生', priority: '高', msgs: [{ id: 'MSG-1008', from: '刘先生', role: '用户', content: '自从确诊以后每天睡不着，脑子里全是坏消息，家里人也跟着难受。', time: '2026-08-26 20:11' }] },
      { id: 'HC-2026-0007', user: '孙阿姨', phone: '133****4521', cat: '康复随访', topic: '营养支持', q: '免疫治疗期间可以吃人参黄芪这类补品吗？', status: '已回复', time: '2026-08-25 11:02', assignee: '吴医生', priority: '低', msgs: [] },
      { id: 'HC-2026-0008', user: '周先生', phone: '186****9034', cat: '肿瘤防治', topic: '疼痛管理', q: '癌痛吃吗啡类止痛药会不会成瘾？', status: '待分配', time: '2026-08-25 08:30', assignee: '', priority: '中', msgs: [] }
    ],
    categories: [
      { id: 'CAT-01', name: '肿瘤防治', desc: '确诊后治疗、用药、护理等问题', status: '启用', owner: '王医生' },
      { id: 'CAT-02', name: '康复随访', desc: '术后 / 放疗 / 化疗后的恢复与随访', status: '启用', owner: '李医生' },
      { id: 'CAT-03', name: '健康科普', desc: '体检报告解读、日常保健常识', status: '启用', owner: '赵医生' },
      { id: 'CAT-04', name: '心理支持', desc: '情绪疏导与心理关怀', status: '停用', owner: '周医生' }
    ],
    assigns: [
      { id: 'ASG-5001', session: 'HC-2026-0001', to: '王医生', note: '转肿瘤防治组处理', time: '2026-08-27 09:20' },
      { id: 'ASG-5002', session: 'HC-2026-0002', to: '李医生', note: '转康复随访组处理', time: '2026-08-27 10:50' },
      { id: 'ASG-5003', session: 'HC-2026-0005', to: '孙医生', note: '放射性皮肤反应专项', time: '2026-08-26 15:50' },
      { id: 'ASG-5004', session: 'HC-2026-0006', to: '周医生', note: '情绪类转心理支持组', time: '2026-08-26 20:30' }
    ],
    analysis: [],
    boards: [
      { id: 'BD-01', name: '康复互助圈', desc: '康复期患者经验分享与互助', status: '启用' },
      { id: 'BD-02', name: '专家讲堂', desc: '权威医生专题科普讲座', status: '启用' },
      { id: 'BD-03', name: '营养咨询', desc: '营养师在线答疑专区', status: '启用' },
      { id: 'BD-04', name: '心情树洞', desc: '匿名倾诉与心理支持', status: '停用' }
    ],
    posts: [
      { id: 'PT-101', board: '康复互助圈', user: '阿诚', title: '放疗第三周的感受与经验', content: '记录一下这三周放疗的身体变化，给后面的病友一个参考。前两周基本没什么感觉，第三周开始照射区域皮肤发紧、颜色变深，食欲也差了一些。医生说是正常反应，坚持下来了。', views: 1280, likes: 210, status: '已发布', time: '2026-08-24 10:12' },
      { id: 'PT-102', board: '专家讲堂', user: '王医生', title: '免疫治疗副作用管理专题', content: '免疫相关不良反应可累及全身多个器官，早期识别是关键。常见包括皮肤反应、甲状腺功能异常、结肠炎、肺炎等，出现持续腹泻、气促、皮疹加重请及时就诊。', views: 3560, likes: 486, status: '已发布', time: '2026-08-23 09:00' },
      { id: 'PT-103', board: '营养咨询', user: '营养师小林', title: '化疗期一日三餐怎么吃', content: '化疗期间饮食核心是足量优质蛋白加食物安全。建议少食多餐，每天保证鸡蛋、鱼肉或瘦肉；所有食物彻底加热，避免生冷沙拉与隔夜菜。', views: 2030, likes: 322, status: '已发布', time: '2026-08-25 14:30' },
      { id: 'PT-104', board: '心情树洞', user: '匿名用户', title: '确诊后的失眠焦虑，想找个出口', content: '自从拿到病理报告，我就没有睡过一个整觉，总在想最坏的结果，家人安慰我也听不进去。', views: 640, likes: 98, status: '待审核', time: '2026-08-27 08:40' },
      { id: 'PT-105', board: '康复互助圈', user: '海阔天空', title: '复查指标正常，分享我的随访时间表', content: '把这两年的复查项目和时间整理成表格，方便大家对照。术后前两年每 3 个月一次，第 3-5 年每 6 个月一次。', views: 410, likes: 66, status: '待审核', time: '2026-08-27 12:05' }
    ],
    comments: [
      { id: 'CM-201', post: 'PT-102', user: '刘海', content: '讲解得很详细，收藏了。', like: 15, time: '2026-08-27 10:20', status: '正常', replies: [{ content: '感谢关注，具体用药请以主治医生意见为准。', time: '2026-08-27 10:40' }] },
      { id: 'CM-202', post: 'PT-103', user: '美玲', content: '请问放疗期间可以吃海鲜吗？', like: 6, time: '2026-08-27 11:40', status: '正常', replies: [] },
      { id: 'CM-203', post: 'PT-101', user: '老王', content: '感谢分享，给了我很大信心。', like: 22, time: '2026-08-27 14:02', status: '正常', replies: [] },
      { id: 'CM-204', post: 'PT-103', user: '匿名用户', content: '这里推荐的那个偏方根本没用，别信。', like: 1, time: '2026-08-27 16:15', status: '待审核', replies: [] }
    ],
    /* 用户行为日志：浏览、点赞这类是纯留痕，不可改不可删；
       「举报内容」是唯一需要运营处置的行为，带 handle 状态与处置结论。
       举报的处置结果会反映到被举报主帖/评论上（下架 / 屏蔽 / 维持原样）。 */
    userLogs: [
      { id: 'UL-301', user: '张女士', action: '发起咨询', target: 'HC-2026-0001', time: '2026-08-27 09:12' },
      { id: 'UL-302', user: '美玲', action: '发表评论', target: 'CM-202', time: '2026-08-27 11:40' },
      { id: 'UL-303', user: '赵阿姨', action: '点赞', target: 'PT-102', time: '2026-08-27 13:18' },
      { id: 'UL-304', user: '匿名用户', action: '举报内容', target: 'PT-104', time: '2026-08-27 15:02', reason: '内容涉及未经验证的偏方', handle: '待处置', handledAt: '', handledBy: '', conclusion: '' },
      { id: 'UL-305', user: '老王', action: '举报内容', target: 'CM-204', time: '2026-08-27 16:20', reason: '评论含误导性偏方推荐', handle: '待处置', handledAt: '', handledBy: '', conclusion: '' },
      { id: 'UL-306', user: '海阔天空', action: '举报内容', target: 'PT-101', time: '2026-08-27 17:05', reason: '疑似广告引流', handle: '举报不成立', handledAt: '2026-08-27 17:30', handledBy: '运营小编', conclusion: '核查为病友经验分享，未含联系方式或引流信息' }
    ],
    /* 推荐位：一条主帖最多一条记录，status 只在 已推荐 / 未推荐 之间切 */
    recommends: [
      { id: 'RC-01', post: 'PT-102', status: '已推荐' },
      { id: 'RC-02', post: 'PT-103', status: '已推荐' }
    ]
  };

  /* ---------- 种子：原始问题文本（由话题权重派生，供热点统计有数可算） ---------- */
  (function seedAnalysis() {
    var intentOf = { '肺部结节': '复查建议', '化疗后调理': '康复指导', '乳腺复查': '接种咨询', '放射治疗': '不良反应处理', '术后饮食': '饮食建议', '免疫治疗': '用药咨询', '心理支持': '情绪疏导', '复诊随访': '随访安排', '疼痛管理': '用药安全', '营养支持': '营养指导' };
    var emotions = ['中性', '焦虑', '担忧', '急迫', '平和'];
    var urgencies = ['低', '中', '高'];
    var weights = [9, 7, 5, 4, 4, 3, 3, 2, 2, 2];
    var n = 0;
    for (var t = 0; t < TOPICS.length; t++) {
      for (var k = 0; k < weights[t]; k++) {
        n += 1;
        DB.analysis.push({
          id: 'AN-' + (9000 + n),
          session: 'HC-2026-' + pad(((t * 3 + k) % 8) + 1),
          topic: TOPICS[t],
          raw: TOPICS[t] + '相关问题（样本 ' + (k + 1) + '）：想确认下一步该怎么处理？',
          label: CAT_OF_TOPIC[TOPICS[t]],
          intent: intentOf[TOPICS[t]],
          emotion: emotions[(t + k) % emotions.length],
          urgency: urgencies[(t + k) % urgencies.length],
          analyzedAt: '2026-08-' + pad(20 + (k % 8)) + ' ' + pad(8 + (k % 9)) + ':' + pad((k * 7) % 60)
        });
      }
    }
  })();

  /* ---------- 派生：分类统计是唯一口径，页面与采纳动作都读它 ---------- */
  /* 按问题分类汇总咨询文本：数量、占比、高紧急度条数、主要话题。
     分类取自分析结果自身的 label，而不是分类配置表——停用的分类、甚至已被删掉的
     分类下若仍留有文本，数字也要算得进来，否则合计对不上明细。 */
  function catStat() {
    var map = {}, total = 0;
    DB.analysis.forEach(function (a) {
      var k = a.label || '未分类';
      if (!map[k]) map[k] = { l: k, v: 0, urgent: 0, topics: {} };
      map[k].v += 1; total += 1;
      if (a.urgency === '高') map[k].urgent += 1;
      map[k].topics[a.topic || '—'] = (map[k].topics[a.topic || '—'] || 0) + 1;
    });
    var list = Object.keys(map).map(function (k) {
      var t = map[k].topics;
      var top = Object.keys(t).sort(function (x, y) { return t[y] - t[x] || (x < y ? -1 : 1); })[0] || '—';
      return { l: k, v: map[k].v, urgent: map[k].urgent, top: top, share: pct(map[k].v, total) };
    }).sort(function (x, y) { return y.v - x.v || (x.l < y.l ? -1 : x.l > y.l ? 1 : 0); });
    return { list: list, total: total };
  }

  /* ---------- 智能分析引擎（关键词规则，演示口径） ---------- */
  var AI_RULES = [
    { kw: ['结节', '复查', 'ct', '随访'], topic: '肺部结节', cat: '肿瘤防治', intent: '复查建议', urgency: '中' },
    { kw: ['白细胞', '中性粒', '骨髓', '升白'], topic: '化疗后调理', cat: '康复随访', intent: '康复指导', urgency: '高' },
    { kw: ['放疗', '皮肤', '灼伤', '脱皮'], topic: '放射治疗', cat: '康复随访', intent: '不良反应处理', urgency: '中' },
    { kw: ['免疫', '靶向', 'pd-1'], topic: '免疫治疗', cat: '康复随访', intent: '用药咨询', urgency: '中' },
    { kw: ['疼', '痛', '吗啡', '止痛'], topic: '疼痛管理', cat: '肿瘤防治', intent: '用药安全', urgency: '高' },
    { kw: ['睡不着', '失眠', '焦虑', '害怕', '抑郁'], topic: '心理支持', cat: '心理支持', intent: '情绪疏导', urgency: '高' },
    { kw: ['吃', '饮食', '忌口', '营养', '补品'], topic: '术后饮食', cat: '肿瘤防治', intent: '饮食建议', urgency: '低' },
    { kw: ['疫苗', '体检', '报告', '科普'], topic: '乳腺复查', cat: '健康科普', intent: '接种咨询', urgency: '低' }
  ];
  function aiAnalyze(text) {
    var t = String(text || '').toLowerCase();
    var hit = null;
    for (var i = 0; i < AI_RULES.length && !hit; i++) {
      for (var j = 0; j < AI_RULES[i].kw.length; j++) { if (t.indexOf(AI_RULES[i].kw[j]) >= 0) { hit = AI_RULES[i]; break; } }
    }
    var emotion = /急|马上|严重|怎么办|害怕|睡不着|疼/.test(t) ? '焦虑' : /？|\?/.test(t) ? '中性' : '平和';
    return {
      topic: hit ? hit.topic : '复诊随访',
      label: hit ? hit.cat : '健康科普',
      intent: hit ? hit.intent : '综合咨询',
      emotion: emotion,
      urgency: emotion === '焦虑' ? '高' : (hit ? hit.urgency : '低')
    };
  }

  /* ================= 视图状态 ================= */
  var S = { page: {}, filters: {}, pageNo: {}, pageId: 'hc-consult' };
  var keyOf = function (id) { return id; };
  function refresh() { render(S.pageId || 'hc-consult'); }

  /* ---------- 片段 ---------- */
  function bar(left, right) { return '<div class="hcs-bar"><div class="l">' + (left || '') + '</div><div class="l">' + (right || '') + '</div></div>'; }
  function table(headers, rows, emptyText) {
    if (!rows.length) return '<div class="hcs-empty">' + esc(emptyText || '暂无数据') + '</div>';
    return '<div class="table-wrap"><table class="data-table"><thead><tr>' +
      headers.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
  }
  function ops() { return '<div class="hcs-ops">' + Array.prototype.slice.call(arguments).filter(Boolean).join('') + '</div>'; }
  function act(text, action, arg, cls) { return '<button class="btn ' + (cls || 'btn-outline') + ' btn-sm" data-hcs="' + action + '" data-arg="' + esc(arg == null ? '' : arg) + '">' + text + '</button>'; }
  function link(text, action, arg) { return '<a href="javascript:void(0)" style="color:var(--primary);font-weight:600" data-hcs="' + action + '" data-arg="' + esc(arg) + '">' + esc(text) + '</a>'; }
  function clip(text, max) { return '<span class="hcs-clip" style="max-width:' + (max || 280) + 'px" title="' + esc(text) + '">' + esc(text) + '</span>'; }

  function filterState(id) { return S.filters[id] || (S.filters[id] = {}); }
  function fv(id, k, def) { var f = S.filters[id]; var v = f && f[k] != null ? String(f[k]) : ''; return v === '' ? (def == null ? '' : def) : v; }
  function fsel(id, k, options, cur) {
    return '<div class="form-group"><select data-hcs-filter="' + id + '" data-k="' + k + '">' +
      options.map(function (o) { return '<option' + (o === cur ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select></div>';
  }
  function fkw(id, k, cur, ph) {
    return '<div class="form-group"><input data-hcs-kw="' + id + '" data-k="' + k + '" value="' + esc(cur || '') + '" placeholder="' + esc(ph || '关键字') + '"></div>';
  }
  function resetBtn(id) { return '<button class="btn btn-ghost btn-sm" data-hcs="reset" data-arg="' + id + '">重置</button>'; }
  function filterBar(id, fields) {
    return '<div class="filter-toolbar">' + fields.join('') +
      '<div class="filter-actions">' + resetBtn(id) +
      '<button class="btn btn-primary btn-sm" data-hcs="query" data-arg="' + id + '">查询</button></div></div>';
  }
  function readFilter(id) {
    var f = filterState(id);
    Array.prototype.forEach.call(document.querySelectorAll('[data-hcs-filter="' + id + '"]'), function (el) { f[el.getAttribute('data-k')] = el.value; });
    Array.prototype.forEach.call(document.querySelectorAll('[data-hcs-kw="' + id + '"]'), function (el) { f[el.getAttribute('data-k')] = String(el.value || '').trim(); });
    S.pageNo[id] = 1;
  }
  function pager(id, total, size) {
    var pages = Math.max(1, Math.ceil(total / size));
    var cur = S.pageNo[id] || 1;
    if (cur > pages) { cur = pages; S.pageNo[id] = cur; }
    var btns = '';
    for (var i = 1; i <= pages; i++) {
      if (pages > 7 && i > 2 && i < pages - 1 && Math.abs(i - cur) > 1) { if (i === 3) btns += '<span style="color:#94a3b8;padding:0 4px">…</span>'; continue; }
      btns += '<button class="btn ' + (i === cur ? 'btn-primary' : 'btn-ghost') + ' btn-sm" style="min-width:30px" data-hcs="page" data-arg="' + id + '|' + i + '">' + i + '</button>';
    }
    return '<div style="display:flex;gap:6px;align-items:center;justify-content:flex-end;padding-top:10px;font-size:12px;color:#64748b">' +
      '<span style="margin-right:auto">共 ' + total + ' 条</span>' +
      '<button class="btn btn-ghost btn-sm" data-hcs="page" data-arg="' + id + '|' + Math.max(1, cur - 1) + '"' + (cur === 1 ? ' disabled' : '') + '>‹</button>' + btns +
      '<button class="btn btn-ghost btn-sm" data-hcs="page" data-arg="' + id + '|' + Math.min(pages, cur + 1) + '"' + (cur === pages ? ' disabled' : '') + '>›</button>' +
      '<span>第 ' + cur + ' / ' + pages + ' 页</span></div>';
  }
  function slice(list, id, size) { var cur = S.pageNo[id] || 1; return list.slice((cur - 1) * size, cur * size); }

  /* ---------- 弹窗（复用知识库的 .kb-mask / .kb-modal 壳） ---------- */
  function closeModal() { var m = document.querySelector('.kb-mask'); if (m) m.remove(); }
  function modal(title, sub, body, ft) {
    closeModal();
    var mask = document.createElement('div');
    mask.className = 'kb-mask';
    mask.innerHTML = '<div class="kb-modal"><div class="hd"><div class="t">' + esc(title) + (sub ? '<span class="sub">' + esc(sub) + '</span>' : '') + '</div>' +
      '<button class="x" data-hcs="close">×</button></div>' +
      '<div class="bd">' + body + '</div>' +
      (ft ? '<div class="ft">' + ft + '</div>' : '') + '</div>';
    document.body.appendChild(mask);
    mask.addEventListener('click', function (e) { if (e.target === mask) closeModal(); });
    return mask;
  }
  /* 确定类按钮只负责触发动作；参数挂在弹窗根上（data-modal / data-arg），不经过模块级状态，
     这样同名按钮、跨模块按钮都不会串台。 */
  function foot(okLabel, okAction, arg) {
    return '<button class="btn btn-ghost btn-sm" data-hcs="close">取消</button>' +
      (okLabel ? '<button class="btn btn-primary btn-sm" data-hcs="' + okAction + '" data-arg="' + esc(arg == null ? '' : arg) + '">' + esc(okLabel) + '</button>' : '');
  }
  function stamp(mask, okAction, arg) {
    var m = mask && mask.querySelector('.kb-modal');
    if (m) { m.setAttribute('data-modal', okAction); m.setAttribute('data-arg', arg == null ? '' : arg); }
    return mask;
  }
  function confirmBox(title, msg, okLabel, okAction, arg) {
    var mask = modal(title, '', '<div style="font-size:13px;line-height:1.7;color:#334155">' + msg + '</div>', foot(okLabel || '确定', okAction || 'ok'));
    return stamp(mask, okAction || 'ok', arg);
  }
  /* 表单：fields = [{k,label,type,value,options,ph,full,hint,rows}]
     .kb-form 本身已是两列 grid（见 kb-module.js 的样式），字段直接作为它的 grid item；
     不要再套一层自建 grid——那会让说明文字被挤到右侧空白格。 */
  function formModal(title, sub, fields, okLabel, okAction, arg, note) {
    var html = fields.map(function (f) {
      var id = 'hcs-f-' + f.k, inner;
      if (f.type === 'select') inner = '<select id="' + id + '">' + f.options.map(function (o) { return '<option' + (o === f.value ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>';
      else if (f.type === 'textarea') inner = '<textarea id="' + id + '" rows="' + (f.rows || 4) + '" placeholder="' + esc(f.ph || '') + '">' + esc(f.value || '') + '</textarea>';
      else inner = '<input id="' + id + '" value="' + esc(f.value == null ? '' : f.value) + '" placeholder="' + esc(f.ph || '') + '">';
      return '<div class="kb-f' + (f.full ? ' full' : '') + '"><label>' + (f.req ? '<span class="req">*</span> ' : '') + esc(f.label) + '</label>' + inner +
        (f.hint ? '<div class="hint">' + esc(f.hint) + '</div>' : '') + '</div>';
    }).join('');
    var mask = modal(title, sub, '<div class="kb-form">' + html +
      (note ? '<div class="full hcs-note" style="margin:0">' + note + '</div>' : '') + '</div>', foot(okLabel, okAction));
    var first = mask.querySelector('input,textarea,select');
    if (first) setTimeout(function () { first.focus(); }, 30);
    return stamp(mask, okAction, arg);
  }

  /* ================= 业务动作：会话 ================= */
  function log(by, action, target) { DB.userLogs.unshift({ id: nextId('UL-'), user: by || '管理员', action: action, target: target, time: now() }); }
  var sessionMsgs = function (sid) { var s = find(DB.sessions, sid); return s && s.msgs ? s.msgs : []; };
  function pushMsg(sid, from, role, content) {
    var s = find(DB.sessions, sid); if (!s) return;
    (s.msgs || (s.msgs = [])).push({ id: nextId('MSG-'), from: from, role: role, content: content, time: now() });
    /* 客服/系统发了新消息 → 用户侧聊天窗要立刻反映：正开着这个会话就刷新（同时算已读），
       没开就只更新悬浮按钮上的未读角标。 */
    notifyChat(sid);
  }
  /* 用户侧聊天窗的刷新钩子。CHAT 在下面才声明，但 pushMsg 只在点击后运行，此时已初始化。 */
  function notifyChat(sid) {
    if (typeof CHAT === 'undefined' || !CHAT) return;
    if (CHAT.open && !CHAT.list && CHAT.sid === sid) chatThread(sid);
    else renderChatFab();
  }
  /* 用户主动打开某个会话：进窗口 + 标已读 */
  function openChatSession(sid) {
    CHAT.open = true;
    chatThread(sid);
    markRead(sid);
  }
  function catCount(name) { return cnt(DB.sessions, function (s) { return s.cat === name; }); }

  function threadHtml(sid) {
    var msgs = sessionMsgs(sid);
    if (!msgs.length) return '<div class="hcs-empty">暂无消息记录</div>';
    return msgs.map(function (m) {
      var cls = m.role === '系统' ? 'sys' : (m.role === '客服' ? 'mine' : '');
      return '<div class="hcs-msg ' + cls + '"><div class="who">' + esc(m.from) + ' · ' + esc(m.time) + '</div><div class="bub">' + esc(m.content) + '</div></div>';
    }).join('');
  }
  /* 会话只有一张弹窗：点会话编号、点行内「回复」进的是同一个东西。
     上半是会话信息与消息流，下半是回复框；能不能回复、能不能办结由状态决定，
     不靠两个弹窗分工——否则同一个会话从两个入口看是两副样子。 */
  function openSession(id) {
    var s = find(DB.sessions, id); if (!s) { say('未找到会话 ' + id, 'error'); return; }
    var done = s.status === '已办结';
    var body =
      '<div class="hcs-kv">' +
      '<div><div class="k">咨询人</div><div class="v">' + esc(s.user) + '（' + esc(s.phone) + '）</div></div>' +
      '<div><div class="k">问题分类 / 话题</div><div class="v">' + esc(s.cat) + ' · ' + esc(s.topic || '—') + '</div></div>' +
      '<div><div class="k">状态</div><div class="v">' + badge(s.status) + ' ' + priBadge(s.priority || '低') + '</div></div>' +
      '<div><div class="k">处理人 / 发起时间</div><div class="v">' + esc(s.assignee || '未分配') + ' · ' + esc(s.time) + '</div></div>' +
      '</div>' +
      '<div class="hcs-note"><b>咨询问题：</b>' + esc(s.q) + '</div>' +
      '<div style="font-size:12px;color:#667085;font-weight:600;margin:14px 0 8px">消息流（' + sessionMsgs(id).length + ' 条）</div>' +
      '<div class="hcs-thread">' + threadHtml(id) + '</div>' +
      (done
        ? '<div class="hcs-note" style="border-left-color:#94a3b8;background:#f8fafc;border-color:#e2e8f0">会话已办结，如需继续沟通请重新发起会话。</div>'
        : '<div style="border-top:1px solid var(--border);padding-top:12px">' +
        '<label style="display:block;font-size:12px;color:#475569;font-weight:600;margin-bottom:5px"><span class="req">*</span> 回复内容</label>' +
        '<textarea id="hcs-reply" rows="4" style="width:100%;border:1px solid #d1d8e0;border-radius:4px;padding:8px 10px;font-size:13px;line-height:1.6;box-sizing:border-box;resize:vertical;font-family:inherit" placeholder="请输入回复内容"></textarea>' +
        '<div style="margin-top:8px;font-size:12px;color:#94a3b8">发送后会话状态变为「已回复」</div></div>');
    var ft = '<button class="btn btn-ghost btn-sm" data-hcs="close">关闭</button>';
    if (!done) {
      ft += '<button class="btn btn-outline btn-sm" data-hcs="assignForm" data-arg="' + esc(id) + '">分配 / 改派</button>' +
        '<button class="btn btn-outline btn-sm" data-hcs="closeSession" data-arg="' + esc(id) + '">办结</button>' +
        '<button class="btn btn-primary btn-sm" data-hcs="sendReply" data-arg="' + esc(id) + '">发送回复</button>';
    }
    stamp(modal('会话详情 · ' + id, s.user, body, ft), done ? '' : 'sendReply', id);
  }
  function sendReply(id) {
    var text = val('hcs-reply');
    if (!text) { say('回复内容不能为空', 'error'); return; }
    var s = find(DB.sessions, id);
    var who = s && s.assignee ? s.assignee : '客服';
    pushMsg(id, who, '客服', text);
    if (s) {
      s.status = '已回复';
      if (!s.assignee) {
        s.assignee = who;
        DB.assigns.unshift({ id: nextId('ASG-'), session: id, to: who, note: '回复时自动认领', time: now() });
      }
      var r = aiAnalyze(s.q);
      DB.analysis.push({ id: nextId('AN-'), session: id, topic: s.topic || r.topic, raw: s.q, label: s.cat, intent: r.intent, emotion: r.emotion, urgency: r.urgency, analyzedAt: now() });
    }
    log(who, '回复咨询', id);
    closeModal(); say('回复已发送至 ' + (s ? s.user : id)); refresh();
  }
  /* 分配日志只记「谁被分配、为什么」，不记来源：来源在数据里恒为「客服组长」，
     是同一常量写四行字，既不能筛也不能改，留着只是噪音。 */
  function openAssign(id) {
    var s = find(DB.sessions, id); if (!s) return;
    formModal('分配会话 · ' + id, s.user + ' · ' + s.cat, [
      { k: 'as-to', label: '处理人', type: 'select', req: true, full: true, options: DOCTORS, value: s.assignee || DOCTORS[0] },
      { k: 'as-note', label: '分配说明', full: true, ph: '例如：转肿瘤防治组处理' }
    ], '确认分配', 'doAssign', id, '分配后会话状态变为「处理中」，并写入分配与处理日志。');
  }
  function doAssign(id) {
    var s = find(DB.sessions, id); if (!s) return;
    var to = val('hcs-f-as-to');
    if (!to) { say('请选择处理人', 'error'); return; }
    var note = val('hcs-f-as-note') || '人工分配';
    s.assignee = to; s.status = '处理中';
    DB.assigns.unshift({ id: nextId('ASG-'), session: id, to: to, note: note, time: now() });
    pushMsg(id, '系统', '系统', '本会话已分配给 ' + to + '（' + note + '）');
    log(to, '接收分配', id);
    closeModal(); say('已分配给 ' + to); refresh();
  }
  function closeSession(id) {
    var s = find(DB.sessions, id); if (!s) return;
    confirmBox('办结确认', '确认办结会话 ' + esc(id) + '？办结后不再出现在待办中。', '确认办结', 'doCloseSession', id);
  }
  function doCloseSession(id) {
    var s = find(DB.sessions, id); if (!s) return;
    s.status = '已办结';
    pushMsg(id, '系统', '系统', '会话已办结');
    log(s.assignee || '客服', '办结会话', id);
    closeModal(); say('会话已办结'); refresh();
  }

  /* ---- 问题分类 ---- */
  function openCategory(id) {
    var c = id ? find(DB.categories, id) : null;
    formModal(c ? '编辑分类 · ' + c.name : '新增问题分类', c ? c.id : '分类用于会话归集', [
      { k: 'ct-name', label: '分类名称', req: true, value: c ? c.name : '', ph: '例如：营养与饮食' },
      { k: 'ct-owner', label: '负责人', type: 'select', options: DOCTORS, value: c ? c.owner : DOCTORS[0] },
      { k: 'ct-desc', label: '分类说明', full: true, value: c ? c.desc : '', ph: '一句话描述该分类覆盖的问题范围' },
      { k: 'ct-status', label: '状态', type: 'select', options: ['启用', '停用'], value: c ? c.status : '启用' }
    ], '保存', 'doCategory', id || '');
  }
  function doCategory(id) {
    var c = id ? find(DB.categories, id) : null;
    var name = val('hcs-f-ct-name');
    if (!name) { say('分类名称不能为空', 'error'); return; }
    if (!c && DB.categories.some(function (x) { return x.name === name; })) { say('该分类名称已存在', 'error'); return; }
    if (c) { c.name = name; c.desc = val('hcs-f-ct-desc'); c.owner = val('hcs-f-ct-owner'); c.status = val('hcs-f-ct-status'); }
    else DB.categories.push({ id: nextId('CAT-'), name: name, desc: val('hcs-f-ct-desc'), owner: val('hcs-f-ct-owner'), status: val('hcs-f-ct-status') });
    log('管理员', c ? '编辑问题分类' : '新增问题分类', name);
    closeModal(); say(c ? '分类已更新' : '分类已新增'); refresh();
  }
  function toggleCategory(id) {
    var c = find(DB.categories, id); if (!c) return;
    c.status = c.status === '启用' ? '停用' : '启用';
    log('管理员', c.status === '启用' ? '启用问题分类' : '停用问题分类', c.name);
    say('「' + c.name + '」已' + c.status); refresh();
  }
  function removeCategory(id) {
    var c = find(DB.categories, id); if (!c) return;
    var used = catCount(c.name);
    if (used) { say('该分类下仍有 ' + used + ' 条会话，无法删除，请改为停用', 'error'); return; }
    confirmBox('删除确认', '确认删除分类「' + esc(c.name) + '」？', '删除', 'doRemoveCategory', id);
  }
  function doRemoveCategory(id) {
    var c = find(DB.categories, id); if (!c) return;
    DB.categories = DB.categories.filter(function (x) { return x.id !== id; });
    log('管理员', '删除问题分类', c.name);
    closeModal(); say('分类已删除'); refresh();
  }

  /* ---- 社区：板块 ----
     板块只记名称、说明、状态：版主在原型里没有任何权限差异（谁能审主帖、谁能回复评论
     都与版主字段无关），填了也只是装饰，故整列与表单字段一并去掉。 */
  function boardPostCount(name) { return cnt(DB.posts, function (p) { return p.board === name; }); }
  function openBoard(id) {
    var b = id ? find(DB.boards, id) : null;
    formModal(b ? '编辑板块 · ' + b.name : '新增板块', '板块是社区内容的顶层归类', [
      { k: 'bd-name', label: '板块名称', req: true, value: b ? b.name : '', ph: '例如：病友家属交流区' },
      { k: 'bd-desc', label: '板块说明', full: true, value: b ? b.desc : '', ph: '一句话描述板块定位' },
      { k: 'bd-status', label: '状态', type: 'select', options: ['启用', '停用'], value: b ? b.status : '启用' }
    ], '保存', 'doBoard', id || '');
  }
  function doBoard(id) {
    var b = id ? find(DB.boards, id) : null;
    var name = val('hcs-f-bd-name');
    if (!name) { say('板块名称不能为空', 'error'); return; }
    if (!b && DB.boards.some(function (x) { return x.name === name; })) { say('板块名称已存在', 'error'); return; }
    if (b) { b.name = name; b.desc = val('hcs-f-bd-desc'); b.status = val('hcs-f-bd-status'); }
    else DB.boards.push({ id: nextId('BD-'), name: name, desc: val('hcs-f-bd-desc'), status: val('hcs-f-bd-status') });
    log('运营', b ? '编辑社区板块' : '新增社区板块', name);
    closeModal(); say(b ? '板块已更新' : '板块已新增'); refresh();
  }
  function toggleBoard(id) {
    var b = find(DB.boards, id); if (!b) return;
    b.status = b.status === '启用' ? '停用' : '启用';
    log('运营', b.status === '启用' ? '启用社区板块' : '停用社区板块', b.name);
    say('「' + b.name + '」已' + b.status); refresh();
  }

  /* ---- 社区：主帖 / 评论 / 推荐 ---- */
  function commentCount(pid) { return cnt(DB.comments, function (c) { return c.post === pid; }); }
  function replyCount(pid) { var n = 0; DB.comments.forEach(function (c) { if (c.post === pid) n += (c.replies || []).length; }); return n; }
  /* 后台发帖：社区主帖的唯一生产入口。
     新建一律落在「待审核」——自己发自己审等于没有审核，审核动作对新建内容同样生效；
     编辑不改状态，审核结论只能由审核动作改变。
     正文用知识库那套富文本编辑器（KB.richBox），可粘贴 Word 内容、加粗/小标题/列表/链接，
     并可一键插入科普素材——运营写帖时最常干的事就是把已有科普段落引过来。 */
  function postAuthors() { return ['运营小编'].concat(DOCTORS); }

  /* 可插入的科普素材：知识库上架、本院可见的科普内容 */
  function insertableEdu() {
    return ((window.KB && window.KB.assets) || []).filter(function (a) {
      return (!a.track || a.track === '科普') && a.status === '启用';
    });
  }
  /* 纯文本化：把富文本正文压成列表页那行摘要用的纯文本 */
  function htmlToText(html) {
    var d = document.createElement('div');
    d.innerHTML = String(html || '');
    return String(d.textContent || '').replace(/\s+/g, ' ').trim();
  }
  /* 富文本正文的展示：body 有 HTML 就按 HTML 渲染（内容由后台编辑器产出，
     粘贴时已过 cleanPastedHtml 白名单），没有就退回纯文本段落。
     旧数据只有 content 没有 body，这里必须兼容。 */
  function bodyHtml(p) {
    var b = p && p.body ? String(p.body) : '';
    return b || ('<p>' + esc(p ? p.content : '') + '</p>');
  }
  function openPostForm(id) {
    var p = id ? find(DB.posts, id) : null;
    if (p && (p.status === '已发布' || p.status === '已下架')) {
      say('已发布或已下架的主帖不可编辑，如需修改请先驳回', 'error'); return;
    }
    var boards = DB.boards.filter(function (b) { return b.status === '启用'; });
    if (!boards.length) { say('没有启用的社区板块，请先到「社区板块分类配置」新增或启用板块', 'error'); return; }
    var eduList = insertableEdu();
    var eduOpts = eduList.map(function (e) {
      return '<option value="' + esc(e.id) + '">' + esc(e.title) + '</option>';
    }).join('');
    var body =
      '<div class="kb-form">' +
      '<div class="kb-f"><label><span class="req">*</span> 所属板块</label><select id="hcs-f-ps-board">' +
      boards.map(function (b) { return '<option' + (p && b.name === p.board ? ' selected' : '') + '>' + esc(b.name) + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="kb-f"><label><span class="req">*</span> 作者</label><select id="hcs-f-ps-user">' +
      postAuthors().map(function (d) { return '<option' + (p && d === p.user ? ' selected' : '') + '>' + esc(d) + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="kb-f full"><label><span class="req">*</span> 标题</label>' +
      '<input id="hcs-f-ps-title" value="' + esc(p ? p.title : '') + '" placeholder="一句话说清这篇帖子讲什么"></div>' +
      '<div class="kb-f full"><label><span class="req">*</span> 正文</label>' +
      /* 富文本区：KB.richBox 出一套工具条 + contenteditable 区。
         回填必须优先用 body（HTML），用 content（纯文本）会把段落/标题/链接全压平；
         旧数据没有 body 时才退回纯文本。 */
      (window.KB && window.KB.richBox ? window.KB.richBox('hcs-f-ps-content', p ? bodyHtml(p) : '') :
        '<textarea id="hcs-f-ps-content" rows="8">' + esc(p ? p.content : '') + '</textarea>') +
      '</div>' +
      /* 素材插入：科普内容 */
      '<div class="kb-f full"><label>插入科普素材</label>' +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
      '<select id="hcs-edu-pick" style="flex:1;min-width:220px;height:34px;border:1px solid #d1d8e0;border-radius:6px;padding:0 9px;font-size:13px;background:#fff;box-sizing:border-box">' +
      '<option value="">— 选择知识库上架科普 —</option>' + eduOpts + '</select>' +
      '<button type="button" class="btn btn-outline btn-sm" data-hcs="postInsertEdu">插入正文</button>' +
      '<button type="button" class="btn btn-outline btn-sm" data-hcs="postInsertLink">只插入链接</button>' +
      '</div>' +
      '<div class="hint" style="font-size:11.5px;color:#94a3b8;margin-top:6px;line-height:1.6">' +
      (eduList.length ? '「插入正文」把该科普的标题与正文段落贴到光标处；「只插入链接」插一条指向该科普的引用链接。' : '知识库暂无上架科普内容。') +
      '</div></div>' +
      (p ? '' : '<div class="full hcs-note" style="margin:0">保存后状态为「待审核」，需在列表里点「通过」才发布。</div>') +
      '</div>';
    stamp(modal(p ? '编辑主帖 · ' + p.id : '新增主帖',
      p ? p.status : '支持从 Word / 网页直接粘贴，可插入科普素材',
      body, foot('保存', 'doPost')), 'doPost', id || '');
    /* 富文本工具条要绑事件，否则加粗/列表点了没反应 */
    if (window.KB && window.KB.bindRte) window.KB.bindRte();
    var t = $('hcs-f-ps-title');
    if (!p && t) setTimeout(function () { t.focus(); }, 30);
  }
  /* 把一段 HTML 插到富文本编辑器光标处 */
  function insertToEditor(html) {
    var area = $('hcs-f-ps-content');
    if (!area) { say('正文编辑器未就绪', 'error'); return false; }
    area.focus();
    var sel = window.getSelection();
    /* 光标不在编辑区内（比如刚点完下拉）→ 追加到末尾，不丢内容 */
    var inside = false;
    if (sel && sel.rangeCount) {
      var n = sel.getRangeAt(0).commonAncestorContainer;
      inside = area.contains(n.nodeType === 3 ? n.parentNode : n);
    }
    if (!inside) {
      var r = document.createRange();
      r.selectNodeContents(area);
      r.collapse(false);
      sel.removeAllRanges(); sel.addRange(r);
    }
    var ok = false;
    try { ok = document.execCommand('insertHTML', false, html); } catch (e) { ok = false; }
    if (!ok) area.insertAdjacentHTML('beforeend', html);
    return true;
  }
  function postInsertEdu() {
    var id = val('hcs-edu-pick');
    if (!id) { say('请先选择要插入的科普内容', 'error'); return; }
    var e = find(insertableEdu(), id);
    if (!e) { say('该科普内容不存在或已下架', 'error'); return; }
    /* 标题 + 正文：正文是 HTML，直接嵌入（详情页本来就按 HTML 渲染） */
    var html = '<h3>' + esc(e.title) + '</h3>' + (e.body || ('<p>' + esc(e.summary || '') + '</p>'));
    if (insertToEditor(html)) say('已插入《' + e.title + '》');
  }
  function postInsertLink() {
    var id = val('hcs-edu-pick');
    if (!id) { say('请先选择要引用的科普内容', 'error'); return; }
    var e = find(insertableEdu(), id);
    if (!e) { say('该科普内容不存在或已下架', 'error'); return; }
    var html = '<p>延伸阅读：<a href="javascript:void(0)" data-kb-link="' + esc(e.id) + '">《' + esc(e.title) + '》</a></p>';
    if (insertToEditor(html)) say('已插入引用链接');
  }
  function doPost(id) {
    var p = id ? find(DB.posts, id) : null;
    var title = val('hcs-f-ps-title');
    /* 正文取值：富文本区是 contenteditable，没有 .value */
    var raw = (window.KB && window.KB.rteHtml) ? window.KB.rteHtml('hcs-f-ps-content') : val('hcs-f-ps-content');
    var plain = htmlToText(raw);
    if (!title || !plain) { say('标题与正文必填', 'error'); return; }
    var board = val('hcs-f-ps-board'), user = val('hcs-f-ps-user');
    /* content 存纯文本（列表摘要、卡片摘要都用它），body 存富文本 HTML */
    if (p) {
      p.title = title; p.content = plain; p.body = raw; p.board = board; p.user = user;
      log('运营', '编辑主帖', p.id);
      closeModal(); say('主帖已更新'); refresh();
    } else {
      var rec = {
        id: nextId('PT-'), board: board, user: user, title: title,
        content: plain, body: raw,
        views: 0, likes: 0, status: '待审核', time: now()
      };
      DB.posts.unshift(rec);
      log('运营', '新增主帖', rec.id);
      closeModal(); say('主帖已创建，等待审核'); refresh();
    }
  }
  function openPost(id) {
    var p = find(DB.posts, id); if (!p) return;
    var cs = DB.comments.filter(function (c) { return c.post === id; });
    var body =
      '<div class="hcs-note"><b>' + esc(p.title) + '</b><div class="hcs-body">' + bodyHtml(p) + '</div></div>' +
      '<div class="hcs-kv">' +
      '<div><div class="k">所属板块 / 作者</div><div class="v">' + esc(p.board) + ' · ' + esc(p.user) + '</div></div>' +
      '<div><div class="k">发布时间 / 状态</div><div class="v">' + esc(p.time) + ' ' + badge(p.status) + '</div></div>' +
      '<div><div class="k">浏览 / 点赞</div><div class="v">' + p.views + ' / ' + p.likes + '</div></div>' +
      '<div><div class="k">评论 / 官方回复</div><div class="v">' + cs.length + ' / ' + cs.reduce(function (n, c) { return n + (c.replies || []).length; }, 0) + '</div></div>' +
      '</div>' +
      (p.rejectReason ? '<div class="hcs-note" style="border-left-color:#b42335;background:#fff5f5;border-color:#f3cccc">驳回原因：' + esc(p.rejectReason) + '</div>' : '') +
      '<div style="font-size:12px;color:#667085;font-weight:600;margin-bottom:8px">评论（' + cs.length + ' 条）</div>' +
      (cs.length ? cs.map(function (c) {
        return '<div class="hcs-item"><div class="tt">' + esc(c.user) + ' <span style="font-weight:400;color:#94a3b8;font-size:11px">' + esc(c.time) + '</span></div>' +
          '<div class="ds">' + esc(c.content) + '</div>' +
          ((c.replies || []).length ? '<div class="ds" style="color:#244765">' + c.replies.map(function (r) { return '↳ ' + esc(r.content); }).join('<br>') + '</div>' : '') +
          '<div class="ds">' + badge(c.status) + ' ' + act('回复', 'replyForm', c.id) + '</div></div>';
      }).join('') : '<div class="hcs-empty">该主帖暂无评论</div>');
    var ft = '<button class="btn btn-ghost btn-sm" data-hcs="close">关闭</button>';
    if (p.status === '待审核') {
      ft += '<button class="btn btn-outline btn-sm" data-hcs="editPost" data-arg="' + esc(id) + '">编辑</button>' +
        '<button class="btn btn-outline btn-sm" data-hcs="rejectPost" data-arg="' + esc(id) + '">驳回</button>' +
        '<button class="btn btn-primary btn-sm" data-hcs="approvePost" data-arg="' + esc(id) + '">审核通过</button>';
    } else if (p.status === '已发布') {
      ft += '<button class="btn btn-outline btn-sm" data-hcs="unpublishPost" data-arg="' + esc(id) + '">下架</button>';
    } else {
      ft += '<button class="btn btn-outline btn-sm" data-hcs="editPost" data-arg="' + esc(id) + '">编辑</button>' +
        '<button class="btn btn-primary btn-sm" data-hcs="approvePost" data-arg="' + esc(id) + '">重新提交审核</button>';
    }
    modal('主帖详情 · ' + id, p.board, body, ft);
  }
  /* 列表里的操作只留一个上下架开关：上架即发布（待审核 / 已驳回 / 已下架都能一步上架），
     下架即撤出患者端。查看、编辑、驳回、审核通过都收进点标题打开的详情弹窗——
     列表是"扫一眼批量处理"的地方，一行三个按钮既挤又容易点错。 */
  function publishPost(id) {
    var p = find(DB.posts, id); if (!p) return;
    var pending = p.status === '待审核';
    p.status = '已发布'; p.time = now(); p.rejectReason = '';
    log('运营', pending ? '审核通过主帖' : '上架主帖', id);
    closeModal(); say(pending ? '主帖《' + p.title + '》已发布' : '主帖《' + p.title + '》已上架'); refresh();
  }
  function approvePost(id) { publishPost(id); }
  function rejectPost(id) {
    var p = find(DB.posts, id); if (!p) return;
    formModal('驳回主帖 · ' + id, p.title,
      [{ k: 'rj-reason', label: '驳回原因', type: 'textarea', req: true, full: true, ph: '请说明驳回原因，将通知作者' }],
      '确认驳回', 'doReject', id);
  }
  function doReject(id) {
    var p = find(DB.posts, id); if (!p) return;
    var r = val('hcs-f-rj-reason');
    if (!r) { say('请填写驳回原因', 'error'); return; }
    p.status = '已驳回'; p.rejectReason = r;
    log('运营', '驳回主帖', id);
    closeModal(); say('主帖已驳回并通知作者'); refresh();
  }
  function unpublishPost(id) {
    var p = find(DB.posts, id); if (!p) return;
    confirmBox('下架确认', '确认下架主帖《' + esc(p.title) + '》？下架后患者端不再展示。', '确认下架', 'doUnpublishPost', id);
  }
  function doUnpublishPost(id) {
    var p = find(DB.posts, id); if (!p) return;
    p.status = '已下架';
    log('运营', '下架主帖', id);
    closeModal(); say('主帖已下架'); refresh();
  }
  /* 回复评论只有内容，不记回复人：本模块的官方回复对外就是一个「官方」身份，
     谁点的回复不改变展示，选一个医生名字只是让同一句话换个署名，没有业务含义。 */
  function openCommentReply(id) {
    var c = find(DB.comments, id); if (!c) return;
    formModal('回复评论 · ' + id, '主帖 ' + c.post, [
      { k: 'cr-text', label: '回复内容', type: 'textarea', req: true, full: true, ph: '请输入官方回复内容' }
    ], '发送回复', 'doCommentReply', id, '回复展示在评论下方，并把该评论状态置为「正常」。');
    var bd = document.querySelector('.kb-mask .bd');
    if (bd) bd.insertAdjacentHTML('afterbegin', '<div class="hcs-note"><b>' + esc(c.user) + '：</b>' + esc(c.content) + '</div>');
  }
  function doCommentReply(id) {
    var c = find(DB.comments, id); if (!c) return;
    var text = val('hcs-f-cr-text');
    if (!text) { say('回复内容不能为空', 'error'); return; }
    c.replies = c.replies || [];
    c.replies.push({ content: text, time: now() });
    if (c.status === '待审核') c.status = '正常';
    log('运营', '回复评论', id);
    closeModal(); say('回复已发布'); refresh();
  }
  function hideComment(id) {
    var c = find(DB.comments, id); if (!c) return;
    c.status = c.status === '已屏蔽' ? '正常' : '已屏蔽';
    log('运营', c.status === '已屏蔽' ? '屏蔽评论' : '恢复评论', id);
    say(c.status === '已屏蔽' ? '评论已屏蔽' : '评论已恢复'); refresh();
  }
  function removeComment(id) {
    var c = find(DB.comments, id); if (!c) return;
    confirmBox('删除确认', '确认删除该评论及其 ' + (c.replies || []).length + ' 条回复？', '删除', 'doRemoveComment', id);
  }
  function doRemoveComment(id) {
    var c = find(DB.comments, id); if (!c) return;
    DB.comments = DB.comments.filter(function (x) { return x.id !== id; });
    log('运营', '删除评论', id);
    closeModal(); say('评论已删除'); refresh();
  }
  function recOf(pid) { return DB.recommends.filter(function (x) { return x.post === pid; })[0]; }
  function toggleRecommend(pid) {
    var p = find(DB.posts, pid); if (!p) return;
    if (p.status !== '已发布') { say('仅已发布主帖可设推荐', 'error'); return; }
    var r = recOf(pid);
    if (!r) { DB.recommends.unshift({ id: nextId('RC-'), post: pid, status: '已推荐' }); log('运营', '推荐内容', pid); say('已加入优质内容推荐'); }
    else if (r.status === '已推荐') { r.status = '未推荐'; log('运营', '取消推荐', pid); say('已取消推荐'); }
    else { r.status = '已推荐'; log('运营', '推荐内容', pid); say('已设为推荐'); }
    refresh();
  }

  /* ---- 举报处置 ----
     举报是用户行为日志里唯一需要运营出手的一类。处置必须**真正作用到被举报对象**，
     只改日志状态等于自欺欺人：报告说"已处置"，帖子还挂在那儿。
     三种结论：
       下架内容   → 主帖置「已下架」/ 评论置「已屏蔽」
       屏蔽评论   → 仅对评论有效
       举报不成立 → 内容不动，只留结论
     目标对象已不存在时，只允许选「举报不成立」，避免产生指向空对象的处置记录。 */
  function reportTarget(logRec) {
    var t = String(logRec.target || '');
    if (/^PT-/.test(t)) { var p = find(DB.posts, t); return p ? { kind: 'post', rec: p } : null; }
    if (/^CM-/.test(t)) { var c = find(DB.comments, t); return c ? { kind: 'comment', rec: c } : null; }
    return null;
  }
  function openReport(id) {
    var lg = find(DB.userLogs, id); if (!lg) return;
    var tgt = reportTarget(lg);
    var closed = lg.handle === '已处置' || lg.handle === '举报不成立';
    var targetDesc = tgt
      ? (tgt.kind === 'post' ? '主帖《' + tgt.rec.title + '》' : '评论：' + tgt.rec.content)
      : '（被举报对象已不存在）';
    var body =
      '<div class="hcs-kv">' +
      '<div><div class="k">举报人 / 时间</div><div class="v">' + esc(lg.user) + ' · ' + esc(lg.time) + '</div></div>' +
      '<div><div class="k">处置状态</div><div class="v">' + badge(lg.handle || '待处置') + '</div></div>' +
      '</div>' +
      '<div class="hcs-note"><b>举报理由：</b>' + esc(lg.reason || '—') + '</div>' +
      '<div class="hcs-note"><b>被举报对象：</b>' + esc(targetDesc) + '</div>' +
      (closed ? '<div class="hcs-note" style="border-left-color:#2e7d32;background:#f2fbf3;border-color:#cfe8d2"><b>处置结论：</b>' +
        esc(lg.conclusion || '—') + '<br><span style="font-size:11.5px;color:#64748b">' + esc(lg.handledBy || '') + ' · ' + esc(lg.handledAt || '') + '</span></div>' : '');
    if (closed) {
      modal('举报详情 · ' + id, lg.target, body, '<button class="btn btn-ghost btn-sm" data-hcs="close">关闭</button>');
      return;
    }
    /* 未处置：给出结论选项。目标不存在时只剩「举报不成立」 */
    var opts = [];
    if (tgt) opts.push('下架内容');
    if (tgt && tgt.kind === 'comment') opts.push('屏蔽评论');
    opts.push('举报不成立');
    body += '<div class="kb-form" style="margin-top:12px">' +
      '<div class="kb-f"><label><span class="req">*</span> 处置结论</label><select id="hcs-rp-action">' +
      opts.map(function (o) { return '<option>' + esc(o) + '</option>'; }).join('') + '</select></div>' +
      '<div class="kb-f"><label>处置人</label><select id="hcs-rp-by">' +
      DOCTORS.concat(['运营小编']).map(function (d) { return '<option>' + d + '</option>'; }).join('') + '</select></div>' +
      '<div class="kb-f full"><label><span class="req">*</span> 处置说明</label>' +
      '<textarea id="hcs-rp-conclusion" rows="3" placeholder="记录核查过程与依据，将留存在日志中"></textarea></div>' +
      '</div>';
    stamp(modal('处置举报 · ' + id, lg.target, body, foot('提交处置', 'doReport')), 'doReport', id);
  }
  function doReport(id) {
    var lg = find(DB.userLogs, id); if (!lg) return;
    var action = val('hcs-rp-action'), by = val('hcs-rp-by') || '运营小编', concl = val('hcs-rp-conclusion');
    if (!concl) { say('请填写处置说明', 'error'); return; }
    var tgt = reportTarget(lg);
    if (action === '下架内容') {
      if (!tgt) { say('被举报对象已不存在，只能选择「举报不成立」', 'error'); return; }
      if (tgt.kind === 'post') { tgt.rec.status = '已下架'; tgt.rec.rejectReason = concl; }
      else { tgt.rec.status = '已屏蔽'; }
      log(by, tgt.kind === 'post' ? '举报处置：下架主帖' : '举报处置：下架评论', lg.target);
    } else if (action === '屏蔽评论') {
      if (!tgt || tgt.kind !== 'comment') { say('该举报对象不是评论，无法屏蔽', 'error'); return; }
      tgt.rec.status = '已屏蔽';
      log(by, '举报处置：屏蔽评论', lg.target);
    } else {
      log(by, '举报处置：举报不成立', lg.target);
    }
    lg.handle = action === '举报不成立' ? '举报不成立' : '已处置';
    lg.conclusion = concl;
    lg.handledBy = by;
    lg.handledAt = now();
    closeModal(); say('举报已' + lg.handle); refresh();
  }

  /* ============================================================
     三级页面：社区主页（用户侧）
     ------------------------------------------------------------
     这是「互动社区」五个后台页面的**数据生产端**：用户在这里看到的每一件东西
     都来自后台表，用户在这里做的每一个动作都写回后台表（并留行为日志）。
       浏览      → posts.views + 1
       点赞      → posts.likes ± 1
       评论      → 写 DB.comments（状态「待审核」，等后台审核）
       举报      → 写 DB.userLogs（action=举报内容，handle=待处置）
       发起咨询  → 写 DB.sessions（状态「待分配」）+ DB.analysis
     只展示「已发布」内容——后台的审核、下架、屏蔽必须在这里真实生效，
     否则后台那些按钮就是摆设。
     ============================================================ */
  var HOME = { board: '全部', kw: '', uid: '访客用户' };
  var LIKED = {};    /* 本次会话内点过赞的主帖，防止重复计数 */
  var VIEWED = null;  /* 最近浏览过的主帖 id*/

  function homePosts() {
    var kw = String(HOME.kw || '').toLowerCase();
    return DB.posts.filter(function (p) {
      if (p.status !== '已发布') return false;
      if (HOME.board !== '全部' && p.board !== HOME.board) return false;
      if (kw && (p.title + p.content + p.user).toLowerCase().indexOf(kw) < 0) return false;
      return true;
    }).sort(function (a, b) { return (b.time || '') < (a.time || '') ? -1 : (b.time || '') > (a.time || '') ? 1 : 0; });
  }
  function homeBoards() {
    return DB.boards.filter(function (b) { return b.status === '启用'; });
  }
  function homeRecommended() {
    return DB.recommends.filter(function (r) { return r.status === '已推荐'; })
      .map(function (r) { return find(DB.posts, r.post); })
      .filter(function (p) { return p && p.status === '已发布'; });
  }
  function homeHotTopics() {
    var st = catStat();
    return st.list.slice(0, 5);
  }
  /* 卡片：与「科普内容」同结构（封面带形式角标 → 标题两行 → 摘要一行 → 作者 → 互动底栏） */
  var BOARD_TONE = { '康复互助圈': 'art', '专家讲堂': 'video', '营养咨询': 'slide', '心情树洞': 'banner' };
  function postCard(p) {
    var liked = !!LIKED[p.id];
    var cm = commentCount(p.id);
    var tone = BOARD_TONE[p.board] || 'manual';
    return '<div class="kbx-card" data-post="' + esc(p.id) + '">' +
      '<a href="javascript:void(0)" class="kbx-card-hit" data-hcs="homeOpenPost" data-arg="' + esc(p.id) + '">' +
      '<span class="kbx-card-cover-wrap kbx-cover--' + tone + '">' +
      '<span class="kbx-card-cover"><span class="hcs-cover-word">' + esc(String(p.board || '社区').slice(0, 2)) + '</span></span>' +
      '<span class="kbx-card-kind">' + esc(p.board) + '</span>' +
      '<span class="hcs-cover-board">' + p.views + ' 浏览</span>' +
      '</span>' +
      '<span class="kbx-card-body">' +
      '<span class="kbx-card-title">' + esc(p.title) + '</span>' +
      '<span class="kbx-card-desc">' + esc(p.content) + '</span>' +
      '</span>' +
      '</a>' +
      '<div class="kbx-card-up"><b>' + esc(p.user) + '</b><span class="kbx-card-up-org">' + esc(p.time) + '</span></div>' +
      '<div class="hcs-metabar">' +
      '<span class="lk' + (liked ? ' on' : '') + '" data-hcs="homeLike" data-arg="' + esc(p.id) + '">' +
      (liked ? '♥' : '♡') + ' ' + p.likes + '</span>' +
      '<span class="lk" data-hcs="homeOpenPost" data-arg="' + esc(p.id) + '">💬 ' + cm + '</span>' +
      '<span class="lk rp" data-hcs="homeReport" data-arg="' + esc(p.id) + '">举报</span>' +
      '</div></div>';
  }

  function tHome() {
    var list = homePosts();
    var boards = homeBoards();
    var id = 'hc-home';
    var cur = S.pageNo[id] || 1, PAGE = 8;
    var pages = Math.max(1, Math.ceil(list.length / PAGE));
    if (cur > pages) { cur = pages; S.pageNo[id] = cur; }
    var picks = list.slice((cur - 1) * PAGE, cur * PAGE);

    /* 工具栏：与科普内容页一致，右上只放动作 */
    var toolbar = '<div class="page-toolbar"><div class="page-toolbar-title">社区主页</div>' +
      '<div class="toolbar-actions">' +
      '<button class="btn btn-primary btn-sm" data-hcs="homeAskForm">+ 在线咨询</button>' +
      '</div></div>';

    /* 筛选条：每个控件都带 label，与科普内容页同形制 */
    var filter = '<div class="filter-toolbar">' +
      '<div class="form-group search-group"><label>关键词</label>' +
      '<input data-hcs-kw="hc-home" data-k="kw" value="' + esc(HOME.kw || '') + '" placeholder="标题 / 内容 / 作者"></div>' +
      '<div class="form-group"><label>板块</label><select data-hcs-filter="hc-home" data-k="board">' +
      ['全部'].concat(boards.map(function (b) { return b.name; })).map(function (b) {
        return '<option' + (b === HOME.board ? ' selected' : '') + '>' + esc(b) + '</option>';
      }).join('') + '</select></div>' +
      '<div class="filter-actions"><button class="btn btn-ghost btn-sm" data-hcs="homeReset">重置</button>' +
      '<button class="btn btn-primary btn-sm" data-hcs="homeQuery">查询</button></div></div>';

    /* 卡片网格：与科普内容页同一套 .kb-cards（4 列）。
       已发布不足一列时补一张「引导卡」占位，但只在没有筛选条件时补——
       筛选后还塞引导卡会让人以为那是搜索结果。 */
    var cards;
    if (picks.length) {
      var need = (4 - picks.length % 4) % 4;
      var filler = '';
      if (need && need < 4 && HOME.board === '全部' && !HOME.kw && cur === 1) {
        filler = '<div class="kbx-card hcs-invite" data-hcs="homeAskForm" style="cursor:pointer">' +
          '<span class="kbx-card-cover-wrap" style="background:linear-gradient(135deg,#f4f8fd,#e6eef8)">' +
          '<span class="kbx-card-cover"><span style="font-size:30px;color:#b6c8da">＋</span></span></span>' +
          '<span class="kbx-card-body"><span class="kbx-card-title" style="color:#33536f">有问题想问医生？</span>' +
          '<span class="kbx-card-desc">提交咨询，由院内客服分诊</span></span></div>';
      }
      cards = '<div class="kb-cards hcs-home-cards">' + picks.map(postCard).join('') + filler + '</div>';
    } else {
      cards = '<div class="kb-empty">' + (list.length ? '没有符合条件的内容' : '该板块暂无已发布内容') + '</div>';
    }

    var pagerHtml = '';
    if (list.length > PAGE) {
      var btns = '';
      for (var i = 1; i <= pages; i++) btns += '<button class="btn ' + (i === cur ? 'btn-primary' : 'btn-ghost') + ' btn-sm" style="min-width:30px" data-hcs="homePage" data-arg="' + i + '">' + i + '</button>';
      pagerHtml = '<div style="display:flex;gap:6px;align-items:center;justify-content:flex-end;padding-top:10px;font-size:12px;color:#64748b">' +
        '<span style="margin-right:auto">共 ' + list.length + ' 条</span>' + btns + '</div>';
    }

    return toolbar + filter + cards + pagerHtml;
  }
  /* 在线咨询：做成弹窗，不占卡片网格宽度（科普内容页也是右上按钮进弹窗） */
  /* ============================================================
     在线咨询聊天窗
     ------------------------------------------------------------
     做成常驻的悬浮聊天窗，而不是一次性弹窗：咨询是「说一句、等回复、再追问」的过程，
     提交完就关掉的话，用户看不到回复，客服那边也永远等不到第二次发言。
     结构：
       会话列表（我的咨询，带未读角标）  →  点进去是聊天窗
       新会话先选分类写首问，之后就能连续追问
     未读计数 = 用户已读位置之后、客服发来的消息条数（readCount 记录已读到的消息条数）。
     ============================================================ */
  var CHAT = { open: false, sid: null, list: true };

  /* 我发起的会话：主页咨询创建的都是访客身份，这里按 uid 过滤 */
  function mySessions() {
    return DB.sessions.filter(function (s) { return s.user === HOME.uid || s.fromHome; })
      .slice().sort(function (a, b) { return (b.time || '') < (a.time || '') ? -1 : 1; });
  }
  /* 未读：用户已读位置之后、客服发来的消息条数。
     用「已读条数 readCount」而不是「已读时间戳」：
     时间戳只精确到分钟，同一分钟内发来的消息比较结果全部相等，
     未读会被永久算成 0——这在实际聊天里是最常见的情形（一问一答都在同一分钟）。 */
  function unreadOf(s) {
    var msgs = s.msgs || [];
    var seen = s.readCount == null ? 0 : s.readCount;
    var n = 0;
    for (var i = seen; i < msgs.length; i++) {
      if (msgs[i].role === '客服') n += 1;
    }
    return n;
  }
  function unreadTotal() { return mySessions().reduce(function (n, s) { return n + unreadOf(s); }, 0); }
  function lastMsgOf(s) { var m = s.msgs || []; return m.length ? m[m.length - 1] : null; }

  function renderChatFab() {
    var old = $('hcsChatFab');
    if (old) old.remove();
    var n = unreadTotal();
    var b = document.createElement('button');
    b.id = 'hcsChatFab';
    b.className = 'hcs-chat-fab';
    b.setAttribute('data-hcs', 'chatToggle');
    b.innerHTML = '<span>在线咨询</span>' + (n ? '<span class="n">' + n + '</span>' : '');
    document.body.appendChild(b);
  }
  function chatShell(inner) {
    var old = $('hcsChat'); if (old) old.remove();
    var el = document.createElement('div');
    el.id = 'hcsChat';
    el.className = 'hcs-chat';
    el.innerHTML = '<div class="hcs-chat-hd">' +
      (CHAT.list ? '' : '<button class="back" data-hcs="chatList" title="返回会话列表">‹</button>') +
      '<span class="t">' + (CHAT.list ? '在线咨询' : esc(((find(DB.sessions, CHAT.sid) || {}).user) || '咨询')) + '</span>' +
      (CHAT.list ? '<span class="s">院内客服分诊</span>' : '<span class="s">' + esc(((find(DB.sessions, CHAT.sid) || {}).status) || '') + '</span>') +
      '<button class="x" data-hcs="chatClose" title="收起">×</button></div>' +
      inner;
    document.body.appendChild(el);
    var bd = el.querySelector('.hcs-chat-bd');
    if (bd) setTimeout(function () { bd.scrollTop = bd.scrollHeight; }, 20);
    return el;
  }
  function openChat() { CHAT.open = true; CHAT.sid = null; CHAT.list = true; paintChat(); }
  function closeChat() { CHAT.open = false; CHAT.list = true; CHAT.sid = null; var el = $('hcsChat'); if (el) el.remove(); }
  /* 状态以 DOM 为准：外部（换页、脚本、浏览器行为）把节点删掉时，CHAT.open 不能还停在 true，
     否则点悬浮按钮会去「关闭」一个不存在的东西，界面看起来彻底失灵。 */
  function chatIsOpen() { return !!$('hcsChat'); }
  function paintChat() {
    /* 只有「要求开着」时才画。画不画由调用方决定，这里不再拿 DOM 反推—— 
       chatShell 是本次调用里才创建节点的，画之前 DOM 必然不存在。 */
    if (!CHAT.open) { var e = $('hcsChat'); if (e) e.remove(); renderChatFab(); return; }
    if (CHAT.list || !CHAT.sid) chatList(); else chatThread(CHAT.sid);
    renderChatFab();
  }
  function chatList() {
    CHAT.list = true; CHAT.sid = null;
    var list = mySessions();
    var inner = '<div class="hcs-chat-bd">' +
      (list.length ? list.map(function (s) {
        var last = lastMsgOf(s), un = unreadOf(s);
        return '<div class="hcs-chat-item" data-hcs="chatOpenSession" data-arg="' + esc(s.id) + '">' +
          '<span class="av">' + esc(String(s.user || '访').slice(0, 1)) + '</span>' +
          '<div class="cn"><div class="ct"><span>' + esc(s.cat) + '</span>' +
          '<span style="font-weight:400;color:#94a3b8">' + esc(s.id) + '</span>' +
          (un ? '<span class="n">' + un + '</span>' : '') + '</div>' +
          '<div class="cm">' + (last ? esc(String(last.content).slice(0, 40)) : '暂无消息') + '</div></div></div>';
      }).join('') : '<div class="hcs-chat-empty">还没有咨询记录<br>点下方按钮发起第一次咨询</div>') +
      '</div>' +
      '<div class="hcs-chat-ft"><button class="hcs-chat-new" data-hcs="chatNew">+ 发起新咨询</button></div>';
    chatShell(inner);
  }
  function chatThread(sid) {
    var s = find(DB.sessions, sid);
    if (!s) { chatList(); return; }
    CHAT.list = false; CHAT.sid = sid;
    var msgs = s.msgs || [];
    var inner = '<div class="hcs-chat-bd">' +
      (msgs.length ? msgs.map(function (m) {
        var cls = m.role === '系统' ? 'sys' : (m.role === '用户' ? 'mine' : '');
        return '<div class="hcs-cmsg ' + cls + '"><div class="who">' + esc(m.from) + ' · ' + esc(m.time) + '</div>' +
          '<div class="bub">' + esc(m.content) + '</div></div>';
      }).join('') : '<div class="hcs-chat-empty">还没有消息</div>') +
      '</div>' +
      (s.status === '已办结'
        ? '<div class="hcs-chat-ft"><div class="tip">该咨询已办结。如需继续，请发起新咨询。</div></div>'
        : '<div class="hcs-chat-ft"><div class="row">' +
        '<textarea id="hcs-chat-input" placeholder="继续追问…（Enter 发送，Shift+Enter 换行）"></textarea>' +
        '<button class="btn btn-primary btn-sm" data-hcs="chatSend" style="height:58px;padding:0 14px">发送</button>' +
        '</div><div class="tip">客服回复后这里会实时显示</div></div>');
    chatShell(inner);
    renderChatFab();
  }
  /* 标记已读：只在「用户真正看到」时调用——打开会话、切回该会话、或用户在里面发言。
     不能放在 chatThread 里（渲染即已读），否则客服刚发的消息用户还没看就被吞了，
     未读角标永远是 0，消息提醒等于没有。 */
  function markRead(sid) {
    var s = find(DB.sessions, sid);
    if (!s) return;
    s.readCount = (s.msgs || []).length;
    renderChatFab();
  }
  /* 新建：先选分类 + 首问 */
  function chatNew() {
    var catOpts = DB.categories.filter(function (c) { return c.status === '启用'; }).map(function (c) { return c.name; });
    var inner = '<div class="hcs-chat-bd" style="background:#fff">' +
      '<div class="hcs-askf" style="padding:2px 2px 0">' +
      '<div class="row"><label><span class="req">*</span> 问题分类</label><select id="hcs-ask-cat">' +
      catOpts.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '</select></div>' +
      '<div class="row"><label><span class="req">*</span> 您的问题</label>' +
      '<textarea id="hcs-ask-q" rows="5" placeholder="请描述目前的诊断、治疗阶段和具体困惑…"></textarea></div>' +
      '<div class="row"><label>您的称呼</label><input id="hcs-ask-name" placeholder="选填，便于客服称呼您"></div>' +
      '</div></div>' +
      '<div class="hcs-chat-ft"><div style="display:flex;gap:8px">' +
      '<button class="btn btn-ghost btn-sm" data-hcs="chatList">返回</button>' +
      '<button class="btn btn-primary btn-sm" style="flex:1" data-hcs="homeAsk">提交咨询</button></div></div>';
    chatShell(inner);
    var ta = $('hcs-ask-q');
    if (ta) setTimeout(function () { ta.focus(); }, 40);
  }
  /* 会话内追问 */
  function chatSend() {
    var s = find(DB.sessions, CHAT.sid);
    if (!s) return;
    var ta = $('hcs-chat-input');
    var text = ta ? String(ta.value || '').trim() : '';
    if (!text) { say('请输入内容', 'error'); return; }
    if (s.status === '已办结') { say('该咨询已办结，请发起新咨询', 'error'); return; }
    s.msgs = s.msgs || [];
    s.msgs.push({ id: nextId('MSG-'), from: s.user, role: '用户', content: text, time: now() });
    /* 用户追问后重新进入待回复：已回复/处理中 都退回到处理中，让客服队列能捞到 */
    if (s.status === '已回复') s.status = '处理中';
    log(s.user, '追问咨询', s.id);
    if (ta) ta.value = '';
    chatThread(s.id);
    markRead(s.id);
    if (typeof S !== 'undefined' && S.pageId === 'hc-consult') refresh();
  }
  /* 兼容旧的入口名：主页/卡片都还能打开聊天窗 */
  function openHomeAsk() { CHAT.open = true; chatNew(); }
  function homeReset() {
    HOME.board = '全部'; HOME.kw = '';
    S.pageNo['hc-home'] = 1;
    render('hc-home');
  }
  function homeQuery() {
    var kwEl = document.querySelector('[data-hcs-kw="hc-home"][data-k="kw"]');
    HOME.kw = kwEl ? String(kwEl.value || '').trim() : '';
    var sel = document.querySelector('[data-hcs-filter="hc-home"][data-k="board"]');
    if (sel) HOME.board = sel.value;
    S.pageNo['hc-home'] = 1;
    render('hc-home');
  }

  function homeOpenPost(id) {
    var p = find(DB.posts, id);
    if (!p || p.status !== '已发布') { say('该内容已下架或不存在', 'error'); return; }
    p.views += 1;
    VIEWED = id;
    var cs = DB.comments.filter(function (c) { return c.post === id && c.status === '正常'; });
    var liked = !!LIKED[id];
    var body =
      '<div class="hcs-note"><b>' + esc(p.title) + '</b><div class="hcs-body">' + bodyHtml(p) + '</div></div>' +
      '<div class="hcs-kv">' +
      '<div><div class="k">作者 / 板块</div><div class="v">' + esc(p.user) + ' · ' + esc(p.board) + '</div></div>' +
      '<div><div class="k">发布 / 浏览</div><div class="v">' + esc(p.time) + ' · ' + p.views + '</div></div>' +
      '</div>' +
      '<div style="display:flex;gap:10px;align-items:center;margin-bottom:12px">' +
      '<button class="btn ' + (liked ? 'btn-danger' : 'btn-outline') + ' btn-sm" data-hcs="homeLike" data-arg="' + esc(id) + '">' +
      (liked ? '♥ 已赞 ' : '♡ 点赞 ') + p.likes + '</button>' +
      '<button class="btn btn-ghost btn-sm" data-hcs="homeReport" data-arg="' + esc(id) + '">举报</button></div>' +
      '<div style="font-size:12px;color:#667085;font-weight:600;margin-bottom:8px">评论（' + cs.length + ' 条）</div>' +
      (cs.length ? cs.map(function (c) {
        return '<div class="hcs-item"><div class="tt">' + esc(c.user) + ' <span style="font-weight:400;color:#94a3b8;font-size:11px">' + esc(c.time) + '</span></div>' +
          '<div class="ds">' + esc(c.content) + '</div>' +
          ((c.replies || []).length ? '<div class="ds" style="color:#244765">' + c.replies.map(function (r) { return '↳ ' + esc(r.content); }).join('<br>') + '</div>' : '') +
          '</div>';
      }).join('') : '<div class="hcs-empty">还没有评论，来说两句</div>') +
      '<div style="border-top:1px solid var(--border);padding-top:12px;margin-top:4px">' +
      '<label style="display:block;font-size:12px;color:#475569;font-weight:600;margin-bottom:5px">发表评论</label>' +
      '<textarea id="hcs-home-cm" rows="3" style="width:100%;border:1px solid #d1d8e0;border-radius:4px;padding:8px 10px;font-size:13px;line-height:1.6;box-sizing:border-box;resize:vertical;font-family:inherit" placeholder="友善交流，请勿发布未经验证的偏方"></textarea>' +
      '<div style="margin-top:6px;font-size:11.5px;color:#94a3b8">评论提交后需经运营审核才会展示</div></div>';
    stamp(modal('帖子详情 · ' + id, p.board, body,
      '<button class="btn btn-ghost btn-sm" data-hcs="close">关闭</button>' +
      '<button class="btn btn-primary btn-sm" data-hcs="homeComment" data-arg="' + esc(id) + '">发表评论</button>'),
      'homeComment', id);
  }
  function homeComment(id) {
    var p = find(DB.posts, id); if (!p) return;
    var text = val('hcs-home-cm');
    if (!text) { say('评论内容不能为空', 'error'); return; }
    DB.comments.push({
      id: nextId('CM-'), post: id, user: HOME.uid, content: text,
      like: 0, time: now(), status: '待审核', replies: []
    });
    log(HOME.uid, '发表评论', id);
    closeModal(); say('评论已提交，等待运营审核后展示'); refresh();
  }
  function homeLike(id) {
    var p = find(DB.posts, id);
    if (!p || p.status !== '已发布') { say('该内容已下架', 'error'); return; }
    if (LIKED[id]) { LIKED[id] = false; p.likes = Math.max(0, p.likes - 1); }
    else { LIKED[id] = true; p.likes += 1; log(HOME.uid, '点赞', id); }
    refresh();
  }
  function homeReport(id) {
    var p = find(DB.posts, id);
    if (!p || p.status !== '已发布') { say('该内容已下架', 'error'); return; }
    formModal('举报内容 · ' + id, p.title,
      [{ k: 'hr-reason', label: '举报理由', type: 'textarea', req: true, full: true, rows: 4, ph: '请说明该内容存在的问题，如不实信息、广告引流等' }],
      '提交举报', 'doHomeReport', id, '举报将进入「社区用户行为日志」，由运营核查处置。');
  }
  function doHomeReport(id) {
    var reason = val('hcs-f-hr-reason');
    if (!reason) { say('请填写举报理由', 'error'); return; }
    DB.userLogs.unshift({
      id: nextId('UL-'), user: HOME.uid, action: '举报内容', target: id,
      time: now(), reason: reason, handle: '待处置', handledAt: '', handledBy: '', conclusion: ''
    });
    closeModal(); say('举报已提交，运营会尽快核查'); refresh();
  }
  function homeAsk() {
    var q = val('hcs-ask-q');
    if (!q) { say('请先描述您的问题', 'error'); return; }
    var cat = val('hcs-ask-cat') || '肿瘤防治';
    var name = val('hcs-ask-name') || '访客' + (Math.floor(Math.random() * 900) + 100);
    var seq = DB.sessions.reduce(function (m, s) { var n = parseInt(String(s.id).split('-')[2], 10); return n > m ? n : m; }, 0) + 1;
    var sid = 'HC-2026-' + ('000' + seq).slice(-4);
    var r = aiAnalyze(q);
    var t = now();
    DB.sessions.unshift({
      id: sid, user: name, phone: '—', cat: cat, topic: r.topic, q: q,
      status: '待分配', time: t, assignee: '', priority: r.urgency === '高' ? '高' : '中',
      fromHome: true, readCount: 1,
      msgs: [{ id: nextId('MSG-'), from: name, role: '用户', content: q, time: t }]
    });
    DB.analysis.push({
      id: nextId('AN-'), session: sid, topic: r.topic, raw: q, label: cat,
      intent: r.intent, emotion: r.emotion, urgency: r.urgency, analyzedAt: t
    });
    log(name, '发起咨询', sid);
    /* 会话创建后直接进聊天窗，而不是关掉——用户要能看见后续回复 */
    say('咨询已提交（' + sid + '），客服会尽快回复');
    openChatSession(sid);
    if (typeof S !== 'undefined' && S.pageId === 'hc-consult') refresh();
  }

  /* ============================================================
     三级页面：在线咨询
     ============================================================ */
  function tSessions(pageId) {
    var id = keyOf(pageId);
    var kw = String(fv(id, 'kw', '')).toLowerCase(), cat = fv(id, 'cat', '全部分类'), status = fv(id, 'status', '全部状态');
    var list = DB.sessions.filter(function (s) {
      if (cat !== '全部分类' && s.cat !== cat) return false;
      if (status !== '全部状态' && s.status !== status) return false;
      if (kw && (s.id + s.user + s.q + s.cat).toLowerCase().indexOf(kw) < 0) return false;
      return true;
    });
    var rows = slice(list, id, 8).map(function (s) {
      return '<tr><td>' + link(s.id, 'openSession', s.id) + '</td>' +
        '<td>' + esc(s.user) + '<span class="hcs-sub">' + esc(s.phone) + '</span></td>' +
        '<td>' + esc(s.cat) + '</td>' +
        '<td>' + clip(s.q, 240) + '</td>' +
        '<td>' + badge(s.status) + '</td>' +
        '<td>' + esc(s.time) + '</td>' +
        '<td>' + ops(s.status !== '已办结' ? act('回复', 'replyForm', s.id, 'btn-primary') + act('分配', 'assignForm', s.id) + act('办结', 'closeSession', s.id) : '') + '</td></tr>';
    });
    return filterBar(id, [
      fkw(id, 'kw', fv(id, 'kw', ''), '会话编号 / 咨询人 / 问题内容'),
      fsel(id, 'cat', ['全部分类'].concat(DB.categories.map(function (c) { return c.name; })), cat),
      fsel(id, 'status', ['全部状态', '待分配', '处理中', '已回复', '已办结'], status)
    ]) + bar('<span style="font-size:12px;color:#64748b">筛选结果 ' + list.length + ' 条</span>', '') +
      table(['会话编号', '咨询人', '问题分类', '咨询内容', '状态', '发起时间', '操作'], rows, '没有符合条件的会话，试试调整筛选条件') +
      pager(id, list.length, 8);
  }

  function tCategories(pageId) {
    var rows = DB.categories.map(function (c) {
      return '<tr><td>' + esc(c.id) + '</td><td><strong>' + esc(c.name) + '</strong></td><td>' + clip(c.desc, 320) + '</td>' +
        '<td>' + catCount(c.name) + '</td><td>' + badge(c.status) + '</td>' +
        '<td>' + ops(act('编辑', 'editCategory', c.id), act(c.status === '启用' ? '停用' : '启用', 'toggleCategory', c.id), act('删除', 'removeCategory', c.id)) + '</td></tr>';
    });
    return table(['分类编号', '分类名称', '说明', '会话数', '状态', '操作'], rows, '暂无分类');
  }

  function tAssigns(pageId) {
    var id = keyOf(pageId);
    var kw = String(fv(id, 'kw', '')).toLowerCase(), to = fv(id, 'to', '全部');
    var list = DB.assigns.filter(function (a) {
      if (to !== '全部' && a.to !== to) return false;
      if (kw && (a.session + a.note).toLowerCase().indexOf(kw) < 0) return false;
      return true;
    });
    var rows = slice(list, id, 10).map(function (a) {
      return '<tr><td>' + esc(a.id) + '</td>' +
        '<td>' + link(a.session, 'openSession', a.session) + '</td>' +
        '<td>' + esc(a.to) + '</td>' +
        '<td>' + clip(a.note, 320) + '</td><td>' + esc(a.time) + '</td></tr>';
    });
    return filterBar(id, [
      fkw(id, 'kw', fv(id, 'kw', ''), '会话编号 / 分配说明'),
      fsel(id, 'to', ['全部'].concat(DOCTORS), to)
    ]) + bar('<span style="font-size:12px;color:#64748b">共 ' + list.length + ' 条分配记录</span>', '') +
      table(['日志编号', '会话编号', '处理人', '分配说明', '时间'], rows, '暂无分配记录') +
      pager(id, list.length, 10);
  }

  /* ============================================================
     三级页面：咨询问题分析（一页）
     ------------------------------------------------------------
     原来这里是三页：智能分析结果（话题明细）、热点统计（话题排行）、
     洞察建议（按话题生成的运营建议）。三者其实是同一批分析数据的三个切面，
     而运营真正要看的维度只有一个——问题分类。
     现在合成一页，而且只统计、不生产：按分类给数量/占比/高紧急度/主要话题，
     行内不带任何动作。分析页的职责是把数据摆出来，采纳、生成科普、看明细
     都是另一套状态机与另一个页面的事，不该挂在统计表的右边。
     ============================================================ */
  function tAI(pageId) {
    var st = catStat();
    var rows = st.list.map(function (c, i) {
      return '<tr><td>' + (i + 1) + '</td>' +
        '<td><strong>' + esc(c.l) + '</strong></td>' +
        '<td>' + c.v + '</td>' +
        '<td>' + c.share + '%</td>' +
        '<td>' + (c.urgent || '—') + '</td>' +
        '<td>' + esc(c.top) + '</td></tr>';
    });
    return bar('<span style="font-size:12px;color:#64748b">统计口径：咨询问题按分类汇总，数量与占比实时计算</span>', '') +
      table(['排名', '问题分类', '咨询量', '占比', '其中高紧急度', '主要话题'], rows, '暂无分析数据') +
      (st.total ? '<div style="padding-top:10px;font-size:12px;color:#64748b;text-align:right">合计 ' + st.total + ' 条咨询</div>' : '');
  }

  /* ============================================================
     三级页面：互动社区
     ============================================================ */
  function tBoards(pageId) {
    var rows = DB.boards.map(function (b) {
      return '<tr><td>' + esc(b.id) + '</td><td><strong>' + esc(b.name) + '</strong></td><td>' + clip(b.desc, 320) + '</td>' +
        '<td>' + boardPostCount(b.name) + '</td><td>' + badge(b.status) + '</td>' +
        '<td>' + ops(act('编辑', 'editBoard', b.id), act(b.status === '启用' ? '停用' : '启用', 'toggleBoard', b.id)) + '</td></tr>';
    });
    return table(['板块编号', '板块名称', '板块说明', '主帖数', '状态', '操作'], rows, '暂无板块');
  }

  function tPosts(pageId) {
    var id = keyOf(pageId);
    var kw = String(fv(id, 'kw', '')).toLowerCase(), bd = fv(id, 'board', '全部'), status = fv(id, 'status', '全部');
    var list = DB.posts.filter(function (p) {
      if (bd !== '全部' && p.board !== bd) return false;
      if (status !== '全部' && p.status !== status) return false;
      if (kw && (p.title + p.user + p.content).toLowerCase().indexOf(kw) < 0) return false;
      return true;
    });
    var rows = slice(list, id, 8).map(function (p) {
      return '<tr><td>' + esc(p.id) + '</td><td>' + esc(p.board) + '</td>' +
        '<td>' + link(p.title, 'viewPost', p.id) + '</td>' +
        '<td>' + p.views + '</td><td>' + p.likes + '</td><td>' + commentCount(p.id) + ' / ' + replyCount(p.id) + '</td>' +
        '<td>' + badge(p.status) + (p.rejectReason ? '<span class="hcs-sub" style="color:#b42335">' + esc(p.rejectReason) + '</span>' : '') + '</td>' +
        '<td>' + esc(p.time) + '</td>' +
        '<td>' + ops(p.status === '已发布'
          ? act('下架', 'unpublishPost', p.id)
          : act('上架', 'publishPost', p.id, 'btn-primary')) + '</td></tr>';
    });
    return filterBar(id, [
      fkw(id, 'kw', fv(id, 'kw', ''), '标题 / 作者 / 正文'),
      fsel(id, 'board', ['全部'].concat(DB.boards.map(function (b) { return b.name; })), bd),
      fsel(id, 'status', ['全部', '已发布', '待审核', '已驳回', '已下架'], status)
    ]) + bar('<span style="font-size:12px;color:#64748b">共 ' + list.length + ' 条主帖，待审核 ' + cnt(DB.posts, function (p) { return p.status === '待审核'; }) + ' 条</span>',
      act('+ 新增主帖', 'newPost', '', 'btn-primary')) +
      table(['主帖编号', '所属板块', '标题', '浏览', '点赞', '评论/回复', '状态', '发布时间', '操作'], rows, '没有符合条件的主帖') +
      pager(id, list.length, 8);
  }

  function tComments(pageId) {
    var id = keyOf(pageId);
    var kw = String(fv(id, 'kw', '')).toLowerCase(), status = fv(id, 'status', '全部');
    var list = DB.comments.filter(function (c) {
      if (status !== '全部' && c.status !== status) return false;
      if (kw && (c.content + c.user).toLowerCase().indexOf(kw) < 0) return false;
      return true;
    });
    var rows = slice(list, id, 8).map(function (c) {
      var rep = c.replies || [];
      return '<tr><td>' + esc(c.id) + '</td>' +
        '<td>' + link(c.post, 'viewPost', c.post) + '</td>' +
        '<td>' + esc(c.user) + '</td>' +
        '<td>' + clip(c.content, 260) + '</td>' +
        '<td>' + (rep.length ? rep.map(function (r) { return '<div style="font-size:12px;white-space:normal">' + esc(r.content) + '</div>'; }).join('') : '<span style="color:#94a3b8">未回复</span>') + '</td>' +
        '<td>' + badge(c.status) + '</td><td>' + esc(c.time) + '</td>' +
        '<td>' + ops(act('回复', 'replyForm', c.id, 'btn-primary'),
          act(c.status === '已屏蔽' ? '恢复' : '屏蔽', 'hideComment', c.id),
          act('删除', 'removeComment', c.id)) + '</td></tr>';
    });
    return filterBar(id, [
      fkw(id, 'kw', fv(id, 'kw', ''), '评论内容 / 用户'),
      fsel(id, 'status', ['全部', '正常', '待审核', '已屏蔽'], status)
    ]) + bar('<span style="font-size:12px;color:#64748b">共 ' + list.length + ' 条评论，待审核 ' + cnt(DB.comments, function (c) { return c.status === '待审核'; }) + ' 条</span>', '') +
      table(['评论编号', '所属主帖', '用户', '评论内容', '官方回复', '状态', '时间', '操作'], rows, '没有匹配的评论') +
      pager(id, list.length, 8);
  }

  /* 用户行为日志：浏览/点赞这类是留痕，不可改不可删；
     唯独「举报内容」需要运营处置，所以只有这类行带操作按钮，并单独统计待处置数。 */
  function tUserLog(pageId) {
    var id = keyOf(pageId);
    var kw = String(fv(id, 'kw', '')).toLowerCase(), action = fv(id, 'action', '全部');
    var types = ['全部'];
    DB.userLogs.forEach(function (u) { if (!has(types, u.action)) types.push(u.action); });
    var list = DB.userLogs.filter(function (u) {
      if (action !== '全部' && u.action !== action) return false;
      if (kw && (u.user + u.target + u.action).toLowerCase().indexOf(kw) < 0) return false;
      return true;
    });
    var rows = slice(list, id, 10).map(function (u) {
      var t = /发布|回复|采纳|通过|分析|推荐|办结/.test(u.action) ? 'success' : /删除|屏蔽|驳回|举报|下架|忽略/.test(u.action) ? 'danger' : 'info';
      var isReport = u.action === '举报内容';
      var cell = isReport
        ? badge(u.handle || '待处置')
        : '<span style="color:#94a3b8">—</span>';
      var op = isReport
        ? ops(act(u.handle === '待处置' ? '处置' : '查看', 'handleReport', u.id, u.handle === '待处置' ? 'btn-primary' : 'btn-outline'))
        : '';
      return '<tr><td>' + esc(u.id) + '</td><td>' + esc(u.user) + '</td><td>' + badge(u.action, t) + '</td>' +
        '<td>' + esc(u.target) + '</td>' +
        (isReport ? '<td>' + clip(u.reason || '—', 220) + '</td>' : '<td><span style="color:#94a3b8">—</span></td>') +
        '<td>' + cell + '</td><td>' + esc(u.time) + '</td><td>' + op + '</td></tr>';
    });
    var pending = cnt(DB.userLogs, function (u) { return u.action === '举报内容' && u.handle === '待处置'; });
    return filterBar(id, [
      fkw(id, 'kw', fv(id, 'kw', ''), '用户 / 目标 / 行为'),
      fsel(id, 'action', types, action)
    ]) + bar('<span style="font-size:12px;color:#64748b">共 ' + list.length + ' 条行为日志' +
      (pending ? ' · <b style="color:#b42335">举报待处置 ' + pending + ' 条</b>' : '') + '</span>', '') +
      table(['日志编号', '用户', '行为', '目标', '举报理由', '处置状态', '时间', '操作'], rows, '暂无行为日志') +
      pager(id, list.length, 10);
  }

  function tRecommend(pageId) {
    var list = DB.posts.filter(function (p) { return p.status === '已发布'; });
    var rows = list.map(function (p) {
      var r = recOf(p.id);
      var on = r && r.status === '已推荐';
      return '<tr><td>' + esc(p.id) + '</td>' +
        '<td>' + link(p.title, 'viewPost', p.id) + '</td>' +
        '<td>' + esc(p.board) + '</td>' +
        '<td>' + p.views + ' / ' + p.likes + '</td>' +
        '<td>' + badge(on ? '已推荐' : '未推荐') + '</td>' +
        '<td>' + ops(act(on ? '取消推荐' : '设为推荐', 'recommend', p.id, on ? 'btn-outline' : 'btn-primary')) + '</td></tr>';
    });
    return bar('<span style="font-size:12px;color:#64748b">推荐位建议控制在 5 条以内 · 当前 ' +
      cnt(DB.recommends, function (r) { return r.status === '已推荐'; }) + ' 条已推荐</span>', '') +
      table(['主帖编号', '主帖标题', '所属板块', '浏览/点赞', '推荐状态', '操作'], rows, '暂无已发布主帖');
  }

  /* ============================================================
     二级节点：页面定义 / 路由
     ============================================================ */
  var PAGES = [
    { group: '在线咨询', hint: '会话受理、问题分类与分配处理',
      items: [
        { id: 'hc-consult', tab: 'sessions', label: '咨询会话', table: '会话主记录' },
        { id: 'hc-categories', tab: 'category', label: '咨询问题分类', table: '咨询问题分类体系', acts: '<button class="btn btn-primary btn-sm" data-hcs="newCategory">+ 新增分类</button>' },
        { id: 'hc-assigns', tab: 'assign', label: '分配与处理日志', table: '咨询分配与处理日志' }
      ] },
    { group: '咨询问题分析', hint: '按问题分类统计咨询量与热点话题',
      items: [
        { id: 'hc-ai', tab: 'ai', label: '咨询问题分类统计', table: '咨询问题分类统计' }
      ] },
    { group: '互动社区', hint: '社区主页（用户侧）与内容治理（后台）',
      items: [
        { id: 'hc-home', tab: 'home', label: '社区主页', table: '社区主页（用户侧）' },
        { id: 'hc-boards', tab: 'boards', label: '社区板块分类配置', table: '社区板块分类配置', acts: '<button class="btn btn-primary btn-sm" data-hcs="newBoard">+ 新增板块</button>' },
        { id: 'hc-posts', tab: 'posts', label: '社区主帖内容', table: '社区主帖内容' },
        { id: 'hc-comments', tab: 'comments', label: '社区评论与回复', table: '社区评论与回复' },
        { id: 'hc-userlog', tab: 'userlog', label: '社区用户行为日志', table: '社区用户行为日志' },
        { id: 'hc-recommend', tab: 'recommend', label: '社区优质内容推荐配置', table: '社区优质内容推荐配置' }
      ] }
  ];
  var TAB_RENDER = {
    sessions: tSessions, category: tCategories, assign: tAssigns,
    ai: tAI,
    home: tHome,
    boards: tBoards, posts: tPosts, comments: tComments, userlog: tUserLog, recommend: tRecommend
  };
  /* 旧「健康咨询」模块的页面 id：直达老链接时落到对应三级页，不 404。
     「咨询原始问题文本」「健康关注热点统计」「分析洞察应用建议」三页已合并进
     「咨询问题分类统计」，它们的旧入口（含更早的 hc-raw 等）全部改投 hc-ai。 */
  var LEGACY = {
    'consult-sessions': 'hc-consult', 'consult-session': 'hc-consult', 'consult-message': 'hc-consult', 'consult-category': 'hc-categories', 'consult-assign-log': 'hc-assigns',
    'consult-analysis': 'hc-ai', 'analysis-raw-text': 'hc-ai', 'hc-raw': 'hc-ai', 'analysis-ai-result': 'hc-ai',
    'analysis-hotspot': 'hc-ai', 'hc-hotspot': 'hc-ai', 'analysis-insight': 'hc-ai', 'hc-insight': 'hc-ai',
    'community-management': 'hc-boards', 'community-board': 'hc-boards', 'community-post': 'hc-posts', 'community-comment': 'hc-comments',
    'community-user-log': 'hc-userlog', 'community-recommend': 'hc-recommend'
  };
  function metaOf(pid) {
    for (var i = 0; i < PAGES.length; i++) {
      for (var j = 0; j < PAGES[i].items.length; j++) { if (PAGES[i].items[j].id === pid) return PAGES[i].items[j]; }
    }
    return null;
  }

  function render(pageId) {
    var el = $('pageContainer');
    if (!el) return;
    /* 入口先归一到 12 个三级页：旧咨询 id 走 LEGACY；其余不认识的 id 落到入口表 */
    var pid = LEGACY[pageId] || pageId;
    if (pageId === 'hc-service') { renderOverview(); return; }
    var meta = metaOf(pid);
    if (!meta) { renderOverview(); return; }
    S.pageId = pid;
    var body = TAB_RENDER[meta.tab](pid);
    var acts = meta.acts || '';
    el.innerHTML = '<div class="hcs-page" data-page="' + esc(pid) + '">' +
      (acts ? '<div class="page-toolbar"><div class="page-toolbar-title">' + esc(meta.label) + '</div><div class="toolbar-actions">' + acts + '</div></div>' : '') +
      body + '</div>';
    /* 切页后侧栏高亮跟着走：直达链接归一到的三级页也要亮在对应的菜单项上 */
    try {
      document.querySelectorAll('.menu-item').forEach(function (x) { x.classList.toggle('active', x.dataset.id === pid); });
      var node = (document.querySelector('.menu-item[data-id="' + pid + '"]') || {}).parentElement;
      while (node) {
        if (node.tagName === 'LI') {
          var head = node.querySelector(':scope > .menu-item');
          var sub = node.querySelector(':scope > ul.submenu');
          if (head && sub) { head.classList.add('expanded'); sub.classList.add('open'); }
        }
        node = node.parentElement;
      }
    } catch (e) { }
    var mc = $('mainContent');
    if (mc) mc.scrollTop = 0;
  }
  /* 不带页 id 直接进「社区咨询」：给一张 10 个三级页的入口表 */
  function renderOverview() {
    var el = $('pageContainer');
    if (!el) return;
    el.innerHTML = '<div class="hcs-page">' + PAGES.map(function (g) {
      return '<div style="font-size:13px;font-weight:700;color:#1f2937;margin:14px 0 8px">' + esc(g.group) + '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px">' +
        g.items.map(function (it) {
          return '<a href="javascript:void(0)" data-hcs="nav" data-arg="' + it.id + '" style="display:block;padding:12px 14px;border:1px solid var(--border);border-radius:6px;background:#fff;color:#1f2937;text-decoration:none">' +
            '<div style="font-weight:600;font-size:13px">' + esc(it.label) + '</div><div style="font-size:12px;color:#94a3b8;margin-top:4px">' + esc(it.table) + '</div></a>';
        }).join('') + '</div>';
    }).join('') + '</div>';
  }

  /* ================= 事件委托 ================= */
  document.addEventListener('click', function (ev) {
    if (!ev.target || !ev.target.closest) return;
    /* 弹窗里只有本模块自己的按钮归本模块；知识库的按钮留给 kb-module.js 的委托处理，
       否则会被当成"点击弹窗外部"而误关弹窗。 */
    if (ev.target.closest('.kb-mask') && !ev.target.closest('.kb-mask [data-hcs]')) return;
    var el = ev.target.closest('[data-hcs]');
    if (!el) return;
    var a = el.getAttribute('data-hcs');
    var g = el.getAttribute('data-arg') || '';
    var topModal = el.closest('[data-modal]');
    var mAct = topModal ? topModal.getAttribute('data-modal') : '';
    var mArg = topModal ? (topModal.getAttribute('data-arg') || '') : '';

    switch (a) {
      case 'close': closeModal(); return;
      case 'nav': if (typeof window.navigateTo === 'function') window.navigateTo(g); else render(g); return;
      case 'query': readFilter(g); render(S.pageId); return;
      case 'reset': S.filters[g] = {}; S.pageNo[g] = 1; render(S.pageId); return;
      case 'page': {
        var p = g.split('|');
        S.pageNo[p[0]] = parseInt(p[1], 10) || 1;
        render(S.pageId); return;
      }

      /* 会话 */
      case 'openSession': openSession(g); return;
      /* replyForm 只服务评论（CM- 开头）；会话的「回复」与点编号同一个弹窗 */
      case 'replyForm': if (/^CM-/.test(g)) { openCommentReply(g); return; } openSession(g); return;
      case 'sendReply': sendReply(g || mArg); return;
      case 'assignForm': openAssign(g); return;
      case 'doAssign': if (mAct === 'doAssign') doAssign(mArg); return;
      case 'closeSession': closeSession(g); return;
      case 'doCloseSession': if (mAct === 'doCloseSession') doCloseSession(mArg); return;

      /* 分类 */
      case 'newCategory': openCategory(null); return;
      case 'editCategory': openCategory(g); return;
      case 'doCategory': if (mAct === 'doCategory') doCategory(mArg); return;
      case 'toggleCategory': toggleCategory(g); return;
      case 'removeCategory': removeCategory(g); return;
      case 'doRemoveCategory': if (mAct === 'doRemoveCategory') doRemoveCategory(mArg); return;

      /* 社区主页（用户侧）：动作都写回后台表 */
      case 'homeBoard': HOME.board = g; S.pageNo['hc-home'] = 1; render('hc-home'); return;
      case 'homeQuery': homeQuery(); return;
      case 'homeReset': homeReset(); return;
      case 'homePage': S.pageNo['hc-home'] = parseInt(g, 10) || 1; render('hc-home'); return;
      case 'homeOpenPost': homeOpenPost(g); return;
      case 'homeComment': if (mAct === 'homeComment') homeComment(mArg || g); return;
      case 'homeLike': homeLike(g); return;
      case 'homeReport': homeReport(g); return;
      case 'doHomeReport': if (mAct === 'doHomeReport') doHomeReport(mArg); return;
      case 'homeAsk': homeAsk(); return;
      case 'homeAskForm': openHomeAsk(); return;

      /* 社区 */
      case 'newBoard': openBoard(null); return;
      case 'editBoard': openBoard(g); return;
      case 'doBoard': if (mAct === 'doBoard') doBoard(mArg); return;
      case 'toggleBoard': toggleBoard(g); return;
      case 'viewPost': openPost(g); return;
      case 'newPost': openPostForm(null); return;
      case 'editPost': openPostForm(g); return;
      case 'doPost': if (mAct === 'doPost') doPost(mArg); return;
      case 'postInsertEdu': postInsertEdu(); return;
      case 'postInsertLink': postInsertLink(); return;
      /* 在线咨询聊天窗 */
      case 'chatToggle': if (chatIsOpen()) closeChat(); else openChat(); return;
      case 'chatClose': closeChat(); return;
      case 'chatList': CHAT.list = true; CHAT.sid = null; paintChat(); return;
      case 'chatNew': CHAT.open = true; chatNew(); return;
      case 'chatOpenSession': openChatSession(g); return;
      case 'chatSend': chatSend(); return;
      case 'publishPost': publishPost(g); return;
      case 'approvePost': approvePost(g); return;
      case 'rejectPost': rejectPost(g); return;
      case 'doReject': if (mAct === 'doReject') doReject(mArg); return;
      case 'unpublishPost': unpublishPost(g); return;
      case 'doUnpublishPost': if (mAct === 'doUnpublishPost') doUnpublishPost(mArg); return;
      case 'doCommentReply': if (mAct === 'doCommentReply') doCommentReply(mArg); return;
      case 'hideComment': hideComment(g); return;
      case 'removeComment': removeComment(g); return;
      case 'doRemoveComment': if (mAct === 'doRemoveComment') doRemoveComment(mArg); return;
      case 'recommend': toggleRecommend(g); return;
      case 'handleReport': openReport(g); return;
      case 'doReport': if (mAct === 'doReport') doReport(mArg); return;
      default: return;
    }
  });
  /* 选完条件按回车即查询 */
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter' || !ev.target || !ev.target.getAttribute) return;
    /* 聊天输入框：Enter 发送，Shift+Enter 换行 */
    if (ev.target.id === 'hcs-chat-input') {
      if (ev.shiftKey) return;
      ev.preventDefault();
      chatSend();
      return;
    }
    var f = ev.target.getAttribute('data-hcs-kw');
    if (!f) return;
    if (f === 'hc-home') { homeQuery(); return; }
    readFilter(f); render(S.pageId);
  });
  /* 下拉即生效。主页的筛选状态存在 HOME 里（卡片是按 HOME 过滤的，不走 S.filters），
     这里要单独分流，否则下拉改了 HOME 不跟着变，看上去像没生效。 */
  document.addEventListener('change', function (ev) {
    if (!ev.target || !ev.target.getAttribute) return;
    var f = ev.target.getAttribute('data-hcs-filter');
    if (!f) return;
    var k = ev.target.getAttribute('data-k'), v = ev.target.value;
    if (f === 'hc-home') {
      if (k === 'board') HOME.board = v;
      S.pageNo['hc-home'] = 1;
      render('hc-home');
      return;
    }
    filterState(f)[k] = v;
    S.pageNo[f] = 1;
    render(S.pageId);
  });

  /* ================= 注册 ================= */
  /* 悬浮的在线咨询入口：全站常驻，不只在社区主页出现——
     用户在任何页面看到「有回复了」的角标，都能点开继续聊。 */
  renderChatFab();
  var IDS = [];
  PAGES.forEach(function (g) { g.items.forEach(function (it) { IDS.push(it.id); }); });
  window.HCService = {
    DB: DB,
    pageIds: IDS.concat(['hc-service', Object.keys(LEGACY)]),
    pages: PAGES,
    /* 必须挂 getter：app.html 里的 buildMenu 有个自由变量 item，`obj.legacy` 会让它进
       Temporal Dead Zone 直接抛错。 */
    get legacy() { return LEGACY; },
    overview: renderOverview,
    tabOf: function (pid) { var m = metaOf(LEGACY[pid] || pid); return m ? m.tab : null; },
    render: render,
    pageOf: function (id) { return LEGACY[id] || id; },
    labelOf: function (id) {
      var m = metaOf(LEGACY[id] || id);
      if (m) return m.label;
      return id === 'hc-service' ? '社区咨询' : '内容未找到';
    },
    /* 在线咨询聊天窗的对外入口：自助诊断与自检脚本用，也给将来接后端留个口子。 */
    chat: {
      open: function () { CHAT.open = true; CHAT.list = true; paintChat(); },
      openSession: function (sid) { openChatSession(sid); },
      close: closeChat,
      unread: unreadTotal,
      pushAsStaff: function (sid, who, text) { pushMsg(sid, who, '客服', text); },
      setRead: function (sid) {
        var s = find(DB.sessions, sid);
        if (!s) return;
        var m = s.msgs || [];
        s.readCount = m.length;
        renderChatFab();
      },
      state: function () { return { open: CHAT.open, sid: CHAT.sid, list: CHAT.list }; }
    }
  };
})();
