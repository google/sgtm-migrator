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

class SheetsHelper {
  /**
   * Get range from current Spreadsheet by name.
   *
   * @param {string} range
   * @returns {Object}
   */
  static getRangeByName(range) {
    return SpreadsheetApp.getActiveSpreadsheet().getRangeByName(range);
  }

  /**
   * Writes data to spreadsheet range.
   *
   * @param {Array<Array<Object>>} values
   * @param {string} range
   */
  static write(values, range) {
    SheetsHelper.getRangeByName(range)
      .offset(0, 0, values.length, values[0]?.length || 1)
      .setValues(values);
  }

  /** Activate a sheet by name in the active spreadsheet
   * @param {string} name
   */
  static activateSheet(name) {
    SpreadsheetApp.getActive().getSheetByName(name).activate();
  }

  /** Get the last colum of a sheet
   * @param {string} sheetName
   */
  static getLastColumn(sheetName) {
    return SpreadsheetApp.getActive().getSheetByName(sheetName).getLastColumn();
  }

  /** Get the last row of a sheet
   * @param {string} sheetName
   */
  static getLastRow(sheetName) {
    return SpreadsheetApp.getActive().getSheetByName(sheetName).getLastRow();
  }

  /**
   * Clear rows in range.
   *
   * @param {string} range
   */
  static clearRows(range) {
    SheetsHelper.getRangeByName(range).clearContent();
  }

  /**
   * Get cell value by range.
   *
   * @param {string} range
   * @returns {Object}
   */
  static getCellValue(range) {
    return SheetsHelper.getRangeByName(range).getValue();
  }

  /**
   * Check if row is empty.
   *
   * @param {Array<>}
   * @returns {boolean}
   */
  static nonEmptyRow(row) {
    return row.join('').length > 0;
  }

  /**
   * Get cell values by starting cell and end column until last row
   *
   * @param {Sheet} sheetName
   * @param {string} startCell
   * @return {Object}
   */
  static getValues(sheetName, startCell) {
    const range = SheetsHelper.getRangeByName(`${sheetName}!${startCell}`);
    const sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    return range.offset(0, 0, lastRow, lastCol).getValues().filter(SheetsHelper.nonEmptyRow);
  }

  /**
   * Show popup message in Sheets.
   * Promts a message when executed from a container sheet
   * or uses console when executed from AppScript code directly
   *
   * @param {string} title
   * @param {string} message
   * @returns {string} message
   */
  static alert(title, message) {
    try {
      const ui = SpreadsheetApp.getUi();
      ui.alert(title, message, ui.ButtonSet.OK);
    } catch (e) {
      // Cannot call SpreadsheetApp.getUi() from this context
      console.log(`[${title}] ${message}`);
    }
  }
}