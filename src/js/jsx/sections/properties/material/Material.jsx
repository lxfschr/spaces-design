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
        elementLib = require("adapter/lib/element"),
        classnames = require("classnames"),
        _ = require("lodash");

    var contentLayerLib = require("adapter/lib/contentLayer");

    var strings = require("i18n!nls/strings"),
        ColorProperty = require("jsx!./ColorProperty"),
        Slider = require("jsx!./Slider"),
        collection = require("js/util/collection");
    var log = require("js/util/log");

    /**
     * Material Component displays information of a single fill for a given layer or
     * set of layers.
     */
    var Material = React.createClass({
        mixins: [FluxMixin],

        shouldComponentUpdate: function (nextProps, nextState) {
            return !Immutable.is(this.state.materials, nextProps.materials) ||
                this.props.disabled !== nextProps.disabled;
        },

        getInitialState: function () {
            return {
                materials: Immutable.List()
            };
        },

        componentWillReceiveProps: function (nextProps) {
            var materials = nextProps.materials;
            this.setState({
                materials: materials
            });
        },

        /**
         * Selects the content of the input on focus.
         *
         * @private
         * @param {SyntheticEvent} event
         */
        _handleFocus: function (event) {
            event.target.scrollIntoViewIfNeeded();
            if (this.props.onFocus) {
                this.props.onFocus(event);
            }
        },

        render: function () {
            var materials = this.state.materials;

            var containerContents = this.props.document && this.props.visible && !this.props.disabled && (
                    <div>
                        <ColorProperty {...this.props} title={strings.PROPERTIES.DIFFUSE} onFocus={this._handleFocus}/>
                        <ColorProperty {...this.props} title={strings.PROPERTIES.SPECULAR} onFocus={this._handleFocus}/>
                        <ColorProperty {...this.props} title={strings.PROPERTIES.EMISSIVE} onFocus={this._handleFocus}/>
                        <ColorProperty {...this.props} title={strings.PROPERTIES.AMBIENT} onFocus={this._handleFocus}/>
                        <Slider {...this.props} title={strings.PROPERTIES.SHINE} onFocus={this._handleFocus}/>
                        <Slider {...this.props} title={strings.PROPERTIES.REFLECTION} onFocus={this._handleFocus}/>
                        <Slider {...this.props} title={strings.PROPERTIES.ROUGHNESS} onFocus={this._handleFocus}/>
                        <Slider {...this.props} title={strings.PROPERTIES.BUMP} onFocus={this._handleFocus}/>
                        <Slider {...this.props} title={strings.PROPERTIES.OPACITY} onFocus={this._handleFocus}/>
                        <Slider {...this.props} title={strings.PROPERTIES.REFRACTION} maxValue={3} onFocus={this._handleFocus}/>
                    </div>
                );

            // If there are no materials, hide the component
            /*if (this.state.materials.isEmpty()) {
                return null;
            }*/

            return (
                <div>
                    {containerContents}
                </div>
            );
        }
    });

    module.exports = Material;
});
