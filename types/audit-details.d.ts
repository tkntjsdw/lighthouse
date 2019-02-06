/**
 * @license Copyright 2019 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

declare global {
  module LH.Audit {
    export type Details =
      Details.CriticalRequestChain |
      Details.Diagnostic |
      Details.Filmstrip |
      Details.Opportunity |
      Details.Screenshot |
      Details.Table;

    // Details namespace.
    export module Details {
      export interface CriticalRequestChain {
        type: 'criticalrequestchain';
        longestChain: {
          duration: number;
          length: number;
          transferSize: number;
        };
        chains: Audit.SimpleCriticalRequestNode;
      }

      export interface Filmstrip {
        type: 'filmstrip';
        scale: number;
        items: {
          /** The relative time from navigationStart to this frame, in milliseconds. */
          timing: number;
          /** The raw timestamp of this frame, in microseconds. */
          timestamp: number;
          /** The data URL encoding of this frame. */
          data: string;
        }[];
      }

      export interface Opportunity {
        type: 'opportunity';
        overallSavingsMs: number;
        overallSavingsBytes?: number;
        headings: OpportunityColumnHeading[];
        items: OpportunityItem[];
      }

      export interface Screenshot {
        type: 'screenshot';
        timestamp: number;
        data: string;
      }

      // TODO(bckenny): unify Table/Opportunity headings and items on next breaking change.
      export interface Table {
        type: 'table';
        headings: TableColumnHeading[];
        items: TableItem[];
        summary?: {
          wastedMs?: number;
          wastedBytes?: number;
        };
        diagnostic?: Diagnostic;
      }

      /**
       * A details type that is not rendered in the final report; usually used
       * for including diagnostic information in the LHR. Can contain anything.
       */
      export interface Diagnostic {
        type: 'diagnostic';
        [p: string]: any;
      }

      // Contents of details below here

      export interface TableColumnHeading {
        /** The name of the property within items being described. */
        key: string;
        /** Readable text label of the field. */
        text: string;
        /** The data format of the column of values being described. */
        itemType: ItemValueTypes;

        displayUnit?: string;
        granularity?: number;
      }

      export interface OpportunityColumnHeading {
        /** The name of the property within items being described. */
        key: string;
        /** Readable text label of the field. */
        label: string;
        /** The data format of the column of values being described. */
        valueType: ItemValueTypes;

        // NOTE: not used by opportunity details, but used in the renderer until unification.
        displayUnit?: string;
        granularity?: number;
      }

      type ItemValueTypes = 'bytes' | 'code' | 'link' | 'ms' | 'node' | 'numeric' | 'text' | 'thumbnail' | 'timespanMs' | 'url';

      export interface OpportunityItem {
        url: string;
        wastedBytes?: number;
        totalBytes?: number;
        wastedMs?: number;
        diagnostic?: Diagnostic;
        [p: string]: number | boolean | string | undefined | Diagnostic;
      }

      export type TableItem = {
        diagnostic?: Diagnostic;
        [p: string]: string | number | boolean | undefined | Diagnostic | NodeValue | LinkValue | UrlValue | CodeValue;
      }

      // TODO(bckenny): docs for these

      export interface CodeValue {
        type: 'code';
        value: string;
      }

      export interface LinkValue {
        type: 'link',
        text: string;
        url: string;
      }

      /** An HTML Node value used in items. */
      export interface NodeValue {
        type: 'node';
        path?: string;
        selector?: string;
        snippet?: string;
      }

      export interface UrlValue {
        type: 'url';
        value: string;
      }
    }
  }
}

// empty export to keep file a module
export {}
