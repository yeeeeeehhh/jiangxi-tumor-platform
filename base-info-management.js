/*
 * 基础信息管理模块 —— 发病人口信息管理 + 空间地址信息管理
 * 依据 docs/河南省肿瘤登记系统_基础信息管理模块需求文档.md (V1.0)
 *
 * 复用全局：regionData / renderRegionCascader / toast / showConfirm / navigateTo / currentUserRole
 * 页面路径（对应需求文档）：
 *   发病人口信息管理  /Program/BaseInfo/MsgBaseInfo   -> 菜单 id: baseinfo-pop
 *   空间地址信息管理  /Program/BaseInfo/MsgBaseGIS     -> 菜单 id: baseinfo-gis
 *
 * 说明：区域人口（区划/机构/人口 -> 区域人口）已在「人口基数管理 master-pop」中作为"区域人口"Tab实现，
 *       本文件仅实现需求文档中缺失的两个子模块，并补充权限隔离（§8）的演示视角切换。
 */
(function () {
  'use strict';

  const biStyles = document.createElement('style');
  biStyles.textContent =
    '.bi-filter-toolbar{display:grid;grid-template-columns:minmax(210px,1.1fr) 150px 130px 130px minmax(240px,1.5fr) auto;gap:12px 16px;align-items:end;padding:16px 18px;background:#fff;border-color:#dbe5ef;box-shadow:0 1px 2px rgba(15,23,42,.04)}' +
    '.bi-filter-toolbar .region-filter{min-width:0;max-width:none}.bi-filter-toolbar .form-group>label{font-weight:500;color:#536579;white-space:nowrap}' +
    '.bi-filter-check .bi-check-control{height:36px;display:flex;align-items:center;gap:8px;padding:0 11px;border:1px solid #d1d8e0;border-radius:4px;background:#f8fafc;color:#334155;cursor:pointer;box-sizing:border-box}' +
    '.bi-filter-check .bi-check-control:hover{border-color:var(--primary);background:var(--primary-soft)}' +
    '.bi-filter-check .bi-check-control input{width:16px!important;height:16px!important;margin:0;accent-color:var(--primary);flex:0 0 auto}' +
    '.bi-filter-toolbar .search-group{min-width:0;max-width:none}.bi-filter-toolbar .filter-actions{margin-left:0;align-self:end}' +
    '@media(max-width:1200px){.bi-filter-toolbar{grid-template-columns:minmax(210px,1fr) repeat(2,minmax(130px,auto)) minmax(180px,1fr)}.bi-filter-toolbar .search-group{grid-column:1/4}.bi-filter-toolbar .filter-actions{grid-column:4}}' +
    '@media(max-width:760px){.bi-filter-toolbar{grid-template-columns:1fr}.bi-filter-toolbar .search-group,.bi-filter-toolbar .filter-actions{grid-column:auto}}' +
    '#biBcOverlay .cd-dialog{width:min(720px,94vw);max-height:none}' +
    '#biBcOverlay .cd-body{padding:18px 20px 16px;overflow:visible}' +
    '#biBcOverlay .bi-bc-alert{margin:0 0 16px;padding:12px 14px;border:1px solid #f2cf73;border-left:4px solid #f4b400;border-radius:6px;background:#fff8e6;color:#594414;font-size:13px;line-height:1.7}' +
    '#biBcOverlay .bi-bc-alert p{margin:0}' +
    '#biBcOverlay .bi-bc-field>label{display:block;margin-bottom:8px;font-size:13px;font-weight:600;color:#334155}' +
    '#biBcOverlay .bi-bc-cascader{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}' +
    '#biBcOverlay .bi-bc-cascader select{width:100%;min-width:0;height:36px;padding:0 8px;border:1px solid #d1d8e0;border-radius:4px;background:#fff;color:#1f2937;font-size:13px;box-sizing:border-box}' +
    '#biBcOverlay .bi-bc-option{margin-top:14px}' +
    '#biBcOverlay .bi-bc-option-label{display:inline-flex;align-items:center;gap:8px;width:auto;max-width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;color:#334155;font-size:13px;cursor:pointer;user-select:none}' +
    '#biBcOverlay .bi-bc-option-label:hover{border-color:var(--primary);background:var(--primary-soft)}' +
    '#biBcOverlay .bi-bc-option-label input{width:16px;height:16px;margin:0;accent-color:var(--primary);flex:0 0 auto}' +
    '#biBcOverlay .bi-bc-footer{padding:12px 20px;border-top:1px solid #e2e8f0;display:flex;justify-content:flex-end;gap:8px;background:#fff}' +
    '@media(max-width:640px){#biBcOverlay .bi-bc-cascader{grid-template-columns:repeat(2,minmax(0,1fr))}}';
  document.head.appendChild(biStyles);

  /* ---------------- 工具 ---------------- */
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = id => document.getElementById(id);
  const pad = (n, w) => String(n).padStart(w, '0');

  /* ---------------- 编码字典（§2.5） ---------------- */
  const SEX = { '1': '男', '2': '女', '9': '不详' };
  const MARI = { '1': '未婚', '2': '已婚', '3': '同居', '4': '离婚', '5': '丧偶', '9': '不详' };
  const OCCU = {
    '1': '无业', '2': '离退休', '3': '农民', '4': '学生', '5': '现役军人', '6': '自由职业',
    '7': '个体经营', '8': '专业技术人员', '9': '职员', '10': '企业管理', '11': '工人', '12': '公务员',
    '13': '其它', '99': '不详'
  };
  const OTHER_ID = ['医保卡', '户口薄', '护照', '军官证', '驾驶证', '港澳通行证', '台湾通行证', '其它'];
  const RELATION = ['配偶', '子女', '父母', '兄弟姐妹', '其它'];
  const NATION_NAMES = ['汉族', '蒙古族', '回族', '藏族', '维吾尔族', '苗族', '彝族', '壮族', '布依族', '朝鲜族',
    '满族', '侗族', '瑶族', '白族', '土家族', '哈尼族', '哈萨克族', '傣族', '黎族', '傈僳族',
    '佤族', '畲族', '高山族', '拉祜族', '水族', '东乡族', '纳西族', '景颇族', '柯尔克孜族', '土族',
    '达斡尔族', '仫佬族', '羌族', '布朗族', '撒拉族', '毛南族', '仡佬族', '锡伯族', '阿昌族', '普米族',
    '塔吉克族', '怒族', '乌孜别克族', '俄罗斯族', '鄂温克族', '德昂族', '保安族', '裕固族', '京族', '塔塔尔族',
    '独龙族', '鄂伦春族', '赫哲族', '门巴族', '珞巴族', '基诺族'];
  // 民族编码 01~56 + 97/98/99
  const TRIB = {};
  NATION_NAMES.forEach((n, i) => { TRIB[pad(i + 1, 2)] = n; });
  TRIB['97'] = '其他'; TRIB['98'] = '外国血统'; TRIB['99'] = '不详';
  const TRIB_OPTIONS = Object.keys(TRIB).map(k => ({ v: k, t: k + ' ' + TRIB[k] }));

  /* 文档记载的系统存量（用于统计卡片展示，真实演示数据见下方生成样本） */
  const BI_TOTAL_POP = 3191068;
  const BI_TOTAL_GIS = 5837384;

  /* 河南省经纬度包围盒（用于 GIS 拾取） */
  const BI_LNG_MIN = 110.3, BI_LNG_MAX = 116.7, BI_LAT_MIN = 31.4, BI_LAT_MAX = 36.4;

  /* 区划样本（12 位 nAddCode + 路径），与 regionData 层级一致 */
  const BI_DISTRICTS = [
    { code: '410105000000', path: '河南省/郑州市/金水区/花园路街道/农业院社区' },
    { code: '410102000000', path: '河南省/郑州市/中原区/建设路街道' },
    { code: '410103000000', path: '河南省/郑州市/二七区/大学路街道' },
    { code: '410104000000', path: '河南省/郑州市/管城回族区/航海东路街道' },
    { code: '410300000000', path: '河南省/洛阳市/洛龙区/开元大道街道' },
    { code: '411002000000', path: '河南省/许昌市/魏都区/西关街道/建安社区' },
    { code: '411300000000', path: '河南省/南阳市/宛城区/东关街道/建东社区' },
    { code: '411000000000', path: '河南省/许昌市/建安区/将官池镇/新庄社区' },
    { code: '410900000000', path: '河南省/濮阳市/华龙区/中原路街道/瑞景社区' },
    { code: '411500000000', path: '河南省/信阳市/浉河区/老城街道/大桥社区' }
  ];

  /* ---------------- 演示数据生成 ---------------- */
  const SURNAMES = '王李张刘陈杨黄赵周吴徐孙马朱胡郭何高林罗郑梁谢宋唐许韩冯邓曹彭曾肖田董袁潘蒋蔡余杜叶程苏魏吕丁任沈姚卢姜崔钟谭陆汪范金石廖贾夏韦付方白邹孟熊秦邱江尹薛闫段雷侯龙史陶黎贺顾毛郝龚邵万钱严覃武戴莫孔向汤';
  const GIVEN = ['伟', '芳', '娜', '秀英', '敏', '静', '丽', '强', '磊', '军', '洋', '勇', '艳', '杰', '娟', '涛', '明', '超', '霞', '平', '刚', '桂英', '建国', '文', '辉', '力', '俊', '婷', '雪', '倩', '宇', '浩', '晨', '璐', '鑫', '琳', '欣', '蕊'];
  const STREETS = ['花园路', '建设路', '大学路', '航海东路', '开元大道', '西关大街', '东关大街', '中原路', '老城街', '将官池街', '农业路', '经三路', '文化路', '人民路'];
  const WORKUNITS = ['郑州市钢铁厂', '中牟县贸易公司', '郑州市第一人民医院', '河南省肿瘤医院', '洛阳市中心医院', '许昌市人民医院', '金水区卫健委', '二七区社区卫生服务中心', '中原区教育局', '濮阳市华龙区医院'];
  const rand = arr => arr[Math.floor(Math.random() * arr.length)];
  const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

  function genIdno(area6, birth) {
    const seq = pad(randInt(1, 999), 3);
    const body = area6 + birth.replace(/-/g, '') + seq;
    // 简单校验位（GB11643 加权，仅用于演示长度/格式）
    const w = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
    const codes = '10X98765432';
    let sum = 0;
    for (let i = 0; i < 17; i++) sum += parseInt(body[i], 10) * w[i];
    return body + codes[sum % 11];
  }
  function calcAge(birth) {
    if (!birth) return '-';
    const b = new Date(birth); const n = new Date();
    let a = n.getFullYear() - b.getFullYear();
    if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
    return a < 0 ? '-' : a;
  }

  const BI_POP_COUNT = 264;   // 演示样本量（22 页，每页 12）
  const BI_KEY_TYPES = [['0', '登记编号'], ['1', '姓名'], ['2', '身份证号'], ['3', '户籍地址']];

  function buildPopData() {
    const out = [];
    for (let i = 0; i < BI_POP_COUNT; i++) {
      const sex = String(randInt(1, 2));
      const by = randInt(1935, 2010), bm = randInt(1, 12), bd = randInt(1, 28);
      const birth = by + '-' + pad(bm, 2) + '-' + pad(bd, 2);
      const dist = rand(BI_DISTRICTS);
      const pathParts = dist.path.split('/');
      const hhouse = pathParts.slice(0, 4).join('/') + '/' + rand(STREETS) + randInt(1, 200) + '号';
      const conSame = Math.random() > 0.3;
      const cdist = conSame ? dist : rand(BI_DISTRICTS);
      const cpathParts = cdist.path.split('/');
      const con = conSame ? hhouse : cpathParts.slice(0, 4).join('/') + '/' + rand(STREETS) + randInt(1, 200) + '号';
      const area6 = dist.code.slice(0, 6);
      const idno = genIdno(area6, birth);
      const name = rand(SURNAMES.split('')) + rand(GIVEN);
      const tumor = Math.random() > 0.18;
      const dead = Math.random() > 0.78;
      const deathDate = dead ? (by + randInt(1, 15)) + '-' + pad(randInt(1, 12), 2) + '-' + pad(randInt(1, 28), 2) : '';
      out.push({
        CODE: '2641' + pad(100000000 + i, 9),
        Indno: idno,
        Name: name,
        Sex: sex,
        Birthda: birth,
        Age: calcAge(birth),
        Trib: pad(randInt(1, 56), 2),
        Occu: String(randInt(1, 13) === 13 ? 13 : randInt(1, 13)),
        Mari: String(randInt(1, 5) === 5 ? 9 : randInt(1, 5)),
        WorkCom: rand(WORKUNITS),
        Telephone: '1' + randInt(3, 9) + pad(randInt(0, 99999999), 8),
        ContactPerson: rand(SURNAMES.split('')) + rand(GIVEN),
        ContactPhone: '1' + randInt(3, 9) + pad(randInt(0, 99999999), 8),
        Relation: rand(RELATION),
        OtherName: rand(OTHER_ID),
        OtherNo: Math.random() > 0.5 ? pad(randInt(100000, 999999), 6) : '',
        AddCode1: dist.code,
        Address: hhouse,
        AddrPath: pathParts.slice(0, 4).join('/'),
        ConCode: cdist.code,
        Conservation: con,
        ConPath: cpathParts.slice(0, 4).join('/'),
        tumor: tumor,
        DeathDate: deathDate
      });
    }
    return out;
  }
  function buildGisData(pop) {
    return pop.map(p => {
      const has = Math.random() > 0.12;
      const lng = (BI_LNG_MIN + Math.random() * (BI_LNG_MAX - BI_LNG_MIN)).toFixed(6);
      const lat = (BI_LAT_MIN + Math.random() * (BI_LAT_MAX - BI_LAT_MIN)).toFixed(6);
      return {
        CODE: p.CODE,
        Indno: p.Indno,
        Name: p.Name,
        Sex: p.Sex,
        Age: p.Age,
        Birthda: p.Birthda,
        AddrText: p.AddrPath,
        Longitude: has ? lng : '',
        Latitude: has ? lat : '',
        Remark: has ? '历史摸排定位' : ''
      };
    });
  }

  const BI_POP_DATA = buildPopData();
  const BI_GIS_DATA = buildGisData(BI_POP_DATA);

  /* ---------------- 状态 ---------------- */
  window.biPopState = { page: 1, pageSize: 12, mode: 'list', editingCode: null, filters: { uState: false, uLimit: false, nKeyType: '0', tKey: '' } };
  window.biGisState = { page: 1, pageSize: 12, mode: 'list', editingCode: null, filters: { nKeyType: '0', tKey: '' } };
  window.biView = 'super'; // 'super' = 超管(全省) | 'normal' = 普通账户(本辖区)
  const biIsSuper = () => window.biView === 'super';
  const biHomeRegion = ['河南省', '郑州市']; // 当前登录账户"本辖区"演示值

  /* ---------------- 区划筛选读取 ---------------- */
  function biRegionSels() { return (typeof regionSelected !== 'undefined' && regionSelected) ? regionSelected.map(r => r.label) : []; }
  function biRegionMatch(addrPath, sels) { return sels.every(s => addrPath.indexOf(s) >= 0); }

  /* ---------------- 发病人口：筛选 + 分页 ---------------- */
  function biPopFiltered() {
    if (!biIsSuper()) return []; // 普通账户按区划隔离，本辖区演示数据 0 条
    const f = window.biPopState.filters;
    const sels = biRegionSels();
    const kw = (f.tKey || '').trim();
    return BI_POP_DATA.filter(p => {
      if (f.uState && !biRegionMatch(p.AddrPath, biHomeRegion)) return false;
      if (f.uLimit && !p.tumor) return false;
      if (sels.length && !biRegionMatch(p.AddrPath, sels)) return false;
      if (kw) {
        const t = f.nKeyType;
        if (t === '0' && !String(p.CODE).includes(kw)) return false;
        if (t === '1' && !p.Name.includes(kw)) return false;
        if (t === '2' && !p.Indno.includes(kw)) return false;
        if (t === '3' && !p.AddrPath.includes(kw) && !p.Address.includes(kw)) return false;
      }
      return true;
    });
  }

  /* ---------------- 发病人口：页面渲染 ---------------- */
  function renderPopPage() {
    const isSuper = biIsSuper();
    const filtered = biPopFiltered();
    const total = filtered.length;
    const ps = window.biPopState.pageSize;
    const totalPages = Math.max(1, Math.ceil(total / ps));
    if (window.biPopState.page > totalPages) window.biPopState.page = totalPages;
    const start = (window.biPopState.page - 1) * ps;
    const rows = filtered.slice(start, start + ps);

    const permBanner = !isSuper ?
      '<div class="user-warn-banner"><span class="warn-icon">!</span><div><strong>区划权限隔离</strong>：当前为普通账户视角，仅显示本辖区（' + biHomeRegion.join('/') + '）数据。演示辖区内暂无记录（0 条）。超管（全省）视角可见 ' + BI_TOTAL_POP.toLocaleString() + ' 条存量数据。</div></div>' : '';

    const addBtn = isSuper ? '<button class="btn btn-primary btn-sm" onclick="biPopAdd()">+ 添加</button>' : '';

    const filter = '<div class="filter-toolbar bi-filter-toolbar">' +
      '<div class="form-group region-filter"><label>过滤行政区划</label>' + (typeof renderRegionCascader === 'function' ? renderRegionCascader() : '') + '</div>' +
      '<div class="form-group bi-filter-check"><label>仅显当前区划信息</label><label class="bi-check-control"><input type="checkbox" id="biPopUState" ' + (window.biPopState.filters.uState ? 'checked' : '') + ' onchange="biPopFilterChange()"><span>启用</span></label></div>' +
      '<div class="form-group bi-filter-check"><label>仅显肿瘤相关</label><label class="bi-check-control"><input type="checkbox" id="biPopULimit" ' + (window.biPopState.filters.uLimit ? 'checked' : '') + ' onchange="biPopFilterChange()"><span>启用</span></label></div>' +
      '<div class="form-group"><label>检索类型</label><select id="biPopKeyType">' + BI_KEY_TYPES.map(k => '<option value="' + k[0] + '"' + (window.biPopState.filters.nKeyType === k[0] ? ' selected' : '') + '>' + k[1] + '</option>').join('') + '</select></div>' +
      '<div class="form-group search-group"><label>检索内容</label><input id="biPopKey" value="' + esc(window.biPopState.filters.tKey) + '" placeholder="请输入关键词" oninput="biPopState.filters.tKey=this.value"></div>' +
      '<div class="filter-actions"><button class="btn btn-primary btn-sm" onclick="biPopQuery()">查询</button><button class="btn btn-ghost btn-sm" onclick="biPopReset()">重置</button></div>' +
      '</div>';

    const heads = ['#', '登记编号', '身份证号', '姓名', '性别', '年龄', '民族', '职业', '婚姻状况', '工作单位', '联系电话', '联系人', '户籍地址', '常住地址', '出生年月', '死亡日期', '操作'];
    const colSpan = heads.length + 1;
    let body;
    if (!rows.length) {
      body = '<tr><td colspan="' + colSpan + '" style="text-align:center;color:#64748b;padding:28px">暂无可显示记录' + (isSuper ? '（可调整筛选条件或切换视角）' : '（当前辖区无数据）') + '</td></tr>';
    } else {
      body = rows.map((p, i) => '<tr>' +
        '<td style="width:40px;text-align:center"><input type="checkbox" class="bi-pop-row-check" value="' + esc(p.CODE) + '" onchange="biPopUpdateBatchCount()"></td>' +
        '<td>' + (start + i + 1) + '</td>' +
        '<td>' + esc(p.CODE) + '</td>' +
        '<td>' + esc(p.Indno) + '</td>' +
        '<td>' + esc(p.Name) + '</td>' +
        '<td>' + (SEX[p.Sex] || p.Sex) + '</td>' +
        '<td>' + p.Age + '</td>' +
        '<td>' + (TRIB[p.Trib] || p.Trib) + '</td>' +
        '<td>' + (OCCU[p.Occu] || p.Occu) + '</td>' +
        '<td>' + (MARI[p.Mari] || p.Mari) + '</td>' +
        '<td>' + esc(p.WorkCom) + '</td>' +
        '<td>' + esc(p.Telephone) + '</td>' +
        '<td>' + esc(p.ContactPerson) + '</td>' +
        '<td>' + esc(p.AddrPath) + (p.Address ? ' ' + esc(p.Address) : '') + '</td>' +
        '<td>' + esc(p.ConPath) + (p.Conservation ? ' ' + esc(p.Conservation) : '') + '</td>' +
        '<td>' + esc(p.Birthda) + '</td>' +
        '<td>' + (p.DeathDate ? esc(p.DeathDate) : '<span style="color:#94a3b8">—</span>') + '</td>' +
        '<td class="sticky-col">' + (isSuper ?
          '<button class="btn btn-primary btn-xs" onclick="biPopEdit(\'' + p.CODE + '\')">编辑</button> ' +
          '<button class="btn btn-danger btn-xs" onclick="biPopDelete(\'' + p.CODE + '\')">删除</button>'
          : '<span style="color:#94a3b8">—</span>') +
        '</td></tr>').join('');
    }

    const batchBar = isSuper
      ? '<div id="biPopBatchBar" class="void-batch-bar" style="display:none;margin:0;padding:0;gap:12px"><div class="void-batch-info">已选择 <strong id="biPopBatchCount">0</strong> 条</div><div class="void-batch-actions">' +
        '<button class="btn btn-outline btn-xs" onclick="biPopBatchConvert()">批量转换区划</button>' +
        '<button class="btn btn-danger btn-xs" onclick="biPopBatchDelete()">批量删除</button>' +
        '</div></div>'
      : '';

    const table = '<div class="panel"><div class="panel-header" style="display:flex;align-items:center;justify-content:space-between;gap:12px"><span>发病人口信息列表</span><div style="display:flex;align-items:center;gap:12px;margin-left:auto">' + batchBar + addBtn + '</div></div><div class="panel-body">' +
      '<div class="table-wrap"><table class="data-table" style="min-width:1940px"><thead><tr>' +
      '<th style="width:40px"><input type="checkbox" id="biPopCheckAll" onchange="biPopToggleAll(this.checked)" title="全选本页"></th>' +
      heads.map(h => '<th>' + h + '</th>').join('') + '</tr></thead><tbody>' + body + '</tbody></table></div>' +
      biPagination('biPopGoPage', total, totalPages, window.biPopState.page) + '</div></div>';

    return permBanner + filter + table;
  }

  /* ---------------- 发病人口：地址级联选择 ---------------- */
  function biOpts(arr) { return (arr || []).map(x => '<option value="' + esc(x.label) + '">' + esc(x.label) + '</option>').join(''); }
  function biAddrSelects(prefix) {
    return '<div class="cascader-row">' +
      '<select id="' + prefix + '_p" onchange="biAddrChange(\'' + prefix + '\',0)"><option value="">省</option></select>' +
      '<select id="' + prefix + '_c" onchange="biAddrChange(\'' + prefix + '\',1)"><option value="">市</option></select>' +
      '<select id="' + prefix + '_d" onchange="biAddrChange(\'' + prefix + '\',2)"><option value="">区县</option></select>' +
      '<select id="' + prefix + '_t" onchange="biAddrChange(\'' + prefix + '\',3)"><option value="">乡镇/街道</option></select>' +
      '<select id="' + prefix + '_v" onchange="biAddrChange(\'' + prefix + '\',4)"><option value="">村/社区</option></select>' +
      '</div><input type="hidden" id="' + prefix + '_path" value="">';
  }
  function biAddrNode(prefix, level) {
    const p = $(prefix + '_p'), c = $(prefix + '_c'), d = $(prefix + '_d'), t = $(prefix + '_t'), v = $(prefix + '_v');
    const prov = regionData.find(x => x.label === p.value);
    const city = prov && prov.children ? prov.children.find(x => x.label === c.value) : null;
    const dist = city && city.children ? city.children.find(x => x.label === d.value) : null;
    const town = dist && dist.children ? dist.children.find(x => x.label === t.value) : null;
    return [prov, city, dist, town, v ? v.value : ''];
  }
  function biAddrChange(prefix, level) {
    const p = $(prefix + '_p'), c = $(prefix + '_c'), d = $(prefix + '_d'), t = $(prefix + '_t'), v = $(prefix + '_v');
    const prov = regionData.find(x => x.label === p.value);
    const city = prov && prov.children ? prov.children.find(x => x.label === c.value) : null;
    const dist = city && city.children ? city.children.find(x => x.label === d.value) : null;
    const town = dist && dist.children ? dist.children.find(x => x.label === t.value) : null;
    if (level <= 0) { c.innerHTML = '<option value="">市</option>' + biOpts(prov && prov.children); d.innerHTML = '<option value="">区县</option>'; t.innerHTML = '<option value="">乡镇/街道</option>'; v.innerHTML = '<option value="">村/社区</option>'; }
    if (level <= 1) { d.innerHTML = '<option value="">区县</option>' + biOpts(city && city.children); t.innerHTML = '<option value="">乡镇/街道</option>'; v.innerHTML = '<option value="">村/社区</option>'; }
    if (level <= 2) { t.innerHTML = '<option value="">乡镇/街道</option>' + biOpts(dist && dist.children); v.innerHTML = '<option value="">村/社区</option>'; }
    if (level <= 3) { v.innerHTML = '<option value="">村/社区</option>' + biOpts(town && town.children); }
    biAddrSync(prefix);
  }
  function biAddrSync(prefix) {
    const g = id => { const e = $(prefix + '_' + id); return e && e.value ? e.value : ''; };
    const path = [g('p'), g('c'), g('d'), g('t'), g('v')].filter(Boolean).join('/');
    const hid = $(prefix + '_path'); if (hid) hid.value = path;
  }
  function biAddrInit(prefix, pathStr) {
    const parts = (pathStr || '').split('/').filter(Boolean);
    const p = $(prefix + '_p'); if (!p) return;
    p.innerHTML = '<option value="">省</option>' + biOpts(regionData);
    p.value = parts[0] || '河南省';
    biAddrChange(prefix, 0);
    if (parts[1]) { p.parentNode.querySelector('#' + prefix + '_c').value = parts[1]; biAddrChange(prefix, 1); }
    if (parts[2]) { p.parentNode.querySelector('#' + prefix + '_d').value = parts[2]; biAddrChange(prefix, 2); }
    if (parts[3]) { p.parentNode.querySelector('#' + prefix + '_t').value = parts[3]; biAddrChange(prefix, 3); }
    if (parts[4]) { p.parentNode.querySelector('#' + prefix + '_v').value = parts[4]; biAddrChange(prefix, 4); }
    biAddrSync(prefix);
  }

  /* ---------------- 发病人口：新增/编辑表单 ---------------- */
  function renderPopForm() {
    const code = window.biPopState.editingCode;
    const isEdit = !!code;
    const p = isEdit ? BI_POP_DATA.find(x => x.CODE === code) : null;
    const gv = (f, d) => p ? (p[f] != null ? p[f] : d) : d;

    const sel = (label, id, options, val, extra) => '<div class="form-group"><label>' + label + '</label><select id="' + id + '"' + (extra || '') + '>' +
      options.map(o => '<option value="' + esc(o.v) + '"' + (String(o.v) === String(val) ? ' selected' : '') + '>' + esc(o.t) + '</option>').join('') + '</select></div>';

    const occuOpts = Object.keys(OCCU).map(k => ({ v: k, t: k + ' ' + OCCU[k] }));
    const tribOpts = TRIB_OPTIONS;
    const mariOpts = Object.keys(MARI).map(k => ({ v: k, t: k + ' ' + MARI[k] }));
    const otherOpts = OTHER_ID.map(x => ({ v: x, t: x }));
    const relOpts = RELATION.map(x => ({ v: x, t: x }));

    const form = '<div class="page-toolbar"><div class="toolbar-actions"><button class="btn btn-primary btn-sm" onclick="biPopSave()">提交保存</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="biPopCancel()">取消</button></div>' +
      '<div class="page-toolbar-title" style="display:block"><span class="icon">●</span>' + (isEdit ? '编辑发病人口档案' : '新增发病人口档案') + (isEdit ? '（登记编号 ' + code + '）' : '（提交后系统自动生成登记编号）') + '</div></div>' +
      '<div class="panel entry-form-panel"><div class="panel-body"><div class="form-grid">' +
      '<div class="form-group"><label>姓名 <span class="required">*</span></label><input id="biName" value="' + esc(gv('Name', '')) + '" placeholder="请输入姓名"></div>' +
      sel('性别 <span class="required">*</span>', 'biSex', [{ v: '1', t: '1 男性' }, { v: '2', t: '2 女性' }, { v: '9', t: '9 不详' }], gv('Sex', '1')) +
      '<div class="form-group"><label>出生年月 <span class="required">*</span></label><input type="date" id="biBirthda" value="' + esc(gv('Birthda', '')) + '" onchange="biPopCalcAge()"></div>' +
      '<div class="form-group"><label>年龄（自动）</label><input id="biAge" value="' + esc(gv('Age', '')) + '" disabled placeholder="由出生年月计算"></div>' +
      sel('民族 <span class="required">*</span>', 'biTrib', tribOpts, gv('Trib', '01')) +
      sel('职业 <span class="required">*</span>', 'biOccu', occuOpts, gv('Occu', '1')) +
      '<div class="form-group full"><label>户籍地址 <span class="required">*</span></label>' + biAddrSelects('biH') + '</div>' +
      '<div class="form-group full"><label>户籍详细地址 <span class="required">*</span></label><input id="biAddress" value="' + esc(gv('Address', '')) + '" placeholder="如：花园路 12 号"></div>' +
      '<div class="form-group full"><label>常住地址 <span class="required">*</span></label>' + biAddrSelects('biC') + '</div>' +
      '<div class="form-group full"><label>常住详细地址 <span class="required">*</span></label><input id="biConservation" value="' + esc(gv('Conservation', '')) + '" placeholder="如：农业院社区 5 号楼"></div>' +
      '<div class="form-group"><label>身份证号码</label><input id="biIndno" value="' + esc(gv('Indno', '')) + '" placeholder="18 位（选填）"></div>' +
      '<div class="form-group"><label>联系电话</label><input id="biTelephone" value="' + esc(gv('Telephone', '')) + '" placeholder="选填"></div>' +
      sel('其它证件', 'biOtherName', otherOpts, gv('OtherName', '医保卡')) +
      '<div class="form-group"><label>证件号码</label><input id="biOtherNo" value="' + esc(gv('OtherNo', '')) + '" placeholder="选填"></div>' +
      sel('联系人关系', 'biRelation', relOpts, gv('Relation', '配偶')) +
      '<div class="form-group"><label>联系人</label><input id="biContactPerson" value="' + esc(gv('ContactPerson', '')) + '" placeholder="选填"></div>' +
      '<div class="form-group"><label>联系人电话</label><input id="biContactPhone" value="' + esc(gv('ContactPhone', '')) + '" placeholder="选填"></div>' +
      sel('婚姻状况', 'biMari', mariOpts, gv('Mari', '2')) +
      '<div class="form-group"><label>工作单位</label><input id="biWorkCom" value="' + esc(gv('WorkCom', '')) + '" placeholder="选填"></div>' +
      '</div></div></div>';

    // 初始化地址级联
    setTimeout(() => {
      biAddrInit('biH', p ? p.AddrPath : '河南省/郑州市/金水区/花园路街道/农业院社区');
      biAddrInit('biC', p ? p.ConPath : '河南省/郑州市/金水区/花园路街道/农业院社区');
    }, 0);

    return form;
  }

  /* ---------------- 发病人口：处理器 ---------------- */
  function biSetView(v) { window.biView = v; window.biPopState.page = 1; window.biGisState.page = 1; renderPage('baseinfo-pop'); }
  function biPopQuery() {
    window.biPopState.filters.nKeyType = $('biPopKeyType') ? $('biPopKeyType').value : '0';
    window.biPopState.filters.tKey = $('biPopKey') ? $('biPopKey').value.trim() : '';
    window.biPopState.page = 1; renderPage('baseinfo-pop');
  }
  function biPopFilterChange() {
    window.biPopState.filters.uState = $('biPopUState') ? $('biPopUState').checked : false;
    window.biPopState.filters.uLimit = $('biPopULimit') ? $('biPopULimit').checked : false;
    window.biPopState.page = 1; renderPage('baseinfo-pop');
  }
  function biPopReset() {
    window.biPopState.filters = { uState: false, uLimit: false, nKeyType: '0', tKey: '' };
    if (typeof regionSelected !== 'undefined') regionSelected = [];
    window.biPopState.page = 1; renderPage('baseinfo-pop'); toast('筛选条件已重置');
  }
  function biPopAdd() { window.biPopState.mode = 'add'; window.biPopState.editingCode = null; renderPage('baseinfo-pop'); }
  function biPopEdit(code) { window.biPopState.mode = 'edit'; window.biPopState.editingCode = code; renderPage('baseinfo-pop'); }
  function biPopCancel() { window.biPopState.mode = 'list'; window.biPopState.editingCode = null; renderPage('baseinfo-pop'); }
  function biPopCalcAge() { const b = $('biBirthda'); if (b && b.value) $('biAge').value = calcAge(b.value); }
  function biPopSave() {
    const name = $('biName').value.trim();
    const sex = $('biSex').value;
    const birth = $('biBirthda').value;
    if (!name) return toast('请填写姓名', 'error');
    if (!sex) return toast('请选择性别', 'error');
    if (!birth) return toast('请填写出生年月', 'error');
    const hPath = $('biH_path').value;
    const cPath = $('biC_path').value;
    const addr = $('biAddress').value.trim();
    const con = $('biConservation').value.trim();
    if (!hPath) return toast('请选择户籍地址（区划）', 'error');
    if (!addr) return toast('请填写户籍详细地址', 'error');
    if (!cPath) return toast('请选择常住地址（区划）', 'error');
    if (!con) return toast('请填写常住详细地址', 'error');

    const distCode = (BI_DISTRICTS.find(d => d.path.indexOf(hPath.split('/').slice(0, 2).join('/')) === 0) || BI_DISTRICTS[0]).code;
    const cdistCode = (BI_DISTRICTS.find(d => d.path.indexOf(cPath.split('/').slice(0, 2).join('/')) === 0) || BI_DISTRICTS[0]).code;
    const rec = {
      CODE: window.biPopState.editingCode || ('2641' + pad(100000000 + BI_POP_DATA.length + randInt(1, 900), 9)),
      Indno: $('biIndno').value.trim(),
      Name: name, Sex: sex, Birthda: birth, Age: calcAge(birth),
      Trib: $('biTrib').value, Occu: $('biOccu').value, Mari: $('biMari').value,
      WorkCom: $('biWorkCom').value.trim(), Telephone: $('biTelephone').value.trim(),
      ContactPerson: $('biContactPerson').value.trim(), ContactPhone: $('biContactPhone').value.trim(),
      Relation: $('biRelation').value, OtherName: $('biOtherName').value, OtherNo: $('biOtherNo').value.trim(),
      AddCode1: distCode, Address: addr, AddrPath: hPath.split('/').slice(0, 4).join('/'),
      ConCode: cdistCode, Conservation: con, ConPath: cPath.split('/').slice(0, 4).join('/'),
      tumor: true, DeathDate: ''
    };
    if (window.biPopState.editingCode) {
      const i = BI_POP_DATA.findIndex(x => x.CODE === window.biPopState.editingCode);
      if (i >= 0) BI_POP_DATA[i] = Object.assign(BI_POP_DATA[i], rec);
      // 同步空间地址基础字段
      const g = BI_GIS_DATA.find(x => x.CODE === rec.CODE);
      if (g) { g.Indno = rec.Indno; g.Name = rec.Name; g.Sex = rec.Sex; g.Age = rec.Age; g.Birthda = rec.Birthda; g.AddrText = rec.AddrPath; }
      toast('发病人口档案已保存（' + rec.CODE + '）');
    } else {
      BI_POP_DATA.unshift(rec);
      // 为新增记录建立 1:1 空间地址占位
      if (!BI_GIS_DATA.some(x => x.CODE === rec.CODE)) BI_GIS_DATA.unshift({ CODE: rec.CODE, Indno: rec.Indno, Name: rec.Name, Sex: rec.Sex, Age: rec.Age, Birthda: rec.Birthda, AddrText: rec.AddrPath, Longitude: '', Latitude: '', Remark: '' });
      toast('新增发病人口档案成功（' + rec.CODE + '）');
    }
    window.biPopState.mode = 'list'; window.biPopState.editingCode = null; renderPage('baseinfo-pop');
  }
  function biPopDelete(code) {
    showConfirm('确认删除', '确定要删除登记编号「' + code + '」的发病人口档案吗？该操作将同步移除其空间地址记录，删除后不可恢复。', () => {
      const i = BI_POP_DATA.findIndex(x => x.CODE === code);
      if (i >= 0) BI_POP_DATA.splice(i, 1);
      const gi = BI_GIS_DATA.findIndex(x => x.CODE === code);
      if (gi >= 0) BI_GIS_DATA.splice(gi, 1);
      toast('已删除 ' + code); renderPage('baseinfo-pop');
    });
  }
  function biPopSelectedCodes() {
    return Array.from(document.querySelectorAll('.bi-pop-row-check:checked')).map(cb => cb.value);
  }
  function biPopToggleAll(checked) {
    document.querySelectorAll('.bi-pop-row-check').forEach(cb => { cb.checked = !!checked; });
    biPopUpdateBatchCount();
  }
  function biPopUpdateBatchCount() {
    const boxes = document.querySelectorAll('.bi-pop-row-check');
    const checked = document.querySelectorAll('.bi-pop-row-check:checked');
    const info = $('biPopBatchCount');
    if (info) info.textContent = String(checked.length);
    const bar = $('biPopBatchBar');
    if (bar) bar.style.display = checked.length ? 'flex' : 'none';
    const all = $('biPopCheckAll');
    if (all) {
      all.checked = boxes.length > 0 && checked.length === boxes.length;
      all.indeterminate = checked.length > 0 && checked.length < boxes.length;
    }
  }
  function biPopBatchDelete() {
    if (!biIsSuper()) return toast('批量删除为超管(全省)权限功能', 'error');
    const codes = biPopSelectedCodes();
    if (!codes.length) return toast('请先勾选要删除的记录', 'error');
    showConfirm('批量删除', '确定要删除已选中的 ' + codes.length + ' 条发病人口档案吗？将同步移除对应空间地址，删除后不可恢复。', () => {
      let n = 0;
      codes.forEach(code => {
        const i = BI_POP_DATA.findIndex(x => x.CODE === code);
        if (i >= 0) { BI_POP_DATA.splice(i, 1); n++; }
        const gi = BI_GIS_DATA.findIndex(x => x.CODE === code);
        if (gi >= 0) BI_GIS_DATA.splice(gi, 1);
      });
      toast('已批量删除 ' + n + ' 条记录');
      renderPage('baseinfo-pop');
    });
  }
  function biPopExport() {
    const rows = biPopFiltered();
    if (!rows.length) return toast('当前筛选结果为空，无可导出数据', 'error');
    const headers = ['登记编号', '身份证号', '姓名', '性别', '年龄', '民族', '职业', '婚姻状况', '工作单位', '联系电话', '户籍地址', '常住地址', '出生年月', '死亡日期'];
    const lines = [headers.join(',')];
    rows.forEach(p => lines.push([p.CODE, p.Indno, p.Name, SEX[p.Sex], p.Age, TRIB[p.Trib], OCCU[p.Occu], MARI[p.Mari], p.WorkCom, p.Telephone, p.AddrPath + ' ' + p.Address, p.ConPath + ' ' + p.Conservation, p.Birthda, p.DeathDate].map(csvCell).join(',')));
    biDownload('发病人口信息_' + new Date().toISOString().slice(0, 10) + '.csv', lines.join('\n'));
    toast('已导出 ' + rows.length + ' 条记录');
  }
  function csvCell(v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function biDownload(filename, content) {
    const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ---------------- 发病人口：批量转换区划 ---------------- */
  function biPopBatchConvert() {
    if (!biIsSuper()) return toast('「人口迁移」为超管(全省)权限功能', 'error');
    const selected = biPopSelectedCodes();
    if (!selected.length) return toast('请先勾选要迁移的记录', 'error');
    window.biPopBatchCodes = selected;
    const overlay = document.createElement('div'); overlay.className = 'cd-overlay'; overlay.id = 'biBcOverlay';
    const cascader = '<div class="bi-bc-cascader">' +
      '<select id="biBC_p" onchange="biAddrChange(\'biBC\',0)"><option value="">省</option></select>' +
      '<select id="biBC_c" onchange="biAddrChange(\'biBC\',1)"><option value="">市</option></select>' +
      '<select id="biBC_d" onchange="biAddrChange(\'biBC\',2)"><option value="">区县</option></select>' +
      '<select id="biBC_t" onchange="biAddrChange(\'biBC\',3)"><option value="">乡镇/街道</option></select>' +
      '<select id="biBC_v" onchange="biAddrChange(\'biBC\',4)"><option value="">村/社区</option></select>' +
      '</div><input type="hidden" id="biBC_path" value="">';
    overlay.innerHTML = '<div class="cd-dialog"><div class="cd-header"><span>批量转换区划</span><span class="cd-close" onclick="biPopBatchClose()">×</span></div>' +
      '<div class="cd-body">' +
      '<div class="bi-bc-alert"><p>行政区划调整时，将<strong>已勾选的 ' + selected.length + ' 条</strong>患者档案的区划编码批量迁移至目标区划。请谨慎操作。</p></div>' +
      '<div class="bi-bc-field"><label>归属行政区划（目标区划）</label>' + cascader + '</div>' +
      '<div class="bi-bc-option"><label class="bi-bc-option-label"><input type="checkbox" id="biBCCon"><span>常住地址同时转换</span></label></div>' +
      '</div>' +
      '<div class="bi-bc-footer"><button class="btn btn-ghost btn-sm" onclick="biPopBatchClose()">取消</button><button class="btn btn-primary btn-sm" onclick="biPopBatchExec()">确认迁移</button></div></div>';
    overlay.onclick = e => { if (e.target === overlay) biPopBatchClose(); };
    document.body.appendChild(overlay);
    setTimeout(() => biAddrInit('biBC', '河南省/郑州市/金水区/花园路街道/农业院社区'), 0);
  }
  function biPopBatchClose() { const o = $('biBcOverlay'); if (o) o.remove(); window.biPopBatchCodes = null; }
  function biPopBatchExec() {
    if (!biIsSuper()) return toast('「人口迁移」为超管(全省)权限功能', 'error');
    const target = $('biBC_path') ? $('biBC_path').value : '';
    if (!target) return toast('请选择目标行政区划', 'error');
    const conAlso = $('biBCCon') ? $('biBCCon').checked : false;
    const codes = window.biPopBatchCodes && window.biPopBatchCodes.length ? window.biPopBatchCodes : biPopSelectedCodes();
    if (!codes.length) return toast('请先勾选要迁移的记录', 'error');
    const targets = BI_POP_DATA.filter(p => codes.indexOf(p.CODE) >= 0);
    if (!targets.length) return toast('未找到可迁移的选中记录', 'error');
    const doMigrate = () => {
      // 取路径能匹配到的最深一级区划作为目标
      const tDistrict = BI_DISTRICTS.slice().sort((a, b) => b.path.length - a.path.length)
        .find(d => target.indexOf(d.path) === 0 || d.path.indexOf(target) === 0) || BI_DISTRICTS[0];
      const tCode = tDistrict.code, tPath = tDistrict.path;
      let gisMoved = 0;
      targets.forEach(p => {
        p.AddCode1 = tCode; p.AddrPath = tPath;
        if (conAlso) { p.ConCode = tCode; p.ConPath = tPath; }
        const g = BI_GIS_DATA.find(x => x.CODE === p.CODE);
        if (g) { g.AddrText = tPath; gisMoved++; }
      });
      biPopBatchClose();
      toast('已迁移 ' + targets.length + ' 条档案至 ' + tPath + (gisMoved ? '（同步更新 ' + gisMoved + ' 条空间地址）' : ''));
      renderPage('baseinfo-pop');
    };
    if (typeof showConfirm === 'function') {
      showConfirm('确认将已选中的 ' + targets.length + ' 条患者档案迁移至「' + target + '」？' + (conAlso ? '（常住地址一并转换）' : ''), doMigrate);
    } else { doMigrate(); }
  }

  /* ---------------- 空间地址：筛选 + 分页 ---------------- */
  function biGisFiltered() {
    if (!biIsSuper()) return [];
    const f = window.biGisState.filters;
    const sels = biRegionSels();
    const kw = (f.tKey || '').trim();
    return BI_GIS_DATA.filter(g => {
      if (sels.length && !biRegionMatch(g.AddrText, sels)) return false;
      if (kw) {
        const t = f.nKeyType;
        if (t === '0' && !String(g.CODE).includes(kw)) return false;
        if (t === '1' && !g.Name.includes(kw)) return false;
        if (t === '2' && !g.Indno.includes(kw)) return false;
        if (t === '3' && !g.AddrText.includes(kw)) return false;
      }
      return true;
    });
  }
  function renderGisPage() {
    const isSuper = biIsSuper();
    const filtered = biGisFiltered();
    const total = filtered.length;
    const ps = window.biGisState.pageSize;
    const totalPages = Math.max(1, Math.ceil(total / ps));
    if (window.biGisState.page > totalPages) window.biGisState.page = totalPages;
    const start = (window.biGisState.page - 1) * ps;
    const rows = filtered.slice(start, start + ps);

    const permBanner = !isSuper ?
      '<div class="user-warn-banner"><span class="warn-icon">!</span><div><strong>区划权限隔离</strong>：普通账户视角下本辖区暂无空间地址数据（0 条）。超管（全省）视角可见 ' + BI_TOTAL_GIS.toLocaleString() + ' 条。</div></div>' : '';

    const toolbar = '<div class="page-toolbar"><div class="toolbar-actions">' +
      (isSuper ? '<button class="btn btn-primary btn-sm" onclick="biGisAdd()">+ 添加</button>' : '') +
      '</div></div>';

    const filter = '<div class="filter-toolbar">' +
      '<div class="form-group region-filter"><label>过滤行政区划</label>' + (typeof renderRegionCascader === 'function' ? renderRegionCascader() : '') + '</div>' +
      '<div class="form-group"><label>检索类型</label><select id="biGisKeyType">' + BI_KEY_TYPES.map(k => '<option value="' + k[0] + '"' + (window.biGisState.filters.nKeyType === k[0] ? ' selected' : '') + '>' + k[1] + '</option>').join('') + '</select></div>' +
      '<div class="form-group search-group"><label>检索内容</label><input id="biGisKey" value="' + esc(window.biGisState.filters.tKey) + '" placeholder="登记编号 / 姓名 / 身份证号 / 户籍地址" oninput="biGisState.filters.tKey=this.value"></div>' +
      '<div class="filter-actions"><button class="btn btn-primary btn-sm" onclick="biGisQuery()">查询</button><button class="btn btn-ghost btn-sm" onclick="biGisReset()">重置</button></div>' +
      '</div>';

    const heads = ['#', '登记编号', '身份证号', '姓名', '性别', '年龄', '出生年月', '户籍地址', '经纬度', '操作'];
    let body;
    if (!rows.length) {
      body = '<tr><td colspan="' + heads.length + '" style="text-align:center;color:#64748b;padding:28px">暂无可显示记录' + (isSuper ? '（可调整筛选条件）' : '（当前辖区无数据）') + '</td></tr>';
    } else {
      body = rows.map((g, i) => {
        const coord = g.Longitude ? (g.Longitude + ', ' + g.Latitude) : '<span style="color:#94a3b8">未定位</span>';
        const addressAction = g.Longitude ? '编辑地址' : '添加地址';
        return '<tr><td>' + (start + i + 1) + '</td><td>' + esc(g.CODE) + '</td><td>' + esc(g.Indno) + '</td><td>' + esc(g.Name) + '</td><td>' + (SEX[g.Sex] || g.Sex) + '</td><td>' + g.Age + '</td><td>' + esc(g.Birthda) + '</td><td>' + esc(g.AddrText) + '</td><td>' + coord + '</td>' +
          '<td class="sticky-col">' + (isSuper ? '<button class="btn btn-outline btn-xs" onclick="biGisEdit(\'' + g.CODE + '\')" title="' + addressAction + '">📍 ' + addressAction + '</button>' : '<span style="color:#94a3b8">—</span>') + '</td></tr>';
      }).join('');
    }
    const table = '<div class="panel"><div class="panel-header">空间地址信息列表</div><div class="panel-body"><div class="table-wrap"><table class="data-table" style="min-width:1200px"><thead><tr>' +
      heads.map(h => '<th>' + h + '</th>').join('') + '</tr></thead><tbody>' + body + '</tbody></table></div>' +
      biPagination('biGisGoPage', total, totalPages, window.biGisState.page) + '</div></div>';

    return permBanner + toolbar + filter + table;
  }

  /* ---------------- 空间地址：编辑面板（含图钉地图） ---------------- */
  function renderGisEdit() {
    const code = window.biGisState.editingCode;
    const isEdit = !!code;
    const g = isEdit ? BI_GIS_DATA.find(x => x.CODE === code) : null;
    const hasCoordinates = !!(g && g.Longitude && g.Latitude);
    const src = isEdit && !g ? BI_POP_DATA.find(x => x.CODE === code) : null;
    const gv = (f, d) => g ? (g[f] != null ? g[f] : d) : (src ? (src[f] != null ? src[f] : d) : d);

    const form = '<div class="page-toolbar"><div class="toolbar-actions">' +
      '<button class="btn btn-primary btn-sm" onclick="biGisSave()">提交(Type=S)</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="biGisBack()">返回信息列表</button></div>' +
      '<div class="page-toolbar-title" style="display:block"><span class="icon">📍</span>' + (hasCoordinates ? '编辑空间地址' : '添加空间地址') + (isEdit ? '（登记编号 ' + code + '）' : '（新增空间地址记录）') + '</div></div>' +
      '<div class="panel"><div class="panel-body"><div class="form-grid">' +
      '<div class="form-group"><label>登记编号 <span class="required">*</span></label><input id="biGisCode" value="' + esc(gv('CODE', '')) + '" placeholder="关联发病人口登记编号"' + (isEdit ? ' disabled' : '') + '></div>' +
      '<div class="form-group"><label>姓名 <span class="required">*</span></label><input id="biGisName" value="' + esc(gv('Name', '')) + '"></div>' +
      '<div class="form-group"><label>身份证号 <span class="required">*</span></label><input id="biGisIndno" value="' + esc(gv('Indno', '')) + '"></div>' +
      '<div class="form-group"><label>经度</label><input id="biGisLng" value="' + esc(gv('Longitude', '')) + '" placeholder="如 113.6253" oninput="biGisFieldChange()"></div>' +
      '<div class="form-group"><label>纬度</label><input id="biGisLat" value="' + esc(gv('Latitude', '')) + '" placeholder="如 34.7466" oninput="biGisFieldChange()"></div>' +
      '<div class="form-group full"><label>备注</label><input id="biGisRemark" value="' + esc(gv('Remark', '')) + '" placeholder="选填"></div>' +
      '</div>' +
      '<div style="margin-top:8px"><div class="pop-chart-title" style="margin-bottom:8px">空间坐标拾取（点击地图放置图钉，或在上方直接输入经纬度）</div>' +
      '<div style="border:1px solid #d1d8e0;border-radius:6px;overflow:hidden;background:#eef4fb">' +
      '<svg id="biGisSvg" viewBox="0 0 640 380" style="width:100%;height:auto;display:block;cursor:crosshair" onclick="biGisMapClick(event)">' +
      gisMapSvg() +
      '</svg></div>' +
      '<div style="font-size:12px;color:#64748b;margin-top:6px">示意地图范围：经度 ' + BI_LNG_MIN + '–' + BI_LNG_MAX + '，纬度 ' + BI_LAT_MIN + '–' + BI_LAT_MAX + '（河南省）。点击可定位，拖动不改变坐标。</div>' +
      '</div></div></div>';

    setTimeout(() => { biGisInitEdit(); }, 0);
    return form;
  }
  function gisMapSvg() {
    let grid = '';
    for (let x = 0; x <= 640; x += 40) grid += '<line x1="' + x + '" y1="0" x2="' + x + '" y2="380" stroke="#dbe6f2" stroke-width="1"/>';
    for (let y = 0; y <= 380; y += 38) grid += '<line x1="0" y1="' + y + '" x2="640" y2="' + y + '" stroke="#dbe6f2" stroke-width="1"/>';
    return '<rect x="0" y="0" width="640" height="380" fill="#f3f8fd"/>' + grid +
      '<path d="M250,40 L470,70 L520,180 L470,300 L300,340 L170,300 L150,170 Z" fill="#dce9f7" stroke="#9bb6d4" stroke-width="2"/>' +
      '<text x="320" y="195" text-anchor="middle" font-size="20" fill="#5b7fa6" font-weight="700">河南省（示意）</text>' +
      '<circle id="biGisMarker" cx="-10" cy="-10" r="7" fill="#dc3545" stroke="#fff" stroke-width="2" style="display:none"/>' +
      '<text id="biGisMarkerTxt" x="-10" y="-10" font-size="11" fill="#b42335" style="display:none"></text>';
  }
  function biGisXY2LL(x, y) {
    const lng = BI_LNG_MIN + (x / 640) * (BI_LNG_MAX - BI_LNG_MIN);
    const lat = BI_LAT_MAX - (y / 380) * (BI_LAT_MAX - BI_LAT_MIN);
    return { lng, lat };
  }
  function biGisLL2XY(lng, lat) {
    const x = (lng - BI_LNG_MIN) / (BI_LNG_MAX - BI_LNG_MIN) * 640;
    const y = (BI_LAT_MAX - lat) / (BI_LAT_MAX - BI_LAT_MIN) * 380;
    return { x, y };
  }
  function biGisInitEdit() {
    const lng = parseFloat($('biGisLng').value), lat = parseFloat($('biGisLat').value);
    if (!isNaN(lng) && !isNaN(lat)) biGisSetMarker(lng, lat);
  }
  function biGisSetMarker(lng, lat) {
    const m = $('biGisMarker'), t = $('biGisMarkerTxt');
    if (!m) return;
    const { x, y } = biGisLL2XY(lng, lat);
    m.setAttribute('cx', x); m.setAttribute('cy', y); m.style.display = '';
    t.setAttribute('x', x + 10); t.setAttribute('y', y - 10); t.textContent = lng.toFixed(4) + ',' + lat.toFixed(4); t.style.display = '';
  }
  function biGisMapClick(evt) {
    const svg = $('biGisSvg'); if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = (evt.clientX - rect.left) / rect.width * 640;
    const y = (evt.clientY - rect.top) / rect.height * 380;
    const { lng, lat } = biGisXY2LL(x, y);
    if ($('biGisLng')) $('biGisLng').value = lng.toFixed(6);
    if ($('biGisLat')) $('biGisLat').value = lat.toFixed(6);
    biGisSetMarker(lng, lat);
  }
  function biGisFieldChange() {
    const lng = parseFloat($('biGisLng').value), lat = parseFloat($('biGisLat').value);
    if (!isNaN(lng) && !isNaN(lat) && lng >= BI_LNG_MIN && lng <= BI_LNG_MAX && lat >= BI_LAT_MIN && lat <= BI_LAT_MAX) biGisSetMarker(lng, lat);
  }

  /* ---------------- 空间地址：处理器 ---------------- */
  function biGisQuery() { window.biGisState.filters.nKeyType = $('biGisKeyType') ? $('biGisKeyType').value : '0'; window.biGisState.filters.tKey = $('biGisKey') ? $('biGisKey').value.trim() : ''; window.biGisState.page = 1; renderPage('baseinfo-gis'); }
  function biGisReset() { window.biGisState.filters = { nKeyType: '0', tKey: '' }; if (typeof regionSelected !== 'undefined') regionSelected = []; window.biGisState.page = 1; renderPage('baseinfo-gis'); toast('筛选条件已重置'); }
  function biGisAdd() { window.biGisState.mode = 'edit'; window.biGisState.editingCode = null; renderPage('baseinfo-gis'); }
  function biGisEdit(code) { window.biGisState.mode = 'edit'; window.biGisState.editingCode = code; renderPage('baseinfo-gis'); }
  function biGisBack() { window.biGisState.mode = 'list'; window.biGisState.editingCode = null; renderPage('baseinfo-gis'); }
  function biOpenGis(code) {
    window.biGisState.mode = 'edit'; window.biGisState.editingCode = code;
    // 直接进入编辑面板：绕过 navigateTo 的 mode 重置（navigateTo 用于菜单点击返回列表）
    if (typeof setActiveMenu === 'function') setActiveMenu('baseinfo-gis');
    if (typeof updateBreadcrumb === 'function') updateBreadcrumb('baseinfo-gis');
    renderPage('baseinfo-gis');
  }
  function biGisSave() {
    const code = window.biGisState.editingCode || $('biGisCode').value.trim();
    const name = $('biGisName').value.trim();
    const indno = $('biGisIndno').value.trim();
    if (!code) return toast('请填写登记编号', 'error');
    if (!name) return toast('请填写姓名', 'error');
    if (!indno) return toast('请填写身份证号', 'error');
    const rec = { CODE: code, Indno: indno, Name: name, Sex: '', Age: '', Birthda: '', AddrText: '', Longitude: $('biGisLng').value.trim(), Latitude: $('biGisLat').value.trim(), Remark: $('biGisRemark').value.trim() };
    // 反查补充基础字段
    const pop = BI_POP_DATA.find(x => x.CODE === code);
    if (pop) { rec.Sex = pop.Sex; rec.Age = pop.Age; rec.Birthda = pop.Birthda; rec.AddrText = pop.AddrPath; }
    const i = BI_GIS_DATA.findIndex(x => x.CODE === code);
    if (i >= 0) BI_GIS_DATA[i] = Object.assign(BI_GIS_DATA[i], rec);
    else BI_GIS_DATA.unshift(rec);
    toast('空间地址已保存（' + code + '）');
    window.biGisState.mode = 'list'; window.biGisState.editingCode = null; renderPage('baseinfo-gis');
  }

  /* ---------------- 通用分页 ---------------- */
  function biPagination(goFn, total, totalPages, page) {
    const dis = p => p < 1 || p > totalPages ? 'disabled' : '';
    return '<div class="void-pagination"><div class="void-pagination-info">共 ' + total.toLocaleString() + ' 条记录，第 ' + page + '/' + totalPages + ' 页</div>' +
      '<div class="void-pagination-controls">' +
      '<button ' + dis(1) + ' onclick="' + goFn + '(1)">首页</button>' +
      '<button ' + dis(page - 1) + ' onclick="' + goFn + '(' + (page - 1) + ')">‹</button>' +
      '<input type="text" value="' + page + '" onchange="' + goFn + '(parseInt(this.value))">' +
      '<button ' + dis(page + 1) + ' onclick="' + goFn + '(' + (page + 1) + ')">›</button>' +
      '<button ' + dis(totalPages) + ' onclick="' + goFn + '(' + totalPages + ')">尾页</button>' +
      '</div></div>';
  }
  function biPopGoPage(p) { const tp = Math.max(1, Math.ceil(biPopFiltered().length / window.biPopState.pageSize)); window.biPopState.page = Math.min(Math.max(1, p || 1), tp); renderPage('baseinfo-pop'); }
  function biGisGoPage(p) { const tp = Math.max(1, Math.ceil(biGisFiltered().length / window.biGisState.pageSize)); window.biGisState.page = Math.min(Math.max(1, p || 1), tp); renderPage('baseinfo-gis'); }

  /* ---------------- 路由入口 ---------------- */
  function renderBaseInfoPage(id) {
    if (id === 'baseinfo-pop') return window.biPopState.mode !== 'list' ? renderPopForm() : renderPopPage();
    if (id === 'baseinfo-gis') return window.biGisState.mode === 'edit' ? renderGisEdit() : renderGisPage();
    return renderGeneric ? renderGeneric('基础信息管理') : '<div class="panel"><div class="panel-body">基础信息管理</div></div>';
  }

  /* ---------------- 暴露到全局（供 inline onclick 与 app.html 路由调用） ---------------- */
  window.renderBaseInfoPage = renderBaseInfoPage;
  window.biSetView = biSetView;
  window.biPopQuery = biPopQuery; window.biPopFilterChange = biPopFilterChange; window.biPopReset = biPopReset;
  window.biPopAdd = biPopAdd; window.biPopEdit = biPopEdit; window.biPopCancel = biPopCancel; window.biPopCalcAge = biPopCalcAge; window.biPopSave = biPopSave; window.biPopDelete = biPopDelete; window.biPopExport = biPopExport;
  window.biPopToggleAll = biPopToggleAll; window.biPopUpdateBatchCount = biPopUpdateBatchCount; window.biPopBatchDelete = biPopBatchDelete;
  window.biAddrChange = biAddrChange; window.biAddrInit = biAddrInit;
  window.biPopBatchConvert = biPopBatchConvert; window.biPopBatchClose = biPopBatchClose; window.biPopBatchExec = biPopBatchExec;
  window.biPopGoPage = biPopGoPage; window.biGisGoPage = biGisGoPage;
  window.biGisQuery = biGisQuery; window.biGisReset = biGisReset; window.biGisAdd = biGisAdd; window.biGisEdit = biGisEdit; window.biGisBack = biGisBack; window.biGisSave = biGisSave;
  window.biOpenGis = biOpenGis;
  window.biGisMapClick = biGisMapClick; window.biGisFieldChange = biGisFieldChange; window.biGisInitEdit = biGisInitEdit; window.biGisSetMarker = biGisSetMarker;
})();
