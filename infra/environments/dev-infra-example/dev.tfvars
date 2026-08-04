gcp_project_id       = "trd-csp"
gcp_region           = "us-central1"
environment          = "development"
genmedia_bucket_name = "csp-genmedia"

# --- Service Names ---
backend_service_name  = "cstudio-backend-dev"
frontend_service_name = "cstudio-frontend-dev" # Firebase Hosting deployment label
next_service_name     = "creative-studio-next"
firebase_site_id      = "trd-csp" # Existing Firebase Hosting site ID

# --- GitHub Repo Details ---
github_conn_name            = "production-github"
github_repository_link_name = "ezdocs-ai-csp"
github_repo_owner           = "ezdocs-ai"
github_repo_name            = "csp"
github_branch_name          = "main"

# --- Custom Audiences ---
backend_custom_audiences  = ["146267550765-k5cvf01l0amk1o19qgkefv007purubff.apps.googleusercontent.com", "trd-csp"]
frontend_custom_audiences = ["146267550765-k5cvf01l0amk1o19qgkefv007purubff.apps.googleusercontent.com", "trd-csp"]
next_custom_audiences     = ["146267550765-k5cvf01l0amk1o19qgkefv007purubff.apps.googleusercontent.com", "trd-csp"]

# Build-time public values embedded in the Next.js browser bundle. Backend and
# application URLs default to the predictable Cloud Run URLs from Terraform.
next_env_vars = {
  NEXT_PUBLIC_GOOGLE_CLIENT_ID = "146267550765-k5cvf01l0amk1o19qgkefv007purubff.apps.googleusercontent.com"
}

# Next.js runtime environment variables and secrets are managed manually on the
# Cloud Run service.
next_runtime_secrets = {}

# --- Next.js Cloud Run runtime tuning (safe defaults) ---
next_startup_cpu_boost = true
next_timeout_seconds   = 300
next_concurrency       = 100
# Cloud Build owns canary deployment and promotion traffic for this environment.
next_manage_traffic = false
# next_traffic_splits    = []   # empty + next_manage_traffic=true => safe 100% to LATEST
#                                  set per-revision objects for canary, e.g.:
#                                  { type = "TRAFFIC_TARGET_ALLOCATION_TYPE_REVISION", revision = "next-00001-abc", percent = 10, tag = "" }

# Extra backend CORS origins (e.g., local/dev URLs) in addition to Firebase + Next URLs.
be_cors_extra_origins = []

# --- Service-Specific Environment Variables ---
be_env_vars = {
  common = {
    LOG_LEVEL = "INFO"
  }
  development = {
    ENVIRONMENT                    = "development"
    GOOGLE_TOKEN_AUDIENCE          = "146267550765-k5cvf01l0amk1o19qgkefv007purubff.apps.googleusercontent.com"
    IDENTITY_PLATFORM_ALLOWED_ORGS = "" # If empty then any org is allowed
  }
  production = {
    ENVIRONMENT                    = "production"
    GOOGLE_TOKEN_AUDIENCE          = "146267550765-k5cvf01l0amk1o19qgkefv007purubff.apps.googleusercontent.com"
    IDENTITY_PLATFORM_ALLOWED_ORGS = "" # If empty then any org is allowed
  }
}

fe_build_substitutions = {
  _ANGULAR_BUILD_COMMAND = "build-dev"
}

# The Angular deployment is legacy rollback-only. Its build needs FIREBASE_*
# secret VALUES, which Terraform never creates (shells only). Keep the trigger
# disabled until those versions are populated via update_secrets.sh, otherwise
# every push touching frontend/** fails on `versions/latest` not found.
fe_trigger_disabled = true

frontend_secrets = [
  "FIREBASE_API_KEY",             # Your Firebase Web API Key
  "FIREBASE_AUTH_DOMAIN",         # Your Firebase Auth Domain (e.g., project-id.firebaseapp.com)
  "FIREBASE_PROJECT_ID",          # Your Firebase Project ID
  "FIREBASE_STORAGE_BUCKET",      # Your Firebase Storage Bucket (e.g., project-id.appspot.com)
  "FIREBASE_MESSAGING_SENDER_ID", # Your Firebase Cloud Messaging Sender ID
  "FIREBASE_APP_ID",              # Your Firebase Web App ID
  "FIREBASE_MEASUREMENT_ID",      # Your Google Analytics Measurement ID
  "GOOGLE_CLIENT_ID",             # Your Google OAuth 2.0 Client ID for web
]

backend_secrets = [
  "GOOGLE_TOKEN_AUDIENCE",
]

backend_runtime_secrets = {
  "GOOGLE_TOKEN_AUDIENCE" = "GOOGLE_TOKEN_AUDIENCE"
}

apis_to_enable = [
  "serviceusage.googleapis.com",     # Required to enable other APIs
  "iam.googleapis.com",              # Required for IAM management
  "cloudbuild.googleapis.com",       # Required for Cloud Build
  "artifactregistry.googleapis.com", # Required for Artifact Registry
  "run.googleapis.com",              # Required for Cloud Run
  "secretmanager.googleapis.com",    # Required for runtime secrets
  "cloudresourcemanager.googleapis.com",
  "compute.googleapis.com",
  "cloudfunctions.googleapis.com",
  "iamcredentials.googleapis.com",
  "aiplatform.googleapis.com",
  "firestore.googleapis.com",
  "texttospeech.googleapis.com",
  "workflows.googleapis.com",
]
