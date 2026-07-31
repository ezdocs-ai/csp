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

output "gcp_project_id" {
  description = "The GCP project ID for this environment."
  value       = var.gcp_project_id
}

output "frontend_secrets" {
  description = "A list of frontend secret names."
  value       = var.frontend_secrets
}

output "backend_secrets" {
  description = "A list of backend secret names."
  value       = var.backend_secrets
}

output "next_service_url" {
  description = "The URL of the deployed Next.js frontend Cloud Run service."
  value       = module.creative_studio_platform.next_service_url
}

output "next_service_name" {
  description = "Name of the Next.js Cloud Run service (for canary/traffic commands)."
  value       = module.creative_studio_platform.next_service_name
}

output "next_service_location" {
  description = "Location/region of the Next.js Cloud Run service."
  value       = module.creative_studio_platform.next_service_location
}

output "next_latest_ready_revision" {
  description = "Latest READY revision of the Next.js Cloud Run service (use for canary traffic splits)."
  value       = module.creative_studio_platform.next_latest_ready_revision
}

output "next_secrets_to_populate" {
  description = "Next.js runtime Secret Manager IDs whose shell Terraform created. Populate values manually; no version/value is created by Terraform."
  value       = module.creative_studio_platform.next_secrets_to_populate
}
