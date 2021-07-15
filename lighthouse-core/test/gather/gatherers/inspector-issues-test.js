/**
 * @license Copyright 2021 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

/* eslint-env jest */

const InspectorIssues = require('../../../gather/gatherers/inspector-issues.js');
const NetworkRequest = require('../../../lib/network-request.js');
const {createMockContext} = require('../../fraggle-rock/gather/mock-driver.js');
const {flushAllTimersAndMicrotasks} = require('../../test-utils.js');
const networkRecordsToDevtoolsLog = require('../../network-records-to-devtools-log.js');

jest.useFakeTimers();

/**
 * @param {Partial<LH.Artifacts.NetworkRequest>=} partial
 * @return {LH.Artifacts.NetworkRequest}
 */
function mockRequest(partial) {
  return Object.assign(new NetworkRequest(), {
    url: 'https://example.com',
    documentURL: 'https://example.com',
    finished: true,
    frameId: 'frameId',
    isSecure: true,
    isValid: true,
    parsedURL: {scheme: 'https'},
    protocol: 'http/1.1',
    requestMethod: 'GET',
    resourceType: 'Document',
    ...partial,
  });
}

/**
 * @param {Partial<LH.Crdp.Audits.MixedContentIssueDetails>=} details
 * @return {LH.Crdp.Audits.InspectorIssue} partial
 */
function mockMixedContent(details) {
  return {
    code: 'MixedContentIssue',
    details: {
      mixedContentIssueDetails: {
        resolutionStatus: 'MixedContentBlocked',
        insecureURL: 'https://example.com',
        mainResourceURL: 'https://example.com',
        ...details,
      },
    },
  };
}

/**
 * @param {Partial<LH.Crdp.Audits.SameSiteCookieIssueDetails>=} details
 * @return {LH.Crdp.Audits.InspectorIssue} partial
 */
function mockSameSiteCookie(details) {
  return {
    code: 'SameSiteCookieIssue',
    details: {
      sameSiteCookieIssueDetails: {
        cookie: {
          name: 'name',
          path: 'path',
          domain: 'domain',
        },
        cookieWarningReasons: [],
        cookieExclusionReasons: [],
        operation: 'ReadCookie',
        ...details,
      },
    },
  };
}

/**
 * @param {Partial<LH.Crdp.Audits.BlockedByResponseIssueDetails>=} details
 * @return {LH.Crdp.Audits.InspectorIssue} partial
 */
function mockBlockedByResponse(details) {
  return {
    code: 'BlockedByResponseIssue',
    details: {
      blockedByResponseIssueDetails: {
        request: {requestId: '1'},
        reason: 'CorpNotSameOrigin',
        ...details,
      },
    },
  };
}

/**
 * @param {Partial<LH.Crdp.Audits.HeavyAdIssueDetails>=} details
 * @return {LH.Crdp.Audits.InspectorIssue} partial
 */
function mockHeavyAd(details) {
  return {
    code: 'HeavyAdIssue',
    details: {
      heavyAdIssueDetails: {
        resolution: 'HeavyAdBlocked',
        reason: 'CpuPeakLimit',
        frame: {
          frameId: 'frameId',
        },
        ...details,
      },
    },
  };
}

/**
 * @param {Partial<LH.Crdp.Audits.ContentSecurityPolicyIssueDetails>=} details
 * @return {LH.Crdp.Audits.InspectorIssue} partial
 */
function mockCSP(details) {
  return {
    code: 'ContentSecurityPolicyIssue',
    details: {
      contentSecurityPolicyIssueDetails: {
        violatedDirective: 'default-drc',
        isReportOnly: false,
        contentSecurityPolicyViolationType: 'kInlineViolation',
        ...details,
      },
    },
  };
}

describe('instrumentation', () => {
  it('collects inspector issues', async () => {
    const mockContext = createMockContext();
    mockContext.driver.defaultSession.on
      .mockEvent('Audits.issueAdded', {issue: mockMixedContent()})
      .mockEvent('Audits.issueAdded', {issue: mockSameSiteCookie()});
    mockContext.driver.defaultSession.sendCommand
      .mockResponse('Audits.enable')
      .mockResponse('Audits.disable');
    const gatherer = new InspectorIssues();

    await gatherer.startInstrumentation(mockContext.asContext());
    await flushAllTimersAndMicrotasks();
    await gatherer.stopInstrumentation(mockContext.asContext());

    expect(gatherer._issues).toEqual([
      mockMixedContent(),
      mockSameSiteCookie(),
    ]);
  });
});

