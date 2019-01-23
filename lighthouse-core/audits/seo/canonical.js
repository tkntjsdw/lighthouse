/**
 * @license Copyright 2017 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const Audit = require('../audit');
const URL = require('../../lib/url-shim');
const MainResource = require('../../computed/main-resource.js');

/**
 * Returns a primary domain for provided URL (e.g. http://www.example.com -> example.com).
 * Note that it does not take second-level domains into account (.co.uk).
 * @param {URL} url
 * @returns {string}
 */
function getPrimaryDomain(url) {
  return url.hostname.split('.').slice(-2).join('.');
}

class Canonical extends Audit {
  /**
   * @return {LH.Audit.Meta}
   */
  static get meta() {
    return {
      id: 'canonical',
      title: 'Document has a valid `rel=canonical`',
      failureTitle: 'Document does not have a valid `rel=canonical`',
      description: 'Canonical links suggest which URL to show in search results. ' +
        '[Learn more](https://developers.google.com/web/tools/lighthouse/audits/canonical).',
      requiredArtifacts: ['LinkElements', 'URL'],
    };
  }

  /**
   * @param {LH.Artifacts} artifacts
   * @param {LH.Audit.Context} context
   * @return {Promise<LH.Audit.Product>}
   */
  static async audit(artifacts, context) {
    const devtoolsLog = artifacts.devtoolsLogs[Audit.DEFAULT_PASS];

    const mainResource = await MainResource.request({devtoolsLog, URL: artifacts.URL}, context);
    const baseURL = new URL(mainResource.url);

    /** @type {Set<string>} */
    const uniqueCanonicalURLs = new Set();
    /** @type {string[]} */
    const hreflangURLs = [];

    /** @type {LH.Artifacts.LinkElement|undefined} */
    let invalidCanonicalLink;
    /** @type {LH.Artifacts.LinkElement|undefined} */
    let relativeCanonicallink;
    for (const link of artifacts.LinkElements) {
      if (link.source === 'body') continue;

      if (link.rel === 'canonical') {
        if (!link.hrefRaw) continue;

        if (!link.href) invalidCanonicalLink = link;
        else if (!URL.isValid(link.hrefRaw)) relativeCanonicallink = link;
        else uniqueCanonicalURLs.add(link.href);
      } else if (link.rel === 'alternate') {
        if (link.href && link.hreflang) hreflangURLs.push(link.href);
      }
    }

    // the canonical link is totally invalid
    if (invalidCanonicalLink) {
      return {
        rawValue: false,
        explanation: `Invalid URL (${invalidCanonicalLink.hrefRaw})`,
      };
    }

    // the canonical link is valid, but it's relative which isn't allowed
    if (relativeCanonicallink) {
      return {
        rawValue: false,
        explanation: `Relative URL (${relativeCanonicallink.hrefRaw})`,
      };
    }

    /** @type {string[]} */
    const canonicalURLs = Array.from(uniqueCanonicalURLs);

    // there's no canonical URL at all, we're done
    if (canonicalURLs.length === 0) {
      return {
        rawValue: true,
        notApplicable: true,
      };
    }

    // we have multiple conflicting canonical URls, we're done
    if (canonicalURLs.length > 1) {
      return {
        rawValue: false,
        explanation: `Multiple conflicting URLs (${canonicalURLs.join(', ')})`,
      };
    }

    const canonicalURL = new URL(canonicalURLs[0]);

    // cross-language or cross-country canonicals are a common issue
    if (hreflangURLs.includes(baseURL.href) && hreflangURLs.includes(canonicalURL.href) &&
      baseURL.href !== canonicalURL.href) {
      return {
        rawValue: false,
        explanation: `Points to another hreflang location (${baseURL.href})`,
      };
    }

    // bing and yahoo don't allow canonical URLs pointing to different domains, it's also
    // a common mistake to publish a page with canonical pointing to e.g. a test domain or localhost
    if (getPrimaryDomain(canonicalURL) !== getPrimaryDomain(baseURL)) {
      return {
        rawValue: false,
        explanation: `Points to a different domain (${canonicalURL})`,
      };
    }

    // another common mistake is to have canonical pointing from all pages of the website to its root
    if (canonicalURL.origin === baseURL.origin &&
      canonicalURL.pathname === '/' && baseURL.pathname !== '/') {
      return {
        rawValue: false,
        explanation: 'Points to a root of the same origin',
      };
    }

    return {
      rawValue: true,
    };
  }
}

module.exports = Canonical;
