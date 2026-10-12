# Deployment

The GitHub delivery workflow runs TypeScript checks, unit tests, real PostgreSQL API integration tests, web browser tests, live-API browser tests, and the Expo mobile-web build/tests before publishing the fictional demonstration to GitHub Pages.

Enable Settings > Pages > Source > GitHub Actions once. GitHub's workflow token cannot create the Pages site because creation requires repository administration rights. The workflow uses repository read access and Pages deployment access; it never automatically pushes source changes.

The web demonstration is hosted at the project's Pages root. The Expo-rendered mobile demonstration is hosted under /native/. Treat URLs as live only after the deployment job and HTTP checks pass.

The Pages build uses demo mode and cannot contact a production database or authenticate simulated users against the API. It caches public application assets for offline reload; protected API responses are excluded.

For live backend deployment, follow docs/deploy-vercel.md for Vercel/Neon or run the compiled Node API behind HTTPS with PostgreSQL. Run npm run db:migrate as a release job and run npm run start:worker in a persistent worker/container service for remote pushes. Vercel request functions alone cannot host a continuous polling worker; deploy that process separately.

Required backend settings: DATABASE_URL, CLIENT_ORIGIN, API_ORIGIN, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, ADMIN_EMAILS, MOBILE_REDIRECT_URIS, DEVICE_TOKEN_KEY and NODE_ENV=production. Configure FCM/APNs/EAS as documented in docs/MOBILE.md. No real university data source is created automatically.

The OAuth callback must be registered exactly with Google. Native custom return schemes are allowlisted by the backend. Keep all secrets in the hosting secret store, not the mobile bundle or GitHub.

For staging, seed fictional content only with explicit SEED_DEMO_DATA=true. Back up the production database, preserve migrations, monitor worker failures/exhausted deliveries and retain audit history according to university policy.

Container API/worker option:

```sh
docker build -t nsut-connect-api .
# Apply migrations as a release job using the same protected runtime environment.
docker run --rm --env-file .env nsut-connect-api npm run db:migrate
# Put the API behind a configured HTTPS proxy; the host port below stays loopback-only.
docker run --env-file .env -p 127.0.0.1:3001:3001 nsut-connect-api
docker run --env-file .env nsut-connect-api npm run start:worker
```

The container definition is a deployment option. A Docker build is not established by TypeScript/browser CI alone and needs validation on the selected hosting service. PostgreSQL is provisioned separately.
