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

const logger = new UILogger('LOGS_START', 100);

const bootstrap = lazy(() => {
  const gtm_web_url = SheetsHelper.getRangeByName('GTM_WEB_URL').getValue();
  const gtm_server_url = SheetsHelper.getRangeByName('GTM_SERVER_URL').getValue();
  const accountIdWeb = gtm_web_url.match(/accounts\/(\d+)/)[1];
  const containerIdWeb = gtm_web_url.match(/containers\/(\d+)/)[1];
  const workspaceIdWeb = gtm_web_url.match(/workspaces\/(\d+)/)[1];
  const accountIdServer = gtm_server_url.match(/accounts\/(\d+)/)[1];
  const containerIdServer = gtm_server_url.match(/containers\/(\d+)/)[1];
  const workspaceIdServer = gtm_server_url.match(/workspaces\/(\d+)/)[1];
  const override = SheetsHelper.getRangeByName(`${CONFIG.sheets.config.name}!${CONFIG.sheets.config.fields.overrideTag}`).isChecked();
  const transportUrl = SheetsHelper.getCellValue(`${CONFIG.sheets.config.name}!${CONFIG.sheets.config.fields.transportUrl}`);
  const measurementId = SheetsHelper.getCellValue(`${CONFIG.sheets.config.name}!${CONFIG.sheets.config.fields.measurementId}`);
  const serverWorkspacePath = `accounts/${accountIdServer}/containers/${containerIdServer}/workspaces/${workspaceIdServer}`;
  const webWorkspacePath = `accounts/${accountIdWeb}/containers/${containerIdWeb}/workspaces/${workspaceIdWeb}`;
  return {
    accountIdWeb, containerIdWeb, workspaceIdWeb, accountIdServer, containerIdServer,
    workspaceIdServer, transportUrl, serverWorkspacePath, webWorkspacePath, override, measurementId
  };
});

// Containers for singleton pattern
let serverConfigTagName = null;
let serverTags = null;
let webTags = null;

function getRewrittenTagName(name) {
  const suffix = ' - sGTM';
  return name.endsWith(suffix) ? name : `${name}${suffix}`;
}

/**
 * Get config Tag name for GA4 Event Tag.
 *
 * @param {Object} tag
 * @returns {Object}
 */
function getConfigTag(tag) {
  const configTagNameParameter = TagManagerHelper.getTagParameter(tag, 'measurementId');

  if (configTagNameParameter) {
    const webTags = getWebTags();

    return webTags.filter((tag) => tag.name === configTagNameParameter.value);
  }

  return {};
}

/**
 * Create default server variables.
 */
function createDefaultServerVariables() {
  // Get all existing variable names
  const existingVariableNames = TagManagerHelper.listAllVariables(bootstrap().serverWorkspacePath).map((variable) => variable.name);
  const existingBuiltInVariableNames = TagManagerHelper.listAllBuiltInVariables(bootstrap().serverWorkspacePath).map((variable) => variable.name);

  logger.log(`Found ${existingVariableNames.length} user defined variables in server container.`);
  logger.log(`Found ${existingBuiltInVariableNames.length} built-in variables in server container.`);

  // Create each of the default user defined variables that don't already exist
  DEFAULT_SERVER_VARIABLES.filter((variable) => !existingVariableNames.includes(variable.name))
    .forEach((variable) => {
      logger.log(`Creating variable '${variable.name}'...`);
      TagManagerHelper.createVariable(bootstrap().serverWorkspacePath, variable.name, variable.value, variable.type, SERVER_VARIABLE_NOTES);
    });

  // Create each of the default built-in variables that don't already exist
  BUILT_IN_VARIABLES.filter((variable) => !existingBuiltInVariableNames.includes(variable.name))
    .forEach((variable) => {
      logger.log(`Creating built-in variable '${variable.name}'...`);
      TagManagerHelper.createBuiltInVariable(bootstrap().serverWorkspacePath, variable.type);
    });
}

/**
 * Migrate user defined variables from Web to Server Container.
 */
function migrateUserDefinedVariables() {
  // Get all existing server variable names
  const existingServerVariableNames = TagManagerHelper.listAllVariables(bootstrap().serverWorkspacePath).map((variable) => variable.name);

  // Get all existing web variables
  const existingWebVariables = TagManagerHelper.listAllVariables(bootstrap().webWorkspacePath);

  // Filter for constant variables not already existing in the server container
  existingWebVariables.filter((variable) => variable.type === 'c').filter((variable) => !existingServerVariableNames.includes(variable.name)).forEach((variable) => {
    TagManagerHelper.createVariable(bootstrap().serverWorkspacePath, variable.name, variable.parameter[0].value, VARIABLE_TYPES.constant.name, SERVER_VARIABLE_NOTES);
  });
}

