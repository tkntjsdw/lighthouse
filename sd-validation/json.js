/**
 * @license Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const jsonlint = require('jsonlint-mod');

/**
 * @param {string} input
 * @returns {{message: string, line: string|null}|null}
 */
module.exports = function parseJSON(input) {
  try {
    jsonlint.parse(input);
  } catch (error) {
    let line = error.at;
    let message = error.message;

    // extract line number from message
    if (!line) {
      const regexLineResult = error.message.match(/Parse error on line (\d+)/);

      if (regexLineResult) {
        line = regexLineResult[1];
      }
    }

    // jsonlint error message points to a specific character, but we just want the message.
    // Example:
    //    ---------^
    //    Unexpected character {
    const regexMessageResult = error.message.match(/-+\^\n(.+)$/);

    if (regexMessageResult) {
      message = regexMessageResult[1];
    }

    return {
      message,
      line,
    };
  }

  return null;
};
