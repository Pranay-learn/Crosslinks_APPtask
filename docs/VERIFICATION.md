# Verification and release boundaries

GitHub Actions is the execution environment for this repository. Checks use committed lockfiles and a real PostgreSQL 16 test database; the workflow has repository read access and never pushes changes automatically.

The delivery workflow runs:
- Expo TypeScript checking and web export.
- Backend/web TypeScript checks and production builds.
- Unit tests plus PostgreSQL authentication, authorization, persistence, privacy and native API integration tests.
- Six community browser workflows and five browser workflows against the live PostgreSQL API.
- Three Expo mobile-web workflows, including discussion/reply/bookmark behavior, student admin restrictions, official publishing, offline close/reopen and reconnection.

A deployment is verified only after this workflow is green and the published URL's HTTP check succeeds. A previous run or an authored test is not evidence for untested later source changes. The repository Actions page contains the current source commit and fresh check results.

## Additional manual release checks

Native Android/iOS binaries, physical-device force-close behavior, system permissions, local notifications, FCM/APNs/Expo push delivery, timezone changes, real Google consent and actual university integrations require configured devices/accounts. Browser tests exercise the Expo UI and browser storage; native SQLite/OS behavior still needs the Maestro/device workflow in docs/MOBILE.md.

The backend and migration paths are integration-tested. The optional Docker definition needs a build on the selected host; a TypeScript build does not establish container readiness.

The hosted demonstration uses fictional sample content and explicit demo roles. Those roles cannot access the production API. Production setup instructions are in docs/MOBILE.md, docs/backend.md and docs/DEPLOYMENT.md.