/**
 * Rename key from 'name' to 'fieldName'.
 *
 * @param {Object} tag
 * @returns {Object}
 */
function renameKeyFromNameToFieldName(tag) {
  tag.parameter.forEach((parameter) => {
    if (parameter.key === 'userProperties' || parameter.key === 'eventParameters') {
      parameter.list.forEach((listing) => {
        listing.map.forEach((mapping) => {
          if (mapping.key === 'name') {
            mapping.key = 'fieldName';
          }
        })
      });
    }
  });

  return tag;
}

/**
 * Determine migration notes.
 *
 * @param {Object} tag
 * @param {string} action
 * @param {boolean} override
 * @returns {string}
 */
function getMigrationNotes(tag, action, override) {
  if (OVERRITABLE_TAGS.includes(tag.type) && action === CONFIG.sheets.webFeed.actions.rewrite && !override) {
    return `This tag has been created by the sGTM Migrator tool. It is based on the tag "${tag.name}" (tag id: ${tag.tagId}).`;
  } else if (action === CONFIG.sheets.webFeed.actions.migrate) {
    // server container tag
    return `This tag has been created by the sGTM Migrator tool. Please review used variables and assign a firing trigger.`
  } else {
    // web container rewrite
    return 'Migrated with sGTM Migrator';
  }
}

/**
 * Check if Tag is of type GA4 Config or GA4 Event.
 *
 * @param {Object} tag
 * @returns {boolean}
 */
function isGA4Tag(tag) {
  return tag.type === TAG_TYPES.web.gaConfig || tag.type === TAG_TYPES.web.gaEvent;
}

/**
 * Get variable names from Tag.
 *
 * @param {Object} tag
 * @param {string} key
 * @param {string} prefix
 * @returns {Array<Object>}
 */
function getVariableNamesFromTag(tag, key, prefix) {
  const props = TagManagerHelper.getTagParameter(tag, key);

  return props ? props['list']
    .map(prop => prop['map'].find(elem => elem.key === 'name').value)
    .map(name => ({
      name: name,
      queryParam: `${prefix}.${name}`,
    })
    ) : [];
}

/**
 * Create query param variable.
 *
 * @param {Object}
 */
function createQueryParamVariable(variable) {
  TagManagerHelper.createVariable(bootstrap().serverWorkspacePath, variable.name, variable.queryParam, VARIABLE_TYPES.queryParameter.name, SERVER_VARIABLE_NOTES);
}

/**
 * Get all migrateable variables.
 */
function getAllMigrateableVariables(tags) {
  const ga4Tags = tags.filter(isGA4Tag);
  const userPropertiesVariableNames = ga4Tags.flatMap(tag => getVariableNamesFromTag(tag, 'userProperties', 'up'));
  const uniqueUserPropertiesVariableNames = objectArrayRemoveDuplicatesByKey(userPropertiesVariableNames, 'name');
  const eventParametersVariableNames = ga4Tags.flatMap(tag => getVariableNamesFromTag(tag, 'eventParameters', 'ep'));
  const uniqueEventParametersVariableNames = objectArrayRemoveDuplicatesByKey(eventParametersVariableNames, 'name');

  return [...uniqueUserPropertiesVariableNames, ...uniqueEventParametersVariableNames];
}

/**
 * Create Query Parameter variables on server.
 */
function createQueryParamVariablesOnServer() {
  const existingVariables = TagManagerHelper.listAllVariables(bootstrap().serverWorkspacePath)
    .map(variable => variable.name);
  getAllMigrateableVariables(getWebTags())
    .filter(variable => !existingVariables.includes(variable.name))
    .forEach(createQueryParamVariable)
}

/**
 * Check if Tag is migrated.
 *
 * @param {Array<string|number>} row
 * @returns {boolean}
 */
function isMigrated(row) {
  return [CONFIG.sheets.webFeed.status.migrated, CONFIG.sheets.webFeed.status.rewrittenAndMigrated].includes(row[CONFIG.sheets.tagColumns.status]);
}

