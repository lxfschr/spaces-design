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

    var Promise = require("bluebird"),
        Immutable = require("immutable");

    var descriptor = require("adapter/ps/descriptor"),
        layerLib = require("adapter/lib/layer"),
        generatorLib = require("adapter/lib/generator");

    var dialog = require("./dialog"),
        events = require("js/events"),
        locks = require("js/locks"),
        objUtil = require("js/util/object"),
        collection = require("js/util/collection"),
        log = require("js/util/log"),
        ExportAsset = require("js/models/exportasset"),
        ExportService = require("js/util/exportservice");

    /**
     * Export metadata is stored in the "extension" data structure in Ps, using this as the namespace
     * @type {string}
     */
    var EXTENSION_DATA_NAMESPACE = "designSpace";

    /**
     * An instance of the ExportService utility used to communicate with the generator plugin
     * @private
     * @type {ExportService}
     */
    var _exportService;

    /**
     * Fetch relevant data from both the document and export stores, and sync the metadata to
     * the photoshop layer "extension data"
     *
     * Note that the underlying adapter API to setExtensionData requires the full data structure to be supplied
     * which is why we are always fetching directly from both stores prior to calling setExtensionData
     *
     * TODO maybe this should handle a set of layers, for efficiency when called by layer actions?
     *
     * @private
     * @param {number} documentID
     * @param {number} layerID
     * @return {Promise}
     */
    var _syncLayerExportMetadata = function (documentID, layerID) {
        var documentExports = this.flux.stores.export.getDocumentExports(documentID),
            layerExports = documentExports && documentExports.getLayerExports(layerID),
            layerExportsArray = layerExports && layerExports.toJS(),
            document = this.flux.stores.document.getDocument(documentID),
            layer = document && document.layers.byID(layerID),
            exportEnabled = document && layer && layer.exportEnabled;

        var exportsMetadata = {
            exportAssets: layerExportsArray,
            exportEnabled: exportEnabled === undefined ? false : exportEnabled
        };

        var playObject = layerLib.setExtensionData(documentID,
                layerID, EXTENSION_DATA_NAMESPACE, "exportsMetadata", exportsMetadata);

        return descriptor.playObject(playObject);
    };

    /**
     * Helper function to export a single asset using the export service, and update the metadata afterwards
     *
     * @private
     * @param {Document} document
     * @param {Layer} layer
     * @param {number} assetIndex index of this asset within the layer's list
     * @param {ExportAsset} asset asset to export
     * @return {Promise}
     */
    var _exportAsset = function (document, layer, assetIndex, asset) {
        return _exportService.exportLayerAsset(layer, asset)
            .bind(this)
            .then(function (pathArray) {
                // Do we need to be aware of exports that return >1 file path?
                var assetProps = {
                    filePath: pathArray[0],
                    status: ExportAsset.STATUS.STABLE
                };
                return this.transfer(updateLayerExportAsset, document, layer, assetIndex, assetProps);
            })
            .catch(function (e) {
                log.error("Export Failed for asset %d of layerID %d, documentID %d, with error %s",
                    assetIndex, layer.id, document.id, e);
                var assetProps = {
                    filePath: "",
                    status: ExportAsset.STATUS.ERROR
                };
                return this.transfer(updateLayerExportAsset, document, layer, assetIndex, assetProps);
            }) ;
    };

    /**
     * Open the export modal dialog
     *
     * @return {Promise}
     */
    var openExportPanel = function () {
        return this.transfer(dialog.openDialog, "exports-panel-dialog");
    };
    openExportPanel.reads = [];
    openExportPanel.writes = [];
    openExportPanel.transfers = [dialog.openDialog];

    /**
     * Close the export modal dialog
     *
     * @return {Promise}
     */
    var closeExportPanel = function () {
        return this.transfer(dialog.closeDialog, "exports-panel-dialog");
    };
    closeExportPanel.reads = [];
    closeExportPanel.writes = [];
    closeExportPanel.transfers = [dialog.closeDialog];

    /**
     * Merge the given set of asset properties into the Export Asset model and persist in the the Ps metadata
     *
     * @param {Document} document
     * @param {Layer} layer
     * @param {number} assetIndex index of this asset within the layer's list
     * @param {object} props ExportAsset-like properties to be merged
     * @return {Promise}
     */
    var updateLayerExportAsset = function (document, layer, assetIndex, props) {
        var documentID = document.id,
            assetPropsArray = [],
            payload;

        assetPropsArray[assetIndex] = props;

        payload = {
            documentID: documentID,
            layerIDs: layer.id,
            assetPropsArray: assetPropsArray
        };

        return this.dispatchAsync(events.export.ASSET_CHANGED, payload)
            .bind(this)
            .then(function () {
                return _syncLayerExportMetadata.call(this, documentID, layer.id);
            });
    };
    updateLayerExportAsset.reads = [locks.JS_DOC];
    updateLayerExportAsset.writes = [locks.JS_EXPORT, locks.PS_DOC];

    /**
     * Set the numerical scale of the asset specified by the given index
     *
     * @param {Document} document
     * @param {Layer} layer
     * @param {number} assetIndex index of this asset within the layer's list
     * @param {number} scale
     * @return {Promise}
     */
    var updateLayerAssetScale = function (document, layer, assetIndex, scale) {
        return this.transfer(updateLayerExportAsset, document, layer, assetIndex, { scale: scale || 1 });
    };
    updateLayerAssetScale.reads = [];
    updateLayerAssetScale.writes = [];
    updateLayerAssetScale.transfers = [updateLayerExportAsset];

    /**
     * Set the filename suffix of the asset specified by the given index
     *
     * @param {Document} document
     * @param {Layer} layer
     * @param {number} assetIndex index of this asset within the layer's list
     * @param {string} suffix
     * @return {Promise}
     */
    var updateLayerAssetSuffix = function (document, layer, assetIndex, suffix) {
        return this.transfer(updateLayerExportAsset, document, layer, assetIndex, { suffix: suffix });
    };
    updateLayerAssetSuffix.reads = [];
    updateLayerAssetSuffix.writes = [];
    updateLayerAssetSuffix.transfers = [updateLayerExportAsset];

    /**
     * Set the format of the asset specified by the given index
     *
     * @param {Document} document
     * @param {Layer} layer
     * @param {number} assetIndex index of this asset within the layer's list
     * @param {string} format (example: jpg)
     * @return {Promise}
     */
    var updateLayerAssetFormat = function (document, layer, assetIndex, format) {
        return this.transfer(updateLayerExportAsset, document, layer, assetIndex, { format: format });
    };
    updateLayerAssetFormat.reads = [];
    updateLayerAssetFormat.writes = [];
    updateLayerAssetFormat.transfers = [updateLayerExportAsset];

    /**
     * Adds an asset with the given scale to this layer, and force layer exportEnabled if this is the first asset
     *
     * @param {Document} document
     * @param {Layer} layer
     * @param {number} assetIndex index of this asset within the layer's list
     * @param {number} scale
     * @return {Promise}
     */
    var addLayerAsset = function (document, layer, assetIndex, scale) {
        var updateLayerPromise;

        if (assetIndex === 0 && !layer.exportEnabled) {
            var payload = {
                documentID: document.id,
                layerIDs: [layer.id],
                exportEnabled: true
            };
            updateLayerPromise = this.dispatchAsync(events.document.LAYER_EXPORT_ENABLED_CHANGED, payload);
        } else {
            updateLayerPromise = Promise.resolve();
        }

        // Since updateLayerExport handles the metadata sync, we must be sure that the layer model is updated first
        return updateLayerPromise
            .bind(this)
            .then(function () {
                return this.transfer(updateLayerExportAsset, document, layer, assetIndex, { scale: scale });
            });
    };
    addLayerAsset.reads = [];
    addLayerAsset.writes = [];
    addLayerAsset.transfers = [updateLayerExportAsset];

    /**
     * Update the status of all assets that are being requested
     * This update does not get synced to PS metadata
     *
     * @param {Document} document
     */
    var setAllAssetsRequested = function (document) {
        var layerIDs = document.layers.all.reduce(function (IDs, layer) {
            if (layer.exportEnabled) {
                IDs.push(layer.id);
            }
            return IDs;
        }, []);
        return this.dispatchAsync(events.export.SET_AS_REQUESTED, { documentID: document.id, layerIDs: layerIDs });
    };
    setAllAssetsRequested.reads = [];
    setAllAssetsRequested.writes = [locks.JS_EXPORT];

    /**
     * Delete the Export Asset configuration specified by the given index
     *
     * @param {Document} document
     * @param {Layer} layer
     * @param {number} assetIndex index of this asset within the layer's list
     * @return {Promise}
     */
    var deleteLayerExportAsset = function (document, layer, assetIndex) {
        var documentID = document.id,
            layerID = layer.id,
            payload = {
                documentID: documentID,
                layerID: layerID,
                assetIndex: assetIndex
            };

        return this.dispatchAsync(events.export.DELETE_LAYER_ASSET, payload)
            .bind(this)
            .then(function () {
                return _syncLayerExportMetadata.call(this, documentID, layer.id);
            });
    };
    deleteLayerExportAsset.reads = [locks.JS_DOC];
    deleteLayerExportAsset.writes = [locks.JS_EXPORT, locks.PS_DOC];

    /**
     * Sets the exportEnabled flag for a given layer or layers
     * @private
     * @param {Document} document Owner document
     * @param {Layer|Immutable.List.<Layer>} layers Either a Layer reference or array of Layers
     * @param {boolean=} exportEnabled
     * @return {Promise}
     */
    var setLayerExportEnabled = function (document, layers, exportEnabled) {
        var layerIDs = Immutable.List.isList(layers) ?
                collection.pluck(layers, "id").toArray() :
                [layers.id];

        var payload = {
                documentID: document.id,
                layerIDs: layerIDs,
                exportEnabled: exportEnabled
            };

        return this.dispatchAsync(events.document.LAYER_EXPORT_ENABLED_CHANGED, payload)
            .bind(this)
            .then(function () {
                return Promise.all(layerIDs.map(function (layerID) {
                    return _syncLayerExportMetadata.call(this, document.id, layerID);
                }, this));
            });
    };
    setLayerExportEnabled.reads = [];
    setLayerExportEnabled.writes = [locks.JS_DOC, locks.PS_DOC];

    /**
     * Sets the exportEnabled flag for all artboards
     * @private
     * @param {Document} document Owner document
     * @param {boolean=} exportEnabled
     * @return {Promise}
     */
    var setAllArtboardsExportEnabled = function (document, exportEnabled) {
        var documentExports = this.flux.stores.export.getDocumentExports(document.id);

        if (!documentExports) {
            return Promise.resolve();
        }

        var layersWithExports = documentExports.getLayersWithExports(document, true);

        return this.transfer(setLayerExportEnabled, document, layersWithExports, exportEnabled);
    };
    setAllArtboardsExportEnabled.reads = [locks.JS_EXPORT];
    setAllArtboardsExportEnabled.writes = [];
    setAllArtboardsExportEnabled.transfers = [setLayerExportEnabled];

    /**
     * Sets the exportEnabled flag for all layers that have at least one configured asset
     * @private
     * @param {Document} document Owner document
     * @param {boolean=} exportEnabled
     * @return {Promise}
     */
    var setAllNonABLayersExportEnabled = function (document, exportEnabled) {
        var documentExports = this.flux.stores.export.getDocumentExports(document.id);

        if (!documentExports) {
            return Promise.resolve();
        }

        var layersWithExports = documentExports.getLayersWithExports(document, false);

        return this.transfer(setLayerExportEnabled, document, layersWithExports, exportEnabled);
    };
    setAllNonABLayersExportEnabled.reads = [locks.JS_EXPORT];
    setAllNonABLayersExportEnabled.writes = [];
    setAllNonABLayersExportEnabled.transfers = [setLayerExportEnabled];

    /**
     * Export all assets for the given document for which export has been enabled (layer.exportEnabled)
     *
     * @param {Document} document
     * @return {Promise} resolves when all assets have been exported
     */
    var exportAllAssets = function (document) {
        if (!document) {
            Promise.resolve("No Document");
        }

        if (!_exportService || !_exportService.ready()) {
            Promise.reject("Export Service is not available");
        }

        var documentID = document.id,
            documentExports = this.flux.stores.export.getDocumentExports(documentID),
            layerExportsMap = documentExports && documentExports.layerExportsMap,
            exportArray = [];

        if (!layerExportsMap || layerExportsMap.size < 1) {
            return Promise.resolve("no assets to export");
        }

        // Iterate over the exports map, find the associated layer, test of "exportEnabled"
        layerExportsMap.forEach(function (layerExportAssets, layerID) {
            var layer = document.layers.byID(layerID);
            if (layer.exportEnabled) {
                // Export all assets for this layer
                layerExportAssets.forEach(function (asset, index) {
                    exportArray.push(_exportAsset.call(this, document, layer, index, asset));
                }, this);
            }
        }, this);

        return Promise.all(exportArray);
    };
    exportAllAssets.reads = [locks.JS_DOC, locks.JS_EXPORT];
    exportAllAssets.writes = [locks.GENERATOR];
    exportAllAssets.transfers = [updateLayerExportAsset];

    /**
     * After start up, ensure that generator is enabled, and then initialize the export service
     * @return {Promise}
     */
    var afterStartup = function () {
        return Promise.resolve(); // To shut error up - Alex
        return descriptor.playObject(generatorLib.getGeneratorStatus())
            .bind(this)
            .then(function (status) {
                var enabled = objUtil.getPath(status, "generatorStatus.generatorStatus") === 1;
                if (!enabled) {
                    log.info("Enabling Generator...");
                    return descriptor.playObject(generatorLib.setGeneratorStatus(true))
                        .catch(function (e) {
                            throw new Error("Could not enable generator", e);
                        });
                }
            })
            .delay(500)
            .then(function () {
                _exportService = new ExportService();

                return _exportService.init()
                    .bind(this)
                    .then(function () {
                        return this.dispatchAsync(events.export.SERVICE_STATUS_CHANGED, { serviceAvailable: true });
                    })
                    .catch(Promise.TimeoutError, function () {
                        throw new Error("Could not connect to generator plugin because the connection timed out!");
                    })
                    .catch(function (e) {
                        throw new Error("ExportService.init explicitly returned: " + e);
                    });
            })
            .catch(function (e) {
                log.error("Export Service failed to initialize correctly because: " + e);
                return Promise.resolve("Export Service not enabled, but giving up");
            });
    };
    afterStartup.reads = [];
    afterStartup.writes = [locks.JS_EXPORT, locks.GENERATOR];

    /**
     * Handle the standard onReset action
     *
     * @return {Promise}
     */
    var onReset = function () {
        return _exportService.close()
            .finally(function () {
                _exportService = null;
            });
    };
    onReset.reads = [];
    onReset.writes = [];

    exports.openExportPanel = openExportPanel;
    exports.closeExportPanel = closeExportPanel;
    exports.updateLayerExportAsset = updateLayerExportAsset;
    exports.updateLayerAssetScale = updateLayerAssetScale;
    exports.updateLayerAssetSuffix = updateLayerAssetSuffix;
    exports.updateLayerAssetFormat = updateLayerAssetFormat;
    exports.addLayerAsset = addLayerAsset;
    exports.setAllAssetsRequested = setAllAssetsRequested;
    exports.deleteLayerExportAsset = deleteLayerExportAsset;
    exports.setLayerExportEnabled = setLayerExportEnabled;
    exports.setAllArtboardsExportEnabled = setAllArtboardsExportEnabled;
    exports.setAllNonABLayersExportEnabled = setAllNonABLayersExportEnabled;
    exports.exportAllAssets = exportAllAssets;
    exports.afterStartup = afterStartup;
    exports.onReset = onReset;
});
