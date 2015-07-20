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

    var Promise = require("bluebird"),
        React = require("react"),
        Fluxxor = require("fluxxor"),
        FluxMixin = Fluxxor.FluxMixin(React),
        classnames = require("classnames");

    var Button = require("jsx!js/jsx/shared/Button"),
        SVGIcon = require("jsx!js/jsx/shared/SVGIcon");

    var Graphic = React.createClass({
        mixins: [FluxMixin],

        getInitialState: function () {
            return {
                renditionPath: "",
                dragging: false
            };
        },

        componentWillMount: function () {
            // On mount, get the rendition of this element
            var element = this.props.element;

            Promise.fromNode(function (cb) {
                element.getRenditionPath(40, cb);
            }).bind(this).then(function (path) {
                this.setState({
                    renditionPath: path
                });
            });
        },

        /**
         * Handle add layer from graphic asset
         * @private
         * @param {object} location of canvas
         */
        _handleAdd: function (location) {
            location = location || { x: 0, y: 0 };
            this.getFlux().actions.libraries.createLayerFromElement(this.props.element, location);
        },
        
        /**
         * Handle the start of dragging a graphic asset
         * @private
         */
        _handleDragStart: function () {
            window.addEventListener("mousemove", this._handleDragMove, true);
            window.addEventListener("mouseup", this._handleDragFinish, true);
        },
        
        /**
         * Handle moving of a dragging graphic asset
         * @private
         * @param {Event} event
         */
        _handleDragMove: function (event) {
            this.setState({
                dragging: true,
                x: event.clientX,
                y: event.clientY
            });
        },

        /**
         * Handle the end of dragging a graphic asset
         * @private
         */
        _handleDragFinish: function () {
            window.removeEventListener("mousemove", this._handleDragMove, true);
            window.removeEventListener("mouseup", this._handleDragFinish, true);

            // Short circuit if not currently dragging
            if (!this.state.dragging) {
                return;
            }

            this.setState({ dragging: false });
            this.props.onDrop(this.props.element, { x: this.state.x, y: this.state.y });
            
            var uiStore = this.getFlux().store("ui");
            var canvasLocation = uiStore.transformWindowToCanvas(this.state.x, this.state.y);
            this._handleAdd(canvasLocation);
        },

        render: function () {
            var element = this.props.element;
            
            var classNames = classnames("sub-header", {
                "assets__graphic_dragging": this.state.dragging
            });

            return (
                <div className={classNames}
                     key={element.id}
                     onMouseDown={this._handleDragStart}>
                    <img src={this.state.renditionPath} />
                    {element.displayName}
                    <Button
                        title="Add to Photoshop"
                        className="button-plus"
                        onClick={this._handleAdd}>
                        <SVGIcon
                            viewbox="0 0 12 12"
                            CSSID="plus" />
                    </Button>
                </div>
            );
        }
    });

    module.exports = Graphic;
});