/**
 * Check if Tag is rewritten.
 *
 * @param {Array<string|number>} row
 * @returns {boolean}
 */
function isRewritten(row) {
  return [CONFIG.sheets.webFeed.status.rewritten, CONFIG.sheets.webFeed.status.rewrittenAndMigrated].includes(row[CONFIG.sheets.tagColumns.status]);
}

/**
 * Check if Tag is to be rewritten.
 *
 * @param {Array<string|number>} row
 * @returns {boolean}
 */
function isToBeRewritten(row) {
  return row[CONFIG.sheets.tagColumns.action] === CONFIG.sheets.webFeed.actions.rewrite;
}

/**
 * Check if Tag is to be migrated.
 *
 * @param {Array<string|number>} row
 * @returns {boolean}
 */
function isToBeMigrated(row) {
  return row[CONFIG.sheets.tagColumns.action] === CONFIG.sheets.webFeed.actions.migrate;
}

/**
 * Fetch all tags from web and server container.
 *
 * @returns {Array<Array<string|number>>}
 */
function fetch() {
  return {
    webTags: fetchAllWorkspaceTags(bootstrap().accountIdWeb, bootstrap().containerIdWeb, bootstrap().workspaceIdWeb),
    serverTags: fetchAllWorkspaceTags(bootstrap().accountIdServer, bootstrap().containerIdServer, bootstrap().workspaceIdServer)
  };
}

/**
 * Fetch all workspace tags.
 *
 * @param {string} accountID
 * @param {string} containerID
 * @param {string} workspaceID
 */
function fetchAllWorkspaceTags(accountID, containerId, workspaceId) {
  const workspacePath = `accounts/${accountID}/containers/${containerId}/workspaces/${workspaceId}`;

  // fetch relevant account data
  const account = TagManager.Accounts.get(`accounts/${accountID}`);
  Utilities.sleep(TagManagerHelper.queryDelay);
  const container = TagManager.Accounts.Containers.get(`accounts/${accountID}/containers/${containerId}`);
  Utilities.sleep(TagManagerHelper.queryDelay);
  const workspace = TagManager.Accounts.Containers.Workspaces.get(workspacePath);
  Utilities.sleep(TagManagerHelper.queryDelay);
  const tags = TagManagerHelper.listAllTags(workspacePath)
    .filter(tag => workspacePath === bootstrap().serverWorkspacePath || isSupportedTagType(tag))

  const rows = [];
  for (const tag of tags) {
    const row = [];
    row[CONFIG.sheets.tagColumns.accountId] = tag.accountId;
    row[CONFIG.sheets.tagColumns.accountName] = account.name;
    row[CONFIG.sheets.tagColumns.containerId] = tag.containerId;
    row[CONFIG.sheets.tagColumns.containerName] = container.name;
    row[CONFIG.sheets.tagColumns.workspaceId] = tag.workspaceId;
    row[CONFIG.sheets.tagColumns.workspaceName] = workspace.name;
    row[CONFIG.sheets.tagColumns.tagId] = tag.tagId;
    row[CONFIG.sheets.tagColumns.tagName] = tag.name;
    row[CONFIG.sheets.tagColumns.tagType] = tag.type;
    if (workspacePath === bootstrap().webWorkspacePath) {
      row[CONFIG.sheets.tagColumns.status] = getTagStatus(tag);
      row[CONFIG.sheets.tagColumns.action] = '';
    }
    rows.push(row);
  }

  return rows;
}

/**
 * Migrate selected tags.
 *
 */
function migrate() {
  logger.log('createQueryParamVariablesOnServer');
  createQueryParamVariablesOnServer();
  logger.log('createDefaultServerVariables');
  createDefaultServerVariables();

  const feed = SheetsHelper.getValues(CONFIG.sheets.webFeed.name, 'A2', CONFIG.sheets.webFeed.lastColumn).filter(shouldRowBeProcessed);

  feed.forEach((row) => {
    let executionSuccess = true;

    try {
      logger.log(`Processing tag '${row[CONFIG.sheets.tagColumns.tagName]}'`);
      let tag = fetchTagForRow(row);

      const action = row[CONFIG.sheets.tagColumns.action];
      tag = applyMigrationChanges(tag, action);
      tag = markAsMigrated(bootstrap().override, tag, action);

      uploadTag(bootstrap().override, tag, action);
    } catch (err) {
      executionSuccess = false;
      logger.log(err.message);
    } finally {
      // Note: Could write row status in the future
    }
  });

  markWorkspaceAsManaged(bootstrap().webWorkspacePath);
  markWorkspaceAsManaged(bootstrap().serverWorkspacePath);
  logger.log('Finished advanced configuration actions.');
}

