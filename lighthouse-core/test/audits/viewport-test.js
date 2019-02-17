/**
 * @license Copyright 2016 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const Audit = require('../../audits/viewport.js');
const assert = require('assert');

/* eslint-env jest */

describe('Mobile-friendly: viewport audit', () => {
  const makeMetaElements = viewport => [{name: 'viewport', content: viewport}];
  const fakeContext = {computedCache: new Map()};

  it('fails when HTML does not contain a viewport meta tag', async () => {
    const auditResult = await Audit.audit({
      MetaElements: [],
    }, fakeContext);
    return assert.equal(auditResult.rawValue, false);
  });

  it('fails when HTML contains a non-mobile friendly viewport meta tag', async () => {
    const viewport = 'maximum-scale=1';
    const auditResult = await Audit.audit({MetaElements: makeMetaElements(viewport)}, fakeContext);
    assert.equal(auditResult.rawValue, false);
    assert.equal(auditResult.warnings[0], undefined);
  });

  it('fails when HTML contains an invalid viewport meta tag key', async () => {
    const viewport = 'nonsense=true';
    const auditResult = await Audit.audit({MetaElements: makeMetaElements(viewport)}, fakeContext);
    assert.equal(auditResult.rawValue, false);
    assert.equal(auditResult.warnings[0], 'Invalid properties found: {"nonsense":"true"}');
  });

  it('fails when HTML contains an invalid viewport meta tag value', async () => {
    const viewport = 'initial-scale=microscopic';
    const auditResult = await Audit.audit({MetaElements: makeMetaElements(viewport)}, fakeContext);
    assert.equal(auditResult.rawValue, false);
    assert.equal(auditResult.warnings[0], 'Invalid values found: {"initial-scale":"microscopic"}');
  });

  it('fails when HTML contains an invalid viewport meta tag key and value', async () => {
    const viewport = 'nonsense=true, initial-scale=microscopic';
    const {rawValue, warnings} =
      await Audit.audit({MetaElements: makeMetaElements(viewport)}, fakeContext);
    assert.equal(rawValue, false);
    assert.equal(warnings[0], 'Invalid properties found: {"nonsense":"true"}');
    assert.equal(warnings[1], 'Invalid values found: {"initial-scale":"microscopic"}');
  });

  it('passes when a valid viewport is provided', async () => {
    const viewports = [
      'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1',
      'width = device-width, initial-scale = 1',
      'initial-scale=1',
      'width=device-width     ',
    ];
    await Promise.all(viewports.map(async viewport => {
      const auditResult = await Audit.audit({
        MetaElements: makeMetaElements(viewport),
      }, fakeContext);
      assert.equal(auditResult.rawValue, true);
    }));
  });

  it('doesn\'t throw when viewport contains "invalid" iOS properties', async () => {
    const viewports = [
      'width=device-width, shrink-to-fit=no',
      'width=device-width, viewport-fit=cover',
    ];
    await Promise.all(viewports.map(async viewport => {
      const result = await Audit.audit({MetaElements: makeMetaElements(viewport)}, fakeContext);
      assert.equal(result.rawValue, true);
      assert.equal(result.warnings[0], undefined);
    }));
  });
});
