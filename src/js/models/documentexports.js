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

define(function (require, exports, module) {
    "use strict";

    var Immutable = require("immutable");

    var ExportAsset = require("./exportasset");

    /**
     * Internal representation of a document's various exports
     * @private
     * @constructor
     */
    var DocumentExports = Immutable.Record({
        /**
         * Map of root (document) level export assets, indexed by Id
         * @type {Immutable.List<ExportAsset>}
        */
        rootExports: null,

        /**
         * Map of Lists of assets, by layer ID
         * @type {Immutable.Map<number, Immutable.List.<ExportAsset>>}
         */
        layerExportsMap: null
    });

    DocumentExports.prototype.layerExportsArray = function (layerID) {
        var layerExports = this.layerExportsMap.get(layerID);

        if (layerExports && layerExports.size > 0) {
            return layerExports.toJS();
        } else {
            return [];
        }
    };

    DocumentExports.prototype.rootExportsArray = function () {
        if (this.rootExports && this.rootExports.size > 0) {
            return this.rootExports.toJS();
        } else {
            return [];
        }
    };

    // TODO probably should granulate the param a bit
    DocumentExports.fromDescriptors = function (payload) {
        var layers = payload.layers || [];

        // TODO the doc/root level exports, maybe?

        var layerExportsMap = new Map();

        layers.forEach(function (layer) {
            var layerExports = [];
            if (layer.assetExports && layer.assetExports.length > 0) {
                layer.assetExports.forEach(function (layerAssetExport) {
                    var assetExport = new ExportAsset(layerAssetExport);
                    layerExports.push(assetExport);
                });
            }
            layerExportsMap.set(layer.layerID, Immutable.List(layerExports));
        });
        
        return new DocumentExports({ layerExportsMap: Immutable.Map(layerExportsMap) });
    };

    var _upsertList = function (assetExportList, newProps) {
        var _assetExportList = assetExportList || Immutable.List();

        if (!newProps) {
            return _assetExportList;
        }
        
        var existingEntry = _assetExportList.findEntry(function (asset) {
            return (asset.scale === newProps.scale); // Obviously this will get more refined in the future
        });

        if (existingEntry) {
            var nextEntry = existingEntry[1].merge(newProps);
            return _assetExportList.set(existingEntry[0], nextEntry); // mergeIn ?
        } else {
            return _assetExportList.push(new ExportAsset(newProps));
        }
    };

    DocumentExports.prototype.fancyMerge = function (documentExportProps) {
        var nextRootExports = _upsertList(this.rootExports, documentExportProps.rootExports),
            nextLayerExportsMap;

        if (documentExportProps.layerExportsMap) {
            var toMergeExportsMap = new Map();

            documentExportProps.layerExportsMap.forEach(function (layerExportProps, key) {
                var blah = _upsertList(this.layerExportsMap.get(key), layerExportProps);
                toMergeExportsMap.set(key, blah);
            }, this);

            nextLayerExportsMap = this.layerExportsMap.merge(toMergeExportsMap);
        }

        return new DocumentExports ({
            rootExports: nextRootExports,
            layerExportsMap: nextLayerExportsMap || Immutable.List()
        });
    };

    module.exports = DocumentExports;
});
