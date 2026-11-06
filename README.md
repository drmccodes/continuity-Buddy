# ContinuityBuddy

Privacy-first browser-only GP continuity and reciprocal usual-GP reallocation review tool.

**Status:** Privacy-hardened testing edition; still requires local NHS information-governance and clinical-safety authorisation before real-patient use. The standalone offline file has not been benchmarked with a genuine practice EMIS dataset.

## NHS workstation: recommended workflow

1. Download [ContinuityBuddy-Offline.html](./ContinuityBuddy-Offline.html) from the public site onto an approved, managed NHS device and store it in an approved location.
2. Open the file locally in a supported browser. It contains the whole application and both EMIS XML searches; it does not depend on network access. For the strongest practical assurance, disconnect the device from the internet while processing the patient export (where NHS device policy allows).
3. Download and import the bundled original EMIS search XML using authorised EMIS reporting privileges. Run the attended-appointments search, export a CSV with **replicate patient details** and **replicate usual GP**, then import into the standalone file.
4. The tool rejects unexpected CSV columns such as patient names, NHS numbers, DOB, diagnoses and free text. Verify report origin and clinician statuses before analysing. Do not manually redact or modify the XML output if it already contains only the five expected columns.
5. Review every patient proposal against the clinical record and patient preference. Download only approved pairs to NHS-managed storage, then clear the app and close the tab.

**Limitations:** CSV cells in allowed fields must still contain only the expected identifiers and GP/date values. The browser’s no-network policy controls the application, not browser extensions, the operating system or compromised endpoint processes. The offline HTML is a reproducible static build generated with `node tools/build-offline.mjs`; its JavaScript and CSS are restricted by SHA-256 hashes in a strict CSP. No third-party runtime libraries are used.

See [SAFETY-CASE.md](./SAFETY-CASE.md) for the threat model, hazard log and local sign-off requirements.

## Run

From this repository root on a practice-approved machine:

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Visit http://127.0.0.1:8765. No build, third-party dependencies, accounts, database, analytics, cookies, backend or patient-data API. The Content Security Policy disallows outgoing connections.

## EMIS workflow

1. Download the locally hosted [original EMIS attended-appointments search XML](./downloads/Usual_GP_Continuity_Search.xml), created by [Dr Neil Paul](https://www.drneilpaul.blog/usualgp/). This is an unchanged copy of the author's original search, not a ContinuityBuddy-created query; do not assume it is independently audited or supported by EMIS.
2. Import into EMIS Web > Reporting > Population Reporting > Import, subject to your practice's EMIS reporting permissions and local NHS IT policies.
3. Run the patient search and consultation report, and export the second as CSV.
4. Tick **Replicate patient details for each item** and **Replicate Usual GP details**; do not override hidden patients without explicit authorisation.
5. Drop that CSV into ContinuityBuddy, verify the mapping, review clinician statuses and run the analysis.
6. Optionally import the [unchanged companion list-size search](./downloads/Usual_GP_List_Sizes_Search.xml) report CSV to calculate full registered list sizes and patients per GP session.

[Original author instructions](https://www.drneilpaul.blog/usualgp/how-to.html).
EMIS XML search import is also documented by [CDRC](https://cdrc.nhs.uk/resources/emis-resource-centre/cdrc-emis-access/).

**NHS PC compatibility:** EMIS supports XML imports, but capability depends on EMIS permissions, browser policy and local approval. We have not tested this specific XML in Killick Street EMIS. Never place patient identifiable data in GitHub, chats or test fixtures.

## XML provenance and attribution

Thanks to **[Dr Neil Paul](https://www.drneilpaul.blog/usualgp/)** for creating and sharing the EMIS searches. Both files are reproduced unchanged in `downloads/` as a convenience for practices; EMIS schema is `32.0.0`. The main export defines patient ID, Usual GP Full Name, Appt. Date, Staff Member's Full Name and session-holder user type, filtered to attended appointments. ContinuityBuddy auto-maps these headings. No improvements to the XML itself were introduced, because the existing attended-appointment and GP-user filtering is preferable to guessing or weakening those settings without a live EMIS validation test. Redistribution licensing terms were not explicitly located; original ownership remains with the author and permission should be confirmed for ongoing republication.

## What the numbers mean

- **Mean most-seen UPC** = the mean of each eligible frequent attender's greatest clinician share. It is not an improvement caused by recoding.
- **Usual GP accuracy** = percentage aligned among patients with a clear pattern and an eligible alternative; fragmented patients are excluded from the denominator. A local decision-support metric, not an externally validated gold standard.
- **SLICC** = clinical contacts attributed to the recorded usual GP / all retained clinical contacts, across the consultation export.
- **Reciprocal pairs** = one patient with current usual GP A who predominantly sees B, paired with one patient in the opposite direction. These are unapproved candidate reallocations, not proven appropriate swaps.
- **Patient list counts from the consultation CSV** include only patients seen in the extract, and must not be used as complete registered-list denominators.
- A separate whole-list export enables registered-list counts and sessions-weighted workload metrics.
- Identical-looking same-day appointment rows are **retained**, not silently deduplicated. The application flags their count because they could be genuine separate appointments or duplicated report records; inspect local EMIS report behaviour before interpreting absolute attendance counts.

Clinician statuses: **Eligible list holder**, **Count visits, no list**, **Exclude**, **Departed**. Automated systems and triage roles need manual verification. A clinician marked non-list still counts towards appointments/UPC but is not recommended as a new usual GP.

**Human review is compulsory:** review patient choice, safeguarding/complexity, active treatment, clinical suitability and workload. The app cannot and must not bulk edit EMIS. CSV export requires explicit approval of both people in each reciprocal pair, plus a confidentiality warning.

## Security boundaries

- All CSV content is processed in browser memory. No patient identifiers in local/session storage, IndexedDB, cookies, server logs or network calls.
- No external scripts, CSS, fonts or libraries. Links to the EMIS XML and guidance open third-party websites *by explicit user action*; patient data is not sent to them by the application.
- Downloaded proposal CSV files contain confidential identifiers and must be kept on approved NHS storage and deleted according to local retention policy.
- This is not a guarantee against compromised devices, browser extensions, supply-chain modification or unauthorised local access. Practice IG approval and clinical safety validation are required.
- Offline use currently requires serving downloaded source code locally; a PWA, offline update strategy and deployment security review remain outstanding.

## Testing

```bash
node test.mjs
node test-v2.mjs
node test-import-security.mjs
python3 benchmarks/reference.py
node tools/build-offline.mjs
```

The regression tests cover representative consultation CSVs, rejected unnecessary identifiers/clinical fields, date handling, excluded appointments, continuity metrics, reciprocal pairs and spreadsheet formula injection. A separately implemented Python benchmark checks synthetic reference values. Full browser E2E tests, a real EMIS sample verified locally, large dataset performance and clinical/IG sign-off remain outstanding.

## Independent references

- [RCGP One Care continuity toolkit](https://elearning.rcgp.org.uk/mod/book/view.php?chapterid=537&id=12895)
- [RCGP SLICC](https://www.rcgp.org.uk/getmedia/d30f95ff-c97d-44de-b91b-927e6c6b6972/Personal-lists-guide.pdf)
- [Bristol Continuity of Care Calculator](https://www.bristol.ac.uk/primaryhealthcare/resources/continuityaudit/index.html)
- [Dr Neil Paul's browser-based analyser](https://www.drneilpaul.blog/usualgp/)

These tools inspired the functionality; no third-party code or branding was copied.
