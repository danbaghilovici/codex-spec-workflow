# Implementation Tasks

## Approach

[Summarize sequencing, reuse, and steering compliance.]

## Task Rules

- Each checkbox is one testable implementation outcome, normally touching 1-3 related files.
- Include exact files, relevant requirement IDs, code to leverage, and dependencies.
- Use `_Depends on: none_` or task IDs. Dependencies must not be circular.
- Include tests and validation in the task that changes behavior.

## Tasks

- [ ] 1. [Specific implementation outcome]
  - Files: `path/to/file.ts`, `tests/path/to/file.test.ts`
  - [Implementation and acceptance details]
  - _Leverage: path/to/existing.ts_
  - _Requirements: 1.1, 1.2_
  - _Depends on: none_

- [ ] 2. [Next specific outcome]
  - Files: `path/to/other.ts`
  - [Implementation and acceptance details]
  - _Requirements: 2.1_
  - _Depends on: 1_
