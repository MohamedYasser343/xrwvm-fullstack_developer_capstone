# Lint CI Design

## Goal

Add a real GitHub Actions lint workflow for the Best Cars capstone. The
workflow must inspect the checked-out repository, cover the Django, React, and
Express source trees, support the course's manual grading run, and pass against
the current codebase.

## Scope

This change will:

- add `.github/workflows/main.yml` with Python and JavaScript lint jobs;
- add reproducible JavaScript lint scripts and the minimum required lint
  dependency/configuration to the existing npm packages;
- fix existing lint violations that prevent the new workflow from passing;
- preserve application routes, payloads, runtime dependencies, and runtime
  behavior.

It will not add deployment jobs, change application behavior, upgrade unrelated
dependencies, or push changes to GitHub.

## Workflow

The workflow will be named `Lint Code` and will run on:

- pushes to `main` or `master`;
- pull requests targeting `main` or `master`;
- manual `workflow_dispatch` runs.

The workflow will grant only `contents: read`. Each job will begin by checking
out the repository so a successful job proves that source files were actually
examined.

### Python job

`lint_python` will:

1. check out the repository;
2. install a supported Python version with the current major release of
   `actions/setup-python`;
3. install a pinned Flake8 version;
4. lint Python files under `server`, excluding generated or third-party
   directories such as virtual environments and `node_modules`.

Flake8 will use a 100-character line limit. Existing Python lines are below
that limit, and this avoids unrelated formatting edits while retaining useful
syntax, import, whitespace, and complexity checks.

### JavaScript job

`lint_js` will:

1. check out the repository;
2. install an active Node.js LTS release with the current major release of
   `actions/setup-node`;
3. use `npm ci` in each JavaScript package so lockfiles determine dependencies;
4. run the React package's existing ESLint configuration against `src`;
5. run JSHint against the Express service with Node and modern ECMAScript
   syntax enabled.

Both packages will expose `npm run lint`, making the same checks reproducible
locally. JSHint will be a pinned development dependency of the Express package
rather than an unpinned global installation.

## Existing Lint Findings

The current Python source has twelve default-Flake8 line-length violations and
no other reported violations; all twelve are within 100 characters. The React
lint configuration reports eight `testing-library/prefer-presence-queries`
errors in `src/App.test.js`. Those assertions will use `getBy*` queries, which
preserves their intent while satisfying the rule. The Express files require a
JSHint environment configuration for Node and ECMAScript 2017-or-newer syntax.

## Failure Behavior

Any lint command returning a nonzero status will fail its job. Python and
JavaScript jobs remain independent so GitHub displays which language failed.
Dependency installation failures also fail the corresponding job. No step will
print a success message unless its lint command has completed successfully.

## Verification

Before completion, run:

- the Python lint command used by CI;
- `npm run lint` in `server/frontend`;
- `npm run lint` in `server/database`;
- the existing frontend test suite in non-watch mode;
- the existing Express test suite;
- Django's test suite;
- a structural validation of the workflow YAML.

The final handoff will report exact command results. A GitHub-hosted Actions run
cannot occur until the committed workflow is pushed; after pushing, the user can
run `Lint Code` from the Actions tab using the manual trigger or let a push or
pull request trigger it automatically.
