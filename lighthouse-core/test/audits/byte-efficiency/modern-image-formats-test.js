/**
 * @license Copyright 2019 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const ModernImageFormats = require('../../../audits/byte-efficiency/modern-image-formats.js');

function generateArtifacts(images) {
  const optimizedImages = [];
  const imageElements = [];

  for (const image of images) {
    let {type = 'jpeg'} = image;
    const isData = /^data:/.test(type);
    if (isData) {
      type = type.slice('data:'.length);
    }

    const mimeType = image.mimeType || `image/${type}`;
    const url = isData
      ? `data:${mimeType};base64,reaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaly ` +
        'reaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaly long'
      : `http://google.com/image.${type}`;

    optimizedImages.push({
      url,
      mimeType,
      ...image,
    });

    imageElements.push({
      src: url,
      naturalDimensions: image,
    });
  }

  return {
    GatherContext: {gatherMode: 'navigation'},
    URL: {finalUrl: 'http://google.com/'},
    ImageElements: imageElements,
    OptimizedImages: optimizedImages,
  };
}

/* eslint-env jest */

describe('Page uses optimized images', () => {
  it('ignores files when there is only insignificant savings', () => {
    const artifacts = generateArtifacts([{originalSize: 5000, jpegSize: 10000, webpSize: 4500}]);
    const auditResult = ModernImageFormats.audit_(artifacts);

    expect(auditResult.items).toEqual([]);
  });

  it('flags files using AVIF savings', () => {
    const artifacts = generateArtifacts([{originalSize: 15000, jpegSize: 8000, webpSize: 5000}]);
    const auditResult = ModernImageFormats.audit_(artifacts);

    expect(auditResult.items).toEqual([
      {
        fromProtocol: true,
        isCrossOrigin: false,
        totalBytes: 15000,
        wastedBytes: 15000 - (5000 * 0.8),
        wastedWebpBytes: 15000 - 5000,
        url: 'http://google.com/image.jpeg',
      },
    ]);
  });

  it('estimates savings on files without webpSize', () => {
    const artifacts = generateArtifacts([{originalSize: 1e6, width: 1000, height: 1000}]);
    const auditResult = ModernImageFormats.audit_(artifacts);

    expect(auditResult.items).toEqual([
      {
        fromProtocol: false,
        isCrossOrigin: false,
        totalBytes: 1e6,
        wastedBytes: Math.round(1e6 - 1000 * 1000 * 2 / 12),
        wastedWebpBytes: Math.round(1e6 - 1000 * 1000 * 2 / 10),
        url: 'http://google.com/image.jpeg',
      },
    ]);
  });

  it('estimates savings on cross-origin files', () => {
    const artifacts = generateArtifacts([{
      url: 'http://localhost:1234/image.jpg', originalSize: 50000, jpegSize: 50000, webpSize: 20000,
    }]);
    const auditResult = ModernImageFormats.audit_(artifacts);

    expect(auditResult.items).toMatchObject([
      {
        fromProtocol: true,
        isCrossOrigin: true,
        url: 'http://localhost:1234/image.jpg',
      },
    ]);
  });

  it('passes when all images are sufficiently optimized', () => {
    const artifacts = generateArtifacts([
      {type: 'png', originalSize: 50000, jpegSize: 100001, webpSize: 60001},
      {type: 'jpeg', originalSize: 50000, jpegSize: 100001, webpSize: 60001},
      {type: 'bmp', originalSize: 4000, webpSize: 5001},
    ]);

    const auditResult = ModernImageFormats.audit_(artifacts);

    expect(auditResult.items).toEqual([]);
  });

  it('passes when all images are already using a modern format', () => {
    const artifacts = generateArtifacts([
      {type: 'webp', originalSize: 50000, jpegSize: 100000, webpSize: 100000},
      {type: 'avif', originalSize: 50000, jpegSize: 100000, webpSize: 100000},
    ]);

    const auditResult = ModernImageFormats.audit_(artifacts);

    expect(auditResult.items).toEqual([]);
  });

  it('elides data URIs', () => {
    const artifacts = generateArtifacts([
      {type: 'data:jpeg', originalSize: 15000, jpegSize: 10000, webpSize: 4500},
    ]);

    const auditResult = ModernImageFormats.audit_(artifacts);

    expect(auditResult.items).toHaveLength(1);
    expect(auditResult.items[0].url).toMatch(/^data.{2,40}/);
  });

  it('warns when images have failed', () => {
    const artifacts = generateArtifacts([{failed: true, url: 'http://localhost/image.jpeg'}]);
    const auditResult = ModernImageFormats.audit_(artifacts);

    expect(auditResult.items).toHaveLength(0);
    expect(auditResult.warnings).toHaveLength(1);
  });

  it('warns when missing ImageElement', () => {
    const artifacts = generateArtifacts([{originalSize: 1e6}]);
    artifacts.ImageElements = [];
    const auditResult = ModernImageFormats.audit_(artifacts);

    expect(auditResult.items).toHaveLength(0);
    expect(auditResult.warnings).toHaveLength(1);
  });
});
