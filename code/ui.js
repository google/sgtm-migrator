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
 * Add Menu entry to Spreadsheet
 * This get's triggerd autmatically when the Spreadsheet is opened
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('sGTM Migrator')
    .addItem('Read me', 'activateReadMeSheet')
    .addItem('[Recommended] Migrate all', 'activateConfigSheet')
    .addItem('Advanced Configuration', 'activateWebTagsSheet')
    .addToUi();
}

/**
 * Writes given tags represented as rows to an output sheet until lastColumn is reached
 */
function writeTagsToSheet(tags, sheetName) {
  SheetsHelper.getRangeByName(`${sheetName}!A9`)
    .offset(0, 0, SheetsHelper.getLastRow(sheetName), SheetsHelper.getLastColumn(sheetName))
    .clearContent();

  if (tags.length > 0) {
    SheetsHelper.write(tags, `${sheetName}!A9`);
  }
}

/**
 * Fetches tags and writes them in feed sheet
 */
function executeFetch() {
  modalExecution(() => {
    const { webTags, serverTags } = fetch();
    writeTagsToSheet(webTags, CONFIG.sheets.webFeed.name);
    writeTagsToSheet(serverTags, CONFIG.sheets.serverFeed.name);
  });
}

/**
 * Migrates all fetched tags and updates 
 */
function executeMigrate() {
  modalExecution(() => {
    try {
      migrate();
      getWebTags(true);
    } finally {
      executeFetch();
    }

    // Check if there is a rewritten GA4 Config Tag
    if (!isAnyGA4ConfigTagRewritten()) {
      SheetsHelper.alert('Warning', 'No GA4 Config Tag rewritten.');
    }
  });
}

function activateReadMeSheet() {
  SheetsHelper.activateSheet(CONFIG.sheets.readme.name);
}

function activateWebTagsSheet() {
  SheetsHelper.activateSheet(CONFIG.sheets.webFeed.name);
}

function activateConfigSheet() {
  SheetsHelper.activateSheet(CONFIG.sheets.config.name);
}

/**
 * Executes a function while getting the document lock first and releasing it finally
 */
function modalExecution(func) {
  const lock = LockService.getDocumentLock();
  try {
    lock.waitLock(100);
  } catch (e) {
    return SheetsHelper.alert("Warning", "Another script is currently running. Please wait until execution is finished or canceling it.");
  }
  try {
    func();
  } finally {
    lock.releaseLock();
  }
}

function createLeanServerTagSelected() {
  modalExecution(() => {
    const serverTags = getServerTags()
    createLeanServerTag(serverTags, bootstrap().serverWorkspacePath);
  });
}

/**
 * Rewrites all tags and creates a lean GA4 server config tag
 */
function executeLeanMigrationSelected() {
  modalExecution(() => {
    logger.log(START_LEAN_MESSAGE);
    migrateWorkspaceLean(
      bootstrap().webWorkspacePath,
      bootstrap().serverWorkspacePath,
      bootstrap().override,
      bootstrap().transportUrl,
      bootstrap().measurementId
    );
  });
}