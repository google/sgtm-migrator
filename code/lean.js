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

/**
 * Rewrites a tag by re-using the modifyTag function
 * @param {object} tag 
 * @param {boolean} override 
 * @param {Function} rewriteFunction 
 */
function rewriteTag(tag, override, rewriteFunction) {
    modifyTag(tag, override, CONFIG.sheets.webFeed.actions.rewrite, rewriteFunction);
}

/**
 * Migrates a tag by re-using the modifyTag function
 * @param {object} tag 
 * @param {boolean} override 
 * @param {Function} migrateFunction 
 */
function migrateTag(tag, override, migrateFunction) {
    modifyTag(tag, override, CONFIG.sheets.webFeed.actions.migrate, migrateFunction);
}

/**
 * Generic Helper to modify, mark and upload a tag
 * @param {object} tag 
 * @param {boolean} override 
 * @param {string} action
 * @param {Function} modifyFunction 
 */
function modifyTag(tag, override, action, modifyFunction = null) {
    tag = copy(tag);
    if (modifyFunction) {
        modifyFunction(tag);
    }
    markAsMigrated(override, tag, action);
    uploadTag(override, tag, action);
}

/**
 * Rewrites a tag with the lean approach
 * @param {object} tag 
 * @param {boolean} override 
 * @param {string} transportUrl 
 */
function rewriteTagLean(tag, override, transportUrl) {
    if (tag.type === TAG_TYPES.web.gaConfig) {
        rewriteTag(tag, override, tag => rewriteGA4Configuration(tag, transportUrl, override));
    } else if (tag.type === TAG_TYPES.web.gaEvent) {
        const configTagName = TagManagerHelper.getTagParameter(tag, 'measurementId').value;
        const rewrittenConfigTagName = override ? configTagName : getRewrittenTagName(configTagName);
        rewriteTag(tag, override, tag => rewriteGA4Event(tag, rewrittenConfigTagName));
    }
}

/**
 * Migrates a tag with the lean approach
 * @param {object} tag 
 * @param {boolean} override 
 */
function migrateTagLean(tag, override) {
    createNewServerTagType(tag);
    // special handling
    if (tag.type === TAG_TYPES.server.adsRemarketing) {
        migrateTag(tag, override, enableCustomParams);
    } else {
        migrateTag(tag, override)
    }
}

/**
 * Checks if a tag is migrated with the lean approach
 * @param {*} tag 
 * @param {*} serverTags 
 * @returns {boolean}
 */
function isMigratedLean(tag, serverTags) {
    return isSupportedTagType(tag) && serverTags.map(tag => tag.name).includes(tag.name);
}

/**
 * Verifies if a tag contains the transport URL
 * @param {object} tag 
 * @param {string} transportUrl 
 * @returns {boolean}
 */
function containsTransportUrl(tag, transportUrl) {
    const enableSendToServerContainer = TagManagerHelper.getTagParameter(tag, 'enableSendToServerContainer')?.value === 'true'
    const serverContainerUrl = TagManagerHelper.getTagParameter(tag, 'serverContainerUrl')?.value;
    return enableSendToServerContainer && serverContainerUrl === transportUrl;
}

/**
 * Returns true if a tag is a rewritten config
 * @param {object} tag 
 * @param {object[]} webTags 
 * @param {string} transportUrl 
 * @returns boolean
 */
function isRewrittenConfig(tag, webTags, transportUrl) {
    // Check if GA4 Config Tag itself has been rewritten (override) or if it was rewritten to new Tag (!override)
    const migrationNotes = getMigrationNotes(tag, CONFIG.sheets.webFeed.actions.rewrite, false);
    const rewrittenTagExists = webTags.some(tag => tag.notes?.includes(migrationNotes));
    return rewrittenTagExists || containsTransportUrl(tag, transportUrl);
}

/**
 * Checks if a tag itself is rewritten (and not only its rewritten copy)
 * @param {object} tag 
 * @param {boolean} override 
 * @returns {boolean}
 */
