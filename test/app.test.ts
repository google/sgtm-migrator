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
import { App } from '../src/app';
import { Action } from '../src/config';

describe('index', () => {
  const bootstrap = {
    accountIdWeb: 1,
    containerIdWeb: 2,
    workspaceIdWeb: 3,
    accountIdServer: 4,
    containerIdServer: 5,
    workspaceIdServer: 6,
    transportUrl: 'https://test.com',
    serverWorkspacePath: 'accounts/4/containers/5/workspaces/6',
    webWorkspacePath: 'accounts/1/containers/2/workspaces/3',
    override: false,
    measurementId: 'G-123456',
  };

  describe('applyMigrationChanges', () => {
    it('Applies migration changes', () => {
      const tag = {
        path: 'accounts/1234/containers/5678/workspaces/1/tags/2',
        firingTriggerId: ['24'],
        type: 'gaawe',
        accountId: '1234',
        parentFolderId: '42',
        consentSettings: { consentStatus: 'notSet' },
        fingerprint: '1234567890',
        tagId: '2',
        tagFiringOption: 'oncePerEvent',
        workspaceId: '1',
        tagManagerUrl:
          'https://tagmanager.google.com/#/container/accounts/1234/containers/5678/workspaces/1/tags/2?apiLink=tag',
        monitoringMetadata: { type: 'map' },
        name: 'GA4 - Event - Add to Cart',
        parameter: [
          { key: 'eventName', value: 'add_to_cart', type: 'template' },
          {
            value: 'GA4 - Config - Web',
            key: 'measurementId',
            type: 'tagReference',
          },
        ],
        containerId: '5678',
      };

      jest.spyOn(App, 'bootstrap').mockReturnValue(bootstrap);

      const createNewServerTagTypeSpy = jest
        .spyOn(App, 'createNewServerTagType')
        .mockReturnValue(undefined);

      App.applyMigrationChanges(tag, Action.MIGRATE);

      expect(createNewServerTagTypeSpy).toHaveBeenCalled();
    });
  });

  describe('hasCustomParams', () => {
    it('Checks if Tag has custom parameters', () => {
      const correctTag = {
        name: 'Ads Remarketing',
        parameter: [
          {
            type: 'boolean',
            value: 'false',
            key: 'enableDynamicRemarketing',
          },
          {
            type: 'list',
            list: [
              {
                map: [
                  {
                    type: 'template',
                    key: 'key',
                    value: 'custom_1',
                  },
                ],
                type: 'map',
              },
            ],
            key: 'customParams',
          },
          {
            type: 'template',
            value: '_gcl',
            key: 'conversionCookiePrefix',
          },
        ],
        tagId: '39',
        type: 'test',
      };

      const corruptTag = {
        name: 'Ads Remarketing',
        parameter: [
          {
            type: 'boolean',
            value: 'false',
            key: 'enableDynamicRemarketing',
          },
          {
            type: 'list',
            list: [
              {
                map: [
                  {
                    type: 'template',
                    key: 'key',
                    value: 'custom_1',
                  },
                ],
                type: 'map',
              },
            ],
            key: 'customParamsx',
          },
          {
            type: 'template',
            value: '_gcl',
            key: 'conversionCookiePrefix',
          },
        ],
        tagId: '39',
        type: 'test',
      };

      expect(App.hasCustomParams(correctTag)).toBe(true);
      expect(App.hasCustomParams(corruptTag)).toBe(false);
    });
  });

  describe('renameKeyFromNameToFieldName', () => {
    it('Renames key from name to field name', () => {
      const tag = {
        containerId: '50589141',
        path: 'accounts/6004683929/containers/50589141/workspaces/9/tags/4',
        fingerprint: '1663760603180',
        tagManagerUrl:
          'https://tagmanager.google.com/#/container/accounts/6004683929/containers/50589141/workspaces/9/tags/4?apiLink=tag',
        type: 'gaawc',
        tagFiringOption: 'oncePerEvent',
        workspaceId: '9',
        monitoringMetadata: {
          type: 'map',
          map: [
            { value: 'metadata_1_value', type: 'template', key: 'metadata_1' },
          ],
        },
        consentSettings: { consentStatus: 'notSet' },
        accountId: '6004683929',
        name: 'GA4 Configuration',
        firingTriggerId: ['2147479553'],
        tagId: '4',
        parameter: [
          {
            key: 'serverContainerUrl',
            type: 'template',
            value: 'https://sgtm.store.thegermancoder.com',
          },
          {
            list: [
              {
                map: [
                  { key: 'name', value: 'a_field_to_set', type: 'template' },
                  { type: 'template', key: 'value', value: 'field_value' },
                ],
                type: 'map',
              },
            ],
            key: 'fieldsToSet',
            type: 'list',
          },
          { value: 'false', type: 'boolean', key: 'enhancedUserId' },
          {
            type: 'list',
            list: [
              {
                type: 'map',
                map: [
                  {
                    type: 'template',
                    key: 'name',
                    value: 'config_user_property',
                  },
                  { value: 'property_value', type: 'template', key: 'value' },
                ],
              },
            ],
            key: 'userProperties',
          },
          { value: 'true', type: 'boolean', key: 'sendPageView' },
          {
            type: 'boolean',
            key: 'enableSendToServerContainer',
            value: 'true',
          },
          { value: '{{GA4-ID}}', type: 'template', key: 'measurementId' },
        ],
      };

      App.renameKeyFromNameToFieldName(tag);
      expect(
        tag.parameter.find(p => p.key === 'userProperties')!.list![0].map[0].key
      ).toEqual('fieldName');
    });
  });
});
