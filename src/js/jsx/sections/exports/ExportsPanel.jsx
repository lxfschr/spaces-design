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

    var React = require("react"),
        Fluxxor = require("fluxxor"),
        FluxMixin = Fluxxor.FluxMixin(React),
        StoreWatchMixin = Fluxxor.StoreWatchMixin;

    var collection = require("js/util/collection"),
        _ = require("lodash");

    var ExportLayerPanel = React.createClass({

        mixins: [FluxMixin],

        _addAssetClickHandler: function (layer, scale, event) {
            event.preventDefault();
            return this.getFlux().actions.export.addLayerExportAsset(layer, scale);
        },

        render: function () {
            var document = this.props.document,
                documentExports = this.props.documentExports,
                scales = [0.5, 1, 1.5, 2];

            if (!document || document.layers.selected.size !== 1) {
                return (<div>Not valid for no doc, or non-singular selection</div>);
            }

            var selectedLayer = document.layers.selected.first(),
                layerExports = documentExports.layerExportsMap && documentExports.layerExportsMap.get(selectedLayer.id);

            var remainingScales = _.difference(scales, collection.pluck(layerExports, "scale").toArray()),
                addAssetsComponents = [];

            remainingScales.forEach(function (s) {
                addAssetsComponents.push((
                    <span key={s}>
                        <a onClick={this._addAssetClickHandler.bind(this, selectedLayer, s)}>{s + "x"}</a> ||
                    </span>
                ));
            }.bind(this));


            var exportComponents = [];
            if (layerExports && layerExports.size > 0) {
                layerExports.forEach(function (i, k) {
                    var x = (<li key={k}>scale: {i.scale} file: {i.filePath}</li>);
                    exportComponents.push(x);
                });
            }

            return (
                <div>
                    <div>{addAssetsComponents}</div>
                    <ul>
                        {exportComponents}
                    </ul>
                </div>
            );
        }
    });

    var ExportsPanel = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("export")],

        propTypes: {
            document: React.PropTypes.object.isRequired
        },

        getStateFromFlux: function () {
            var flux = this.getFlux(),
                documentID = this.props.document.id,
                documentExports = flux.store("export").getDocumentExports(documentID);

            return {
                documentExports: documentExports
            };
        },

        _exportAllAssets: function (event) {
            event.preventDefault();
            return this.getFlux().actions.export.exportAllAssets();
        },

        _exportDocument: function (scale, event) {
            event.preventDefault();
            return this.getFlux().actions.export.exportDocument(scale);
        },

        render: function () {
            var document = this.props.document,
                layerExportsMap = this.state.documentExports && this.state.documentExports.layerExportsMap;

            if (!document || !layerExportsMap) {
                return null;
            }

            var layerExportComponents = [];
            if (layerExportsMap && layerExportsMap.size > 0) {
                layerExportsMap.forEach(function (layerExports, key) {
                    var layer = document.layers.byID(key);

                    if (layer && layerExports && layerExports.size > 0) {
                        var assetScales = collection.pluck(layerExports, "scale").toArray().join(", ");
                        layerExportComponents.push((
                            <li key={"layer" + layer.id}>
                                {layer.name}: configured with scale(s): {assetScales}
                            </li>
                        ));
                    }
                });
            }

            /*      <div>
                        <a onClick={this._exportDocument.bind(this, 1)}>export DOCUMENT (legacy)</a>
                    </div>
             */

            return (
                <div>
                    
                    <div>
                        <a onClick={this._exportAllAssets}>export all configured Assets</a> &lt; click that
                    </div>
                    <hr />
                    layer exports:
                    <ul>
                        {layerExportComponents}
                    </ul>
                    <hr />
                    <ExportLayerPanel
                        {...this.props}
                        documentExports={this.state.documentExports} />
                </div>

            );
        }
    });

    module.exports = ExportsPanel;
});
