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

variable "gcp_project_id" {
  type        = string
  description = "The GCP Project ID for the development environment."
}

variable "gcp_region" {
  type        = string
  description = "The GCP region for the development environment. Defaults to us-central1."
  default     = "us-central1"
}

variable "environment" {
  type        = string
  description = "The name of the environment, e.g., 'development'."
}

variable "genmedia_bucket_name" {
  type        = string
  description = "Existing GenMedia GCS bucket to manage. Empty creates the default environment bucket."
  default     = ""
}

# --- Service Names ---
variable "backend_service_name" {
  type        = string
  description = "The full name of the backend Cloud Run service for this environment."
}

variable "frontend_service_name" {
  type        = string
  description = "The full name of the frontend Cloud Run service for this environment."
}

variable "next_service_name" {
  type        = string
  description = "The full name of the Next.js frontend Cloud Run service for this environment."
}

variable "next_custom_audiences" {
  type        = list(string)
  description = "List of custom audiences for the Next.js frontend service."
  default     = []
}

variable "next_env_vars" {
  type        = map(string)
  description = "Build-time public values embedded in the Next.js browser bundle."
  default     = {}
}

variable "next_runtime_secrets" {
  type        = map(string)
  description = "Next.js runtime ENV_VAR_NAME = Secret Manager secret name mappings."
  default     = {}
}

variable "next_cpu" {
  type        = string
  description = "CPU limit for Next.js frontend Cloud Run instances."
  default     = "1000m"
}

variable "next_memory" {
  type        = string
  description = "Memory limit for Next.js frontend Cloud Run instances."
  default     = "512Mi"
}

variable "next_scaling_min_instances" {
  type        = number
  description = "Minimum Next.js frontend Cloud Run instances."
  default     = 0
}

variable "next_scaling_max_instances" {
  type        = number
  description = "Maximum Next.js frontend Cloud Run instances."
  default     = 10
}

variable "next_timeout_seconds" {
  type        = number
  description = "Request timeout (seconds) for the Next.js Cloud Run service."
  default     = 300
}

variable "next_concurrency" {
  type        = number
  description = "Max concurrent requests per Next.js Cloud Run instance."
  default     = 100
}

variable "next_startup_cpu_boost" {
  type        = bool
  description = "Enable Cloud Run startup CPU boost for the Next.js service."
  default     = true
}

variable "next_manage_traffic" {
  type        = bool
  description = "Whether Terraform manages Next.js traffic. Default true = safe 100% to LATEST. Set false for `gcloud run deploy --no-traffic` workflows."
  default     = true
}

variable "next_traffic_splits" {
  description = "Custom Next.js traffic allocations for canary. Empty (default) => 100% LATEST when next_manage_traffic=true."
  type = list(object({
    type     = string
    revision = string
    percent  = number
    tag      = string
  }))
  default = []
}

variable "be_cors_extra_origins" {
  type        = list(string)
  description = "Additional explicit origins merged into the backend CORS_ORIGINS."
  default     = []
}

variable "firebase_site_id" {
  type        = string
  description = "The site ID for the Firebase Hosting site. Must be unique across all Firebase projects."
  default     = ""
}

# --- GitHub Repo Details ---
variable "github_conn_name" {
  type        = string
  description = "The name of the Cloud Build GitHub connection."
}

variable "github_repository_link_name" {
  type        = string
  description = "The Cloud Build repository link resource name."
}

variable "github_repo_owner" {
  type        = string
  description = "The owner of the GitHub repository."
}

variable "github_repo_name" {
  type        = string
  description = "The name of the GitHub repository."
}

variable "github_branch_name" {
  type        = string
  description = "The branch name to trigger builds from."
}

# --- Custom Audiences ---
variable "backend_custom_audiences" {
  type        = list(string)
  description = "List of custom audiences for the backend service."
}

variable "frontend_custom_audiences" {
  type        = list(string)
  description = "List of custom audiences for the frontend service."
}

# --- Service-Specific Environment Variables ---
variable "be_env_vars" {
  type        = map(map(string))
  description = "A map containing common and environment-specific variables for the backend."
}

variable "be_build_substitutions" {
  type        = map(string)
  description = "A map of substitution variables for the backend Cloud Build trigger."
  default     = {}
}

variable "fe_build_substitutions" {
  type        = map(string)
  description = "A map of substitution variables for the frontend Cloud Build trigger."
  default     = {}
}

variable "frontend_secrets" {
  type        = list(string)
  description = "A list of secret names required by the frontend build."
  default     = []
}

variable "fe_trigger_disabled" {
  type        = bool
  description = "Disable the legacy Angular/Firebase Hosting build trigger without destroying the rollback infrastructure."
  default     = false
}

variable "backend_secrets" {
  type        = list(string)
  description = "A list of secret names required by the backend build."
  default     = []
}

variable "backend_runtime_secrets" {
  type        = map(string)
  description = "Secrets to mount in the backend container at runtime."
}


# --- List of APIs to enable ---
variable "apis_to_enable" {
  type        = list(string)
  description = "A list of Google Cloud APIs to enable on the project."
  default = [
    "serviceusage.googleapis.com",     # Required to enable other APIs
    "iam.googleapis.com",              # Required for IAM management
    "cloudbuild.googleapis.com",       # Required for Cloud Build
    "artifactregistry.googleapis.com", # Required for Artifact Registry
    "run.googleapis.com"               # Required for Cloud Run
  ]
}