describe('_getArtifact', () => {
  it('takes 5 types of inspector issues', async () => {
    const gatherer = new InspectorIssues();
    gatherer._issues = [
      mockMixedContent({request: {requestId: '1'}}),
      mockSameSiteCookie({request: {requestId: '2'}}),
      mockBlockedByResponse({request: {requestId: '3'}}),
      mockHeavyAd(),
      mockCSP(),
    ];
    const networkRecords = [
      mockRequest({requestId: '1'}),
      mockRequest({requestId: '2'}),
      mockRequest({requestId: '3'}),
    ];

    const artifact = await gatherer._getArtifact(networkRecords);

    expect(artifact).toEqual({
      mixedContent: [{
        request: {requestId: '1'},
        resolutionStatus: 'MixedContentBlocked',
        insecureURL: 'https://example.com',
        mainResourceURL: 'https://example.com',
      }],
      sameSiteCookies: [{
        request: {requestId: '2'},
        cookie: {
          name: 'name',
          path: 'path',
          domain: 'domain',
        },
        cookieWarningReasons: [],
        cookieExclusionReasons: [],
        operation: 'ReadCookie',
      }],
      blockedByResponse: [{
        request: {requestId: '3'},
        reason: 'CorpNotSameOrigin',
      }],
      heavyAds: [{
        resolution: 'HeavyAdBlocked',
        reason: 'CpuPeakLimit',
        frame: {
          frameId: 'frameId',
        },
      }],
      contentSecurityPolicy: [{
        violatedDirective: 'default-drc',
        isReportOnly: false,
        contentSecurityPolicyViolationType: 'kInlineViolation',
      }],
    });
  });

  it('dedupe by request id', async () => {
    const gatherer = new InspectorIssues();
    gatherer._issues = [
      mockMixedContent({request: {requestId: '1'}}),
      mockMixedContent({request: {requestId: '2'}}),
      mockSameSiteCookie({request: {requestId: '3'}}),
      mockSameSiteCookie({request: {requestId: '4'}}),
      mockBlockedByResponse({request: {requestId: '5'}}),
      mockBlockedByResponse({request: {requestId: '6'}}),
    ];
    const networkRecords = [
      mockRequest({requestId: '1'}),
      mockRequest({requestId: '3'}),
      mockRequest({requestId: '5'}),
    ];

    const artifact = await gatherer._getArtifact(networkRecords);

    expect(artifact).toEqual({
      mixedContent: [{
        request: {requestId: '1'},
        resolutionStatus: 'MixedContentBlocked',
        insecureURL: 'https://example.com',
        mainResourceURL: 'https://example.com',
      }],
      sameSiteCookies: [{
        request: {requestId: '3'},
        cookie: {
          name: 'name',
          path: 'path',
          domain: 'domain',
        },
        cookieWarningReasons: [],
        cookieExclusionReasons: [],
        operation: 'ReadCookie',
      }],
      blockedByResponse: [{
        request: {requestId: '5'},
        reason: 'CorpNotSameOrigin',
      }],
      heavyAds: [],
      contentSecurityPolicy: [],
    });
  });
});

describe('FR compat', () => {
  let mockContext = createMockContext();
  /** @type {InspectorIssues} */
  let gatherer;
  /** @type {LH.Artifacts.NetworkRequest[]} */
  let networkRecords;
  /** @type {LH.DevtoolsLog} */
  let devtoolsLog;

  beforeEach(() => {
    gatherer = new InspectorIssues();
    mockContext = createMockContext();
    mockContext.driver.defaultSession.sendCommand
      .mockResponse('Audits.enable')
      .mockResponse('Audits.disable');
    mockContext.driver.defaultSession.on
      .mockEvent('Audits.issueAdded', {
        issue: mockMixedContent({request: {requestId: '1'}}),
      });
    networkRecords = [
      mockRequest({requestId: '1'}),
    ];
    devtoolsLog = networkRecordsToDevtoolsLog(networkRecords);
  });

  it('uses loadData in legacy mode', async () => {
    const loadData = {
      devtoolsLog,
      networkRecords,
    };
    await gatherer.beforePass(mockContext.asLegacyContext());
    await flushAllTimersAndMicrotasks();

    const artifact = await gatherer.afterPass(mockContext.asLegacyContext(), loadData);

    expect(artifact).toEqual({
      mixedContent: [{
        request: {requestId: '1'},
        resolutionStatus: 'MixedContentBlocked',
        insecureURL: 'https://example.com',
        mainResourceURL: 'https://example.com',
      }],
      sameSiteCookies: [],
      blockedByResponse: [],
      heavyAds: [],
      contentSecurityPolicy: [],
    });
  });

  it('uses dependencies in FR', async () => {
    const context = {
      ...mockContext.asContext(),
      dependencies: {DevtoolsLog: devtoolsLog},
    };
    await gatherer.startInstrumentation(context);
    await flushAllTimersAndMicrotasks();
    await gatherer.stopInstrumentation(context);

    const artifact = await gatherer.getArtifact(context);

    expect(artifact).toEqual({
      mixedContent: [{
        request: {requestId: '1'},
        resolutionStatus: 'MixedContentBlocked',
        insecureURL: 'https://example.com',
        mainResourceURL: 'https://example.com',
      }],
      sameSiteCookies: [],
      blockedByResponse: [],
      heavyAds: [],
      contentSecurityPolicy: [],
    });
  });
});
