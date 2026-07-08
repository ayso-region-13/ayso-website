#!/usr/bin/env python3
"""
Out-of-area flow re-check (GA4).

Measures whether the find-your-region / out-of-area banner work is doing its
job: (1) how often visitors click through to AYSO's national Region Locator
(the `region_locator_click` GA4 event), (2) bounce rate on the home page and
/register/ split by California vs. non-California, and (3) views of
/register/find-your-region/.

Reuses the claude-seo plugin's OAuth credentials. BEFORE running, confirm the
GA4 property is ayso13 (307558725) — other projects on this machine clobber the
shared ~/.config/claude-seo/google-api.json (see memory feedback_check_seo_creds_first):

    cat ~/.config/claude-seo/google-api.json   # expect ga4_property_id 307558725

Usage:
    python3 site/scripts/ga4-outofarea.py [--days 28]
"""

import argparse
import glob
import os
import sys

# Reuse the claude-seo plugin's auth (OAuth token in ~/.config/claude-seo).
_seo = sorted(glob.glob(os.path.expanduser(
    "~/.claude/plugins/cache/*/claude-seo/*/scripts")))
if _seo:
    sys.path.insert(0, _seo[-1])
try:
    from google_auth import get_oauth_credentials, load_config
except ImportError:
    sys.exit("Could not import google_auth from the claude-seo plugin scripts.")

from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    DateRange, Dimension, Filter, FilterExpression, FilterExpressionList,
    Metric, RunReportRequest,
)

SCOPES = ["https://www.googleapis.com/auth/analytics.readonly"]


def client_and_property():
    cfg = load_config()
    pid = str(cfg.get("ga4_property_id", "")).strip()
    if pid != "307558725":
        print(f"WARNING: ga4_property_id is {pid!r}, expected 307558725 (ayso13). "
              "Creds may be clobbered — restore from .seo-creds backup before trusting output.",
              file=sys.stderr)
    creds = get_oauth_credentials(SCOPES)
    if not creds:
        sys.exit("No GA4 credentials.")
    return BetaAnalyticsDataClient(credentials=creds), pid


def run(client, pid, days, dims, mets, dim_filter=None, limit=100):
    req = RunReportRequest(
        property=f"properties/{pid}",
        date_ranges=[DateRange(start_date=f"{days}daysAgo", end_date="today")],
        dimensions=[Dimension(name=d) for d in dims],
        metrics=[Metric(name=m) for m in mets],
        dimension_filter=dim_filter,
        limit=limit,
    )
    return client.run_report(req)


def eq(field, value):
    return FilterExpression(filter=Filter(
        field_name=field, string_filter=Filter.StringFilter(value=value)))


def in_list(field, values):
    return FilterExpression(filter=Filter(
        field_name=field, in_list_filter=Filter.InListFilter(values=values)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=28)
    args = ap.parse_args()
    days = args.days
    client, pid = client_and_property()

    print(f"\n=== Out-of-area GA4 re-check — last {days} days (property {pid}) ===\n")

    # 1) region_locator_click event — total + weekly trend
    print("1) region_locator_click (click-through to AYSO national Region Locator)")
    r = run(client, pid, days, ["eventName"], ["eventCount", "totalUsers"],
            dim_filter=eq("eventName", "region_locator_click"))
    if not r.rows:
        print("   0 events in window (either no clicks yet, or event not firing).")
    for row in r.rows:
        print(f"   eventCount={row.metric_values[0].value}  users={row.metric_values[1].value}")
    r2 = run(client, pid, days, ["yearWeek"], ["eventCount"],
             dim_filter=eq("eventName", "region_locator_click"))
    if r2.rows:
        print("   by week (yearWeek: count): " +
              ", ".join(f"{row.dimension_values[0].value}:{row.metric_values[0].value}"
                        for row in sorted(r2.rows, key=lambda x: x.dimension_values[0].value)))

    # 2) Bounce rate on / and /register/ landing pages, CA vs non-CA (US only)
    print("\n2) Bounce rate by landing page — California vs. non-California (US sessions)")
    # NB: GA4 stores these landingPage values WITHOUT a trailing slash.
    for lp, label in [("/", "home /"), ("/register", "/register")]:
        r = run(client, pid, days, ["region"], ["sessions", "bounceRate"],
                dim_filter=FilterExpression(and_group=FilterExpressionList(expressions=[
                    eq("landingPage", lp),
                    eq("country", "United States"),
                ])), limit=200)
        ca_s = ca_b = 0.0
        non_s = 0.0
        non_bounced = 0.0
        for row in r.rows:
            region = row.dimension_values[0].value
            s = float(row.metric_values[0].value or 0)
            b = float(row.metric_values[1].value or 0)  # bounceRate is a ratio 0..1
            if region == "California":
                ca_s += s
                ca_b += b * s
            else:
                non_s += s
                non_bounced += b * s
        ca = f"{(ca_b / ca_s * 100):.1f}% (n={int(ca_s)})" if ca_s else "n/a"
        non = f"{(non_bounced / non_s * 100):.1f}% (n={int(non_s)})" if non_s else "n/a"
        print(f"   {label:12s}  CA bounce {ca}   |   non-CA bounce {non}")

    # 3) find-your-region page views
    print("\n3) /register/find-your-region/ views")
    r = run(client, pid, days, ["pagePath"], ["screenPageViews", "totalUsers"],
            dim_filter=eq("pagePath", "/register/find-your-region/"))
    if not r.rows:
        print("   0 views in window.")
    for row in r.rows:
        print(f"   views={row.metric_values[0].value}  users={row.metric_values[1].value}")

    print("\nBaseline (session 34, 14d around 2026-06-08 deploy): "
          "home non-CA bounce 66.2% (was 71.0%), /register non-CA 39.3%, "
          "find-your-region ~11 views/14d.\n")


if __name__ == "__main__":
    main()
