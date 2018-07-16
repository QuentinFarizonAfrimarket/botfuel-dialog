/**
 * Copyright (c) 2017 - present, Botfuel (https://www.botfuel.io).
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// @flow

export type RawConfig = {
  [string]: {},
};

export type Config = {|
  adapter: {
    name: string,
  },
  brain: {
    name: string,
    conversationDuration: number,
  },
  componentRoots: string[],
  locale: string,
  logger: string,
  modules: string[],
  multiintent: boolean,
  nlu: {
    name: string,
    spellchecking: string,
  },
  path: string,
  custom: Object,
|};

const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const logger = require('logtown')('Config');
const LoggerManager = require('./logger-manager');
const ConfigurationError = require('./errors/configuration-error');

const DEFAULT_CONVERSATION_DURATION = 86400000; // one day in ms

const defaultConfig = {
  path: process.cwd(),
  locale: 'en',
  adapter: {
    name: 'shell',
  },
  brain: {
    name: 'memory',
  },
  logger: 'info',
  modules: [],
  nlu: {
    name: 'botfuel',
    intentThreshold: 0.8,
  },
  multiIntent: false,
};

/**
 * Returns the contents of the bot config file.
 * @param configFileName - the bot config file name/path
 * @returns the contents of the bot config file
 */
const resolveConfigFile = (configFileName: string): RawConfig => {
  // configure the logger with default configuration first the be able to log errors
  LoggerManager.configure(defaultConfig);

  if (!configFileName) {
    logger.info("You didn't specify any config file, using default config.");
    return {};
  }

  const configPath = path.resolve(process.cwd(), configFileName);

  try {
    return require(configPath);
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      logger.error(`Could not load config file ${configPath}`);
    }

    throw error;
  }
};

const getComponentRoots = function (config): string[] {
  const botRoot = `${config.path}/src`;
  const sdkRoot = __dirname;

  const moduleRoots = config.modules.map((packageName) => {
    if (typeof packageName !== 'string') {
      throw new ConfigurationError(
        'Parameter "modules" of configuration should be a list of package names.',
      );
    }

    const moduleBasePath = path.dirname(require.resolve(packageName));

    const { botfuelModuleRoot } = require(packageName);
    if (typeof botfuelModuleRoot !== 'string') {
      throw new ConfigurationError(
        `Package ${packageName} should export "botfuelModuleRoot" with type string.`,
      );
    }
    const absolutePath = path.join(moduleBasePath, botfuelModuleRoot);
    if (!fs.existsSync(absolutePath)) {
      throw new ConfigurationError(
        `Package ${packageName} does not contain the directory "${absolutePath}".`,
      );
    }
    return absolutePath;
  });

  return [botRoot, ...moduleRoots, sdkRoot];
};

/**
 * Merges the given configuration with the default configuration.
 * @param botConfig - the bot config
 * @returns the configuration
 */
const getConfiguration = (botConfig: RawConfig = {}): Config => {
  // get the config by extending defaultConfig with botConfig
  const config = _.merge(defaultConfig, botConfig);

  Object.assign(defaultConfig);

  config.brain.conversationDuration =
    config.brain.conversationDuration || DEFAULT_CONVERSATION_DURATION;

  config.componentRoots = getComponentRoots(config);

  // reconfigure the logger with the final config
  LoggerManager.configure(config);
  // return default config extended by bot config
  return config;
};

module.exports = {
  defaultConfig,
  resolveConfigFile,
  getConfiguration,
};
