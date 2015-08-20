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

    var object = require("js/util/object"),
        Bounds = require("./bounds"),
        Radii = require("./radii"),
        Stroke = require("./stroke"),
        Fill = require("./fill"),
        Shadow = require("./shadow"),
        Text = require("./text");
    var log = require("js/util/log");

    /**
     * A model of Photoshop 3D element.
     *
     * @constructor
     */
    var Element = Immutable.Record({
        /**
         * Element name
         * @type {string}
         */
        name: null,

        /**
         * Element Kind
         * @type {number}
         */
        kind: null,

        /**
         * @type {object}
         */
        elementKinds: elementLib.elementKinds,
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
                name: self.name,
                kind: self.kind,
            });
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
     * @param {object} descriptor Photoshop layer descriptor
     * @return {Element}
     */
    Element.fromRawElement = function (rawElement) {
        var model = this.parseRawElement(rawElement);

        return new Element(model);
    };

    /**
     * Parses given raw element to construct a usable object
     *
     * @param {object} descriptor
     *
     * @return {{top: number, left: number, bottom: number, right: number}}
     */
    Element.parseRawElement = function (rawElement) {
        var model = {
            name: rawElement.name,
            kind: rawElement.type
        };
    };

    /**
     * Updates the bound object with new properties
     *
     * @param {object} descriptor Photoshop layer descriptor
     * @return {Bounds} [description]
     */
    Element.prototype.resetFromDescriptor = function (descriptor) {
        var newBoundObject = Bounds.parseLayerDescriptor(descriptor);

        return this.merge(newBoundObject);
    };
    
    /**
     * True if the element has element effect.
     * @return {boolean}  
     */
    Element.prototype.hasElementEffect = function () {
        return !this.innerShadows.isEmpty() || !this.dropShadows.isEmpty();
    };

    /**
     * True if the element is text element.
     * @return {boolean}  
     */
    Element.prototype.isTextElement = function () {
        return this.kind === this.elementKinds.TEXT;
    };

    module.exports = Element;
});
