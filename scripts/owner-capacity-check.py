#!/usr/bin/env python3
"""Bounded, read-only HTTP capacity check of the owner's two Trend Shop hosts.

This measures HTTP clients, not rendered browsers. It never submits an order,
authenticates, changes network identity, or changes production configuration.
"""
import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
import math
from pathlib import Path
import subprocess
import tempfile
import threading
import time

parser = argparse.ArgumentParser()
parser.add_argument('--base', default='https://trendjo.pages.dev')
parser.add_argument('--clients', type=int, default=50)
parser.add_argument('--seconds', type=int, default=120)
parser.add_argument('--output', required=True)
args = parser.parse_args()
if args.base not in ['https://trendjo.pages.dev', 'https://trend-shop-jo.trend-shop-jo.workers.dev']:
    parser.error('Only the two owner-authorized Trend Shop hosts are permitted.')
if not 1 <= args.clients <= 50 or not 10 <= args.seconds <= 180:
    parser.error('Maximum: 50 HTTP clients for 180 seconds.')

started = time.time()
deadline = started + args.seconds
gate = threading.Barrier(args.clients)
lock = threading.Lock()
stop = threading.Event()
records = []
active = maximum_active = failures = 0
routes = ['/api/catalog', '/p/TS0047', '/', '/app.js', '/api/site-settings', '/p/TS0088']
fmt = '{"status":%{http_code},"ttfb_s":%{time_starttransfer},"tls_s":%{time_appconnect},"duration_s":%{time_total},"bytes":%{size_download},"content_type":"%{content_type}"}'
body_directory = tempfile.TemporaryDirectory(prefix='trend-qa-http-')

def visit(client, iteration):
    global active, maximum_active, failures
    path = routes[(client + iteration) % len(routes)]
    begin = time.time()
    with lock:
        active += 1
        maximum_active = max(maximum_active, active)
    body_path = Path(body_directory.name) / f'client-{client}.body'
    result = subprocess.run([
        'curl', '--silent', '--show-error', '--compressed', '--max-time', '25',
        '--output', str(body_path), '--write-out', fmt,
        '--header', 'User-Agent: Trend-Shop-Owner-QA/1.0',
        '--header', 'X-Trend-QA: bounded-read-only-capacity-check',
        args.base + path,
    ], capture_output=True, text=True)
    try:
        data = json.loads(result.stdout)
    except ValueError:
        data = {'status': 0, 'duration_s': time.time() - begin, 'ttfb_s': 0, 'tls_s': 0, 'bytes': 0}
    data['after_tls_s'] = max(0, data['ttfb_s'] - data['tls_s'])
    try:
        body = body_path.read_text()
        if path == '/api/catalog':
            payload = json.loads(body)
            semantic_ok = payload.get('storeLive') is True and len(payload.get('products', [])) > 0
        elif path == '/api/site-settings':
            semantic_ok = isinstance(json.loads(body).get('settings'), dict)
        elif path == '/app.js':
            semantic_ok = 'javascript' in data.get('content_type', '') and len(body) > 1000
        else:
            semantic_ok = '<title>' in body and 'Trend Shop' in body and '<main' in body
    except (ValueError, OSError, AttributeError):
        semantic_ok = False
    semantic_ok = semantic_ok and data['status'] == 200
    data['semantic_ok'] = semantic_ok
    row = {'client': client, 'iteration': iteration, 'path': path,
           'start_utc': datetime.fromtimestamp(begin, timezone.utc).isoformat(),
           'end_utc': datetime.now(timezone.utc).isoformat(), **data}
    if result.returncode:
        row['transport_error'] = result.stderr[:200]
    with lock:
        active -= 1
        records.append(row)
        if data['status'] >= 500 or result.returncode or not semantic_ok:
            failures += 1
            if failures >= 8:
                stop.set()
        if len(records) % 100 == 0:
            print(json.dumps({'completed': len(records), 'active': active,
                              'maximum_active': maximum_active, 'failures': failures}), flush=True)

def client_flow(client):
    gate.wait()
    iteration = 0
    while time.time() < deadline and not stop.is_set():
        visit(client, iteration)
        iteration += 1
        # Model browsing think time between independent HTTP client requests.
        stop.wait(3)

with ThreadPoolExecutor(max_workers=args.clients) as pool:
    list(pool.map(client_flow, range(args.clients)))

def percentile(values, p):
    values = sorted(values)
    return round(values[max(0, math.ceil(len(values) * p) - 1)] * 1000, 1) if values else None

summary = {
    'test_type': 'independent HTTP clients; not browser sessions',
    'base': args.base, 'clients': args.clients, 'maximum_in_flight': maximum_active,
    'started_utc': datetime.fromtimestamp(started, timezone.utc).isoformat(),
    'finished_utc': datetime.now(timezone.utc).isoformat(),
    'elapsed_seconds': round(time.time() - started, 2),
    'requests': len(records), 'statuses': dict(Counter(str(x['status']) for x in records)),
    'server_errors': sum(x['status'] >= 500 for x in records),
    'transport_errors': sum('transport_error' in x for x in records),
    'semantic_errors': sum(not x['semantic_ok'] for x in records),
    'stopped_early': stop.is_set(),
    'latency_ms': {f'p{int(p*100)}': percentile([x['duration_s'] for x in records], p) for p in [.5, .95, .99]},
    'ttfb_ms': {f'p{int(p*100)}': percentile([x['ttfb_s'] for x in records], p) for p in [.5, .95, .99]},
    'tls_ms': {f'p{int(p*100)}': percentile([x['tls_s'] for x in records], p) for p in [.5, .95, .99]},
    'after_tls_ms': {f'p{int(p*100)}': percentile([x['after_tls_s'] for x in records], p) for p in [.5, .95, .99]},
    'by_path': {},
}
for path in routes:
    rows = [x for x in records if x['path'] == path]
    summary['by_path'][path] = {
        'requests': len(rows), 'statuses': dict(Counter(str(x['status']) for x in rows)),
        'latency_p95_ms': percentile([x['duration_s'] for x in rows], .95),
        'ttfb_p95_ms': percentile([x['ttfb_s'] for x in rows], .95),
        'after_tls_p95_ms': percentile([x['after_tls_s'] for x in rows], .95),
    }
target = Path(args.output)
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps({'summary': summary, 'requests': records}, ensure_ascii=False, indent=2))
body_directory.cleanup()
print(json.dumps(summary, ensure_ascii=False), flush=True)
