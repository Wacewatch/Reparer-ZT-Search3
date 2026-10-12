---
name: Python deployment installs
description: Installing the app's Python dependencies in Replit build commands.
---

Python deployment build commands should use `uv pip install --python "$(command -v python)" -r <requirements-file>` rather than `python -m pip`; the managed Python environment may not include the `pip` module.

**Why:** A production build reached the API service step and failed because its managed interpreter had no `pip`, even though its runtime packages were available.

**How to apply:** Keep Python dependencies in a requirements file and use `uv` to install them into the interpreter selected by the deployment environment.
