# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# --- Shared Platform Resources ---

resource "google_storage_bucket" "genmedia" {
  name                        = var.genmedia_bucket_name != "" ? var.genmedia_bucket_name : "${var.gcp_project_id}-cs-${var.environment}-bucket"
  location                    = var.gcp_region
  uniform_bucket_level_access = true

  cors {
    origin          = ["*"]
    method          = ["GET", "PUT", "POST", "DELETE", "HEAD", "OPTIONS"]
    response_header = ["Content-Type", "Access-Control-Allow-Origin", "x-goog-resumable", "Authorization", "Origin"]
    max_age_seconds = 3600
  }
}

resource "google_service_account" "bucket_reader_sa" {
  account_id   = "cs-${var.environment}-read"
  display_name = "SA for reading GenMedia (${var.environment}) bucket"
}

resource "google_storage_bucket_iam_member" "bucket_viewer_binding" {
  bucket = google_storage_bucket.genmedia.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.bucket_reader_sa.email}"
}

resource "google_storage_bucket_iam_member" "bucket_creator_binding" {
  bucket = google_storage_bucket.genmedia.name
  role   = "roles/storage.objectCreator"
  member = "serviceAccount:${google_service_account.bucket_reader_sa.email}"
}

data "google_project" "project" {
  project_id = var.gcp_project_id
}

# --- Predictable URLs & Environment Variables ---
locals {
  region_code = join("", [for s in split("-", var.gcp_region) : substr(s, 0, 1)])
  backend_url = "https://${var.backend_service_name}-${data.google_project.project.number}.${var.gcp_region}.run.app"

  frontend_url      = "https://${var.firebase_site_id}.web.app" # Predictable Firebase URL
  next_frontend_url = "https://${var.next_service_name}-${data.google_project.project.number}.${var.gcp_region}.run.app"

  backend_env_vars = merge(
    lookup(var.be_env_vars, "common", {}),
    lookup(var.be_env_vars, var.environment, {}),
    {
      "CORS_ORIGINS"           = jsonencode(distinct(concat([local.frontend_url, local.next_frontend_url], var.be_cors_extra_origins)))
      "GENMEDIA_BUCKET"        = google_storage_bucket.genmedia.name
      "SIGNING_SA_EMAIL"       = google_service_account.bucket_reader_sa.email
      "BACKEND_URL"            = local.backend_url
      "WORKFLOWS_EXECUTOR_URL" = "${local.backend_url}/api/workflows-executor"
    }
  )
}

