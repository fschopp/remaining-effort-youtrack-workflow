YouTrack workflow for automatically calculating the remaining effort as the sum of the corresponding values for each subissue.

## Status

[![Build Status](https://travis-ci.org/fschopp/remaining-effort-youtrack-workflow.svg?branch=master)](https://travis-ci.org/fschopp/remaining-effort-youtrack-workflow)
[![Coverage Status](https://coveralls.io/repos/github/fschopp/remaining-effort-youtrack-workflow/badge.svg?branch=master)](https://coveralls.io/github/fschopp/remaining-effort-youtrack-workflow?branch=master)
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/fschopp/remaining-effort-youtrack-workflow.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/fschopp/remaining-effort-youtrack-workflow/context:javascript)

## Overview

- Simple YouTrack workflow for automatically calculating [custom field](https://www.jetbrains.com/help/youtrack/standalone/Custom-Fields.html) “Remaining effort” (having [type `period`](https://www.jetbrains.com/help/youtrack/standalone/Supported-Custom-Field-Types.html#simple-field-types)) as the sum of the corresponding values for each subtask.
- Written in TypeScript. None of the YouTrack workflow examples that I am aware of are, so the project might serve as template for other YouTrack workflows.
- [Full code coverage](https://coveralls.io/github/fschopp/remaining-effort-youtrack-workflow?branch=master). Some might find the test infrastructure overkill for just a simple YouTrack workflow, but the simplicity helps for serving as example.
- [Just like YouTrack does for the Estimation field](https://www.jetbrains.com/help/youtrack/standalone/Time-Management-Tutorial.html#track-estimations-spent-time) (if time tracking is enabled), the synchronization between an issue and its subissues is turned off if you manually override the remaining effort for the parent. To restore the synchronization, simply delete the remaining effort for the parent – it will then be recalculated immediately.

## License

[Apache License 2.0](LICENSE)

## Build

- The source code is exclusively written in TypeScript. The TypeScript compiler compiles the source code into a CommonJS module, with a target of ECMAScript 3 (aka ES3).
- At the time of this writing, [YouTrack used the Rhino JavaScript Engine](https://www.jetbrains.com/help/youtrack/standalone/Workflows-in-JavaScript.html). ES3 is therefore the latest fully supported language edition.

## Deployment

- Deployment works as [described in the YouTrack manual](https://www.jetbrains.com/help/youtrack/standalone/js-workflow-external-editor.html).
- Add your YouTrack instance and your token to your npm per-user config file:
  ```bash
  npm config set youtrack_host https://${name}.myjetbrains.com/youtrack
  npm config set youtrack_token ${token}
  ```
  where `${name}` and `${token}` need to be replaced, of course. 
- Deploy to your YouTrack instance with `npm run upload`.
