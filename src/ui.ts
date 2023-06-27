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
import { CONFIG, START_LEAN_MESSAGE } from './config';
import { createLeanServerTag, migrateWorkspaceLean } from './lean';
import { SheetsService } from './util/SheetsHelper';
import { UILogger } from './util/UILogger';

export const ui = null;

/**
 * Add Menu entry to Spreadsheet
 * This get's triggerd autmatically when the Spreadsheet is opened
 */
export function onOpen() {
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
function writeTagsToSheet(
  tags: Array<Array<string | number | boolean>>,
  sheetName: string
) {
  SheetsService.getInstance()
    .getRangeByName(`${sheetName}!A9`)!
    .offset(
      0,
      0,
      SheetsService.getInstance().getLastRow(sheetName)!,
      SheetsService.getInstance().getLastColumn(sheetName)!
    )
    .clearContent();

  if (tags.length > 0) {
    SheetsService.getInstance().write(tags, `${sheetName}!A9`);
  }
}

/**
 * Fetches tags and writes them in feed sheet
 */
function executeFetch() {
  modalExecution(() => {
    const { webTags, serverTags } = App.fetch();
    writeTagsToSheet(webTags, CONFIG.sheets.webFeed.name);
    writeTagsToSheet(serverTags, CONFIG.sheets.serverFeed.name);
  });
}

/**
 * Migrates all fetched tags and updates
 */
export function executeMigrate() {
  modalExecution(() => {
    try {
      App.migrate();
      App.getWebTags(true);
    } finally {
      executeFetch();
    }

    // Check if there is a rewritten GA4 Config Tag
    if (!App.isAnyGA4ConfigTagRewritten()) {
      SheetsService.alert('Warning', 'No GA4 Config Tag rewritten.');
    }
  });
}

export function activateReadMeSheet() {
  SheetsService.getInstance().activateSheet(CONFIG.sheets.readme.name);
}

export function activateWebTagsSheet() {
  SheetsService.getInstance().activateSheet(CONFIG.sheets.webFeed.name);
}

export function activateConfigSheet() {
  SheetsService.getInstance().activateSheet(CONFIG.sheets.config.name);
}

/**
 * Executes a function while getting the document lock first and releasing it finally
 */
function modalExecution(func: Function) {
  const lock = LockService.getDocumentLock();
  try {
    lock.waitLock(100);
  } catch (e) {
    return SheetsService.alert(
      'Warning',
      'Another script is currently running. Please wait until execution is finished or cancel it.'
    );
  }
  try {
    func();
  } finally {
    lock.releaseLock();
  }
}

export function createLeanServerTagSelected() {
  modalExecution(() => {
    const serverTags = App.getServerTags();
    createLeanServerTag(serverTags, App.bootstrap().serverWorkspacePath);
  });
}

/**
 * Rewrites all tags and creates a lean GA4 server config tag
 */
export function executeLeanMigrationSelected() {
  modalExecution(() => {
    UILogger.getInstance().log(START_LEAN_MESSAGE);
    migrateWorkspaceLean(
      App.bootstrap().webWorkspacePath,
      App.bootstrap().serverWorkspacePath,
      App.bootstrap().override,
      App.bootstrap().transportUrl,
      App.bootstrap().measurementId
    );
  });
}
