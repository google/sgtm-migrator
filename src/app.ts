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

import {
  CONFIG,
  DEFAULT_SERVER_VARIABLES,
  SERVER_VARIABLE_NOTES,
  BUILT_IN_VARIABLES,
  VARIABLE_TYPES,
  OVERRITABLE_TAGS,
  WEB_WORKSPACE_IS_MANAGED_DESCRIPTION,
  SERVER_WORKSPACE_IS_MANAGED_DESCRIPTION,
  SERVER_MEASUREMENT_ID_VARIABLE_NAME,
  SERVER_MEASUREMENT_ID_VARIABLE_NOTE,
  TAG_TYPES,
  Action,
  Status,
} from './config';
import { SheetsService } from './util/SheetsHelper';
import { TagManagerHelper } from './util/TagManagerHelper';
import { UILogger } from './util/UILogger';
import { objectArrayRemoveDuplicatesByKey } from './util/utils';

// Containers for singleton pattern
//let serverConfigTagName: string | undefined;
let serverTags: GoogleAppsScript.TagManager.Tag[] | undefined;
let webTags: GoogleAppsScript.TagManager.Tag[] | undefined;

/**
 * This is required to avoid treeshaking this file.
 * As long as anything from a file is being used, the entire file
 * is being kept.
 */
export const app = null;

export class App {
  static bootstrap() {
    const gtm_web_url =
      SheetsService.getInstance().getRangeValue('GTM_WEB_URL');
    const gtm_server_url =
      SheetsService.getInstance().getRangeValue('GTM_SERVER_URL');
    const accountIdWeb = gtm_web_url.match(/accounts\/(\d+)/)[1];
    const containerIdWeb = gtm_web_url.match(/containers\/(\d+)/)[1];
    const workspaceIdWeb = gtm_web_url.match(/workspaces\/(\d+)/)[1];
    const accountIdServer = gtm_server_url.match(/accounts\/(\d+)/)[1];
    const containerIdServer = gtm_server_url.match(/containers\/(\d+)/)[1];
    const workspaceIdServer = gtm_server_url.match(/workspaces\/(\d+)/)[1];
    const override =
      SheetsService.getInstance()
        .getRangeByName(
          `${CONFIG.sheets.config.name}!${CONFIG.sheets.config.fields.overrideTag}`
        )!
        .isChecked() ?? false;
    const transportUrl = SheetsService.getInstance().getCellValue(
      `${CONFIG.sheets.config.name}!${CONFIG.sheets.config.fields.transportUrl}`
    );
    const measurementId = SheetsService.getInstance().getCellValue(
      `${CONFIG.sheets.config.name}!${CONFIG.sheets.config.fields.measurementId}`
    );
    const serverWorkspacePath = `accounts/${accountIdServer}/containers/${containerIdServer}/workspaces/${workspaceIdServer}`;
    const webWorkspacePath = `accounts/${accountIdWeb}/containers/${containerIdWeb}/workspaces/${workspaceIdWeb}`;
    return {
      accountIdWeb,
      containerIdWeb,
      workspaceIdWeb,
      accountIdServer,
      containerIdServer,
      workspaceIdServer,
      transportUrl,
      serverWorkspacePath,
      webWorkspacePath,
      override,
      measurementId,
    };
  }

  static getRewrittenTagName(name: string) {
    const suffix = ' - sGTM';

    return name.endsWith(suffix) ? name : `${name}${suffix}`;
  }

  /**
   * Get config Tag name for GA4 Event Tag.
   *
   * @param {GoogleAppsScript.TagManager.Tag} tag
   * @returns {GoogleAppsScript.TagManager.Tag}
   */
  static getConfigTag(tag: GoogleAppsScript.TagManager.Tag) {
    const configTagNameParameter = TagManagerHelper.getTagParameter(
      tag,
      'measurementId'
    );

    if (configTagNameParameter) {
      const webTags = App.getWebTags();

      return webTags.filter(tag => tag.name === configTagNameParameter.value);
    }

    return {};
  }

