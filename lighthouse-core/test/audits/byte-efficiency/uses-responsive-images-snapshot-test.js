/**
 * @license Copyright 2021 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const UsesResponsiveImagesSnapshot =
    require('../../../audits/byte-efficiency/uses-responsive-images-snapshot.js');

/* eslint-env jest */

/**
 * @param {Partial<LH.Artifacts.ImageElement>=} partial
 * @return {LH.Artifacts.ImageElement}
 */
function mockElement(partial = {}) {
  return {
    src: 'https://www.paulirish.com/avatar150.jpg',
    srcset: '',
    displayedWidth: 200,
    displayedHeight: 200,
    clientRect: {
      top: 50,
      bottom: 250,
      left: 50,
      right: 250,
    },
    attributeWidth: '',
    attributeHeight: '',
    naturalDimensions: undefined,
    cssEffectiveRules: undefined,
    computedStyles: {position: 'absolute', objectFit: '', imageRendering: ''},
    isCss: false,
    isPicture: false,
    isInShadowDOM: false,
    node: {
      lhId: '__nodeid__',
      devtoolsNodePath: '1,HTML,1,BODY,1,DIV,1,IMG',
      selector: 'body > div > img',
      nodeLabel: 'img',
      snippet: '<img src="https://www.paulirish.com/avatar150.jpg">',
      boundingRect: {
        top: 50,
        bottom: 250,
        left: 50,
        right: 250,
        width: 200,
        height: 200,
      },
    },
    ...partial,
  };
}

it('reports images that are bigger than displayed dimensions', async () => {
  const artifacts = {
    ImageElements: [
      mockElement({naturalDimensions: {width: 500, height: 500}}),
    ],
    ViewportDimensions: {
      width: 500,
      height: 500,
      devicePixelRatio: 1,
    },
  };

  const result = await UsesResponsiveImagesSnapshot.audit(artifacts);

  expect(result.score).toEqual(0);
  expect(result.details.items).toEqual([
    {
      actualDimensions: '500x500',
      displayedDimensions: '200x200',
      url: 'https://www.paulirish.com/avatar150.jpg',
    },
  ]);
});

it('ignores images smaller or equal to displayed dimensions', async () => {
  const artifacts = {
    ImageElements: [
      mockElement({naturalDimensions: {width: 200, height: 200}}),
      mockElement({naturalDimensions: {width: 40, height: 40}}),
    ],
    ViewportDimensions: {
      width: 500,
      height: 500,
      devicePixelRatio: 1,
    },
  };

  const result = await UsesResponsiveImagesSnapshot.audit(artifacts);

  expect(result.score).toEqual(1);
  expect(result.details.items).toEqual([]);
});

it('ignores images with no natural dimensions', async () => {
  const artifacts = {
    ImageElements: [
      mockElement(),
    ],
    ViewportDimensions: {
      width: 500,
      height: 500,
      devicePixelRatio: 1,
    },
  };

  const result = await UsesResponsiveImagesSnapshot.audit(artifacts);

  expect(result.score).toEqual(1);
  expect(result.details.items).toEqual([]);
});

it('uses pixel ratio to compute used pixels', async () => {
  const artifacts = {
    ImageElements: [
      mockElement({naturalDimensions: {width: 400, height: 400}}),
      mockElement({naturalDimensions: {width: 500, height: 500}}),
    ],
    ViewportDimensions: {
      width: 500,
      height: 500,
      devicePixelRatio: 2,
    },
  };

  const result = await UsesResponsiveImagesSnapshot.audit(artifacts);

  expect(result.score).toEqual(0);
  expect(result.details.items).toEqual([
    {
      actualDimensions: '500x500',
      displayedDimensions: '400x400',
      url: 'https://www.paulirish.com/avatar150.jpg',
    },
  ]);
});

it('passes if pixel difference is within the threshold', async () => {
  const artifacts = {
    ImageElements: [
      mockElement({naturalDimensions: {width: 201, height: 200}}),
    ],
    ViewportDimensions: {
      width: 500,
      height: 500,
      devicePixelRatio: 1,
    },
  };

  const result = await UsesResponsiveImagesSnapshot.audit(artifacts);

  expect(result.score).toEqual(1);
  expect(result.details.items).toEqual([
    {
      actualDimensions: '201x200',
      displayedDimensions: '200x200',
      url: 'https://www.paulirish.com/avatar150.jpg',
    },
  ]);
});
