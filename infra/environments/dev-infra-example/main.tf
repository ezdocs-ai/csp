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

terraform {
  required_providers {
    google      = { source = "hashicorp/google" }
    google-beta = { source = "hashicorp/google-beta" }
  }
}

provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
}

provider "google-beta" {
  project = var.gcp_project_id
  region  = var.gcp_region
}

# --- Enable the required Google Cloud APIs ---
resource "google_project_service" "apis" {
  # Use a for_each loop to enable each API from the variable list
  for_each = toset(var.apis_to_enable)

  project = var.gcp_project_id
  service = each.key

  # This prevents Terraform from disabling APIs when you run `terraform destroy`
  disable_on_destroy = false
}

# Call the platform module, passing in all the required variables.
module "creative_studio_platform" {
  source = "../../modules/platform"

  gcp_project_id              = var.gcp_project_id
  gcp_region                  = var.gcp_region
  environment                 = var.environment
  genmedia_bucket_name        = var.genmedia_bucket_name
  backend_service_name        = var.backend_service_name
  backend_custom_audiences    = var.backend_custom_audiences
  be_env_vars                 = var.be_env_vars
  frontend_service_name       = var.frontend_service_name
  frontend_custom_audiences   = var.frontend_custom_audiences
  next_service_name           = var.next_service_name
  next_custom_audiences       = var.next_custom_audiences
  next_env_vars               = var.next_env_vars
  next_runtime_secrets        = var.next_runtime_secrets
  next_cpu                    = var.next_cpu
  next_memory                 = var.next_memory
  next_scaling_min_instances  = var.next_scaling_min_instances
  next_scaling_max_instances  = var.next_scaling_max_instances
  next_timeout_seconds        = var.next_timeout_seconds
  next_concurrency            = var.next_concurrency
  next_startup_cpu_boost      = var.next_startup_cpu_boost
  next_manage_traffic         = var.next_manage_traffic
  next_traffic_splits         = var.next_traffic_splits
  be_cors_extra_origins       = var.be_cors_extra_origins
  firebase_site_id            = var.firebase_site_id != "" ? var.firebase_site_id : var.gcp_project_id
  github_conn_name            = var.github_conn_name
  github_repository_link_name = var.github_repository_link_name
  github_repo_owner           = var.github_repo_owner
  github_repo_name            = var.github_repo_name
  github_branch_name          = var.github_branch_name

  frontend_secrets       = var.frontend_secrets
  backend_secrets        = var.backend_secrets
  fe_build_substitutions = var.fe_build_substitutions

  depends_on = [google_project_service.apis]
}
