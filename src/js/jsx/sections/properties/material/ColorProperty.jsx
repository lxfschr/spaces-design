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
        Immutable = require("immutable"),
        classnames = require("classnames"),
        _ = require("lodash");

    var contentLayerLib = require("adapter/lib/contentLayer"),
        elementLib = require("adapter/lib/element");

    var BlendMode = require("jsx!js/jsx/sections/style/BlendMode"),
        Opacity = require("jsx!js/jsx/sections/style/Opacity"),
        Color = require("js/models/color"),
        Gutter = require("jsx!js/jsx/shared/Gutter"),
        Label = require("jsx!js/jsx/shared/Label"),
        Fill = require("jsx!js/jsx/sections/style/Fill"),
        FillColor = Fill.FillColor,
        FillVisiblity = Fill.FillVisibility,
        NumberInput = require("jsx!js/jsx/shared/NumberInput"),
        ColorInput = require("jsx!js/jsx/shared/ColorInput"),
        ToggleButton = require("jsx!js/jsx/shared/ToggleButton"),
        strings = require("i18n!nls/strings"),
        collection = require("js/util/collection");
    var log = require("js/util/log");

    /**
     * ColorProperty Component displays information of a single fill for a given layer or
     * set of layers.
     */
    var ColorProperty = React.createClass({
        mixins: [FluxMixin],

        shouldComponentUpdate: function (nextProps, nextState) {
            return !Immutable.is(this.state.fill, nextState.fill) ||
                this.props.disabled !== nextProps.disabled;
        },

        /**
         * Setup state for the fill and layers for child components
         *
         * @private
         * @param {Object} props
         */
        _setFillState: function (props) {
            var document = props.document,
            // We only care about vector materials.  If at least one exists, then this component should render
                materials = props.materials,
                fills = collection.pluck(materials, this.props.title).toList(),
                downsample = this._downsampleFills(fills);

            this.setState({
                materials: materials,
                fill: downsample
            });
        },

        componentWillMount: function () {
            this._setFillState(this.props);
        },

        componentWillReceiveProps: function (nextProps) {
            this._setFillState(nextProps);
        },

        /**
         * Produce a set of arrays of separate fill display properties, transformed and ready for the sub-components
         *
         * @private
         * @param {Immutable.List.<Fill>} fills
         * @return {object}
         */
        _downsampleFills: function (fills) {
            var colors = fills.map(function (fill) {
                    if (!fill) {
                        return null;
                    }

                    if (fill.type === contentLayerLib.contentTypes.SOLID_COLOR) {
                        return fill.color;
                    } else {
                        return fill.type;
                    }
                }),
                opacityPercentages = collection.pluck(fills, "color")
                    .map(function (color) {
                        return color && color.opacity;
                    }),
                enabledFlags = collection.pluck(fills, "enabled", false);

            return {
                colors: colors,
                opacityPercentages: opacityPercentages,
                enabledFlags: enabledFlags
            };
        },

        render: function () {
            var materials = this.state.materials;
            var title = this.props.title;
            // If there are no vector layers, hide the component
            if (!this.state.fill || this.state.materials.isEmpty()) {
                return null;
            }

            return (
                <div className="formline">
                    <Label
                        title={strings.TOOLTIPS.SET_DIFFUSE}>
                        {title}
                    </Label>
                    <div className="control-group__vertical">
                        <FillColor
                            document={this.props.document}
                            layers={this.state.materials}
                            title={title}
                            fill={this.state.fill} />
                    </div>
                    <div className="control-group__vertical">
                        <Label
                            size="column-4"
                            className={"label__medium__left-aligned"}
                            title={strings.TOOLTIPS.SET_OPACITY}>
                            {strings.STYLE.OPACITY}
                        </Label>
                        <Opacity
                            document={this.props.document}
                            disabled={this.props.disabled}
                            onFocus={this.props.onFocus}
                            layers={this.props.materials} />
                    </div>
                    <div className="control-group__vertical control-group__no-label">
                        <FillVisiblity
                            document={this.props.document}
                            layers={this.state.materials}
                            fill={this.state.fill} />
                    </div>
                </div>
            );
        }
    });

    module.exports = ColorProperty;
});
