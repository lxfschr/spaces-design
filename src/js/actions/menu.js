/*
 * Copyright (c) 2014 Adobe Systems Incorporated. All rights reserved.
 *  
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"), 
 * to deal in the Software without restriction, including without limitation 
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, 
 * and/or sell copies of the Software, and to permit persons to whom the 
 * Software is furnished to do so, subject to the following conditions:
 *  
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *  
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
 * DEALINGS IN THE SOFTWARE.
 * 
 */

define(function (require, exports) {
    "use strict";

    var Promise = require("bluebird");

    var adapter = require("adapter"),
        ps = require("adapter/ps"),
        ui = require("adapter/ps/ui");

    var events = require("js/events"),
        locks = require("js/locks"),
        system = require("js/util/system"),
        log = require("js/util/log"),
        global = require("js/util/global"),
        headlights = require("js/util/headlights"),
        preferencesActions = require("./preferences"),
        searchActions = require("./search/menucommands");

    var macMenuJSON = require("text!static/menu-mac.json"),
        winMenuJSON = require("text!static/menu-win.json"),
        rawShortcuts = require("js/util/shortcuts"),
        menuActionsJSON = require("text!static/menu-actions.json"),
        templatesJSON = require("text!static/templates.json");

    var rawMenuJSON = system.isMac ? macMenuJSON : winMenuJSON,
        rawMenuShortcuts = rawShortcuts.MENU,
        rawMenuObj = JSON.parse(rawMenuJSON),
        rawMenuActions = JSON.parse(menuActionsJSON),
        rawTemplates = JSON.parse(templatesJSON);

    /**
     * Execute a native Photoshop menu command.
     * 
     * @param {{commandID: number, waitForCompletion: boolean?}} payload
     * @return {Promise}
     */
    var native = function (payload) {
        if (!payload.hasOwnProperty("commandID")) {
            var error = new Error("Missing native menu command ID");
            return Promise.reject(error);
        }

        // Photoshop expects commandId with a lower case d, so convert here
        payload.commandId = payload.commandID;

        return ps.performMenuCommand(payload).then(function (success) {
            // FIXME: After the M2 release, remove the debug conjunct
            if (global.debug && !success) {
                throw new Error("Menu command not available: " + payload.commandID);
            }
        });
    };
    native.reads = locks.ALL_NATIVE_LOCKS;
    native.writes = locks.ALL_NATIVE_LOCKS;

    /**
     * Execute a native Photoshop menu command modally.
     * 
     * @param {{commandID: number, waitForCompletion: boolean?}} payload
     * @return {Promise}
     */
    var nativeModal = function (payload) {
        return native.call(this, payload);
    };
    nativeModal.reads = locks.ALL_NATIVE_LOCKS;
    nativeModal.writes = locks.ALL_NATIVE_LOCKS;
    nativeModal.modal = true;

    /**
     * Open a URL in the user's default browser.
     * 
     * @param {{url: string}} payload
     * @return {Promise}
     */
    var openURL = function (payload) {
        if (!payload.hasOwnProperty("url")) {
            var error = new Error("Missing URL");
            return Promise.reject(error);
        }

        return adapter.openURLInDefaultBrowser(payload.url);
    };
    openURL.reads = [];
    openURL.writes = [];

    /**
     * Temporary helper function to easily open the testrunner. This should
     * eventually replaced with a action that opens the testrunner in a new
     * window.
     */
    var runTests = function () {
        if (global.debug) {
            var href = window.location.href,
                baseHref = href.substring(0, href.lastIndexOf("src/index.html")),
                testHref = baseHref + "test/index.html";

            window.setTimeout(function () {
                window.location.href = testHref;
            }, 0);
        }

        return Promise.resolve();
    };
    runTests.reads = [];
    runTests.writes = [];

    /**
     * An action that always fails, for testing purposes.
     *
     * @private
     * @return {Promise}
     */
    var actionFailure = function () {
        return Promise.reject(new Error("Test: action failure"));
    };
    actionFailure.reads = [];
    actionFailure.writes = [];

    /**
     * A flag for testing purposes which, if set, will cause onReset to fail.
     * 
     * @private
     * @type {boolean}
     */
    var _failOnReset = false;

    /**
     * An action that always fails, for testing purposes, and which causes onReset
     * to fail as well.
     *
     * @private
     * @return {Promise}
     */
    var resetFailure = function () {
        _failOnReset = true;
        return Promise.reject(new Error("Test: reset failure"));
    };
    resetFailure.reads = [];
    resetFailure.writes = [];

    /**
     * An action that always fails, for testing purposes, and which causes onReset
     * to fail as well.
     *
     * @private
     * @return {Promise}
     */
    var corruptModel = function () {
        var applicationStore = this.flux.store("application"),
            documentStore = this.flux.store("document"),
            document = applicationStore.getCurrentDocument();

        if (document) {
            var index = document.layers.index,
                nextIndex = index.unshift(null),
                nextDocument = document.setIn(["layers", "index"], nextIndex);

            documentStore._openDocuments[document.id] = nextDocument;
        }

        return Promise.reject(new Error("Test: corrupt model"));
    };
    corruptModel.reads = [];
    corruptModel.writes = [];

    /**
     * Resolve an action path into a callable action function
     *
     * @private
     * @param {string} actionPath
     * @return {function()}
     */
    var _resolveAction = function (actionPath) {
        var actionNameParts = actionPath.split("."),
            actionModuleName = actionNameParts[0],
            actionName = actionNameParts[1],
            actionNameThrottled = actionName + "Throttled",
            actionThrottled = this.flux.actions[actionModuleName][actionNameThrottled];

        return actionThrottled;
    };

    /**
     * Call action for menu command
     *
     * @private
     * @param {string} commandID 
     */
    var _playMenuCommand = function (commandID) {
        var menuStore = this.flux.store("menu"),
            descriptor = menuStore.getApplicationMenu().getMenuAction(commandID);

        if (!descriptor) {
            log.error("Unknown menu command:", commandID);
            return;
        }

        var action = _resolveAction.call(this, descriptor.$action),
            $payload = descriptor.$payload,
            $dontLog = descriptor.$dontLog || false,
            menuKeys = commandID.split("."),
            subcategory = menuKeys.shift(),
            event = menuKeys.pop();

        if (!$payload || !$payload.preserveFocus) {
            window.document.activeElement.blur();
        }

        if (!$dontLog) {
            headlights.logEvent("menu", subcategory, event);
        }

        action($payload);
    };

    /**
     * Reload the page.
     *
     * @private
     * @return {Promise}
     */
    var resetRecess = function () {
        window.location.reload();
        return Promise.resolve();
    };
    resetRecess.reads = [];
    resetRecess.writes = [];

    /**
     * Debug only method to toggle pointer policy area visualization
     *
     * @return {Promise}
     */
    var togglePolicyFrames = function () {
        if (!global.debug) {
            return Promise.resolve();
        }

        var preferencesStore = this.flux.store("preferences"),
            preferences = preferencesStore.getState(),
            enabled = preferences.get("policyFramesEnabled");

        return this.transfer(preferencesActions.setPreference, "policyFramesEnabled", !enabled);
    };
    togglePolicyFrames.reads = [];
    togglePolicyFrames.writes = [locks.JS_PREF];
    togglePolicyFrames.transfers = [preferencesActions.setPreference];

    /**
     * Debug only method to toggle post condition verification
     *
     * @return {Promise}
     */
    var togglePostconditions = function () {
        if (!global.debug) {
            return Promise.resolve();
        }

        var preferencesStore = this.flux.store("preferences"),
            preferences = preferencesStore.getState(),
            enabled = preferences.get("postConditionsEnabled");

        return this.transfer(preferencesActions.setPreference, "postConditionsEnabled", !enabled);
    };
    togglePostconditions.reads = [];
    togglePostconditions.writes = [locks.JS_PREF];
    togglePostconditions.transfers = [preferencesActions.setPreference];

    /**
     * Event handlers initialized in beforeStartup.
     *
     * @private
     * @type {function()}
     */
    var _menuChangeHandler,
        _adapterMenuHandler;

    /**
     * Loads menu descriptors, installs menu handlers and a menu store listener
     * to reload menus
     * 
     * @return {Promise}
     */
    var beforeStartup = function () {
        // We listen to menu store directly from this action
        // and reload menus, menu store emits change events
        // only when the menus actually have changed
        _menuChangeHandler = function () {
            var menuStore = this.flux.store("menu"),
                appMenu = menuStore.getApplicationMenu();

            if (appMenu !== null) {
                var menuDescriptor = appMenu.getMenuDescriptor();
                ui.installMenu(menuDescriptor);
            }
        }.bind(this);

        this.flux.store("menu").on("change", _menuChangeHandler);

        // Menu store waits for this event to parse descriptors
        this.dispatch(events.menus.INIT_MENUS, {
            menus: rawMenuObj,
            shortcuts: rawMenuShortcuts,
            templates: rawTemplates,
            actions: rawMenuActions
        });

        // Menu item clicks come to us from Photoshop through this event
        var controller = this.controller;
        _adapterMenuHandler = function (payload) {
            if (!controller.active) {
                return;
            }
            
            _playMenuCommand.call(this, payload.command);
        }.bind(this);
        ui.on("menu", _adapterMenuHandler);

        return Promise.resolve();
    };
    beforeStartup.reads = [];
    beforeStartup.writes = [locks.JS_MENU, locks.PS_MENU];
    
    /**
     * Send info about menu commands to search store
     *
     * @private
     * @return {Promise}
     */
    var afterStartup = function () {
        searchActions.registerMenuCommandSearch.call(this);
        return Promise.resolve();
    };
    afterStartup.reads = [];
    afterStartup.writes = [];

    /**
     * Remove event handlers.
     *
     * @private
     * @return {Promise}
     */
    var onReset = function () {
        ui.removeListener("menu", _adapterMenuHandler);
        this.flux.store("menu").removeListener("change", _menuChangeHandler);

        // For debugging purposes only
        if (_failOnReset) {
            return Promise.reject();
        }

        return Promise.resolve();
    };
    onReset.reads = [];
    onReset.writes = [];

    exports.native = native;
    exports.nativeModal = nativeModal;
    exports.openURL = openURL;
    exports.runTests = runTests;
    exports.actionFailure = actionFailure;
    exports.resetFailure = resetFailure;
    exports.corruptModel = corruptModel;
    exports.resetRecess = resetRecess;
    exports._playMenuCommand = _playMenuCommand;

    exports.togglePolicyFrames = togglePolicyFrames;
    exports.togglePostconditions = togglePostconditions;

    exports.beforeStartup = beforeStartup;
    exports.afterStartup = afterStartup;
    exports.onReset = onReset;
});
