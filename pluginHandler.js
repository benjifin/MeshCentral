/** 
* @description MeshCentral plugin module
* @author Ryan Blenis
* @copyright 
* @license Apache-2.0
* @version v0.0.1
*/

/*xjslint node: true */
/*xjslint plusplus: true */
/*xjslint maxlen: 256 */
/*jshint node: true */
/*jshint strict: false */
/*jshint esversion: 6 */
"use strict";

module.exports.pluginHandler = function (parent) {
    var obj = {};

    obj.fs = require('fs');
    obj.path = require('path');
    obj.parent = parent;
    obj.pluginPath = obj.parent.path.join(obj.parent.datapath, 'plugins');
    obj.plugins = {};
    obj.exports = {};
    obj.loadList = obj.parent.config.settings.plugins.list;

    if (typeof obj.loadList != 'object') {
        obj.loadList = {};
        console.log('Plugin list not specified, please fix configuration file.');
        return null;
    }

    obj.loadList.forEach(function (plugin, index) {
        if (obj.fs.existsSync(obj.pluginPath + '/' + plugin)) {
            try {
                obj.plugins[plugin] = require(obj.pluginPath + '/' + plugin + '/' + plugin + '.js')[plugin](obj);
                obj.exports[plugin] = obj.plugins[plugin].exports;
            } catch (e) {
                console.log("Error loading plugin: " + plugin + " (" + e + "). It has been disabled.", e.stack);
            }
        }
    });

    obj.prepExports = function () {
        var str = 'function() {\r\n';
        str += '    var obj = {};\r\n';

        for (const p of Object.keys(obj.plugins)) {
            str += '    obj.' + p + ' = {};\r\n';
            for (const l of Object.values(obj.exports[p])) {
                str += '        obj.' + p + '.' + l + ' = ' + obj.plugins[p][l].toString() + '\r\n';
            }
        }

        str += `obj.onDeviceRefeshEnd = function(nodeid, panel, refresh, event) {
        for (const p of Object.keys(obj)) { 
            if (typeof obj[p].onDeviceRefreshEnd == 'function') {
                obj[p].onDeviceRefreshEnd(nodeid, panel, refresh, event);
                }
            }
        };
        obj.registerPluginTab = function(pluginRegInfo) {
            var d = pluginRegInfo();
            if (!Q(d.tabId)) {
                QA('p19headers', '<span onclick="return pluginHandler.callPluginPage(\\''+d.tabId+'\\');">'+d.tabTitle+'</span>');
            }
        };
        obj.callPluginPage = function(id) {
            var pages = Q('p19pages').querySelectorAll("#p19pages>div"); 
            for (const i of pages) { i.style.display = 'none'; }
            QV(id, true);
        };
        return obj; };`;
        return str;
    }

    obj.callHook = function (hookName, ...args) {
        for (var p in obj.plugins) {
            if (typeof obj.plugins[p][hookName] == 'function') {
                try {
                    obj.plugins[p][hookName](args);
                } catch (e) {
                    console.log('Error ocurred while running plugin hook' + p + ':' + hookName + ' (' + e + ')');
                }
            }
        }
    };

    obj.addMeshCoreModules = function (modulesAdd) {
        for (var plugin in obj.plugins) {
            var moduleDirPath = null;
            var modulesDir = null;
            //if (obj.args.minifycore !== false) { try { moduleDirPath = obj.path.join(obj.pluginPath, 'modules_meshcore_min'); modulesDir = obj.fs.readdirSync(moduleDirPath); } catch (e) { } } // Favor minified modules if present.
            if (modulesDir == null) { try { moduleDirPath = obj.path.join(obj.pluginPath, plugin + '/modules_meshcore'); modulesDir = obj.fs.readdirSync(moduleDirPath); } catch (e) { } } // Use non-minified mofules.
            if (modulesDir != null) {
                for (var i in modulesDir) {
                    if (modulesDir[i].toLowerCase().endsWith('.js')) {
                        var moduleName = modulesDir[i].substring(0, modulesDir[i].length - 3);
                        if (moduleName.endsWith('.min')) { moduleName = moduleName.substring(0, moduleName.length - 4); } // Remove the ".min" for ".min.js" files.
                        var moduleData = ['try { addModule("', moduleName, '", "', obj.parent.escapeCodeString(obj.fs.readFileSync(obj.path.join(moduleDirPath, modulesDir[i])).toString('binary')), '"); addedModules.push("', moduleName, '"); } catch (e) { }\r\n'];

                        // Merge this module
                        // NOTE: "smbios" module makes some non-AI Linux segfault, only include for IA platforms.
                        if (moduleName.startsWith('amt-') || (moduleName == 'smbios')) {
                            // Add to IA / Intel AMT cores only
                            modulesAdd['windows-amt'].push(...moduleData);
                            modulesAdd['linux-amt'].push(...moduleData);
                        } else if (moduleName.startsWith('win-')) {
                            // Add to Windows cores only
                            modulesAdd['windows-amt'].push(...moduleData);
                        } else if (moduleName.startsWith('linux-')) {
                            // Add to Linux cores only
                            modulesAdd['linux-amt'].push(...moduleData);
                            modulesAdd['linux-noamt'].push(...moduleData);
                        } else {
                            // Add to all cores
                            modulesAdd['windows-amt'].push(...moduleData);
                            modulesAdd['linux-amt'].push(...moduleData);
                            modulesAdd['linux-noamt'].push(...moduleData);
                        }

                        // Merge this module to recovery modules if needed
                        if (modulesAdd['windows-recovery'] != null) {
                            if ((moduleName == 'win-console') || (moduleName == 'win-message-pump') || (moduleName == 'win-terminal')) {
                                modulesAdd['windows-recovery'].push(...moduleData);
                            }
                        }

                        // Merge this module to agent recovery modules if needed
                        if (modulesAdd['windows-agentrecovery'] != null) {
                            if ((moduleName == 'win-console') || (moduleName == 'win-message-pump') || (moduleName == 'win-terminal')) {
                                modulesAdd['windows-agentrecovery'].push(...moduleData);
                            }
                        }
                    }
                }
            }
        }
    };

    obj.deviceViewPanel = function () {
        var panel = {};
        for (var p in obj.plugins) {
            if (typeof obj.plugins[p][hookName] == 'function') {
                try {
                    panel[p].header = obj.plugins[p].on_device_header();
                    panel[p].content = obj.plugins[p].on_device_page();
                } catch (e) {
                    console.log('Error ocurred while getting plugin views ' + p + ':' + ' (' + e + ')');
                }
            }
        }
        return panel;
    }

    return obj;
};