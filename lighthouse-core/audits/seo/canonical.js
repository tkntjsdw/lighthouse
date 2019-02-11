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
  return url.hostname
    .split('.')
    .slice(-2)
    .join('.');
}

/**
 * @typedef CanonicalURLData
 * @property {Set<string>} uniqueCanonicalURLs
 * @property {Set<string>} hreflangURLs
 * @property {LH.Artifacts.LinkElement|undefined} invalidCanonicalLink
 * @property {LH.Artifacts.LinkElement|undefined} relativeCanonicallink
 */

class Canonical extends Audit {
  /**
   * @return {LH.Audit.Meta}
   */
  static get meta() {
    return {
      id: 'canonical',
      title: 'Document has a valid `rel=canonical`',
      failureTitle: 'Document does not have a valid `rel=canonical`',
      description:
        'Canonical links suggest which URL to show in search results. ' +
        '[Learn more](https://developers.google.com/web/tools/lighthouse/audits/canonical).',
      requiredArtifacts: ['LinkElements', 'URL'],
    };
  }

  /**
   * @param {LH.Artifacts} artifacts
   * @return {CanonicalURLData}
   */
  static collectCanonicalURLs(artifacts) {
    /** @type {Set<string>} */
    const uniqueCanonicalURLs = new Set();
    /** @type {Set<string>} */
    const hreflangURLs = new Set();

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
        if (link.href && link.hreflang) hreflangURLs.add(link.href);
      }
    }

    return {uniqueCanonicalURLs, hreflangURLs, invalidCanonicalLink, relativeCanonicallink};
  }

  /**
   * @param {CanonicalURLData} canonicalURLData
   * @return {string|LH.Audit.Product}
   */
  static findValidCanonicaURLOrFinish(canonicalURLData) {
    const {uniqueCanonicalURLs, invalidCanonicalLink, relativeCanonicallink} = canonicalURLData;

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

    return canonicalURLs[0];
  }

  /**
   * @param {CanonicalURLData} canonicalURLData
   * @param {URL} canonicalURL
   * @param {URL} baseURL
   * @return {LH.Audit.Product|undefined}
   */
  static findCommonCanonicalURLMistakes(canonicalURLData, canonicalURL, baseURL) {
    const {hreflangURLs} = canonicalURLData;

    // cross-language or cross-country canonicals are a common issue
    if (
      hreflangURLs.has(baseURL.href) &&
      hreflangURLs.has(canonicalURL.href) &&
      baseURL.href !== canonicalURL.href
    ) {
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
    if (
      canonicalURL.origin === baseURL.origin &&
      canonicalURL.pathname === '/' &&
      baseURL.pathname !== '/'
    ) {
      return {
        rawValue: false,
        explanation: 'Points to a root of the same origin',
      };
    }
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

    const canonicalURLData = Canonical.collectCanonicalURLs(artifacts);
    const canonicalURLOrAuditProduct = Canonical.findValidCanonicaURLOrFinish(canonicalURLData);
    // We didn't find a valid canonical URL, we found an error result so go ahead and return it.
    if (typeof canonicalURLOrAuditProduct === 'object') return canonicalURLOrAuditProduct;

    // We found a valid canonical URL, so we'll just check for common mistakes.
    const canonicalURL = new URL(canonicalURLOrAuditProduct);
    const mistakeAuditProduct = Canonical.findCommonCanonicalURLMistakes(
      canonicalURLData,
      canonicalURL,
      baseURL
    );

    if (mistakeAuditProduct) return mistakeAuditProduct;

    return {
      rawValue: true,
    };
  }
}

module.exports = Canonical;
