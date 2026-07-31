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
"""Provider registry constants."""

from enum import Enum


class ProviderTypeEnum(str, Enum):
    """Supported provider adapter types."""

    GOOGLE_VEAN = "GOOGLE_VEAN"
    REPLICATE = "REPLICATE"
    ARK = "ARK"


class MediaTypeEnum(str, Enum):
    """Supported generated media types."""

    VIDEO = "VIDEO"
    IMAGE = "IMAGE"
    AUDIO = "AUDIO"


class EnvironmentEnum(str, Enum):
    """Provider model deployment environments."""

    LOCAL = "LOCAL"
    DEVELOPMENT = "DEVELOPMENT"
    PRODUCTION = "PRODUCTION"
