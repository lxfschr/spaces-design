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

    var UI = require("adapter/ps/ui");
    
    var React = require("react"),
        Fluxxor = require("fluxxor"),
        FluxMixin = Fluxxor.FluxMixin(React),
        classnames = require("classnames"),
        Immutable = require("immutable"),
        _ = require("lodash");

    var Draggable = require("jsx!js/jsx/shared/Draggable"),
        Droppable = require("jsx!js/jsx/shared/Droppable"),
        Button = require("jsx!js/jsx/shared/Button"),
        SVGIcon = require("jsx!js/jsx/shared/SVGIcon"),
        ToggleButton = require("jsx!js/jsx/shared/ToggleButton"),
        TextInput = require("jsx!js/jsx/shared/TextInput"),
        system = require("js/util/system"),
        svgUtil = require("js/util/svg"),
        strings = require("i18n!nls/strings");
    var log = require("js/util/log");

    /**
     * Function for checking whether React component should update
     * Passed to Droppable composed component in order to save on extraneous renders
     *
     * @param {object} nextProps - Next set of properties for this component
     * @return {boolean}
     */
    var shouldComponentUpdate = function (nextProps) {
        // Drag states
        if (this.props.isDragging !== nextProps.isDragging ||
            this.props.dropPosition !== nextProps.dropPosition ||
            this.props.dragPosition !== nextProps.dragPosition ||
            this.props.dragStyle !== nextProps.dragStyle ||
            this.props.isDropTarget !== nextProps.isDropTarget) {
            return true;
        }
        /*log.debug("this.props.element.face: " + this.props.element.face);
        log.debug("nextProps.element.face: " + nextProps.element.face);*/
        // Face change
        if (!Immutable.is(this.props.element.face, nextProps.element.face)) {
            return true;
        }

        var document = this.props.document,
            nextDocument = nextProps.document;

        // Depth changes
        var currentDepth = document.layers.depth(this.props.layer),
            nextDepth = nextDocument.layers.depth(nextProps.layer);

        if (currentDepth !== nextDepth) {
            return true;
        }

        // Deeper selection changes
        var childOfSelection = document.layers.hasSelectedAncestor(this.props.layer);
        if (childOfSelection || nextDocument.layers.hasSelectedAncestor(nextProps.layer)) {
            if (!Immutable.is(document.layers.allSelected, nextDocument.layers.allSelected)) {
                return true;
            }
        }

        // Given that the face hasn't changed and no selected ancestor has changed, this
        // component only needs to re-render when going from having a collapsed ancestor
        // (i.e., being hidden) to not having one (i.e., becoming newly visible).
        var hadCollapsedAncestor = document.layers.hasCollapsedAncestor(this.props.layer),
            willHaveCollapsedAncestor = nextDocument.layers.hasCollapsedAncestor(nextProps.layer);

        return hadCollapsedAncestor !== willHaveCollapsedAncestor;
    };

    var ElementFace = React.createClass({
        mixins: [FluxMixin],

        /**
         * Expand or collapse the selected groups.
         *
         * @private
         * @param {SyntheticEvent} event
         */
        _handleIconClick: function (event) {
            var element = this.props.element;
            if (element.kind !== element.elementKinds.GROUP) {
                return;
            }

            // Suppress click propagation to avoid selection change
            event.stopPropagation();

            // Presence of option/alt modifier determines whether all descendants are toggled
            var flux = this.getFlux(),
                modifierStore = flux.store("modifier"),
                modifierState = modifierStore.getState(),
                descendants = modifierState.alt;

            this.getFlux().actions.scenetree.setGroupExpansion(this.props.document, layer,
                !layer.expanded, descendants);
        },

        /**
         * Renames the layer
         *
         * @private
         * @param {event} event
         * @param {string} newName
         */
        _handleSceneNodeNameChange: function (event, newName) {
            this.getFlux().actions.scenetree.rename(this.props.document, this.props.layer, this.props.element, newName);
        },

        /**
         * Not implemented yet, but will call the handler being passed from PagesPanel
         * to skip to the next layer and make it editable
         *
         * @private
         * @param {event} event
         */
        _skipToNextLayerName: function (event) {
            // TODO: Skip to next layer on the tree
            event.stopPropagation();
        },

        /**
         * Grabs the correct modifier by processing event modifier keys
         * and calls the select action with correct modifier.
         *
         * @private
         * @param {event} event React event
         */
        _handleSceneNodeClick: function (event) {
            event.stopPropagation();
            var modifier = "select";
            if (event.shiftKey) {
                modifier = "addUpTo";
            } else if (system.isMac ? event.metaKey : event.ctrlKey) {
                var selected = this.props.element.selected;

                if (selected) {
                    modifier = "deselect";
                } else {
                    modifier = "add";
                }
            }

            this.getFlux().actions.scenetree.select(this.props.document, this.props.layer, this.props.element, modifier);
        },

        /**
         * Changes the visibility of the layer
         *
         * @private
         * @param {SyntheticEvent} event
         * @param {boolean} toggled Flag for the ToggleButton, false means visible
         */
        _handleVisibilityToggle: function (event, toggled) {
            // Invisible if toggled, visible if not
            this.getFlux().actions.scenetree.setVisibility(this.props.document, this.props.layer, !toggled);
            event.stopPropagation();
        },

        /**
         * Goes into edit mode for the layer, if it's visible and unlocked
         * Reason for that is, we send a click event to the center of the layer
         * to go into edit mode, and:
         *  - For invisible layers that causes the tool we're switching to create a new layer
         *  - For locked layers, Photoshop does not like we're trying to edit them
         *
         * @param {SyntheticEvent} event
         */
        _handleSceneNodeEdit: function (event) {
            var sceneNode = this.props.element;
            if (!sceneNode.visible) {
                return;
            }

            this.getFlux().actions.superselect.editLayer(this.props.document, sceneNode);
            event.stopPropagation();
        },

        /**
         * Changes the locking of the layer
         *
         * @private
         * @param {SyntheticEvent} event
         * @param {boolean} toggled Flag for the ToggleButton, true means locked
         */
        _handleLockToggle: function (event, toggled) {
            // Locked if toggled, visible if not
            this.getFlux().actions.scenetree.setLocking(this.props.document, this.props.layer, toggled);
            event.stopPropagation();
        },

        /**
         * When not editing a layer name, prevent the layer names from scrolling
         * horizontally while scrolling the layers panel by preventing the default
         * wheel action if there is a non-zero deltaX and instead firing a new
         * wheel action with deltaX set to 0.
         *
         * @private
         * @param {SyntheticEvent} event
         */
        _handleWheel: function (event) {
            var layerName = this.refs.layerName;
            if (!layerName.isEditing() && event.target === React.findDOMNode(layerName)) {
                if (event.deltaX) {
                    var nativeEvent = event.nativeEvent,
                        domEvent = new window.WheelEvent(event.type, {
                            deltaX: 0.0,
                            deltaY: nativeEvent.deltaY
                        });

                    event.preventDefault();
                    event.target.dispatchEvent(domEvent);
                }
            }
        },

        render: function () {
            var doc = this.props.document,
                layer = this.props.layer,
                element = this.props.element,
                elementStructure = this.props.layer.sceneTree,
                elementIndex = elementStructure.indexOf(element),
                nameEditable = !layer.isBackground,
                isSelected = element.selected,
                isChildOfSelected = !element.selected &&
                    elementStructure.parent(element) &&
                    elementStructure.parent(element).selected,
                isStrictDescendantOfSelected = !isChildOfSelected && elementStructure.hasStrictSelectedAncestor(element),
                isDragging = this.props.isDragging,
                isDropTarget = this.props.isDropTarget,
                dropPosition = this.props.dropPosition,
                isGroupStart = element.kind === element.elementKinds.GROUP || element.isParent;
            var depth = elementStructure.depth(element),
                endOfGroupStructure = false,
                isLastInGroup = false,
                dragStyle;
            if (isDragging && this.props.dragStyle) {
                dragStyle = this.props.dragStyle;
            } else {
                // We can skip some rendering calculations if dragging
                isLastInGroup = elementIndex > 0 &&
                    isChildOfSelected &&
                    elementStructure.byIndex(elementIndex - 1).kind === element.elementKinds.GROUPEND;
                
                // Check to see if this layer is the last in a bunch of nested groups
                if (isStrictDescendantOfSelected &&
                    elementStructure.byIndex(elementIndex - 1).kind === element.elementKinds.GROUPEND) {
                    endOfGroupStructure = true;
                }

                dragStyle = {};
            }

            /*log.debug("element: " + element.name);
            log.debug("elementIndex: " + elementIndex);
            log.debug("isSelected: " + isSelected);
            log.debug("isChildOfSelected: " + isChildOfSelected);
            log.debug("isStrictDescendantOfSelected: " + isStrictDescendantOfSelected);
            log.debug("isGroupStart: " + isGroupStart);
            log.debug("depth: " + depth);
            log.debug("endOfGroupStructure: " + endOfGroupStructure);
            log.debug("isLastInGroup: " + isLastInGroup);
            log.debug("endOfGroupStructure: " + endOfGroupStructure);*/
            var layerClasses = {
                "layer": true,
                "layer__group_start": isGroupStart,
                "layer__select": isSelected,
                "layer__select_child": isChildOfSelected,
                "layer__select_descendant": isStrictDescendantOfSelected,
                "layer__group_end": isLastInGroup,
                "layer__nested_group_end": endOfGroupStructure,
                "layer__group_collapsed": element.kind === element.elementKinds.GROUP && !layer.expanded,
                "layer__ancestor_collapsed": doc.layers.hasCollapsedAncestor(layer)
            };

            // Set all the classes need to style this ElementFace
            var faceClasses = {
                "face": true,
                "face__select_immediate": isSelected,
                "face__select_child": isChildOfSelected,
                "face__select_descendant": isStrictDescendantOfSelected,
                "face__drag_target": isDragging && this.props.dragStyle,
                "face__drop_target": isDropTarget,
                "face__drop_target_above": dropPosition === "above",
                "face__drop_target_below": dropPosition === "below",
                "face__drop_target_on": dropPosition === "on",
                "face__group_start": isGroupStart,
                "face__group_lastchild": isLastInGroup,
                "face__group_lastchildgroup": endOfGroupStructure
            };

            faceClasses["face__depth-" + depth] = true;

            // Super Hack: If two tooltip regions are flush and have the same title,
            // the plugin does not invalidate the tooltip when moving the mouse from
            // one region to the other. This is used to make the titles to be different,
            // and hence to force the tooltip to be invalidated.
            var tooltipPadding = _.repeat("\u200b", elementIndex),
                tooltipTitle = layer.isArtboard ? strings.LAYER_KIND.ARTBOARD : strings.LAYER_KIND[layer.kind],
                iconID = svgUtil.getSVGClassFromElement(element),
                showHideButton = layer.isBackground ? null : (
                    <ToggleButton
                        disabled={this.props.disabled}
                        title={strings.TOOLTIPS.SET_LAYER_VISIBILITY + tooltipPadding}
                        className="face__button_visibility"
                        size="column-2"
                        buttonType={ layer.visible ? "layer-visible" : "layer-not-visible" }
                        selected={!layer.visible}
                        onClick={this._handleVisibilityToggle}>
                    </ToggleButton>
                );

            return (
                <li className={classnames(layerClasses)}>
                    <div
                        style={dragStyle}
                        className={classnames(faceClasses)}
                        data-layer-id={element.index}
                        data-kind={element.kind}
                        onMouseDown={!this.props.disabled && this.props.handleDragStart}
                        onClick={!this.props.disabled && this._handleSceneNodeClick}>
                        <Button
                            title={tooltipTitle + tooltipPadding}
                            disabled={this.props.disabled}
                            className="face__kind"
                            data-kind={layer.isArtboard ? "artboard" : layer.kind}
                            onClick={this._handleIconClick}
                            onDoubleClick={this._handleSceneNodeEdit}>
                            <SVGIcon
                                CSSID={iconID}
                                viewbox="0 0 24 24"/>
                        </Button>
                        <span className="face__separator">
                            <TextInput
                                title={element.name + tooltipPadding}
                                className="face__name"
                                ref="layerName"
                                type="text"
                                value={element.name}
                                editable={!this.props.disabled && nameEditable}
                                onKeyDown={this._skipToNextLayerName}
                                onWheel={this._handleWheel}
                                onChange={this._handleSceneNodeNameChange}>
                            </TextInput>
                            {showHideButton}
                        </span>
                        <ToggleButton
                            disabled={this.props.disabled}
                            title={strings.TOOLTIPS.LOCK_LAYER + tooltipPadding}
                            className="face__button_locked"
                            size="column-2"
                            buttonType="toggle-lock"
                            selected={layer.locked}
                            onClick={this._handleLockToggle}>
                        </ToggleButton>
                    </div>
                </li>
            );
        }
    });

    // Create a Droppable from a Draggable from a ElementFace.
    var draggedVersion = Draggable.createWithComponent(ElementFace, "y"),
        isEqual = function (layerA, layerB) {
            return layerA.key === layerB.key;
        },
        droppableSettings = function (props) {
            return {
                zone: props.zone,
                key: props.layer.key,
                keyObject: props.layer,
                isValid: props.isValid,
                handleDrop: props.onDrop
            };
        };

    module.exports = Droppable.createWithComponent(draggedVersion, droppableSettings, isEqual, shouldComponentUpdate);
});
