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

    var _ = require("lodash"),
        layerLib = require("adapter/lib/layer");
   
    /**
     * Get the class name for the layer face icon for the given layer
     *
     * @private
     * @param {Layer} layer
     * @return {string}
    */
    var getSVGClassFromLayer = function (layer) {
        var iconID = "layer-";
        if (layer.isArtboard) {
            iconID += "artboard";
        } else if (layer.kind === layer.layerKinds.BACKGROUND) {
            iconID += layer.layerKinds.PIXEL;
        } else if (layer.kind === layer.layerKinds.SMARTOBJECT && layer.isLinked) {
            iconID += layer.kind + "-linked";
        } else {
            iconID += layer.kind;
        }

        return iconID;
    };

    /**
     * Gets an array of the CSS class names, one for each layer type in the parameter array
     *
     * @private
     * @param {Array.<string>} layerTypes
     * @return {Array.<string>}
    */
    var getSVGClassesFromLayerTypes = function (layerTypes) {
        if (layerTypes.length === 0) {
            return [];
        }
        // currently only have icons for layers
        if (layerTypes.length < 2 || layerTypes.join(" ").indexOf("layer") === -1) {
            return ["tool-rectangle"]; // standin for non-layers
        }

        var iconIDs = [],
            isLinked = _.has(layerTypes, "linked");

        _.forEach(layerTypes, function (kind) {
            var iconID = "layer-";

            // No svg for these
            if (kind === "solid color" || kind === "gradient" || kind === "pattern") {
                iconID = "tool-rectangle";
            } else if (kind === "artboard") {
                iconID += "artboard";
            } else if (kind === "background") {
                iconID += layerLib.layerKinds.PIXEL;
            } else if (kind === "smart object" && isLinked) {
                iconID += layerLib.layerKinds.SMARTOBJECT + "-linked";
            } else if (kind !== "layer") {
                iconID += layerLib.layerKinds[kind.toUpperCase().replace(" ", "")];
            }

            if (kind !== "layer") {
                iconIDs.push(iconID);
            }
        });

        return iconIDs;
    };

    exports.getSVGClassFromLayer = getSVGClassFromLayer;
    exports.getSVGClassesFromLayerTypes = getSVGClassesFromLayerTypes;
});
