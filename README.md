# ContinuityBuddy

Privacy-first, static GP continuity and usual-GP reciprocal swap proposal tool. **Not approved for use with real NHS patient records until local information governance and clinical safety sign-off.**

## Application

Open `index.html` via a local static server, or deploy the exact reviewed static files under HTTPS. No database, server-side patient processing, tracking or third-party runtime libraries.

For local development:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
# open http://127.0.0.1:8765/
```

All imported EMIS IDs and matches remain in tab memory. Reports are explicitly downloaded or printed, never auto-synced. The clear function removes app state and visible data; it does not securely erase OS/browser memory or previously downloaded files. The public site is just code; ordinary asset requests still reach Cloudflare.

## EMIS export workflow

Follow the in-app instructions for three patient searches per GP (A: current usual GP; B: more than 3 recorded consultations with that GP in last year; C: no consultation entries with that GP in last year). Ensure every GP in scope has all three cohorts and every search uses the same date window.

The exact EMIS internal ID field **has not been confirmed** as exportable through a standard EMIS List Report. The app requires a one-column CSV headed exactly `EMIS Number`, with 1-15 digits on each row; unlabelled columns, NHS-number headings, names, DOB, addresses and other data are rejected. Numeric-only content cannot prove an NHS number was not mislabelled; a user must attest that the file was sourced from the correct internal EMIS field. **Do not rename an NHS-number export to bypass validation.**

Synthetic sample:
```csv
EMIS Number
00012345
00012346
```

Review patient preference, workload, ongoing care, complexity and accuracy of consultation entries. A 4+ recorded-entries cohort is **not** proof of four clinical encounters or of the most-seen GP. The matching engine considers only imported cohorts, blocks incomplete/contradictory records and proposes balanced reciprocal swaps only for review. Never makes changes to EMIS.

## Offline, updates and security

A same-origin service worker caches a fixed reviewed public shell, not patient data. On a secure origin, install the app while online, wait for the offline shell to cache, then open it offline. No forced takeover of running tabs. After a new release, close all old ContinuityBuddy tabs before using the updated version. An old cache may remain until an update activates.

The hosted code can be tampered with by compromised maintainers or hosting provider; PWA support does not solve supply-chain trust. Practices must authorise their environment and user workflow before using real data.

## Testing

```sh
node --test test.mjs
node browser-test.mjs
```
Browser test uses synthetic IDs and requires Chromium or Google Chrome installed; set `CHROME_PATH` if necessary. It checks the import-to-export workflow, patient-data-free requests, local storage, Clear, async race, and offline reload.

See [Security](SECURITY.md) and [Governance](GOVERNANCE.md) for fuller risk, privacy and UK GDPR/DCB considerations. [Privacy page](privacy.html).

## Publication and provenance

The source should be public **after security review and Git history scan**, while real exports must never enter GitHub. The separately deployed preview Worker uses only synthetic test datasets. Promote only a reviewed commit.
