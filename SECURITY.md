# Security policy

## Scope and privacy promise
Only public application assets are hosted. **Do not send real patient data, practice screenshots showing patient data, CSV exports or private clinical information in issues, pull requests, logs or email.** Use synthetic reproductions.

The site has no application API receiving patient information; browser-native processing nevertheless cannot protect against malicious/compromised application code, extensions, devices, network infrastructure or an already-downloaded report.

## Dependency and release controls
- Zero npm/runtime dependencies or third-party scripts.
- All public assets served from same origin with restrictive CSP.
- Service-worker shell cache contains only explicitly named application files, never uploaded files or exports.
- No `skipWaiting()` or `clients.claim()`; an updated service worker waits for older sessions to close.
- Service-worker cache version must increment after a reviewed change to the public application shell. Do not publish code during patient-data processing sessions.
- Release procedure: feature branch → synthetic unit/integration and browser network/offline tests → code review and documented change log → preview → signed-off deployment to production. Review generated Worker bundles too (a compromised hosting deployment can change delivered code).
- Keep repo public **only after** checking entire Git history, current branches, issues, workflows and gitignore for secrets/patient data. A current clean tree alone is not enough.
- Configure branch protection and two-factor authentication for maintainers; avoid exposing infrastructure secrets in CI.

## Reporting a vulnerability
Submit a private GitHub security advisory through the repository's Security tab if supported. Do not paste real patient identifiers into reports.

## Handling incidents
Practice users should follow their own information governance and incident response policies, preserve approved evidence, and assess ICO/NHS reporting requirements as appropriate.
