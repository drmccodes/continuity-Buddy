# Governance and clinical release checklist

**Status: PRE-CLINICAL REVIEW - NOT APPROVED FOR REAL PATIENT DATA.**

## Data flow

| Event | Patient data in browser | Data leaves browser |
|---|---|---|
| Open web app | None | Ordinary HTTPS asset requests: IP, user agent, time, path and hosting/network metadata |
| Local CSV import | Internal EMIS ID, GP cohort and membership in RAM | None via application code |
| Analyse | Derived candidate lists, reciprocal pairs and review statuses in RAM | None via application code |
| Print/export | Selected ID, old GP, proposed GP, review status | None to application provider; report downloaded/printed on user's device |
| Clear all | JS references, DOM tables and generated object URLs cleared | None; no secure destruction guarantee |
| Offline launch | Cached versioned public app shell only | No ordinary requests needed if shell installed successfully |
| Check for updates | No patient data | HTTPS request for newer public application code |

No cookies, localStorage, sessionStorage, IndexedDB patient records, server-side uploads, APIs, LLMs, analytics or automated EMIS edits. Browser extensions, endpoint malware, malicious replacements of hosted code and operating-system handling are outside what a webpage can fully prevent. This is security architecture, **not** a certification.

## Responsibilities

The using GP practice is normally the controller deciding the intended purpose, lawful basis, Article 9 condition, fair processing, access controls, staff training, DPIA, retention, confidentiality obligations and whether continuity-based usual-GP reassignment is clinically justified. The developer's supply of code without access to uploaded personal data does not itself establish that the developer processes that data for the practice. Legal roles depend on actual operations and agreements. The hosting provider receives ordinary website access metadata.

No real patient CSV should be used until the practice's IG lead / DPO, appropriate clinical safety lead and operational owner have reviewed and authorised the workflow. Apply the principle of least privilege to the approved device and to exported reports. Keep reports only in approved clinical/practice systems.

## DPIA screening / decision record (complete locally)

1. Processing purpose, necessity and alternative workflow.
2. Sources: EMIS internal patient ID and GP-level recent consultation cohort membership; check source field availability.
3. Volume, number of practices, clinical context, data subjects and vulnerability.
4. Data flows and hosting IP/technical metadata, no user-content upload in code and service-worker caches.
5. Article 6 basis, Article 9 condition (if health-data inference applies), confidentiality, transparency and secondary-use assessment.
6. Proportionality, human review, patient preference, fairness, potential bias, workload, error correction and retention.
7. Threats: malicious files, wrong NHS-vs-EMIS identifier, browser compromise, deployment compromise, exported reports, OS artefacts, incomplete GP cohort data, staff errors.
8. Controls: device policy, restricted browser extensions, HTTPS, content security policy, reproducible release review, code branch protection, no external deps, local-only processing, synthetic-data tests, secure export handling.
9. Residual risk owner, review date, approval and evidence references; DPIA required if likely high risk (consult ICO criteria).
10. Screen for common law duty of confidentiality, NHS records management and UK GP contractual/professional obligations.

## Clinical safety applicability

The tool changes recommendations about usual GP allocations and could influence patient access and continuity of care. **Treat DCB0129 (software developer/manufacturer) and DCB0160 (practice deployment/use) as relevant for formal clinical-safety applicability assessment**. Neither is discharged by saying the software is client-only or decision support. Establish CSO ownership, intended use, hazard log, risk controls, testing evidence and appropriate safety case before clinical deployment.

Initial hazard log entries:
- H1 wrong patient identifier / NHS number inadvertently exported → require explicit internal-EMIS source attestation; retain no PII; manually validate EMIS export.
- H2 missing GP cohort or mismatched reporting windows → block incomplete A/B/C collections, require coverage/window confirmation; final human check.
- H3 consultation records mistaken for actual patient conversations → label as counts of records, not clinical contact; clinical review.
- H4 swap alters complex care / patient preference / workload unfairly → decision-support only; explicit clinician approval; no EMIS write access.
- H5 data leakage through browser / downloads / tampered deployment → CSP, offline reviewed shell, restricted assets, network tests; local IG device/export controls.
- H6 data leaks from logs, telemetry or screenshots → no telemetry, no patient value in errors; browser/OS controls remain with practice.

## External authority
- ICO: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/data-protection-impact-assessments-dpias/when-do-we-need-to-do-a-dpia/
- ICO controllers/processors: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/controllers-and-processors/controllers-and-processors/what-are-controllers-and-processors/
- ICO special category data: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/a-guide-to-lawful-basis/special-category-data
- NHS England DCB0129/DCB0160: https://digital.nhs.uk/services/clinical-safety/clinical-risk-management-standards
- NHS England digital clinical safety assurance: https://www.england.nhs.uk/long-read/digital-clinical-safety-assurance/
