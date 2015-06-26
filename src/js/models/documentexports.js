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
         * @type {Immutable.Map<string, ExportAsset>}
        */
        rootExports: null,

        /**
         * Map of export assets for a given document + layer + exportid
         * @type {Immutable.Map<number, Immutable.Map<number, Immutable.Map.<string, ExportAsset>>>}
         */
        layerExportsMap: null
    });

    DocumentExports.prototype.layerExportsArray = function (layerID) {
        var layerExports = this.layerExportsMap.get(layerID),
            layerExportsArray = [];

        if (layerExports && layerExports.size > 0) {
            layerExports.forEach(function (item) {
                layerExportsArray.push(item);
            });
        }
        return layerExportsArray;
    };

    DocumentExports.fromDescriptors = function (payload) {
        var docAssets = payload.doc.assetExports,
            layers = payload.layers;

        //TODO the doc/root level exports

        var layerExportsMap = new Map();

        layers.forEach(function (layer) {
            if (layer.assetExports && layer.assetExports.length > 0) {
                var layerExports = new Map();
                layer.assetExports.forEach(function (layerAssetExports) {
                    var assetExport = new ExportAsset(layerAssetExports);
                    layerExports.set(assetExport.getId(), assetExport);
                });
            }
            layerExportsMap.set(layer.layerID, layerExports);                
        });
        
            
    }; 

    module.exports = DocumentExports;
});
