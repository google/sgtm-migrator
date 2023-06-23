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

class TagManagerHelper {
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
  static getWorkspacePath(accountId, containerId, workspaceId) {
    return `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`;
  }

  /**
   * Get workspace path from tag.
   *
   * @param {Object}
   * @returns {string}
   */
  static getWorkspacePathFromTag(tag) {
    return TagManagerHelper.getWorkspacePath(
      tag.accountId,
      tag.containerId,
      tag.workspaceId
    );
  }

  /**
   * Create tag.
   *
   * @param {Object}
   * @param {string|null}
   */
  static createTag(tag, workspacePath = null) {
    workspacePath =
      workspacePath || TagManagerHelper.getWorkspacePathFromTag(tag);
    TagManager.Accounts.Containers.Workspaces.Tags.create(tag, workspacePath);

    Utilities.sleep(TagManagerHelper.queryDelay);
  }

  /**
   * Update tag.
   *
   * @param {Object}
   */
  static updateTag(tag) {
    TagManager.Accounts.Containers.Workspaces.Tags.update(tag, tag.path);

    Utilities.sleep(TagManagerHelper.queryDelay);
  }

  /**
   * List all tags.
   *
   * @param {string} workspacePath
   * @returns {Array<Object>}
   */
  static listAllTags(workspacePath) {
    let tags = [];
    let nextPageToken;

    do {
      const res =
        TagManager.Accounts.Containers.Workspaces.Tags.list(workspacePath);

      Utilities.sleep(TagManagerHelper.queryDelay);

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
  static fetchTag(accountId, containerId, workspaceId, tagId) {
    const path = `${TagManagerHelper.getWorkspacePath(
      accountId,
      containerId,
      workspaceId
    )}/tags/${tagId}`;
    const tag = TagManager.Accounts.Containers.Workspaces.Tags.get(path);

    Utilities.sleep(TagManagerHelper.queryDelay);

    return tag;
  }

  /**
   * Get Tag parameter.
   *
   * @param {Object} tag
   * @param {string} key
   * @returns {Object}
   */
  static getTagParameter(tag, key) {
    return tag.parameter?.find((p) => p['key'] === key);
  }

  /**
   * Set tag parameter.
   * Updates the passed Tag by reference.
   *
   * @param {Object} tag
   * @param {string} key
   * @param {string} type
   * @param {string} value
   */
  static setTagParameter(tag, key, type, value) {
    const parameters = tag.parameter.filter(
      (parameter) => parameter && parameter.key !== key
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
   * @param {Object} tag
   * @param {Object} parameter
   * @param {string|undefined} targetKey
   */
  static updateListParameter(tag, parameter, targetKey = undefined) {
    const searchKey = targetKey ?? parameter.key;
    const originalParam = tag.parameter.find(
      (param) => param.key === searchKey
    );

    if (originalParam) {
      originalParam.list = originalParam.list.concat(parameter.list);
      tag.parameter = tag.parameter
        .filter((param) => param.key !== searchKey)
        .concat(originalParam);
    } else {
      tag.parameter.push(parameter);
    }
  }

  /**
   * List all variables of given workspace path.
   *
   * @param {string} workspacePath
   * @result {Array<Object>} array of variables
   */
  static listAllVariables(workspacePath) {
    const res =
      TagManager.Accounts.Containers.Workspaces.Variables.list(workspacePath);
    Utilities.sleep(TagManagerHelper.queryDelay);
    return res.variable || [];
  }

  /**
   * List all built-in variables of given workspace path.
   *
   * @param {string} workspacePath
   * @result {Array<Object>} array of variables
   */
  static listAllBuiltInVariables(workspacePath) {
    const res =
      TagManager.Accounts.Containers.Workspaces.Built_in_variables.list(
        workspacePath
      );
    Utilities.sleep(TagManagerHelper.queryDelay);
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
  static createVariable(workspacePath, name, value, type, notes = null) {
    const variable = {
      name: name,
      type: VARIABLE_TYPES[type].type,
      parameter: {
        type: 'template',
        key: VARIABLE_TYPES[type].key,
        value: value,
      },
    };

    if (notes) {
      const existingNotes = variable.notes ? `${variable.notes}\n` : '';
      variable.notes = `${existingNotes}${notes}`;
    }

    TagManager.Accounts.Containers.Workspaces.Variables.create(
      variable,
      workspacePath
    );
    Utilities.sleep(TagManagerHelper.queryDelay);
  }

  /**
   * Create built-in variable.
   *
   * @param {string} workspacePath
   * @param {string} type
   */
  static createBuiltInVariable(workspacePath, type) {
    TagManager.Accounts.Containers.Workspaces.Built_in_variables.create(
      workspacePath,
      {
        type,
      }
    );

    Utilities.sleep(TagManagerHelper.queryDelay);
  }

  /**
   * Get folder by ID.
   *
   * @param {string} workspacePath
   * @param {number} folderId
   * @returns {TagManager.Accounts.Containers.Workspaces.Folder}
   */
  static getFolder(workspacePath, folderId) {
    return TagManager.Accounts.Containers.Workspaces.Folders.get(
      `${workspacePath}/folders/${folderId}`
    );
  }
}
