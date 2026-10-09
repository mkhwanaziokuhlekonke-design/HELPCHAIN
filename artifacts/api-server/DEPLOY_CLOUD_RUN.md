# Deploy the HelpChain API to Google Cloud Run from GitHub

The API is in this pnpm monorepo. The root `Dockerfile.api` builds it with the workspace lockfile, and `.github/workflows/deploy-api-cloud-run.yml` builds the container and deploys it when API-related changes are pushed to `main`.

## 1. Create Google Cloud resources

Use the same Google Cloud project that owns Firebase project `helpchain-app-e8235` (or a Google Cloud project with access to it). In Google Cloud Console, select that project, confirm billing is enabled, and enable:

- Cloud Run API
- Artifact Registry API
- Secret Manager API
- IAM Service Account Credentials API

Create an Artifact Registry Docker repository in your chosen region. The workflow expects its repository name in the GitHub variable `GCP_ARTIFACT_REGISTRY`.

Create two service accounts:

- **Deploy account**: GitHub Actions impersonates this account through Workload Identity Federation. Grant it `roles/run.admin`, `roles/artifactregistry.writer`, and `roles/iam.serviceAccountUser` on the runtime account.
- **Runtime account**: Cloud Run uses this account to access secrets. Grant it `roles/secretmanager.secretAccessor` for each HelpChain API secret below.

## 2. Create the API secrets in Secret Manager

Create a secret for each value below in the same Google Cloud project. Add the actual value as a secret version. Do not commit these values or add them to the Expo app's `.env`.

| Secret ID                            | Value                                                                   |
| ------------------------------------ | ----------------------------------------------------------------------- |
| `helpchain-firebase-service-account` | Private service-account JSON for Firebase project `helpchain-app-e8235` |
| `helpchain-email-otp-secret`         | Random secret, at least 32 characters                                   |
| `helpchain-smtp-host`                | SMTP provider hostname                                                  |
| `helpchain-smtp-port`                | SMTP port, commonly `587`                                               |
| `helpchain-smtp-secure`              | `true` or `false`, as required by your provider                         |
| `helpchain-smtp-user`                | SMTP username                                                           |
| `helpchain-smtp-password`            | SMTP password                                                           |
| `helpchain-smtp-from`                | Sender name/address permitted by the SMTP provider                      |
| `helpchain-donation-expiry-secret`   | Separate random secret, at least 32 characters                          |

## 3. Configure GitHub Actions identity federation

In Google Cloud, create a Workload Identity Pool and GitHub OIDC provider restricted to your exact GitHub repository (`OWNER/REPOSITORY`). Map the `google.subject` and `attribute.repository` claims, and add a condition that allows only that repository. Grant the provider's repository principal `roles/iam.workloadIdentityUser` on the deploy service account.

Do not create or store a service-account key for GitHub Actions. Use the Google Cloud Workload Identity Federation setup for GitHub Actions and the `google-github-actions/auth` action.

In GitHub, open **Settings → Secrets and variables → Actions → Variables** and add:

| Variable                            | Value                                                                                                                 |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `GCP_PROJECT_ID`                    | Google Cloud project ID                                                                                               |
| `GCP_REGION`                        | Artifact Registry and Cloud Run region, e.g. `us-central1`                                                            |
| `GCP_ARTIFACT_REGISTRY`             | Artifact Registry repository name                                                                                     |
| `CLOUD_RUN_SERVICE`                 | Cloud Run service name, e.g. `helpchain-api`                                                                          |
| `CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT` | Runtime service-account email                                                                                         |
| `FIREBASE_PROJECT_ID`               | `helpchain-app-e8235`                                                                                                 |
| `GCP_WORKLOAD_IDENTITY_PROVIDER`    | Full provider resource name: `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL/providers/PROVIDER` |
| `GCP_DEPLOY_SERVICE_ACCOUNT`        | Deploy service-account email                                                                                          |

The workflow runs on pushes to `main` that change API/workspace files, or manually from GitHub **Actions → Deploy HelpChain API to Cloud Run → Run workflow**.

To grant administrator access, find the user's UID under Firebase Console → Authentication → Users. In Firestore Database, open the `users` collection and the document whose ID matches that UID, then set `isAdmin` to the Boolean `true` (not the text string `"true"`). Only a trusted Firebase administrator should change this role. The account can then use the Admin Sign In screen.

## 4. Point the Expo app to Cloud Run

After a successful workflow, copy the Cloud Run service URL from the workflow output. Verify it by opening `<service-url>/api/healthz`; it should return `{"status":"ok"}`.

In `artifacts/helpchain/.env`, set the service URL without `/api`:

```env
EXPO_PUBLIC_API_BASE_URL=https://your-cloud-run-service-url
```

Restart Expo after saving the file. Expo embeds public environment variables at startup. For a published app, configure the same variable in the EAS build environment and create a new build.
