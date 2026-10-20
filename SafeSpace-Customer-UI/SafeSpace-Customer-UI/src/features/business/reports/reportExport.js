// A minimal OOXML workbook (ZIP STORE) without a runtime dependency.
// All text is inlineStr, so user-controlled cells cannot become Excel formulas.
const encode = s => new TextEncoder().encode(s);
const xml = v => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
function crc32(bytes) {
  let crc = -1;
  for (const b of bytes) { crc ^= b; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  return (crc ^ -1) >>> 0;
}
const header = (size, fields) => {
  const out = new Uint8Array(size), view = new DataView(out.buffer);
  for (const [offset, value, width] of fields) width === 4 ? view.setUint32(offset, value, true) : view.setUint16(offset, value, true);
  return out;
};
export function workbookBytes(rows) {
  const cell = (v, i) => {
    let col = '', n = i + 1;
    while (n) { col = String.fromCharCode(65 + (n - 1) % 26) + col; n = Math.floor((n - 1) / 26); }
    return typeof v === 'number' && Number.isFinite(v) ? `<c r="${col}ROW"><v>${v}</v></c>` : `<c r="${col}ROW" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
  };
  const files = {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Báo cáo SafeSpace" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + rows.map((row, r) => `<row r="${r + 1}">${row.map((v, i) => cell(v, i).replace('ROW', String(r + 1))).join('')}</row>`).join('') + '</sheetData></worksheet>',
  };
  const local = [], central = []; let offset = 0, centralSize = 0;
  for (const [path, content] of Object.entries(files)) {
    const name = encode(path), data = encode(content), crc = crc32(data);
    const entry = header(30, [[0, 0x04034b50, 4], [4, 20, 2], [10, 0, 2], [12, 33, 2], [14, crc, 4], [18, data.length, 4], [22, data.length, 4], [26, name.length, 2]]);
    const dir = header(46, [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [14, 33, 2], [16, crc, 4], [20, data.length, 4], [24, data.length, 4], [28, name.length, 2], [42, offset, 4]]);
    local.push(entry, name, data); central.push(dir, name); offset += entry.length + name.length + data.length; centralSize += dir.length + name.length;
  }
  const count = Object.keys(files).length;
  const end = header(22, [[0, 0x06054b50, 4], [8, count, 2], [10, count, 2], [12, centralSize, 4], [16, offset, 4]]);
  const out = new Uint8Array(offset + centralSize + end.length); let pos = 0;
  for (const part of [...local, ...central, end]) { out.set(part, pos); pos += part.length; }
  return out;
}
export function parseCsv(text) {
  const rows = []; let row = [], field = '', quoted = false;
  text = text.replace(/^\ufeff/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted; }
    else if (c === ',' && !quoted) { row.push(field); field = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && text[i + 1] === '\n') i++; row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (quoted) throw new Error('Tệp báo cáo từ máy chủ không hợp lệ.');
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}
export function downloadWorkbook(rows, fileName) {
  const blob = new Blob([workbookBytes(rows)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = fileName; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
