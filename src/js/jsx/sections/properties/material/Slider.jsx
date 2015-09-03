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
        Immutable = require("immutable");
        
    var Label = require("jsx!js/jsx/shared/Label"),
        Gutter = require("jsx!js/jsx/shared/Gutter"),
        NumberInput = require("jsx!js/jsx/shared/NumberInput"),
        Range = require("jsx!js/jsx/shared/Range"),
        Coalesce = require("js/jsx/mixin/Coalesce"),
        math = require("js/util/math"),
        strings = require("i18n!nls/strings"),
        collection = require("js/util/collection");
    var log = require("js/util/log");

    var Slider = React.createClass({
        mixins: [FluxMixin, Coalesce],

        propTypes: {
            document: React.PropTypes.object.isRequired,
            materials: React.PropTypes.instanceOf(Immutable.Iterable).isRequired
        },

        shouldComponentUpdate: function (nextProps) {
            return !Immutable.is(this.props.materials, nextProps.materials);
        },

        /**
         * Update the radius of the selected materials in response to user input.
         *
         * @param {Immutable.Iterable.<Layer>} materials
         * @param {SyntheticEvent} event
         * @param {number=} value
         */
        _handleValueChange: function (event, value) {
            if (value === undefined) {
                // In this case, the value is coming from the DOM element
                value = math.parseNumber(event.target.value);
            }

            var coalesce = this.shouldCoalesce();
            this.getFlux().actions.scenetree
                .setMaterialPropertyThrottled(this.props.document, this.props.layer.id, this.props.materials, this.props.title, value, coalesce);
        },

        render: function () {
            var materials = this.props.materials,
                title = this.props.title;
            // If there is not at least one selected material, don't render
            if (materials.isEmpty()) {
                return null;
            }
            var scalars = collection.pluck(materials, title).toList();

            // The maximum border radius is one-half of the shortest side of
            // from all the selected shapes.
            var maxValue = this.props.maxValue ? this.props.maxValue : 100;
            return (
                <div className="formline">
                    <Label
                        title={strings.TOOLTIPS.SET_SHINE}>
                        {title}
                    </Label>
                    <Gutter />
                    <NumberInput
                        size="column-4"
                        disabled={this.props.disabled}
                        value={scalars}
                        onChange={this._handleValueChange} />
                    <Gutter />
                    <Range
                        disabled={this.props.disabled}
                        min={0}
                        max={maxValue}
                        value={scalars}
                        onMouseDown={this.startCoalescing}
                        onMouseUp={this.stopCoalescing}
                        onChange={this._handleValueChange} />
                    <Gutter />
                </div>
            );
        }
    });

    module.exports = Slider;
});
