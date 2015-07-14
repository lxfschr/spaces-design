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
        ExportService = require("js/util/exportservice");

    var descriptor = require("adapter/ps/descriptor"),
        documentLib = require("adapter/lib/document"),
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


    var _exportAsset = function (documentID, layer, asset) {
        return _exportService.sendMessage("exportLayer", { layer: layer, scale: asset.scale })
            .bind(this)
            .then(function (exportResponse) {
                // TODO we should inspect the response a little more closely, for export errors
                if (exportResponse && Array.isArray(exportResponse.result)) {
                    var assetProps = asset.toJS(),
                        layerExportsMap = new Map(),
                        payload;

                    assetProps.filePath = exportResponse.result[0];
                    assetProps.status = "stable"; // FIXME need a better way to handle these constants
                    layerExportsMap.set(layer.id, assetProps);

                    payload = {
                        documentID: documentID,
                        documentExports: {
                            layerExportsMap: layerExportsMap
                        }
                    };
                    this.dispatch(events.export.ASSET_CHANGED, payload);

                    var documentExports = this.flux.stores.export.getDocumentExports(documentID),
                        layerExportsArray = documentExports && documentExports.layerExportsArray(layer.id);

                    return _updateLayerExportMetadata(documentID, layer.id, layerExportsArray);
                } else {
                    return Promise.resolve();
                }
            });
    };

    var exportAllAssets = function () {
        var document = this.flux.stores.application.getCurrentDocument();

        if (!document) {
            Promise.resolve("No Document");
        }

        var documentID = document.id,
            documentExports = this.flux.stores.export.getDocumentExports(documentID),
            layerExportsMap = documentExports && documentExports.layerExportsMap,
            exportArray = [];

        if (!layerExportsMap || layerExportsMap.size < 1) {
            return Promise.resolve("no assets to export");
        }

        layerExportsMap.forEach(function (layerExportAssets, layerID) {
            var layer = document.layers.byID(layerID);
            layerExportAssets.forEach(function (asset) {
                exportArray.push({ layer: layer, asset: asset });
            }, this);
        }, this);

        // TODO this is intentionally serial for now, because or WS is lame 
        return Promise.each(exportArray, function (item) {
            return _exportAsset.call(this, documentID, item.layer, item.asset);
        }.bind(this));
    };
    exportAllAssets.reads = [locks.PS_GENERATOR];
    exportAllAssets.writes = [locks.JS_DOC, locks.JS_DIALOG];

    var exportDocument = function (scale) {
        var documentID = this.flux.stores.application.getCurrentDocumentID(),
            _scale = scale || 1,
            assetProps = { scale: _scale },
            rootExports = [],
            payload;

        rootExports.push(assetProps);

        payload = {
            documentID: documentID,
            documentExports: {
                rootExports: rootExports
            }
        };

        var firstDispatchPromise = this.dispatchAsync(events.export.ASSET_CHANGED, payload),
            openDialogPromise = this.transfer(openExportPanel),
            exportServicePromise = _exportService.sendMessage("quickExportDocument");

        log.debug("initiating document export...");
        return Promise.join(exportServicePromise, openDialogPromise, firstDispatchPromise, function (exportResponse) {
                // TODO we should inspect the response a little more closely, for export errors
                if (exportResponse && Array.isArray(exportResponse.result)) {
                    assetProps.filePath = exportResponse.result[0];
                    assetProps.status = "stable"; // FIXME need a better way to handle these constants
                    log.debug("finalizing export...");
                    this.dispatch(events.export.ASSET_CHANGED, payload);

                    var documentExports = this.flux.stores.export.getDocumentExports(documentID),
                        rootExportsArray = documentExports && documentExports.rootExportsArray();

                    return _updateRootExportMetadata(documentID, rootExportsArray);
                }
            }.bind(this));
    };
    exportDocument.reads = [locks.PS_GENERATOR];
    exportDocument.writes = [locks.JS_DOC, locks.JS_DIALOG];

    var addLayerExportAsset = function (layer, scale) {
        var documentID = this.flux.stores.application.getCurrentDocumentID(),
            _scale = scale || 1,
            assetProps = { scale: _scale },
            layerExportsMap = new Map(),
            payload;

        layerExportsMap.set(layer.id, assetProps);

        payload = {
            documentID: documentID,
            documentExports: {
                layerExportsMap: layerExportsMap
            }
        };

        return this.dispatchAsync(events.export.ASSET_CHANGED, payload).then(function () {
            var documentExports = this.flux.stores.export.getDocumentExports(documentID),
                layerExportsArray = documentExports && documentExports.layerExportsArray(layer.id);

            return _updateLayerExportMetadata(documentID, layer.id, layerExportsArray);
        });
    };
    addLayerExportAsset.reads = [locks.PS_GENERATOR];
    addLayerExportAsset.writes = [locks.JS_DOC, locks.JS_DIALOG];

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

    var _updateRootExportMetadata = function (documentID, rootExports) {
        var playObject = documentLib.setExtensionData(documentID,
            EXTENSION_DATA_NAMESPACE, "assetExports", rootExports);
        return descriptor.playObject(playObject);
    };

    exports.openExportPanel = openExportPanel;
    exports.exportAllAssets = exportAllAssets;
    exports.exportDocument = exportDocument;
    exports.addLayerExportAsset = addLayerExportAsset;
    exports.beforeStartup = beforeStartup;
    exports.onReset = onReset;
});