/**
 * Get migrated tag name.
 *
 * @param {Array<string|number>}
 * @returns {string}
 */
function getRewrittenTagNameForRow(row) {
  const name = row[CONFIG.sheets.tagColumns.tagName];
  const isOverritable = OVERRITABLE_TAGS.includes(row[CONFIG.sheets.tagColumns.tagType]);

  if (bootstrap().override || !isOverritable || isRewritten(row)) {
    return name;
  } else {
    return getRewrittenTagName(name);
  }
}

/**
 * Check if row is a GA config tag.
 *
 * @returns {boolean}
 */
function isGAConfigTag(row) {
  return row[CONFIG.sheets.tagColumns.tagType] === TAG_TYPES.web.gaConfig;
}

/**
 * Get server tags.
 * Return from variable if initialized.
 * Otherwise determine, store/cache and return for a singleton pattern.
 *
 * @returns {Array<Object>}
 */
function getServerTags() {
  const res = serverTags || TagManagerHelper.listAllTags(bootstrap().serverWorkspacePath);

  // Store result for future queries
  serverTags = res;

  return res;
}

/**
 * Get web tags.
 * Return from variable if initialized.
 * Otherwise determine, store/cache and return for a singleton pattern.
 *
 * @param {boolean} forceReload
 * @returns {Array<Object>}
 */
function getWebTags(forceReload) {
  const res = !webTags || forceReload ? TagManagerHelper.listAllTags(bootstrap().webWorkspacePath)
    .filter(isSupportedTagType) : webTags;

  // Store result for future queries
  webTags = res;

  return res;
}

/**
 * Check if GA Config Tag has Server URL set.
 *
 * @param {Array<string|number>}
 * @returns {boolean}
 */
function configTagHasServerUrl(row) {
  const tag = fetchTagForRow(row);
  return tag && !!TagManagerHelper.getTagParameter(tag, 'serverContainerUrl');
}

/**
 * Get server config name.
 * Return from variable if initialized.
 * Otherwise determine, store/cache and return for a singleton pattern.
 * @returns {string}
 */
function getServerConfigTagName() {
  const res = SheetsHelper.getValues(CONFIG.sheets.webFeed.name, 'A2', CONFIG.sheets.webFeed.lastColumn)
    .filter(isGAConfigTag)
    .filter(row => isRewritten(row) && configTagHasServerUrl(row) || isToBeRewritten(row))
    .map(getRewrittenTagNameForRow)
    ?.[0];
  return res;
}

/**
 * Check if any GA4 Config Tag has been or will be rewritten.
 *
 * @returns {boolean}
 */
function isAnyGA4ConfigTagRewritten() {
  return SheetsHelper.getValues(CONFIG.sheets.webFeed.name, 'A2', CONFIG.sheets.webFeed.lastColumn)
    .filter(isGAConfigTag)
    .filter(row => isRewritten(row) && configTagHasServerUrl(row) || isToBeRewritten(row))
    .length > 0;
}

/**
 * Mark workspace as managed by adding description.
 *
 * @param {string} workspacePath
 */
function markWorkspaceAsManaged(workspacePath) {
  const managedDescription = workspacePath === bootstrap().webWorkspacePath ? WEB_WORKSPACE_IS_MANAGED_DESCRIPTION : SERVER_WORKSPACE_IS_MANAGED_DESCRIPTION;
  const workspace = TagManager.Accounts.Containers.Workspaces.get(workspacePath);
  const description = workspace.description || '';

  if (!description.endsWith(managedDescription)) {
    logger.log('Updating workspace description...');
    workspace.description = `${description}\n${managedDescription}`;
    TagManager.Accounts.Containers.Workspaces.update(workspace, workspace.path);
  }
}

/**
 * Mark tag as migrated by adding a note.
 *
 * @param {boolean} override
 * @param {Object} tag
 * @param {string} action
 * @returns {Object}
 */
function markAsMigrated(override, tag, action) {
  tag.notes = getMigrationNotes(tag, action, override);

  if (!override && action === CONFIG.sheets.webFeed.actions.rewrite) {
    tag.name = getRewrittenTagName(tag.name);
  }

  return tag;
}

