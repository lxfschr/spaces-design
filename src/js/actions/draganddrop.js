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

define(function (require, exports) {
    "use strict";

    var events = require("../events");

    /**
     * Register a droppable target node
     * Keep a reference to the DOM node as well as the object that DOM node displays
     *
     * @param {*} zone Key used to partition the set of dropTargets
     * @param {Node} dropTarget HTML Node of drop target
     * @param {string} key Unique key for drop target
     * @param {function} isValid Function for validating drop 
     * @param {function} onDrop Handler for drop operation
     * @param {Object} keyObject Model object which is represented by this node
     * @return {Promise}
     */
    var registerDroppable = function (zone, dropTarget, key, isValid, onDrop, keyObject) {
        var payload = {
                zone: zone,
                droppable: {
                    node: dropTarget,
                    key: key,
                    isValid: isValid,
                    onDrop: onDrop,
                    keyObject: keyObject
                }
            };


        return this.dispatchAsync(events.droppable.REGISTER_DROPPABLE, payload);
    };
    registerDroppable.reads = [];
    registerDroppable.writes = [];

    /**
     * Add many droppables at once
     *
     * @param {*} zone Key used to partition the set of dropTargets
     * @param {Immutable.Iterable.<object>} droppables List of droppable registration information
     * @return {Promise}    
     */
    var batchRegisterDroppables = function (zone, droppables) {
        var payload = {
            zone: zone,
            droppables: droppables
        };

        return this.dispatchAsync(events.droppable.BATCH_REGISTER_DROPPABLES, payload);
    };
    batchRegisterDroppables.reads = [];
    batchRegisterDroppables.writes = [];

    /**
     * Remove a drop target by key
     *
     * @param {*} zone Key used to partition the set of dropTargets
     * @param {string} key Unique key for droppable
     * @return {Promise}
     */
    var deregisterDroppable = function (zone, key) {
        var payload = {
            zone: zone,
            key: key
        };

        return this.dispatchAsync(events.droppable.DEREGISTER_DROPPABLE, payload);
    };
    deregisterDroppable.reads = [];
    deregisterDroppable.writes = [];

    /**
     * Remove many drop targets by a list of keys a drop target by key
     *
     * @param {*} zone Key used to partition the set of dropTargets
     * @param {Immutable.Iterable.<object>} keys List of keys to remove
     * @return {Promise}
     */
    var batchDeregisterDroppables = function (zone, keys) {
        var payload = {
            zone: zone,
            keys: keys
        };

        return this.dispatchAsync(events.droppable.DEREGISTER_DROPPABLE, payload);
    };
    batchDeregisterDroppables.reads = [];
    batchDeregisterDroppables.writes = [];

    /**
     * Fire event that dragging started
     *
     * @param {*} zone Key used to partition the set of dropTargets
     * @param {Immutable.Iterable.<object>} dragTargets List of currently dragging items
     * @return {Promise}
     */
    var registerDragging = function (zone, dragTargets) {
        var payload = {
            zone: zone,
            dragTargets: dragTargets
        };

        return this.dispatchAsync(events.droppable.REGISTER_DRAGGING, payload);
    };
    registerDragging.reads = [];
    registerDragging.writes = [];

    /**
     * Fire event that dragging stopped
     *
     * @return {Promise}    
     */
    var stopDragging = function () {
        return this.dispatchAsync(events.droppable.STOP_DRAGGING);
    };
    registerDragging.reads = [];
    registerDragging.writes = [];

    /**
     * Reset all droppables (clear current list, add passed information)
     *
     * @param {*} zone Key used to partition the set of dropTargets
     * @param {Iterable.List} droppables of droppable registration information
     * @return {Promise}    
     */
    var resetDroppables = function (zone, droppables) {
        var payload = {
            zone: zone,
            droppables: droppables
        };

        return this.dispatchAsync(events.droppable.RESET_DROPPABLES, payload);
    };

    resetDroppables.reads = [];
    resetDroppables.writes = [];

    exports.registerDroppable = registerDroppable;
    exports.deregisterDroppable = deregisterDroppable;
    exports.registerDragging = registerDragging;
    exports.stopDragging = stopDragging;
    exports.batchRegisterDroppables = batchRegisterDroppables;
    exports.batchDeregisterDroppables = batchDeregisterDroppables;
    exports.resetDroppables = resetDroppables;
});
