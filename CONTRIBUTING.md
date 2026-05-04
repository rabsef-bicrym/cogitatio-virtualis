# Development Process

This is a one-person project, so the process should stay light but explicit.

## Branches

- `master` is the stable base branch.
- Feature and cleanup work should happen on named branches such as `feat/...`,
  `fix/...`, `refactor/...`, or `chore/...`.
- Keep deployment changes separate from modernization or correctness changes.

## Local Gates

Run the frontend gate before pushing frontend changes:

```bash
cd virtualis-terminal
npm run check
```

Run the backend gate before pushing backend changes:

```bash
cd cogitatio-server
python -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[test]"
python -m pip check
python -m pytest cogitatio/tests -q
python -m compileall -q cogitatio scripts
python -m build
```

## Pull Requests

- Open a PR for review even when working solo.
- Keep the PR body focused on what changed, why it changed, and how it was
  verified.
- CI is the merge gate. It does not deploy.

## Dependency Policy

- Prefer direct upgrades over compatibility shims when the app can move cleanly.
- Do not run forced audit fixes that downgrade framework packages.
- Treat npm audit warnings as review items unless the fix preserves the modern
  stack direction.

## Deployment

Deployment is intentionally out of scope for the current modernization pass. The
Python server still has local runtime responsibilities, so deployment notes
should be handled in a separate branch when that architecture is ready.
