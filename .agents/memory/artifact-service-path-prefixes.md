---
name: Artifact service path prefixes
description: Routing and working-directory behavior for managed artifact services.
---

When an artifact service is mounted at a path, development routing preserves that prefix in the request path; the backend must handle routes both with and without the mount prefix when local paths are also useful. Service commands run from the artifact directory, so shell paths should be relative to that directory.

**Why:** The Python service launched successfully but returned 404s because it received the full configured mount prefix, and a project-root-relative `cd` failed from the artifact working directory.

**How to apply:** For a service mounted at `/prefix`, expose matching prefixed routes and start it with commands such as `cd backend && ...` from that artifact.
