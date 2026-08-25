const sheets = SpreadsheetApp.openByUrl('https://docs.google.com/spreadsheets/d/1_hdFkBTCwqWiRa8Tkx2huEamIMqg5bRjTCOYV30xK1s/edit?gid=1604728652#gid=1604728652');
const priceSheet = sheets.getSheetByName("Items and Prices");
const recordSheet = sheets.getSheetByName("Records");
const todaySheet = sheets.getSheetByName("Today's Summary");
const bandSheet = sheets.getSheetByName("Band Upcharge");

const LAST_ROW = 300; // last row tracked in Today's Summary (matches the original G2:G300 / T2:T300 / O2:O300 ranges)

/**
 * Checks the "Band Upcharge" sheet (columns: date, startTime, endTime, overnight) for
 * an entry covering the current moment. Mirrors the client-side `isBandHere` logic in
 * App.jsx, but simpler: Apps Script reads date/time cells as native Date objects and
 * the overnight checkbox as a real boolean, so no text parsing is needed here.
 *
 * @returns {boolean} `true` if a band event is active right now.
 */
function isBandActive() {
  var rows = bandSheet.getDataRange().getValues();
  var now = new Date();

  for (var i = 1; i < rows.length; i++) { // skip header row
    var date = rows[i][0];
    var startTime = rows[i][1];
    var endTime = rows[i][2];
    var overnight = rows[i][3];

    if (!(date instanceof Date) || !(startTime instanceof Date) || !(endTime instanceof Date)) continue;
    if (now.getFullYear() !== date.getFullYear() || now.getMonth() !== date.getMonth() || now.getDate() !== date.getDate()) continue;

    var start = new Date(date);
    start.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
    var end = new Date(date);
    end.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);

    var bandIsPresent = overnight
      ? (now >= start || now <= end)
      : (now >= start && now <= end);

    if (bandIsPresent) return true;
  }
  return false;
}

/**
 * Web app POST handler. Receives a ticket JSON payload from the POS front end and
 * applies it to the "Today's Summary" sheet: increments matching item counts (split
 * into normal-hours vs band-upcharge-hours columns based on whether the band upcharge
 * is active right now) and dollar sales, increments matching modifier counts, and
 * appends any "Open Liquor" entries to the open-sales log.
 *
 * Runs under a script lock so concurrent tickets can't race each other, and is
 * idempotent on `data.id` so a client retry of an already-processed ticket is a no-op.
 *
 * @param {Object} e - The Apps Script doPost event object; `e.postData.contents` holds the JSON body.
 * @param {string} [e.postData.contents] - JSON string of the ticket payload: `{ id, items, total, timestamp }`, where each item has `name`, `qty`, `price`, and optionally `type` ("modifier") and `department`.
 * @returns {GoogleAppsScript.Content.TextOutput} A plain-text summary of what was recorded (and anything left unmatched).
 */
function doPost(e) {
  // Serialize every ticket submission so two tickets landing close together can't both
  // read the same "old total" and clobber each other's increment (classic lost-update race).
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var data = JSON.parse(e.postData.contents);

    // Idempotency guard: the client retries a ticket if the network request appears to fail.
    // Apps Script's POST -> redirect flow can make a request LOOK failed to the browser even
    // though doPost already ran, so without this a retried ticket would get double-counted.
    if (data.id) {
      var cache = CacheService.getScriptCache();
      if (cache.get(data.id)) {
        return ContentService.createTextOutput("Duplicate ticket ignored: " + data.id);
      }
      cache.put(data.id, "1", 21600); // 6 hours is plenty to cover same-day retries
    }

    var bandActive = isBandActive();

    var names = todaySheet.getRange("G2:G" + LAST_ROW).getValues();
    var normalCounts = todaySheet.getRange("I2:I" + LAST_ROW).getValues();
    var bandCounts = todaySheet.getRange("J2:J" + LAST_ROW).getValues();
    var itemSales = todaySheet.getRange("K2:K" + LAST_ROW).getValues();

    var modifierNames = todaySheet.getRange("T2:T" + LAST_ROW).getValues();
    var modifierDepartments = todaySheet.getRange("U2:U" + LAST_ROW).getValues();
    var modifierAmounts = todaySheet.getRange("V2:V" + LAST_ROW).getValues();

    var openTimes = todaySheet.getRange("O2:O" + LAST_ROW).getValues();
    var openAmounts = todaySheet.getRange("P2:P" + LAST_ROW).getValues();

    var nextOpenSalesRow = openAmounts.findIndex(function (row) { return row[0] === ''; });
    if (nextOpenSalesRow === -1) nextOpenSalesRow = openAmounts.length; // log is full, handled below

    var unmatched = [];

    data.items.forEach(function (item) {
      if (item.type === "modifier") {
        var row = modifierNames.findIndex(function (n, i) {
          return n[0] === item.name && modifierDepartments[i][0] === item.department;
        });
        if (row === -1) {
          unmatched.push("modifier: " + item.name + " (" + item.department + ")");
        } else {
          modifierAmounts[row][0] = (modifierAmounts[row][0] || 0) + item.qty;
        }
      } else {
        var row = names.findIndex(function (n) { return n[0] === item.name; });
        if (row !== -1) {
          if (bandActive) {
            bandCounts[row][0] = (bandCounts[row][0] || 0) + item.qty;
          } else {
            normalCounts[row][0] = (normalCounts[row][0] || 0) + item.qty;
          }
          itemSales[row][0] = (itemSales[row][0] || 0) + item.qty * item.price;
        } else if (item.name !== "Open Liquor") {
          unmatched.push("item: " + item.name);
        }
      }

      if (item.name === "Open Liquor") {
        if (nextOpenSalesRow >= openAmounts.length) {
          unmatched.push("open sale (log full): $" + item.price);
        } else {
          var now = new Date();
          var timeZone = Session.getScriptTimeZone();
          openTimes[nextOpenSalesRow][0] = Utilities.formatDate(now, timeZone, "hh:mm a");
          openAmounts[nextOpenSalesRow][0] = item.price;
          nextOpenSalesRow++;
        }
      }
    });

    todaySheet.getRange("I2:I" + LAST_ROW).setValues(normalCounts);
    todaySheet.getRange("J2:J" + LAST_ROW).setValues(bandCounts);
    todaySheet.getRange("K2:K" + LAST_ROW).setValues(itemSales);
    todaySheet.getRange("V2:V" + LAST_ROW).setValues(modifierAmounts);
    todaySheet.getRange("O2:O" + LAST_ROW).setValues(openTimes);
    todaySheet.getRange("P2:P" + LAST_ROW).setValues(openAmounts);

    if (unmatched.length > 0) {
      // These would previously fail SILENTLY - the sale's cash was taken but nothing in the
      // sheet reflected it. Surface them instead of losing them quietly.
      Logger.log("Ticket " + (data.id || "(no id)") + " had unmatched entries: " + unmatched.join(", "));
    }

    return ContentService.createTextOutput(
      "OK: " + data.items.length + " item(s) recorded" +
      (unmatched.length ? "; UNMATCHED (not recorded): " + unmatched.join(", ") : "")
    );
  } finally {
    lock.releaseLock();
  }
}

