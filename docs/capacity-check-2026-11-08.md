# Owner-authorized capacity and checkout check - 2026-11-08

Production application revision: `f8c48876ee319e0ee977f343a7d620e1a558698e`.
The application and its access protections were not changed by this check.

## Measured results

| Check | Result | Scope |
| --- | --- | --- |
| Read-only HTTP load, 50 clients, 120 seconds | 700 HTTP 200 responses; zero transport or server errors | Maximum 50 in-flight requests, mixed storefront/API routes |
| Semantic response check, 50 clients, 60 seconds | 350 HTTP 200 responses; zero content/transport/server errors | JSON shape and storefront/JavaScript content checked |
| Load during a real checkout, 50 clients, 60 seconds | 400 HTTP 200 responses; zero content/transport/server errors | One synthetic checkout committed inside this load window |
| Real synthetic customer journeys | Three orders persisted; totals, shipping, discount and selected shade matched | Two additional checkouts were outside the load windows |
| Email delivery | Each test reference had one owner message and one bilingual customer confirmation | All three customer messages were opened in the owner's mailbox |
| Direct security checks | 17 passed | Anonymous admin reads, tampered cookie, origin rejection, validation, headers and private source paths |
| Automated suite | 333 passed, zero failed | Includes two new isolated concurrency checks |

The first load window's sampled Cloudflare telemetry had wall-time p95 586 ms,
p99 653 ms and average CPU 7.84 ms. Sampling was 10%; these are not all-request
percentiles. End-to-end client p95 was 6.84-7.27 seconds and included a substantial
TLS connection delay also present without load. This is not a mobile performance
or Core Web Vitals measurement.

## Browser limitation

Fifty real-browser tasks were requested, but the external browser provider queued
them. Provider start/finish metadata showed a peak of two concurrent runs. This
does **not** demonstrate fifty simultaneous rendered browsers.

The provider's three checkout attempts returned the store's generic unauthorized
request message. They created no orders; this was checked before one direct-browser
submission per case. All three direct-browser cases succeeded. The precise provider
request difference was not established and origin protections were not relaxed.
One read-only run reported a verification challenge and stopped.

All synthetic orders were clearly marked as not for shipping and addressed only
to the owner's business contact. After invoice evidence was archived, the exact
three test orders and their items were removed in one guarded D1 batch and the
five deducted units were restored by quantity delta. No customer records were
included in this repository report.

## Re-running the read-only probe

```sh
python scripts/owner-capacity-check.py --clients 50 --seconds 120 --output /tmp/trend-capacity.json
```

Only the two existing owner-authorized storefront hosts are accepted. Limits are
50 clients and 180 seconds; no orders, logins, credential guesses, proxy changes
or configuration changes are made. Eight transport/server/content failures stop
new requests. The JSON contains request timing records but no customer data.
The first wave starts together; subsequent visits include three seconds of think
time. This is a bounded workload, not a throughput ceiling or a DDoS test.

## Isolated concurrency tests

`tests/concurrent-checkout.test.mjs` exercises the actual Worker handler against
an in-memory SQLite schema with serialized primary operations, atomic batches
and a mocked mail transport:

- Fifty distinct customers competing for three units produce three accepted
  orders and 47 conflicts, never negative stock or mail for rejected orders.
- Fifty retries using one idempotency key produce one saved order, one stock
  deduction, one mail dispatch and the same receipt for all callers.

These tests do not send fifty production orders or fifty emails.

## Recommended next checks

1. Durable notification outbox, bounded retries, deduplication and quota/failure alerts.
2. A staging environment with verified 50-browser concurrency, plus Safari/iPhone/4G measurements.
3. Availability/error/low-stock alerts and a tested database restore procedure.
4. Network-loss recovery, price/stock changes during checkout, and spreadsheet formula-injection review.

Passing these bounded checks does not establish unlimited capacity or a complete
penetration-test result.