function tagItselfIsRewritten(tag, override) {
    const rewrittenConfigName = getRewrittenConfigName(tag, override);
    return TagManagerHelper.getTagParameter(tag, 'measurementId')?.value === rewrittenConfigName;
}

/**
 * Checks if a rewritten copy of a tag exists
 * @param {object} tag 
 * @param {object[]} webTags 
 * @returns 
 */
function rewrittenCopyExists(tag, webTags) {
    const rewrittenTagName = getRewrittenTagName(tag.name);
    return webTags.some(tag => tag.name === rewrittenTagName);
}

/**
 * Checks if a tag was rewritten
 * @param {object} tag 
 * @param {object[]} webTags 
 * @param {boolean} override 
 * @param {string} transportUrl 
 * @returns {boolean}
 */
function isRewrittenLean(tag, webTags, override, transportUrl) {
    if (tag.name === '[GA4] Event A with Config #1 - sGTM') {
        console.log(tag);
    }
    if (tag.type === TAG_TYPES.web.gaConfig) {
        return isRewrittenConfig(tag, webTags, transportUrl);
    } else if (tag.type === TAG_TYPES.web.gaEvent) {
        return tagItselfIsRewritten(tag, override) || rewrittenCopyExists(tag, webTags);
    } else {
        return false;
    }
}

/**
 * Create a lean server GA4 config tag on server if it not already exists
 * @param {object[]} serverTags 
 * @param {string} serverWorkspacePath 
 */
function createLeanServerTag(serverTags, serverWorkspacePath) {
    const leanServerTag = {
        "name": "GA4 All Events",
        "type": "sgtmgaaw",
    };
    if (!serverTags.some(tag => tag.name === leanServerTag.name)) {
        logger.log(`Ceate Lean server tag`, leanServerTag);
        TagManagerHelper.createTag(leanServerTag, serverWorkspacePath);
    } else {
        logger.log(`Lean server tag '${leanServerTag.name} already exists.'`);
    }
}

/**
 * Verifies if a tag can be migrated with the lean approach
 * @param {object} tag 
 * @param {boolean} override 
 * @returns {boolean}
 */
function isLeanMigratable(tag, override) {
    const tagIsOverritable = OVERRITABLE_TAGS.includes(tag.type);
    const isRootTag = override || !tagIsOverritable || !tagItselfIsRewritten(tag, override);
    return isRootTag && !OVERRITABLE_TAGS.includes(tag.type);
}

/**
 * Performs a lean action (rewrite or migrate) on a tag
 * @param {object} tag 
 * @param {boolean} override 
 * @param {object[]} webTags 
 * @param {string} transportUrl 
 * @param {object[]} serverTags 
 */
function performLeanActionOnTag(tag, override, webTags, transportUrl, serverTags) {
    if (isLeanMigratable(tag, override)) {
        if (!(isMigratedLean(tag, serverTags))) {
            migrateTagLean(tag, override);
        } else {
            logger.log(`Skipping already migrated tag ${tag.name}`);
        }
    }

    if (!isRewrittenLean(tag, webTags, override, transportUrl)) {
        rewriteTagLean(tag, override, transportUrl);
    } else {
        logger.log(`Skipping already rewritten tag ${tag.name}`);
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
function migrateWorkspaceLean(webWorkspacePath, serverWorkspacePath, override, transportUrl, measurementId) {
    ensureServerMeasurementIdVariableExists(webWorkspacePath, measurementId);

    logger.log('createQueryParamVariablesOnServer');
    createQueryParamVariablesOnServer();
    logger.log('createDefaultServerVariables');
    createDefaultServerVariables();

    const webTags = TagManagerHelper.listAllTags(webWorkspacePath).filter(isSupportedTagType);
    const serverTags = TagManagerHelper.listAllTags(serverWorkspacePath);

    createLeanServerTag(serverTags, serverWorkspacePath);

    // migrate and rewrite all others
    webTags.forEach(tag => {
        performLeanActionOnTag(tag, override, webTags, transportUrl, serverTags);
    });

    markWorkspaceAsManaged(webWorkspacePath);
    markWorkspaceAsManaged(serverWorkspacePath);
    logger.log('Finished lean migration.')
}