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
        classnames = require("classnames"),
        tinycolor = require("tinycolor");

    var strings = require("i18n!nls/strings"),
        ColorModel = require("js/models/color");

    var AssetSection = require("jsx!./AssetSection");

    var Color = React.createClass({
        mixins: [FluxMixin],

        componentWillMount: function () {
            var element = this.props.element,
                representation = element.getPrimaryRepresentation(),
                color = representation.getValue("color", "data"),
                colorString = this._getStringColorValue(color),
                hexValue = tinycolor(color.value).toHexString().toUpperCase();

            this.setState({
                colorData: color,
                colorString: colorString,
                hexValue: hexValue
            });
        },

        // Grabbed from CC-libraries-panel
        /** @ignore */
        _getStringColorValue: function (color) {
            var result;
            if (color) {
                if (color.mode === "CMYK") {
                    result = "C" + Math.round(color.value.c) +
                        " M" + Math.round(color.value.m) +
                        " Y" + Math.round(color.value.y) +
                        " K" + Math.round(color.value.k);
                } else if (color.mode === "RGB") {
                    result = "R" + Math.round(color.value.r) +
                        " G" + Math.round(color.value.g) +
                        " B" + Math.round(color.value.b);
                } else if (color.mode === "Lab") {
                    result = "L" + Math.round(color.value.l) +
                        " A" + Math.round(color.value.a) +
                        " B" + Math.round(color.value.b);
                } else if (color.mode === "HSB") {
                    result = "H" + Math.round(color.value.h) +
                        " S" + Math.round(color.value.s) +
                        " B" + Math.round(color.value.b);
                } else if (color.mode === "Gray") {
                    result = "G" + Math.round(color.value);
                }
            }
            return result;
        },

        /**
         * Apply color to the selected layers.
         *
         * @private
         */
        _handleApply: function () {
            var colorData = this.state.colorData,
                color = new ColorModel({ r: colorData.value.r, g: colorData.value.g, b: colorData.value.b });

            this.getFlux().actions.libraries.applyColor(color);
        },

        render: function () {
            var element = this.props.element,
                displayName = element.displayName !== "" ? element.displayName : this.state.hexValue;

            var classNames = classnames("libraries__asset", {
                "libraries__asset-selected": this.props.selected
            });

            return (
                <div className={classNames}
                     key={element.id}>
                    <div className="libraries__asset__preview"
                         style={{ background: this.state.hexValue }}
                         title={strings.LIBRARIES.CLICK_TO_APPLY}
                         onClick={this._handleApply}/>
                     <AssetSection
                        element={this.props.element}
                        onSelect={this.props.onSelect}
                        selected={this.props.selected}
                        title={displayName}/>
                </div>
            );
        }
    });

    module.exports = Color;
});
