/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

const test = require('tape');
const EventEmitter = require('events');

const SQLEngine = require('..');

const script = {
  config: {
    target: 'driver://user:pass@hostname/database'
  },
  scenarios: [{
    name: 'SQL function',
    engine: 'sql',
    flow: [
      {
        query: 'SELECT * from somewhere'
      },
      {
        query: {
          statement: 'something',
          values: [0, 1, 2],
          beforeRequest: 'somethingelse',
          afterRequest: 'somethingelse'
        }
      }
    ]
  }]
};

test('Engine interface with string target', function (t) {
  const events = new EventEmitter();
  const engine = new SQLEngine(script, events, {});
  const scenario = engine.createScenario(script.scenarios[0], events);
  t.assert(engine, 'Can construct an engine');
  t.assert(typeof scenario === 'function', 'Can create a scenario');
  t.end();
});

test('Engine interface with object target', function (t) {
  const events = new EventEmitter();
  const engine = new SQLEngine(script, events, {});
  const scenario = engine.createScenario(script.scenarios[0], events);
  t.assert(engine, 'Can construct an engine');
  t.assert(typeof scenario === 'function', 'Can create a scenario');
  t.end();
});
