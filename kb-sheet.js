/* ============================================================
   批量上传 · 清单表解析（xlsx / csv）
   ------------------------------------------------------------
   不引第三方库：.xlsx 就是 zip，用浏览器原生 DecompressionStream 解压后读 XML。
   .csv 走降级路径（先试 UTF-8，乱码再按 GBK 解）。

   对外导出（挂在 window.KBSheet）：
     parse(file) -> Promise<{ headers: string[], rows: object[] }>
     template(headers, sample) -> 生成 csv Blob 供下载（xlsx 写不了，csv 表格能直接打开）
   ============================================================ */
(function () {
  'use strict';

  function decodeUtf8(buf) { return new TextDecoder('utf-8').decode(buf); }
  function decodeGbk(buf) {
    try { return new TextDecoder('gbk').decode(buf); } catch (e) { return ''; }
  }

  /* ---------- zip ---------- */
  function readZipEntries(buf) {
    var dv = new DataView(buf);
    var u8 = new Uint8Array(buf);
    /* 从末尾找 End of Central Directory (0x06054b50) */
    var eocd = -1;
    for (var i = u8.length - 22; i >= 0 && i > u8.length - 66000; i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('不是有效的 xlsx（找不到 zip 目录）');
    var count = dv.getUint16(eocd + 10, true);
    var cdOffset = dv.getUint32(eocd + 16, true);

    var entries = {};
    var p = cdOffset;
    for (var k = 0; k < count; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      var method = dv.getUint16(p + 10, true);
      var compSize = dv.getUint32(p + 20, true);
      var nameLen = dv.getUint16(p + 28, true);
      var extraLen = dv.getUint16(p + 30, true);
      var commentLen = dv.getUint16(p + 32, true);
      var localOffset = dv.getUint32(p + 42, true);
      var name = decodeUtf8(u8.subarray(p + 46, p + 46 + nameLen));
      entries[name] = { method: method, size: compSize, offset: localOffset };
      p += 46 + nameLen + extraLen + commentLen;
    }
    return { entries: entries, dv: dv, u8: u8 };
  }

  async function extractEntry(zip, name) {
    var e = zip.entries[name];
    if (!e) return '';
    var dv = zip.dv;
    /* local header: 30 字节 + 文件名 + extra */
    var p = e.offset;
    var nameLen = dv.getUint16(p + 26, true);
    var extraLen = dv.getUint16(p + 28, true);
    var start = p + 30 + nameLen + extraLen;
    var data = zip.u8.subarray(start, start + e.size);
    if (e.method === 0) return decodeUtf8(data);
    if (typeof DecompressionStream === 'undefined') throw new Error('当前浏览器不支持解压 xlsx，请改用 CSV');
    var ds = new DecompressionStream('deflate-raw');
    var stream = new Blob([data]).stream().pipeThrough(ds);
    var out = await new Response(stream).arrayBuffer();
    return decodeUtf8(out);
  }

  /* ---------- xml 小工具 ---------- */
  function unescapeXml(s) {
    return String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  }
  /* 取所有 <si> 里的 <t> 拼起来（共享字符串） */
  function parseSharedStrings(xml) {
    var out = [];
    var siRe = /<si>([\s\S]*?)<\/si>/g, m;
    while ((m = siRe.exec(xml))) {
      var texts = [];
      var tRe = /<t[^>]*>([\s\S]*?)<\/t>/g, t;
      while ((t = tRe.exec(m[1]))) texts.push(unescapeXml(t[1]));
      out.push(texts.join(''));
    }
    return out;
  }
  function colToIndex(ref) {
    var s = String(ref).replace(/[0-9]+$/, '');
    var n = 0;
    for (var i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
    return n - 1;
  }
  function parseSheet(xml, shared) {
    var rows = [];
    var rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g, rm;
    while ((rm = rowRe.exec(xml))) {
      var cells = [];
      var cRe = /<c([^>]*)>([\s\S]*?)<\/c>/g, cm;
      while ((cm = cRe.exec(rm[1]))) {
        var attrs = cm[1] || '';
        var body = cm[2] || '';
        var tMatch = attrs.match(/\bt="([^"]+)"/);
        var rMatch = attrs.match(/\br="([A-Z]+[0-9]+)"/);
        var idx = rMatch ? colToIndex(rMatch[1]) : cells.length;
        var val = '';
        if (tMatch && tMatch[1] === 'inlineStr') {
          var im = body.match(/<t[^>]*>([\s\S]*?)<\/t>/);
          val = im ? unescapeXml(im[1]) : '';
        } else {
          var vm = body.match(/<v>([\s\S]*?)<\/v>/);
          var raw = vm ? unescapeXml(vm[1]) : '';
          if (tMatch && tMatch[1] === 's') val = shared[parseInt(raw, 10)] || '';
          else val = raw;
        }
        cells[idx] = val;
      }
      rows.push(cells);
    }
    return rows;
  }

  /* ---------- csv ---------- */
  function parseCsv(text) {
    var rows = [], row = [], cur = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (c === '\r') { /* skip */ }
      else cur += c;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }

  /* 行数组 → 对象数组（第一行做表头） */
  function rowsToObjects(grid) {
    if (!grid.length) return { headers: [], rows: [] };
    var headers = (grid[0] || []).map(function (h) { return String(h || '').trim(); });
    var out = [];
    for (var i = 1; i < grid.length; i++) {
      var arr = grid[i] || [];
      var blank = arr.every(function (v) { return !String(v == null ? '' : v).trim(); });
      if (blank) continue;
      var o = {};
      headers.forEach(function (h, j) { if (h) o[h] = String(arr[j] == null ? '' : arr[j]).trim(); });
      o.__row = i + 1;
      out.push(o);
    }
    return { headers: headers.filter(Boolean), rows: out };
  }

  async function parse(file) {
    var name = String(file.name || '').toLowerCase();
    var buf = await file.arrayBuffer();
    if (name.endsWith('.csv') || name.endsWith('.txt')) {
      var txt = decodeUtf8(buf);
      if (/\uFFFD/.test(txt)) { var g = decodeGbk(buf); if (g) txt = g; }
      return rowsToObjects(parseCsv(txt));
    }
    if (!name.endsWith('.xlsx')) throw new Error('只支持 .xlsx 或 .csv（.xls 请另存为 .xlsx）');
    var zip = readZipEntries(buf);
    var sharedXml = await extractEntry(zip, 'xl/sharedStrings.xml');
    var shared = sharedXml ? parseSharedStrings(sharedXml) : [];
    var sheetName = Object.keys(zip.entries).filter(function (n) { return /^xl\/worksheets\/sheet\d+\.xml$/.test(n); }).sort()[0];
    if (!sheetName) throw new Error('xlsx 里没有工作表');
    var sheetXml = await extractEntry(zip, sheetName);
    return rowsToObjects(parseSheet(sheetXml, shared));
  }

  /* 模板：csv 带 BOM，Excel 直接双击打开不乱码 */
  function template(headers, sample) {
    function esc(v) {
      var s = String(v == null ? '' : v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }
    var lines = [headers.map(esc).join(',')];
    (sample || []).forEach(function (r) { lines.push(headers.map(function (h) { return esc(r[h]); }).join(',')); });
    return '\ufeff' + lines.join('\r\n');
  }

  window.KBSheet = { parse: parse, template: template };
})();