# Traffic allocation for the Next.js service.
# When next_manage_traffic=true and no custom splits are supplied, default to the
# safe 100% -> LATEST. When next_manage_traffic=false, leave traffic empty so
# Terraform does not fight a `gcloud run deploy --no-traffic` canary.
locals {
  next_traffic_targets = var.next_manage_traffic ? (
    length(var.next_traffic_splits) > 0 ? var.next_traffic_splits : [
      { type = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST", revision = "", percent = 100, tag = "" }
    ]
  ) : []
}


# --- Cloud Build Repository Connection ---
resource "google_cloudbuildv2_repository" "source_repo" {
  provider          = google-beta
  name              = var.github_repository_link_name
  location          = var.gcp_region
  parent_connection = "projects/${var.gcp_project_id}/locations/${var.gcp_region}/connections/${var.github_conn_name}"
  remote_uri        = "https://github.com/${var.github_repo_owner}/${var.github_repo_name}.git"

  # Imported repositories may return the connection as a short name even
  # though the API accepts the fully qualified path. The parent is immutable,
  # so ignore this provider normalization drift to avoid a needless relink.
  lifecycle {
    ignore_changes = [parent_connection]
  }
}


# --- Service Module Calls ---
module "backend_service" {
  source = "../cloud-run-service"

  gcp_project_id        = var.gcp_project_id
  gcp_region            = var.gcp_region
  environment           = var.environment
  service_name          = var.backend_service_name
  resource_prefix       = "cs-be"
  github_conn_name      = var.github_conn_name
  github_repo_owner     = var.github_repo_owner
  github_repo_name      = var.github_repo_name
  github_branch_name    = var.github_branch_name
  cloudbuild_yaml_path  = "backend/cloudbuild.yaml"
  included_files_glob   = ["backend/**"]
  container_env_vars    = local.backend_env_vars
  runtime_secrets       = var.backend_runtime_secrets
  custom_audiences      = var.backend_custom_audiences
  scaling_min_instances = 1
  source_repository_id  = google_cloudbuildv2_repository.source_repo.id
  cpu                   = var.be_cpu
  memory                = var.be_memory
  build_substitutions = merge(var.be_build_substitutions,
    {
      _REGION       = var.gcp_region
      _SERVICE_NAME = var.backend_service_name
    }
  )
}

resource "google_firebase_project" "default" {
  provider = google-beta
  project  = var.gcp_project_id
}

module "frontend_service" {
  source = "../firebase-hosting-service"

  source_repository_id = google_cloudbuildv2_repository.source_repo.id
  gcp_project_id       = var.gcp_project_id
  gcp_region           = var.gcp_region
  firebase_project_id  = google_firebase_project.default.project
  service_name         = var.gcp_project_id
  environment          = var.environment
  resource_prefix      = "cs-fe"
  github_branch_name   = var.github_branch_name
  cloudbuild_yaml_path = "frontend/cloudbuild-deploy.yaml"
  included_files_glob  = ["frontend/**"]
  firebase_site_id     = var.firebase_site_id != "" ? var.firebase_site_id : var.gcp_project_id

  build_substitutions = merge(
    var.fe_build_substitutions,
    {
      # This block should ONLY contain non-secret, underscore-prefixed values
      _BACKEND_URL         = local.frontend_url # The frontend will redirect the api calls to the backend
      _FE_SERVICE_NAME     = var.frontend_service_name
      _BACKEND_SERVICE_ID  = var.backend_service_name
      _FIREBASE_PROJECT_ID = var.gcp_project_id
      _FIREBASE_SITE_ID    = var.firebase_site_id != "" ? var.firebase_site_id : var.gcp_project_id
    }
  )
}

module "frontend_secrets" {
  source = "../secret-manager"

  gcp_project_id    = var.gcp_project_id
  secret_names      = var.frontend_secrets
  accessor_sa_email = module.frontend_service.trigger_sa_email
}

module "backend_secrets" {
  source = "../secret-manager"

  gcp_project_id    = var.gcp_project_id
  secret_names      = var.backend_secrets
  accessor_sa_email = module.backend_service.trigger_sa_email
}

# --- Next.js Cloud Run Service ---
resource "google_artifact_registry_repository" "next" {
  location      = var.gcp_region
  repository_id = "cs-next-${var.environment}-repo"
  description   = "Docker repository for Next.js frontend"
  format        = "DOCKER"
}

resource "google_service_account" "next_run" {
  account_id   = "cs-next-${var.environment}-run"
  display_name = "SA for Next.js frontend (${var.environment}) Runtime"
}

resource "google_service_account" "next_trigger" {
  account_id   = "cs-next-${var.environment}-trig"
  display_name = "SA for Next.js frontend (${var.environment}) Cloud Build trigger"
}

resource "google_cloud_run_v2_service" "next" {
  name                 = var.next_service_name
  location             = var.gcp_region
  custom_audiences     = var.next_custom_audiences
  invoker_iam_disabled = true
  deletion_protection  = false

  # Ensure runtime secret shells exist before the service template references them.
  depends_on = [google_secret_manager_secret.next_runtime]

  template {
    service_account                  = google_service_account.next_run.email
    timeout                          = "${var.next_timeout_seconds}s"
    max_instance_request_concurrency = var.next_concurrency
    annotations = var.next_startup_cpu_boost ? {
      "run.googleapis.com/enable-cpu-boost" = "true"
    } : {}

    containers {
      image = "us-docker.pkg.dev/cloudrun/container/hello:latest"

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = var.next_cpu
          memory = var.next_memory
        }
      }


      dynamic "env" {
        for_each = var.next_runtime_secrets
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value
              version = "latest"
            }
          }
        }
      }
    }

    scaling {
      min_instance_count = var.next_scaling_min_instances
      max_instance_count = var.next_scaling_max_instances
    }
  }

  # Managed traffic: safe 100% to LATEST by default, or custom canary splits.
  # Omitted entirely when next_manage_traffic=false (operator-driven traffic).
  dynamic "traffic" {
    for_each = local.next_traffic_targets
    content {
      type     = traffic.value.type
      revision = traffic.value.revision
      percent  = traffic.value.percent
      tag      = traffic.value.tag
    }
  }

  lifecycle {
    ignore_changes = [template[0].containers[0].image, client, client_version]
  }
}


