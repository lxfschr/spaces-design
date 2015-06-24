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

    var events = require("js/events"),
        locks = require("js/locks"),
        log = require("js/util/log"),
        ExportService = require("js/util/exportservice"),
        ExportAsset = require("js/models/ExportAsset");

    /**
     * Event handlers initialized in beforeStartup.
     *
     * @private
     * @type {function()}
     */
    var _exportService;

    /**
     * before start up
     * @return {Promise}
     */
    var beforeStartup = function () {
        _exportService = new ExportService();
        return _exportService.init();
    };
    beforeStartup.reads = [];
    beforeStartup.writes = [];

    var exportSelected = function () {
        var documentID = this.flux.stores.application.getCurrentDocumentID(),
            payload = {
                documentID: documentID,
                documentExports: {
                    rootExports: new ExportAsset().toJS()
                }
            },
            firstDispatchPromise = this.dispatchAsync(events.export.ASSET_CHANGED, payload),
            exportServicePromise = _exportService.sendMessage("quickExportSelection", "nope");

        log.debug("initiating export...");
        return Promise.join(exportServicePromise, firstDispatchPromise, function (exportResponse) {
                if (exportResponse && Array.isArray(exportResponse.result)) {
                    payload.documentExports.rootExports.filePath = exportResponse.result[0];
                    log.debug("finalizing export...");
                    return this.dispatchAsync(events.export.ASSET_CHANGED, payload);    
                }
            }.bind(this));
    };
    exportSelected.reads = [locks.PS_DOC];
    exportSelected.writes = [locks.JS_DOC];

    var onReset = function () {
        _exportService.close().then(function () {
            _exportService = null;
            return Promise.resolve();
        });
    };
    onReset.reads = [];
    onReset.writes = [];

    exports.exportSelected = exportSelected;
    exports.beforeStartup = beforeStartup;
    exports.onReset = onReset;
});
