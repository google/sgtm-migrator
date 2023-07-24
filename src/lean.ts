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

import { App } from './app';
import { TAG_TYPES, OVERRITABLE_TAGS, Action } from './config';
import { TagManagerHelper } from './util/TagManagerHelper';
import { UILogger } from './util/UILogger';
import { copy } from './util/utils';

/**
 * Rewrites a tag by re-using the modifyTag function
 * @param {GoogleAppsScript.TagManager.Tag} tag
 * @param {boolean} override
 * @param {Function} rewriteFunction
 */
function rewriteTag(
  tag: GoogleAppsScript.TagManager.Tag,
  override: boolean,
  rewriteFunction: Function
) {
  modifyTag(tag, override, Action.REWRITE, rewriteFunction);
}

/**
 * Migrates a tag by re-using the modifyTag function
 * @param {GoogleAppsScript.TagManager.Tag} tag
 * @param {boolean} override
 * @param {Function | undefined} migrateFunction
 */
function migrateTag(
  tag: GoogleAppsScript.TagManager.Tag,
  override: boolean,
  migrateFunction?: Function
) {
  modifyTag(tag, override, Action.MIGRATE, migrateFunction);
}

/**
 * Generic Helper to modify, mark and upload a tag
 * @param {GoogleAppsScript.TagManager.Tag} tag
 * @param {boolean} override
 * @param {string} action
 * @param {Function} modifyFunction
 */
function modifyTag(
  tag: GoogleAppsScript.TagManager.Tag,
  override: boolean,
  action: string,
  modifyFunction: Function | undefined
) {
  tag = copy(tag as unknown as Record<string, unknown>);
  if (modifyFunction) {
    modifyFunction(tag);
  }
  App.markAsMigrated(override, tag, action);
  App.uploadTag(override, tag, action);
}

/**
 * Rewrites a tag with the lean approach
 * @param {GoogleAppsScript.TagManager.Tag} tag
 * @param {boolean} override
 * @param {string} transportUrl
 */
function rewriteTagLean(
  tag: GoogleAppsScript.TagManager.Tag,
  override: boolean,
  transportUrl: string
) {
  if (tag.type === TAG_TYPES.web.gaConfig) {
    rewriteTag(tag, override, (tag: GoogleAppsScript.TagManager.Tag) =>
      App.rewriteGA4Configuration(tag, transportUrl, override)
    );
  } else if (tag.type === TAG_TYPES.web.gaEvent) {
    const configTagName = TagManagerHelper.getTagParameter(
      tag,
      'measurementId'
    )!.value;

    if (!configTagName) return;

    const rewrittenConfigTagName = override
      ? configTagName
      : App.getRewrittenTagName(configTagName);
    rewriteTag(tag, override, (tag: GoogleAppsScript.TagManager.Tag) =>
      App.rewriteGA4Event(tag, rewrittenConfigTagName)
    );
  }
}

/**
 * Migrates a tag with the lean approach
 * @param {GoogleAppsScript.TagManager.Tag} tag
 * @param {boolean} override
 */
function migrateTagLean(
  tag: GoogleAppsScript.TagManager.Tag,
  override: boolean
) {
  App.createNewServerTagType(tag);
  // special handling
  if (tag.type === TAG_TYPES.server.adsRemarketing) {
    migrateTag(tag, override, App.enableCustomParams);
  } else {
    migrateTag(tag, override);
  }
}

/**
 * Checks if a tag is migrated with the lean approach
 * @param {GoogleAppsScript.TagManager.Tag} tag
 * @param {GoogleAppsScript.TagManager.Tag[]} serverTags
 * @returns {boolean}
 */
function isMigratedLean(
  tag: GoogleAppsScript.TagManager.Tag,
  serverTags: GoogleAppsScript.TagManager.Tag[]
) {
  return (
    App.isSupportedTagType(tag) &&
    serverTags.map(tag => tag.name).includes(tag.name)
  );
}

/**
 * Verifies if a tag contains the transport URL
 * @param {GoogleAppsScript.TagManager.Tag} tag
 * @param {string} transportUrl
 * @returns {boolean}
 */
