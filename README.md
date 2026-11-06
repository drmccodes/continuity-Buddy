# ContinuityBuddy

Privacy-first, browser-only GP continuity and reciprocal usual-GP swap proposal tool.

## Start

Serve the directory on a local, practice-approved computer (ES modules require HTTP):

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765`. No install, dependencies, analytics, remote calls, backend, account or persistence. Do not place actual patient data in the repository. Hosting the **code only** as a static site is technically possible, but practice IG approval is needed before use with any real patient identifiers.

## EMIS workflow

Follow the in-app instructions to make three searches per GP: (A) usual GP is Dr X, (B) more than three consultations authored by Dr X in the past year, (C) no consultations authored by Dr X in the past year. Export each patient set to an EMIS number-only CSV, then associate the file with its category and GP in the app. This is *not* a live integration with EMIS.

**Unverified EMIS capability:** Published walkthroughs confirm List Reports and CSV export, but describe the **NHS number** field, not an EMIS-internal patient identifier. We have not verified that a standard EMIS List Report can export that internal number. Never rename NHS numbers to EMIS numbers. If the EMIS identifier is unavailable for export, obtain an approved EMIS-native method or use approved pseudonymised IDs (a future explicitly configured version may support these). Avoid exporting identifiable records as a workaround.

## CSV format

Single column (header optional):

```csv
EMIS Number
123456
456789
```

No names, NHS numbers, dates of birth, addresses, postcodes, or consultation information. The parser rejects extra columns, unrecognised headers, non-digit values and excessive files. Numeric-only identifiers cannot be definitively differentiated from a mislabelled NHS number: operators **must** confirm the source was the EMIS internal ID. EMIS numbers are still personal data when linkable to a person. File content is read locally; do not upload to an unapproved site.

## Matching

A candidate must have one known usual GP, a membership in that GP's 'not seen' cohort, and membership in **exactly one other GP's** 4+ consultation cohort. Reciprocal swaps are paired by current and proposed GP in both directions; pairs keep GP patient-list counts unchanged. The algorithm does not identify the actual most-seen GP, does not infer suitability, and cannot judge workload or clinical complexity. If more than one alternative GP qualifies, the patient is withheld rather than guessed. A patient included in two different owner cohorts is excluded and flagged. Unmatched candidates are shown separately. All outputs are **proposals for review**.

## Security design

- Zero dependencies or external scripts, fonts, APIs, analytics, storage, service workers or cookies.
- Content security policy `connect-src 'none'` and `default-src 'none'`.
- Patient identifiers are never written to localStorage or remote services.
- No direct HTML injection of imported values; UI uses `textContent`.
- Proposal CSV exported locally; treat exported reports as confidential and store only in approved systems.
- Deliberately no server-side handling, EMIS automation, batch edits or automatic patient reassignment.

## Verification

`node test.mjs` tests CSV rejection, uniqueness, pairing and ambiguous alternative GP handling. These are logic checks, not a clinical safety case or EMIS integration test. Real-world use requires practice IG/clinical safety sign-off and validation against local EMIS export conventions.

## Evidence

- [EMIS roadshow reporting overview](https://storage.googleapis.com/eng-app-storage/ebdd0cbc-5fc6-11eb-a30c-6eb0c21e005c/media/original/ac1aa1b8-fef0-11ed-b902-8a11eb4bd7e6)
- [EMIS List Report and CSV walkthrough](https://support.engagehealth.uk/support/solutions/articles/48001212601)
- [NHS England guidance on NHS number as identifier](https://digital.nhs.uk/data-and-information/information-governance/guidance/nhs-numbers-as-identifiers)
