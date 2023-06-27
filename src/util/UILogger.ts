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

import { CONFIG } from '../config';

/**
 * Logger that displays messages on a spreadsheet
 */
export class UILogger {
  private static instance: UILogger;
  startCell: string;
  maxLogs: number;

  constructor(startCell: string, maxLogs = 1000) {
    this.startCell = startCell;
    this.maxLogs = maxLogs;
    SpreadsheetApp.getActiveSpreadsheet()
      .getRange(startCell)
      .offset(0, 0, maxLogs, 1)
      .clearContent();
    SpreadsheetApp.flush();
  }

  log(value: Object, ...values: Object[]) {
    const start = SpreadsheetApp.getActiveSpreadsheet().getRange(
      this.startCell
    );

    // select all but oldest message
    const range = start.offset(0, 0, this.maxLogs - 1, 1);

    // move them down by 1 wor
    range.copyTo(range.offset(1, 0), { contentsOnly: true });
    const message = [value, ...values]
      .map(v => (typeof v === 'object' ? JSON.stringify(v) : v))
      .join(' ');
    start.setValue(message);
    console.log(message);

    try {
      SpreadsheetApp.flush();
    } catch (e) {
      console.log(e);
    }
  }

  /**
   * Returns the UILogger instance, initializing it if it does not exist yet.
   *
   * @returns {!UILogger} The initialized SheetsService instance
   */
  static getInstance(
    startCell = CONFIG.logging.startRangeName,
    maxLogs = CONFIG.logging.maxLogs
  ) {
    if (typeof this.instance === 'undefined') {
      this.instance = new UILogger(startCell, maxLogs);
    }

    return this.instance;
  }
}
