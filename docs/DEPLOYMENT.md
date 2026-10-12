# Deployment

The GitHub delivery workflow runs TypeScript checks, unit tests, real PostgreSQL API integration tests, web browser tests, live-API browser tests, and the Expo mobile-web build/tests before publishing the fictional demonstration to GitHub Pages.

Enable Settings > Pages > Source > GitHub Actions once. GitHub's workflow token cannot create the Pages site because creation requires repository administration rights. The workflow uses repository read access and Pages deployment access; it never automatically pushes source changes.

The web demonstration is hosted at the project's Pages root. The Expo-rendered mobile demonstration is hosted under /native/. Treat URLs as live only after the deployment job and HTTP checks pass.

The Pages build uses demo mode and cannot contact a production database or authenticate simulated users against the API. It caches public application assets for offline reload; protected API responses are excluded.

For live backend deployment, follow docs/deploy-vercel.md for Vercel/Neon or run the compiled Node API behind HTTPS with PostgreSQL. Run npm run db:migrate as a release job and run npm run start:worker in a persistent worker/container service for remote pushes. Vercel request functions alone cannot host a continuous polling worker; deploy that process separately.

Required backend settings: DATABASE_URL, CLIENT_ORIGIN, API_ORIGIN, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, ADMIN_EMAILS, MOBILE_REDIRECT_URIS, DEVICE_TOKEN_KEY and NODE_ENV=production. Configure FCM/APNs/EAS as documented in docs/MOBILE.md. No real university data source is created automatically.

The OAuth callback must be registered exactly with Google. Native custom return schemes are allowlisted by the backend. Keep all secrets in the hosting secret store, not the mobile bundle or GitHub.

For staging, seed fictional content only with explicit SEED_DEMO_DATA=true. Back up the production database, preserve migrations, monitor worker failures/exhausted deliveries and retain audit history according to university policy.
