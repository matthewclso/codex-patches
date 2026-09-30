# Repository instructions

Read [docs/BEHAVIOR_CONTRACT.md](docs/BEHAVIOR_CONTRACT.md) before substantive work. It is the highest-authority repository source for intended user-visible behavior, including over this file, the implementation, tests, compatibility metadata, README and historical notes. Later explicit owner instructions can change that contract.

For a behavior change or regression fix, identify the affected contract requirement IDs and verify the corresponding user scenarios. Fix code, tests or supporting documentation when they conflict with the contract; do not weaken the contract to match a regression. Ordinary fixes that preserve the contract need no additional approval ceremony.

Keep required behavior, dated acceptance evidence and known limitations separate. In particular, a visible browser panel is not proof of agent browser control, and synchronized backend project IDs are not proof that Android displays desktop project names. Preserve the documented Android limitation until an actual client check resolves it.

Keep installation and examples portable. Do not commit private state, user transcripts, credentials, generated Codex app copies or machine-specific configuration. Use the contract's lifecycle and CI rules when changing installation, cleanup, compatibility support or release automation.
