/**
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const START_LEAN_MESSAGE = `Woohoo! We are migrating all possible Google tags to your server container. This can take a while. Sing like no one is listening.`;

const SERVER_WORKSPACE_IS_MANAGED_DESCRIPTION = 'This workspace has been updated using the sGTM Migrator tool.' +
  '\n\nThe tool has migrated all supported Google tags (GA4, Google Ads, Floodlights, Conversion Linker). ' +
  'Variables used in these tags might require additional review. Triggers have not been migrated and need to be ' +
  'applied based on available functionalities in the server container.\n\nYou will find a set of pre-created variables. ' +
  'These are built-in server variables and variables based on your GA4 web tags pointing at the server container.';

const WEB_WORKSPACE_IS_MANAGED_DESCRIPTION = 'This workspace has been updated using the sGTM Migrator tool.\n\n' +
  'The tool has created (or overridden) all/selected GA4 tags to leverage the transport_url parameter.' +
  'This allows the GA4 tags to communicate with your server container.\n\n' +
  'Please navigate to the server container workspace to identify changes applied in the server container.';


const SERVER_VARIABLE_NOTES = `This variable has been created by the sGTM Migrator tool. It is based on either an event parameter, an user property or standard parameter from your GA4 tags pointing at this server container.`

const SERVER_MEASUREMENT_ID_VARIABLE_NOTE = `This variable has been created by the sGTM Migrator tool.`

const SERVER_MEASUREMENT_ID_VARIABLE_NAME = 'GA Measurement ID - sGTM';

const TAG_TYPES = {
  web: {
    gaConfig: 'gaawc',
    gaEvent: 'gaawe',
    flSales: 'fls',
    flCounter: 'flc',
    adsConversionTracking: 'awct',
    adsRemarketing: 'sp',
    conversionLinker: 'gclidw',
  },
  server: {
    gaConfig: 'sgtmgaaw',
    gaEvent: 'sgtmgaaw',
    flSales: 'sgtmfls',
    flCounter: 'sgtmflc',
    adsConversionTracking: 'sgtmadsct',
    adsRemarketing: 'sgtmadsremarket',
    conversionLinker: 'sgtmadscl',
  },
};

const OVERRITABLE_TAGS = [TAG_TYPES.web.gaConfig, TAG_TYPES.web.gaEvent];

const DEFAULT_SERVER_VARIABLES = [
  {
    type: 'requestHeader',
    name: 'Cookie',
    value: 'Cookie',
  }, {
    type: 'requestHeader',
    name: 'Host',
    value: 'Host',
  }, {
    type: 'requestHeader',
    name: 'Origin',
    value: 'Origin',
  }, {
    type: 'requestHeader',
    name: 'Referrer',
    value: 'Referrer',
  }, {
    type: 'queryParameter',
    name: 'Consent Status (gcs)',
    value: 'gcs',
  }, {
    type: 'queryParameter',
    name: 'Consent Default (gcd)',
    value: 'gcd',
  }, {
    type: 'queryParameter',
    name: 'Client ID (cid)',
    value: 'cid',
  }, {
    type: 'queryParameter',
    name: 'GA4 Measurement ID (tid)',
    value: 'tid',
  }, {
    type: 'queryParameter',
    name: 'User language (ul)',
    value: 'ul',
  }, {
    type: 'queryParameter',
    name: 'Screen Resolution (sr)',
    value: 'sr',
  }, {
    type: 'queryParameter',
    name: '(uaa)',
    value: 'uaa',
  }, {
    type: 'queryParameter',
    name: '(uab)',
    value: 'uab',
  }, {
    type: 'queryParameter',
    name: 'Session Hit Count (_s)',
    value: '_s',
  }, {
    type: 'queryParameter',
    name: 'Event Time (_et)',
    value: '_et',
  }, {
    type: 'queryParameter',
    name: 'Session Start (_ss)',
    value: '_ss',
  }, {
    type: 'queryParameter',
    name: 'Session ID (sid)',
    value: 'sid',
  }, {
    type: 'queryParameter',
    name: 'Session Count (sct)',
    value: 'sct',
  }, {
    type: 'queryParameter',
    name: 'Session Engagement (seg)',
    value: 'seg',
  }, {
    type: 'queryParameter',
    name: 'Document Location (dl)',
    value: 'dl',
  }, {
    type: 'queryParameter',
    name: 'Document Referer (dr)',
    value: 'dr',
  }, {
    type: 'queryParameter',
    name: 'Currency (cu)',
    value: 'cu',
  }, {
    type: 'queryParameter',
    name: 'First Visit (_fv)',
    value: '_fv',
  }, {
    type: 'queryParameter',
    name: 'User Country (_uc)',
    value: '_uc',
  }, {
    type: 'queryParameter',
    name: 'Custom Campaign Source (cs)',
    value: 'cs',
  }, {
    type: 'queryParameter',
    name: 'Custom Campaign Name (cn)',
    value: 'cn',
  }, {
    type: 'queryParameter',
    name: 'Custom Campaign Medium (cm)',
    value: 'cm',
  }, {
    type: 'queryParameter',
    name: 'Custom Campaign ID (ci)',
    value: 'ci',
  }, {
    type: 'queryParameter',
    name: 'Custom Campaign Term (ct)',
    value: 'ct',
  }, {
    type: 'queryParameter',
    name: 'Custom Campaign Content (cc)',
    value: 'cc',
  }, {
    type: 'queryParameter',
    name: 'Transaction ID',
    value: 'ep.transaction_id',
  }, {
    type: 'queryParameter',
    name: 'Transaction Affiliation',
    value: 'ep.affiliation',
  }, {
    type: 'queryParameter',
    name: 'Transaction Value',
    value: 'epn.value',
  }, {
    type: 'queryParameter',
    name: 'Transaction Tax',
    value: 'epn.tax',
  }, {
    type: 'queryParameter',
    name: 'Transaction Shipping',
    value: 'epn.shipping',
  }, {
    type: 'queryParameter',
    name: 'Transaction Coupon',
    value: 'ep.coupon',
  }, {
    type: 'queryParameter',
    name: 'Creative Name',
    value: 'ep.creative_name',
  }, {
    type: 'queryParameter',
    name: 'Creative Slot',
    value: 'ep.creative_slot',
  }, {
    type: 'queryParameter',
    name: 'Creative Location ID',
    value: 'ep.creative_location_id',
  }, {
    type: 'queryParameter',
    name: 'Promotion ID',
    value: 'ep.promotion_id',
  }, {
    type: 'queryParameter',
    name: 'Promotion Name',
    value: 'ep.promotion_name',
  }, {
    type: 'queryParameter',
    name: 'Item List Name',
    value: 'ep.item_list_name',
  }, {
    type: 'queryParameter',
    name: 'Item List ID',
    value: 'ep.item_list_id',
  },
];

const VARIABLE_TYPES = {
  queryParameter: {
    name: 'queryParameter',
    key: 'queryParamName',
    type: 'qp',
  },
  constant: {
    name: 'constant',
    key: 'value',
    type: 'c',
  },
  requestHeader: {
    name: 'requestHeader',
    key: 'headerName',
    type: 'rh',
  },
};

const BUILT_IN_VARIABLES = [
  {
    name: 'Event Name',
    type: 'eventName',
  }, {
    name: 'Container Version',
    type: 'containerVersion',
  }, {
    name: 'Debug Mode',
    type: 'debugMode',
  }, {
    name: 'Random Number',
    type: 'randomNumber',
  }, {
    name: 'Container ID',
    type: 'containerId',
  }, {
    name: 'Request Path',
    type: 'requestPath',
  }, {
    name: 'Request Method',
    type: 'requestMethod',
  }, {
    name: 'Client Name',
    type: 'clientName',
  }, {
    name: 'Query String',
    type: 'queryString',
  },
];

const CONFIG = {
  sheets: {
    readme: {
      name: "Readme"
    },
    config: {
      name: 'Config',
      fields: {
        transportUrl: 'TRANSPORT_URL',
        overrideTag: 'OVERRIDE_TAGS',
        measurementId: 'MEASUREMENT_ID'
      },
    },
    serverFeed: {
      name: 'Server Tags'
    },
    tagColumns: {
      accountId: 0,
      accountName: 1,
      containerId: 2,
      containerName: 3,
      workspaceId: 4,
      workspaceName: 5,
      tagId: 6,
      tagName: 7,
      tagType: 8,
      status: 9,
      action: 10
    },
    webFeed: {
      name: 'Web Tags',
      enums: {
        success: 'Success',
        failed: 'Failed',
      },
      status: {
        rewritten: 'rewritten',
        migrated: 'migrated',
        rewrittenAndMigrated: 'rewritten & migrated',
        none: 'none',
      },
      actions: {
        rewrite: 'Rewrite',
        migrate: 'Migrate',
      },
    },
  },
};
