/**
 * @license Copyright 2019 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const Parser = require('metaviewport-parser');

const makeComputedArtifact = require('./computed-artifact.js');

class ViewportMeta {
  /**
   * @param {{MetaElements: LH.GathererArtifacts['MetaElements']}} artifacts
   * @return {Promise<LH.Artifacts.ViewportMeta>}
  */

  static async compute_({MetaElements}) {
    const viewportMeta = MetaElements.find(meta => meta.name === 'viewport');

    if (!viewportMeta) {
      return {
        hasViewportTag: false,
        hasMobileViewport: false,
        parserWarnings: [],
      };
    }

    const warnings = [];
    const parsedProps = Parser.parseMetaViewPortContent(viewportMeta.content || '');

    if (Object.keys(parsedProps.unknownProperties).length) {
      warnings.push(`Invalid properties found: ${JSON.stringify(parsedProps.unknownProperties)}`);
    }
    if (Object.keys(parsedProps.invalidValues).length) {
      warnings.push(`Invalid values found: ${JSON.stringify(parsedProps.invalidValues)}`);
    }

    const viewportProps = parsedProps.validProperties;
    const hasMobileViewport = Boolean(viewportProps.width || viewportProps['initial-scale']);

    return {
      hasMobileViewport,
      hasViewportTag: true,
      parserWarnings: warnings,
    };
  }
}

module.exports = makeComputedArtifact(ViewportMeta);
