(function () {
  'use strict';
  const M = window.ReportStudioModel;
  const KEY = 'jx.report-studio.editorial.v1';
  const ROUTES = ['rs-records', 'rs-workbench', 'rs-templates'];
  const names = { editing: '编写中', writing: '待编写', review: '审校中', approved: '审校通过',
    signed: '已定稿', published: '已出版', pending: '待确认', include: '收录', exclude: '不收录',
    confirmed: '已确认', draft: '待核对', outdated: '已过期', open: '待处理', resolved: '已回复' };
  let db, storageIssue = '';
  try {
    const raw = localStorage.getItem(KEY);
    db = raw ? JSON.parse(raw) : M.fixtures();
    if (db.schema !== 1 || !Array.isArray(db.reports) || !Array.isArray(db.templates)) throw Error('数据格式异常');
  } catch (error) {
    db = M.fixtures(); storageIssue = '本地存储读取失败，当前为演示书稿；原有数据未覆盖。';
  }
  const s = { route: 'rs-records', bookId: db.reports[0]?.id, chapterId: 'overall', view: 'book', side: 'review',
    query: '', status: 'all', year: '', dirty: false, quote: '', range: null, templateId: db.templates[0].id,
    templateDraft: null, templateChapterId: 'overall', templateTab: 'structure' };
  let toastTimeout, modalFocus;
  const current = () => db.reports.find(r => r.id === s.bookId);
  const currentChapter = () => current()?.chapters.find(c => c.id === s.chapterId) || current()?.chapters[0];
  const locked = r => r.status === 'signed' || r.status === 'published';
  const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const ico = name => `<i data-lucide="${name}" aria-hidden="true"></i>`;
  const fmt = value => Number(value).toLocaleString('zh-CN');
  const badge = (value, text) => `<span class="rs-status ${value}">${e(text || names[value] || value)}</span>`;
  function button(text, action, icon, arg, style = '', disabled = false) {
    return `<button type="button" class="rs-btn ${style}" data-rs="${action}"${arg == null ? '' : ` data-arg="${e(arg)}"`}${disabled ? ' disabled' : ''}>${icon ? ico(icon) : ''}${e(text)}</button>`;
  }
  function tool(text, action, icon, arg, disabled = false) {
    return `<button type="button" class="rs-btn ghost rs-icon" title="${e(text)}" aria-label="${e(text)}" data-rs="${action}"${arg == null ? '' : ` data-arg="${e(arg)}"`}${disabled ? ' disabled' : ''}>${ico(icon)}</button>`;
  }
  function icons() { if (window.lucide) window.lucide.createIcons(); }
  function notify(text, error = false) {
    let el = document.getElementById('rs-toast');
    if (!el) { el = document.createElement('div'); el.id = 'rs-toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.className = 'rs-toast' + (error ? ' error' : ''); el.textContent = text; el.hidden = false;
    clearTimeout(toastTimeout); toastTimeout = setTimeout(() => { el.hidden = true; }, 3200);
  }
  function commit(fn, message, redraw = true) {
    const before = M.clone(db);
    try {
      if (storageIssue) throw Error('本地记录不可读取，请先处理存储问题');
      fn(); localStorage.setItem(KEY, JSON.stringify(db));
      if (redraw) render();
      if (message) notify(message);
      return true;
    } catch (error) { db = before; notify(error.message, true); return false; }
  }
  function modal(title, body, footer, wide = false) {
    closeModal(); modalFocus = document.activeElement;
    const el = document.createElement('dialog'); el.id = 'rs-dialog'; el.className = 'rs-dialog';
    if (wide) el.style.width = '900px';
    el.setAttribute('aria-labelledby', 'rs-dialog-title');
    el.innerHTML = `<div class="rs-dialog-head"><h2 id="rs-dialog-title">${e(title)}</h2>${tool('关闭', 'close', 'x')}</div>
      <div class="rs-dialog-body">${body}</div><div class="rs-dialog-footer"><span class="rs-dialog-error" id="rs-error" role="alert"></span>${footer || button('关闭', 'close')}</div>`;
    el.addEventListener('cancel', ev => { ev.preventDefault(); closeModal(); });
    document.body.appendChild(el); el.showModal(); icons();
  }
  function closeModal() {
    const el = document.getElementById('rs-dialog'); if (el) { el.close(); el.remove(); }
    if (modalFocus?.isConnected) modalFocus.focus(); modalFocus = null;
  }
  function modalError(text) { const el = document.getElementById('rs-error'); if (el) el.textContent = text; }
  const value = id => document.getElementById(id)?.value.trim() || '';
  const field = (label, control, full = false) => `<label class="rs-field${full ? ' full' : ''}"><span>${e(label)}</span>${control}</label>`;
  const input = (id, content = '', type = 'text') => `<input id="${id}" value="${e(content)}" type="${type}">`;
  function select(id, opts, selected, disabled = false, attrs = '') {
    return `<select id="${id}"${disabled ? ' disabled' : ''} ${attrs}>${opts.map(o => {
      const [key, text] = Array.isArray(o) ? o : [o, o];
      return `<option value="${e(key)}"${String(key) === String(selected) ? ' selected' : ''}>${e(text)}</option>`;
    }).join('')}</select>`;
  }
  const callout = (text, warning = false) => `<div class="rs-callout${warning ? ' warning' : ''}">${ico(warning ? 'circle-alert' : 'info')}<span>${e(text)}</span></div>`;
  const empty = (title, text, actions = '') => `<div class="rs-empty">${ico('book-open')}<h3>${e(title)}</h3><p>${e(text)}</p>${actions}</div>`;
  function cleanHTML(html) {
    const doc = document.createElement('template'); doc.innerHTML = html;
    const allowed = new Set(['P', 'H3', 'STRONG', 'B', 'EM', 'I', 'UL', 'OL', 'LI', 'BR']);
    for (const el of [...doc.content.querySelectorAll('*')].reverse()) {
      if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'SVG', 'IMG'].includes(el.tagName)) { el.remove(); continue; }
      if (!allowed.has(el.tagName)) {
        if (el.tagName === 'DIV') { const p = document.createElement('p'); p.append(...el.childNodes); el.replaceWith(p); }
        else el.replaceWith(...el.childNodes);
      } else for (const attr of [...el.attributes]) el.removeAttribute(attr.name);
    }
    return doc.innerHTML;
  }
  function displayBody(body, r, plain = false) {
    const data = M.metrics(r);
    return cleanHTML(body).replace(/\{\{([^{}]+)\}\}/g, (match, key) => {
      const metric = M.METRICS[key], val = data?.[key];
      if (plain) return e(metric && val != null ? fmt(val) : `[${metric?.name || key}待确认]`);
      return `<span class="rs-ref${val == null ? ' missing' : ''}" contenteditable="false" data-ref="${e(key)}" title="${e(metric?.name || key)} · ${val == null ? '底稿未确认' : '来自已确认统计底稿'}">${e(val == null ? metric?.name || key : fmt(val))}</span>`;
    });
  }
  function serializeEditor() {
    const editor = document.getElementById('rs-content'), copy = editor.cloneNode(true);
    copy.querySelectorAll('[data-ref]').forEach(el => el.replaceWith(document.createTextNode('{{' + el.dataset.ref + '}}')));
    return cleanHTML(copy.innerHTML);
  }
  function safeSwitch(fn) {
    if (!s.dirty) { fn(); return; }
    s.pending = fn;
    modal('未保存的书稿编辑', '<p>当前内容尚未保存，是否放弃本次修改并切换？</p>',
      button('继续编辑', 'close') + button('放弃修改', 'discard', 'arrow-right'));
  }
  function pageHead(title, desc, actions = '') {
    return `<header class="rs-head"><div><small class="rs-heading-label">年报中心</small><h1>${e(title)}</h1><small>${e(desc)} ${badge('draft', '本地原型')}</small></div><div class="rs-actions">${actions}</div></header>`;
  }
  function records() {
    const filtered = db.reports.filter(r => (s.status === 'all' || r.status === s.status) &&
      (!s.year || s.year === r.dataYear) && (r.title + r.owner + r.id).includes(s.query));
    const statusOptions = [['all', '全部年报'], ['editing', '编写中'], ['review', '整稿审核'], ['signed', '已定稿'], ['published', '已出版']];
    return pageHead('年报记录', '书稿、版本与出版档案', button('新建年报', 'newReport', 'plus', null, 'primary')) +
      `<nav class="rs-tabs">${statusOptions.map(([key, text]) => `<button data-rs="statusFilter" data-arg="${key}" class="${s.status === key ? 'active' : ''}">${text}<small>${key === 'all' ? db.reports.length : db.reports.filter(r => r.status === key).length}</small></button>`).join('')}</nav>
      <div class="rs-list-body"><div class="rs-filter"><div class="rs-search">${ico('search')}<input id="rs-query" aria-label="检索年报名称或负责人" placeholder="检索年报名称、编号或负责人" value="${e(s.query)}"></div>
      ${select('rs-year', [['', '全部统计年度'], ...[...new Set(db.reports.map(r => r.dataYear))].sort().reverse()], s.year)}
      ${tool('重置筛选', 'resetFilter', 'rotate-ccw')}</div>
      ${filtered.length ? `<div class="rs-table-scroll"><table class="rs-data-table"><thead><tr><th>年报 / 版本</th><th>统计年度</th><th>编制负责人</th><th>章节审校</th><th>书稿状态</th><th>更新日期</th><th>操作</th></tr></thead><tbody>
      ${filtered.map(r => `<tr><td><strong>${e(r.title)}</strong><small>${e(r.publishYear)}版 · ${e(r.id)} · 修订 ${r.edition}</small></td>
      <td>${e(r.dataYear)}</td><td>${e(r.owner)}</td><td>${r.chapters.filter(c => c.state === 'approved').length} / ${r.chapters.length}<small>${r.chapters.reduce((n, c) => n + c.comments.filter(v => v.state === 'open').length, 0)} 条未结审校意见</small></td>
      <td>${badge(r.status)}</td><td>${e(r.updatedAt.slice(0, 10))}</td><td><div class="rs-actions">
      ${button(locked(r) ? '查看书稿' : '继续编制', 'openBook', 'arrow-up-right', r.id, 'ghost')}
      ${tool('复制修订版', 'copyReport', 'copy', r.id)}${tool('查看版本与留痕', 'reportHistory', 'history', r.id)}
      ${locked(r) ? tool('下载出版档案', 'downloadPackage', 'download', r.id) : ''}</div></td></tr>`).join('')}
      </tbody></table></div>` : empty('没有匹配的年报', '调整筛选条件，或建立新的年度书稿')}
      <div class="rs-table-footer"><span>共 ${filtered.length} 份年报</span><span>书稿资料保存在本机浏览器</span></div></div>`;
  }
  function docTable(t, label = '') {
    return `<section class="rs-doc-table"><h4>${e(label || '表' + t.number + '　' + t.title)}</h4><table><thead><tr><th>登记地区</th><th>人口</th><th>发病数</th><th>死亡数</th><th>粗发病率</th><th>粗死亡率</th></tr></thead><tbody>
      ${[...t.rows, { ...t.sum, name: '合计' }].map(r => `<tr><td>${e(r.name)}</td><td>${fmt(r.population)}</td><td>${fmt(r.cases)}</td><td>${fmt(r.deaths)}</td><td>${r.incidence.toFixed(2)}</td><td>${r.mortality.toFixed(2)}</td></tr>`).join('')}</tbody></table>
      <small>资料批次 ${e(t.snapshotId)} · 粗率单位：1/10万 ${t.state === 'outdated' ? '· 本表已过期' : ''}</small></section>`;
  }
  function outline(r, c) {
    const complete = r.chapters.filter(v => v.state === 'approved').length;
    return `<aside class="rs-outline"><div class="rs-pane-heading"><span>书稿目录</span>${tool('章节分工', 'setView', 'users', 'assignment')}</div>
      <div class="rs-outline-title">${e(r.publishYear)} 年报书稿</div><div class="rs-outline-meta">${r.chapters.length} 章 · ${complete} 章已审校</div>
      ${r.chapters.map((v, i) => `<button data-rs="chapter" data-arg="${v.id}" class="rs-outline-item${v.id === c.id ? ' active' : ''}">
      <span>${String(i + 1).padStart(2, '0')}</span><div><strong>${e(v.title)}</strong><small><span>${e(v.writer)} · ${names[v.state]}</span>${ico(v.state === 'approved' ? 'circle-check' : v.state === 'review' ? 'clock-3' : 'pencil-line')}</small></div></button>
      ${v.id === c.id ? `<div class="rs-outline-sections">${v.sections.map(sec => `<div>${e(sec)}</div>`).join('')}</div>` : ''}`).join('')}
      <div class="rs-outline-foot"><div class="rs-pane-heading" style="margin:0 5px"><span>章节审校通过</span><span>${complete}/${r.chapters.length}</span></div>
      <div class="rs-outline-progress"><span style="width:${complete / r.chapters.length * 100}%"></span></div>
      ${button('整稿检查', 'setView', 'clipboard-check', 'review', 'ghost')}</div></aside>`;
  }
  function rightPane(r, c) {
    const unresolved = c.comments.filter(n => n.state === 'open').length, table = M.currentTable(r), vals = M.metrics(r);
    return `<aside class="rs-review-pane"><div class="rs-tabs"><button data-rs="side" data-arg="review" class="${s.side === 'review' ? 'active' : ''}">审校意见 <small>${unresolved}</small></button>
      <button data-rs="side" data-arg="refs" class="${s.side === 'refs' ? 'active' : ''}">引用底稿</button></div>
      ${s.side === 'review' ? `<div class="rs-reviewer"><span class="rs-avatar">${e(c.reviewer.slice(0, 1))}</span><div>${e(c.reviewer)}<small>本章审校人员</small></div>${tool('调整人员', 'assignChapter', 'user-round-pen', c.id, locked(r))}</div>
      ${button('新增批注', 'addComment', 'message-square-plus', null, '', locked(r))}
      ${c.comments.length ? c.comments.map(n => `<section class="rs-comment"><div class="rs-comment-head"><span>${e(n.author)}</span>${badge(n.state)}</div>
      ${n.quote ? `<div class="rs-quote">${e(n.quote)}</div>` : ''}<p>${e(n.text)}</p>${n.reply ? `<div class="rs-comment-reply">回复：${e(n.reply)}</div>` :
      button('回复与修改说明', 'replyComment', 'reply', n.id, 'ghost', locked(r))}<small class="rs-comment-time">${e(n.at)} · r${n.revision}</small></section>`).join('') :
      '<div class="rs-empty-note">本章暂无审校意见</div>'}` :
      `<div class="rs-pane-heading">本章统计表 ${tool('插入统计表', 'insertTable', 'table-2', null, locked(r))}</div>
      ${c.tables.map(id => { const t = r.tables.find(v => v.id === id); return t ? `<div class="rs-material-ref"><h4>表${t.number} ${e(t.title)}</h4>${badge(t.state)}<small>　${e(t.at)}</small></div>` : ''; }).join('') ||
      '<div class="rs-empty-note">本章尚未引用统计表</div>'}<div class="rs-pane-heading" style="margin-top:20px">指标引用 ${table ? badge('confirmed') : badge('pending')}</div>
      <div class="rs-metric-grid">${Object.entries(M.METRICS).map(([key, m]) => `<button data-rs="insertMetric" data-arg="${key}" ${locked(r) || !table ? 'disabled' : ''}><span>${m.name}</span><strong>${vals ? fmt(vals[key]) : '—'}</strong></button>`).join('')}</div>
      ${button('打开统计底稿', 'setView', 'arrow-up-right', 'materials', 'ghost')}`}</aside>`;
  }
  function book(r) {
    const c = currentChapter(); s.chapterId = c.id; const ro = locked(r);
    return `<div class="rs-book">${outline(r, c)}<div class="rs-editor-shell"><div class="rs-editor-context"><span>书稿 / ${e(c.title)}　${badge(c.state)}</span>
      <span>撰写 ${e(c.writer)} · r${c.revision} ${tool('历史版本', 'chapterVersions', 'history', c.id)}</span></div>
      <div class="rs-editor-tools">${select('rs-text-style', [['p', '正文'], ['h3', '小节标题']], 'p', ro, 'aria-label="段落样式"')}
      <span class="rs-tool-sep"></span>${tool('加粗', 'format', 'bold', 'bold', ro)}${tool('斜体', 'format', 'italic', 'italic', ro)}
      ${tool('项目列表', 'format', 'list', 'insertUnorderedList', ro)}<span class="rs-tool-sep"></span>
      ${tool('撤销', 'format', 'undo-2', 'undo', ro)}${tool('重做', 'format', 'redo-2', 'redo', ro)}
      <span class="rs-tool-sep"></span>${button('指标', 'metricMenu', 'braces', null, 'ghost', ro)}${button('统计表', 'insertTable', 'table-2', null, 'ghost', ro)}
      <span style="flex:1"></span>${tool('书稿预览', 'previewBook', 'eye', r.id)}</div>
      <div class="rs-paper-scroll"><article class="rs-paper"><div class="rs-paper-kicker">江西省肿瘤登记年报　/　${e(r.publishYear)}版</div>
      <h2>${String(r.chapters.indexOf(c) + 1).padStart(2, '0')}　${e(c.title)}</h2><div class="rs-paper-rule"></div>
      <div class="rs-content" id="rs-content" contenteditable="${!ro}" role="textbox" aria-label="章节正文" aria-multiline="true" spellcheck="false">${displayBody(c.body, r)}</div>
      ${c.tables.map(id => r.tables.find(t => t.id === id)).filter(Boolean).map(t => `${docTable(t)}${ro ? '' : `<div class="rs-actions" style="margin-top:6px">${button('移除引用', 'removeTable', 'unlink', t.id, 'ghost')}</div>`}`).join('')}
      </article></div><footer class="rs-editor-footer"><span id="rs-save-state">${ro ? '定稿只读' : '已保存'} · <span id="rs-wordcount">${cleanHTML(c.body).replace(/<[^>]+>/g, '').length}</span> 字</span>
      <div class="rs-actions">${button('保存', 'saveChapter', 'save', null, '', ro)}
      ${c.state === 'review' ? button('本章审校通过', 'approveChapter', 'check', c.id, 'primary', ro) :
        c.state === 'approved' ? button('退回本章', 'returnChapter', 'undo-2', c.id, '', ro) :
        button('本章送审', 'submitChapter', 'send', c.id, 'primary', ro)}</div></footer></div>${rightPane(r, c)}</div>`;
  }
  function data(r) {
    const ro = locked(r), count = r.registers.filter(v => v.decision === 'include').length;
    return `<div class="rs-list-body"><div class="rs-section-heading"><div><h2>资料收录</h2><p>按登记地区核对资料、记录收录结论</p></div><div class="rs-actions">
      ${button('导入资料', 'importData', 'upload', null, '', ro)}${button('建立统计资料批次', 'freezeData', 'database', null, 'primary', ro)}</div></div>
      <div class="rs-source-summary"><span>统计年度：${e(r.dataYear)}</span><span>资料类型：地区汇总资料</span>
      <span>资料批次：${r.snapshot ? 'D' + r.snapshot.version + ' · ' + e(r.snapshot.at) : '未建立'}</span></div>
      <div class="rs-stats-strip"><div><span>候选登记地区</span><strong>${r.registers.length}</strong></div><div><span>拟收录</span><strong>${count}</strong></div>
      <div><span>待确认资料</span><strong>${r.registers.filter(v => !v.confirmed || v.decision === 'pending').length}</strong></div></div>
      <div class="rs-table-scroll"><table class="rs-data-table"><thead><tr><th>登记地区</th><th class="rs-number">人口</th><th class="rs-number">发病</th><th class="rs-number">死亡</th><th>MV%</th><th>DCO%</th><th>收录结论</th><th>核对 / 排除说明</th><th>资料确认</th></tr></thead><tbody>
      ${r.registers.map(v => `<tr><td>${e(v.name)}</td><td class="rs-number">${fmt(v.population)}</td><td class="rs-number">${fmt(v.cases)}</td><td class="rs-number">${fmt(v.deaths)}</td>
      <td>${v.mv == null ? '—' : v.mv.toFixed(1)}</td><td>${v.dco == null ? '—' : v.dco.toFixed(1)}</td>
      <td>${select('rs-decision-' + v.id, [['pending', '待确认'], ['include', '收录'], ['exclude', '不收录']], v.decision, ro, `data-rs-change="decision" data-arg="${v.id}" aria-label="${e(v.name)}收录结论"`)}</td>
      <td><input data-rs-change="registerNote" data-arg="${v.id}" value="${e(v.note)}" ${ro ? 'disabled' : ''} aria-label="${e(v.name)}核对说明"></td>
      <td><input type="checkbox" data-rs-change="registerConfirm" data-arg="${v.id}" ${v.confirmed ? 'checked' : ''} ${ro ? 'disabled' : ''} aria-label="${e(v.name)}资料确认"></td></tr>`).join('')}</tbody></table></div>
      ${callout('资料收录、方法编写和章节分工可以并行开展。更新收录资料后，需要重新生成统计底稿；已引用旧底稿的章节重新审校。')}
      <input id="rs-data-file" type="file" accept=".json" hidden>${button('下载导入样例', 'dataExample', 'file-down', null, 'ghost')}</div>`;
  }
  function materials(r) {
    return `<div class="rs-list-body"><div class="rs-section-heading"><div><h2>统计底稿</h2><p>统计表是正文数字与表图的共同来源</p></div>
      ${button('生成地区统计表', 'buildTable', 'table-2', null, 'primary', locked(r))}</div>
      ${r.tables.length ? `<div class="rs-table-scroll"><table class="rs-data-table"><thead><tr><th>表号 / 底稿名称</th><th>资料批次</th><th>状态</th><th>引用章节</th><th>操作</th></tr></thead><tbody>
      ${r.tables.map(t => `<tr><td><strong>表${t.number}　${e(t.title)}</strong><small>${e(t.at)}</small></td><td>${e(t.snapshotId)}</td><td>${badge(t.state)}</td>
      <td>${r.chapters.filter(c => c.tables.includes(t.id)).map(c => c.title).join('、') || '尚未引用'}</td><td><div class="rs-actions">
      ${tool('查看底稿', 'viewTable', 'eye', t.id)}${tool('下载 CSV', 'exportTable', 'download', t.id)}
      ${t.state === 'draft' ? button('核对确认', 'confirmTable', 'check', t.id, '', locked(r)) : ''}</div></td></tr>`).join('')}</tbody></table></div>` :
      empty('尚无统计底稿', '先在资料收录中建立统计资料批次，再生成统计表', button('打开资料收录', 'setView', 'database', 'data'))}
      ${M.currentTable(r) ? `<div class="rs-stats-strip">${Object.entries(M.METRICS).slice(0, 5).map(([key, m]) => `<div><span>${m.name}</span><strong>${fmt(M.metrics(r)[key])}</strong></div>`).join('')}</div>` : ''}
      ${callout('当前样例是地区汇总资料，可计算粗率。年龄组资料、标准人口权重及生存队列未接入，不生成标化率或生存率。', true)}</div>`;
  }
  function assignment(r) {
    return `<div class="rs-list-body"><div class="rs-section-heading"><div><h2>章节分工</h2><p>按章节安排撰写与审校人员</p></div>${badge('draft', '本地原型分工')}</div>
      <div class="rs-table-scroll"><table class="rs-data-table"><thead><tr><th>章节</th><th>撰写人员</th><th>审校人员</th><th>章节状态</th><th>版本</th><th>操作</th></tr></thead><tbody>
      ${r.chapters.map(c => `<tr><td><strong>${e(c.title)}</strong><small>${c.required ? '必需章节' : '选编章节'}</small></td><td>${e(c.writer)}</td><td>${e(c.reviewer)}</td><td>${badge(c.state)}</td>
      <td>r${c.revision}</td><td><div class="rs-actions">${button('调整分工', 'assignChapter', 'user-round-pen', c.id, 'ghost', locked(r))}${tool('打开章节', 'jumpChapter', 'arrow-up-right', c.id)}</div></td></tr>`).join('')}</tbody></table></div></div>`;
  }
  function review(r) {
    const issues = M.preflight(r), pending = r.rounds.at(-1)?.state === 'pending';
    return `<div class="rs-list-body"><div class="rs-section-heading"><div><h2>编制与整稿审校</h2><p>章节独立流转，整稿审核保留每轮书稿版本</p></div><div class="rs-actions">
      ${button('整稿送审', 'sendFinal', 'send', null, 'primary', locked(r) || pending || issues.length > 0)}${button('预览整本', 'previewBook', 'book-open', r.id)}</div></div>
      <div class="rs-flow-grid">${[['writing', '正在编写'], ['review', '章节审校'], ['approved', '审校通过']].map(([key, text]) => `<section class="rs-flow-col"><h3>${text}<span>${r.chapters.filter(c => c.state === key).length}</span></h3>
      ${r.chapters.filter(c => c.state === key).map(c => `<div class="rs-flow-row"><strong>${e(c.title)}</strong><small>${e(c.writer)} → ${e(c.reviewer)} · r${c.revision}</small>
      ${button('打开章节', 'jumpChapter', 'arrow-up-right', c.id, 'ghost')}</div>`).join('') || '<div class="rs-empty-note">暂无章节</div>'}</section>`).join('')}</div>
      <h3 style="font-size:14px;font-weight:550;margin-top:27px">整稿检查　${issues.length ? badge('pending', issues.length + ' 项待完成') : badge('approved', '满足送审条件')}</h3>
      <div class="rs-issues">${issues.map(v => `<button data-rs="jumpIssue" data-view="${v.view}" data-arg="${v.chapter || ''}">${ico('circle-alert')}${e(v.name)}${ico('arrow-right')}</button>`).join('')}</div>
      ${r.rounds.slice().reverse().map(round => `<section class="rs-round"><h3><span>第 ${round.round} 轮整稿审核</span>${badge(round.state, round.state === 'pending' ? '审核中' : round.state === 'approved' ? '已定稿' : '已退回')}</h3>
      <p>${e(round.reviewer)} · ${e(round.at)} · ${round.chapters.length} 章书稿</p>${round.conclusion ? callout(round.conclusion) : ''}
      ${round.state === 'pending' ? `<div class="rs-actions">${button('退回修订', 'finalDecision', 'undo-2', 'return', '', locked(r))}${button('批准定稿', 'finalDecision', 'badge-check', 'approve', 'primary', locked(r))}</div>` : ''}</section>`).join('')}
      </div>`;
  }
  function production(r) {
    const frozen = locked(r), pub = r.publication;
    return `<div class="rs-list-body"><div class="rs-section-heading"><div><h2>定稿出版</h2><p>定稿内容、出版登记与版本档案</p></div>${badge(r.status)}</div>
      <div class="rs-production"><div><div class="rs-production-check">${ico('lock-keyhole')}<div><strong>书稿定稿</strong><p>${pub ? '定稿于 ' + e(pub.signedAt) : '整稿审校通过后形成只读定稿'}</p></div>${button('整稿审校', 'setView', 'arrow-right', 'review', 'ghost')}</div>
      <div class="rs-production-check">${ico('file-text')}<div><strong>出版书稿</strong><p>HTML 书稿 · 含正文与引用表格</p></div>${button('下载书稿', 'exportBook', 'download', r.id, '', !frozen)}</div>
      <div class="rs-production-check">${ico('archive')}<div><strong>完整编制档案</strong><p>资料批次、书稿、模板、审校意见与历史版本</p></div>${button('下载档案', 'exportArchive', 'download', r.id, '', !frozen)}</div>
      <div class="rs-production-check">${ico('megaphone')}<div><strong>出版发布登记</strong><p>${r.status === 'published' ? e(pub.channel) + ' · ' + e(pub.date) : '登记发布渠道、日期与文号'}</p></div>${button('登记发布', 'publish', 'pencil-line', null, 'primary', r.status !== 'signed')}</div>
      ${r.status === 'published' ? callout('此版书稿、资料与过程记录已归档。需要更正时，从年报记录复制修订版。') : callout('当前是本机原型，登记发布不会向外部网站或国家平台提交数据。')}
      </div><div class="rs-book-cover"><small>${e(r.template.cover)}</small><div><div class="rs-cover-year">${e(r.publishYear)}</div><h2>${e(r.title)}</h2></div><small>统计年度 ${e(r.dataYear)}<br>编制负责人 ${e(r.owner)}</small></div></div></div>`;
  }
  function workspace() {
    const r = current(); if (!r) return empty('尚无书稿', '从年报记录新建一份年度书稿', button('新建年报', 'newReport', 'plus'));
    const tabs = [['book', '书稿', 'book-open'], ['data', '资料收录', 'database'], ['materials', '统计底稿', 'table-2'],
      ['assignment', '章节分工', 'users'], ['review', '编制审校', 'clipboard-check'], ['production', '定稿出版', 'archive']];
    return `<header class="rs-head"><div><small class="rs-heading-label">编制工作台　/　${e(r.publishYear)}版</small><h1>${e(r.title)}</h1>
      <small>统计年度 ${e(r.dataYear)}<span>负责人 ${e(r.owner)}</span><span>计划完成 ${e(r.due || '未设置')}</span>${badge(r.status)}${badge('draft', '本地原型')}</small></div>
      <div class="rs-actions">${tool('切换年报', 'chooseReport', 'folder-open')}${tool('书稿设置', 'bookSettings', 'settings-2', null, locked(r))}
      ${button('预览整本', 'previewBook', 'eye', r.id)}${button('整稿检查', 'setView', 'clipboard-check', 'review', 'primary')}</div></header>
      ${locked(r) ? '<div class="rs-alert-strip">此版书稿已定稿，内容只读。修订需复制建立新版本。</div>' : ''}
      <nav class="rs-tabs" aria-label="年报工作视图">${tabs.map(([key, text, icon]) => `<button data-rs="setView" data-arg="${key}" class="${s.view === key ? 'active' : ''}">${ico(icon)}${text}${key === 'book' ? `<small>${r.chapters.length}</small>` : ''}</button>`).join('')}</nav>
      ${{ book, data, materials, assignment, review, production }[s.view](r)}`;
  }
  function templates() {
    const saved = db.templates.find(t => t.id === s.templateId) || db.templates[0];
    s.templateId = saved.id;
    const t = s.templateDraft || saved, ro = t.state === 'published';
    const c = t.chapters.find(v => v.id === s.templateChapterId) || t.chapters[0];
    if (c) s.templateChapterId = c.id;
    return pageHead('模板配置', '书稿结构、小节与排版规则', button('新建模板', 'newTemplate', 'plus', null, 'primary')) +
      `<div class="rs-template-layout"><aside class="rs-template-list">${db.templates.map(v => `<button data-rs="selectTemplate" data-arg="${v.id}" class="rs-template-item${saved.id === v.id ? ' active' : ''}">
      ${badge(v.state === 'published' ? 'confirmed' : 'draft', v.state === 'published' ? '已发布' : '草稿')}<strong>${e(v.name)}</strong>
      <span style="font-size:11px">v${v.version} · ${v.chapters.length}章</span><small>${e(v.description)}</small></button>`).join('')}</aside>
      <div class="rs-template-main"><div class="rs-section-heading"><div><h2>${e(t.name)}</h2><p>v${t.version} · ${ro ? '发布版本只读' : '编辑草稿'} · ${db.reports.filter(r => r.template.id === t.id).length}份年报已绑定</p></div>
      <div class="rs-actions">${ro ? button('修订模板', 'reviseTemplate', 'git-branch') + button(t.enabled ? '停用' : '启用', 'toggleTemplate', 'power') :
        button('保存草稿', 'saveTemplate', 'save') + button('发布模板', 'publishTemplate', 'send', null, 'primary')}</div></div>
      <div class="rs-form-grid" style="margin-bottom:19px">${field('模板名称', `<input data-tpl="name" value="${e(t.name)}"${ro ? ' disabled' : ''}>`)}
      ${field('适用范围', `<input data-tpl="description" value="${e(t.description)}"${ro ? ' disabled' : ''}>`)}</div>
      <div class="rs-tabs" style="padding:0;margin-bottom:20px"><button data-rs="templateTab" data-arg="structure" class="${s.templateTab === 'structure' ? 'active' : ''}">章节与小节</button>
      <button data-rs="templateTab" data-arg="layout" class="${s.templateTab === 'layout' ? 'active' : ''}">出版样式</button></div>
      ${s.templateTab === 'layout' ? `<div class="rs-layout-options">${field('纸张规格', select('rs-pageSize', ['A4', 'A5'], t.pageSize, ro, 'data-tpl="pageSize"'))}
      ${field('正文字号', `<input type="number" min="12" max="20" data-tpl="fontSize" value="${t.fontSize}"${ro ? ' disabled' : ''}>`)}
      ${field('页脚内容', `<input data-tpl="footer" value="${e(t.footer)}"${ro ? ' disabled' : ''}>`)}</div>` :
      `<div class="rs-template-editor"><nav class="rs-template-tree" aria-label="模板章节">${t.chapters.map(v => `<button data-rs="templateChapter" data-arg="${v.id}" class="${c?.id === v.id ? 'active' : ''}">${ico('file-text')}${e(v.title)}</button>`).join('')}
      ${button('添加章节', 'addChapter', 'plus', null, 'ghost', ro)}</nav><div class="rs-template-body">${c ? `<div class="rs-form-grid">${field('章节名称', `<input data-tpl="chapterTitle" value="${e(c.title)}"${ro ? ' disabled' : ''}>`)}
      <label class="rs-field"><span>编制要求</span><label style="font-size:12px"><input type="checkbox" data-tpl="required" ${c.required ? 'checked' : ''}${ro ? ' disabled' : ''}> 必需章节</label></label></div>
      <div class="rs-actions" style="margin-top:14px">${tool('上移章节', 'moveChapter', 'arrow-up', -1, ro || t.chapters.indexOf(c) === 0)}
      ${tool('下移章节', 'moveChapter', 'arrow-down', 1, ro || t.chapters.indexOf(c) === t.chapters.length - 1)}
      ${tool('删除章节', 'deleteChapter', 'trash-2', c.id, ro)}</div><div class="rs-pane-heading" style="margin:20px 0 9px">小节结构</div>
      ${c.sections.map((sec, i) => `<div class="rs-template-section"><span>${i + 1}</span><input data-section="${i}" value="${e(sec)}"${ro ? ' disabled' : ''} aria-label="小节名称">${tool('删除小节', 'deleteSection', 'x', i, ro)}</div>`).join('')}
      ${button('添加小节', 'addSection', 'plus', null, 'ghost', ro)}
      <div class="rs-pane-heading" style="margin:22px 0 0">初稿内容 / 指标占位</div><textarea data-tpl="body" aria-label="模板章节初稿"${ro ? ' disabled' : ''}>${e(c.body)}</textarea>
      <div class="rs-actions" style="margin-top:8px">${Object.entries(M.METRICS).map(([key, m]) => button(m.name, 'templateToken', 'braces', key, 'ghost', ro)).join('')}</div>` :
        empty('暂无章节', '添加章节和小节结构')}</div></div>`}
      ${callout('模板发布后以版本绑定年报。修订模板不改写已有书稿，原版内容与规则保留。')}</div></div>`;
  }
  function render() {
    const host = document.getElementById('pageContainer'); if (!host) return;
    host.innerHTML = `<section class="rs" id="rs-root">${storageIssue ? `<div class="rs-alert-strip">${e(storageIssue)}</div>` : ''}
      ${{ 'rs-records': records, 'rs-workbench': workspace, 'rs-templates': templates }[s.route]()}</section>`;
    s.range = null; s.quote = ''; icons();
  }
  function requireSaved() {
    if (s.dirty) { notify('请先保存当前书稿编辑', true); return false; }
    return true;
  }
  function saveBody(redraw = true) {
    const r = current(), c = currentChapter(), body = serializeEditor();
    return commit(() => { M.saveChapter(r, c.id, body); s.dirty = false; }, '书稿已保存', redraw);
  }
  function editDialog(title, body, action, label = '保存') {
    modal(title, `<div class="rs-form-grid">${body}</div>`,
      button('取消', 'close') + button(label, action, 'check', null, 'primary'));
  }
  function newBookForm() {
    const tpl = db.templates.filter(t => t.state === 'published' && t.enabled);
    editDialog('建立年度书稿',
      field('年报名称 *', input('rs-new-title', '江西省肿瘤登记年报'), true) +
      field('统计年度 *', input('rs-new-dataYear', '2023', 'number')) +
      field('出版年度 *', input('rs-new-publishYear', '2026', 'number')) +
      field('编制负责人 *', input('rs-new-owner', '')) +
      field('计划完成日期', input('rs-new-due', '', 'date')) +
      field('书稿模板 *', select('rs-new-template', tpl.map(t => [t.id, t.name + ' v' + t.version]), tpl[0]?.id), true),
      'createReport', '建立书稿');
  }
  function chooseBook(r) {
    s.bookId = r.id; s.chapterId = r.chapters.find(c => c.state !== 'approved')?.id || r.chapters[0]?.id;
    s.view = 'book'; s.side = 'review'; s.dirty = false;
    navigateTo('rs-workbench');
  }
  function trackSelection() {
    const selection = window.getSelection(), editor = document.getElementById('rs-content');
    if (!editor || !selection.rangeCount || !editor.contains(selection.anchorNode) || !editor.contains(selection.focusNode)) return;
    s.range = selection.getRangeAt(0).cloneRange(); s.quote = selection.toString().slice(0, 400);
  }
  function insertMetric(key) {
    const editor = document.getElementById('rs-content'), r = current(), data = M.metrics(r);
    if (!editor || locked(r) || !data || !M.METRICS[key]) return;
    const selection = window.getSelection();
    const range = s.range && editor.contains(s.range.commonAncestorContainer) ? s.range.cloneRange() : document.createRange();
    if (!s.range || !editor.contains(range.commonAncestorContainer)) { range.selectNodeContents(editor); range.collapse(false); }
    const span = document.createElement('span'); span.className = 'rs-ref'; span.contentEditable = 'false';
    span.dataset.ref = key; span.textContent = fmt(data[key]); span.title = M.METRICS[key].name + ' · 已确认统计底稿';
    range.deleteContents(); range.insertNode(span); range.setStartAfter(span); range.collapse(true);
    selection.removeAllRanges(); selection.addRange(range); s.range = range.cloneRange();
    editor.dispatchEvent(new Event('input', { bubbles: true })); editor.focus();
  }
  function documentMarkup(r) {
    const chapters = r.publication?.manuscript || r.chapters, tables = r.publication?.tables || r.tables;
    return `<article class="rs-document"><h1>${e(r.title)}</h1><p style="text-align:center">${e(r.publishYear)}版 · 统计年度 ${e(r.dataYear)} · 编制负责人 ${e(r.owner)}</p>
      <p style="text-align:center;color:#89918a;font-size:12px">本地原型样例，不是正式出版物</p>${chapters.map((c, i) =>
        `<h2>${i + 1}. ${e(c.title)}</h2>${displayBody(c.body, r, true)}${c.tables.map(id => tables.find(t => t.id === id)).filter(Boolean).map(t => docTable(t)).join('')}`).join('')}</article>`;
  }
  function download(filename, content, mime = 'application/json;charset=utf-8') {
    const url = URL.createObjectURL(new Blob([content], { type: mime })), a = document.createElement('a');
    a.href = url; a.download = filename.replace(/[<>:"/\\|?*]/g, '_'); document.body.appendChild(a);
    a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function downloadBook(r) {
    const style = `<style>@page{size:${r.template.pageSize || 'A4'};margin:20mm}body{max-width:860px;margin:40px auto;padding:25px;font:${r.template.fontSize || 15}px/1.9 "Microsoft YaHei",sans-serif;color:#2e3930}h1{text-align:center;font-size:26px}h2{font-size:21px;margin-top:35px}h3{font-size:16px;margin:20px 0 12px}p{margin:0 0 15px}.rs-doc-table{margin-top:22px}.rs-doc-table h4{text-align:center;font-size:13px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{padding:7px;border-bottom:1px solid #dbe3db}td:not(:first-child){text-align:right}small{font-size:11px;color:#829080}footer{margin-top:35px;border-top:1px solid #ddd;padding-top:15px;font-size:11px;color:#7c887e}@media print{body{margin:0;padding:0}h2{break-before:page}}</style>`;
    download(r.title + '_' + r.publishYear + '版.html', '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>' + e(r.title) +
      '</title>' + style + documentMarkup(r) + `<footer>${e(r.template.footer)}</footer></html>`, 'text/html;charset=utf-8');
  }
  function csv(rows) {
    return '\ufeff' + rows.map(row => row.map(v => {
      let text = String(v ?? ''); if (/^[=+\-@]/.test(text)) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    }).join(',')).join('\r\n');
  }
  function exportTable(t) {
    download(t.title + '.csv', csv([['地区', '覆盖人口', '发病数', '死亡数', '粗发病率/10万', '粗死亡率/10万'],
      ...[...t.rows, { ...t.sum, name: '合计' }].map(v => [v.name, v.population, v.cases, v.deaths, v.incidence, v.mortality])]), 'text/csv;charset=utf-8');
  }
  function draftTemplate() {
    if (!s.templateDraft) s.templateDraft = M.clone(db.templates.find(v => v.id === s.templateId));
    return s.templateDraft;
  }
  function saveTemplate(publish) {
    const t = M.clone(s.templateDraft || db.templates.find(v => v.id === s.templateId));
    if (t.state === 'published') { notify('发布版本不能直接修改', true); return; }
    t.chapters.forEach(c => { c.body = cleanHTML(c.body); });
    const errors = M.validateTemplate(t); if (errors.length) { notify(errors.join('；'), true); return; }
    if (t.fontSize < 12 || t.fontSize > 20) { notify('正文字号须在12到20之间', true); return; }
    if (commit(() => {
      t.updatedAt = M.now(); if (publish) { t.state = 'published'; t.enabled = true; }
      db.templates[db.templates.findIndex(v => v.id === t.id)] = t;
    }, null, false)) {
      s.templateDraft = null; s.dirty = false; render(); notify(publish ? '模板版本已发布' : '模板已保存');
    }
  }
  const actions = {
    close: closeModal,
    discard() { const next = s.pending; s.pending = null; s.dirty = false; s.templateDraft = null; closeModal(); if (next) next(); },
    statusFilter(key) { s.status = key; render(); },
    resetFilter() { s.status = 'all'; s.query = ''; s.year = ''; render(); },
    openBook(id) { safeSwitch(() => chooseBook(db.reports.find(r => r.id === id))); },
    chooseReport() {
      safeSwitch(() => modal('切换编制年报', db.reports.map(r =>
        `<div class="rs-production-check"><div><strong>${e(r.title)}</strong><p>${e(r.publishYear)}版 · ${names[r.status]}</p></div>${button('打开书稿', 'modalChooseBook', 'arrow-up-right', r.id)}</div>`).join('')));
    },
    modalChooseBook(id) { closeModal(); chooseBook(db.reports.find(r => r.id === id)); },
    setView(view) { safeSwitch(() => { s.view = view; render(); }); },
    chapter(id) { safeSwitch(() => { s.chapterId = id; render(); }); },
    jumpChapter(id) { safeSwitch(() => { s.chapterId = id; s.view = 'book'; s.side = 'review'; render(); }); },
    jumpIssue(id, el) { s.view = el.dataset.view; if (id) s.chapterId = id; render(); },
    side(view) {
      s.side = view;
      const pane = document.querySelector('.rs-review-pane'); pane.outerHTML = rightPane(current(), currentChapter()); icons();
    },
    newReport() { safeSwitch(newBookForm); },
    createReport() {
      try {
        const tp = db.templates.find(t => t.id === value('rs-new-template'));
        const report = M.createReport({ title: value('rs-new-title'), dataYear: value('rs-new-dataYear'),
          publishYear: value('rs-new-publishYear'), owner: value('rs-new-owner'), due: value('rs-new-due') }, tp);
        if (commit(() => db.reports.unshift(report), null, false)) { closeModal(); chooseBook(report); notify('年度书稿已建立'); }
      } catch (error) { modalError(error.message); }
    },
    copyReport(id) {
      safeSwitch(() => {
        s.copyId = id;
        modal('建立书稿修订版', '<p>原版正文、资料和审校记录保留，新修订书稿重新编写审校。</p>',
          button('取消', 'close') + button('建立修订版', 'confirmCopy', 'copy', null, 'primary'));
      });
    },
    confirmCopy() {
      const revision = M.revisionOf(db.reports.find(r => r.id === s.copyId));
      if (commit(() => db.reports.unshift(revision), null, false)) { closeModal(); chooseBook(revision); notify('新修订书稿已建立'); }
    },
    saveChapter() { saveBody(); },
    format(command) {
      const editor = document.getElementById('rs-content'); if (!editor || locked(current())) return;
      editor.focus();
      if (s.range && editor.contains(s.range.commonAncestorContainer)) {
        const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(s.range);
      }
      document.execCommand(command, false); editor.dispatchEvent(new Event('input', { bubbles: true })); trackSelection();
    },
    metricMenu() {
      actions.side('refs'); notify(M.currentTable(current()) ? '选择右侧底稿指标插入当前正文' : '请先确认统计底稿', !M.currentTable(current()));
    },
    insertMetric,
    insertTable() {
      if (!requireSaved()) return;
      const available = current().tables.filter(t => t.state === 'confirmed' && t.snapshotId === current().snapshot?.id);
      modal('引用统计表', available.length ? available.map(t =>
        `<div class="rs-production-check"><div><strong>表${t.number} ${e(t.title)}</strong><p>${t.rows.length}个地区 · 已确认</p></div>${button('插入本章', 'linkTable', 'plus', t.id)}</div>`).join('') :
        empty('没有可引用的统计表', '在统计底稿中生成并确认统计表', button('打开统计底稿', 'modalMaterials', 'table-2')));
    },
    modalMaterials() { closeModal(); s.view = 'materials'; render(); },
    linkTable(id) {
      if (commit(() => {
        const r = current(), c = currentChapter(); M.assertEditing(r);
        if (!r.tables.some(t => t.id === id && t.state === 'confirmed' && t.snapshotId === r.snapshot?.id)) throw Error('此统计表不可引用');
        if (!c.tables.includes(id)) {
          c.versions.unshift({ revision: c.revision, body: c.body, tables: M.clone(c.tables), at: c.updatedAt, writer: c.writer });
          c.tables.push(id); c.revision++; c.state = 'writing'; c.updatedAt = M.now();
          M.activity(r, '插入统计表', c.title);
        }
      }, '统计表已插入章节')) closeModal();
    },
    removeTable(id) {
      if (!requireSaved()) return;
      commit(() => {
        const r = current(), c = currentChapter(); M.assertEditing(r);
        c.versions.unshift({ revision: c.revision, body: c.body, tables: M.clone(c.tables), at: c.updatedAt, writer: c.writer });
        c.tables = c.tables.filter(v => v !== id); c.revision++; c.state = 'writing'; c.updatedAt = M.now();
        M.activity(r, '移除统计表引用', c.title);
      }, '已移除本章引用，统计底稿仍保留');
    },
    submitChapter(id) {
      if (!requireSaved()) return;
      commit(() => M.chapterState(current(), id, 'submit'), '本章已送审，其他章节可继续编写');
    },
    approveChapter(id) {
      if (!requireSaved()) return;
      commit(() => M.chapterState(current(), id, 'approve'), '本章审校通过');
    },
    returnChapter(id) {
      commit(() => M.chapterState(current(), id, 'return'), '本章已重新开放编写');
    },
    addComment() {
      if (!requireSaved()) return;
      s.noteQuote = s.quote;
      editDialog('添加本章审校批注',
        field('关联正文', `<div class="rs-quote">${e(s.noteQuote || '整章意见')}</div>`, true) +
        field('审校人', select('rs-note-author', M.PEOPLE, currentChapter().reviewer)) +
        field('审校意见 *', '<textarea id="rs-note-text"></textarea>', true), 'saveComment', '保存批注');
    },
    saveComment() {
      if (!value('rs-note-text')) { modalError('请填写审校意见'); return; }
      if (commit(() => M.comment(current(), currentChapter().id, { text: value('rs-note-text'), quote: s.noteQuote,
        author: value('rs-note-author') }), '批注已记录在本章')) closeModal();
    },
    replyComment(id) {
      if (!requireSaved()) return;
      s.noteId = id; const note = currentChapter().comments.find(n => n.id === id);
      editDialog('回复审校意见', field('审校意见', `<p>${e(note.text)}</p>`, true) +
        field('修改 / 核实说明 *', '<textarea id="rs-note-reply"></textarea>', true), 'saveReply', '回复并完成处置');
    },
    saveReply() {
      if (!value('rs-note-reply')) { modalError('填写修改或核实说明'); return; }
      if (commit(() => M.resolveComment(current(), currentChapter().id, s.noteId, value('rs-note-reply')), '已保存回复')) closeModal();
    },
    assignChapter(id) {
      if (!requireSaved()) return;
      s.assignId = id; const c = current().chapters.find(v => v.id === id);
      editDialog('安排章节分工', field('章节', `<p>${e(c.title)}</p>`, true) +
        field('撰写人员', select('rs-writer', M.PEOPLE, c.writer)) +
        field('审校人员', select('rs-reviewer', M.PEOPLE, c.reviewer)), 'saveAssignment');
    },
    saveAssignment() {
      if (value('rs-writer') === value('rs-reviewer')) { modalError('撰写与审校人员不能为同一人'); return; }
      if (commit(() => {
        const r = current(); M.assertEditing(r); const c = r.chapters.find(v => v.id === s.assignId);
        c.writer = value('rs-writer'); c.reviewer = value('rs-reviewer');
        if (c.state === 'approved') c.state = 'review';
        M.activity(r, '调整章节分工', c.title + '：' + c.writer + ' → ' + c.reviewer);
      }, '章节分工已保存')) closeModal();
    },
    freezeData() {
      modal('建立统计资料批次', '<p>将当前已确认的收录地区资料形成只读统计批次。</p>' +
        callout('原统计底稿标记过期，引用相关底稿的章节重新审校。'),
        button('取消', 'close') + button('建立批次', 'confirmFreeze', 'database', null, 'primary'));
    },
    confirmFreeze() { if (commit(() => M.freezeData(current()), '统计资料批次已建立')) closeModal(); },
    buildTable() { commit(() => M.buildTable(current()), '已生成统计底稿，等待核对确认'); },
    confirmTable(id) { commit(() => M.confirmTable(current(), id), '统计底稿已确认，可供正文引用'); },
    viewTable(id) {
      const t = current().tables.find(v => v.id === id);
      modal('统计底稿', docTable(t), button('关闭', 'close') + button('下载 CSV', 'exportTable', 'download', id), true);
    },
    exportTable(id) { exportTable(current().tables.find(v => v.id === id)); },
    importData() { document.getElementById('rs-data-file').click(); },
    dataExample() {
      download('地区资料导入样例.json', JSON.stringify({ dataYear: current().dataYear,
        registers: [{ name: '示例登记地区', population: 1000000, cases: 1800, deaths: 1100, mv: 75, dco: 2 }] }, null, 2));
    },
    sendFinal() {
      editDialog('整本书稿送审', field('整稿审核人 / 审核组 *', input('rs-final-reviewer', '年报编委会'), true),
        'confirmSendFinal', '送审整本');
    },
    confirmSendFinal() {
      if (commit(() => M.sendForFinal(current(), value('rs-final-reviewer')), '整稿送审，已保存本轮书稿快照')) closeModal();
    },
    finalDecision(action) {
      s.finalApproved = action === 'approve';
      editDialog(s.finalApproved ? '整稿定稿' : '退回书稿修订',
        field('整稿审核结论 *', '<textarea id="rs-final-conclusion"></textarea>', true), 'saveFinalDecision',
        s.finalApproved ? '批准定稿' : '退回编写');
    },
    saveFinalDecision() {
      if (commit(() => M.finalDecision(current(), s.finalApproved, value('rs-final-conclusion')),
        s.finalApproved ? '书稿已定稿，内容只读' : '书稿已退回，章节和审核轮次保留')) closeModal();
    },
    previewBook(id) {
      if (!requireSaved()) return;
      const r = db.reports.find(v => v.id === id) || current();
      modal('整本书稿预览', documentMarkup(r), button('关闭', 'close') + button('下载书稿', 'exportBook', 'download', r.id), true);
    },
    exportBook(id) { downloadBook(db.reports.find(v => v.id === id) || current()); },
    exportArchive(id) {
      const r = db.reports.find(v => v.id === id) || current();
      download(r.title + '_编制档案.json', JSON.stringify({ schema: 1, prototype: true, exportedAt: M.now(), report: r }, null, 2));
    },
    downloadPackage(id) {
      const r = db.reports.find(v => v.id === id);
      modal('出版档案下载', `<div class="rs-production-check"><div><strong>书稿与附表</strong><p>HTML 文档</p></div>${button('下载', 'exportBook', 'download', r.id)}</div>
        <div class="rs-production-check"><div><strong>完整编制档案</strong><p>JSON · 数据、正文、审校与版本</p></div>${button('下载', 'exportArchive', 'download', r.id)}</div>`);
    },
    publish() {
      editDialog('登记出版发布', field('发布渠道 *', input('rs-publish-channel', '编制单位发布')) +
        field('发布日期 *', input('rs-publish-date', M.now().slice(0, 10), 'date')) +
        field('文号 / 链接（选填）', input('rs-publish-reference'), true), 'confirmPublish', '发布登记与归档');
    },
    confirmPublish() {
      if (commit(() => M.publish(current(), { channel: value('rs-publish-channel'), date: value('rs-publish-date'),
        reference: value('rs-publish-reference') }), '出版信息与编制档案已归档')) closeModal();
    },
    reportHistory(id) {
      const r = db.reports.find(v => v.id === id);
      modal('书稿版本与编制留痕', `<p style="margin-bottom:16px">${e(r.title)} · 修订 ${r.edition}</p>` +
        r.activity.map(a => `<div class="rs-history-row"><small>${e(a.at)}</small><strong>${e(a.action)}</strong><span>${e(a.detail)}</span></div>`).join(''),
        button('关闭', 'close'), true);
    },
    chapterVersions(id) {
      if (!requireSaved()) return;
      const c = current().chapters.find(v => v.id === id); s.versionChapterId = id;
      modal('章节历史版本', c.versions.length ? c.versions.map(v =>
        `<div class="rs-version-row"><strong>r${v.revision} · ${e(v.writer)}</strong><p>${e(v.at)}</p>${button('查看版本', 'viewVersion', 'eye', v.revision)}
        ${button('恢复为新修订', 'restoreVersion', 'rotate-ccw', v.revision, '', locked(current()))}</div>`).join('') :
        empty('暂无历史修订', '保存修改后，原章节内容保留为历史版本'), button('关闭', 'close'), true);
    },
    viewVersion(rev) {
      const c = current().chapters.find(v => v.id === s.versionChapterId), v = c.versions.find(v => v.revision === +rev);
      modal('章节历史 r' + rev, `<article class="rs-document"><h2>${e(c.title)}</h2>${displayBody(v.body, current(), true)}</article>`, button('关闭', 'close'), true);
    },
    restoreVersion(rev) {
      const c = current().chapters.find(v => v.id === s.versionChapterId), v = M.clone(c.versions.find(v => v.revision === +rev));
      if (commit(() => {
        M.saveChapter(current(), c.id, v.body);
        c.tables = v.tables || []; c.state = 'writing'; M.activity(current(), '恢复章节历史', c.title + '：r' + rev + ' → r' + c.revision);
        s.chapterId = c.id;
      }, '已恢复为新修订，需重新审校')) closeModal();
    },
    bookSettings() {
      if (!requireSaved()) return; const r = current();
      editDialog('书稿设置', field('书名', input('rs-setting-title', r.title), true) +
        field('负责人', input('rs-setting-owner', r.owner)) + field('计划完成日期', input('rs-setting-due', r.due, 'date')), 'saveSettings');
    },
    saveSettings() {
      if (!value('rs-setting-title') || !value('rs-setting-owner')) { modalError('书名和负责人不能为空'); return; }
      if (commit(() => {
        const r = current(); M.assertEditing(r);
        r.title = value('rs-setting-title'); r.owner = value('rs-setting-owner'); r.due = value('rs-setting-due');
        M.activity(r, '更新书稿设置', r.title);
      }, '书稿设置已保存')) closeModal();
    },
    selectTemplate(id) { safeSwitch(() => { s.templateId = id; s.templateDraft = null; s.templateChapterId = ''; render(); }); },
    templateChapter(id) { s.templateChapterId = id; render(); },
    templateTab(tab) { s.templateTab = tab; render(); },
    newTemplate() {
      safeSwitch(() => {
        const t = M.template(); t.id = M.id('TPL'); t.family = t.id; t.name = '新的年报模板'; t.state = 'draft'; t.enabled = false;
        t.chapters = t.chapters.slice(0, 1);
        if (commit(() => db.templates.unshift(t), null, false)) {
          s.templateId = t.id; s.templateDraft = M.clone(t); s.templateChapterId = t.chapters[0].id; s.dirty = false; render();
        }
      });
    },
    reviseTemplate() {
      const old = db.templates.find(t => t.id === s.templateId), t = M.clone(old);
      t.id = M.id('TPL'); t.previousId = old.id;
      t.version = Math.max(...db.templates.filter(v => v.family === t.family).map(v => v.version)) + 1;
      t.state = 'draft'; t.enabled = false;
      if (commit(() => db.templates.unshift(t), null, false)) {
        s.templateId = t.id; s.templateDraft = M.clone(t); s.dirty = false; render(); notify('模板修订草稿已建立，原版保留');
      }
    },
    toggleTemplate() { commit(() => { const t = db.templates.find(v => v.id === s.templateId); t.enabled = !t.enabled; }, '模板状态已更新'); },
    saveTemplate() { saveTemplate(false); },
    publishTemplate() { saveTemplate(true); },
    addChapter() {
      const t = draftTemplate(); if (t.state === 'published') return;
      const c = { ...M.clone(t.chapters[0] || M.template().chapters[0]), id: M.id('CH'), title: '新增章节', body: '', sections: ['小节'], tables: [] };
      t.chapters.push(c); s.templateChapterId = c.id; s.dirty = true; render();
    },
    moveChapter(delta) {
      const t = draftTemplate(); if (t.state === 'published') return;
      const index = t.chapters.findIndex(c => c.id === s.templateChapterId), target = index + +delta;
      if (target < 0 || target >= t.chapters.length) return;
      t.chapters.splice(target, 0, t.chapters.splice(index, 1)[0]); s.dirty = true; render();
    },
    deleteChapter(id) {
      s.removeChapterId = id;
      modal('删除模板章节', '<p>此操作仅删除当前模板草稿中的章节，不影响已绑定年报。</p>',
        button('取消', 'close') + button('删除章节', 'confirmDeleteChapter', 'trash-2', null, 'danger'));
    },
    confirmDeleteChapter() {
      const t = draftTemplate(); if (t.state === 'published') return;
      t.chapters = t.chapters.filter(c => c.id !== s.removeChapterId); s.templateChapterId = ''; s.dirty = true;
      closeModal(); render();
    },
    addSection() {
      const t = draftTemplate(); if (t.state === 'published') return;
      t.chapters.find(c => c.id === s.templateChapterId).sections.push('新增小节'); s.dirty = true; render();
    },
    deleteSection(index) {
      const t = draftTemplate(); if (t.state === 'published') return;
      t.chapters.find(c => c.id === s.templateChapterId).sections.splice(+index, 1); s.dirty = true; render();
    },
    templateToken(key) {
      const el = document.querySelector('textarea[data-tpl="body"]'); if (!el || el.disabled) return;
      el.setRangeText('{{' + key + '}}', el.selectionStart, el.selectionEnd, 'end');
      el.dispatchEvent(new Event('input', { bubbles: true })); el.focus();
    }
  };
  document.addEventListener('mousedown', ev => {
    const btn = ev.target.closest('[data-rs="format"],[data-rs="insertMetric"],[data-rs="metricMenu"]');
    if (btn && btn.closest('.rs')) ev.preventDefault();
  });
  document.addEventListener('click', ev => {
    const el = ev.target.closest('[data-rs]'); if (!el || el.disabled || !el.closest('.rs,.rs-dialog')) return;
    try { actions[el.dataset.rs]?.(el.dataset.arg, el); } catch (error) { notify(error.message, true); }
  });
  document.addEventListener('mouseup', trackSelection);
  document.addEventListener('keyup', trackSelection);
  document.addEventListener('input', ev => {
    const el = ev.target; if (!el.closest('.rs,.rs-dialog')) return;
    if (el.id === 'rs-query') {
      const position = el.selectionStart; s.query = el.value; render();
      const search = document.getElementById('rs-query'); search.focus(); search.setSelectionRange(position, position);
    }
    if (el.id === 'rs-content') {
      s.dirty = true;
      document.getElementById('rs-save-state').innerHTML = `未保存 · <span id="rs-wordcount">${el.textContent.length}</span> 字`;
    }
    if (el.dataset.tpl || el.dataset.section != null) {
      const t = draftTemplate(); if (t.state === 'published') return;
      const c = t.chapters.find(v => v.id === s.templateChapterId);
      const key = el.dataset.tpl;
      if (['name', 'description', 'pageSize', 'footer'].includes(key)) t[key] = el.value;
      if (key === 'fontSize') t.fontSize = +el.value;
      if (key === 'chapterTitle') c.title = el.value;
      if (key === 'body') c.body = el.value;
      if (key === 'required') c.required = el.checked;
      if (el.dataset.section != null) c.sections[+el.dataset.section] = el.value;
      s.dirty = true;
    }
  });
  document.addEventListener('change', async ev => {
    const el = ev.target; if (!el.closest('.rs,.rs-dialog')) return;
    if (el.id === 'rs-year') { s.year = el.value; render(); }
    if (el.id === 'rs-text-style') {
      document.getElementById('rs-content').focus();
      if (s.range) { const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(s.range); }
      document.execCommand('formatBlock', false, el.value);
      document.getElementById('rs-content').dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (el.dataset.rsChange) {
      commit(() => {
        const r = current(); M.assertEditing(r); const row = r.registers.find(v => v.id === el.dataset.arg);
        if (el.dataset.rsChange === 'decision') { row.decision = el.value; row.confirmed = false; }
        if (el.dataset.rsChange === 'registerNote') { row.note = el.value; row.confirmed = false; }
        if (el.dataset.rsChange === 'registerConfirm') row.confirmed = el.checked;
        if (r.snapshot) r.snapshot.stale = true;
        M.invalidateData(r); M.activity(r, '更新地区资料核对', row.name);
      });
    }
    if (el.id === 'rs-data-file' && el.files?.[0]) {
      const file = el.files[0];
      try {
        if (file.size > 2000000) throw Error('导入文件大小不能超过2MB');
        const data = JSON.parse(await file.text());
        if (String(data.dataYear) !== current().dataYear) throw Error('导入资料的统计年度与年报不一致');
        if (!Array.isArray(data.registers) || !data.registers.length || data.registers.length > 500) throw Error('资料须包含1到500条地区记录');
        const rows = data.registers.map(v => {
          if (typeof v.name !== 'string' || !v.name.trim() || !Number.isSafeInteger(v.population) || v.population <= 0 ||
            !Number.isSafeInteger(v.cases) || v.cases < 0 || !Number.isSafeInteger(v.deaths) || v.deaths < 0 ||
            (v.mv != null && (!Number.isFinite(v.mv) || v.mv < 0 || v.mv > 100)) ||
            (v.dco != null && (!Number.isFinite(v.dco) || v.dco < 0 || v.dco > 100))) throw Error('地区名称、人口、发病死亡数或质控比例格式无效');
          return { id: M.id('REG'), name: v.name.trim(), population: v.population, cases: v.cases, deaths: v.deaths,
            mv: v.mv ?? null, dco: v.dco ?? null, decision: 'pending', confirmed: false, note: '' };
        });
        if (new Set(rows.map(v => v.name)).size !== rows.length) throw Error('导入资料存在重复地区');
        s.importRows = rows; s.importBookId = current().id;
        modal('确认导入地区资料', `<p>${rows.length}个地区，统计年度 ${e(data.dataYear)}。</p>` +
          callout('导入替换当前待核对资料；原已冻结统计批次保留，底稿和相关章节标记待重核。'),
          button('取消', 'close') + button('确认导入', 'confirmImport', 'upload', null, 'primary'));
      } catch (error) { notify(error.message, true); }
      el.value = '';
    }
  });
  actions.confirmImport = function () {
    if (commit(() => {
      const r = current(); M.assertEditing(r);
      if (r.id !== s.importBookId) throw Error('当前书稿已切换，请重新导入');
      r.registers = M.clone(s.importRows); if (r.snapshot) r.snapshot.stale = true;
      M.invalidateData(r); M.activity(r, '导入地区资料', r.registers.length + '个地区，待核对');
    }, '资料已导入，请逐地区核对')) { s.importRows = null; closeModal(); }
  };
  window.addEventListener('beforeunload', ev => { if (s.dirty) { ev.preventDefault(); ev.returnValue = ''; } });
  const baseNavigate = window.navigateTo;
  window.navigateTo = function (id) {
    if (id === 'report-studio') id = 'rs-records';
    if (s.dirty && id !== s.route && document.getElementById('rs-root')) return safeSwitch(() => window.navigateTo(id));
    if (!ROUTES.includes(id)) { document.body.classList.remove('rs-active'); return baseNavigate.apply(this, arguments); }
    document.body.classList.add('rs-active'); s.route = id;
    if (location.hash !== '#' + id) window.history.pushState(null, '', '#' + id);
    setActiveMenu(id); updateBreadcrumb(id); render();
    document.getElementById('mainContent').scrollTop = 0;
  };
  window.addEventListener('popstate', () => {
    const id = location.hash.replace(/^#\/?/, '');
    if (ROUTES.includes(id)) window.navigateTo(id);
    else if (document.getElementById('rs-root') && id) window.navigateTo(id);
  });
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelector('.menu-item[data-id="report-studio"]')?.addEventListener('click', () => {
      if (!document.getElementById('rs-root')) navigateTo('rs-records');
    });
  });
})();
