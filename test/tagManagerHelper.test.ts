/**
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { TagManagerHelper } from '../src/util/TagManagerHelper';

describe('TagMangerHelper', () => {
  describe('updateListParameter', () => {
    it('Updates existing user properties', () => {
      const tag = {
        monitoringMetadata: {
          map: [
            {
              value: 'event_metadata_value',
              type: 'template',
              key: 'event_metadata',
            },
          ],
          type: 'map',
        },
        parameter: [
          { value: 'false', key: 'sendEcommerceData', type: 'boolean' },
          {
            key: 'userProperties',
            type: 'list',
            list: [
              {
                type: 'map',
                map: [
                  {
                    value: 'ga4_user_prop',
                    type: 'template',
                    key: 'fieldName',
                  },
                  { value: '22', type: 'template', key: 'value' },
                ],
              },
            ],
          },
          { type: 'template', value: 'some-name', key: 'eventName' },
          {
            type: 'list',
            list: [
              {
                map: [
                  {
                    value: 'ga4_event_param',
                    key: 'fieldName',
                    type: 'template',
                  },
                  { type: 'template', value: '11', key: 'value' },
                ],
                type: 'map',
              },
            ],
            key: 'eventParameters',
          },
          {
            value: 'GA4 Configuration',
            type: 'tagReference',
            key: 'measurementId',
          },
        ],
        tagFiringOption: 'oncePerEvent',
        type: 'sgtmgaaw',
        name: 'GA4 Event',
        consentSettings: { consentStatus: 'notSet' },
      };

      const userProperties = {
        list: [
          {
            map: [
              {
                type: 'template',
                value: 'config_user_property',
                key: 'name',
              },
              { value: 'property_value', type: 'template', key: 'value' },
            ],
            type: 'map',
          },
        ],
        type: 'list',
        key: 'userProperties',
      };

      TagManagerHelper.updateListParameter(tag, userProperties);

      const res = tag.parameter
        .find(p => p.key === 'userProperties')!
        .list?.map(l => JSON.stringify(l))
        .includes(JSON.stringify(userProperties.list[0]));

      expect(res).toBe(true);
    });
  });

  describe('setTagParameter', () => {
    it('Properly sets Tag parameter', () => {
      const tag = {
        consentSettings: { consentStatus: 'notSet' },
        name: 'GA4 Event',
        type: 'sgtmgaaw',
        monitoringMetadata: {
          map: [
            {
              value: 'event_metadata_value',
              key: 'event_metadata',
              type: 'template',
            },
            { key: 'metadata_1', value: 'metadata_1_value', type: 'template' },
          ],
          type: 'map',
        },
        tagFiringOption: 'oncePerEvent',
        parameter: [
          { value: 'false', type: 'boolean', key: 'sendEcommerceData' },
          {
            key: 'userProperties',
            type: 'list',
            list: [
              {
                map: [
                  {
                    type: 'template',
                    value: 'ga4_user_prop',
                    key: 'fieldName',
                  },
                  { key: 'value', value: '22', type: 'template' },
                ],
                type: 'map',
              },
            ],
          },
          { value: 'some-name', key: 'eventName', type: 'template' },
          {
            list: [
              {
                map: [
                  {
                    type: 'template',
                    value: 'ga4_event_param',
                    key: 'fieldName',
                  },
                  { key: 'value', value: '11', type: 'template' },
                ],
                type: 'map',
              },
            ],
            key: 'eventParameters',
            type: 'list',
          },
          {
            key: 'measurementId',
            value: 'GA4 Configuration',
            type: 'tagReference',
          },
        ],
      };

      TagManagerHelper.setTagParameter(
        tag,
        'measurementId',
        'template',
        '{{GA4ID}}'
      );

      expect(tag.parameter.find(p => p.key === 'measurementId')?.value).toEqual(
        '{{GA4ID}}'
      );
    });
  });
});
