/**
 * @license Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

/* eslint-env jest */

const {
  createMockContext,
  mockDriverSubmodules,
} = require('../../fraggle-rock/gather/mock-driver.js');
const mocks = mockDriverSubmodules();
const FullPageScreenshotGatherer = require('../../../gather/gatherers/full-page-screenshot.js');

// Headless's default value is (1024 * 16), but this varies by device
const maxTextureSizeMock = 1024 * 8;

/** @type {{width: number, height: number}} */
let contentSize;
/** @type {{width?: number, height?: number, dpr: number}} */
let screenSize;
/** @type {string[]} */
let screenshotData;
let mockContext = createMockContext();

beforeEach(() => {
  contentSize = {width: 100, height: 100};
  screenSize = {dpr: 1};
  screenshotData = [];
  mockContext = createMockContext();
  mockContext.driver.defaultSession.sendCommand.mockImplementation(method => {
    if (method === 'Page.getLayoutMetrics') {
      return {
        contentSize,
        // See comment within _takeScreenshot() implementation
        layoutViewport: {clientWidth: contentSize.width, clientHeight: contentSize.height},
      };
    }
    if (method === 'Page.captureScreenshot') {
      return {
        data: screenshotData && screenshotData.length ? screenshotData.shift() : 'abc',
      };
    }
  });
  mockContext.driver._executionContext.evaluate.mockImplementation(fn => {
    if (fn.name === 'resolveNodes') {
      return {};
    } if (fn.name === 'getMaxTextureSize') {
      return maxTextureSizeMock;
    } else if (fn.name === 'getObservedDeviceMetrics') {
      return {
        width: screenSize.width,
        height: screenSize.height,
        screenWidth: screenSize.width,
        screenHeight: screenSize.height,
        screenOrientation: {
          type: 'landscapePrimary',
          angle: 30,
        },
        deviceScaleFactor: screenSize.dpr,
      };
    } else {
      throw new Error(`unexpected fn ${fn.name}`);
    }
  });
  mocks.reset();
});

describe('FullPageScreenshot gatherer', () => {
  it('captures a full-page screenshot', async () => {
    const fpsGatherer = new FullPageScreenshotGatherer();
    contentSize = {width: 412, height: 2000};

    mockContext.settings = {
      formFactor: 'mobile',
      screenEmulation: {
        mobile: true,
        disabled: false,
      },
    };
    const artifact = await fpsGatherer.getArtifact(mockContext.asContext());

    expect(artifact).toEqual({
      screenshot: {
        data: 'data:image/jpeg;base64,abc',
        height: 2000,
        width: 412,
      },
      nodes: {},
    });
  });

  it('resets the emulation correctly when Lighthouse controls it', async () => {
    const fpsGatherer = new FullPageScreenshotGatherer();
    contentSize = {width: 412, height: 2000};
    mockContext.settings = {
      formFactor: 'mobile',
      screenEmulation: {
        mobile: true,
        disabled: false,
      },
    };

    await fpsGatherer.getArtifact(mockContext.asContext());

    const expectedArgs = {formFactor: 'mobile', screenEmulation: {disabled: false, mobile: true}};
    expect(mocks.emulationMock.emulate).toHaveBeenCalledTimes(1);
    expect(mocks.emulationMock.emulate).toHaveBeenCalledWith(
      mockContext.driver.defaultSession,
      expectedArgs
    );
  });

  it('resets the emulation correctly when Lighthouse does not control it', async () => {
    const fpsGatherer = new FullPageScreenshotGatherer();
    contentSize = {width: 500, height: 1500};
    screenSize = {width: 500, height: 500, dpr: 2};
    mockContext.settings = {
      screenEmulation: {
        mobile: true,
        disabled: true,
      },
      formFactor: 'mobile',
    };

    await fpsGatherer.getArtifact(mockContext.asContext());

    // Setting up for screenshot.
    expect(mockContext.driver.defaultSession.sendCommand).toHaveBeenCalledWith(
      'Emulation.setDeviceMetricsOverride',
      expect.objectContaining({
        mobile: true,
        deviceScaleFactor: 1,
        height: 1500,
        width: 500,
      })
    );

    // Restoring.
    expect(mockContext.driver.defaultSession.sendCommand).toHaveBeenCalledWith(
      'Emulation.setDeviceMetricsOverride',
      expect.objectContaining({
        mobile: true,
        deviceScaleFactor: 2,
        height: 500,
        width: 500,
        screenOrientation: {
          type: 'landscapePrimary',
          angle: 30,
        },
      })
    );
  });

  it('limits the screenshot height to the max Chrome can capture', async () => {
    const fpsGatherer = new FullPageScreenshotGatherer();

    contentSize = {width: 412, height: 100000};
    screenSize = {dpr: 1};
    mockContext.settings = {
      formFactor: 'mobile',
      screenEmulation: {
        mobile: true,
        disabled: false,
      },
    };

    await fpsGatherer.getArtifact(mockContext.asContext());

    expect(mockContext.driver.defaultSession.sendCommand).toHaveBeenCalledWith(
      'Emulation.setDeviceMetricsOverride',
      expect.objectContaining({
        deviceScaleFactor: 1,
        height: maxTextureSizeMock,
      })
    );
  });
});