/**
 * Create or update tag.
 *
 * @param {boolean} override
 * @param {Object} tag
 * @param {string} action
 */
function uploadTag(override, tag, action) {
  logger.log(`${action} tag '${tag.name}'`);
  logger.log(JSON.stringify(tag));

  // Create folder on server if not exists
  if ('parentFolderId' in tag) {
    const webFolder = TagManagerHelper.getFolder(
      bootstrap().webWorkspacePath,
      tag.parentFolderId
    );

    tag.parentFolderId = migrateFolder(
      bootstrap().serverWorkspacePath,
      webFolder
    );
  }

  if (action === CONFIG.sheets.webFeed.actions.migrate) {
    // Create new server Tag
    TagManagerHelper.createTag(tag, bootstrap().serverWorkspacePath);
  } else if (override) {
    // Override web Tag
    TagManagerHelper.updateTag(tag);
  } else {
    // Create new web Tag
    TagManagerHelper.createTag(tag);
  }
}

/**
 * Get all folders in workspace.
 *
 * @param {string} workspacePath
 * @returns {TagManager.Accounts.Containers.Workspaces.Folder[]}
 */
function getAllFolders(workspacePath) {
  const folders =
    TagManager.Accounts.Containers.Workspaces.Folders.list(workspacePath);

  if (!folders || !('folder' in folders)) return [];

  return folders.folder;
}

/**
 * Make sure all web folders exist on server.
 */
function migrateAllFolders() {
  // Get all web folders
  const folders = getAllFolders(bootstrap().webWorkspacePath);

  // Create server folders
  folders.forEach((folder) => {
    migrateFolder(bootstrap().serverWorkspacePath, folder);
  });
}

/**
 * Create folder in workspace if not exists.
 *
 * @param {string} workspacePath
 * @param {string} folder
 * @returns {number}
 */
function migrateFolder(workspacePath, folder) {
  const folders = getAllFolders(workspacePath);

  let migratedFolder = folders?.find((f) => f.name === folder.name);

  if (!migratedFolder) {
    migratedFolder = TagManager.Accounts.Containers.Workspaces.Folders.create(
      { name: folder.name },
      workspacePath
    );
  }

  return migratedFolder.folderId;
}

function ensureServerMeasurementIdVariableExists(workspacePath, measurementId) {
  // Note: could also verify that the value equals measurementId (override if exists and not equal?)
  const existsAlready = TagManagerHelper.listAllVariables(workspacePath)
    .some(v => v.name === SERVER_MEASUREMENT_ID_VARIABLE_NAME);

  if (!existsAlready) {
    logger.log(`Creating server measurement ID variable ${SERVER_MEASUREMENT_ID_VARIABLE_NAME}`);
    TagManagerHelper.createVariable(workspacePath, SERVER_MEASUREMENT_ID_VARIABLE_NAME,
      measurementId, VARIABLE_TYPES.constant.name, SERVER_MEASUREMENT_ID_VARIABLE_NOTE);
  } else {
    logger.log(`Re-using server measurement ID variable ${SERVER_MEASUREMENT_ID_VARIABLE_NAME}`);
  }
}

function rewriteGA4Configuration(configTag, transportUrl, override) {
  TagManagerHelper.setTagParameter(configTag, 'serverContainerUrl', 'template', transportUrl);
  TagManagerHelper.setTagParameter(configTag, 'enableSendToServerContainer', 'boolean', 'true');
  if (!override) {
    TagManagerHelper.setTagParameter(configTag, 'measurementId', 'template',
      `{{${SERVER_MEASUREMENT_ID_VARIABLE_NAME}}}`);
  }
}

function rewriteGA4Event(tag, serverConfigTagName) {
  TagManagerHelper.setTagParameter(tag, 'measurementId', 'tagReference', serverConfigTagName);
}

function createNewServerTagType(tag) {
  delete tag['fingerprint'];
  delete tag['tagManagerUrl'];
  delete tag['tagId'];
  delete tag['workspaceId'];
  delete tag['containerId'];
  delete tag['accountId'];
  delete tag['path'];
  delete tag['firingTriggerId'];
  const serverType = getMatchingServerTagType(tag['type']);
  if (!serverType) {
    throw Error('No matching server type');
  }
  tag['type'] = serverType;
}

