/**
 * @license Copyright 2017 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert').strict;

const ScreenshotThumbnailsAudit = require('../../audits/screenshot-thumbnails.js');
const pwaTrace = require('../fixtures/traces/progressive-app-m60.json');
const noScreenshotsTrace = {traceEvents: pwaTrace.traceEvents.filter(e => e.name !== 'Screenshot')};
const pwaDevtoolsLog = require('../fixtures/traces/progressive-app-m60.devtools.log.json');

/* eslint-env jest */

describe('Screenshot thumbnails', () => {
  it('should extract thumbnails from a trace', () => {
    const options = {minimumTimelineDuration: 500};
    const settings = {throttlingMethod: 'provided'};
    const artifacts = {
      GatherContext: {gatherMode: 'timespan'},
      traces: {defaultPass: pwaTrace},
      devtoolsLogs: {}, // empty devtools logs to test just thumbnails without TTI behavior
    };

    const context = {settings, options, computedCache: new Map()};
    return ScreenshotThumbnailsAudit.audit(artifacts, context).then(results => {
      results.details.items.forEach((result, index) => {
        const framePath = path.join(__dirname,
            `../fixtures/traces/screenshots/progressive-app-frame-${index}.jpg`);
        const expectedData = fs.readFileSync(framePath, 'base64');
        const actualData = result.data.slice('data:image/jpeg;base64,'.length);
        expect(actualData).toEqual(expectedData);
      });

      assert.equal(results.score, 1);
      assert.equal(results.details.items[0].timing, 82);
      assert.equal(results.details.items[2].timing, 245);
      assert.equal(results.details.items[9].timing, 818);
      assert.equal(results.details.items[0].timestamp, 225414253815);
    });
  }, 10000);

  it('should throw when screenshots are missing in navigation', async () => {
    const options = {minimumTimelineDuration: 500};
    const settings = {throttlingMethod: 'provided'};
    const artifacts = {
      GatherContext: {gatherMode: 'navigation'},
      traces: {defaultPass: noScreenshotsTrace},
      devtoolsLogs: {}, // empty devtools logs to test just thumbnails without TTI behavior
    };

    const context = {settings, options, computedCache: new Map()};
    await expect(ScreenshotThumbnailsAudit.audit(artifacts, context)).rejects.toThrow();
  });

  it('should be notApplicable when screenshots are missing in timespan', async () => {
    const options = {minimumTimelineDuration: 500};
    const settings = {throttlingMethod: 'provided'};
    const artifacts = {
      GatherContext: {gatherMode: 'timespan'},
      traces: {defaultPass: noScreenshotsTrace},
      devtoolsLogs: {}, // empty devtools logs to test just thumbnails without TTI behavior
    };

    const context = {settings, options, computedCache: new Map()};
    const results = await ScreenshotThumbnailsAudit.audit(artifacts, context);
    expect(results.notApplicable).toBe(true);
  });

  it('should scale the timeline to last visual change', () => {
    const options = {minimumTimelineDuration: 500};
    const settings = {throttlingMethod: 'devtools'};
    const artifacts = {
      GatherContext: {gatherMode: 'navigation'},
      traces: {defaultPass: pwaTrace},
      devtoolsLogs: {defaultPass: pwaDevtoolsLog},
    };

    const context = {settings, options, computedCache: new Map()};
    return ScreenshotThumbnailsAudit.audit(artifacts, context).then(results => {
      assert.equal(results.details.items[0].timing, 82);
      assert.equal(results.details.items[9].timing, 818);
    });
  });

  it('should scale the timeline to minimumTimelineDuration', () => {
    const settings = {throttlingMethod: 'simulate'};
    const artifacts = {
      GatherContext: {gatherMode: 'navigation'},
      traces: {defaultPass: pwaTrace},
    };

    const context = {settings, options: {}, computedCache: new Map()};
    return ScreenshotThumbnailsAudit.audit(artifacts, context).then(results => {
      assert.equal(results.details.items[0].timing, 300);
      assert.equal(results.details.items[9].timing, 3000);
    });
  });

  it('should handle nonsense times', async () => {
    const infiniteTrace = JSON.parse(JSON.stringify(pwaTrace));
    infiniteTrace.traceEvents.forEach(event => {
      if (event.name === 'Screenshot') {
        event.ts = Infinity;
      }
    });

    const settings = {throttlingMethod: 'simulate'};
    const artifacts = {
      GatherContext: {gatherMode: 'navigation'},
      traces: {defaultPass: infiniteTrace},
    };
    const context = {settings, options: {}, computedCache: new Map()};

    try {
      await ScreenshotThumbnailsAudit.audit(artifacts, context);
      assert.fail('should have thrown');
    } catch (err) {
      assert.equal(err.message, 'INVALID_SPEEDLINE');
    }
  });
});
