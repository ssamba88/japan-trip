/**
 * 후쿠오카 가족여행 비용 저장소 (구글 시트 + Apps Script)
 *
 * 시트 안에서 확장 프로그램 > Apps Script 를 열고 이 코드를 붙여 넣은 뒤 웹 앱으로 배포한다.
 * 설정 방법은 apps-script/설정방법.md 를 본다.
 *
 * 비밀번호는 코드에 적지 않고 "스크립트 속성"에 넣는다.
 *   EDIT_CODE : 편집 비밀번호 (비용 추가, 삭제, 설정 변경, 조회)
 *   VIEW_CODE : 보기 비밀번호 (조회만)
 */

var EXPENSE_HEADER = ["id", "ts", "title", "amount", "cur", "payer"];
var SETTING_HEADER = ["key", "value"];
var PAYERS = ["a", "b", "c"];

function doGet() {
  return out_({ ok: true, message: "후쿠오카 여행 비용 API가 동작 중이에요." });
}

function doPost(e) {
  var req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return out_({ ok: false, error: "bad_request" });
  }

  var role = roleFor_(String(req.code || ""));
  if (!role) {
    Utilities.sleep(1000); // 비밀번호를 계속 시도하는 것을 늦춘다
    return out_({ ok: false, error: "bad_code" });
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (req.action === "list") return out_(list_(role));
    if (role !== "edit") return out_({ ok: false, error: "not_allowed" });

    if (req.action === "add") return out_(add_(req.expense));
    if (req.action === "delete") return out_(delete_(req.id));
    if (req.action === "settings") return out_(setSettings_(req.settings));
    return out_({ ok: false, error: "unknown_action" });
  } finally {
    lock.releaseLock();
  }
}

function roleFor_(code) {
  if (!code) return null;
  var p = PropertiesService.getScriptProperties();
  var edit = p.getProperty("EDIT_CODE");
  var view = p.getProperty("VIEW_CODE");
  if (edit && code === edit) return "edit";
  if (view && code === view) return "view";
  return null;
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sheet_(name, header) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(header);
    sh.setFrozenRows(1);
  }
  return sh;
}

function list_(role) {
  var rows = sheet_("expenses", EXPENSE_HEADER).getDataRange().getValues();
  var expenses = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0]) continue;
    expenses.push({ id: String(r[0]), ts: Number(r[1]), title: String(r[2]), amount: Number(r[3]), cur: String(r[4]), payer: String(r[5]) });
  }
  var settings = {};
  var srows = sheet_("settings", SETTING_HEADER).getDataRange().getValues();
  for (var j = 1; j < srows.length; j++) settings[String(srows[j][0])] = srows[j][1];
  if (settings.startDate instanceof Date) {
    settings.startDate = Utilities.formatDate(settings.startDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return { ok: true, role: role, expenses: expenses, settings: settings };
}

function add_(x) {
  if (!x || typeof x !== "object") return { ok: false, error: "bad_request" };
  var id = String(x.id || "");
  var title = String(x.title || "").trim().slice(0, 100);
  var amount = Number(x.amount);
  var cur = x.cur === "KRW" ? "KRW" : x.cur === "JPY" ? "JPY" : "";
  var payer = String(x.payer || "");
  var ts = Number(x.ts) || Date.now();
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(id) || !title || !isFinite(amount) || amount < 0 || !cur || PAYERS.indexOf(payer) < 0) {
    return { ok: false, error: "bad_request" };
  }
  // 시트가 수식으로 읽지 않도록 =, +, -, @ 로 시작하는 제목은 앞에 공백을 둔다
  if (/^[=+\-@]/.test(title)) title = " " + title;

  var sh = sheet_("expenses", EXPENSE_HEADER);
  var ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
  for (var i = 1; i < ids.length; i++) if (String(ids[i][0]) === id) return { ok: true, duplicate: true };
  sh.appendRow([id, ts, title, amount, cur, payer]);
  return { ok: true };
}

function delete_(id) {
  id = String(id || "");
  if (!id) return { ok: false, error: "bad_request" };
  var sh = sheet_("expenses", EXPENSE_HEADER);
  var ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
  for (var i = ids.length - 1; i >= 1; i--) {
    if (String(ids[i][0]) === id) { sh.deleteRow(i + 1); return { ok: true }; }
  }
  return { ok: true, missing: true };
}

function setSettings_(s) {
  if (!s || typeof s !== "object") return { ok: false, error: "bad_request" };
  var patch = {};
  if (s.rate !== undefined) {
    var rate = Number(s.rate);
    if (!(rate > 0) || !isFinite(rate)) return { ok: false, error: "bad_request" };
    patch.rate = rate;
  }
  if (s.startDate !== undefined) {
    var sd = String(s.startDate);
    if (sd && !/^\d{4}-\d{2}-\d{2}$/.test(sd)) return { ok: false, error: "bad_request" };
    patch.startDate = sd;
  }
  var sh = sheet_("settings", SETTING_HEADER);
  var rows = sh.getDataRange().getValues();
  Object.keys(patch).forEach(function (key) {
    var found = -1;
    for (var i = 1; i < rows.length; i++) if (String(rows[i][0]) === key) { found = i + 1; break; }
    var cell;
    if (found > 0) cell = sh.getRange(found, 2);
    else { sh.appendRow([key, ""]); cell = sh.getRange(sh.getLastRow(), 2); }
    cell.setNumberFormat("@"); // 날짜가 자동으로 날짜 형식으로 바뀌지 않게 문자로 저장
    cell.setValue(String(patch[key]));
  });
  return { ok: true };
}
