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
 * Logger that displays messages on a spreadsheet
 */
class UILogger {
  constructor(startCell, maxLogs = 1000) {
    this.startCell = startCell;
    this.maxLogs = maxLogs;
    SpreadsheetApp.getActiveSpreadsheet()
      .getRange(startCell)
      .offset(0, 0, maxLogs, 1)
      .clearContent()
    SpreadsheetApp.flush();
  }

  log(value, ...values) {
    const start = SpreadsheetApp.getActiveSpreadsheet().getRange(this.startCell);

    // select all but oldest message
    const range = start.offset(0, 0, this.maxLogs - 1, 1);

    // move them down by 1 wor
    range.copyTo(range.offset(1, 0), { contentsOnly: true });
    const message = [value, ...values].map(x => typeof x == "object" ? JSON.stringify(x) : x).join(' ')
    start.setValue(message);
    console.log(message);

    try {
      SpreadsheetApp.flush();
    } catch (e) {
      console.log(e);
    }
  }
}