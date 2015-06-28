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
        StylePanel = require("jsx!./sections/style/StylePanel"),
        PagesPanel = require("jsx!./sections/pages/PagesPanel");
        
    var Properties = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("document", "preferences", "draganddrop")],

        /**
         * Get the active document from flux and add it to the state.
         */
        getStateFromFlux: function () {
            var flux = this.getFlux(),
                documentStore = flux.store("document"),
                preferencesStore = flux.store("preferences"),
                dragAndDropStore = flux.store("draganddrop"),
                document = documentStore.getDocument(this.props.documentID),
                disabled = document.unsupported,
                preferences = preferencesStore.getState(),
                styleVisible = !disabled && preferences.get("styleVisible", true),
                pagesVisible = disabled || preferences.get("pagesVisible", true),
                dragAndDropState = dragAndDropStore.getState();

            return {
                document: document,
                disabled: disabled,
                styleVisible: styleVisible,
                pagesVisible: pagesVisible,
                dragTarget: dragAndDropState.dragTarget,
                dropTarget: dragAndDropState.dropTarget,
                dragPosition: dragAndDropState.dragPosition,
                pastDragTarget: dragAndDropState.pastDragTarget
            };
        },

        shouldComponentUpdate: function (nextProps, nextState) {
            if (!nextState.current) {
                return false;
            }

            return this.state.styleVisible !== nextState.styleVisible ||
                this.state.pagesVisible !== nextState.pagesVisible ||
                this.state.dragTarget !== nextState.dragTarget ||
                this.state.dropTarget !== nextState.dropTarget ||
                this.state.dragPosition !== nextState.dragPosition ||
                !Immutable.is(this.state.document, nextState.document);
        },

        /**
         * Toggle visibility of either the pages or the style section.
         *
         * @private
         * @param {boolean} pages Whether the pages or style section is being toggled
         */
        _handleVisibilityToggle: function (pages) {
            if (this.state.disabled) {
                return;
            }

            var primary = pages ? "pagesVisible" : "styleVisible",
                secondary = pages ? "styleVisible" : "pagesVisible",
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
            // Do not render inactive documents on mount
            if (!this.props.current) {
                return null;
            }

            var document = this.state.document,
                disabled = this.state.disabled,
                className = classnames({
                    "properties": true,
                    "properties__hidden": !this.props.current
                });

            return (
                <div className={className}>
                    <TransformPanel
                        disabled={disabled}
                        document={document} />
                    <StylePanel
                        disabled={disabled}
                        document={document}
                        visible={this.state.styleVisible}
                        visibleSibling={this.state.pagesVisible}
                        onVisibilityToggle={this._handleVisibilityToggle.bind(this, false)} />
                    <PagesPanel
                        disabled={disabled}
                        document={document}
                        visible={this.state.pagesVisible}
                        visibleSibling={this.state.styleVisible}
                        onVisibilityToggle={this._handleVisibilityToggle.bind(this, true)}
                        dragTarget={this.state.dragTarget}
                        dropTarget={this.state.dropTarget}
                        dragPosition={this.state.dragPosition}
                        pastDragTarget={this.state.pastDragTarget} />
                </div>
            );
        }
    });

    module.exports = Properties;
});
