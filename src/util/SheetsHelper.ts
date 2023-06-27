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

export class SheetsService {
  private static instance: SheetsService;
  private readonly spreadsheet_: GoogleAppsScript.Spreadsheet.Spreadsheet;

  /**
   * @constructs an instance of SheetsService using an optionally provided
   * Google Sheets spreadsheet ID. If not provided, assumes this is already
   * embedded on a spreadsheet.
   *
   * @param {string} spreadsheetId The optional associated spreadsheet ID
   * @throws {!Error} If a spreadsheet could not be initialized
   */
  constructor(spreadsheetId?: string) {
    let spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet;

    if (spreadsheetId) {
      try {
        spreadsheet = SpreadsheetApp.openById(spreadsheetId);
      } catch (e: unknown) {
        console.error(e as Error);
        throw new Error(
          `Unable to identify spreadsheet with provided ID: ${spreadsheetId}!`
        );
      }
    } else {
      spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    }

    this.spreadsheet_ = spreadsheet;
  }

  /**
   * Get range from current Spreadsheet by name.
   *
   * @param {string} rangeName
   * @returns {GoogleAppsScript.Spreadsheet.Range}
   */
  getRangeByName(rangeName: string) {
    return this.getSpreadsheet().getRangeByName(rangeName);
  }

  /**
   * Get value from named range.
   *
   * @param {string} rangeName
   * @returns {GoogleAppsScript.Spreadsheet.Range}
   */
  getRangeValue(rangeName: string) {
    const range = this.getRangeByName(rangeName);

    return range?.getValue();
  }

  /**
   * Writes data to spreadsheet range.
   *
   * @param {Array<Array<Object>>} values
   * @param {string} rangeName
   */
  write(values: Array<Array<Object>>, rangeName: string) {
    const range = this.getRangeByName(rangeName);

    if (!range) return;

    range.offset(0, 0, values.length, values[0]?.length || 1).setValues(values);
  }

  /**
   * Activate a sheet by name in the active spreadsheet.
   *
   * @param {string} name
   */
  activateSheet(name: string) {
    const sheet = this.getSpreadsheet().getSheetByName(name);

    if (!sheet) return;

    sheet.activate();
  }

  /**
   * Get the last colum of a sheet.
   *
   * @param {string} sheetName
   */
  getLastColumn(sheetName: string) {
    const sheet = this.getSpreadsheet().getSheetByName(sheetName);

    if (!sheet) return;

    return sheet.getLastColumn();
  }

  /**
   * Get the last row of a sheet.
   *
   * @param {string} sheetName
   */
  getLastRow(sheetName: string) {
    const sheet = this.getSpreadsheet().getSheetByName(sheetName);

    if (!sheet) return;

    return sheet.getLastRow();
  }

  /**
   * Clear rows in range.
   *
   * @param {string} rangeName
   */
  clearRows(rangeName: string) {
    const range = this.getRangeByName(rangeName);

    if (!range) return;

    return range.clearContent();
  }

  /**
   * Get cell value by range.
   *
   * @param {string} rangeName
   * @returns {Object}
   */
  getCellValue(rangeName: string) {
    const range = this.getRangeByName(rangeName);

    if (!range) return;

    return range.getValue();
  }

  /**
   * Check if row is empty.
   *
   * @param {string[]}
   * @returns {boolean}
   */
  nonEmptyRow(row: string[]) {
    return row.join('').length > 0;
  }

  /**
   * Get cell values by starting cell and end column until last row
   *
   * @param {string} sheetName
   * @param {number} startCell
   * @return {Array<Array<string | number | boolean>>}
   */
  getValues(
    sheetName: string,
    startCell: string
  ): Array<Array<string | number | boolean>> | undefined {
    const range = this.getRangeByName(`${sheetName}!${startCell}`);
    const sheet = this.getSpreadsheet().getSheetByName(sheetName);

    if (!sheet || !range) return;

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    return range
      .offset(0, 0, lastRow, lastCol)
      .getValues()
      .filter(this.nonEmptyRow);
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
  static alert(title: string, message: string) {
    try {
      const ui = SpreadsheetApp.getUi();
      ui.alert(title, message, ui.ButtonSet.OK);
    } catch (e) {
      // Cannot call SpreadsheetApp.getUi() from this context
      console.log(`[${title}] ${message}`);
    }
  }

  /**
   * Returns the initialized {@link SpreadsheetApp.Spreadsheet} reference.
   *
   * @returns {?SpreadsheetApp.Spreadsheet} The spreadsheet
   */
  getSpreadsheet() {
    return this.spreadsheet_;
  }

  /**
   * Returns the SheetsService instance, initializing it if it does not exist yet.
   *
   * @param {string} spreadsheetId
   * @returns {!SheetsService} The initialized SheetsService instance
   */
  static getInstance(spreadsheetId?: string) {
    if (typeof this.instance === 'undefined') {
      this.instance = new SheetsService(spreadsheetId);
    }

    return this.instance;
  }
}
