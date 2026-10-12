/**
 * Shared RSVP endpoint for the wedding invitation website.
 * Sheet columns: Date | Name | Email | Attendance | Guest ID
 */
function doGet(e) {
  try {
    var params = (e && e.parameter) || {};

    if (params.action === 'capabilities') {
      return json_({ supportsDelete: true });
    }

    var sheet = getRsvpSheet_();
    var rows = sheet.getDataRange().getValues();

    if (params.action === 'lookup') {
      var guestId = String(params.guestId || '').trim();
      var nameKey = normalizeName_(params.name || '');
      for (var i = rows.length - 1; i >= 1; i--) {
        var rowGuestId = String(rows[i][4] || '').trim();
        var rowNameKey = normalizeName_(rows[i][1]);
        if ((guestId && rowGuestId === guestId) || (nameKey && !rowGuestId && rowNameKey === nameKey)) {
          return json_({ found: true, rsvp: rowToRsvp_(rows[i]) });
        }
      }
      return json_({ found: false });
    }

    var rsvps = [];
    for (var j = 1; j < rows.length; j++) {
      if (rows[j][1]) rsvps.push(rowToRsvp_(rows[j]));
    }
    return json_(rsvps);
  } catch (error) {
    return json_({ result: 'error', error: String(error) });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var sheet = getRsvpSheet_();
    var data = JSON.parse(e.postData.contents || '{}');
    var name = String(data.name || '').trim();
    var guestId = String(data.guestId || '').trim();

    if (data.action === 'delete') {
      if (!guestId && !name) throw new Error('Guest name or guest ID is required.');
      var rowsToCheck = sheet.getDataRange().getValues();
      var nameKeyToDelete = normalizeName_(name);
      var deletedCount = 0;
      for (var deleteIndex = rowsToCheck.length - 1; deleteIndex >= 1; deleteIndex--) {
        var rowGuestIdToDelete = String(rowsToCheck[deleteIndex][4] || '').trim();
        var exactGuestMatch = guestId && rowGuestIdToDelete === guestId;
        var legacyNameMatch = nameKeyToDelete && !rowGuestIdToDelete && normalizeName_(rowsToCheck[deleteIndex][1]) === nameKeyToDelete;
        if (exactGuestMatch || legacyNameMatch) {
          sheet.deleteRow(deleteIndex + 1);
          deletedCount++;
        }
      }
      return json_({ result: 'success', action: 'delete', guestId: guestId, deletedCount: deletedCount });
    }

    var attendance = data.attendance === 'accepts' ? 'Joyfully Accepts' : 'Regretfully Declines';
    if (!name || !guestId) throw new Error('Guest name and guest ID are required.');

    var rows = sheet.getDataRange().getValues();
    var targetRow = 0;
    var nameKey = normalizeName_(name);
    // Update an existing row for this guest. Fall back to name to migrate older rows.
    for (var i = rows.length - 1; i >= 1; i--) {
      var rowGuestId = String(rows[i][4] || '').trim();
      if (rowGuestId === guestId || (!rowGuestId && normalizeName_(rows[i][1]) === nameKey)) {
        targetRow = i + 1;
        break;
      }
    }

    var values = [data.date || new Date().toISOString(), name, data.email || '', attendance, guestId];
    if (targetRow) sheet.getRange(targetRow, 1, 1, values.length).setValues([values]);
    else sheet.appendRow(values);
    return json_({ result: 'success', guestId: guestId });
  } catch (error) {
    return json_({ result: 'error', error: String(error) });
  } finally {
    try { lock.releaseLock(); } catch (ignored) {}
  }
}

function getRsvpSheet_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  if (sheet.getLastColumn() < 5 || sheet.getRange(1, 5).getValue() !== 'Guest ID') {
    sheet.getRange(1, 5).setValue('Guest ID');
  }
  return sheet;
}

function rowToRsvp_(row) {
  var rawDate = row[0];
  var date = rawDate instanceof Date ? rawDate.toISOString() : (rawDate || new Date().toISOString());
  var attendance = String(row[3]).toLowerCase();
  return {
    date: date,
    name: row[1],
    email: row[2] || '',
    attendance: attendance === 'joyfully accepts' || attendance === 'accepts' ? 'accepts' : 'declines',
    guestId: String(row[4] || '').trim()
  };
}

function normalizeName_(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
