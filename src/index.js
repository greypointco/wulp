var debug = require('debug')('wulp');
var micromatch = require('micromatch');
var prettyMs = require('pretty-ms');
var streamArray = require('stream-array');
var util = require('gulp-util');
var watch = require('gulp-watch');

var LOG_PREFIX = '[' + util.colors.cyan('wulp') + ']';

var MICROMATCH_OPTIONS = {
  dot: true,
};

function Wulp(gulp, options) {
  this.tasks   = Object.create(null);
  this.options = options || {};

  this._gulp  = gulp;
  this._queue = {};
}

Wulp.prototype.task = function task(taskName, globs, options, runner) {
  if (!this._gulp) {
    throw new Error('wulp.register(gulp) must be called before any other wulp method.');
  }
  if (taskName in this.tasks) {
    throw new Error('The wulp task "' + taskName + '" is already defined');
  }
  if (!runner) {
    runner = options;
  }
  var runAll = options && options.runAll ? options.runAll : [];

  this.tasks[taskName] = {
    name:   taskName,
    globs:  Array.isArray(globs) ? globs : [globs],
    runner: runner,
    runAll: runAll,
  };

  this._gulp.task(taskName, function() {
    return this._runTask(taskName);
  }.bind(this));

  debug('registered task:', taskName);
};

Wulp.prototype.register = function register(gulp, watchTaskName) {
  this._gulp = gulp;
};

Wulp.prototype.watchTask = function watchTask(watchTaskName) {
  if (!this._gulp) {
    throw new Error('wulp.register(gulp) must be called before any other wulp method.');
  }

  this._gulp.task(watchTaskName, function(done) {
    var taskNames = Object.keys(this.tasks);
    if (!taskNames.length) {
      this._log(util.colors.yellow('No tasks were defined.'));
      return done();
    }

    this._log('Running ' + this._prettyTasks(taskNames) + '...');

    // Enqueue all our tasks, but ignore errors.
    taskNames.forEach(function(taskName) {
      this._enqueueTask(taskName, true);
    }.bind(this));

    var globs = this._watchGlobs();
    debug('watching for changes to:', globs);
    watch(globs, this.options.watch, this._onFileChanged.bind(this));

    this._runNextTask();
  }.bind(this));

  debug('registered watch task', watchTaskName);
};

Wulp.prototype._onFileChanged = function _onFileChanged(file) {
  debug('file changed:', file.relative);

  var tasksToRun = [];
  Object.keys(this.tasks).forEach(function(taskName) {
    var task = this.tasks[taskName];

    if (micromatch.any(file.relative, task.runAll, MICROMATCH_OPTIONS)) {
      tasksToRun.push(taskName);
      this._enqueueTask(taskName, true);
    } else if (micromatch.any(file.relative, task.globs, MICROMATCH_OPTIONS)) {
      tasksToRun.push(taskName);
      this._enqueueTask(taskName, file);
    }
  }.bind(this));

  if (tasksToRun.length) {
    process.stdout.write('\n');
    this._log(util.colors.magenta(file.relative), 'changed. Running', this._prettyTasks(tasksToRun) + '...');
  } else {
    this._log(util.colors.magenta(file.relative), 'changed. No tasks to run');
  }

  this._runNextTask();
};

Wulp.prototype._enqueueTask = function _enqueueTask(taskName, file) {
  if (file == true) {
    this._queue[taskName] = true;
  } else if (!this._queue[taskName]) {
    this._queue[taskName] = [file];
  } else if (this._queue[taskName] !== true) {
    this._queue[taskName].push(file);
  }
}

Wulp.prototype._runNextTask = function _runNextTask() {
  if (this._taskActive) return;
  var nextTaskName = Object.keys(this._queue)[0];
  if (!nextTaskName) return;
  this._taskActive = true;
  debug('_runNextTask', nextTaskName);

  var files = this._queue[nextTaskName];
  delete this._queue[nextTaskName];

  this._log('Running task "' + nextTaskName + '"');
  var startTime = Date.now();

  this._runTask(nextTaskName, files, function(error) {
    var duration = util.colors.magenta(prettyMs(Date.now() - startTime));

    if (error) {
      this._log(util.colors.red('Task "' + nextTaskName + '" failed in ' + duration));
    } else {
      this._log('Completed task "' + nextTaskName + '" in ' + duration);
    }

    this._taskActive = false;
    this._runNextTask();
  }.bind(this));
}

Wulp.prototype._runTask = function _runTask(taskName, files, callback) {
  var task = this.tasks[taskName];

  var inputStream  = Array.isArray(files)
    ? streamArray(files)
    : this._gulp.src(task.globs, {base: process.cwd()});
  var outputStream = task.runner(inputStream);

  var onComplete = function onComplete(error) {
    if (onComplete.isComplete) return;
    onComplete.isComplete = true;

    if (callback) {
      callback(error);
    }
  }.bind(this);

  outputStream.on('error',  onComplete);
  outputStream.on('end',    function() { onComplete(); });
  outputStream.on('finish', function() { onComplete(); });
  outputStream.on('close',  function() { onComplete(); });

  return outputStream;
}

Wulp.prototype._watchGlobs = function _watchGlobs() {
  return Object.keys(this.tasks).reduce(function(globs, key) {
    var task = this.tasks[key];
    return globs.concat(task.globs, task.runAll);
  }.bind(this), []);
};

Wulp.prototype._log = function _log() {
  var args = Array.prototype.slice.call(arguments);
  util.log.apply(util, [LOG_PREFIX].concat(args));
};

Wulp.prototype._prettyTasks = function _prettyTasks(taskNames) {
  return taskNames.map(function(taskName) {
    return "'" + util.colors.cyan(taskName) + "'";
  }).join(', ');
}

module.exports = new Wulp({});
module.exports.Wulp = Wulp;