  /**
   * Create default server variables.
   */
  static createDefaultServerVariables() {
    // Get all existing variable names
    const existingVariableNames = TagManagerHelper.listAllVariables(
      App.bootstrap().serverWorkspacePath
    ).map(variable => variable.name);
    const existingBuiltInVariableNames =
      TagManagerHelper.listAllBuiltInVariables(
        App.bootstrap().serverWorkspacePath
      ).map(variable => variable.name);

    UILogger.getInstance().log(
      `Found ${existingVariableNames.length} user defined variables in server container.`
    );
    UILogger.getInstance().log(
      `Found ${existingBuiltInVariableNames.length} built-in variables in server container.`
    );

    // Create each of the default user defined variables that don't already exist
    DEFAULT_SERVER_VARIABLES.filter(
      variable => !existingVariableNames.includes(variable.name)
    ).forEach(variable => {
      UILogger.getInstance().log(`Creating variable '${variable.name}'...`);
      TagManagerHelper.createVariable(
        App.bootstrap().serverWorkspacePath,
        variable.name,
        variable.value,
        variable.type,
        SERVER_VARIABLE_NOTES
      );
    });

    // Create each of the default built-in variables that don't already exist
    BUILT_IN_VARIABLES.filter(
      variable => !existingBuiltInVariableNames.includes(variable.name)
    ).forEach(variable => {
      UILogger.getInstance().log(
        `Creating built-in variable '${variable.name}'...`
      );
      TagManagerHelper.createBuiltInVariable(
        App.bootstrap().serverWorkspacePath,
        variable.type
      );
    });
  }

  /**
   * Migrate user defined variables from Web to Server Container.
   */
  static migrateUserDefinedVariables() {
    // Get all existing server variable names
    const existingServerVariableNames = TagManagerHelper.listAllVariables(
      App.bootstrap().serverWorkspacePath
    ).map(variable => variable.name);

    // Get all existing web variables
    const existingWebVariables = TagManagerHelper.listAllVariables(
      App.bootstrap().webWorkspacePath
    );

    // Filter for constant variables not already existing in the server container
    existingWebVariables
      .filter(variable => variable.type === 'c')
      .filter(variable => !existingServerVariableNames.includes(variable.name))
      .forEach(variable => {
        TagManagerHelper.createVariable(
          App.bootstrap().serverWorkspacePath,
          variable.name,
          variable.parameter![0].value!,
          VARIABLE_TYPES.constant.name as keyof typeof VARIABLE_TYPES,
          SERVER_VARIABLE_NOTES
        );
      });
  }

  /**
   * Rename key from 'name' to 'fieldName'.
   *
   * @param {GoogleAppsScript.TagManager.Tag} tag
   * @returns {GoogleAppsScript.TagManager.Tag}
   */
  static renameKeyFromNameToFieldName(tag: GoogleAppsScript.TagManager.Tag) {
    tag.parameter!.forEach(parameter => {
      if (
        parameter.key === 'userProperties' ||
        parameter.key === 'eventParameters'
      ) {
        parameter.list!.forEach(listing => {
          listing.map!.forEach(mapping => {
            if (mapping.key === 'name') {
              mapping.key = 'fieldName';
            }
          });
        });
      }
    });

    return tag;
  }

  /**
   * Determine migration notes.
   *
   * @param {GoogleAppsScript.TagManager.Tag} tag
   * @param {string} action
   * @param {boolean} override
   * @returns {string}
   */
  static getMigrationNotes(
    tag: GoogleAppsScript.TagManager.Tag,
    action: string,
    override: boolean
  ) {
    if (
      OVERRITABLE_TAGS.includes(tag.type) &&
      action === Action.REWRITE &&
      !override
    ) {
      return `This tag has been created by the sGTM Migrator tool. It is based on the tag "${tag.name}" (tag id: ${tag.tagId}).`;
    } else if (action === Action.MIGRATE) {
      // server container tag
      return `This tag has been created by the sGTM Migrator tool. Please review used variables and assign a firing trigger.`;
    } else {
      // web container rewrite
      return 'Migrated with sGTM Migrator';
    }
  }

  /**
   * Check if Tag is of type GA4 Config or GA4 Event.
   *
   * @param {GoogleAppsScript.TagManager.Tag} tag
   * @returns {boolean}
   */
  static isGA4Tag(tag: GoogleAppsScript.TagManager.Tag) {
    return (
      tag.type === TAG_TYPES.web.gaConfig || tag.type === TAG_TYPES.web.gaEvent
    );
  }

  /**
   * Get variable names from Tag.
   *
   * @param {GoogleAppsScript.TagManager.Tag} tag
   * @param {string} key
   * @param {string} prefix
   * @returns {Array<Object>}
   */
  static getVariableNamesFromTag(
    tag: GoogleAppsScript.TagManager.Tag,
    key: string,
    prefix: string
  ) {
    const props = TagManagerHelper.getTagParameter(tag, key);

    return props
      ? props
          .list!.map(prop => prop.map!.find(elem => elem.key === 'name')!.value)
          .map(name => ({
            name: name,
            queryParam: `${prefix}.${name}`,
          }))
      : [];
  }

