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
 *
 * Portions of this code are adapted from react-draggable
 * https://github.com/mzabriskie/react-draggable
 *
 * (MIT License)
 *
 * Copyright (c) 2014 Matt Zabriskie. All rights reserved.
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
 */

define(function (require, exports, module) {
    "use strict";

    var React = require("react"),
        Fluxxor = require("fluxxor"),
        StoreWatchMixin = Fluxxor.StoreWatchMixin;

    /**
     * TODO doc
     * Create a composed Droppoable component
     *
     * @param {ReactComponent} Component to wrap
     * @param {string} axis is either "x", "y" or "both" for which axis dragging is allowed
     * @return {ReactComponent}
     */

    var createMixin = function (axis) {
        if (typeof axis === "undefined") {
            axis = "both";
        }
        
        var _canDragY = function () {
            return axis === "both" || axis === "y";
        };

        var _canDragX = function () {
            return axis === "both" || axis === "x";
        };

        var DraggableMixin = {
            mixins: [StoreWatchMixin("draganddrop")],
            
            propTypes: {
                // TODO doc
                zone: React.PropTypes.number.isRequired,
                getDragItems: React.PropTypes.function
            },
            
            getStateFromFlux: function () {
                var dragPosition;
                
                if (this.props.isDragTarget) {
                    var flux = this.getFlux(),
                        dragAndDropStore = flux.store("draganddrop"),
                        dragAndDropState = dragAndDropStore.getState();
                    
                    dragPosition = dragAndDropState.dragPosition;
                }
                
                return {
                    dragPosition: dragPosition
                };
            },

            componentWillUnmount: function () {
                // Remove any leftover event handlers
                window.removeEventListener("mousemove", this._handleDragMove, true);
                window.removeEventListener("mouseup", this._handleDragFinish, true);
            },

            getDefaultProps: function () {
                return {
                    // What axis dragging works in {"both", "x", "y"}
                    axis: axis,
                    dragPlaceholderClass: "drag_placeholder"
                };
            },

            getInitialState: function () {
                return {
                    // Whether or not currently dragging
                    dragging: false,

                    // Start top/left of the DOM node
                    startX: null,
                    startY: null,
                    
                    dragStyle: null
                };
            },

            componentWillReceiveProps: function (nextProps) {
                if (nextProps.isDragTarget) {
                    var startY = this.state.startY,
                        startX = this.state.startX;
                    
                    if (!startY || !startX) {
                        var node = React.findDOMNode(this),
                            bounds = node.getBoundingClientRect();

                        startX = bounds.left;
                        startY = bounds.top;
                        
                        this.setState({
                            startX: startX,
                            startY: startY,
                            dragStyle: {
                                top: startY,
                                left: startX
                            }
                        });
                    } else if (this.state.dragPosition) {
                        var offsetY, offsetX;
                        
                        if (this.state.offsetY) {
                            offsetY = this.state.offsetY;
                            offsetX = this.state.offsetX;
                        } else {
                            offsetY = startY - this.state.dragPosition.y;
                            offsetX = startX - this.state.dragPosition.x;
                        }

                        this.setState({
                            offsetY: offsetY,
                            offsetX: offsetX,
                            dragStyle: {
                                top: _canDragY() ? this.state.dragPosition.y + offsetY : startY,
                                left: _canDragX() ? this.state.dragPosition.x + offsetX : startX
                            }
                        });
                    }
                } else {
                    this.setState({
                        startX: null,
                        startY: null,
                        wasDragTarget: this.props.isDragTarget && !nextProps.isDragTarget,
                        offsetY: null,
                        offsetX: null
                    });
                }
            },

            /**
             * Suppress the single click event that follows the mouseup event at
             * the end of the drag.
             *
             * @param {SyntheticEvent} event
             */
            _handleDragClick: function (event) {
                event.stopPropagation();
                window.removeEventListener("click", this._handleDragClick, true);
            },

            /**
             * Handles the start of a dragging operation by setting up initial position
             * and adding event listeners to the window
             */
            _notifyDragStart: function () {
                window.addEventListener("mousemove", this._handleDragMove, true);
                window.addEventListener("mouseup", this._handleDragFinish, true);
            },

            /**
             * Handles move for a dragging object
             * Registers dragging objects with store
             *
             * @param {Event} event
             */
            _handleDragMove: function (event) {
                var flux = this.getFlux();

                if (!this.state.dragging) {
                    var dragItems = this.props.getDragItems(this);
                    if (dragItems.isEmpty()) {
                        return;
                    }

                    this.setState({
                        dragging: true
                    });

                    // Suppress the following click event
                    window.addEventListener("click", this._handleDragClick, true);

                    if (this.props.onDragStart) {
                        this.props.onDragStart();
                    }

                    flux.store("draganddrop").startDrag(dragItems);
                } else {
                    flux.store("draganddrop").updateDrag(this.props.zone, {
                        x: event.clientX,
                        y: event.clientY
                    });
                }
            },

            /**
             * Handles finish of drag operation
             * Removes drag event listeners from window
             * Resets state
             *
             * @param {SyntheticEvent} event
             */
            _handleDragFinish: function (event) {
                window.removeEventListener("mousemove", this._handleDragMove, true);
                window.removeEventListener("mouseup", this._handleDragFinish, true);

                // Short circuit if not currently dragging
                if (!this.state.dragging) {
                    return;
                }

                // If the mouseup event is outside the window, there won't be an
                // associated click event. In this case, remove the handler explicitly
                // instead of waiting for (and suppressing) the following unrelated
                // click event.
                if (event.target === window.document.documentElement) {
                    window.removeEventListener("click", this._handleDragClick, true);
                }

                if (this.props.onDragStop) {
                    this.props.onDragStop();
                }

                // Turn off dragging
                this.setState({
                    dragging: false
                });

                this.getFlux().store("draganddrop").stopDrag();
            }
        };

        return DraggableMixin;
    };

    module.exports = { createMixin: createMixin };
});