/**
 * Archives the current day's totals from "Today's Summary" into a new row on the
 * "Records" sheet, then clears "Today's Summary" so the next day starts at zero.
 * Intended to be run on a time-driven trigger (e.g. nightly rollover). No-ops if
 * there were no sales (`totalSales == 0`).
 *
 * Runs under the same script lock as {@link doPost} so a rollover can't clear
 * columns out from under an in-flight ticket submission.
 *
 * @returns {void}
 */
function makeRecord() {
  // Same lock as doPost: without this, a rollover trigger firing while a late sale is mid-write
  // could clear the very columns doPost is about to update, or archive a half-written total.
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    // NOTE: .getValue() (singular) returns the plain cell value. The original code used
    // .getValues() here, which returns a 2D array - so "sumItemSales + modifierSales" was
    // doing STRING CONCATENATION of two arrays (e.g. "120" + "15" -> "12015"), not addition,
    // and the date cell was being written back as a nested array instead of a real Date.
    // That alone would make every archived daily total wrong, independent of any race condition.
    var sumItemSales = todaySheet.getRange("C2").getValue();
    var sumOpenSales = todaySheet.getRange("C6").getValue();
    var modifierSales = todaySheet.getRange("C10").getValue();
    var date = todaySheet.getRange("C14").getValue();
    date.setDate(date.getDate() - 1);
    var totalSales = todaySheet.getRange("C15").getValue();

    if (totalSales != 0) {
      var records = recordSheet.getRange("C2:C").getValues();
      var nextOpenRecordsRow = -1;
      for (var n = 0; n < records.length; n++) {
        if (records[n][0] === '') {
          nextOpenRecordsRow = n + 2; // +2 to convert 0-based index back to a sheet row (records starts at C2)
          break;
        }
      }
      if (nextOpenRecordsRow === -1) nextOpenRecordsRow = records.length + 2;

      recordSheet.getRange("C" + nextOpenRecordsRow).setValue(date);
      recordSheet.getRange("D" + nextOpenRecordsRow).setValue(sumOpenSales);
      recordSheet.getRange("E" + nextOpenRecordsRow).setValue(sumItemSales + modifierSales);
      recordSheet.getRange("F" + nextOpenRecordsRow).setValue(totalSales);

      // Reset Amounts
      todaySheet.getRange("O2:O" + LAST_ROW).clearContent(); // Open Sales Time
      todaySheet.getRange("P2:P" + LAST_ROW).clearContent(); // Open Sales Amount
      todaySheet.getRange("I2:I" + LAST_ROW).clearContent(); // Normal Hours Amounts
      todaySheet.getRange("J2:J" + LAST_ROW).clearContent(); // Band Upcharge Amounts
      todaySheet.getRange("K2:K" + LAST_ROW).clearContent(); // Item Sales
      todaySheet.getRange("V2:V" + LAST_ROW).clearContent(); // Modifier Amounts
    }
  } finally {
    lock.releaseLock();
  }
}
