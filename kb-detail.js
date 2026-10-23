/* ============================================================
   科普与培训 · 内容详情页（kb-detail.js）
   ------------------------------------------------------------
   入口：内容库列表「预览」/ 图文卡片 / 首页资讯栏条目 → navigateTo('kb-detail|<内容编号>')
        → kb-module.js 的 renderKBPage 认出这条 id，转给本文件的 KBDetail.render(id)

   一条内容怎么读，随「形式」而变——详情页按形式给六套正文版式：
     · 视频       16:9 播放器 + 章节列表（点章节跳到该时间点）+ 看完自测
          · 课件       幻灯片放映机（封面 + 逐页），翻页与全屏演示
     · 操作手册   侧边目录 + 长文档，编号步骤渲染成可勾选的操作清单
     · 宣传折页   折页版面：要点大卡 + 办理流程 + 其它须知
     · 图文       阅读版心 + 标题分级
   页面骨架六类共用：顶条（返回 + 本篇动作）｜主栏｜右栏（本篇信息 / 附件 / 读法）。
   主栏左侧另有一列「页内导航」，按当前版式给出锚点。

   换页前调 KBDetail.leave()：视频要停播、演示要退全屏，不然后台还在播。
   对外导出：window.KBDetail（assets / me / log 由 kb-module.js 在渲染前注入）
   ============================================================ */
