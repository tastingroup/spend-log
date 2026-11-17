// 소비노트 ↔ 구글 시트 동기화
// 아래 TOKEN을 나만 아는 문자열로 바꾼 뒤 웹 앱으로 배포하세요. (README 참고)
const TOKEN = 'CHANGE_ME';
const SHEET_NAME = '구매기록';
const SUMMARY_NAME = '챌린지요약';
// 챌린지요약 탭에 나열할 생활비 카테고리 (쇼핑·합계 행은 자동으로 붙는다)
const LIFE_CATEGORIES = ['외식', '식재', '교통', '의료', '구독', '여행', '기타'];

// [앱의 필드 이름, 시트 머리글] — 순서가 곧 열 순서
const COLS = [
  ['date', '구매일'],
  ['kind', '구분'],
  ['category', '카테고리'],
  ['name', '상품명'],
  ['brand', '브랜드'],
  ['place', '구매처'],
  ['channel', '채널'],
  ['region', '지역'],
  ['currency', '통화'],
  ['amount', '금액'],
  ['rate', '환율'],
  ['krw', '원화금액'],
  ['listPrice', '정가'],
  ['qty', '수량'],
  ['target', '대상'],
  ['recipient', '받는사람'],
  ['memo', '메모'],
  ['updatedAt', '수정시각'],
  ['deleted', '삭제'],
  ['id', 'ID'],
];
const KEYS = COLS.map(function (c) { return c[0]; });
const col_ = function (key) { return KEYS.indexOf(key) + 1; };

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.getRange(1, 1, 1, COLS.length).setValues([COLS.map(function (c) { return c[1]; })]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

// 열 번호 → A1 표기 열 문자 (열이 26개 이하라는 전제)
const letter_ = function (key) { return String.fromCharCode(64 + col_(key)); };

// 월별 카테고리 합계를 수식으로 보여주는 탭. B1의 날짜만 바꾸면 다른 달을 볼 수 있다
function summary_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getSheetByName(SUMMARY_NAME)) return;
  const sh = ss.insertSheet(SUMMARY_NAME);
  const ref = function (key) { return "'" + SHEET_NAME + "'!" + letter_(key) + ':' + letter_(key); };
  const inMonth = ref('date') + ',">="&$B$1,' + ref('date') + ',"<="&EOMONTH($B$1,0),' + ref('deleted') + ',"<>1"';
  const now = new Date();
  const rows = [['대상 월 (1일 날짜)', new Date(now.getFullYear(), now.getMonth(), 1), ''], ['카테고리', '금액', '비중']];
  const totalRow = LIFE_CATEGORIES.length + 4;
  LIFE_CATEGORIES.forEach(function (name, i) {
    rows.push([name, '=SUMIFS(' + ref('krw') + ',' + ref('kind') + ',"생활",' + ref('category') + ',"' + name + '",' + inMonth + ')', '=IFERROR(B' + (i + 3) + '/$B$' + totalRow + ',0)']);
  });
  // 쇼핑 기록 전체 + 생활비로 적은 '쇼핑'
  rows.push(['쇼핑', '=SUMIFS(' + ref('krw') + ',' + ref('kind') + ',"쇼핑",' + inMonth + ')+SUMIFS(' + ref('krw') + ',' + ref('kind') + ',"생활",' + ref('category') + ',"쇼핑",' + inMonth + ')', '=IFERROR(B' + (totalRow - 1) + '/$B$' + totalRow + ',0)']);
  rows.push(['합계', '=SUMIFS(' + ref('krw') + ',' + inMonth + ')', '']);
  sh.getRange(1, 1, rows.length, 3).setValues(rows);
  sh.getRange('B1').setNumberFormat('yyyy-mm');
  sh.getRange(3, 2, rows.length - 2, 1).setNumberFormat('#,##0');
  sh.getRange(3, 3, rows.length - 3, 1).setNumberFormat('0%');
  sh.getRange('A2:C2').setFontWeight('bold');
  sh.getRange(totalRow, 1, 1, 3).setFontWeight('bold');
  sh.setColumnWidth(1, 160);
}

function read_(sh) {
  const last = sh.getLastRow();
  if (last < 2) return [];
  const tz = Session.getScriptTimeZone();
  return sh.getRange(2, 1, last - 1, COLS.length).getValues().map(function (values, i) {
    const row = { _row: i + 2 };
    KEYS.forEach(function (key, j) {
      const v = values[j];
      row[key] = v instanceof Date ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : v;
    });
    return row;
  }).filter(function (row) { return row.id; });
}

function toRow_(r) {
  return KEYS.map(function (key) { return r[key] === null || r[key] === undefined ? '' : r[key]; });
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// 앱이 보낸 변경분을 반영하고 시트 전체를 돌려준다
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const body = JSON.parse(e.postData.contents);
    if (TOKEN === 'CHANGE_ME' || body.token !== TOKEN) return out_({ ok: false, error: 'unauthorized' });

    const sh = sheet_();
    summary_();
    const byId = {};
    read_(sh).forEach(function (row) { byId[row.id] = row; });

    (body.rows || []).forEach(function (r) {
      const existing = byId[r.id];
      if (!existing) {
        sh.appendRow(toRow_(r));
      } else if (Number(r.updatedAt) >= Number(existing.updatedAt)) {
        sh.getRange(existing._row, 1, 1, COLS.length).setValues([toRow_(r)]);
      }
    });
    SpreadsheetApp.flush();

    const rows = read_(sh).map(function (row) { delete row._row; return row; });
    return out_({ ok: true, rows: rows });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// 시트에서 직접 고치거나 새 행을 쓰면 수정시각·ID를 채워서 앱이 변경을 가져가게 한다
function onEdit(e) {
  const sh = e.range.getSheet();
  if (sh.getName() !== SHEET_NAME) return;
  const first = Math.max(2, e.range.getRow());
  const last = e.range.getLastRow();
  for (let row = first; row <= last; row++) {
    sh.getRange(row, col_('updatedAt')).setValue(Date.now());
    const id = sh.getRange(row, col_('id'));
    if (!id.getValue()) id.setValue(Utilities.getUuid());
    const deleted = sh.getRange(row, col_('deleted'));
    if (deleted.getValue() === '') deleted.setValue(0);
  }
}
