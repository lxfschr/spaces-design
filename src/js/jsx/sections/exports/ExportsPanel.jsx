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

        _exportClickHandler: function (scale, event) {
            event.preventDefault();
            return this.getFlux().actions.export.exportSelected(scale);
        },

        render: function () {
            var layerExportsMap = this.state.documentExports && this.state.documentExports.layerExportsMap;

            var layerExportComponents = [];
            if (layerExportsMap && layerExportsMap.size > 0) {
                layerExportsMap.forEach(function (item, key) {
                    if (item && item.size > 0) {
                        item.forEach(function (i, k) {
                            var x = (<div key={k}>layer {key}: file: {i.filePath}</div>);
                            layerExportComponents.push(x);
                        });
                    }
                });
            }

            return (
                <div>
                    <div>
                        recent exports:
                        {layerExportComponents}
                    </div>
                </div>

            );
        }
    });

    module.exports = ExportsPanel;
});
