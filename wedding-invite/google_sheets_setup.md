# Google Sheets RSVP Sync

The website uses Google Sheets as the shared RSVP source. Guest pages check the latest answer when opened, and each guest has one current response row. The sheet uses these columns:

| Column | Header |
| --- | --- |
| A | Date |
| B | Name |
| C | Email |
| D | Attendance |
| E | Guest ID |

The Apps Script adds the `Guest ID` header in column E automatically. Existing response rows without IDs can still be found by guest name; a guest's next RSVP update will add their ID to that row.

## Update the Apps Script endpoint

1. Open the linked Google Sheet and go to **Extensions → Apps Script**.
2. Replace the script contents with the code in [`Code.gs`](Code.gs), then save.
3. Choose **Deploy → Manage deployments**. Edit the existing Web App deployment, select **New version**, and deploy it. Keep access set to **Anyone** and execution set to your account. The existing `/exec` URL stays the same.
4. If Google shows a new deployment URL, update the `GOOGLE_SCRIPT_URL` in `app.js` and `dashboard.html` to match.
5. Publish the updated website files.

The guest RSVP page uses a stable guest ID from its invitation link (`?g=...`) to look up and update the same row from any device. For a guest who submits without a personalized link, the page derives an ID from the entered name. Removing a guest from the dashboard also removes every matching RSVP row from the shared sheet when the updated Apps Script is deployed. Other devices clear their cached response when they next open that guest page; use **Sync** on the dashboard to clear cached dashboard responses.

## Verify the sync

1. Open one personalized guest link on a phone and submit an RSVP.
2. Confirm the sheet has one response row with that guest's ID in column E.
3. Open the same link on a PC. It should show the latest response from the sheet.
4. Use **Edit Response** on either device. The existing row should update rather than adding another row; reload the link on the other device to see the change.
