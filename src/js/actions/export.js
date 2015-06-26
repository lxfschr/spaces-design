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

    var dialog = require("./dialog"),
        events = require("js/events"),
        locks = require("js/locks"),
        log = require("js/util/log"),
        ExportService = require("js/util/exportservice"),
        ExportAsset = require("js/models/ExportAsset");

    var descriptor = require("adapter/ps/descriptor"),
        layerLib = require("adapter/lib/layer");

    var EXTENSION_DATA_NAMESPACE = "designSpace";

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

    var openExportPanel = function () {
        return this.transfer(dialog.openDialog, "exports-panel-dialog");
    };
    openExportPanel.reads = [];
    openExportPanel.writes = [locks.JS_DIALOG];

    var exportLayer = function (layer, scale) {
        var documentID = this.flux.stores.application.getCurrentDocumentID(),
            _scale = scale || 1,
            exportAsset = new ExportAsset({ scale: _scale }),
            assetID = exportAsset.getId(),
            layerExports = new Map(),
            layerExportsMap = new Map(),
            payload;


        layerExports.set(assetID, exportAsset.toJS());
        layerExportsMap.set(layer.id, layerExports);

        payload = {
            documentID: documentID,
            documentExports: {
                layerExportsMap: layerExportsMap
            }
        };

        var firstDispatchPromise = this.dispatchAsync(events.export.ASSET_CHANGED, payload),
            openDialogPromise = this.transfer(openExportPanel),
            exportServicePromise = _exportService.sendMessage("exportLayer", { layer: layer, scale: _scale });

        log.debug("initiating export...");
        return Promise.join(exportServicePromise, openDialogPromise, firstDispatchPromise, function (exportResponse) {
                // TODO we should inspect the response a little more closely, for export errors
                if (exportResponse && Array.isArray(exportResponse.result)) {
                    exportAsset = exportAsset.set("filePath", exportResponse.result[0]).setStatusStable();
                    layerExports.set(assetID, exportAsset.toJS());
                    log.debug("finalizing export...");
                    this.dispatch(events.export.ASSET_CHANGED, payload);

                    var documentExports = this.flux.stores.export.getDocumentExports(documentID),
                        layerExportsArray = documentExports && documentExports.layerExportsArray(layer.id);

                    return _updateLayerExportMetadata(documentID, layer.id, layerExportsArray);
                }
            }.bind(this));
    };
    exportLayer.reads = [locks.PS_GENERATOR];
    exportLayer.writes = [locks.JS_DOC, locks.JS_DIALOG];

    /**
     * TODO THIS IS OLD AND STUFF
     *
     * @return {[type]} [description]
     */
    var resetCurrentDocumentExports = function () {
        var documentID = this.flux.stores.application.getCurrentDocumentID(),
            exportServicePromise = _exportService.sendMessage("docinfo", "nope");

        return exportServicePromise.then(function (docinfo) {
            log.debug("Fetched %s docinfo: %s", documentID, JSON.stringify(docinfo, null, "  "));
        });
    };
    resetCurrentDocumentExports.reads = [locks.PS_GENERATOR];
    resetCurrentDocumentExports.writes = [locks.JS_DOC];

    var onReset = function () {
        return _exportService.close().then(function () {
            _exportService = null;
            return Promise.resolve();
        });
    };
    onReset.reads = [];
    onReset.writes = [];

    var _updateLayerExportMetadata = function (documentID, layerID, layerExports) {
        var playObject = layerLib.setExtensionData(documentID,
            layerID, EXTENSION_DATA_NAMESPACE, "assetExports", layerExports);
        return descriptor.playObject(playObject);
    };

    exports.openExportPanel = openExportPanel;
    exports.exportLayer = exportLayer;
    exports.resetCurrentDocumentExports = resetCurrentDocumentExports;
    exports.beforeStartup = beforeStartup;
    exports.onReset = onReset;
});