  /**
   * Create query param variable.
   *
   * @param {{name: string, queryParam: string}}
   */
  static createQueryParamVariable(variable: {
    name: string;
    queryParam: string;
  }) {
    TagManagerHelper.createVariable(
      App.bootstrap().serverWorkspacePath,
      variable.name,
      variable.queryParam,
      VARIABLE_TYPES.queryParameter.name as keyof typeof VARIABLE_TYPES,
      SERVER_VARIABLE_NOTES
    );
  }

  /**
   * Get all migrateable variables.
   */
  static getAllMigrateableVariables(
    tags: GoogleAppsScript.TagManager.Tag[]
  ): { name: string; queryParam: string }[] {
    const ga4Tags = tags.filter(App.isGA4Tag);
    const userPropertiesVariableNames = ga4Tags.flatMap(tag =>
      App.getVariableNamesFromTag(tag, 'userProperties', 'up')
    );
    const uniqueUserPropertiesVariableNames = objectArrayRemoveDuplicatesByKey(
      userPropertiesVariableNames,
      'name'
    ) as { name: string; queryParam: string }[];
    const eventParametersVariableNames = ga4Tags.flatMap(tag =>
      App.getVariableNamesFromTag(tag, 'eventParameters', 'ep')
    );
    const uniqueEventParametersVariableNames = objectArrayRemoveDuplicatesByKey(
      eventParametersVariableNames,
      'name'
    ) as { name: string; queryParam: string }[];

    return [
      ...uniqueUserPropertiesVariableNames,
      ...uniqueEventParametersVariableNames,
    ];
  }

  /**
   * Create Query Parameter variables on server.
   */
  static createQueryParamVariablesOnServer() {
    const existingVariables = TagManagerHelper.listAllVariables(
      App.bootstrap().serverWorkspacePath
    ).map(variable => variable.name);

    App.getAllMigrateableVariables(App.getWebTags())
      .filter(variable => !existingVariables.includes(variable.name))
      .forEach(App.createQueryParamVariable);
  }

  /**
   * Check if Tag is migrated.
   *
   * @param {Array<string | number | boolean>} row
   * @returns {boolean}
   */
  static isMigrated(row: Array<string | number | boolean>) {
    return [
      Status.MIGRATED as string,
      Status.REWRITTEN_AND_MIGRATED as string,
    ].includes(row[CONFIG.sheets.tagColumns.status] as string);
  }

  /**
   * Check if Tag is rewritten.
   *
   * @param {Array<string | number | boolean>} row
   * @returns {boolean}
   */
  static isRewritten(row: Array<string | number | boolean>) {
    return [
      Status.REWRITTEN as string,
      Status.REWRITTEN_AND_MIGRATED as string,
    ].includes(row[CONFIG.sheets.tagColumns.status] as string);
  }

  /**
   * Check if Tag is to be rewritten.
   *
   * @param {Array<string | number | boolean>} row
   * @returns {boolean}
   */
  static isToBeRewritten(row: Array<string | number | boolean>) {
    return row[CONFIG.sheets.tagColumns.action] === Action.REWRITE;
  }

  /**
   * Check if Tag is to be migrated.
   *
   * @param {Array<string | number | boolean>} row
   * @returns {boolean}
   */
  static isToBeMigrated(row: Array<string | number | boolean>) {
    return row[CONFIG.sheets.tagColumns.action] === Action.MIGRATE;
  }

  /**
   * Fetch all tags from web and server container.
   *
   * @returns {{webTags: Array<Array<string | number | boolean>>; serverTags: Array<Array<string | number | boolean>>;}}
   */
  static fetch(): {
    webTags: Array<Array<string | number | boolean>>;
    serverTags: Array<Array<string | number | boolean>>;
  } {
    return {
      webTags: App.fetchAllWorkspaceTags(
        App.bootstrap().accountIdWeb,
        App.bootstrap().containerIdWeb,
        App.bootstrap().workspaceIdWeb
      ),
      serverTags: App.fetchAllWorkspaceTags(
        App.bootstrap().accountIdServer,
        App.bootstrap().containerIdServer,
        App.bootstrap().workspaceIdServer
      ),
    };
  }

