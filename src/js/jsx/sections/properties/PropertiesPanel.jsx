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
        StoreWatchMixin = Fluxxor.StoreWatchMixin,
        Immutable = require("immutable"),
        classnames = require("classnames");

    var os = require("adapter/os");

    var TitleHeader = require("jsx!js/jsx/shared/TitleHeader"),
        Button = require("jsx!js/jsx/shared/Button"),
        SVGIcon = require("jsx!js/jsx/shared/SVGIcon"),
        Material = require("jsx!./material/Material"),
        strings = require("i18n!nls/strings"),
        elementLib = require("adapter/lib/element"),
        synchronization = require("js/util/synchronization");
    // var log = require("js/util/log");

    var PropertiesPanel = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("style")],

        /**
         * A throttled version of os.setTooltip
         *
         * @type {?function}
         */
        _setTooltipThrottled: null,

        componentWillMount: function () {
            this._setTooltipThrottled = synchronization.throttle(os.setTooltip, os, 500);
        },

        /**
         * Selects the content of the input on focus.
         * 
         * @private
         * @param {SyntheticEvent} event
         */
        _handleFocus: function (event) {
            event.target.scrollIntoViewIfNeeded();
            if (this.props.onFocus) {
                this.props.onFocus(event);
            }
        },

        /**
         * Handler which stops propagation of the given event
         *
         * @private
         * @param {Event} event
         */
        _blockInput: function (event) {
            event.stopPropagation();
        },

        shouldComponentUpdate: function (nextProps) {
            if (this.props.disabled !== nextProps.disabled) {
                return true;
            }

            if (!nextProps.visible && !this.props.visible) {
                return false;
            }
            return true;
        },

        getStateFromFlux: function () {
            var flux = this.getFlux(),
                styleStore = flux.store("style"),
                clipboardStyle = styleStore.getClipboardStyle();

            return {
                clipboard: clipboardStyle
            };
        },

        /**
         * Workaround a CEF bug by clearing any active tooltips when scrolling.
         * More details here: https://github.com/adobe-photoshop/spaces-design/issues/444
         *
         * @private
         */
        _handleScroll: function () {
            this._setTooltipThrottled("");
        },

        /**
         * Calls action to copy currently selected layer's style
         * 
         * @private
         */
        _handleStyleCopy: function (event) {
            var document = this.props.document,
                source = document.layers.selected.first();

            this.getFlux().actions.sampler.copyLayerStyle(document, source);
            event.stopPropagation();
        },

        /**
         * Calls action to paste the clipboard style to selected layers
         *
         * @private
         */
        _handleStylePaste: function (event) {
            var document = this.props.document,
                targetLayers = this.props.document.layers.selected;

            this.getFlux().actions.sampler.pasteLayerStyle(document, targetLayers);
            event.stopPropagation();
        },

        render: function () {
            var containerClasses = classnames({
                "section-container": true,
                "section-container__collapsed": !this.props.visible
            });

            var sectionClasses = classnames({
                "style": true,
                "section": true,
                "section__collapsed": !this.props.visible
            });

            var copyStyleDisabled = !(this.props.document && this.props.document.layers.selected.size === 1),
                copyStyleClasses = classnames({
                    "style-button": true,
                    "style-button__disabled": copyStyleDisabled
                });

            var selectedLayers = this.props.document.layers.selectedWith3D;
            var selectedLayer,
                sceneNodeKindName,
                names;

            var selectedSceneNodes = new Immutable.List();
            var materials = new Immutable.Map(),
                maps = new Immutable.Map();
            if (selectedLayers.size === 1) {
                selectedLayer = selectedLayers.first();
                selectedSceneNodes = selectedLayer.sceneTree.selected;
                if (selectedSceneNodes.size > 0) {
                    var selectedSceneNodesKind = selectedSceneNodes.first().kind;
                    if (selectedSceneNodesKind === elementLib.elementKinds.MATERIAL) {
                        sceneNodeKindName = "material";
                        names = selectedSceneNodes.map(function (node) { return node.name; });
                        materials = selectedLayer.sceneTree.materials.filter(function (e) {
                            return names.contains(e.get("name"));});
                    } else if (selectedSceneNodesKind === elementLib.elementKinds.MAP) {
                        sceneNodeKindName = "map";
                        maps = selectedSceneNodes.map(function (node) {
                            return selectedLayer.sceneTree.maps.get(node.id);
                        });
                    }
                }
            }

            var containerContents = this.props.document && this.props.visible && !this.props.disabled && (
                <div>
                    <Material {...this.props} layer={selectedLayer}
                        onFocus={this._handleFocus} materials={materials}/>
                </div>
            );

            var icon = sceneNodeKindName ? (<SVGIcon viewbox="0 0 24 24" CSSID={sceneNodeKindName} />) : null;

            return (
                <section
                    className={sectionClasses}
                    onScroll={this._handleScroll}>
                    <TitleHeader
                        title={strings.TITLE_PROPERTIES}
                        visible={this.props.visible}
                        disabled={this.props.disabled}
                        onDoubleClick={this.props.onVisibilityToggle}>
                        <div title="Selected Class">
                            <h4>
                                {sceneNodeKindName}
                            </h4>
                        </div>
                        <div className="style-workflow-buttons">
                            <Button
                                className={copyStyleClasses}
                                title={strings.STYLE.COPY}
                                disabled={copyStyleDisabled}
                                onClick={this._handleStyleCopy}
                                onDisabledClick={this._blockInput}
                                onDoubleClick={this._blockInput}
                                onDisabledDoubleClick={this._blockInput}>
                                {icon}
                            </Button>
                        </div>
                    </TitleHeader>
                    <div className={containerClasses}>
                        {containerContents}
                    </div>
                </section>
            );
        }
    });

    module.exports = PropertiesPanel;
});
