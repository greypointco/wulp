# wulp [![NPM version][npm-image]][npm-url]

Wulp allows you to define [Gulp](http://gulpjs.com/) tasks that can be run directly, and also via a `watch` task.


## Registering Wulp

Wulp tasks don't do anything on their own; you must first register them with gulp via `wulp.register`:

```js
// Registers all wulp tasks as gulp tasks, and creates a task called `watch`
// that watches for changes.
wulp.register(gulp, 'watch');
```


## Defining a Task

```js
var eslint = require('gulp-eslint');
var gulp = require('gulp');
var wulp = require('wulp');

// A wulp task is defined similarly to regular gulp tasks, except it is _given_
// the files it should execute over.
//
// When being run directly, this is whatever files match the glob.  When being
// run via the watch task, it is whatever matching files have changed.
wulp.task('test:style', ['{src,test}/**/*.js'], (srcs) => {
  return srcs
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});
```


## Advanced Options

Wulp tasks support additional configuration via a third argument:

```js
wulp.task('test:style', ['{src,test}/**/*.js'], {runAll: ['.eslintrc*']}, (srcs) => {
```

The supported options are:

`runAll`: Accepts an array of glob expressions.  When a file matching that expression changes, the task will be run with all files matching the primary glob.  Great for re-running all tests after changing test configuration, for example.


## License

This project is covered under the [Apache License, version 2.0](./APACHEv2-LICENSE.md).

[npm-url]: https://npmjs.org/package/wulp
[npm-image]: http://img.shields.io/npm/v/wulp.svg
