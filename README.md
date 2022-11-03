# sGTM Migrator
TL;DR sGTM Migrator helps you speed up the setup of your server container tags by setting up the communication with the server container and by migrating all supported Google tags (Google Analytics 4, Google Ads, Floodlights, Conversion Linker) from your web container. 

## Challenge
Setting up a server-side tagging using Google Tag Manager can be time consuming and very manual. Users simply cannot export a web container and import it into the server container. Instead users need to start modifying both the web container, to establish a communication with the server container using the Google Analytics 4 tag as a source tag, as well as the server container to replicate desired configuration of Google tags in their server environment.
Depending on a user's web container configuration, it can be a very complex manual and error prone task to replicate or modify multiple tags across both container types.

## Idea
Automating the process of setting up tags that communicate with the server container as well as duplicating Google’s web tags for server usage, including
## Solution Description

sGTM Migrator will look up both workspaces from your Google Tag Manager web and server container and analyze which Google tags can be migrated to the server container. By default the tool will do the following steps:

Create a new web variable with a Google Analytics 4 Measurement ID (web data stream; G-xxxxxxxx) used for data collection through serverside Google Tag Manager
Automatically duplicate all existing Google Analytics web tags and point them at the server container (root tags),
Create a default Google Analytics 4 server tag that will forward any incoming Google Analytics 4 request,
Migrate all Google Ads Conversion Tracking, Google Ads Remarketing, Floodlights and Conversion Linker web tags to the server container,
Auto-create all built-in server variables and user-defined server variables based on the incoming Google Analytics 4 requests (root tags). 

Please note, that triggers and some user-defined variables cannot be created due to different data models used across web and server containers. You are still responsible for checking if your migrated tags are working properly before publishing them to production.

## How to access the tool
It is strongly recommended that you use the template spreadsheet to use the sGTM Migrator script. Follow these steps to make a copy of the template spreadsheet and start using the tool:
Join the sGTM Migrator Google Group.
Make a copy of this spreadsheet.
When you first run the sGTM Migrator tool, Google Sheets will require you to authorize the usage of Apps Scripts within the sheet.

## Scope of the tool
The sGTM Migrator will require you to provide the following details:
URL to web container workspace that you want to leverage
URL to server container workspace that you want to update
The URL of your server container endpoint, i.e. a subdomain 
A GA4 Measurement ID for a web data stream (G-xxxxxxxx) that must be different from the ones currently used in the GA4 config tags in web container.

Once these details have been provided, the tool offers two migration journeys:
A one click migration, that copies all existing GA4 tags in the web container and points them at a specified server container endpoint with a custom GA4 measurement ID (web data stream). All existing web tags for Google Ads Conversion Tracking, Google Ads Remarketing, Floodlights and Conversion Linker are replicated in the server container and a default Google Analytics 4 server tag is created that forwards all incoming Google Analytics 4 requests. 
For users seeking a custom migration of only certain but not all tags, the advanced configuration allows to select a subset of above-mentioned web tags which should be migrated. 

In both scenarios, built-in server variables are enabled in the server container. Additional user-defined server variables are created based on the incoming Google Analytics 4 web tags pointing at the server container (root tags). This includes common parameters such as URL Path or Hostname as well as any event parameter or user property found in the root tags.

## Feedback
If you would like to discuss use cases for the tool, please send a message via the sGTM Migrator Google Group.
Additional feedback and feature requests can be submitted using this feedback form. 

## Disclaimer
__This is not an officially supported Google product.__

Copyright 2022 Google LLC. This solution, including any related sample code or data, is made available on an "as is", "as available", and "with all faults" basis, solely for illustrative purposes, and without warranty or representation of any kind. This solution is experimental, unsupported and provided solely for your convenience. Your use of it is subject to your agreements with Google, as applicable, and may constitute a beta feature as defined under those agreements.
To the extent that you make any data available to Google in connection with your use of the solution, you represent and warrant that you have all necessary and appropriate rights, consents and permissions to permit Google to use and process that data. By using any portion of this solution, you acknowledge, assume and accept all risks, known and unknown, associated with its usage, including with respect to your deployment of any portion of this solution in your systems, or usage in connection with your business, if at all.