(function () {
  'use strict';

  var D = { assets: [], me: null };
  window.KBDetail = D;
  /* kb-module.js 先于本文件加载，它初始化时还没有 KBDetail，注入会落空；
     这里反过来挂一个"登记"入口，让模块在脚本就绪后立刻把内容库交过来 */
  /* ext = 转载扩展 { mount }：本文件只管按形式排版；来源行 / 编者按 / 转载声明 / 外发按钮
     由 kb-module.js 的 mount() 在标记位上替换进来。传不进来时所有转载块静默不出，详情页照常渲染。 */
  D.bind = function (assets, me, log, collections, ext) {
    D.assets = assets || []; D.me = me || null; D.log = log || function () { };
    D.collections = collections || [];
    if (ext) D.ext = ext;
    /* 兜底：模块初始化时就把转载扩展挂在 window 上，bind 没带参数也能用 */
    if (!D.ext && window.KB_RP_EXT) D.ext = window.KB_RP_EXT;
  };
  function isRp(a) { return !!(D.ext && D.ext.isReprint && D.ext.isReprint(a)); }
  /* 上下架权限：复用模块通过 ext 注入的 canShelf（与转载列表、详情页按钮同一口径），
     注入不到就不出按钮，避免各页面口径不一致 */
  function canShelf(a) { return !!(D.ext && D.ext.canShelf && D.ext.canShelf(a)); }
  /* 必须「带着对象调」（KBDetail.ext.mount(...)）：本文件是严格模式，把方法摘出来调用会丢 this，
     方法体里一旦用到宿主对象就抛错，页面只剩一半。这类问题只在严格模式下才暴露。 */
  function mountRp(html, a) { return (D.ext && D.ext.mount) ? D.ext.mount(html, a) : html; }
  /* 转载件的插入位：各版式把标记埋在正确位置，模块只做字符串替换。
     NOTE 在正文之前、DECL 在全部正文之后；原创件里这两个注释不会被替换，等于不存在。 */
  function rpTpl(a, where) {
    if (!isRp(a)) return '';
    return where === 'note' ? '<i data-kbx-rp="note"></i>' : '<i data-kbx-rp="decl"></i>';
  }
  /* 列表卡片要画形式色块与字形，复用这里的档案表 */
  D.profileOf = function (a) { return profile(kindOf(a)); };

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function asset(id) { for (var i = 0; i < D.assets.length; i++) { if (D.assets[i].id === id) return D.assets[i]; } return null; }
  function list() { return D.assets || []; }
  function stripHtml(s) { return String(s || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim(); }
  /* 列表卡片上的摘要只显示一句：先去掉 HTML 与多余空白，超过 n 个字截断并加省略号。
     完整摘要在详情页标题下；卡片上放全文会把两行占满，挤掉封面和标签的空间。 */
  function clipText(s, n) {
    var t = stripHtml(s);
    return t.length > n ? t.slice(0, n).replace(/[，、；：,;:\s]+$/, '') + '…' : t;
  }
  function fileSize(s) {
    var m = String(s || '').match(/([\d.]+)\s*(GB|MB|KB|B)/i);
    if (!m) return null;
    var n = parseFloat(m[1]), u = m[2].toUpperCase();
    return u === 'GB' ? n * 1024 * 1024 * 1024 : u === 'MB' ? n * 1024 * 1024 : u === 'KB' ? n * 1024 : n;
  }
  function sec(v) { var p = Number(String(v || '0:00').split(':')[0]) || 0; return p * 60 + (Number(String(v || '0:00').split(':')[1]) || 0); }
  function mmss(seconds) {
    var m = Math.floor(seconds / 60), s = seconds % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function trackLabel(track) { return track === '培训' ? '培训内容' : '科普内容'; }

  /* ================= 形式档案 =================
     每类内容一套读法。只保留真正被渲染用到的字段：
       glyph 卡片/占位的字形，theme 主题色名（拼 kbx-theme-* / kbx-cover-*），
       mode 版式分支（article / video / slides / manual / flyer），mainCta 主按钮文案 */
  var PROFILES = {
    /* 文章 = 原来的「图文」，单篇长文流式排版。
       图文 = 新形态：一段短正文 + 一组图（小红书 / 九图科普那种）。 */
    '文章': { glyph: '文', theme: 'art', mode: 'article', mainCta: '取用本文' },
    '图文': { glyph: '图', theme: 'art', mode: 'gallery', mainCta: '取用图文' },
    '宣传折页': { glyph: '折', theme: 'banner', mode: 'flyer', mainCta: '取用折页内容' },
    '视频': { glyph: '播', theme: 'video', mode: 'video', mainCta: '下载原视频' },
    '课件': { glyph: '件', theme: 'slide', mode: 'slides', mainCta: '下载课件' },
    '操作手册': { glyph: '册', theme: 'manual', mode: 'manual', mainCta: '学习完成' }
  };
  function profile(kind) { return PROFILES[kind] || PROFILES['文章']; }

  function kindOf(a) {
    if (a.kind) return a.kind;
    if (a.track === '培训') return '操作手册';
    if (a.gallery && a.gallery.length) return '图文';
    var fs = a.attachments || [];
    for (var i = 0; i < fs.length; i++) {
      var n = String(fs[i].name).toLowerCase();
      if (/\.(mp4|mov|avi|webm)$/.test(n)) return '视频';
      if (/\.(ppt|pptx)$/.test(n)) return '课件';
      if (/\.(png|jpg|jpeg|webp|gif)$/.test(n)) return '宣传折页';
    }
    return '文章';
  }

  /* ================= 附件与时长 ================= */
  function videoFile(a) {
    var fs = a.attachments || [];
    for (var i = 0; i < fs.length; i++) { if (/\.(mp4|mov|avi|webm)$/i.test(fs[i].name)) return fs[i]; }
    return null;
  }
  function deckFile(a) {
    var fs = a.attachments || [];
    for (var i = 0; i < fs.length; i++) { if (/\.(ppt|pptx|pdf)$/i.test(fs[i].name)) return fs[i]; }
    return null;
  }
  /* 时长：正文或摘要里明确写了「N 分 M 秒」或「N 分钟」就用它，否则按文件大小估算（约 250 KB/s，原型口径） */
  function runtime(a) {
    var m = (stripHtml(a.body) + ' ' + stripHtml(a.summary)).match(/(\d+)\s*分\s*(\d+)?\s*秒|(\d+)\s*分钟/);
    if (m) return (m[1] !== undefined ? Number(m[1]) * 60 + Number(m[2] || 0) : Number(m[3]) * 60);
    var f = videoFile(a), b = f ? fileSize(f.size) : 0;
    if (b) return Math.max(60, Math.round(b / 262144 / 5) * 5);
    return 0;
  }
  function slidesOf(a) {
    if (a.slides && a.slides.length) return a.slides;
    var b = a.body || '', n = 0, m;
    var re = /<h[23][^>]*>([\s\S]*?)<\/h[23]>|<(p|ul|ol|table|blockquote|pre)[^>]*>[\s\S]*?<\/\2>/gi;
    var chunks = [];
    while ((m = re.exec(b))) {
      if (m[1] !== undefined) { chunks.push({ cover: 1, h: stripHtml(m[1]) }); n++; }
      else chunks.push({ raw: m[0] });
    }
    /* 「依据：待补依据出处。」已删：没填依据的件不该在封面页上挂一句待办 */
    var basic = (a.bullets && a.bullets.length ? a.bullets : ['收录：' + stripHtml(a.summary) + '。']
      .concat(a.evidence ? ['依据：' + a.evidence] : [])
      .concat(['分类：' + [a.track, a.kind].concat(a.sites || []).join(' · ') + '。']));
    return [{ title: a.title, sub: '收集人：' + (D.me ? D.me.name : '') + '　·　' + trackLabel(a.track) + '课件', bullets: basic, cover: 1, tag: '封面' }].concat(chunks);
  }

  /* ================= 章节 / 结构切分 ================= */
  function splitSections(html) {
    html = String(html || '');
    var hs = [], re = /<h2[^>]*>([\s\S]*?)<\/h2>/gi, m;
    while ((m = re.exec(html))) hs.push({ title: stripHtml(m[1]), index: m.index, end: m.index + m[0].length });
    if (!hs.length) return [{ h: stripHtml(html).split(/。|？|！/)[0].slice(0, 24), html: '<div class="kbx-p">' + html + '</div>' }];
    var out = [];
    if (hs[0].index > 0) {
      var lead = html.slice(0, hs[0].index).trim();
      if (stripHtml(lead)) out.push({ h: '开篇', html: '<div class="kbx-p">' + lead + '</div>' });
    }
    for (var i = 0; i < hs.length; i++) {
      var end = i + 1 < hs.length ? hs[i + 1].index : html.length;
      out.push({ h: hs[i].title, html: '<div class="kbx-p">' + html.slice(hs[i].end, end) + '</div>' });
    }
    return out;
  }
  /* ================= 页面内动作 ================= */
  var state = { id: null };

  function stopVideos(root) {
    ((root || document).querySelectorAll('video')).forEach(function (v) { try { v.pause(); } catch (e) { } });
  }
  function exitFs() { try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { } }
  /* 离开详情页：停视频、退全屏，并把停留时长结账（图文类的「观看」在这时落账） */
  D.leave = function () { stopVideos(); exitFs(); flushRead(); };

  function toast(msg, type) { if (window.toast) window.toast(msg, type); }
  function track(a, action) { (D.log || function () { })(D.me ? D.me.name : '', action, a.id); }
  /* 观看埋点走 kb-module 的 pushEvent（带账号、带时长、30 分钟重复播放自动合并）。
     track() 只写操作审计流水，两者分工不同，不要合并。 */
  function trackView(a, detail) {
    if (!a) return;
    if (window.KB && window.KB.pushEvent) window.KB.pushEvent('观看', a.id, detail || {});
  }
  function scrollToSection(id) {
    var t = $(id); if (!t) return;
    t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.querySelectorAll('#kbx-nav button').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-sec') === id); });
  }


  function bindVideo() {
    var v = $('kbx-video'); if (!v) return;
    frameTick(v);
    v.addEventListener('timeupdate', frameTick);
    v.addEventListener('progress', frameTick);
    v.addEventListener('ended', function () { v.controls = true; frameTick(); });
  }
  function frameTick(v) {
    var ct = v.currentTime || 0, dur = v.duration || 0;
    var seek = $('kbx-video-seek');
    if (seek) seek.style.width = (dur ? (ct / dur * 100) : (v.buffered.length ? v.buffered.end(0) / dur * 100 : 0)) + '%';
    var cur = $('kbx-video-cur'), tot = $('kbx-video-dur');
    if (cur) cur.textContent = mmss(Math.floor(ct));
    if (tot) tot.textContent = dur ? mmss(Math.floor(dur)) : '--:--';
  }
  function toggleVideo() {
    var v = $('kbx-video'), notice = $('kbx-play-notice');
    /* 原型不内置视频文件：没有 src 时直接给示意提示，别让它停在"点了没反应" */
    if (!v || !v.getAttribute('src')) { if (notice) notice.style.display = 'flex'; toast('原型未内置视频文件：正式环境在此播放原视频', 'info'); return; }
    if (v.paused) {
      v.controls = true;
      var r = v.play();
      /* 一次播放会话 = 一条「观看」事件；打开详情页不播不计 */
      if (r && typeof r.then === 'function') r.then(function () { trackView(asset(state.id), { seconds: 0, pct: 0 }); }, function () { });
      else trackView(asset(state.id), { seconds: 0, pct: 0 });
      if (r && r.catch) r.catch(function () { if (notice) notice.style.display = 'flex'; toast('浏览器拦住了自动播放，请再点一次播放键', 'info'); });
    } else v.pause();
  }
  function videoMute() {
    var v = $('kbx-video'); if (!v) return;
    v.muted = !v.muted;
    var b = $('kbx-mute'); if (b) b.textContent = v.muted ? '取消静音' : '静音';
  }
  function markProgress() {
    var a = asset(state.id); if (!a) return;
    var v = $('kbx-video');
    var pct = v && v.duration ? Math.min(100, Math.round(v.currentTime / v.duration * 100)) : 0;
    a.progress = Math.max(a.progress || 0, pct);
    track(a, '观看视频');
    /* 回写同一条观看事件（pushEvent 的观看分支会合并 30 分钟内的重复播放并把进度抬上去），
       不新增事件——"标记已学"不是又看了一遍 */
    trackView(a, { seconds: v ? Math.round(v.currentTime || 0) : 0, pct: pct });
    toast(pct ? '已记录观看进度 ' + a.progress + '%' : '已记入学习记录', 'success');
  }

  /* 步骤勾选：操作手册做成可保存的操作清单 */
  function toggleStep(no) {
    var a = asset(state.id); if (!a) return;
    a.steps = a.steps || {};
    a.steps[no] = !a.steps[no];
    var box = document.querySelector('[data-step="' + no + '"]');
    if (box) box.classList.toggle('done', a.steps[no]);
    var box2 = document.querySelector('[data-step2="' + no + '"]');
    if (box2) box2.classList.toggle('done', a.steps[no]);
    var n = Object.keys(a.steps).filter(function (k) { return a.steps[k]; }).length, all = document.querySelectorAll('[data-step]').length;
    var bar = $('kbx-stepcount'); if (bar) bar.textContent = n + ' / ' + all + ' 已完成';
  }

  /* 课件放映：底栏缩略图 / 上一页下一页 / 全屏 */
  /* 课件也算「观看」：首次翻页才算真的在看（打开课件不翻页不计），
     进度按当前页/总页数，pushEvent 会合并 30 分钟内的重复翻页。 */
  function slideView(i, total) {
    var a = asset(state.id); if (!a || !total) return;
    trackView(a, { seconds: 0, pct: Math.round((i + 1) / total * 100), chapter: i + 1 });
  }
  function goSlide(delta) {
    var all = document.querySelectorAll('#kbx-slides .kbx-slide');
    if (!all.length) return;
    var step = 0, target = 0;
    function apply() {
      var i = Math.min(all.length - 1, Math.max(0, step));
      all.forEach(function (el, n) { el.classList.toggle('on', n === i); });
      document.querySelectorAll('#kbx-sheets button').forEach(function (b) { b.classList.toggle('on', Number(b.getAttribute('data-sheet')) === i); });
      var cur = $('kbx-sheet-cur'); if (cur) cur.textContent = i + 1;
      var pick = document.querySelector('[data-slide-jump]');
      if (pick) pick.value = String(i);
      var prev = $('kbx-sheet-prev'), next = $('kbx-sheet-next');
      if (prev) prev.disabled = i <= 0;
      if (next) next.disabled = i >= all.length - 1;
      step = i;
      slideView(i, all.length);
    }
    document.querySelectorAll('#kbx-slides .kbx-slide').forEach(function (el, n) { if (el.classList.contains('on')) target = n; });
    step = target + delta;
    apply();
  }
  function jumpSlide(n) {
    var all = document.querySelectorAll('#kbx-slides .kbx-slide');
    if (!all.length) return;
    n = Math.min(all.length - 1, Math.max(0, Number(n) || 0));
    all.forEach(function (el, i) { el.classList.toggle('on', i === n); });
    document.querySelectorAll('#kbx-sheets button').forEach(function (b) { b.classList.toggle('on', Number(b.getAttribute('data-sheet')) === n); });
    var cur = $('kbx-sheet-cur'); if (cur) cur.textContent = n + 1;
    var prev = $('kbx-sheet-prev'), next = $('kbx-sheet-next');
    if (prev) prev.disabled = n <= 0;
    if (next) next.disabled = n >= all.length - 1;
  }
  function toggleFull() {
    var stage = $('kbx-slides');
    if (!stage) return;
    try {
      if (!document.fullscreenElement) { (stage.requestFullscreen || stage.webkitRequestFullscreen).call(stage); }
      else { (document.exitFullscreen || document.webkitExitFullscreen).call(document); }
    } catch (e) { toast('当前浏览器不支持全屏演示', 'error'); }
  }
  /* 全屏时用方向键 / 空格翻页 */
  document.addEventListener('keydown', function (e) {
    if (!document.fullscreenElement) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); goSlide(1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); goSlide(-1); }
    else if (e.key === 'Escape') exitFs();
  });

  /* ================= 合集（多集）=================
     合集是独立实体（对照 B 站 season）：KB.collections 里每条有自己的 id / 名称 / 简介 / 归属，
     成员关系与顺序都在集合的 members 上。内容本身不带合集字段，所以一集可以同时在多个合集里。
     下面这组函数供详情页各处复用：合集条、上一集/下一集、卡片角标。 */
  function cols() { return D.collections || []; }
  function myCollections(a) {
    return cols().filter(function (c) { return (c.members || []).indexOf(a.id) >= 0; });
  }
  /* 合集里可显示的内容（下架/不可见的跳过），顺序就是集合里的顺序 */
  function membersOf(c) {
    return (c.members || []).map(function (id) { return asset(id); }).filter(Boolean);
  }
  function colInfo(a, c) {
    var members = membersOf(c);
    var index = -1;
    members.forEach(function (x, i) { if (x.id === a.id) index = i; });
    return { col: c, members: members, index: index, pos: index + 1 };
  }
  /* 详情页只显示第一个合集作为主合集：同一条内容挂在多个合集时，其余在右栏「所属合集」里列出 */
  function primaryCol(a) {
    var mine = myCollections(a).filter(function (c) { return c.status === '启用'; });
    return mine.length ? mine[0] : null;
  }

  /* ---------- 封面 ----------
     合集封面取图顺序：上传的封面图 → 合集首条视频的首帧 → 形式占位（灰底 + 字形）。
     首帧用 video 元素 seek 到偏前位置截到 canvas：片头常带黑场/台标，取 1 秒处更稳。
     原型不内置视频文件，videoSrc 取不到源就返回空，调用方自动退回占位图。 */
  var posterCache = {};   /* assetId → dataURL，避免每次进列表都重新解码 */
  function videoSrc(a) {
    var f = videoFile(a);
    if (!f) return '';
    /* 正式环境这里换成真实播放地址（附件 url 或资源服务路径） */
    return f.src || a.videoSrc || '';
  }
  function captureFrame(src, cb) {
    if (!src) { cb(''); return; }
    var v = document.createElement('video');
    v.crossOrigin = 'anonymous';
    v.muted = true; v.preload = 'auto'; v.src = src;
    var done = false;
    function finish(url) {
      if (done) return;
      done = true;
      try { v.removeAttribute('src'); v.load(); } catch (e) { }
      cb(url);
    }
    v.addEventListener('loadedmetadata', function () {
      /* duration 可能是 Infinity / NaN（流式或未定长的 webm），不能直接乘，否则算出的时间点非法、seek 不触发 */
      var dur = isFinite(v.duration) && v.duration > 0 ? v.duration : 0;
      var at = dur ? Math.min(1, Math.max(0.1, dur * 0.03)) : 0.3;
      try { v.currentTime = at; } catch (e) { finish(''); }
    });
    v.addEventListener('seeked', function () {
      try {
        var c = document.createElement('canvas');
        c.width = 640;
        c.height = Math.round(640 * (v.videoHeight || 9) / (v.videoWidth || 16));
        c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
        finish(c.toDataURL('image/jpeg', 0.82));
      } catch (e) { finish(''); }
    });
    /* 取不到帧（无源 / 跨域 / 解码失败）就留空，由调用方退回占位图 */
    v.addEventListener('error', function () { finish(''); });
    setTimeout(function () { if (!done) finish(''); }, 4000);
  }
  function assetPoster(a, cb) {
    if (!a) { cb(''); return; }
    if (a.poster) { cb(a.poster); return; }
    if (posterCache[a.id] !== undefined) { cb(posterCache[a.id]); return; }
    var src = kindOf(a) === '视频' ? videoSrc(a) : '';
    /* 取不到源时不写缓存：附件地址可能稍后才就绪（上传中、接口回填），
       写死空值会让这一条此后永远不出首帧 */
    if (!src) { cb(''); return; }
    captureFrame(src, function (url) { if (url) posterCache[a.id] = url; cb(url); });
  }
  /* 合集封面：上传图优先，否则取合集里第一条视频的首帧 */
  function collectionPoster(c, cb) {
    if (c.cover) { cb(c.cover); return; }
    var first = membersOf(c).filter(function (x) { return kindOf(x) === '视频'; })[0];
    if (!first) { cb(''); return; }
    assetPoster(first, cb);
  }
  D.posterOf = function (c, cb) { collectionPoster(c, cb); };

  /* ================= 列表卡片（科普内容主页的唯一形态） =================
     一屏只有卡片，不再叠加表格。封面优先用真实图，没有就用形式色块。
     卡片上不再有任何角标（形式/官方转载/合集/N 集）：底部动作区只留
     收藏、下载、上架/下架。 */
  function cardCover(a) {
    var p = profile(kindOf(a));
    if (a.poster) return '<span class="kbx-card-cover"><img src="' + esc(a.poster) + '" alt=""></span>';
    /* 图集：第一张图当封面。图集形式有图却显示成一块灰底，说不过去 */
    if (a.gallery && a.gallery.length && a.gallery[0].src) {
      return '<span class="kbx-card-cover"><img src="' + esc(a.gallery[0].src) + '" alt=""></span>';
    }
    /* 色块封面写上形式名：纯色块不写任何字，读者分不出这是文章还是折页；
       有真图（图集首图 / 上传封面）的仍以图为主，形式靠左上角角标标明。 */
    return '<span class="kbx-card-cover kbx-cover--' + p.theme + '"><span class="kbx-cover-kind">' + esc(kindOf(a)) + '</span></span>';
  }
  function card(a) {
    var file = videoFile(a) || deckFile(a) || (a.attachments || [])[0];
    var hasFile = !!file;
    /* 封面角标：左上形式名，右上「下架」，左下「官方转载」。
       三者各占一角，互不遮挡；形式名放左上是因为读者扫卡片时第一眼要判断「这是能读、能看还是能播的」。 */
    var badges = '<span class="kbx-card-kind">' + esc(kindOf(a)) + '</span>';
    if (a.status !== '启用') badges += '<span class="kbx-cb kbx-cb--off">下架</span>';
    if (isRp(a)) badges += '<span class="kbx-cb kbx-cb--rp">官方转载</span>';
    /* 卡片底部一行：标签在左，收藏 / 下载在右，不再留空 */
    var tagHtml = (a.sites || []).slice(0, 1).map(function (t) { return '<span class="kbx-tag">' + esc(t) + '</span>'; }).join('') +
      (a.scenes || []).slice(0, 1).map(function (t) { return '<span class="kbx-tag kbx-tag--soft">' + esc(t) + '</span>'; }).join('');
    return '<div class="kbx-card">' +
      '<a class="kbx-card-hit" href="javascript:void(0)" data-kb="open" data-arg="' + esc(a.id) + '">' +
      '<span class="kbx-card-cover-wrap">' + cardCover(a) +
      badges +
      '</span>' +
      '<span class="kbx-card-body">' +
      '<span class="kbx-card-title">' + esc(a.title) + '</span>' +
      /* 摘要：非必填。有就压成一行短句紧跟标题，没有就整行不出（不留空行、不留「暂无摘要」） */
      (a.summary ? '<span class="kbx-card-desc" title="' + esc(a.summary) + '">' + esc(clipText(a.summary, 40)) + '</span>' : '') +
      '</span></a>' +
      uploaderLine(a) +
      '<div class="kbx-card-foot">' +
      '<div class="kbx-card-tags">' + tagHtml + '</div>' +
      '<div class="kbx-card-acts">' +
      '<button type="button" class="kbx-ico' + (a.fav ? ' on' : '') + '" title="' + (a.fav ? '取消收藏' : '收藏') + '" data-kb="fav" data-arg="' + esc(a.id) + '">' + (a.fav ? '★' : '☆') + '</button>' +
      (hasFile ? '<button type="button" class="kbx-ico" title="下载" data-kb="dl" data-arg="' + esc(a.id) + '|' + esc(file.name) + '">↓</button>' : '') +
      /* 上架/下架：按 KB.canShelf 的既有权限（与转载列表、详情页同一口径） */
      (canShelf(a)
        ? '<button type="button" class="kbx-ico' + (a.status === '启用' ? '' : ' on') + '" title="' +
          (a.status === '启用' ? '下架' : '上架') + '" data-kb="toggleStatus" data-arg="' + esc(a.id) + '">' +
          (a.status === '启用' ? '↓' : '↑') + '</button>'
        : '') +
      '</div></div></div>';
  }
  /* 合集卡：封面用上传图或首帧；都没有则用深色块 + 「合集」
     点卡片 = 直接看第 1 集（和内容卡一样，一步到位进详情页）；
     想看整份目录再点卡片底部那个「N 集」按钮 —— 目录是二级入口，不是默认落点。 */
  /* 卡片里的「上传人 · 机构」一行。
     列表页一屏十几张卡，读者第一眼要判断「这条靠不靠谱」，来源平台之外，
     「谁放进来的、哪家机构的」是第二重要的信息——详情页有，卡片上却看不到，得点进去才知道。
     行首不再标「上传／转载」字样：两类卡片一律只显示人名与机构，取不到就整行不出，不留一个「—」。 */
  function uploaderLine(a) {
    if (!D.ext || !D.ext.uploaderOf) return '';
    var up = D.ext.uploaderOf(a) || {};
    if (!up.name && !up.org) return '';
    return '<div class="kbx-card-up" title="' + esc([up.name, up.org].filter(Boolean).join(' · ')) + '">' +
      (up.name ? '<b>' + esc(up.name) + '</b>' : '') +
      (up.org ? '<span class="kbx-card-up-org">' + esc(up.org) + '</span>' : '') +
      '</div>';
  }
  function collectionCard(c) {
    var items = membersOf(c);
    var first = items[0];
    var cover = c.cover
      ? '<img src="' + esc(c.cover) + '" alt="">'
      : '<span class="kbx-cover-kind kbx-cover-kind--dark">合集</span>';
    var tagHtml = '<span class="kbx-tag kbx-tag--count">' + items.length + ' 集</span>' +
      (c.tags || []).slice(0, 1).map(function (t) { return '<span class="kbx-tag kbx-tag--soft">' + esc(t) + '</span>'; }).join('');
    /* 点卡片：有内容进第 1 集，空合集退回目录提示 */
    var hitAct = first ? 'open' : 'clopen';
    var hitArg = first ? first.id : c.id;
    /* 底部动作区与其他卡片统一：只留收藏 / 下载 / 上下架，不再单设「查看全部 N 集」按钮
       （整张卡都能点，目录仍可从卡片点击与详情页进入） */
    var colFav = '<button type="button" class="kbx-ico' + (c.fav ? ' on' : '') + '" title="' + (c.fav ? '取消收藏' : '收藏') +
      '" data-kb="fav" data-arg="' + esc(c.id) + '">' + (c.fav ? '★' : '☆') + '</button>';
    return '<div class="kbx-card kbx-card--collection">' +
      '<a class="kbx-card-hit" href="javascript:void(0)" data-kb="' + hitAct + '" data-arg="' + esc(hitArg) + '">' +
      '<span class="kbx-card-cover-wrap"><span class="kbx-card-cover kbx-cover--collection" data-poster="' + esc(c.id) + '">' + cover + '</span>' +
      /* 合集卡的左上角标写「合集」，并标出里面有几集：原来没有角标，一片深色块看不出是合集 */
      '<span class="kbx-card-kind">合集</span>' +
      '<span class="kbx-cc-more">' + items.length + ' 集</span>' +
      '</span>' +
      '<span class="kbx-card-body">' +
      '<span class="kbx-card-title">' + esc(c.name) + '</span>' +
      '<span class="kbx-card-desc">' + esc(clipText(c.desc || (first ? first.title : '还没有内容'), 40)) + '</span>' +
      '</span></a>' +
      uploaderLine(c) +
      '<div class="kbx-card-foot">' +
      '<div class="kbx-card-tags">' + tagHtml + '</div>' +
      '<div class="kbx-card-acts">' + colFav + '</div>' +
      '</div></div>';
  }
  /* 列表页统一入口：合集在前，内容在后。
     rpMode=true（转载专区视角）时，未入合集的内容一律走无封面的转载卡。
     opts.collections=false：按下载量 / 收藏量 / 上传时间排序时传进来，合集卡不置顶——
     否则用户点了「下载量」，第一张却是没有下载量字段的合集卡，看起来像没排序。 */
  D.cards = function (items, cols, rpMode, opts) {
    var withCols = !(opts && opts.collections === false);
    var head = withCols ? (cols || []).map(collectionCard).join('') : '';
    var body = (items || []).map(function (a) {
      var inCol = (cols || []).some(function (c) { return c.members.indexOf(a.id) >= 0; });
      return (rpMode && !inCol) ? rpCard(a) : card(a);
    }).join('');
    return head + body;
  };
  /* 平台色：给每个来源一个稳定的竖色条颜色，一眼分平台（比放灰块冒充封面有用） */
  var RP_COLORS = {
    '国家卫生健康委': '#1f6f4a', '国家癌症中心': '#1e4f7a', '中国疾控中心': '#2f6b3f',
    '江西省卫生健康委': '#7a3f1e', '中华医学会': '#5b3f7a', '江西省肿瘤登记中心': '#1e4f7a'
  };
  function rpColor(name) { return RP_COLORS[name] || '#244765'; }
  /* 转载件卡片：无封面。官方页防盗链 / 纯 PDF / 视频页，封面拿不到，
     与其放一块灰块冒充，不如把这块空间让给真正的信息。
     布局：左竖色条(平台色) | 平台·作者·标题·摘要·元信息 | 右外发动作列 */
  /* 卡片上的字段必须和转载表单一一对应：标题 / 来源 / 发布日期 / 类型 / 病种 / 标签。
     以前显示的是「病种 + 使用场景」，而使用场景在转载表单里根本没有这一项——
     createReprint 把它写死成 ['随访宣教']，于是每张转载卡都挂着一个没人填过、
     也没法改的假场景，真正选过的标签反倒不显示。 */
  function rpCard(a) {
    var s = a.source || {};
    var col = rpColor(s.platform);
    var siteTags = (a.sites || []).map(function (t) { return '<span class="kbx-tag">' + esc(t) + '</span>'; }).join('');
    var kwTags = (a.tags || []).map(function (t) { return '<span class="kbx-tag kbx-tag--soft">' + esc(t) + '</span>'; }).join('');
    /* meta 行只放「表单里填过的东西」：日期 / 类型 / 病种 / 标签。
       状态徽章不属于字段，混在里面会被读成一个标签（截图里就是「视频 下架 通用 放疗」），
       所以「下架」移到右上角与「官方转载」并列。 */
    var meta = [];
    if (s.publishedAt) meta.push('<span class="kbx-rp-date">原文发布于 ' + esc(s.publishedAt) + '</span>');
    meta.push('<span class="kbx-tag">' + esc(a.kind) + '</span>');
    /* 不再挂「未存快照」徽章：正文是选填项，缺快照是常态不是缺陷；
       真要核验时详情页来源条里能看到，列表上不该再占一格像告警的灰标。 */
    /* 上下架入口：转载卡以前只有外发按钮，管理员在列表上没法直接下架，
       只能逐条进详情页。这里按权限给一个小开关，与本机构无关的件不显示。 */
    var canToggle = !(D.ext && D.ext.canShelf) || D.ext.canShelf(a);
    var shelfBtn = canToggle
      ? '<button type="button" class="kbx-ico' + (a.status === '启用' ? '' : ' on') + '" title="' +
        (a.status === '启用' ? '下架' : '上架') + '" data-kb="toggleStatus" data-arg="' + esc(a.id) + '">' +
        (a.status === '启用' ? '↓' : '↑') + '</button>'
      : '';
    return '<div class="kbx-card kbx-card--rp" style="--rp-c:' + col + '">' +
      '<span class="kbx-rp-bar"></span>' +
      '<a class="kbx-card-hit" href="javascript:void(0)" data-kb="open" data-arg="' + esc(a.id) + '">' +
      '<span class="kbx-rp-top">' +
      '<span class="kbx-rp-plat">' + esc(s.platform || '官方来源') + '</span></span>' +
      '<span class="kbx-rp-title">' + esc(a.title) + '</span>' +
      '<span class="kbx-rp-desc">' + esc(a.summary) + '</span>' +
      /* meta 行用 flex gap 分隔，不再手写「·」——chip 和文字混排时点号会飘 */
      '<span class="kbx-rp-meta">' + meta.join('') + siteTags + kwTags + '</span>' +      '</a>' +
      '<span class="kbx-rp-side">' +
      shelfBtn +
      '<button type="button" class="kbx-ico" title="带出处复制" data-kb="rpCopy" data-arg="' + esc(a.id) + '">⧉</button>' +
      '<button type="button" class="kbx-ico' + (a.fav ? ' on' : '') + '" title="' + (a.fav ? '取消收藏' : '收藏') + '" data-kb="fav" data-arg="' + esc(a.id) + '">' + (a.fav ? '★' : '☆') + '</button>' +
      (s.url ? '<a class="kbx-ico" title="查看原文" href="' + esc(s.url) + '" target="_blank" rel="noopener">↗</a>' : '') +
      '</span></div>';
  }
  /* 合集卡没封面的，异步补首帧 */
  D.hydrateCollectionCards = function (cols) {
    (cols || []).forEach(function (c) {
      if (c.cover) return;
      D.posterOf(c, function (url) {
        if (!url) return;
        var box = document.querySelector('[data-poster="' + c.id + '"]');
        if (!box || box.querySelector('img')) return;
        box.innerHTML = '<img src="' + url + '" alt="">';
      });
    });
  };

  /* ================= 详情页 ================= */
  D.render = function (id) {
    var el = $('pageContainer');
    var a = asset(id);
    if (!a) {
      if (el) el.innerHTML = '<div class="kbx-empty-page"><div class="kbx-empty-box"><b>未找到这条内容</b><p>编号 ' + esc(id) + ' 的内容不存在，可能已被删除。</p><button class="btn btn-outline btn-sm" data-kb="back">返回内容列表</button></div></div>';
      return;
    }
    D.leave();
    /* 页内动作（勾选步骤 / 标记已学 / 记进度）都按 state.id 回写内容 */
    state.id = id;
    var html = page(a);
    if (el) el.innerHTML = mountRp(html, a);
    postMount(a);
    startRead(a);
  };

  /* 图文 / 手册 / 折页的「观看」：按停留时长计，<10 秒不计（防点开就退污染统计）。
     视频与课件各自在自己的动作里记，不在这里重复记。 */
  var readState = null;
  function readModeOf(a) {
    var m = profile(kindOf(a)).mode;
    return m === 'video' || m === 'slides' ? null : m;
  }
  function startRead(a) {
    readState = null;
    if (!a || !readModeOf(a)) return;
    readState = { id: a.id, t0: Date.now() };
  }
  function flushRead() {
    var r = readState; readState = null;
    if (!r) return;
    var sec = Math.round((Date.now() - r.t0) / 1000);
    if (sec < 10) return;   /* 停留不足 10 秒不算一次阅读 */
    var a = asset(r.id);
    if (!a) return;
    trackView(a, { seconds: sec, pct: 0 });
  }

  function postMount(a) {
    bindVideo();
    /* 图文的轮播：每次渲染后都要重新绑定（innerHTML 会把旧监听一并丢掉） */
    var car = document.querySelector('.kbx-car');
    if (car) bindCarousel(car);
    var stage = $('kbx-slides');
    if (stage) {
      var all = stage.querySelectorAll('.kbx-slide');
      if (all.length) { all[0].classList.add('on'); jumpSlide(0); }
    }
    var main = $('mainContent');
    if (main) main.scrollTop = 0;
  }

  /* ---- 页内导航 ---- */
  /* ---- 主栏：视频 ----
     播放器进度条上的刻点与「本期章节」列表共用一套切分结果：正文按 h2 切开，
     每个小标题在进度条上打一个刻点。章节列表本身不单独渲染（详情页不再铺一章一张卡）。 */
  function videoMain(a, p) {
    var secs = splitSections(a.body === null ? '' : a.body).length ? splitSections(a.body) : [{ h: '本节内容', html: '<div class="kbx-p"><p>' + esc(a.summary) + '</p></div>' }];
    var dur = runtime(a);
    var each = Math.max(20, Math.floor(dur / Math.max(1, secs.length)));
    var marks = [{ t: 0, h: '开场 · ' + (stripHtml(a.summary).slice(0, 18) || '本期要点') }].concat(secs.map(function (s, i) { return { t: Math.min(dur || 9999, 20 + i * each), h: s.h }; }));
    var track = marks.map(function (m) { return '<span class="kbx-tick" style="left:' + (dur ? (m.t / dur * 100) : 0) + '%" title="' + esc(mmss(m.t) + ' ' + m.h) + '"></span>'; }).join('');
    var player = '<div class="kbx-player" id="kbx-player">' +
      '<div class="kbx-player-screen"><video id="kbx-video" playsinline preload="metadata" poster="" controls></video>' +
      '<div class="kbx-player-poster"><span class="kbx-pp-label">' + esc(kindOf(a)) + '</span><span class="kbx-pp-sub">' + esc((videoFile(a) || {}).name || '') + '</span><span class="kbx-pp-glyph">播</span></div>' +
      '<button type="button" class="kbx-playbig" id="kbx-playbig" data-kb="videoPlay" aria-label="播放"><span>▶</span></button>' +
      '<div class="kbx-play-notice" id="kbx-play-notice">本原型不内置视频文件；正式环境按此播放器播原视频，章节与进度都在这里<br><button class="kbx-play-again" data-kb="videoPlay">再试一次</button></div>' +
      (a.progress ? '<div class="kbx-resume">上次看到 <b>' + a.progress + '%</b>，继续播放</div>' : '') +
      '</div>' +
      '<div class="kbx-player-bar"><span id="kbx-video-cur">0:00</span><span class="kbx-vbar"><i id="kbx-video-seek"></i>' + track + '</span><span id="kbx-video-dur">' + (dur ? mmss(dur) : '--:--') + '</span>' +
      '<button class="kbx-pbtn" data-kb="videoMute" id="kbx-mute">静音</button><button class="kbx-pbtn" data-kb="videoMark">标记已学</button></div>' +
      '</div>';

    var related = relatedVideos(a);
    /* 简介区只在真有正文时出现；没有正文就不必再挂一个「视频简介」的空标题。
       正文里的小标题原本是 <h2>，与外层区块标题同级会串成一片，统一降到 h3。 */
    var descBody = stripHtml(a.body || '')
      ? String(a.body).replace(/<h2(\s[^>]*)?>/gi, '<h3$1>').replace(/<\/h2>/gi, '</h3>')
      : '';
    var descHtml = descBody
      ? '<section class="kbx-block" id="kbx-desc"><div class="kbx-block-hd"><h2>视频简介</h2></div>' +
        '<div class="kbx-item kbx-item--flat">' + rpTpl(a, 'note') + '<div class="kbx-prose kbx-prose--tight">' + descBody + '</div></div></section>'
      : (isRp(a) ? '<section class="kbx-block" id="kbx-desc">' + rpTpl(a, 'note') + '</section>' : '');
    if (isRp(a)) descHtml += rpTpl(a, 'decl');

    return '<div class="kbx-main">' +
      '<section class="kbx-block" id="kbx-player-block">' + player + '</section>' +
      /* 收藏 / 下载紧跟播放器：看完才决定要不要留、要不要下，贴在窗口正下方最顺手。
         简介等补充说明排在这排动作之后。 */
      actionBar(a, p) +
      /* 信息条：受众 / 标签 / 补充附件 */
      metaStrip(a) +
      descHtml +
      /* 依据出处块已删除：函数恒返回空，调用点保留仅为不破坏六套版式的结构 */
      evidenceBlock(a) +
      (related ? '<section class="kbx-block" id="kbx-more"><div class="kbx-block-hd"><h2>相关视频</h2><span class="kbx-block-sub">同一场景下还在架的</span></div><div class="kbx-relrow">' + related + '</div></section>' : '') +
      '</div>';
  }

  function relatedVideos(a) {
    var mine = myCollections(a).map(function (c) { return c.id; });
    /* 同合集的其它集已经在上面的合集条里了，相关推荐里不再重复 */
    var pool = list().filter(function (x) {
      return x.track === '科普' && x.id !== a.id && x.status === '启用' && kindOf(x) === '视频' &&
        !myCollections(x).some(function (c) { return mine.indexOf(c.id) >= 0; });
    });
    var vids = pool.filter(function (x) { return (x.scenes || []).some(function (s) { return (a.scenes || []).indexOf(s) >= 0; }); });
    if (!vids.length) vids = pool;
    return vids.slice(0, 2).map(function (x) {
      return '<a class="kbx-rel" href="javascript:void(0)" data-kb="open" data-arg="' + esc(x.id) + '"><span class="kbx-rel-thumb">播</span><span class="kbx-rel-txt"><b>' + esc(x.title) + '</b><span>' + esc(x.summary) + '</span></span><span class="kbx-rel-at">' + (runtime(x) ? mmss(runtime(x)) : '') + '</span></a>';
    }).join('');
  }

  /* ---- 主栏：课件放映 ---- */
  function slidesMain(a) {
    var slides = slidesOf(a);
    var isCover = function (s) { return s.cover || (s.title && !s.raw && !s.h); };
    var inner = slides.map(function (s, i) {
      var cls = 'kbx-slide' + (s.cover || i === 0 ? ' kbx-slide--cover' : '') + (isCover(s) && i > 0 ? ' kbx-slide--chapter' : '');
      var content;
      if (s.raw) content = '<div class="kbx-slide-body kbx-slide-raw">' + s.raw + '</div>';
      else if (isCover(s) && i === 0) {
        content = '<div class="kbx-slide-body"><div class="kbx-sl-kicker">' + esc(trackLabel(a.track)) + ' · ' + esc(a.kind) + '</div><h3 class="kbx-sl-title">' + esc(s.title) + '</h3>' +
          (s.sub ? '<div class="kbx-sl-sub">' + esc(s.sub) + '</div>' : '') +
          '<ul class="kbx-sl-bullets">' + (s.bullets || []).map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul>' +
          /* 转载课件的封面页脚不能写本院名字：写死等于把别人的课件署了江西的名，是合规事故 */
          '<div class="kbx-sl-foot">' + (isRp(a) && a.source ? '转载自 ' + esc(a.source.platform) : '江西省肿瘤登记中心') +
          '　·　' + esc((a.sites || []).join('、')) + '　·　' + esc(isRp(a) && a.source ? (a.source.publishedAt || '') : (a.publishedAt || '')) + '</div></div>';
      } else {
        content = '<div class="kbx-slide-body"><div class="kbx-sl-kicker">第 ' + (i + 1) + ' 页' + (s.tag ? ' · ' + esc(s.tag) : '') + '</div>' +
          (s.title || s.h ? '<h3 class="kbx-sl-title">' + esc(s.title || s.h) + '</h3>' : '') +
          (s.bullets ? '<ul class="kbx-sl-bullets kbx-sl-bullets--big">' + s.bullets.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul>' : '') +
          '</div>';
      }
      return '<div class="' + cls + '"><div class="kbx-slide-inner">' + content + '<div class="kbx-sl-pg">' + (i + 1) + ' / ' + slides.length + '</div></div></div>';
    }).join('');

    var sheets = slides.map(function (s, i) {
      return '<button type="button" data-sheet="' + i + '" title="' + esc(s.title || s.h || ('第 ' + (i + 1) + ' 页')) + '" onclick="KBDetail.jumpSlide(' + i + ')"><span>' + (i + 1) + '</span></button>';
    }).join('');

    var chapters = slides.filter(function (s, i) { return isCover(s) && i > 0; }).map(function (s, i) {
      /* 左列已经给了 01 / 02 这种序号，标题里自带的「一、」「二、」要去掉，否则会渲染成「01 一、必填字段口径」 */
      var t = stripStepNo(stripHtml(s.title || s.h || ''));
      return '<li><span class="kbx-num">' + String(i + 1).padStart(2, '0') + '</span>' + esc(t) + '</li>';
    }).join('');

    /* 课件 + 讲课视频：课件常常是「PPT/PDF 本体 + 现场录制的视频」两样，存不存视频是常态差异。
       有视频就把视频放在放映上方（先看人怎么讲，再翻课件），没有就只放放映机、什么也不出。 */
    var vid = videoFile(a);
    var deckVid = vid
      ? '<section class="kbx-block" id="kbx-deck-video"><div class="kbx-block-hd"><h2>讲课视频</h2>' +
        '<span class="kbx-block-sub">' + esc(vid.name) + (vid.size ? ' · ' + esc(vid.size) : '') + '</span></div>' +
        '<div class="kbx-player kbx-player--compact" id="kbx-player">' +
        '<div class="kbx-player-screen"><video id="kbx-video" playsinline preload="metadata" controls></video>' +
        '<div class="kbx-player-poster"><span class="kbx-pp-label">' + esc(kindOf(a)) + ' · 讲课视频</span><span class="kbx-pp-sub">' + esc(vid.name) + '</span><span class="kbx-pp-glyph">播</span></div>' +
        '<button type="button" class="kbx-playbig" id="kbx-playbig" data-kb="videoPlay" aria-label="播放"><span>▶</span></button>' +
        '<div class="kbx-play-notice" id="kbx-play-notice">本原型不内置视频文件；正式环境在此播放讲课视频<br><button class="kbx-play-again" data-kb="videoPlay">再试一次</button></div>' +
        '</div></div>' +
        /* 浏览器放不了 AVI / MKV：给一条明确的下载出口，别让人对着黑屏以为坏了 */
        (/\.(mp4|mov|webm)$/i.test(vid.name) ? '' : '<div class="kbx-play-tip">该格式浏览器无法直接播放，请下载后观看。</div>') +
        '</section>'
      : '';
    var deck = deckVid + '<section class="kbx-block" id="kbx-deck"><div class="kbx-deck"><div class="kbx-slides" id="kbx-slides">' + inner + '</div>' +
      '<div class="kbx-deck-bar"><button class="btn btn-ghost btn-sm" id="kbx-sheet-prev" data-kb="slidePrev" disabled>‹ 上一页</button>' +
      '<span class="kbx-sheet-count"><b id="kbx-sheet-cur">1</b> / ' + slides.length + '</span>' +
      '<span class="kbx-sheets" id="kbx-sheets">' + sheets + '</span>' +
      '<button class="btn btn-ghost btn-sm" id="kbx-sheet-next" data-kb="slideNext">下一页 ›</button>' +
      '<button class="btn btn-outline btn-sm" data-kb="slideFull">全屏演示</button></div></div></section>';

    var desc = '<section class="kbx-block" id="kbx-desc"><div class="kbx-block-hd"><h2>课件说明</h2></div>' +
      '<div class="kbx-item kbx-item--flat">' + rpTpl(a, 'note') + '<div class="kbx-prose kbx-prose--tight">' + String(a.body || '').replace(/<\/p>\s*<\/?p[^>]*>/g, '</p><p>') + '</div>' +
      (chapters ? '<div class="kbx-block-hd kbx-block-hd--sm"><h3>内容框架</h3></div><ol class="kbx-toclist">' + chapters + '</ol>' : '') + '</div></section>';

    /* 两栏：左＝放映（以及讲课视频），右＝说明与内容框架。
       原来全部竖排，PPT 在 1000px 宽的容器里被挤成一条窄带，右侧空出大片，
       读者还得滚很久才能看到说明。右栏常驻后，翻页看课件时说明和章节一直在手边。 */
    return '<div class="kbx-main"><div class="kbx-deck-layout">' +
      '<div class="kbx-deck-main">' + deck + metaStrip(a) + '</div>' +
      '<aside class="kbx-deck-side">' + desc + evidenceBlock(a) + rpTpl(a, 'decl') + '</aside>' +
      '</div></div>';
  }

  /* ---- 主栏：操作手册 ---- */
  function manualMain(a) {
    var bodyHtml = String(a.body || '');
    var hs = [], re = /<h3[^>]*>([\s\S]*?)<\/h3>/gi, m;
    while ((m = re.exec(bodyHtml))) hs.push(stripHtml(m[1]));
    var ol = [], k = 1;
    /* 目录自带 1 / 2 / 3 编号，章标题里的「一、」「二、」要去掉，否则是「1 一、查收退回卡」 */
    var toc = hs.length ? '<div class="kbx-toc"><div class="kbx-toc-t">目录</div><ol>' + hs.map(function (h) { return '<li><span class="kbx-num">' + (k++) + '</span>' + esc(stripStepNo(h)) + '</li>'; }).join('') + '</ol></div>' : '';

    /* 正文后处理：编号步骤做成可勾选清单，pre 保留 */
    var enhanced = bodyHtml;
    var stepsNo = 0;
    enhanced = enhanced.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, function (mt, inner) {
      var lis = [];
      inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, function (x, t) { lis.push(t); return x; });
      if (!lis.length) return mt;
      return '<div class="kbx-checklist">' + lis.map(function (t) {
        stepsNo++;
        var st = (a.steps || {})[stepsNo];
        return '<div class="kbx-check' + (st ? ' done' : '') + '" data-step="' + stepsNo + '" data-kb="step" data-arg="' + stepsNo + '"><span class="kbx-check-box">✓</span><span class="kbx-check-txt">' + t + '</span></div>';
      }).join('') + '</div>';
    });
    var back2 = enhanced.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, function (mt, inner) {
      var lis = [];
      inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, function (x, t) { lis.push(t); return x; });
      return '<ul class="kbx-ul">' + lis.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>';
    });

    /* 顶部只放标题，摘要只在「与正文不同」时才当导语；摘要和正文一样就不重复渲染 */
    var brief = stripHtml(a.summary), bodyTxt = stripHtml(a.body);
    var lead = brief && brief.replace(/[….\s]+$/, '') !== bodyTxt.replace(/[….\s]+$/, '') ? brief : '';
    return '<div class="kbx-main">' +
      '<section class="kbx-block" id="kbx-doc"><div class="kbx-doc"><div class="kbx-doc-hd"><span class="kbx-hero-glyph">册</span><div><h2>' + esc(a.title) + '</h2>' +
      (lead ? '<div class="kbx-doc-meta">' + esc(lead) + '</div>' : '') + '</div></div>' +
      (toc ? toc : '') +
      rpTpl(a, 'note') +
      '<div class="kbx-doc-body">' + back2 + '</div>' + rpTpl(a, 'decl') +
      (stepsNo ? '<div class="kbx-doc-foot"><span>操作清单</span><b id="kbx-stepcount">' + Object.keys(a.steps || {}).filter(function (x) { return a.steps[x]; }).length + ' / ' + stepsNo + ' 已完成</b></div>' : '') +
      '</div></section>' +
      metaStrip(a) +
      evidenceBlock(a) +
      '</div>';
  }

  /* ---- 主栏：宣传折页 ----
     折页是「扫一眼」的版面，所以正文按 h3 分块、块内按句子拆行：
     首块做要点大卡（「复查请携带：…」拆成标签 + 内容），编号句做步骤，其余进注意事项。 */
  function flyerSections(body) {
    var html = String(body || '');
    var out = [], re = /<h3[^>]*>([\s\S]*?)<\/h3>/gi, marks = [], m;
    while ((m = re.exec(html))) marks.push({ t: stripHtml(m[1]), i: m.index, e: m.index + m[0].length });
    var blocks = [];
    /* __at 记块在原文里的位置：大字卡要按文档顺序挑第一节，不能按「谁先被收集进数组」挑 */
    if (!marks.length) blocks.push({ h: '', __at: 0, html: html });
    else {
      if (marks[0].i > 0) blocks.push({ h: '', __at: 0, html: html.slice(0, marks[0].i) });
      for (var i = 0; i < marks.length; i++) {
        blocks.push({ h: marks[i].t, __at: marks[i].i, html: html.slice(marks[i].e, i + 1 < marks.length ? marks[i + 1].i : html.length) });
      }
    }
    blocks.forEach(function (b) {
      var items = [];
      String(b.html).split(/<\/p>|<br\s*\/?>|<\/li>/i).forEach(function (chunk) {
        stripHtml(chunk).split(/(?<=[。；;])/).forEach(function (s) {
          var t = s.replace(/^[\s、，,。；;]+/, '').trim();
          if (t) items.push(t);
        });
      });
      if (items.length) out.push({ h: b.h, items: items, __at: b.__at });
    });
    return out;
  }
  /* 编号句：阿拉伯数字（1) 1、1.）、带圈数字、以及「一、二、」这种中文序号都算步骤。
     中文序号以前漏判，折页里「一、把出院小结拍照…」被当成普通要点塞进大字卡，编号还留着，读起来像半截流程。 */
  function isStepItem(t) { return /^(?:\d{1,2}\s*[)）、．.](?!\d)|[①②③④⑤⑥⑦⑧⑨⑩]|[一二三四五六七八九十]+[、.．])/.test(t); }
  function stripStepNo(t) { return t.replace(/^(?:\d{1,2}\s*[)）、．.](?!\d)|[①②③④⑤⑥⑦⑧⑨⑩]|[一二三四五六七八九十]+[、.．])?\s*/, ''); }

  /* 折页的编排规则（原来只挑出要点/步骤/其它三筐，把小标题丢了）：
     ① 首个不带标题的块里，若「①②③ / 一 二 三」这类编号句 ≥3 条 → 这组就是折页的三条主信息，
        做成大字卡并沿用原小标题（没有小标题就用「三条重点」），编号换成 壹贰叁；
     ② 其它小标题按原顺序成节：节内编号句 ≥2 条排成流程（保留它自己的小标题），
        单个编号的句子和普通句子一起列成要点——不再把「一、二、」硬塞成大字卡；
     ③ 完全没有小标题的碎句，兜底成「其它须知」。 */
  function flyerMain(a) {
    var secs = flyerSections(a.body);
    var head = secs.filter(function (s) { return !s.h; })[0];
    var named = secs.filter(function (s) { return !!s.h; });
    var headItems = (head && head.items) || [];
    var leadSteps = headItems.filter(isStepItem);

    /* 大字卡取「原文里先出现的那一组」：折页的第一节就是作者心里最要紧的三条。
       上一版先找「有非编号句子」的块，结果把末尾的「这些情况马上回医院」挑成了主卡，
       顺序颠倒了。这里按文档顺序扫：首个无标题块或首个 ≥3 条编号句的小节，谁先出现用谁。 */
    var pills = [], pillTitle = '';
    var cand = secs.slice().sort(function (x, y) { return x.__at - y.__at; });
    for (var k = 0; k < cand.length; k++) {
      var s0 = cand[k];
      var st = s0.items.filter(isStepItem);
      if (st.length >= 3) { pills = st.slice(0, 3); pillTitle = s0.h || '三条重点'; break; }
      var plain0 = s0.items.filter(function (t) { return !isStepItem(t); });
      if (plain0.length) { pills = plain0; pillTitle = s0.h || ''; break; }
    }
    var pillHtml = pills.length ? '<div class="kbx-flyer-pills">' + pills.slice(0, 3).map(function (t, i) {
      var at = t.indexOf('：'), label = at > 0 && at <= 12 ? t.slice(0, at) : '', text = at > 0 && at <= 12 ? t.slice(at + 1) : t;
      return '<div class="kbx-flyer-pill"><span class="kbx-pill-no">' + '壹贰叁'[i] + '</span><div class="kbx-pill-body">' +
        (label ? '<span class="kbx-pill-label">' + esc(label) + '</span>' : '') +
        '<p>' + esc(text) + '</p></div></div>';
    }).join('') + '</div>' : '';

    /* 剩下的句子按带标题的块成节；首个无名块里没被大字卡用掉的句子归到第一节之前 */
    var usedPill = pills;
    var sections = named.map(function (s) {
      var own = s.items.filter(function (t) { return usedPill.indexOf(t) < 0; });
      var steps = own.filter(isStepItem).map(stripStepNo);
      var rest = own.filter(function (t) { return !isStepItem(t); });
      if (steps.length >= 2) {
        return '<div class="kbx-flyer-flow"><div class="kbx-flyer-notes-h">' + esc(s.h) + '</div>' +
          '<ol class="kbx-flyer-steps">' + steps.map(function (t) { return '<li><span class="kbx-fstep-no"></span><span>' + esc(t.replace(/[；;。]\s*$/, '')) + '</span></li>'; }).join('') + '</ol>' +
          (rest.length ? '<ul class="kbx-flyer-sub"><li>' + rest.map(function (t) { return esc(t); }).join('</li><li>') + '</li></ul>' : '') + '</div>';
      }
      var lines = own.map(function (t) { return esc(stripStepNo(t)); });
      return lines.length ? '<div class="kbx-flyer-notes"><div class="kbx-flyer-notes-h">' + esc(s.h) + '</div><ul><li>' + lines.join('</li><li>') + '</li></ul></div>' : '';
    }).filter(Boolean).join('');
    /* 首个无名块里既没进大字卡、也不是步骤的单句 → 兜底「其它须知」 */
    var stray = headItems.filter(function (t) { return usedPill.indexOf(t) < 0 && !isStepItem(t); });
    var noteHtml = stray.length && !named.length
      ? '<div class="kbx-flyer-notes"><div class="kbx-flyer-notes-h">其它须知</div><ul>' + stray.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>' : '';
    var leadHtml = pillTitle ? '<div class="kbx-flyer-pills-h">' + esc(pillTitle) + '</div>' : '';
    return '<div class="kbx-main">' +
      rpTpl(a, 'note') +
      '<section class="kbx-block" id="kbx-flyer"><div class="kbx-flyer">' +
      /* 版头用「内容线 · 形式」，与上传时选的字段一一对应；原来写死「患者须知」，
         培训折页（如报告卡速查）挂上「患者须知」就是错的。 */
      '<div class="kbx-flyer-head"><div class="kbx-flyer-kicker">' + esc(trackLabel(a.track)) + ' · ' + esc(kindOf(a)) + '</div><h2>' + esc(a.title) + '</h2><p>' + esc(stripHtml(a.summary)) + '</p></div>' +
      leadHtml + pillHtml + sections + noteHtml +
      /* 页脚不再重复发布单位：标题行已经给过 */
      '</div></section>' +
      rpTpl(a, 'decl') +
      /* 折页版头已印了标题与摘要，信息条只补「上传人 / 附件」这类不在版面上的字段，不重复受众与标签 */
      metaStrip(a, { hide: true }) +
      '</div>';
  }

  /* ---- 两栏侧信息 ----
     视频 / 课件页是三栏：左＝合集选集，中＝播放器，右＝本篇信息。
     合集是「看第几集」的导航，天然在左边；信息是「这条是什么」的注解，放右边。
     以前两者都堆在右侧一栏里，播放器左边空着，右边挤成一长条。 */

  /* 合集选集栏。没有合集就整栏不出现（不留一个空壳） */
  function asideLeft(a, p) {
    var pc = primaryCol(a);
    if (!pc || (p.mode !== 'video' && p.mode !== 'slides')) return '';
    var si = colInfo(a, pc);
    if (si.members.length < 2) return '';
    return '<div class="kbx-side kbx-side--col">' +
      '<div class="kbx-side-sec">' +
      /* 合集名可点：进合集目录页（简介 / 封面 / 全套列表 / 维护入口都在那边） */
      '<a class="kbx-side-hd kbx-side-hd--link" href="javascript:void(0)" data-kb="clopen" data-arg="' + esc(pc.id) + '" title="查看合集目录">' +
      esc(pc.name) + '<b>' + si.members.length + ' 集 ›</b></a>' +
      '<div class="kbx-ep-list">' + si.members.map(function (x, i) {
        var cur = x.id === a.id, off = x.status !== '启用';
        var inner = '<span class="kbx-ep-i">' + String(i + 1).padStart(2, '0') + '</span>' +
          '<span class="kbx-ep-t">' + esc(x.title) + '</span>' +
          (off ? '<span class="kbx-ep-b">下架</span>' : '');
        return cur || off
          ? '<div class="kbx-ep-row' + (cur ? ' on' : '') + (off ? ' off' : '') + '">' + inner + '</div>'
          : '<a class="kbx-ep-row" href="javascript:void(0)" data-kb="open" data-arg="' + esc(x.id) + '">' + inner + '</a>';
      }).join('') + '</div></div></div>';
  }

  /* 播放器下方的一条信息：受众 / 标签 / 补充附件。
     精简原则——凡是在标题行或右上角按钮里已经出现过的，这里一律不再重复：
       · 更新  → 标题行已有
       · 主视频文件 → 右上角「下载原视频」就是它，列出来等于同一份文件给两个入口
     依据出处条已整体删除，信息条只放受众 / 标签 / 上传人 / 附件。 */
  /* 信息条：受众 / 标签 / 上传人 / 附件——全部取自上传表单里真实填写的字段。
     opts.hide：本版式已经把某些字段放进了版面主体，这里不再重复。
       折页版头已经印了标题与摘要，若再条一条「受众…上传…」就是同一屏里两套信息，所以折页传 hide。 */
  function metaStrip(a, opts) {
    opts = opts || {};
    var items = [];
    if (!opts.hide && a.audiences && a.audiences.length) items.push(['受众', esc(a.audiences.join('、'))]);
    if (!opts.hide && a.tags && a.tags.length) items.push(['标签', esc(a.tags.join('、'))]);
    /* 上传人 / 上传机构：读者想知道「这条是谁放到库里的」，出问题时也知道找谁。
       原创件的「发布人 · 发布单位」在标题行；这里是上传动作的经手人，两者是不同的事实，
       同一份内容可能由 A 上传、B 上架，所以各自显示。
       转载件：上传人 = 转载经手人，机构 = 该经手人所属机构。 */
    if (D.ext && D.ext.uploaderOf) {
      var up = D.ext.uploaderOf(a) || {};
      if (up.name || up.org) {
        items.push(['上传', esc([up.name, up.org].filter(Boolean).join(' · ') +
          (up.at ? '（' + String(up.at).slice(0, 10) + '）' : ''))]);
      }
    }
    var cells = items.map(function (r) {
      return '<div class="kbx-strip-cell"><span>' + esc(r[0]) + '</span><b>' + r[1] + '</b></div>';
    }).join('');

    /* 主文件（视频 / 课件本体）已经在页面上单独呈现（播放器 / 放映机 / 右上角下载），
       附件区只列补充材料。课件可能同时有视频和 PPT 两个主文件，所以两个都要排除，
       不能只排除「先找到的那一个」，否则另一个主文件会在附件里重复出现一遍。 */
    var mainNames = [videoFile(a), deckFile(a)].filter(Boolean).map(function (f) { return f.name; });
    var extras = (a.attachments || []).filter(function (f) { return mainNames.indexOf(f.name) < 0; });
    var files = extras.map(function (f) {
      var ext = esc(String(f.name).split('.').pop().toUpperCase());
      return '<div class="kbx-file"><span class="kbx-file-ext">' + ext + '</span><div class="kbx-file-txt"><b>' + esc(f.name) + '</b><span>' + esc(f.size || '—') + '</span></div>' +
        '<button class="btn btn-ghost btn-xs" data-kb="dl" data-arg="' + esc(a.id) + '|' + esc(f.name) + '">下载</button></div>';
    }).join('');

    if (!cells && !files) return '';
    return '<section class="kbx-block kbx-block--strip" id="kbx-strip">' +
      (cells ? '<div class="kbx-strip">' + cells + '</div>' : '') +
      (files ? '<div class="kbx-strip-files">' + files + '</div>' : '') +
      '</section>';
  }
  /* 依据出处：整块已按需求删除（视频 / 课件 / 手册 / 折页 / 图文 / 文章六种版式全部不再展示）。
     字段本身也不再采集，历史数据保留在库里但不渲染。
     函数保留为空实现，是因为六套版式里都有调用点，逐个删容易漏掉一处，
     留着空函数能保证「哪里都不再出现这个框」。 */
  function evidenceBlock() { return ''; }
  /* ---- 组装 ---- */
  /* ================= 页面骨架 =================
     按形式分：
       视频 / 课件 / 手册：左「合集选集」（仅视频、课件且有合集时）| 右「正文 + 信息条」
       图文 / 折页：单栏 —— 纯阅读
     全站不再有右侧信息栏：它把正文挤窄、又长又空。
     受众 / 标签 / 补充附件统一落在正文下方一条横带里。
     视频页不出页签条：整页只有播放器一个区块，页签没有第二处可跳。 */
  function page(a) {
    var p = profile(kindOf(a));
    var mode = p.mode;
    var hasCol = mode === 'video' || mode === 'slides';
    var tabs = mode === 'video' ? '' : anchorTabs(a, mode);

    if (mode === 'video' || mode === 'slides' || mode === 'manual') {
      var colHtml = hasCol ? asideLeft(a, p) : '';
      return '<div class="kbx-page kbx-theme-' + p.theme + ' kbx-page--' + mode + '">' +
        titleBlock(a, p) +
        '<div class="kbx-body' + (colHtml ? ' kbx-body--with-col' : '') + '">' +
        '<div class="kbx-main-col">' + tabs + mainFor(a, p) + '</div>' +
        /* 合集选集在播放器右侧：先看内容，需要换集时眼睛往右一扫就到 */
        (colHtml ? '<div class="kbx-col-right">' + colHtml + '</div>' : '') +
        '</div></div>';
    }
    return '<div class="kbx-page kbx-theme-' + p.theme + ' kbx-page--' + mode + '">' +
      titleBlock(a, p) +
      '<div class="kbx-body">' +
      '<div class="kbx-main-col">' + tabs + mainFor(a, p) + '</div>' +
      '</div></div>';
  }
  /* 页内导航：横向 tab（只在有 2 个以上锚点时才出现） */
  function anchorTabs(a, mode) {
    var items;
    if (mode === 'video') {
      items = [['kbx-player-block', '播放']];
      /* 简介只在有摘要/正文时才有 */
      if (stripHtml(a.summary || '') || stripHtml(a.body || '')) items.push(['kbx-desc', '简介']);
      if (relatedVideos(a)) items.push(['kbx-more', '相关']);
    } else if (mode === 'slides') {
      /* 带讲课视频的课件，页内导航从「视频」开始——视频在放映机上方 */
      items = (videoFile(a) ? [['kbx-deck-video', '讲课视频']] : []).concat([['kbx-deck', '放映'], ['kbx-desc', '说明']]);
    }
    else if (mode === 'manual') items = [['kbx-doc', '正文']];
    else if (mode === 'flyer') items = [['kbx-flyer', '折页']];
    else items = stripHtml(String(a.body || '')) ? [['kbx-article', '正文']] : [];
    /* 转载件多一个「来源」锚点：声明块在文末，读者要找原文链接时不必滚到底再找 */
    if (isRp(a)) items.push(['kbx-reprint-decl', '来源']);
    if (items.length < 2) return '';
    return '<nav class="kbx-tabs" id="kbx-nav">' + items.map(function (it, i) {
      return '<button type="button" data-sec="' + it[0] + '" class="' + (i === 0 ? 'active' : '') +
        '" onclick="KBDetail.scrollTo(\'' + it[0] + '\')">' + esc(it[1]) + '</button>';
    }).join('') + '</nav>';
  }
  /* 标题区：标题 + 一行元信息 + 右侧动作。约 96px，不再有大块头图 */
  function titleBlock(a, p) {
    var kind = kindOf(a);
    var pc = primaryCol(a);
    var pi = pc ? colInfo(a, pc) : null;
    var facts = [];
    /* 有合集时，这一格做成链接：进合集目录（看全套 / 改简介 / 加内容都在那边）。
       合集卡点进来是第 1 集，这里是回到目录的唯一显眼入口。 */
    var headFact = pi
      ? '<a class="kbx-tb-link" href="javascript:void(0)" data-kb="clopen" data-arg="' + esc(pc.id) + '" title="查看合集目录">' +
        esc(pc.name) + ' · 第 ' + pi.pos + '/' + pi.members.length + ' 集</a>'
      : esc(kind);
    /* 精简：只留有读者价值的信息。
       「省库 / 机构名」是后台主体信息，读者不关心，已移除。 */
    if (kind === '视频' && runtime(a)) facts.push(mmss(runtime(a)));
    if (kind === '课件') {
      facts.push(slidesOf(a).length + ' 页');
      /* 带讲课视频的课件，把「有视频」点出来：读者看见时长就知道上下两个区都要看 */
      if (videoFile(a)) facts.push('附讲课视频' + (runtime(a) ? ' ' + mmss(runtime(a)) : ''));
    }
    /* 转载件显示的是「原文发布于 X」，不是「更新 X」：
       a.publishedAt 存的是转载入库日期，写成「更新」读者会当成原文的更新时间。 */
    if (isRp(a)) {
      /* 原文的发布单位就是来源平台；发布人 / 发布单位（我方发售责任主体）
         在正文下方的来源条里单独给出，这里不重复。 */
      var sp = (a.source && a.source.platform) || '';
      facts.push('原文发布：' + (sp ? sp + ' · ' : '') + ((a.source && a.source.publishedAt) || '—'));
    } else if (a.publishedAt) {
      /* 原创件：发布日期 + 发布单位 + 发布人，一行读完「什么时候、哪家的、谁发的」。
         没有发布日期就是未发布，不显示「发布 —」。 */
      facts.push('发布于 ' + a.publishedAt);
      if (a.publisherOrg) facts.push(a.publisherOrg);
      if (a.publisher) facts.push(a.publisher);
    }
    /* 标题区只留左上角的「返回」。
       收藏 / 下载 / 取用是「看完这条要做什么」，跟着内容走（见 actionBar）；
       编辑与上架也不该和读者动作挤在一排。 */
    var badges = '';
    if (a.status !== '启用') badges += '<span class="kbx-tb-flag">已下架</span>';
    return '<header class="kbx-titlebar">' +
      /* 返回独立成行、靠左：它属于「离开这一页」的导航，不和数据同排 */
      '<div class="kbx-tb-crumb"><button class="btn btn-ghost btn-sm kbx-back" data-kb="back">← 返回</button></div>' +
      '<div class="kbx-tb-main">' +
      '<h1 class="kbx-tb-title">' + esc(a.title) + '</h1>' +
      '<div class="kbx-tb-meta">' + headFact + (facts.length ? '<span class="kbx-dot">·</span>' : '') + facts.map(esc).join('<span class="kbx-dot">·</span>') + badges + '</div>' +
      '</div>' +
      '</header>';
  }
  /* 播放器下方那一排动作。分组：读者动作在左（收藏 / 取用），管理动作在右（编辑 / 上架）。
     转载件的「带出处复制 / 生成长图」由 kb-module 插进中间的外发组——它们是"往外发"，
     和读者的"收藏/取用"、作者的"编辑/上架"是三种不同意图，混在一排会让人犹豫点哪个。 */
  function actionBar(a, p) {
    var reader = [];
    var admin = [];
    reader.push(a.fav
      ? '<button class="btn btn-outline btn-sm" data-kb="fav" data-arg="' + esc(a.id) + '">★ 已收藏</button>'
      : '<button class="btn btn-ghost btn-sm" data-kb="fav" data-arg="' + esc(a.id) + '">☆ 收藏</button>');
    if (a.status === '启用') {
      reader.push('<button class="btn btn-primary btn-sm" data-kb="pick" data-arg="' + esc(a.id) + '">' + esc(p.mainCta) + '</button>');
    }
    /* 编辑归类只给本机构：别人的转载件管理员能上下架，但不该改它的归类 */
    var canEdit = a.lib === '院内' && (!isRp(a) || a.org === (D.me || {}).org);
    if (canEdit) admin.push('<button class="btn btn-ghost btn-sm" data-kb="edit" data-arg="' + esc(a.id) + '">' + (isRp(a) ? '编辑归类' : '编辑') + '</button>');
    /* 上下架：转载件按 canShelf 判权限（省管理员可管全省），原创件只给本机构 */
    var canToggle = !(D.ext && D.ext.canShelf) || D.ext.canShelf(a);
    if (canToggle) {
      admin.push(a.status === '启用'
        ? '<button class="btn btn-ghost btn-sm" data-kb="toggleStatus" data-arg="' + esc(a.id) + '" title="下架后不再出现在库内取用列表">下架</button>'
        : '<button class="btn btn-ghost btn-sm" data-kb="toggleStatus" data-arg="' + esc(a.id) + '" title="上架后出现在库内取用列表">上架</button>');
    }
    return '<div class="kbx-actbar" id="kbx-actbar">' +
      '<div class="kbx-actbar-grp kbx-actbar-grp--reader">' + reader.join('') + '</div>' +
      '<div class="kbx-actbar-grp kbx-actbar-grp--share" id="kbx-actbar-share"></div>' +
      '<div class="kbx-actbar-grp kbx-actbar-grp--admin">' + admin.join('') + '</div>' +
      '</div>';
  }
  function mainFor(a, p) {
    var html;
    switch (p.mode) {
      case 'video': html = videoMain(a, p); break;
      case 'slides': html = slidesMain(a); break;
      case 'manual': html = manualMain(a); break;
      case 'flyer': html = flyerMain(a); break;
      case 'gallery': html = galleryMain(a); break;
      default: html = articleMain(a);
    }
    /* 视频页的动作行已经在播放器下方输出（贴窗口，最顺手）。
       其它形式内容更短，动作行统一贴在末尾。 */
    if (p.mode === 'video') return html;
    return html + actionBar(a, p);
  }

  /* ---- 主栏：图集（图文形式）----
     小红书式轮播：一张大图 + 左右翻页 + 底部圆点 + 图下说明，点图看原图。
     为什么不再用九图网格：网格要求读者自己按顺序找「第几张」，而图文的图片是有顺序的教学步骤；
     轮播一次只给一张、配一句说明，正好对上「扫一张、做一步」的读法，也不用一屏塞九张缩略图。
     正文（引言）放在轮播下方：它是这组图的说明，不是主体。 */
  function galleryMain(a) {
    var gs = a.gallery || [];
    var body = stripHtml(String(a.body || ''));
    if (!gs.length) {
      return '<div class="kbx-main"><article class="kbx-article kbx-article--gal" id="kbx-article">' +
        rpTpl(a, 'note') +
        (body ? '<div class="kbx-gl-intro kbx-prose">' + String(a.body || '') + '</div>' : '') +
        '<div class="kbx-prose-empty"><b>这条图文还没有配图</b><p>图集以图为主体，目前只有文字说明。请稍后再看，或在「编辑」里补充图片。</p></div>' +
        metaStrip(a) +
        '</article>' + rpTpl(a, 'decl') + '</div>';
    }
    var slides = gs.map(function (g, i) {
      return '<figure class="kbx-car-slide' + (i === 0 ? ' on' : '') + '" data-car-slide="' + i + '">' +
        '<a class="kbx-car-img" href="' + esc(g.src) + '" target="_blank" rel="noopener" title="查看原图">' +
        '<img src="' + esc(g.src) + '" alt="' + esc(g.caption || ('图 ' + (i + 1))) + '"' + (i === 0 ? '' : ' loading="lazy"') + '>' +
        '</a>' +
        (g.caption ? '<figcaption>' + esc(g.caption) + '</figcaption>' : '') +
        '</figure>';
    }).join('');
    var dots = gs.length > 1 ? '<div class="kbx-car-dots">' + gs.map(function (g, i) {
      return '<button type="button" class="kbx-car-dot' + (i === 0 ? ' on' : '') + '" data-car-go="' + i + '" aria-label="第 ' + (i + 1) + ' 张"></button>';
    }).join('') + '</div>' : '';
    var nav = gs.length > 1
      ? '<button type="button" class="kbx-car-btn kbx-car-btn--prev" data-car-step="-1" aria-label="上一张" disabled>‹</button>' +
        '<button type="button" class="kbx-car-btn kbx-car-btn--next" data-car-step="1" aria-label="下一张">›</button>' +
        '<span class="kbx-car-count"><b data-car-cur>1</b> / ' + gs.length + '</span>'
      : '';
    return '<div class="kbx-main"><article class="kbx-article kbx-article--gal" id="kbx-article">' +
      rpTpl(a, 'note') +
      '<section class="kbx-block" id="kbx-gallery"><div class="kbx-car" tabindex="0" data-car-count="' + gs.length + '">' +
      '<div class="kbx-car-stage">' + slides + nav + '</div>' +
      dots +
      '</div></section>' +
      (body ? '<div class="kbx-gl-intro kbx-prose">' + String(a.body || '') + '</div>' : '') +
      metaStrip(a) +
      '</article>' + rpTpl(a, 'decl') + '</div>';
  }
  /* 轮播状态与切换：每张整块显示 / 隐藏，不用横向滚动容器——
     滚动容器在触屏和键盘下都难把控；按钮、圆点、左右方向键三条入口更稳。
     首尾不循环：到第一张禁用「上一张」，到末张禁用「下一张」，读图顺序不能绕回去。 */
  D.carGo = function (root, i) {
    if (!root) return;
    var slides = root.querySelectorAll('[data-car-slide]');
    var n = slides.length;
    if (!n) return;
    i = Math.max(0, Math.min(n - 1, i));
    for (var k = 0; k < n; k++) slides[k].classList.toggle('on', k === i);
    root.querySelectorAll('[data-car-dot]').forEach(function (d, k) { d.classList.toggle('on', k === i); });
    var cur = root.querySelector('[data-car-cur]');
    if (cur) cur.textContent = i + 1;
    var prev = root.querySelector('[data-car-step="-1"]'), next = root.querySelector('[data-car-step="1"]');
    if (prev) prev.disabled = i <= 0;
    if (next) next.disabled = i >= n - 1;
    root.setAttribute('data-car-idx', i);
  };
  function bindCarousel(root) {
    if (!root || root.getAttribute('data-car-bound')) return;
    root.setAttribute('data-car-bound', '1');
    root.setAttribute('data-car-idx', '0');
    root.addEventListener('click', function (ev) {
      var step = ev.target.closest('[data-car-step]');
      if (step) {
        ev.preventDefault();
        D.carGo(root, parseInt(root.getAttribute('data-car-idx') || '0', 10) + parseInt(step.getAttribute('data-car-step'), 10));
        return;
      }
      var dot = ev.target.closest('[data-car-go]');
      if (dot) { ev.preventDefault(); D.carGo(root, parseInt(dot.getAttribute('data-car-go'), 10)); }
    });
    root.addEventListener('keydown', function (ev) {
      var i = parseInt(root.getAttribute('data-car-idx') || '0', 10);
      if (ev.key === 'ArrowLeft') { ev.preventDefault(); D.carGo(root, i - 1); }
      else if (ev.key === 'ArrowRight') { ev.preventDefault(); D.carGo(root, i + 1); }
    });
  }
  D.bindCarousel = bindCarousel;

  /* ---- 主栏：文章 ---- */
  /* 原文发布区（原创件）：署名块。发布单位在前、发布人在后、日期收尾——
      单位是对外口径，读者引用时写的是「据 XX 单位」，不是某个人的名字。
      转载件不走这里：它的发布人 / 发布单位在来源条里（kb-module 的 reprintSourceBar）。 */
  function bylineBlock(a) {
    /* 只有真正发布过（有发布日期）的内容才署名：草稿/下架未发布的挂一行日期是没有的 */
    if (isRp(a) || !a.publishedAt || !(a.publisher || a.publisherOrg)) return '';
    return '<div class="kbx-byline" data-kbx-mount="byline">' +
      '<span class="kbx-byline-k">发布</span>' +
      (a.publisherOrg ? '<b>' + esc(a.publisherOrg) + '</b>' : '') +
      (a.publisher ? '<span>' + esc(a.publisher) + '</span>' : '') +
      (a.publishedAt ? '<span class="kbx-byline-d">' + esc(a.publishedAt) + '</span>' : '') +
      '</div>';
  }
  function articleMain(a) {
    /* 单栏阅读：标题区已经给过形式与病种，正文顶部不再重复一遍眉标。
       转载件正文是选填的：没贴正文时不渲染空 prose，改给一块「去哪看全文」的空态——
       否则页面上会出现一大片空白，读者以为加载失败。 */
    var hasBody = !!stripHtml(String(a.body || ''));
    var emptyBody = !hasBody && isRp(a)
      ? '<div class="kbx-prose-empty">' +
        '<b>本条只存了出处，正文未转载</b>' +
        '<p>转载件正文为选填。全文请点上方「查看原文 ↗」到官方页面阅读；如需在本站留档，可在「编辑归类」里补录正文，补录后会生成原文快照并按原文锁定。</p>' +
        ((a.source && a.source.url) ? '<a class="btn btn-outline btn-sm" href="' + esc(a.source.url) + '" target="_blank" rel="noopener">打开原文 ↗</a>' : '') +
        '</div>'
      : '';
    /* 信息条（受众 / 标签 / 上传人·上传机构 / 附件）放正文之后：
       读者先读内容，读完了才关心「这是谁放进来的、给谁看的」。
       以前文章版式没有这条横带，受众和上传人无处可看——只在视频 / 课件页有。 */
    return '<div class="kbx-main"><article class="kbx-article" id="kbx-article">' +
      '<div class="kbx-prose">' + rpTpl(a, 'note') + emptyBody + String(a.body || '') + '</div>' +
      /* 依据出处 / 来源出处条已按需求删除：来源信息统一看顶部来源条，正文里不再重复 */
      metaStrip(a) +
      bylineBlock(a) +
      '</article>' + rpTpl(a, 'decl') + '</div>';
  }

  /* ================= 暴露给内联 onclick ================= */
  D.scrollTo = scrollToSection;
  D.jumpSlide = function (n) { jumpSlide(n); };
  D.act = function (act, arg) {
    if (act === 'videoPlay') toggleVideo();
    else if (act === 'videoMute') videoMute();
    else if (act === 'videoMark') markProgress();
    else if (act === 'slidePrev') goSlide(-1);
    else if (act === 'slideNext') goSlide(1);
    else if (act === 'slideFull') toggleFull();
    else if (act === 'slideStart') { var st = $('kbx-deck'); if (st) st.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    else if (act === 'step') toggleStep(arg);
  };

  /* 就绪：通知 kb-module.js 把内容库登记过来（它加载时本文件还不存在） */
  if (typeof window.KBDetailReady === 'function') window.KBDetailReady();
  /* 调试口：页面里能直接看到 render 的中间产物（排查「标记挂在看不见的区块上」这类问题用） */
  D._debug = { hasRp: function () { return isRp; }, mountTest: function (a, where) { return rpTpl(a, where); } };
})();