function containsTransportUrl(
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

/**
 * Returns true if a tag is a rewritten config.
 *
 * @param {GoogleAppsScript.TagManager.Tag} tag
 * @param {GoogleAppsScript.TagManager.Tag[]} webTags
 * @param {string} transportUrl
 * @returns {boolean}
 */
function isRewrittenConfig(
  tag: GoogleAppsScript.TagManager.Tag,
  webTags: GoogleAppsScript.TagManager.Tag[],
  transportUrl: string
) {
  // Check if GA4 Config Tag itself has been rewritten (override) or if it was rewritten to new Tag (!override)
  const migrationNotes = App.getMigrationNotes(tag, Action.REWRITE, false);
  const rewrittenTagExists = webTags.some(tag =>
    tag.notes?.includes(migrationNotes)
  );
  return rewrittenTagExists || containsTransportUrl(tag, transportUrl);
}

/**
 * Checks if a tag itself is rewritten (and not only its rewritten copy).
 *
 * @param {GoogleAppsScript.TagManager.Tag} tag
 * @param {boolean} override
 * @returns {boolean}
 */
function tagItselfIsRewritten(
  tag: GoogleAppsScript.TagManager.Tag,
  override: boolean
) {
  const rewrittenConfigName = App.getRewrittenConfigName(tag, override);
  return (
    TagManagerHelper.getTagParameter(tag, 'measurementId')?.value ===
    rewrittenConfigName
  );
}

/**
 * Checks if a rewritten copy of a tag exists
 * @param {GoogleAppsScript.TagManager.Tag} tag
 * @param {GoogleAppsScript.TagManager.Tag[]} webTags
 * @returns
 */
function rewrittenCopyExists(
  tag: GoogleAppsScript.TagManager.Tag,
  webTags: GoogleAppsScript.TagManager.Tag[]
) {
  const rewrittenTagName = App.getRewrittenTagName(tag.name);
  return webTags.some(tag => tag.name === rewrittenTagName);
}

/**
 * Checks if a tag was rewritten
 * @param {GoogleAppsScript.TagManager.Tag} tag
 * @param {GoogleAppsScript.TagManager.Tag[]} webTags
 * @param {boolean} override
 * @param {string} transportUrl
 * @returns {boolean}
 */
function isRewrittenLean(
  tag: GoogleAppsScript.TagManager.Tag,
  webTags: GoogleAppsScript.TagManager.Tag[],
  override: boolean,
  transportUrl: string
) {
  if (tag.name === '[GA4] Event A with Config #1 - sGTM') {
    console.log(tag);
  }
  if (tag.type === TAG_TYPES.web.gaConfig) {
    return isRewrittenConfig(tag, webTags, transportUrl);
  } else if (tag.type === TAG_TYPES.web.gaEvent) {
    return (
      tagItselfIsRewritten(tag, override) || rewrittenCopyExists(tag, webTags)
    );
  } else {
    return false;
  }
}

/**
 * Create a lean server GA4 config tag on server if it not already exists
 * @param {GoogleAppsScript.TagManager.Tag[]} serverTags
 * @param {string} serverWorkspacePath
 */
export function createLeanServerTag(
  serverTags: GoogleAppsScript.TagManager.Tag[],
  serverWorkspacePath: string
) {
  const leanServerTag = {
    name: 'GA4 All Events',
    type: 'sgtmgaaw',
  };
  if (!serverTags.some(tag => tag.name === leanServerTag.name)) {
    UILogger.getInstance().log(`Create Lean server tag`, leanServerTag);
    TagManagerHelper.createTag(leanServerTag, serverWorkspacePath);
  } else {
    UILogger.getInstance().log(
      `Lean server tag '${leanServerTag.name} already exists.'`
    );
  }
}

/**
 * Verifies if a tag can be migrated with the lean approach
 * @param {GoogleAppsScript.TagManager.Tag} tag
 * @param {boolean} override
 * @returns {boolean}
 */
function isLeanMigratable(
  tag: GoogleAppsScript.TagManager.Tag,
  override: boolean
) {
  const tagIsOverritable = OVERRITABLE_TAGS.includes(tag.type);
  const isRootTag =
    override || !tagIsOverritable || !tagItselfIsRewritten(tag, override);
  return isRootTag && !OVERRITABLE_TAGS.includes(tag.type);
}

/**
 * Performs a lean action (rewrite or migrate) on a tag
 * @param {GoogleAppsScript.TagManager.Tag} tag
 * @param {boolean} override
 * @param {GoogleAppsScript.TagManager.Tag[]} webTags
 * @param {string} transportUrl
 * @param {GoogleAppsScript.TagManager.Tag[]} serverTags
 */
function performLeanActionOnTag(
  tag: GoogleAppsScript.TagManager.Tag,
  override: boolean,
  webTags: GoogleAppsScript.TagManager.Tag[],
  transportUrl: string,
  serverTags: GoogleAppsScript.TagManager.Tag[]
) {
  if (isLeanMigratable(tag, override)) {
    if (!isMigratedLean(tag, serverTags)) {
      migrateTagLean(tag, override);
    } else {
      UILogger.getInstance().log(`Skipping already migrated tag ${tag.name}`);
    }
  }

  if (!isRewrittenLean(tag, webTags, override, transportUrl)) {
    rewriteTagLean(tag, override, transportUrl);
  } else {
    UILogger.getInstance().log(`Skipping already rewritten tag ${tag.name}`);
  }
}

/**
 * Migrate a workspace with the lean approach
 * @param {string} webWorkspacePath
 * @param {string} serverWorkspacePath
 * @param {boolean} override
 * @param {string} transportUrl
 * @param {string} measurementId
 */
export function migrateWorkspaceLean(
  webWorkspacePath: string,
  serverWorkspacePath: string,
  override: boolean,
  transportUrl: string,
  measurementId: string
) {
  App.ensureServerMeasurementIdVariableExists(webWorkspacePath, measurementId);

  UILogger.getInstance().log('createQueryParamVariablesOnServer');
  App.createQueryParamVariablesOnServer();
  UILogger.getInstance().log('createDefaultServerVariables');
  App.createDefaultServerVariables();

  const webTags = TagManagerHelper.listAllTags(webWorkspacePath).filter(
    App.isSupportedTagType
  );
  const serverTags = TagManagerHelper.listAllTags(serverWorkspacePath);

  createLeanServerTag(serverTags, serverWorkspacePath);

  // migrate and rewrite all others
  webTags.forEach(tag => {
    performLeanActionOnTag(tag, override, webTags, transportUrl, serverTags);
  });

  App.markWorkspaceAsManaged(webWorkspacePath);
  App.markWorkspaceAsManaged(serverWorkspacePath);
  UILogger.getInstance().log('Finished lean migration.');
}
