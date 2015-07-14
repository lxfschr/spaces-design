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

    var Immutable = require("immutable");

    /**
     * Possible statuses of exports asset in the state machine
     *
     * @enum {string}
     */
    var STATUS = {
        NEW: "new",
        REQUESTED: "requested",
        STABLE: "stable"
    };

    /**
     * @constructor
     * @param {object} model
     */
    var ExportAsset = Immutable.Record({
        /**
         * @type {string}
         */
        filePath: null,

        /**
         * @type {number}
         */
        scale: 1,

        /**
         * @type {string}
         */
        type: "png",

        /**
         * The status of this asset in the state machine
         * @type {string}
         */
        status: STATUS.NEW

    });

    /**
     * This composite key helps us organize groups of assets within a given layer or document
     * TODO I think this is deprecated?
     * @return {string}
     */
    ExportAsset.prototype.getId = function () {
        return this.type + "@" + this.scale;
    };

    ExportAsset.prototype.setStatusRequested = function () {
        return this.set("status", STATUS.REQUESTED);
    };

    ExportAsset.prototype.setStatusStable = function () {
        return this.set("status", STATUS.STABLE);
    };
    
    module.exports = ExportAsset;
});
