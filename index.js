'use strict';

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const debug = require('debug')('engine:sql');
const A = require('async');
const _ = require('lodash');
const helpers = require('artillery-core/lib/engine_util');
const anyDB = require('any-db');
const fs = require('fs');
let config;

function SQLEngine(script, ee) {
  this.script = script;
  this.ee = ee;
  this.helpers = helpers;
  this.config = script.config;

  return this;
}

SQLEngine.prototype.createScenario = function createScenario(scenarioSpec, ee) {
  const tasks = scenarioSpec.flow.map(rs => this.step(rs, ee));

  return this.compile(tasks, scenarioSpec.flow, ee);
};

SQLEngine.prototype.step = function step(rs, ee, opts) {
  opts = opts || {};
  let self = this;

  if (rs.loop) {
    let steps = _.map(rs.loop, function (rs) {
      return self.step(rs, ee, opts);
    });

    return this.helpers.createLoopWithCount(
      rs.count || -1,
      steps,
      {
        loopValue: rs.loopValue || '$loopCount',
        overValues: rs.over,
        whileTrue: self.config.processor
          ? self.config.processor[rs.whileTrue] : undefined
      });
  }

  if (rs.log) {
    return function log(context, callback) {
      return process.nextTick(function () { callback(null, context); });
    };
  }

  if (rs.think) {
    return this.helpers.createThink(rs, _.get(self.config, 'defaults.think', {}));
  }

  if (rs.function) {
    return function (context, callback) {
      let func = self.config.processor[rs.function];
      if (!func) {
        return process.nextTick(function () { callback(null, context); });
      }

      return func(context, ee, function () {
        return callback(null, context);
      });
    };
  }

  if (rs.query) {
    return function query(context, callback) {
      debug('Running Query');
      let params = {
        query: rs.query,
        args: [],
        afterResponse: null,
        beforeRequest: null,
        target: config.target
      }
      if (typeof rs.query === 'object') {
        params = {
          query: rs.query.statement,
          args: rs.query.values,
          afterResponse: rs.query.afterResponse,
          beforeRequest: rs.query.beforeRequest,
          target: config.target
        }
      }
      debug(params);
      params.query = helpers.template(params.query, context);
      let before = err => {
        let onError = err => {
          debug('Query Error');
          //debug(err);
          ee.emit('error', err.number);
          return callback(err, context);
        }
        if (err) return onError(err);
        ee.emit('request');
        const startedAt = process.hrtime();
        context.sql.query(params.query, params.args, function (err, data) {
          if (err) return onError(err);

          const endedAt = process.hrtime(startedAt);
          let delta = (endedAt[0] * 1e9) + endedAt[1];
          let after = err => {
            if (err) return onError(err);
            ee.emit('response', delta, 0, data.rowCount);
            debug('Query Response');
            debug(data);
            return callback(null, context);
          };
          if (params.afterResponse && config.processor[params.afterResponse]) {
            debug('Executing afterResponse');
            config.processor[params.afterResponse](params, data, context, ee, after);
          }
          else after();
        });
      };
      if (params.beforeRequest && config.processor[params.beforeRequest]) {
        debug('Executing beforeRequest');
        config.processor[params.beforeRequest](params, context, ee, before);
      }
      else before();
    };
  }

  return function (context, callback) {
    return callback(null, context);
  };
};

SQLEngine.prototype.compile = function compile(tasks, scenarioSpec, ee) {
  const self = this;
  return function scenario(initialContext, callback) {
    const init = function init(next) {
      debug('Configuration');
      config = self.script.config;
      debug(config.target);
      initialContext.sql = anyDB.createConnection(config.target);

      ee.emit('started');
      return next(null, initialContext);
    };

    let steps = [init].concat(tasks);

    A.waterfall(
      steps,
      function done(err, context) {
        if (err) {
          debug(err);
        }

        return callback(err, context);
      });
  };
};

module.exports = SQLEngine;
