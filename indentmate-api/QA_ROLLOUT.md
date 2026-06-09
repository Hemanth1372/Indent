# Phase 5 QA and Rollout Checklist

## Automated Backend Tests

Run against a disposable PostgreSQL database only:

```powershell
$env:TEST_DATABASE_URL="postgres://user:password@localhost:5432/indentmate_test"
npm run test:integration
```

The integration suite verifies:

- Happy path creates one `indent_headers` row and all `indent_lines`.
- Invalid line payload is rejected before any header is persisted.
- Repeated `app_request_id` returns the existing `indent_no` without duplicate headers.

## Manual Mobile Sync Tests

1. Enable airplane mode.
2. Create three indents with at least two line items each.
3. Submit all three and confirm local status is `PendingSync`.
4. Re-enable internet with a throttled/unstable connection.
5. Confirm successfully posted indents move to `Created` and store `OfficialIndentNo`.
6. Confirm interrupted indents remain `PendingSync` and retry when connectivity returns.
7. Send one invalid item payload and confirm the local status becomes `SyncError`.

## Web Admin Workflow Tests

1. Open `/transactions`.
2. Expand a transaction row and verify all line items render.
3. Click `Approve` and confirm the row status updates without page refresh.
4. Click `Reject` on a separate test indent and confirm the same live update behavior.
5. Click `Issue` and verify the backend status is updated to `Issued`.

## Rollout

1. Pilot one project site and one engineer for one week.
2. Run the app in parallel with the current paper or legacy process.
3. Reconcile the generated ledger with physical warehouse movement at week end.
4. Expand only after the pilot ledger matches site inventory.
