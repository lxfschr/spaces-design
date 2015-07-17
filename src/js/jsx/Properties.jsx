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

    var TransformPanel = require("jsx!./sections/transform/TransformPanel"),
        LibrariesPanel = require("jsx!./sections/libraries/LibrariesPanel"),
        StylePanel = require("jsx!./sections/style/StylePanel"),
        LayersPanel = require("jsx!./sections/layers/LayersPanel"),
        ExportsModal = require("jsx!js/jsx/sections/exports/ExportsModal");
        
    var Properties = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("document", "preferences")],

        /**
         * Get the active document from flux and add it to the state.
         */
        getStateFromFlux: function () {
            var flux = this.getFlux(),
                documentStore = flux.store("document"),
                preferencesStore = flux.store("preferences"),
                document = documentStore.getDocument(this.props.documentID),
                disabled = document && document.unsupported,
                preferences = preferencesStore.getState(),
                styleVisible = !disabled && preferences.get("styleVisible", true),
                layersVisible = disabled || preferences.get("layersVisible", true),
                librariesEnabled = !disabled && preferences.get("librariesEnabled", false);

            return {
                document: document,
                disabled: disabled,
                styleVisible: styleVisible,
                layersVisible: layersVisible,
                librariesEnabled: librariesEnabled
            };
        },

        shouldComponentUpdate: function (nextProps, nextState) {
            // The document is inactive
            if (!nextProps.current) {
                return false;
            }

            // The document has been closed and the panel will be unmounted shortly
            if (!nextState.document) {
                return false;
            }

            return this.state.styleVisible !== nextState.styleVisible ||
                this.state.layersVisible !== nextState.layersVisible ||
                this.state.librariesEnabled !== nextState.librariesEnabled ||
                !Immutable.is(this.state.document, nextState.document);
        },

        // FIXME: Remove this once we ship with libraries always enabled
        componentDidUpdate: function (prevProps, prevState) {
            if (!prevState.librariesEnabled && this.state.librariesEnabled) {
                this.getFlux().actions.libraries.beforeStartup()
                    .bind(this)
                    .then(function () {
                        this.getFlux().actions.libraries.afterStartup();
                    });
            }
        },

        /**
         * Toggle visibility of either the layers or the style section.
         *
         * @private
         * @param {boolean} layers Whether the layers or style section is being toggled
         */
        _handleVisibilityToggle: function (layers) {
            if (this.state.disabled) {
                return;
            }

            var primary = layers ? "layersVisible" : "styleVisible",
                secondary = layers ? "styleVisible" : "layersVisible",
                nextState = {};

            if (this.state[primary]) {
                nextState[primary] = false;
                nextState[secondary] = true;
            } else {
                nextState[primary] = true;
            }

            this.getFlux().actions.preferences.setPreferences(nextState);
            this.setState(nextState);
        },
        
        render: function () {
            var document = this.state.document,
                disabled = this.state.disabled,
                className = classnames({
                    "properties": true,
                    "properties__active": this.props.current
                });

            var libraryPanel = this.state.librariesEnabled ? (
                <LibrariesPanel
                    disabled={disabled}
                    visible={true}
                    visibleSibling={this.state.styleVisible} />
            ) : null;

            return (
                <div className={className}>
                    <TransformPanel
                        disabled={disabled}
                        document={document} />
                    {libraryPanel}
                    <StylePanel
                        disabled={disabled}
                        document={document}
                        visible={this.state.styleVisible}
                        visibleSibling={this.state.layersVisible}
                        onVisibilityToggle={this._handleVisibilityToggle.bind(this, false)} />
                    <LayersPanel
                        disabled={disabled}
                        document={document}
                        visible={this.state.layersVisible}
                        visibleSibling={this.state.styleVisible}
                        onVisibilityToggle={this._handleVisibilityToggle.bind(this, true)} />
                    <ExportsModal
                            document={document} />
                </div>
            );
        }
    });

    module.exports = Properties;
});
