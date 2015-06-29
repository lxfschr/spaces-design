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

    var Fluxxor = require("fluxxor"),
        Immutable = require("immutable");

    var events = require("js/events");

    /**
     *
     * @constructor
     */
    var DragAndDropStore = Fluxxor.createStore({

        /**
         * All available drop targets
         * 
         * @private
         * @type {Immutable.OrderedMap<{node: DOMNode, 
         *                              keyObject: object, 
         *                              validate: function, 
         *                              onDrop: function}>}  
         */
        _dropTargets: new Immutable.OrderedMap(),

        _dropTargetDistances: null,

        /**
         * Currently Active drag targets
         * 
         * @private
         * @type {List} 
         */
        _dragTargets: null,

        /**
         * Currently Active drop target
         * 
         * @private
         * @type {object}
         */
        _dropTarget: null,

        /**
         * Past drag target (for maintaining position during render)
         * 
         * @private
         * @type {Object} 
         */
        _pastDragTargets: null,

        /**
         * Bounds for current drop target
         *
         * @private
         * @type {{top: number, bottom: number, left: number, right: number}} 
         */
        _currentBounds: null,

        initialize: function () {
            this.bindActions(
                events.droppable.REGISTER_DROPPABLE, this._handleRegisterDroppable,
                events.droppable.BATCH_REGISTER_DROPPABLES, this._handleBatchRegisterDroppables,
                events.droppable.REGISTER_DRAGGING, this._handleStartDragging,
                events.droppable.DEREGISTER_DROPPABLE, this._handleDeregisterDroppable,
                events.droppable.BATCH_DEREGISTER_DROPPABLES, this._handleBatchDeregisterDroppables,
                events.droppable.STOP_DRAGGING, this._handleStopDragging,
                events.droppable.MOVE_AND_CHECK_BOUNDS, this.moveAndCheckBounds,
                events.droppable.RESET_DROPPABLES, this._handleResetDroppables
            );

            this._dropTargetDistances = new Map();
        },

        getState: function () {
            return {
                dragTargets: this._dragTargets,
                dropTarget: this._dropTarget,
                dragPosition: this._dragPosition,
                pastDragTargets: this._pastDragTargets
            };
        },

        _handleStartDragging: function (payload) {
            this._dragTargets = payload;
            this.emit("change");
        },

        _handleStopDragging: function () {
            if (this._dropTarget) {
                this._dropTarget.onDrop(this._dropTarget.keyObject);
                this._dropTarget = null;
            }
            this._pastDragTargets = this._dragTargets;
            this._currentBounds = null;
            this._dragTargets = null;
            this._dragPosition = null; // Removing this causes an offset
            this.emit("change");
        },

        /**
         * Adds node to list of drop targets
         *
         * @param {object} payload
         */
        _handleRegisterDroppable: function (payload) {
            this._handleBatchRegisterDroppables([[payload.key, {
                node: payload.node,
                keyObject: payload.keyObject,
                isValid: payload.isValid,
                onDrop: payload.onDrop
            }]]);
        },
        
        /**
         * Adds many nodes to list of drop targets
         *
         * @param {Immutable.Iterable.OrderedMap<object>} payload list of registration infromation
         */
        _handleBatchRegisterDroppables: function (payload) {
            this._dropTargets = this._dropTargets.merge(payload);
        },

        /**
         * Removes droppable area from list
         *
         * @param {string} key
         */
        _handleDeregisterDroppable: function (key) {
            this._handleBatchDeregisterDroppables(Immutable.List.of(key));
        },
        
        /**
         * Removes many droppable areas
         *
         * @param {Immutable.Iterable.List<string>} keys
         */
        _handleBatchDeregisterDroppables: function (keys) {
            this._dropTargets = this._dropTargets.deleteIn(keys);
        },

        /**
         * Removes all current drop targets and adds a batch of new ones
         *
         * @param {object} payload list of registration information
         */
        _handleResetDroppables: function (payload) {
            this.dropTargets = new Immutable.OrderedMap();
            payload.forEach(function (p) {
                this._handleRegisterDroppable(p);
            }, this);
        },
        
        /**
         * Calls checkBounds to 
         * Sets _dragPosition which is used for moving dragged object on screen 
         * Emits change event which causes re-render
         *
         * @param {{x: number, y: number}} point Point where event occurred
         */
        moveAndCheckBounds: function (point) {
            this.checkBounds(point);
            this._dragPosition = point;
            this.emit("change");
        },

        /**
         * Checks the bounds of all the drop targets for this point
         * Sets this._currentBounds and this._dropTarget if an intersection and valid target are found
         *
         * For speed, first checks the last bounds to see if we are still within them
         *
         * Potential things to consider for the future
         * - More actively manage the drop targets, thus making the list smaller
         * - Somehow cache getBoundingClientRect to make this faster
         * - Could consider using throttle here to stop some wasted calls - throttle around 16ms for 60fps
         *
         * @param {{x: number, y: number}} point Point were event occurred
         *
         */
        checkBounds: function (point) {
            var dragTargets = this._dragTargets;
            if (!dragTargets) {
                return;
            }

            this._dropTargets.some(function (dropTarget) {
                var validationInfo = dropTarget.isValid(dropTarget, dragTargets, point),
                    distance = validationInfo.distance,
                    compatible = validationInfo.compatible,
                    valid = validationInfo.valid;

                this._dropTargetDistances.set(dropTarget, distance);

                if (!compatible) {
                    return false;
                }

                if (valid) {
                    this._dropTarget = dropTarget;
                }

                return true;
            }, this);

            this._dropTargets = this._dropTargets.sort(function (a, b) {
                var aDist = this._dropTargetDistances.get(a, Number.POSITIVE_INFINITY),
                    bDist = this._dropTargetDistances.get(b, Number.POSITIVE_INFINITY);

                if (Number.isFinite(aDist)) {
                    if (Number.isFinite(bDist)) {
                        return aDist - bDist > 0 ? 1 : (aDist === bDist ? 0 : -1);
                    } else {
                        return 1;
                    }
                } else if (Number.isFinite(bDist)) {
                    return -1;
                } else {
                    return 0;
                }
            }.bind(this));
        }
    });

    module.exports = DragAndDropStore;
});
