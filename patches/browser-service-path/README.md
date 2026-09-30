# Browser trusted-service path

The current application generator still registers its browser trusted service with a POSIX path when the browser worker runs on Windows. From a task rooted in a Linux repository, that path can resolve under its UNC working directory and fail to import.

This patch uses the existing native path converter before registering the service, only when WSL paths are selected and the worker platform is Windows. A null distribution argument preserves genuinely Linux-only paths and avoids distribution probing. Service code, browser API, allowlists, model checks, and other generated configuration remain unchanged.

The source-bound test evaluates the actual generator across runtime platforms, WSL modes, path types, and available backends. This module depends on `browser-wsl`. Native Windows Node import from a WSL UNC working directory and a real Linux-repository browser interaction remain desktop acceptance checks.
