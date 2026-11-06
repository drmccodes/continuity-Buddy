# ContinuityBuddy: clinical safety and information governance review (draft)

**Status: development assurance evidence, NOT organisational sign-off.** Updated 6 November 2026. This file must be reviewed by the practice/PCN clinical safety lead and information-governance lead before any real-patient use. No staff member should send or attach a genuine identifiable EMIS export to ChatGPT, GitHub or external testing services.

## Intended use and boundaries
A browser-only aid to identify possible improvements to usual GP allocation using attended EMIS appointment records. It does not verify actual consultation content, issue prescriptions, alter patient records, or automatically recode patient allocations. Every suggestion must undergo independent human review in EMIS.

**Recommended real-data deployment:** Save the standalone `ContinuityBuddy-Offline.html` file to an approved NHS-managed location using a managed NHS browser, disconnect from the internet for processing, and open the file locally. Do not permit patient data in cloud-sync personal directories or third-party browser extensions. Use encrypted approved storage for exported review CSVs and delete originals under the organisation's retention policy.

## Threat model and mitigations

| Risk | Mitigation present | Residual validation |
| --- | --- | --- |
| Confidential CSV sent to application server | No uploads or network data API; offline edition runs as local file; CSP `connect-src 'none'` | Inspect browser network console on target NHS managed browser; verify no extensions, external hooks or browser crash reporting capture content |
| Third-party library supply chain compromise | Zero external scripts/libraries; standalone edition embeds complete code and CSS with SHA-256 CSP hashes | Verify published static artifact against audited Git commit; controlled release, source integrity verification |
| Accidental demographic/clinical exports | Header allowlist rejects unexpected or extra columns, including NHS number/name/notes | Verify actual EMIS search schema and ensure no sensitive data embedded in allowed field values |
| XSS through imported identifiers/GP names | DOM updates use textContent and safe element creation; no imported innerHTML; no `eval` | Browser test malicious CSV and threat review |
| CSV formula injection in downloaded proposal | Leading formula characters neutralised when exporting | Test with LibreOffice / Excel (approved local sandbox only) |
| Patient data stored in browser | No persistence APIs or service worker; in-memory objects reset on clear/close | Remember that browser memory cannot be guaranteed immediately erased by JavaScript/OS; clear and close after use |
| Malicious or incomplete/overlarge files | Max 60 MB input, max 500,000 rows, CSV structure and column limits, no external parsing | Performance test on representative synthetic large dataset; browser memory limits |
| Incorrect clinician mapping | Clinician-review confirmation, optional exclusion and aliasing, likely non-list holder default if never seen as usual GP | Test locums, registrars, departing GPs, varied staff titles against local workflow |
| False-positive usual GP swaps | Require distinct qualifying GP, minimum contacts/thresholds and bilateral explicit approval | Validate against manually audited sample records and patient preferences |
| Unsupported EMIS changes | Published XML bundled unchanged; instructions match its column headings | Verify actual import and attended appointments report on local EMIS installation |
| Misleading list balancing | Registered list denominators require separate whole-list import; clinician sessions optional | Verify sessions and list counts against practice official figures |
| Public site compromised | Local offline copy avoids loading remote scripts when analysing patient data | Organisational approved distribution/update strategy, do not use internet-hosted site for real-data analysis without separate approval |

## Clinical hazard log (draft)
1. **Incorrect swap to wrong GP:** tie, administrative user, missing or conflicting usual GP. Mitigate with exclusions, no automatic EMIS changes, explicit review against clinical record, patient choice and GP capacity.
2. **False confidence in continuity:** attended appointment records are an imperfect proxy for meaningful clinical encounters. Disclose this, provide raw counts, and avoid certainty labels as clinical judgements.
3. **Missing patients:** patients without attended appointments do not appear in consultation export. Use separate registered list for denominator; never call seen-patient subset the complete practice population.
4. **Data quality / mapping error:** validate exact imported column headings, block unidentified extra fields, flag empty IDs and inconsistent rows.
5. **Skew from same-day appointments:** same-day records may be distinct attended appointments or report duplicates. The application retains them, flags potential duplicates, and requires local validation to establish the appropriate interpretation.
6. **Incorrect session-equity assessment:** clinical sessions vary in workload and role. Patient-per-session is an advisory proxy only.

## Approval requirements
- Determine applicability of **DCB0129** (developer clinical risk management) and **DCB0160** (practice deployment and use), with a responsible clinical safety officer; NHS guidance: https://digital.nhs.uk/services/clinical-safety/clinical-risk-management-standards
- Local Data Protection Officer / Caldicott Guardian or designated IG lead to review processing basis, retention, file location, browser management, incident handling and staff training.
- Validate the specific installed EMIS XML search and export against approved **synthetic** records and clinician types.
- Reproduce metrics independently against an approved local test fixture, including clinically reviewed outputs.
- Record release version, SHA-256 checksum of offline HTML, approved browser versions and a secure update procedure.

## Current testing statement
- Pure analyser and schema tests exist but are not sufficient for sign-off.
- One-file offline package has a strict hash-based inline script/style CSP, embeds both XML searches and does not depend on external code.
- No genuine patient-level export has been received or tested here.
- Application intentionally does **not** send, persist or automatically amend records; however, absolute claims that compromise is 'structurally impossible' are unwarranted for a managed endpoint that may contain extensions, logs, cache, malware or vulnerable software.

**Decision:** Suitable for **synthetic test data** only until the above clinical-safety and IG approvals are recorded. Approval can be proportionate; it must nevertheless be made by the responsible NHS organisation.