resource "google_cloudbuild_trigger" "next" {
  name            = "${var.next_service_name}-trigger"
  location        = var.gcp_region
  service_account = google_service_account.next_trigger.id
  filename        = "frontend-next/cloudbuild.yaml"
  substitutions = {
    _REGION       = var.gcp_region
    _REPO_NAME    = google_artifact_registry_repository.next.name
    _SERVICE_NAME = var.next_service_name

    _NEXT_PUBLIC_GOOGLE_CLIENT_ID = lookup(var.next_env_vars, "NEXT_PUBLIC_GOOGLE_CLIENT_ID", "")
    _NEXT_PUBLIC_APP_URL          = lookup(var.next_env_vars, "NEXT_PUBLIC_APP_URL", local.next_frontend_url)
    _NEXT_PUBLIC_API_BASE_URL     = lookup(var.next_env_vars, "NEXT_PUBLIC_API_BASE_URL", local.backend_url)
  }

  repository_event_config {
    repository = google_cloudbuildv2_repository.source_repo.id
    push {
      branch = "^${var.github_branch_name}$"
    }
  }

  included_files = ["frontend-next/**"]
}

resource "google_project_iam_member" "next_trigger_logging" {
  project = var.gcp_project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.next_trigger.email}"
}

resource "google_artifact_registry_repository_iam_member" "next_trigger_writer" {
  location   = var.gcp_region
  repository = google_artifact_registry_repository.next.name
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.next_trigger.email}"
}

resource "google_cloud_run_v2_service_iam_member" "next_trigger_developer" {
  name     = google_cloud_run_v2_service.next.name
  location = google_cloud_run_v2_service.next.location
  role     = "roles/run.developer"
  member   = "serviceAccount:${google_service_account.next_trigger.email}"
}

resource "google_service_account_iam_member" "next_trigger_act_as_runtime" {
  service_account_id = google_service_account.next_run.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.next_trigger.email}"
}

# Managed "shell" for Next.js runtime secrets (metadata only — no version/value).
# Values must be populated out-of-band (see output next_secrets_to_populate / update_secrets.sh).
resource "google_secret_manager_secret" "next_runtime" {
  provider = google-beta
  for_each = toset(values(var.next_runtime_secrets))

  project   = var.gcp_project_id
  secret_id = each.key

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_iam_member" "next_runtime_secret_access" {
  provider  = google-beta
  for_each  = toset(values(var.next_runtime_secrets))
  project   = var.gcp_project_id
  secret_id = google_secret_manager_secret.next_runtime[each.key].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.next_run.email}"
}

# --- Cross-Module Permissions ---

# Grant the Frontend's deploy trigger (which runs `firebase deploy`)
# permission to "get" the Backend's Cloud Run service to validate the rewrite rule.
resource "google_cloud_run_v2_service_iam_member" "fe_trigger_can_view_backend" {
  provider = google-beta
  project  = var.gcp_project_id
  name     = module.backend_service.service_name
  location = module.backend_service.location
  role     = "roles/run.viewer"
  member   = "serviceAccount:${module.frontend_service.trigger_sa_email}"
}
