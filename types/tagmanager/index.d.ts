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
declare namespace GoogleAppsScript {
  namespace TagManager {
    interface Parameter {
      key?: string;
      type: string;
      value?: string;
      list?: Parameter[];
      map?: Parameter[];
    }

    interface MonitoringMetadata {
      type?: string;
      key?: string;
      list?: MonitoringMetadata[];
      map?: MonitoringMetadata[];
    }

    interface Tag {
      accountId?: string;
      containerId?: string;
      workspaceId?: string;
      tagId?: string;
      path?: string;
      name: string;
      type: string;
      parameter?: Parameter[];
      notes?: string;
      parentFolderId?: string;
      fingerprint?: string;
      tagManagerUrl?: string;
      firingTriggerId?: string[];
      blockingTriggerId?: string[];
      monitoringMetadata?: MonitoringMetadata;
    }

    interface Tags {
      create(tag: Tag, workspacePath: string): Tag;
      update(tag: Tag, path: string);
      list(workspacePath: string): { tag: Tag[]; nextPageToken: string };
      get(path: string): Tag;
    }

    interface Variable {
      name: string;
      type: string;
      notes?: string;
      parameter?: Parameter[];
    }

    interface Variables {
      list(workspacePath: string): {
        variable: Variable[];
        nextPageToken: string;
      };
      create(variable: Variable, workspacePath: string);
    }

    interface Built_in_variable {
      name?: string;
      path?: string;
      type: string;
    }

    interface Built_in_variables {
      create(workspacePath: string, variable: Built_in_variable);
      list(workspacePath: string): {
        builtInVariable: Built_in_variable[];
        nextPageToken: string;
      };
    }

    interface Folder {
      folderId?: string;
      path?: string;
      name: string;
    }

    interface Folders {
      create(Folder, workspacePath: string): Folder;
      get(workspacePath: string): Folder;
      list(workspacePath: string): { folder: Folder[]; nextPageToken: string };
    }

    interface Workspace {
      path: string;
      name: string;
      description: string;
    }

    interface Workspaces {
      Tags: Tags;
      Folders: Folders;
      Variables: Variables;
      Built_in_variables: Built_in_variables;
      get(path: string): Workspace;
      update(workspace: Workspace, path: string);
    }

    interface Container {
      name: string;
    }

    interface Containers {
      Workspaces: Workspaces;
      get(path): Container;
    }

    interface Account {
      name: string;
    }

    interface Accounts {
      Containers: Containers;
      get(path: string): Account;
    }

    interface TagManager {
      Tag: Tag;
      Accounts: Accounts;
    }
  }
}

// eslint-disable-next-line no-var
declare var TagManager: GoogleAppsScript.TagManager.TagManager;