function migrateServerGA4Event(tag, webTags) {
  const serverConfigTagName = TagManagerHelper.getTagParameter(tag, 'measurementId')?.value;
  // for the rest of the web tags you need to look inside the parameters to find the serverConfigTagName.
  const configTag = webTags.find((tag) => tag.name === serverConfigTagName) || webTags.find((serverTag) => serverTag.parameter.find(param => param.value === serverConfigTagName));
  migrateServerGA4EventLean(tag, configTag);
}

function migrateServerGA4EventLean(tag, configTag) {
  // Merge "Additional Metadata"
  const serverConfigTagMonitoringMetadata = configTag?.monitoringMetadata?.map;

  if (serverConfigTagMonitoringMetadata) {
    if (tag?.monitoringMetadata) {
      tag.monitoringMetadata.map = [...tag.monitoringMetadata.map, ...serverConfigTagMonitoringMetadata];
    } else {
      tag.monitoringMetadata = configTag?.monitoringMetadata
    }
  }

  // Merge 'Event Parameters' from GA4 Event Tag with 'Fields to set' from GA4 Config Tag
  const fieldsToSetParameter = TagManagerHelper.getTagParameter(configTag, 'fieldsToSet');
  if (fieldsToSetParameter) {
    TagManagerHelper.updateListParameter(tag, fieldsToSetParameter, 'eventParameters');
  }

  // Set 'Default Parameters to Include' to 'None'
  TagManagerHelper.setTagParameter(tag, 'epToIncludeDropdown', 'template', 'none');

  // Merge 'User Properties'
  const configTagUserProperties = TagManagerHelper.getTagParameter(configTag, 'userProperties');
  if (configTagUserProperties) {
    TagManagerHelper.updateListParameter(tag, configTagUserProperties);
  }

  // Set 'Default Properties to Include' to 'None'
  TagManagerHelper.setTagParameter(tag, 'upToIncludeDropdown', 'template', 'none');

  // Rename 'name' key to 'fieldName'
  tag = renameKeyFromNameToFieldName(tag);

  // Update 'Measurement ID' parameter
  const measurementIdParameter = TagManagerHelper.getTagParameter(configTag, 'measurementId');
  TagManagerHelper.setTagParameter(tag, measurementIdParameter.key, measurementIdParameter.type, measurementIdParameter.value);
}

function enableCustomParams(tag) {
  if (hasCustomParams(tag)) {
    tag['parameter'].push({
      "key": "enableCustomParams",
      "type": "boolean",
      "value": "true"
    });
  }
}

/**
 * Check if tag has server container URL set and enabled.
 *
 * @param {Object} tag
 * @param {string} transportUrl
 * @returns {boolean}
 */
function containsEnabledTransportUrl(tag, transportUrl) {
  const enableSendToServerContainer = TagManagerHelper.getTagParameter(tag, 'enableSendToServerContainer')?.value === 'true';
  const serverContainerUrl = TagManagerHelper.getTagParameter(tag, 'serverContainerUrl')?.value;

  return enableSendToServerContainer && serverContainerUrl === transportUrl;
}

/** Get the rewritten config name of a tag
 * @param {Object} tag
 * @param {boolean} override
 */
function getRewrittenConfigName(tag, override) {
  const configTagName = TagManagerHelper.getTagParameter(tag, 'measurementId')?.value;
  return override ? configTagName : getRewrittenTagName(configTagName);
}

/**
 * Manipulate tag to be migrated.
 *
 * @param {Object} tag
 * @param {string} action
 * @returns {Object}
 */
function applyMigrationChanges(tag, action) {
  if (action === CONFIG.sheets.webFeed.actions.rewrite && tag.type === TAG_TYPES.web.gaConfig) {
    ensureServerMeasurementIdVariableExists(bootstrap().webWorkspacePath, bootstrap().measurementId);
    rewriteGA4Configuration(tag, bootstrap().transportUrl, bootstrap().override);
  } else if (action === CONFIG.sheets.webFeed.actions.rewrite && tag.type === TAG_TYPES.web.gaEvent) {
    // Rewrite GA4 Event
    const rewrittenConfigTagName = getRewrittenConfigName(tag, bootstrap().override);
    const webTags = getWebTags();
    const rewrittenConfigTagExists = webTags.find((tag) => tag.name === rewrittenConfigTagName && containsEnabledTransportUrl(tag, bootstrap().transportUrl));

    if (!rewrittenConfigTagExists) {
      throw new Error('Cannot rewrite GA4 Event due to missing rewritten GA4 Config');
    }
    rewriteGA4Event(tag, rewrittenConfigTagName);
  } else if (isSupportedTagType(tag)) {
    createNewServerTagType(tag);
  }

  if (tag.type === TAG_TYPES.server.gaEvent) {
    migrateServerGA4Event(tag, getWebTags())
  } else if (tag.type === TAG_TYPES.server.adsRemarketing) {
    enableCustomParams(tag);
  }

  return tag;
}

