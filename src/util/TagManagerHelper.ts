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

import { VARIABLE_TYPES } from '../config';

export class TagManagerHelper {
  /**
   * Respect limitation of 0.25 queries per second.
   * 0.25 queries/sec <==> 1 query/4sec
   */
  static get queryDelay() {
    return 4000;
  }

  /**
   * Get workspace path.
   *
   * @param {string} accountId
   * @param {string} containerId
   * @param {string} workspaceId
   * @returns {string}
   */
  static getWorkspacePath(
    accountId: string,
    containerId: string,
    workspaceId: string
  ) {
    return `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`;
  }

  /**
   * Get workspace path from tag.
   *
   * @param {Object}
   * @returns {string}
   */
  static getWorkspacePathFromTag(tag: GoogleAppsScript.TagManager.Tag) {
    return TagManagerHelper.getWorkspacePath(
      tag.accountId!,
      tag.containerId!,
      tag.workspaceId!
    );
  }

  /**
   * Create tag.
   *
   * @param {GoogleAppsScript.TagManager.Tag} tag
   * @param {string|null} workspacePath
   */
  static createTag(tag: GoogleAppsScript.TagManager.Tag, workspacePath = '') {
    workspacePath =
      workspacePath || TagManagerHelper.getWorkspacePathFromTag(tag);

    TagManagerHelper.callService(
      TagManager.Accounts.Containers.Workspaces.Tags.create,
      tag,
      workspacePath
    );
  }

  /**
   * Update tag.
   *
   * @param {GoogleAppsScript.TagManager.Tag} tag
   */
  static updateTag(tag: GoogleAppsScript.TagManager.Tag) {
    TagManagerHelper.callService(
      TagManager.Accounts.Containers.Workspaces.Tags.update,
      tag,
      tag.path!
    );
  }

  /**
   * List all tags.
   *
   * @param {string} workspacePath
   * @returns {Array<Object>}
   */
  static listAllTags(workspacePath: string) {
    let tags: GoogleAppsScript.TagManager.Tag[] = [];
    let nextPageToken;

    do {
      const res = TagManagerHelper.callService(
        TagManager.Accounts.Containers.Workspaces.Tags.list,
        workspacePath
      );

      tags = res.tag ? tags.concat(res.tag) : tags;
      nextPageToken = res.nextPageToken;
    } while (nextPageToken);

    return tags;
  }

  /**
   * Fetch tag.
   *
   * @param {string} accountId
   * @param {string} containerId
   * @param {string} workspaceId
   * @param {string} tagId
   * @returns {Object}
   */
  static fetchTag(
    accountId: string,
    containerId: string,
    workspaceId: string,
    tagId: string
  ) {
    const path = `${TagManagerHelper.getWorkspacePath(
      accountId,
      containerId,
      workspaceId
    )}/tags/${tagId}`;
    const tag = TagManagerHelper.callService(
      TagManager.Accounts.Containers.Workspaces.Tags.get,
      path
    );

    return tag;
  }

  /**
   * Get Tag parameter.
   *
   * @param {GoogleAppsScript.TagManager.Tag} tag
   * @param {string} key
   * @returns {Object}
   */
  static getTagParameter(tag: GoogleAppsScript.TagManager.Tag, key: string) {
    return tag.parameter?.find(p => p.key === key);
  }

  /**
   * Set tag parameter.
   * Updates the passed Tag by reference.
   *
   * @param {GoogleAppsScript.TagManager.Tag} tag
   * @param {string} key
   * @param {string} type
   * @param {string} value
   */
  static setTagParameter(
    tag: GoogleAppsScript.TagManager.Tag,
    key: string,
    type: string,
    value: string
  ) {
    const parameters = tag.parameter!.filter(
      parameter => parameter && parameter.key !== key
    );

    parameters.push({
      key,
      type,
      value,
    });

    tag.parameter = parameters;
  }

  /**
   * Update list parameter.
   * If source key and target key do not match, override using targetKey.
   *
   * @param {GoogleAppsScript.TagManager.Tag} tag
   * @param {GoogleAppsScript.TagManager.Parameter} parameter
   * @param {string} targetKey
   */
  static updateListParameter(
    tag: GoogleAppsScript.TagManager.Tag,
    parameter: GoogleAppsScript.TagManager.Parameter,
    targetKey?: string
  ) {
    const searchKey = targetKey ?? parameter.key;
    const originalParam = tag.parameter!.find(param => param.key === searchKey);

    if (originalParam) {
      originalParam.list = originalParam.list!.concat(parameter.list!);
      tag.parameter = tag
        .parameter!.filter(param => param.key !== searchKey)
        .concat(originalParam);
    } else {
      tag.parameter!.push(parameter);
    }
  }

  /**
   * List all variables of given workspace path.
   *
   * @param {string} workspacePath
   * @returns {GoogleAppsScript.TagManager.Variables[]} array of variables
   */
  static listAllVariables(workspacePath: string) {
    const res = TagManagerHelper.callService(
      TagManager.Accounts.Containers.Workspaces.Variables.list,
      workspacePath
    );

    return res.variable || [];
  }

  /**
   * List all built-in variables of given workspace path.
   *
   * @param {string} workspacePath
   * @returns {Array<Object>} array of variables
   */
  static listAllBuiltInVariables(workspacePath: string) {
    const res = TagManagerHelper.callService(
      TagManager.Accounts.Containers.Workspaces.Built_in_variables.list,
      workspacePath
    );

    return res.builtInVariable || [];
  }

  /**
   * Create variable.
   *
   * @param {string} workspacePath
   * @param {string} name
   * @param {string} value
   * @param {string} type
   * @param {string} notes
   */
  static createVariable(
    workspacePath: string,
    name: string,
    value: string,
    type: keyof typeof VARIABLE_TYPES,
    notes = ''
  ) {
    const variable: GoogleAppsScript.TagManager.Variable = {
      name: name,
      type: VARIABLE_TYPES[type].type,
      parameter: [
        {
          type: 'template',
          key: VARIABLE_TYPES[type].key,
          value: value,
        },
      ],
    };

    if (notes) {
      const existingNotes = variable.notes ? `${variable.notes}\n` : '';
      variable.notes = `${existingNotes}${notes}`;
    }

    TagManagerHelper.callService(
      TagManager.Accounts.Containers.Workspaces.Variables.create,
      variable,
      workspacePath
    );
  }

  /**
   * Create built-in variable.
   *
   * @param {string} workspacePath
   * @param {string} type
   */
  static createBuiltInVariable(workspacePath: string, type: string) {
    TagManagerHelper.callService(
      TagManager.Accounts.Containers.Workspaces.Built_in_variables.create,
      workspacePath,
      {
        type,
      }
    );
  }

  /**
   * Get folder by ID.
   *
   * @param {string} workspacePath
   * @param {string} folderId
   * @returns {TagManager.Accounts.Containers.Workspaces.Folder}
   */
  static getFolder(workspacePath: string, folderId: string) {
    return TagManagerHelper.callService(
      TagManager.Accounts.Containers.Workspaces.Folders.get,
      `${workspacePath}/folders/${folderId}`
    );
  }

  static callService<T extends (...args: any[]) => ReturnType<T>>(
    fn: T,
    ...argx: Object[]
  ): ReturnType<T> {
    try {
      return fn(...argx);
    } catch (err) {
      const error = err as Error & { details: { code: number } };
      if (error.details.code === 429) {
        Utilities.sleep(TagManagerHelper.queryDelay);

        return TagManagerHelper.callService(fn, ...argx);
      }

      throw new Error(error.message);
    }
  }
}
