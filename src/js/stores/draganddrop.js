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
        _dropTargetZones: null,

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

            this._dropTargetZones = new Map();
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
            this._dragTargets = payload.dragTargets;
            this.emit("change");
        },

        _handleStopDragging: function () {
            if (this._dropTarget) {
                this._dropTarget.onDrop(this._dropTarget.keyObject);
                this._dropTarget = null;
            }
            this._pastDragTargets = this._dragTargets;
            this._dragTargets = null;
            this._dragPosition = null; // Removing this causes an offset
            this.emit("change");
        },

        _addDroppables: function (zone, droppables) {
            var dropTargets = this._dropTargetZones.get(zone);
            if (!dropTargets) {
                dropTargets = Immutable.List();
            }

            var nextDropTargets = dropTargets.concat(droppables);
            this._dropTargetZones.set(zone, nextDropTargets);
        },

        _removeDroppables: function (zone, keys) {
            var dropTargets = this._dropTargetZones.get(zone);
            if (!dropTargets) {
                throw new Error("Unable to remove droppables from an empty drop target zone");
            }

            var nextDropTargets = dropTargets;
            keys.forEach(function (key) {
                nextDropTargets = nextDropTargets.delete(key);
            });

            this._dropTargetZones.set(zone, nextDropTargets);
        },

        /**
         * Adds node to list of drop targets
         *
         * @param {object} payload
         */
        _handleRegisterDroppable: function (payload) {
            var zone = payload.zone,
                droppable = payload.droppable;

            this._addDroppables(zone, [droppable]);
        },
        
        /**
         * Adds many nodes to list of drop targets
         *
         * @param {Immutable.Iterable.OrderedMap<object>} payload list of registration infromation
         */
        _handleBatchRegisterDroppables: function (payload) {
            var zone = payload.zone,
                droppables = payload.droppables;

            this._dropTargets = this._addDroppables(zone, droppables);
        },

        /**
         * Removes droppable area from list
         *
         * @param {string} payload
         */
        _handleDeregisterDroppable: function (payload) {
            var zone = payload.zone,
                key = payload.key;

            this._removeDroppables(zone, [key]);
        },
        
        /**
         * Removes many droppable areas
         *
         * @param {Immutable.Iterable.List<string>} payload
         */
        _handleBatchDeregisterDroppables: function (payload) {
            var zone = payload.zone,
                keys = payload.keys;

            this._removeDroppables(zone, keys);
        },

        /**
         * Removes all current drop targets and adds a batch of new ones
         *
         * @param {object} payload list of registration information
         */
        _handleResetDroppables: function (payload) {
            var zone = payload.zone,
                droppables = payload.droppables;

            this._dropTargetZones.delete(zone);
            this._addDroppables(zone, droppables);
        },
        
        /**
         * Calls checkBounds to 
         * Sets _dragPosition which is used for moving dragged object on screen 
         * Emits change event which causes re-render
         *
         * @param {*} zone
         * @param {{x: number, y: number}} point Point where event occurred
         */
        moveAndCheckBounds: function (zone, point) {
            this.checkBounds(zone, point);
            this._dragPosition = point;
            this.emit("change");
        },

        /**
         * Checks the bounds of all the drop targets for this point
         * Sets this._dropTarget if an intersection and valid target are found
         *
         * For speed, first checks the last bounds to see if we are still within them
         *
         * Potential things to consider for the future
         * - More actively manage the drop targets, thus making the list smaller
         * - Somehow cache getBoundingClientRect to make this faster
         * - Could consider using throttle here to stop some wasted calls - throttle around 16ms for 60fps
         *
         * @param {*} zone
         * @param {{x: number, y: number}} point Point were event occurred
         */
        checkBounds: function (zone, point) {
            var dragTargets = this._dragTargets;
            if (!dragTargets) {
                return;
            }

            var dropTargets = this._dropTargetZones.get(zone),
                foundDropTargetIndex = -1,
                foundDropTargetValid;

            var foundDropTarget = dropTargets.find(function (dropTarget, index) {
                var validationInfo = dropTarget.isValid(dropTarget, dragTargets, point),
                    compatible = validationInfo.compatible,
                    valid = validationInfo.valid;

                if (!compatible) {
                    return false;
                }

                foundDropTargetIndex = index;
                if (valid) {
                    foundDropTargetValid = true;
                }

                return true;
            }, this);

            if (foundDropTargetValid) {
                this._dropTarget = foundDropTarget;
            } else {
                this._dropTarget = null;
            }

            // Move this drop target to the front of the list for the next search
            if (foundDropTargetIndex > -1) {
                dropTargets = dropTargets
                    .delete(foundDropTargetIndex)
                    .unshift(foundDropTarget);

                this._dropTargetZones.set(zone, dropTargets);
            }
        }
    });

    module.exports = DragAndDropStore;
});
