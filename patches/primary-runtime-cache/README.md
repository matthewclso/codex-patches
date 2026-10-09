# Desktop bundled runtime cache under WSL

The Windows desktop stages `openai-primary-runtime` beneath its profile’s `.cache`.
The Linux CLI permits that reserved marketplace name only at its own native
cache root. Different Windows and Linux cache roots therefore cause a reserved
marketplace rejection and prevent bundled runtime plugins from synchronizing.

Installation records the desktop profile cache as a canonical WSL path. The
supervisor supplies it as process-local `XDG_CACHE_HOME` to the unmodified CLI,
including when other runtime patches are disabled and for non-stdio commands.
The native marketplace source/name checks remain enabled. Existing Linux cache
files and shell profiles are retained. No cache contents or credentials are copied.

The environment change selects the entire native CLI cache root, not only the
marketplace. Existing Linux cache files remain on disk and are used again when
the module is disabled; other processes keep their existing cache preferences.

An explicitly conflicting `XDG_CACHE_HOME` fails installer preflight before
provisioning or activation, with a useful explanation;
disable this module to keep that preference. Disabling the module restores the
inherited environment. It does not remove cached plugins or user data.

## Verification

The native regression fixture creates a minimal reserved marketplace in a
disposable desktop cache. Stock routing rejects the mismatched source; the
aligned environment accepts it. The existing Linux cache sentinel is retained.
Environment tests also verify disabled behavior and explicit preference conflicts.
Desktop runtime synchronization after activating a generated copy remains a
separate acceptance check.