/**
 * Check if tag has custom parameters.
 *
 * @param {Object} tag
 * @returns {boolean}
 */
function hasCustomParams(tag) {
  return tag['parameter'].some((entry) => entry?.key === 'customParams');
}

/**
 * Fetch tag for row.
 *
 * @param {Array<string|number>}
 * @returns {Object}
 */
function fetchTagForRow(row) {
  const accountId = row[CONFIG.sheets.tagColumns.accountId];
  const containerId = row[CONFIG.sheets.tagColumns.containerId];
  const workspaceId = row[CONFIG.sheets.tagColumns.workspaceId];
  const tagId = row[CONFIG.sheets.tagColumns.tagId];
  const webTags = getWebTags();

  return webTags.find((tag) => {
    return tag.accountId === accountId &&
      tag.containerId === containerId &&
      tag.workspaceId === workspaceId &&
      tag.tagId === tagId
  });
}

/**
 * Check if row should be processed.
 *
 * @param {Array<string|number>}
 * @returns {boolean}
 */
function shouldRowBeProcessed(row) {
  const shouldBeRewritten = !isRewritten(row) && isToBeRewritten(row);
  const shouldBeMigrated = !isMigrated(row) && isToBeMigrated(row);

  return shouldBeRewritten || shouldBeMigrated;
}

/**
 * Determine Tag status.
 *
 * @param {Object} tag
 * @returns {string}
 */
function getTagStatus(tag) {
  let rewritten = false;
  let migrated = false;

  if (tag.type === TAG_TYPES.web.gaConfig) {
    // Check if GA4 Config Tag itself has been rewritten (override) or if it was rewritten to new Tag (!override)
    const migrationNotes = getMigrationNotes(tag, CONFIG.sheets.webFeed.actions.rewrite, false);
    const rewrittenTag = getWebTags().some((webTag) => webTag?.notes?.includes(migrationNotes));
    const overriddenTag = TagManagerHelper.getTagParameter(tag, 'enableSendToServerContainer')?.value === 'true' &&
      TagManagerHelper.getTagParameter(tag, 'serverContainerUrl')?.value === bootstrap().transportUrl;

    rewritten = rewrittenTag || overriddenTag;
  } else if (tag.type === TAG_TYPES.web.gaEvent) {
    // Check if GAG4 Event is referencing migrated GA4 Config Tag
    const configTagName = TagManagerHelper.getTagParameter(tag, 'measurementId')?.value;
    const webTags = getWebTags();
    const configTag = webTags.find((tag) => tag.name === configTagName);

    rewritten = configTag && containsEnabledTransportUrl(configTag, bootstrap().transportUrl); //TagManagerHelper.getTagParameter(tag, 'measurementId')?.value === serverConfigTagName;
  }

  if (isSupportedTagType(tag)) {
    // Check if Tag has been migrated to server container
    migrated = getServerTags().map(tag => tag.name).includes(tag.name);
  } else {
    logger.log(`Warning: unknown tag type '${tag.type}'' cannot be checked for migration stage`);
    migrated = false;
  }

  // Determine and return status string
  if (rewritten && migrated) {
    return CONFIG.sheets.webFeed.status.rewrittenAndMigrated;
  } else if (rewritten) {
    return CONFIG.sheets.webFeed.status.rewritten;
  } else if (migrated) {
    return CONFIG.sheets.webFeed.status.migrated;
  } else {
    return CONFIG.sheets.webFeed.status.none;
  }
}

/**
 * Check if Tag type is supported.
 *
 * @param {tag} tag
 * @returns {boolean}
 */
function isSupportedTagType(tag) {
  return Object.values(TAG_TYPES.web).includes(tag.type);
}

/**
 * Get server Tag type for web Tag type.
 *
 * @param {string}
 * @returns {string}
 */
function getMatchingServerTagType(webTagType) {
  const key = Object.keys(TAG_TYPES.web).find(key => TAG_TYPES.web[key] === webTagType);

  return key in TAG_TYPES.server ? TAG_TYPES.server[key] : '';
}
