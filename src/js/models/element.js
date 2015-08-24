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

    var elementLib = require("adapter/lib/element");

    var object = require("js/util/object");
    var log = require("js/util/log");

    /**
     * A model of Photoshop 3D element.
     *
     * @constructor
     */
    var Element = Immutable.Record({
        /**
         * The ID of this element's layer
         * @type {number}
         */
        layerID: null,

        /**
         * Id of element
         * @type {number}
         */
        id: null,

        /**
         * A unique key for the element.
         * @param {string}
         */
        key: null,

        /**
         * Element name
         * @type {string}
         */
        name: null,

        /**
         * True if element is visible
         * @type {boolean}
         */
        visible: null,

        /**
         * True if element is selected
         * @type {boolean}
         */
        selected: null,

        /**
         * Element Kind
         * @type {number}
         */
        kind: null,

        /**
         * Element subType
         * @type {number}
         */
        subType: null,

        /**
         * Indicates whether this group element is expanded or collapsed.
         * @type {boolean}
         */
        expanded: false,

        /**
         * @type {object}
         */
        elementKinds: elementLib.elementKinds
    });

    Element.elementKinds = elementLib.elementKinds;

    Object.defineProperties(Element.prototype, object.cachedGetSpecs({
        /**
         * Subset of properties that define the element face
         * @type {Immutable.Map.<string, *>}
         */
        face: function () {
            var self = this;
            return new Immutable.Map({
                id: self.id,
                name: self.name,
                kind: self.kind,
                subType: self.subType,
                visible: self.visible,
                expanded: self.expanded,
                selected: self.selected
            });
        },
        /**
         * This layer is safe to be super-selected
         * @type {boolean}
         */
        superSelectable: function () {
            return this.kind !== this.elementKinds.SCENEEND &&
                   this.kind !== this.elementKinds.GROUPEND;
        }
    }));

    /**
     * Determine whether the given element is expanded or collapsed.
     *
     * @param {object} sceneDescriptor
     * @return {boolean}
     */
    var _extractExpanded = function (sceneDescriptor) {
        return !sceneDescriptor.hasOwnProperty("elementSectionExpanded") ||
            sceneDescriptor.elementSectionExpanded;
    };


    /**
     * Create a new Element object from the given layer descriptor.
     *
     * @param {object} rawElement Photoshop 3D element
     * @param {number} layerID Photoshop layer id
     * @return {Element}
     */
    Element.fromRawElement = function (rawElement, layerID, id) {
        var model = this.parseRawElement(rawElement, layerID, id);
        log.debug("model: " + model);
        return new Element(model);
    };

    /**
     * Parses given raw element to construct a usable object
     *
     * @param {object} rawElement
     * @param {number} layerID Photoshop layer id
     * @return {{top: number, left: number, bottom: number, right: number}}
     */
    Element.parseRawElement = function (rawElement, layerID, id) {
        var model = {
            layerID: layerID,
            id: id,
            key: layerID + "." + id,
            name: rawElement.key3DTreeParamName,
            kind: rawElement.key3DNodeType,
            subType: rawElement.key3DNodeSubType,
            visible: true,
            expanded: rawElement.key3DExpansion,
            selected: false
        };

        return model;
    };

    module.exports = Element;
});