  /**
   * Fetch all workspace tags.
   *
   * @param {string} accountId
   * @param {string} containerId
   * @param {string} workspaceId
   */
  static fetchAllWorkspaceTags(
    accountId: string,
    containerId: string,
    workspaceId: string
  ) {
    const workspacePath = `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`;

    // Fetch relevant account data
    const account = TagManagerHelper.callService(
      TagManager.Accounts.get,
      `accounts/${accountId}`
    );
    const container = TagManagerHelper.callService(
      TagManager.Accounts.Containers.get,
      `accounts/${accountId}/containers/${containerId}`
    );
    const workspace = TagManagerHelper.callService(
      TagManager.Accounts.Containers.Workspaces.get,
      workspacePath
    );
    const tags = TagManagerHelper.listAllTags(workspacePath).filter(
      tag =>
        workspacePath === App.bootstrap().serverWorkspacePath ||
        App.isSupportedTagType(tag)
    );

    const rows = [];
    for (const tag of tags) {
      const row: Array<string> = [];
      row[CONFIG.sheets.tagColumns.accountId] = tag.accountId ?? '';
      row[CONFIG.sheets.tagColumns.accountName] = account.name;
      row[CONFIG.sheets.tagColumns.containerId] = tag.containerId ?? '';
      row[CONFIG.sheets.tagColumns.containerName] = container.name;
      row[CONFIG.sheets.tagColumns.workspaceId] = tag.workspaceId ?? '';
      row[CONFIG.sheets.tagColumns.workspaceName] = workspace.name;
      row[CONFIG.sheets.tagColumns.tagId] = tag.tagId ?? '';
      row[CONFIG.sheets.tagColumns.tagName] = tag.name;
      row[CONFIG.sheets.tagColumns.tagType] = tag.type;
      if (workspacePath === App.bootstrap().webWorkspacePath) {
        row[CONFIG.sheets.tagColumns.status] = App.getTagStatus(tag);
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
  static migrate() {
    UILogger.getInstance().log('createQueryParamVariablesOnServer');
    App.createQueryParamVariablesOnServer();
    UILogger.getInstance().log('createDefaultServerVariables');
    App.createDefaultServerVariables();

    const feed = SheetsService.getInstance()
      .getValues(CONFIG.sheets.webFeed.name, 'A2')!
      .filter(App.shouldRowBeProcessed);

    feed.forEach(row => {
      try {
        UILogger.getInstance().log(
          `Processing tag '${row[CONFIG.sheets.tagColumns.tagName]}'`
        );
        let tag = App.fetchTagForRow(row);

        if (!tag) {
          throw new Error('Tag not found');
        }

        const action = row[CONFIG.sheets.tagColumns.action] as Action;
        tag = App.applyMigrationChanges(tag, action);
        tag = App.markAsMigrated(App.bootstrap().override, tag, action);

        App.uploadTag(App.bootstrap().override, tag, action);
      } catch (err) {
        const error = err as Error;
        UILogger.getInstance().log(error.message);
      } finally {
        // Note: Could write row status in the future
      }
    });

    App.markWorkspaceAsManaged(App.bootstrap().webWorkspacePath);
    App.markWorkspaceAsManaged(App.bootstrap().serverWorkspacePath);
    UILogger.getInstance().log('Finished advanced configuration actions.');
  }

  /**
   * Get migrated tag name.
   *
   * @param {Array<string | number | boolean>}
   * @returns {string}
   */
  static getRewrittenTagNameForRow(row: Array<string | number | boolean>) {
    const name = row[CONFIG.sheets.tagColumns.tagName];
    const isOverritable = OVERRITABLE_TAGS.includes(
      row[CONFIG.sheets.tagColumns.tagType] as string
    );

    if (App.bootstrap().override || !isOverritable || App.isRewritten(row)) {
      return name;
    } else {
      return App.getRewrittenTagName(name as string);
    }
  }

  /**
   * Check if row is a GA config tag.
   *
   * @returns {boolean}
   */
  static isGAConfigTag(row: Array<string | number | boolean>) {
    return row[CONFIG.sheets.tagColumns.tagType] === TAG_TYPES.web.gaConfig;
  }

  /**
   * Get server tags.
   * Return from variable if initialized.
   * Otherwise determine, store/cache and return for a singleton pattern.
   *
   * @returns {Array<Object>}
   */
  static getServerTags() {
    const res =
      serverTags ||
      TagManagerHelper.listAllTags(App.bootstrap().serverWorkspacePath);

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
   * @returns {GoogleAppsScript.TagManager.Tag[]}
   */
  static getWebTags(forceReload = false) {
    const res =
      !webTags || forceReload
        ? TagManagerHelper.listAllTags(App.bootstrap().webWorkspacePath).filter(
            App.isSupportedTagType
          )
        : webTags;

    // Store result for future queries
    webTags = res;

    return res;
  }

  /**
   * Check if GA Config Tag has Server URL set.
   *
   * @param {Array<string | number | boolean>}
   * @returns {boolean}
   */
  static configTagHasServerUrl(row: Array<string | number | boolean>) {
    const tag = App.fetchTagForRow(row);
    return tag && !!TagManagerHelper.getTagParameter(tag, 'serverContainerUrl');
  }

  /**
   * Get server config name.
   * Return from variable if initialized.
   * Otherwise determine, store/cache and return for a singleton pattern.
   * @returns {string}
   */
  static getServerConfigTagName() {
    const res = SheetsService.getInstance()
      .getValues(CONFIG.sheets.webFeed.name, 'A2')!
      .filter(App.isGAConfigTag)
      .filter(
        row =>
          (App.isRewritten(row) && App.configTagHasServerUrl(row)) ||
          App.isToBeRewritten(row)
      )
      .map(App.getRewrittenTagNameForRow)?.[0];
    return res;
  }

  /**
   * Check if any GA4 Config Tag has been or will be rewritten.
   *
   * @returns {boolean}
   */
  static isAnyGA4ConfigTagRewritten() {
    return (
      SheetsService.getInstance()
        .getValues(CONFIG.sheets.webFeed.name, 'A2')!
        .filter(App.isGAConfigTag)
        .filter(
          row =>
            (App.isRewritten(row) && App.configTagHasServerUrl(row)) ||
            App.isToBeRewritten(row)
        ).length > 0
    );
  }

  /**
   * Mark workspace as managed by adding description.
   *
   * @param {string} workspacePath
   */
  static markWorkspaceAsManaged(workspacePath: string) {
    const managedDescription =
      workspacePath === App.bootstrap().webWorkspacePath
        ? WEB_WORKSPACE_IS_MANAGED_DESCRIPTION
        : SERVER_WORKSPACE_IS_MANAGED_DESCRIPTION;
    const workspace =
      TagManager.Accounts.Containers.Workspaces.get(workspacePath);
    const description = workspace.description || '';

    if (!description.endsWith(managedDescription)) {
      UILogger.getInstance().log('Updating workspace description...');
      workspace.description = `${description}\n${managedDescription}`;
      TagManager.Accounts.Containers.Workspaces.update(
        workspace,
        workspace.path
      );
    }
  }

  /**
   * Mark tag as migrated by adding a note.
   *
   * @param {boolean} override
   * @param {GoogleAppsScript.TagManager.Tag} tag
   * @param {string} action
   * @returns {Object}
   */
  static markAsMigrated(
    override: boolean,
    tag: GoogleAppsScript.TagManager.Tag,
    action: string
  ) {
    tag.notes = App.getMigrationNotes(tag, action, override);

    if (!override && action === Action.REWRITE) {
      tag.name = App.getRewrittenTagName(tag.name);
    }

    return tag;
  }

  /**
   * Create or update tag.
   *
   * @param {boolean} override
   * @param {GoogleAppsScript.TagManager.Tag} tag
   * @param {string} action
   */
  static uploadTag(
    override: boolean,
    tag: GoogleAppsScript.TagManager.Tag,
    action: string
  ) {
    UILogger.getInstance().log(`${action} tag '${tag.name}'`);
    UILogger.getInstance().log(JSON.stringify(tag));

    if (tag.parentFolderId) {
      const webFolder = TagManagerHelper.getFolder(
        App.bootstrap().webWorkspacePath,
        tag.parentFolderId
      );

      tag.parentFolderId = App.migrateFolder(
        App.bootstrap().serverWorkspacePath,
        webFolder
      );
    }

    if (action === Action.MIGRATE) {
      // Create new server Tag
      TagManagerHelper.createTag(tag, App.bootstrap().serverWorkspacePath);
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
  static getAllFolders(workspacePath: string) {
    const folders =
      TagManager.Accounts.Containers.Workspaces.Folders.list(workspacePath);

    if (!folders || !folders.folder) return [];

    return folders.folder;
  }

  /**
   * Make sure all web folders exist on server.
   */
  static migrateAllFolders() {
    // Get all web folders
    const folders = App.getAllFolders(App.bootstrap().webWorkspacePath);

    // Create server folders
    folders.forEach(folder => {
      App.migrateFolder(App.bootstrap().serverWorkspacePath, folder);
    });
  }

  /**
   * Create folder in workspace if not exists.
   *
   * @param {string} workspacePath
   * @param {GoogleAppsScript.TagManager.Folder} folder
   * @returns {number}
   */
  static migrateFolder(
    workspacePath: string,
    folder: GoogleAppsScript.TagManager.Folder
  ) {
    const folders = App.getAllFolders(workspacePath);

    let migratedFolder = folders?.find(f => f.name === folder.name);

    if (!migratedFolder) {
      migratedFolder = TagManager.Accounts.Containers.Workspaces.Folders.create(
        { name: folder.name },
        workspacePath
      );
    }

    return migratedFolder?.folderId;
  }

  static ensureServerMeasurementIdVariableExists(
    workspacePath: string,
    measurementId: string
  ) {
    // Note: could also verify that the value equals measurementId (override if exists and not equal?)
    const existsAlready = TagManagerHelper.listAllVariables(workspacePath).some(
      v => v.name === SERVER_MEASUREMENT_ID_VARIABLE_NAME
    );

    if (!existsAlready) {
      UILogger.getInstance().log(
        `Creating server measurement ID variable ${SERVER_MEASUREMENT_ID_VARIABLE_NAME}`
      );
      TagManagerHelper.createVariable(
        workspacePath,
        SERVER_MEASUREMENT_ID_VARIABLE_NAME,
        measurementId,
        VARIABLE_TYPES.constant.name as keyof typeof VARIABLE_TYPES,
        SERVER_MEASUREMENT_ID_VARIABLE_NOTE
      );
    } else {
      UILogger.getInstance().log(
        `Re-using server measurement ID variable ${SERVER_MEASUREMENT_ID_VARIABLE_NAME}`
      );
    }
  }

  static rewriteGA4Configuration(
    configTag: GoogleAppsScript.TagManager.Tag,
    transportUrl: string,
    override: boolean
  ) {
    TagManagerHelper.setTagParameter(
      configTag,
      'serverContainerUrl',
      'template',
      transportUrl
    );
    TagManagerHelper.setTagParameter(
      configTag,
      'enableSendToServerContainer',
      'boolean',
      'true'
    );
    if (!override) {
      TagManagerHelper.setTagParameter(
        configTag,
        'measurementId',
        'template',
        `{{${SERVER_MEASUREMENT_ID_VARIABLE_NAME}}}`
      );
    }
  }

  static rewriteGA4Event(
    tag: GoogleAppsScript.TagManager.Tag,
    serverConfigTagName: string
  ) {
    TagManagerHelper.setTagParameter(
      tag,
      'measurementId',
      'tagReference',
      serverConfigTagName
    );
  }

  static createNewServerTagType(tag: GoogleAppsScript.TagManager.Tag) {
    delete tag['fingerprint'];
    delete tag['tagManagerUrl'];
    delete tag['tagId'];
    delete tag['workspaceId'];
    delete tag['containerId'];
    delete tag['accountId'];
    delete tag['path'];
    delete tag['firingTriggerId'];

    const serverType = App.getMatchingServerTagType(tag['type']);

    if (!serverType) {
      throw Error('No matching server type');
    }

    tag['type'] = serverType;
  }

  static migrateServerGA4Event(
    tag: GoogleAppsScript.TagManager.Tag,
    webTags: GoogleAppsScript.TagManager.Tag[]
  ) {
    const serverConfigTagName = TagManagerHelper.getTagParameter(
      tag,
      'measurementId'
    )?.value;
    // For the rest of the web tags you need to look inside the parameters to find the serverConfigTagName.
    const configTag =
      webTags.find(tag => tag.name === serverConfigTagName) ||
      webTags.find(serverTag =>
        serverTag.parameter!.find(param => param.value === serverConfigTagName)
      );

    if (!configTag) return;

    App.migrateServerGA4EventLean(tag, configTag);
  }

  static migrateServerGA4EventLean(
    tag: GoogleAppsScript.TagManager.Tag,
    configTag: GoogleAppsScript.TagManager.Tag
  ) {
    // Merge "Additional Metadata"
    const serverConfigTagMonitoringMetadata =
      configTag?.monitoringMetadata?.map;

    if (serverConfigTagMonitoringMetadata) {
      if (tag.monitoringMetadata) {
        tag.monitoringMetadata.map = [
          ...tag.monitoringMetadata.map!,
          ...serverConfigTagMonitoringMetadata,
        ];
      } else {
        tag.monitoringMetadata = configTag?.monitoringMetadata;
      }
    }

    // Merge 'Event Parameters' from GA4 Event Tag with 'Fields to set' from GA4 Config Tag
    const fieldsToSetParameter = TagManagerHelper.getTagParameter(
      configTag,
      'fieldsToSet'
    );
    if (fieldsToSetParameter) {
      TagManagerHelper.updateListParameter(
        tag,
        fieldsToSetParameter,
        'eventParameters'
      );
    }

    // Set 'Default Parameters to Include' to 'None'
    TagManagerHelper.setTagParameter(
      tag,
      'epToIncludeDropdown',
      'template',
      'none'
    );

    // Merge 'User Properties'
    const configTagUserProperties = TagManagerHelper.getTagParameter(
      configTag,
      'userProperties'
    );
    if (configTagUserProperties) {
      TagManagerHelper.updateListParameter(tag, configTagUserProperties);
    }

    // Set 'Default Properties to Include' to 'None'
    TagManagerHelper.setTagParameter(
      tag,
      'upToIncludeDropdown',
      'template',
      'none'
    );

    // Rename 'name' key to 'fieldName'
    tag = App.renameKeyFromNameToFieldName(tag);

    // Update 'Measurement ID' parameter
    const measurementIdParameter = TagManagerHelper.getTagParameter(
      configTag,
      'measurementId'
    );

    if (!measurementIdParameter) return;

    TagManagerHelper.setTagParameter(
      tag,
      measurementIdParameter.key!,
      measurementIdParameter.type,
      measurementIdParameter.value!
    );
  }

  static enableCustomParams(tag: GoogleAppsScript.TagManager.Tag) {
    if (App.hasCustomParams(tag)) {
      tag.parameter?.push({
        key: 'enableCustomParams',
        type: 'boolean',
        value: 'true',
      });
    }
  }

  /**
   * Check if tag has server container URL set and enabled.
   *
   * @param {GoogleAppsScript.TagManager.Tag} tag
   * @param {string} transportUrl
   * @returns {boolean}
   */
  static containsEnabledTransportUrl(
    tag: GoogleAppsScript.TagManager.Tag,
    transportUrl: string
  ) {
    const enableSendToServerContainer =
      TagManagerHelper.getTagParameter(tag, 'enableSendToServerContainer')
        ?.value === 'true';
    const serverContainerUrl = TagManagerHelper.getTagParameter(
      tag,
      'serverContainerUrl'
    )?.value;

    return enableSendToServerContainer && serverContainerUrl === transportUrl;
  }

  /** Get the rewritten config name of a tag
   * @param {GoogleAppsScript.TagManager.Tag} tag
   * @param {boolean} override
   */
  static getRewrittenConfigName(
    tag: GoogleAppsScript.TagManager.Tag,
    override: boolean
  ) {
    const configTagName = TagManagerHelper.getTagParameter(
      tag,
      'measurementId'
    )?.value;

    if (!configTagName) return;

    return override ? configTagName : App.getRewrittenTagName(configTagName);
  }

  /**
   * Manipulate tag to be migrated.
   *
   * @param {GoogleAppsScript.TagManager.Tag} tag
   * @param {string} action
   * @returns {GoogleAppsScript.TagManager.Tag}
   */
  static applyMigrationChanges(
    tag: GoogleAppsScript.TagManager.Tag,
    action: Action
  ) {
    if (action === Action.REWRITE && tag.type === TAG_TYPES.web.gaConfig) {
      App.ensureServerMeasurementIdVariableExists(
        App.bootstrap().webWorkspacePath,
        App.bootstrap().measurementId
      );
      App.rewriteGA4Configuration(
        tag,
        App.bootstrap().transportUrl,
        App.bootstrap().override
      );
    } else if (
      action === Action.REWRITE &&
      tag.type === TAG_TYPES.web.gaEvent
    ) {
      // Rewrite GA4 Event
      const rewrittenConfigTagName = App.getRewrittenConfigName(
        tag,
        App.bootstrap().override
      );
      const webTags = App.getWebTags();
      const rewrittenConfigTagExists = webTags.find(
        tag =>
          tag.name === rewrittenConfigTagName &&
          App.containsEnabledTransportUrl(tag, App.bootstrap().transportUrl)
      );

      if (!rewrittenConfigTagExists) {
        throw new Error(
          'Cannot rewrite GA4 Event due to missing rewritten GA4 Config'
        );
      }

      App.rewriteGA4Event(tag, rewrittenConfigTagName!);
    } else if (App.isSupportedTagType(tag)) {
      App.createNewServerTagType(tag);
    }

    /*if (tag.type === TAG_TYPES.server.gaEvent) {
    migrateServerGA4Event(tag, getWebTags());
  } else if (tag.type === TAG_TYPES.server.adsRemarketing) {
    enableCustomParams(tag);
  }*/

    return tag;
  }

  /**
   * Check if tag has custom parameters.
   *
   * @param {GoogleAppsScript.TagManager.Tag} tag
   * @returns {boolean}
   */
  static hasCustomParams(tag: GoogleAppsScript.TagManager.Tag) {
    return tag.parameter!.some(entry => entry?.key === 'customParams');
  }

  /**
   * Fetch tag for row.
   *
   * @param {Array<string | number | boolean>}
   * @returns {GoogleAppsScript.TagManager.Tag}
   */
  static fetchTagForRow(row: Array<string | number | boolean>) {
    const accountId = row[CONFIG.sheets.tagColumns.accountId];
    const containerId = row[CONFIG.sheets.tagColumns.containerId];
    const workspaceId = row[CONFIG.sheets.tagColumns.workspaceId];
    const tagId = row[CONFIG.sheets.tagColumns.tagId];
    const webTags = App.getWebTags();

    return webTags.find(tag => {
      return (
        tag.accountId === accountId &&
        tag.containerId === containerId &&
        tag.workspaceId === workspaceId &&
        tag.tagId === tagId
      );
    });
  }

  /**
   * Check if row should be processed.
   *
   * @param {Array<string | number | boolean>}
   * @returns {boolean}
   */
  static shouldRowBeProcessed(row: Array<string | number | boolean>) {
    const shouldBeRewritten = !App.isRewritten(row) && App.isToBeRewritten(row);
    const shouldBeMigrated = !App.isMigrated(row) && App.isToBeMigrated(row);

    return shouldBeRewritten || shouldBeMigrated;
  }

  /**
   * Determine Tag status.
   *
   * @param {GoogleAppsScript.TagManager.Tag} tag
   * @returns {string}
   */
  static getTagStatus(tag: GoogleAppsScript.TagManager.Tag) {
    let rewritten = false;
    let migrated = false;

    if (tag.type === TAG_TYPES.web.gaConfig) {
      // Check if GA4 Config Tag itself has been rewritten (override) or if it was rewritten to new Tag (!override)
      const migrationNotes = App.getMigrationNotes(tag, Action.REWRITE, false);
      const rewrittenTag = App.getWebTags().some(webTag =>
        webTag?.notes?.includes(migrationNotes)
      );
      const overriddenTag =
        TagManagerHelper.getTagParameter(tag, 'enableSendToServerContainer')
          ?.value === 'true' &&
        TagManagerHelper.getTagParameter(tag, 'serverContainerUrl')?.value ===
          App.bootstrap().transportUrl;

      rewritten = rewrittenTag || overriddenTag;
    } else if (tag.type === TAG_TYPES.web.gaEvent) {
      // Check if GAG4 Event is referencing migrated GA4 Config Tag
      const configTagName = TagManagerHelper.getTagParameter(
        tag,
        'measurementId'
      )?.value;
      const webTags = App.getWebTags();
      const configTag = webTags.find(tag => tag.name === configTagName);

      rewritten =
        !!configTag &&
        App.containsEnabledTransportUrl(
          configTag,
          App.bootstrap().transportUrl
        ); //TagManagerHelper.getTagParameter(tag, 'measurementId')?.value === serverConfigTagName;
    }

    if (App.isSupportedTagType(tag)) {
      // Check if Tag has been migrated to server container
      migrated = App.getServerTags()
        .map(tag => tag.name)
        .includes(tag.name);
    } else {
      UILogger.getInstance().log(
        `Warning: unknown tag type '${tag.type}'' cannot be checked for migration stage`
      );
      migrated = false;
    }

    // Determine and return status string
    if (rewritten && migrated) {
      return Status.REWRITTEN_AND_MIGRATED;
    } else if (rewritten) {
      return Status.REWRITTEN;
    } else if (migrated) {
      return Status.MIGRATED;
    } else {
      return Status.NONE;
    }
  }

  /**
   * Check if Tag type is supported.
   *
   * @param {GoogleAppsScript.TagManager.Tag} tag
   * @returns {boolean}
   */
  static isSupportedTagType(tag: GoogleAppsScript.TagManager.Tag) {
    return Object.values(TAG_TYPES.web).includes(tag.type);
  }

  /**
   * Get server Tag type for web Tag type.
   *
   * @param {string}
   * @returns {string}
   */
  static getMatchingServerTagType(webTagType: string) {
    const validTypes = Object.keys(
      TAG_TYPES.web
    ) as (keyof typeof TAG_TYPES.web)[] & (keyof typeof TAG_TYPES.server)[];

    const type = validTypes.find(
      t => TAG_TYPES.web[t] === webTagType
    ) as keyof typeof TAG_TYPES.web & keyof typeof TAG_TYPES.server;

    return type in TAG_TYPES.server ? TAG_TYPES.server[type] : '';
  }
}
