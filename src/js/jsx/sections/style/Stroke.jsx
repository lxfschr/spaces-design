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

    var React = require("react"),
        Fluxxor = require("fluxxor"),
        FluxMixin = Fluxxor.FluxMixin(React),
        Immutable = require("immutable"),
        classnames = require("classnames"),
        _ = require("lodash");

    var contentLayerLib = require("adapter/lib/contentLayer");

    var Color = require("js/models/color"),
        StrokeAlignment = require("jsx!./StrokeAlignment"),
        Gutter = require("jsx!js/jsx/shared/Gutter"),
        Label = require("jsx!js/jsx/shared/Label"),
        Button = require("jsx!js/jsx/shared/Button"),
        SVGIcon = require("jsx!js/jsx/shared/SVGIcon"),
        NumberInput = require("jsx!js/jsx/shared/NumberInput"),
        ColorInput = require("jsx!js/jsx/shared/ColorInput"),
        ToggleButton = require("jsx!js/jsx/shared/ToggleButton"),
        strings = require("i18n!nls/strings"),
        collection = require("js/util/collection");

    /**
     * Stroke Component displays information of a single stroke for a given layer or 
     * set of layers.
     */
    var Stroke = React.createClass({
        mixins: [FluxMixin],

        shouldComponentUpdate: function (nextProps) {
            return !Immutable.is(this.props.strokes, nextProps.strokes) ||
                this.props.index !== nextProps.index ||
                this.props.readOnly !== nextProps.readOnly;
        },

        /**
         * Handle the button click event, call the toggleStrokeEnabled button
         *
         * @private
         * @param {SyntheticEvent} event
         * @param {boolean} isChecked
         */
        _toggleStrokeEnabled: function (event, isChecked) {
            var bestStroke = this.props.strokes.find(function (stroke) {
                return stroke && _.isObject(stroke.color);
            });

            this.getFlux().actions.shapes.setStrokeEnabled(
                this.props.document,
                this.props.layers,
                this.props.index,
                bestStroke && bestStroke.color || Color.DEFAULT,
                isChecked
            );
        },

        /**
         * Handle the change of the stroke width
         *
         * @private
         * @param {SyntheticEvent} event
         * @param {number} width width of stroke, in pixels
         */
        _widthChanged: function (event, width) {
            this.getFlux().actions.shapes
                .setStrokeWidthThrottled(this.props.document, this.props.layers, this.props.index, width);
        },

        /**
         * Handle the change of the stroke opacity
         *
         * @private
         * @param {SyntheticEvent}  event
         * @param {number} opacity  of stroke, [0,100]
         */
        _opacityChanged: function (event, opacity) {
            this.getFlux().actions.shapes
                .setStrokeOpacityThrottled(this.props.document, this.props.layers, this.props.index, opacity);
        },

        /**
         * Handle the change of the stroke alpha value
         *
         * @private
         * @param {Color} color new stroke color, from which only the alpha is extracted
         * @param {boolean} coalesce         
         */
        _alphaChanged: function (color, coalesce) {
            this.getFlux().actions.shapes
                .setStrokeOpacityThrottled(this.props.document, this.props.layers,
                    this.props.index, color.opacity, coalesce);
        },

        /**
         * Handle the change of the opaque stroke color
         *
         * @private
         * @param {Color} color new stroke color
         * @param {boolean} coalesce         
         */
        _opaqueColorChanged: function (color, coalesce) {
            this._colorChanged.call(this, color, coalesce, true);
        },

        /**
         * Handle the change of the stroke color, including the alpha value
         *
         * @private
         * @param {Color} color new stroke color
         * @param {boolean} coalesce         
         */
        _colorChanged: function (color, coalesce, ignoreAlpha) {
            // If the enabled flags are mixed, or uniformly false, we want to clobber it with true
            // Otherwise left undefined, it will not cause a bounds change
            var isEnabledChanging = !collection.uniformValue(collection.pluck(this.props.strokes, "enabled")),
                enabled = isEnabledChanging || undefined;

            this.getFlux().actions.shapes
                .setStrokeColorThrottled(this.props.document, this.props.layers, this.props.index, color, coalesce,
                    enabled, ignoreAlpha);
        },

        /**
         * Produce a set of arrays of separate stroke display properties, transformed and ready for the sub-components
         *
         * @private
         * @param {Immutable.List.<Stroke>} strokes
         * @return {object}
         */
        _downsampleStrokes: function (strokes) {
            var colors = strokes.map(function (stroke) {
                    if (!stroke) {
                        return null;
                    }
                    if (stroke.type === contentLayerLib.contentTypes.SOLID_COLOR) {
                        return stroke.color;
                    } else {
                        return stroke.type;
                    }
                }),
                widths = collection.pluck(strokes, "width", 0)
                    .map(function (width) {
                        return width ? Math.ceil(width * 100) / 100 : 0;
                    }),
                opacityPercentages = collection.pluck(strokes, "color")
                    .map(function (color) {
                        return color && color.opacity;
                    }),
                enabledFlags = collection.pluck(strokes, "enabled", false);

            return {
                colors: colors,
                widths: widths,
                opacityPercentages: opacityPercentages,
                enabledFlags: enabledFlags
            };
        },

        render: function () {
            var downsample = this._downsampleStrokes(this.props.strokes);

            var strokeClasses = classnames({
                "stroke-list__stroke": true,
                "stroke-list__stroke__disabled": this.props.readOnly
            });

            var strokeOverlay = function (colorTiny) {
                var strokeStyle = {
                    width: "100%",
                    height: (collection.uniformValue(downsample.widths) || 0) + "%",
                    backgroundColor: colorTiny ? colorTiny.toRgbString() : "transparent"
                };

                return (
                    <div
                        className="stroke__preview"
                        style={strokeStyle}/>
                );
            };

            return (
                <div className={strokeClasses}>
                    <div className="formline">
                        <Gutter />
                        <ColorInput
                            id={"stroke-" + this.props.index}
                            className="stroke"
                            context={collection.pluck(this.props.layers, "id")}
                            title={strings.TOOLTIPS.SET_STROKE_COLOR}
                            editable={!this.props.readOnly}
                            defaultValue={downsample.colors}
                            onChange={this._colorChanged}
                            onFocus={this.props.onFocus}
                            onColorChange={this._opaqueColorChanged}
                            onAlphaChange={this._alphaChanged}
                            onClick={!this.props.readOnly ? this._toggleColorPicker : _.noop}
                            swatchOverlay={strokeOverlay}>

                            <div className="compact-stats__body">
                                <div className="compact-stats__body__column">
                                    <Label
                                        title={strings.TOOLTIPS.SET_STROKE_OPACITY}
                                        size="column-4">
                                        {strings.STYLE.STROKE.ALPHA}
                                    </Label>
                                    <NumberInput
                                        value={downsample.opacityPercentages}
                                        onChange={this._opacityChanged}
                                        onFocus={this.props.onFocus}
                                        min={0}
                                        max={100}
                                        step={1}
                                        bigstep={10}
                                        disabled={this.props.readOnly}
                                        size="column-3" />
                                </div>
                                <Gutter />
                                <div className="compact-stats__body__column">
                                    <Label
                                        title={strings.TOOLTIPS.SET_STROKE_SIZE}
                                        size="column-4">
                                        {strings.STYLE.STROKE.SIZE}
                                    </Label>
                                    <NumberInput
                                        value={downsample.widths}
                                        onChange={this._widthChanged}
                                        onFocus={this.props.onFocus}
                                        min={0}
                                        step={1}
                                        bigstep={5}
                                        disabled={this.props.readOnly}
                                        size="column-3" />
                                </div>
                                <Gutter />
                                <div className="compact-stats__body__column">
                                    <Label
                                        title={strings.TOOLTIPS.SET_STROKE_ALIGNMENT}
                                        size="column-4">
                                        {strings.STYLE.STROKE.ALIGNMENT}
                                    </Label>
                                    <StrokeAlignment
                                        {...this.props} />
                                </div>
                            </div>
                        </ColorInput>
                        <Gutter />
                        <ToggleButton
                            title={strings.TOOLTIPS.TOGGLE_STROKE}
                            name="toggleStrokeEnabled"
                            buttonType="layer-visibility"
                            selected={downsample.enabledFlags}
                            onClick={!this.props.readOnly ? this._toggleStrokeEnabled : _.noop}
                            size="column-2"
                        />
                        <Gutter />
                    </div>
                </div>
            );
        }
    });

    /**
     * StrokeList Component maintains a set of strokes components for the selected Layer(s)
     */
    var StrokeList = React.createClass({
        mixins: [FluxMixin],

        /**
         * Handle a NEW stroke
         *
         * @private
         */
        _addStroke: function (layers) {
            this.getFlux().actions.shapes.addStroke(this.props.document, layers);
        },

        render: function () {
            var document = this.props.document,
                // We only care about vector layers.  If at least one exists, then this component should render
                layers = document.layers.selected.filter(function (layer) {
                    return layer.kind === layer.layerKinds.VECTOR;
                });

            if (layers.isEmpty()) {
                return null;
            }

            // Group into arrays of strokes, by position in each layer
            var strokeGroups = collection.zip(collection.pluck(layers, "strokes")),
                strokeList = strokeGroups.map(function (strokes, index) {
                    return (
                        <Stroke {...this.props}
                            key={index}
                            index={index}
                            readOnly={false}
                            layers={layers}
                            strokes={strokes} />
                    );
                }, this).toList();

            // Add a "new stroke" button if not read only
            var newButton = null;
            if (strokeGroups.isEmpty()) {
                newButton = (
                    <Button
                        className="button-plus"
                        onClick = {this._addStroke.bind(this, layers)}>
                        <SVGIcon
                            viewbox="0 0 12 12"
                            CSSID="plus" />
                    </Button>
                );
            }
            
            return (
                <div className="stroke-list__container">
                    <header className="stroke-list__header sub-header">
                        <h3>
                            {strings.STYLE.STROKE.TITLE}
                        </h3>
                        <Gutter />
                        <hr className="sub-header-rule"/>
                        {newButton}
                    </header>
                    <div className="stroke-list__list-container">
                        {strokeList}
                    </div>
                </div>
            );
        }
    });

    exports.Stroke = Stroke;
    exports.StrokeList = StrokeList;
});
