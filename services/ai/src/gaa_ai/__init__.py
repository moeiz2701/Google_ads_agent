"""gaa_ai — analysis + generation service for the Google Ads Agent.

Module 2 (Competitor & Market Analysis) lives here: scrape -> enrich (map) ->
aggregate (reduce) -> AnalysisObject. The pydantic schemas mirror the TS
backbone in packages/shared and must not drift from it.
"""

import os as _os


def _repair_ca_bundle_env() -> None:
    """Some Windows installers (e.g. PostgreSQL 17) set CA-bundle env vars to a
    path that does not exist on this machine. requests/httpx honor those vars, so
    a stale value breaks every outbound HTTPS call (notably the vision path, which
    downloads ad images). If a configured bundle is missing, fall back to certifi.
    """
    bad = False
    for var in ("CURL_CA_BUNDLE", "REQUESTS_CA_BUNDLE", "SSL_CERT_FILE"):
        path = _os.environ.get(var)
        if path and not _os.path.exists(path):
            del _os.environ[var]
            bad = True
    if bad:
        try:
            import certifi

            _os.environ.setdefault("SSL_CERT_FILE", certifi.where())
            _os.environ.setdefault("REQUESTS_CA_BUNDLE", certifi.where())
        except Exception:  # noqa: BLE001 — certifi missing is non-fatal; libs use defaults
            pass


_repair_ca_bundle_env()

__version__ = "0.1.0"
