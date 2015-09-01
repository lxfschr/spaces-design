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

    var Layer = require("./layer"),
        SceneTreeNode = require("./scenetreenode"),
        Bounds = require("./bounds"),
        Fill = require("./Fill"),
        Element = require("./element");

    var objUtil = require("js/util/object"),
        collection = require("js/util/collection");
    var log = require("js/util/log");

    /**
     * A model of the Photoshop layer structure.
     *
     * @constructor
     */
    var ElementStructure = Immutable.Record({
        /**
         * All Element objects indexed by element id.
         *
         * @type {Immutable.Map.<number, Element>}
         */
        elements: null,

        /**
         * Index-ordered element IDs.
         *
         * @type {Immutable.List.<number>}
         */
        index: null,

        /**
         * All material objects indexed by material name.
         *
         * @type {Immutable.Map.<string, Element>}
         */
        materials: null
    });

    /**
     * Extract the relevant 3d scene elements.
     * @param  {object} sceneDescriptor
     * @return {object}
     */
    var _extractMaterials = function (materialsList) {
        var materials = materialsList.reduce(function (materials, material) {
            var model = {
                name: material.name,
                diffuse: Fill.fromFloats(material.$dred, material.$dgrn, material.$dblu),
                specular: Fill.fromFloats(material.$sred, material.$sgrn, material.$sblu),
                emissive: Fill.fromFloats(material.$ered, material.$egrn, material.$eblu),
                ambient: Fill.fromFloats(material.$ared, material.$agrn, material.$ablu),
                shininess: material.$shin,
                reflection: material.$refl,
                roughness: material.$rogh,
                bump: material.$bump,
                transparency: material.transparency,
                refraction: material.$RfAc
            };
            materials.set(material.name, model);
            return materials;
        }, new Map());
        materials = Immutable.Map(materials);
        return materials;
    };

    var _extractID = function(element, frameList, meshList) {
        var i;
        for(i = 0; i < frameList.length; i++) {
            var frame = frameList[i];
            if(frame.name === element.key3DTreeParamName) {
                return frame.$NoID;
            }
        }
        if(meshList) {
            for (i = 0; i < meshList.length; i++) {
                var mesh = meshList[i];
                if (mesh.meshExtraData) {
                    var constraintList = meshList[i].meshExtraData.internalConstraints
                    for (var j = 0; j < constraintList.length; j++) {
                        var constraint = constraintList[j];
                        if (constraint.name === element.key3DTreeParamName) {
                            return Math.floor((Math.random() * 100) + 50) + constraint.ID;
                        }
                    }
                }
            }
        }
        return Math.floor((Math.random() * 150) + 100);
    };

    var _getInsertionIndex = function(list, count) {
        var idx = 0;
        var children = 0;
        var i = 0;
        while(i < list.length) {
            if (list[i].key3DChildCount > 0) {
                i += list[i].key3DChildCount;
            }
            i++;
            children++;
            if (children === count) {
                return i;
            }
        }
    };

    var _insertGroupEnds = function(sceneTree){
        for(var i = 0; i < sceneTree.length; i++) {
            var node = sceneTree[i];
            var numChildren = node.key3DChildCount;
            if(numChildren > 0 && node.key3DIsParent) {
                var groupEndIndex = _getInsertionIndex(sceneTree.slice(i+1), numChildren);
                var model = {
                    key3DChildCount: 1,
                    key3DExpansion: false,
                    key3DIsParent: false,
                    key3DNodeSubType: 0,
                    key3DNodeType: 13,
                    key3DTreeParamName: "</Element group>"

                };
                sceneTree.splice(i+1+groupEndIndex, 0, model);
            }
        }
        return sceneTree;
    };

    /**
     * Construct a ElementStructure model from Photoshop document and layer descriptor.
     *
     * @param {object} layerDescriptor
     * @return {ElementStructure}
     */
    ElementStructure.fromLayerDescriptor = function (layerDescriptor) {
        var layer3D = layerDescriptor.layer3D;
        var sceneNodes = new Map();
        var index = new Immutable.List();
        var materials = new Map();
        if(layer3D) {
            var scene = layer3D.key3DScene;
            var sceneTree = scene.key3DSceneTree[0].key3DTreeClassList;
            sceneTree = _insertGroupEnds(sceneTree);
            sceneTree = Immutable.List(sceneTree);
            var idx = 0;
            materials = _extractMaterials(scene.$mtll);
            sceneNodes = sceneTree.reduce(function (elements, element) {
                var id = _extractID(element, scene.$KeFL, scene.$mshl);
                elements.set(idx, Element.fromRawElement(element, layerDescriptor.layerID, idx));
                idx++;
                return elements;
            }, sceneNodes);
            sceneNodes = Immutable.Map(sceneNodes);
            index = Immutable.List(sceneNodes.keys()).reverse();
        }
        return new ElementStructure({
            elements: sceneNodes,
            index: index,
            materials: materials
        });
    };

    /**
     * Helper function for getSelectableElements
     * For one element, adds all siblings of it's parents, all the way up the tree
     *
     * @private
     * @param {Element} element Starting element
     * @param {Immutable.Iterable.<Element>} selectableElements Collection of selectable elements so far
     * @param {Object.<{number: Element}>} visitedParents Already processed parents
     * @return {Immutable.Iterable.<Element>} Siblings of this element
     */
    ElementStructure.prototype._replaceAncestorWithSiblingsOf = function (element, selectableElements, visitedParents) {
        var elementAncestor = this.parent(element);

        // If we were already at root, we don't need to do anything for this layer
        if (!elementAncestor) {
            return selectableElements;
        }

        var pull = function (elements, parent) {
            return elements.filter(function (element) {
                return element !== parent;
            });
        };

        // Traverse up to root
        while (elementAncestor && !visitedParents.hasOwnProperty(elementAncestor.id)) {
            // Remove the current parent because we're already below it
            selectableElements = pull(selectableElements, elementAncestor);

            // So we don't process this parent again
            visitedParents[elementAncestor.id] = elementAncestor;

            // Add the siblings of this layer to accepted layers
            selectableElements = selectableElements.concat(this.children(elementAncestor));

            elementAncestor = this.parent(elementAncestor);
        }

        return selectableElements;
    };

    Object.defineProperties(ElementStructure.prototype, objUtil.cachedGetSpecs({
        /**
         * @private
         * @type {{nodes: Immutable.Map.<number, SceneTreeNode>, roots: Immutable.List.<SceneTreeNode>}}
         */
        "_nodeInfo": function () {
            return SceneTreeNode.fromElements(this.all);
        },

        /**
         * All LayerNode objects index by layer ID.
         *
         * @type {Immutable.Map.<number, SceneTreeNode>}
         */
        "nodes": function () {
            return this._nodeInfo.nodes;
        },

        /**
         * Index-ordered root LayerNode objects.
         *
         * @type {Immutable.List.<SceneTreeNode>}
         */
        "roots": function () {
            return this._nodeInfo.roots;
        },

        /**
         * Indicates whether there are features in the document
         *  that are currently unsupported.
         *
         * @type {boolean}
         */
        "unsupported": function () {
            return this.elements.some(function (element) {
                return element.unsupported;
            });
        },

        /**
         * Mapping from layer IDs to indices.
         * @type {Immutable.Map.<number, number>}
         */
        "reverseIndex": function () {
            var reverseIndex = this.index.reduce(function (reverseIndex, elementID, i) {
                return reverseIndex.set(elementID, i + 1);
            }, new Map());

            return Immutable.Map(reverseIndex);
        },

        /**
         * Index-ordered list of all layer models.
         * @type {Immutable.List.<Layer>}
         */
        "all": function () {
            return this.index.map(this.byID, this);
        },

        /**
         * All non-endgroup layers
         * @type {Immutable.List.<Layer>}
         */
        "allVisible": function () {
            return this.all
                .filterNot(function (element) {
                    return element.kind === element.elementKinds.GROUPEND;
                });
        },

        /**
        * All non-endgroup layers, in reverse order
        * @type {Immutable.List.<Layer>}
        */
        "allVisibleReversed": function () {
            return this.allVisible.reverse();
        },

        /**
         * The number of non-endgroup layers
         * @type {number}
         */
        "count": function () {
            return this.allVisible.size;
        },

        /**
         * Root Layer models of the layer forest.
         * @type {Immutable.List.<Layer>}
         */
        "top": function () {
            return this.roots
                .toSeq()
                .map(function (node) {
                    return this.byID(node.id);
                }, this)
                .filter(function (element) {
                    return element.kind !== element.elementKinds.GROUPEND;
                })
                .toList();
        },

        /**
         * All the root layers of the document + first level children
         * of artboards
         * @type {Immutable.List.<Layer>}
         */
        "topBelowArtboards": function () {
            return this.top
                .flatMap(function (element) {
                    if (element.isArtboard) {
                        return this.children(element)
                            .filter(function (layer) {
                                return layer.kind !== layer.elementKinds.GROUPEND;
                            })
                            .push(element);
                    } else {
                        return Immutable.List.of(element);
                    }
                }, this)
                .sort(function (layerA, layerB) {
                    var valueA = layerA.isArtboard ? 1 : 0,
                        valueB = layerB.isArtboard ? 1 : 0;

                    return valueA - valueB;
                })
                .toList();
        },

        /**
         * The subset of Layer models that correspond to currently selected layers.
         * @type {Immutable.List.<Layer>}
         */
        "selected": function () {
            return this.all.filter(function (layer) {
                return layer.selected;
            }, this);
        },

        /**
         * Child-encompassing bounds objects for all the selected layers.
         * @type {Immutable.List.<Bounds>}
         */
        "selectedChildBounds": function () {
            return this.selected
                .toSeq()
                .map(function (element) {
                    return this.childBounds(element);
                }, this)
                .filter(function (bounds) {
                    return bounds && bounds.area > 0;
                })
                .toList();
        },

        /**
         * Overall bounds of selection
         * @type {Bounds}
         */
        "selectedAreaBounds": function () {
            return Bounds.union(this.selectedChildBounds);
        },

        /**
         * The subset of Layer models that correspond to leaves of the layer forest.
         * @type {Immutable.List.<Layer>}
         */
        "leaves": function () {
            return this.all.filter(function (element) {
                return element.kind !== element.elementKinds.GROUPEND &&
                    element.kind !== element.elementKinds.GROUP &&
                    !element.isParent &&
                    element.visible &&
                    !this.hasLockedAncestor(element);
            }, this);
        },

        /**
         * The subset of Layer models that can currently be directly selected.
         * @type {Immutable.List.<Layer>}
         */
        "selectable": function () {
            var visitedParents = {};

            return this.selected
                .toSeq()
                .reduce(function (validLayers, layer) {
                    return this._replaceAncestorWithSiblingsOf(layer, validLayers, visitedParents);
                }, this.topBelowArtboards, this)
                .filter(function (layer) {
                    return layer.superSelectable &&
                        this.hasVisibleDescendant(layer) &&
                        !this.hasInvisibleAncestor(layer) &&
                        !this.hasLockedAncestor(layer) &&
                        !visitedParents.hasOwnProperty(layer.id);
                }, this)
                .toList();
        },

        /**
         * The subset of Layer models that are all selected or are descendants of selected
         *
         * @return {Immutable.List.<Layer>}
         */
        "allSelected": function () {
            return this.selected.flatMap(this.descendants, this).toOrderedSet();
        },

        /**
         * True if there are any artboards in the layer tree
         *
         * @return {boolean} if any layers in an artboard
         */
        "hasArtboard": function () {
            return this.top.some(function (layer) {
                return layer.isArtboard;
            });
        },

        /**
         * True if the background layer is selected.
         *
         * @return {boolean}
         */
        "backgroundSelected": function () {
            var firstLayer = this.byIndex(1);

            return firstLayer && firstLayer.isBackground && firstLayer.selected;
        },

        /**
         * True if there are any linked smart objects
         *
         * @return {boolean} if any layers are a linked smart object
         */
        "hasLinkedSmartObjects": function () {
            return this.all.some(function (layer) {
                return layer.isLinked;
            });
        },

        /**
         * The subset of Layer models that are all selected, with their descendants removed
         * from selection
         *
         * @return {Immutable.List.<Layer>}
         */
        "selectedNormalized": function () {
            // For each layer, remove all it's descendants from the group
            var selected = this.selected;
            return selected.filterNot(function (layer) {
                return this.strictAncestors(layer)
                    .some(function (ancestor) {
                        return selected.contains(ancestor);
                    });
            }, this);
        },

        /**
         * Determine if selected layers are "locked"
         * Currently true for any of the following:
         * 1) The background layer is selected
         * 2) Any selected layers are locked
         * 3) No layers are selected
         *
         * @return {boolean} If any selected layers are locked, or if none are selected
         */
        "selectedLocked": function () {
            var selectedLayers = this.selected;
            return selectedLayers.isEmpty() || selectedLayers.some(function (layer) {
                return layer.isBackground || layer.locked;
            });
        },

        /**
         * Determine if selected layers are deletable
         * PS logic is that there will be at least one graphic layer left
         *
         * @return {boolean} If any of the layers outside overall selection are graphic layers
         */
        "selectedLayersDeletable": function () {
            var allSelectedLayers = this.allSelected,
                notSelectedLayers = collection.difference(this.all, allSelectedLayers);

            return !allSelectedLayers.isEmpty() &&
                !notSelectedLayers.isEmpty() &&
                notSelectedLayers.some(function (layer) {
                    return layer.kind !== layer.elementKinds.GROUPEND &&
                        layer.kind !== layer.elementKinds.GROUP;
                });
        }
    }));

    /**
     * Get a Layer model by layer ID.
     *
     * @param {number} id
     * @return {?Layer}
     */
    ElementStructure.prototype.byID = function (id) {
        return this.elements.get(id, null);
    };

    /**
     * Get a Layer model by layer index.
     *
     * @param {number} index
     * @return {?Layer}
     */
    ElementStructure.prototype.byIndex = function (index) {
        var layerID = this.index.get(index - 1, null);
        if (layerID === null) {
            return null;
        } else {
            return this.byID(layerID);
        }
    };

    /**
     * Find the index of the given layer.
     *
     * @param {Layer} layer
     * @return {?number}
     */
    ElementStructure.prototype.indexOf = function (layer) {
        return this.reverseIndex.get(layer.id, null);
    };

    /**
     * Find the parent of the given layer.
     *
     * @param {Layer} layer
     * @return {?Layer}
     */
    ElementStructure.prototype.parent = function (layer) {
        var node = this.nodes.get(layer.id, null);

        if (!node || node.parent === null) {
            return null;
        } else {
            return this.byID(node.parent);
        }
    };

    /**
     * Get the depth of the given layer in the layer hierarchy.
     *
     * @param {Layer} layer
     * @return {?number}
     */
    ElementStructure.prototype.depth = function (layer) {
        var node = this.nodes.get(layer.id, null);

        if (!node) {
            return null;
        } else {
            return node.depth;
        }
    };

    /**
     * Calculates the depth of the lowest descendant of the given layer
     *
     * @param {Layer} layer
     * @return {number}
     */
    Object.defineProperty(ElementStructure.prototype, "maxDescendantDepth", objUtil.cachedLookupSpec(function (layer) {
        return this.descendants(layer).map(this.depth, this).max();
    }));

    /**
     * Find the children of the given layer.
     *
     * @param {Layer} layer
     * @return {?Immutable.List.<Layer>}
     */
    Object.defineProperty(ElementStructure.prototype, "children", objUtil.cachedLookupSpec(function (layer) {
        var node = this.nodes.get(layer.id, null);

        if (node && node.children) {
            return node.children.map(function (child) {
                return this.byID(child.id);
            }, this);
        } else {
            return Immutable.List();
        }
    }));

    /**
     * Find all siblings of the given layer, including itself.
     *
     * @param {Layer} layer
     * @return {Immutable.List.<Layer>}
     */
    Object.defineProperty(ElementStructure.prototype, "siblings", objUtil.cachedLookupSpec(function (layer) {
        var parent = this.parent(layer);

        if (parent) {
            return this.children(parent);
        } else {
            return this.top;
        }
    }));

    /**
     * Find all ancestors of the given layer, including itself.
     *
     * @param {Layer} layer
     * @return {?Immutable.List.<Layer>}
     */
    Object.defineProperty(ElementStructure.prototype, "ancestors", objUtil.cachedLookupSpec(function (layer) {
        return this.strictAncestors(layer)
            .push(layer);
    }));

    /**
     * Find all ancestors of the given layer, excluding itself.
     *
     * @param {Layer} layer
     *
     * @return {?Immutable.List.<Layer>}
     */
    Object.defineProperty(ElementStructure.prototype, "strictAncestors", objUtil.cachedLookupSpec(function (layer) {
        var parent = this.parent(layer);

        if (parent) {
            return this.ancestors(parent);
        } else {
            return Immutable.List();
        }
    }));

    /**
     * Find all locked ancestors of the given layer, including itself.
     *
     * @param {Layer} layer
     * @return {Immutable.List.<Layer>}
     */
    Object.defineProperty(ElementStructure.prototype, "lockedAncestors", objUtil.cachedLookupSpec(function (layer) {
        return this.ancestors(layer).filter(function (layer) {
            return layer.locked;
        });
    }));

    /**
     * Determine whether the given layer has a collapsed ancestor, and hence
     * should be hidden in the layers panel.
     *
     * @param {Layer} layer
     * @return {boolean}
     */
    Object.defineProperty(ElementStructure.prototype, "hasCollapsedAncestor", objUtil.cachedLookupSpec(function (layer) {
        return this.strictAncestors(layer).some(function (layer) {
            return !layer.expanded;
        });
    }));

    /**
     * Find all descendants of the given layer, including itself.
     *
     * @param {Layer} layer
     * @return {Immutable.List.<Layer>}
     */
    Object.defineProperty(ElementStructure.prototype, "descendants", objUtil.cachedLookupSpec(function (layer) {
        return this.strictDescendants(layer)
            .push(layer);
    }));

    /**
     * Find all descendants of the given layer, excluding itself.
     *
     * @param {Layer} layer
     * @return {Immutable.List.<Layer>}
     */
    Object.defineProperty(ElementStructure.prototype, "strictDescendants", objUtil.cachedLookupSpec(function (layer) {
        return this.children(layer)
            .toSeq()
            .reverse()
            .map(this.descendants, this)
            .flatten(true)
            .toList();
    }));
    /**
     * Find all locked descendants of the given layer, including itself.
     *
     * @param {Layer} layer
     * @return {Immutable.List.<Layer>}
     */
    Object.defineProperty(ElementStructure.prototype, "lockedDescendants", objUtil.cachedLookupSpec(function (layer) {
        return this.descendants(layer).filter(function (layer) {
            return layer.locked;
        });
    }));

    /**
     * Determine whether some ancestors of the given layer are locked.
     *
     * @param {Layer} layer
     * @return {boolean}
     */
    Object.defineProperty(ElementStructure.prototype, "hasLockedAncestor", objUtil.cachedLookupSpec(function (layer) {
        return this.ancestors(layer).some(function (layer) {
            return layer.locked;
        });
    }));

    /**
     * Determine whether some descendants of the given layer are locked.
     *
     * @param {Layer} layer
     * @return {boolean}
     */
    Object.defineProperty(ElementStructure.prototype, "hasLockedDescendant", objUtil.cachedLookupSpec(function (layer) {
        return this.descendants(layer).some(function (descendant) {
            return descendant.locked;
        }, this);
    }));

    /**
     * Determine whether some ancestors of the given layer are selected.
     *
     * @param {Layer} layer
     * @return {boolean}
     */
    Object.defineProperty(ElementStructure.prototype,
        "hasStrictSelectedAncestor", objUtil.cachedLookupSpec(function (layer) {
        var parent = this.parent(layer);

        if (parent) {
            return this.hasSelectedAncestor(parent);
        } else {
            return false;
        }
    }));

    /**
     * Determine whether some ancestors of the given layer are selected.
     *
     * @param {Layer} layer
     * @return {boolean}
     */
    Object.defineProperty(ElementStructure.prototype, "hasSelectedAncestor", objUtil.cachedLookupSpec(function (layer) {
        return layer.selected || this.hasStrictSelectedAncestor(layer);
    }));

    /**
     * Determine whether some ancestors of the given layer are invisible.
     *
     * @param {Layer} layer
     * @return {boolean}
     */
    Object.defineProperty(ElementStructure.prototype, "hasInvisibleAncestor", objUtil.cachedLookupSpec(function (layer) {
        return this.ancestors(layer).some(function (layer) {
            return !layer.visible;
        });
    }));

    /**
     * Determine whether any of the non group descendants of this layer (besides itself) is visible.
     *
     * @param {Layer} layer
     * @return {boolean}
     */
    Object.defineProperty(ElementStructure.prototype, "hasVisibleDescendant", objUtil.cachedLookupSpec(function (layer) {
        return this.descendants(layer)
            .filterNot(function (layer) {
                return layer.kind === layer.elementKinds.GROUP || layer.kind === layer.elementKinds.GROUPEND;
            })
            .some(function (layer) {
                return layer.visible;
            });
    }));

    /**
     * Determine whether a layer is an empty group or contains only adjustment layers
     *
     * @param {Layer} layer
     * @return {boolean}
     */
    Object.defineProperty(ElementStructure.prototype, "isEmptyGroup", objUtil.cachedLookupSpec(function (layer) {
        return layer.kind === layer.elementKinds.GROUP &&
            this.children(layer)
            .filterNot(function (layer) {
                return layer.kind === layer.elementKinds.ADJUSTMENT || this.isEmptyGroup(layer);
            }, this)
            .size === 1; // only contains groupend
    }));

    /**
     * Calculate the child-encompassing bounds of the given layer. Returns null
     * for end-group layers and otherwise-empty groups. If layer is artboard, returns the bounds of it
     *
     * @param {Layer} layer
     * @return {?Bounds}
     */
    Object.defineProperty(ElementStructure.prototype, "childBounds", objUtil.cachedLookupSpec(function (layer) {
        switch (layer.kind) {
            case layer.elementKinds.GROUP:
                if (layer.isArtboard) {
                    return layer.bounds;
                }

                var childBounds = this.children(layer)
                    .map(this.childBounds, this)
                    .filter(function (bounds) {
                        return bounds && bounds.area > 0;
                    });

                return Bounds.union(childBounds);
            case layer.elementKinds.GROUPEND:
                return null;
            default:
                return layer.bounds;
        }
    }));

    /**
     * Create a new non-group layer model from a Photoshop layer descriptor and
     * add it to the structure.
     *
     * @param {Array.<number>} layerIDs
     * @param {Array.<object>} descriptors Photoshop layer descriptors
     * @param {boolean} selected Whether the new layer should be selected. If
     *  so, the existing selection is cleared.
     * @param {boolean= | number=} replace can be explicitly false, undefined, or a layer ID
     * @param {Document} document
     * @return {ElementStructure}
     */
    ElementStructure.prototype.addLayers = function (layerIDs, descriptors, selected, replace, document) {
        var nextStructure = selected ? this.updateSelection(Immutable.Set()) : this,
            replaceLayer;

        // Default replacement logic is to replace a single, empty, non-background, selected layer
        // Allow explicit opt-in or opt-out via the replace param
        if (replace !== false && layerIDs.length === 1) {
            if (Number.isInteger(replace)) {
                // if explicitly replacing, then replace by current ID
                replaceLayer = this.byID(replace);
            } else {
                // otherwise, replace the selected layer
                var selectedLayers = document.layers.selected;
                replaceLayer = selectedLayers && selectedLayers.size === 1 && selectedLayers.first();
            }

            // The selected layer should be empty and a non-background layer unless replace is explicitly provided true
            replace = replaceLayer &&
                (replace ||
                (!replaceLayer.isBackground && replaceLayer.kind === replaceLayer.elementKinds.PIXEL &&
                replaceLayer.bounds && !replaceLayer.bounds.area));
        }

        // Update the layers and index for each layerID
        var structureToMerge = layerIDs.reduce(function (layerStructure, layerID, i) {
            var nextLayers = layerStructure.layers,
                nextIndex = layerStructure.index,
                descriptor = descriptors[i],
                layerIndex = descriptor.itemIndex - 1,
                isNewSelected = selected && i + 1 === layerIDs.length,
                newLayer = Element.fromDescriptor(document, descriptor, isNewSelected);

            if (i === 0 && replace) {
                // Replace the single selected layer (derived above)
                var replaceIndex = this.indexOf(replaceLayer) - 1; // FFS
                nextLayers = nextLayers.delete(replaceLayer.id);

                if (layerIndex === replaceIndex) {
                    nextIndex = nextIndex.splice(layerIndex, 1, layerID);
                } else if (layerIndex < nextIndex.size) {
                    nextIndex = nextIndex.delete(replaceIndex).splice(layerIndex, 0, layerID);
                } else {
                    throw new Error ("Replacing a layer but the new layer's index seems out of bounds");
                }
            } else {
                nextIndex = nextIndex.splice(layerIndex, 0, layerID);
            }

            nextLayers = nextLayers.set(layerID, newLayer);

            return {
                layers: nextLayers,
                index: nextIndex
            };
        }.bind(this),
        {
            layers: nextStructure.layers,
            index: nextStructure.index
        });

        return nextStructure.merge(structureToMerge);
    };

    /**
     * Reset the given layers from Photoshop layer descriptors.
     *
     * @param {Immutable.Iterable.<{layerID: number, descriptor: object}>} layerObjs
     * @param {Document} previousDocument
     * @return {ElementStructure}
     */
    ElementStructure.prototype.resetLayers = function (layerObjs, previousDocument) {
        var nextLayers = this.layers.withMutations(function (layers) {
            layerObjs.forEach(function (layerObj) {
                var layerID = layerObj.layerID,
                    descriptor = layerObj.descriptor,
                    layer = this.byID(layerID),
                    nextLayer = layer.resetFromDescriptor(descriptor, previousDocument);

                layers.set(layerID, nextLayer);
            }, this);
        }.bind(this));

        return this.mergeDeep({
            layers: nextLayers
        });
    };

    /**
     * Update layers based on a given set of Photoshop layer descriptors,
     * using the descriptor's itemIndex to choose which existing layer to replace
     *
     * @param {Document} document
     * @param {Array.<ActionDescriptor>} descriptors Array of layer descriptors
     * @return {ElementStructure}
     */
    ElementStructure.prototype.replaceLayersByIndex = function (document, descriptors) {
        var nextIndex = this.index;

        var nextLayers = this.layers.withMutations(function (layers) {
            descriptors.forEach(function (descriptor) {
                var i = descriptor.itemIndex,
                    previousLayer = this.byIndex(i),
                    nextLayer = Element.fromDescriptor(document, descriptor, previousLayer.selected);

                // update layers map
                layers.delete(previousLayer.id);
                layers.set(nextLayer.id, nextLayer);

                // replace the layer ID in the index
                nextIndex = nextIndex.set(i - 1, nextLayer.id);
            }, this);
        }.bind(this));

        return this.merge({
            layers: nextLayers,
            index: nextIndex
        });
    };

    /**
     * Reset the given layer bounds from Photoshop bounds descriptors.
     *
     * @param {Immutable.Iterable.<{layerID: number, descriptor: object}>} boundsObj
     * @return {ElementStructure}
     */
    ElementStructure.prototype.resetBounds = function (boundsObj) {
        var nextLayers = this.layers.withMutations(function (layers) {
            boundsObj.forEach(function (boundObj) {
                var layerID = boundObj.layerID,
                    descriptor = boundObj.descriptor,
                    layer = this.byID(layerID),
                    layerBounds = layer.bounds;

                // Ignore updates to layers that don't have bounds like groups and groupends
                if (!layerBounds) {
                    return;
                }

                // Inject layer kind in here for bound reset function
                descriptor.layerKind = layer.kind;

                // Also inject the artboard flag so we read the correct property
                descriptor.artboardEnabled = layer.isArtboard;

                var nextBounds = layer.bounds.resetFromDescriptor(descriptor),
                    nextLayer = layer.set("bounds", nextBounds);

                layers.set(layerID, nextLayer);
            }, this);
        }.bind(this));

        return this.mergeDeep({
            layers: nextLayers
        });
    };

    /**
     * Update basic properties of the given layers.
     *
     * @param {Immutable.Iterable.<number>} sceneNodeIDs
     * @param {object} properties
     * @return {ElementStructure}
     */
    ElementStructure.prototype.setProperties = function (sceneNodeIDs, properties) {
        var nextProperties = Immutable.Map(properties),
            updatedSceneNodes = Immutable.Map(sceneNodeIDs.reduce(function (sceneNodes, sceneNodeID) {
                sceneNodes.set(sceneNodeID, nextProperties);
                return sceneNodes;
            }.bind(this), new Map()));

        return this.mergeDeep({
            elements: updatedSceneNodes
        });
    };

    /**
     * Update the bounds of the given layers.
     *
     * @private
     * @param {Immutable.Map.<number, Bounds>} allBounds The keys of the Map are layer IDs.
     * @return {ElementStructure}
     */
    ElementStructure.prototype._updateBounds = function (allBounds) {
        var nextBounds = allBounds.map(function (bounds) {
            return Immutable.Map({
                bounds: bounds
            });
        });

        return this.mergeDeep({
            layers: nextBounds
        });
    };

    /**
     * Resizes the given layers, setting their width and height to be passed in values.
     *
     * @param {Array.<{layer: Layer, w: number, h: number, x: number, y: number}>} layerSizes
     * @return {ElementStructure}
     */
    ElementStructure.prototype.resizeLayers = function (layerSizes) {
        var allBounds = Immutable.Map(layerSizes.reduce(function (allBounds, layerData) {
            var layer = this.byID(layerData.layer.id);
            if (layer.bounds) {
                allBounds.set(layer.id,
                    layer.bounds.updateSizeAndPosition(layerData.x, layerData.y, layerData.w, layerData.h)
                );
            }

            return allBounds;
        }.bind(this), new Map()));

        return this._updateBounds(allBounds);
    };

    /**
     * set the Proportional flag of the given layers.
     *
     * @param {Immutable.Iterable.<number>} layerIDs
     * @param {boolean} proportional
     * @return {ElementStructure}
     */
    ElementStructure.prototype.setLayersProportional = function (layerIDs, proportional) {
        var nextLayers = Immutable.Map(layerIDs.reduce(function (map, layerID) {
                return map.set(layerID, Immutable.Map({
                    proportionalScaling: proportional
                }));
            }, new Map()));

        return this.mergeDeep({
            layers: nextLayers
        });
    };

    /**
     * Repositions the given layers, setting their top and left to be passed in values.
     *
     * @param {Array.<{layer: Layer, x: number, y: number}>} layerPositions
     * @return {ElementStructure}
     */
    ElementStructure.prototype.repositionLayers = function (layerPositions) {
        var allBounds = Immutable.Map(layerPositions.reduce(function (allBounds, layerData) {
            var layer = this.byID(layerData.layer.id);
            if (layer.bounds) {
                allBounds.set(layer.id, layer.bounds.updatePosition(layerData.x, layerData.y));
            }

            return allBounds;
        }.bind(this), new Map()));

        return this._updateBounds(allBounds);
    };


    /**
     * Repositions and resizes the given layers, setting both their positions and dimensions to be passed in values.
     *
     * @param {Immutable.Iterable.<number>} layerIDs
     * @param {number=} top
     * @param {number=} left
     * @param {number=} width
     * @param {number=} height
     * @return {ElementStructure}
     */
    ElementStructure.prototype.updateBounds = function (layerIDs, top, left, width, height) {
        var allBounds = Immutable.Map(layerIDs.reduce(function (allBounds, layerID) {
            var layer = this.byID(layerID);

            if (layer.bounds) {
                allBounds.set(layerID, layer.bounds.updateSizeAndPosition(top, left, width, height));
            }

            return allBounds;
        }.bind(this), new Map()));


        return this._updateBounds(allBounds);
    };


    /**
     * Translate the given layers, updating their top and left by passed in values.
     *
     * @param {Immutable.Iterable.<number>} layerIDs
     * @param {number=} x
     * @param {number=} y
     * @return {ElementStructure}
     */
    ElementStructure.prototype.translateLayers = function (layerIDs, x, y) {
        var allBounds = Immutable.Map(layerIDs.reduce(function (allBounds, layerID) {
            var layer = this.byID(layerID);
            if (layer.bounds) {
                var newX = layer.bounds.left + x,
                    newY = layer.bounds.top + y;
                allBounds.set(layerID, layer.bounds.updatePosition(newX, newY));
            }

            return allBounds;
        }.bind(this), new Map()));

        return this._updateBounds(allBounds);
    };

    /**
     * Update the selection property to be select iff the layer ID is contained
     * in the given set.
     *
     * @param {Immutable.Set.<string>} selectedIDs
     * @return {ElementStructure}
     */
    ElementStructure.prototype.updateSelection = function (selectedIDs) {
        var updatedSceneNodes = this.elements.map(function (element) {
            var selected = selectedIDs.has(element.id);
            return element.set("selected", selected);
        });

        return this.set("elements", updatedSceneNodes);
    };

    /**
     * Reorder the layers in the given order.
     *
     * @param {Immutable.Iterable.<number>} layerIDs
     * @return {ElementStructure}
     */
    ElementStructure.prototype.updateOrder = function (layerIDs) {
        var updatedIndex = Immutable.List(layerIDs).reverse();
        if (updatedIndex.size > this.layers.size) {
            throw new Error("Too many layers in layer index");
        }

        var updatedLayers;
        if (updatedIndex.size < this.index.size) {
            var deletedLayerIDs = collection.difference(this.index, updatedIndex);
            updatedLayers = this.layers.withMutations(function (layers) {
                deletedLayerIDs.forEach(function (layerID) {
                    layers.delete(layerID);
                });
            });
        } else {
            updatedLayers = this.layers;
        }

        return this.merge({
            index: updatedIndex,
            layers: updatedLayers
        });
    };

    /**
     * Delete the given layer IDs (and reorder the rest)
     *
     * @param {Immutable.Iterable.<number>} layerIDs
     * @return {ElementStructure}
     */
    ElementStructure.prototype.deleteLayers = function (layerIDs) {
        var remainingLayerIDs = collection.difference(this.index, layerIDs).reverse(),
            remainingElementStructure = this.updateOrder(remainingLayerIDs);

        var updatedLayers = remainingElementStructure.layers.withMutations(function (layers) {
            layerIDs.forEach(function (layerID) {
                layers.delete(layerID);
            });
        });

        return remainingElementStructure.merge({
            layers: updatedLayers
        });
    };

    /**
     * Given IDs of group start and end, and group name, will create a new group and
     * put all selected layers in those groups
     * Emulates PS behavior on group - group gets created at the top most selected layer index
     *
     * @param {number} documentID ID of owner document
     * @param {number} groupID ID of group head layer
     * @param {number} groupEndID ID of group end layer
     * @param {string} groupName Name of the group, assigned by Photoshop
     *
     * @return {ElementStructure} Updated layer tree with group added
     */
    ElementStructure.prototype.createGroup = function (documentID, groupID, groupEndID, groupName) {
        var groupHead = Element.fromGroupDescriptor(documentID, groupID, groupName, false),
            groupEnd = Element.fromGroupDescriptor(documentID, groupEndID, "", true),
            layersToMove = this.selectedNormalized.flatMap(this.descendants, this).toOrderedSet(),
            layersToMoveIndices = layersToMove.map(this.indexOf, this),
            layersToMoveIDs = collection.pluck(layersToMove, "id"),
            groupHeadIndex = this.layers.size - layersToMoveIndices.last(),
            newGroupIDs = Immutable.Seq([groupEndID, layersToMoveIDs, groupID]).flatten().reverse(),
            removedIDs = collection
                .difference(this.index, layersToMoveIDs) // Remove layers being moved
                .reverse(), // Reverse because we want to slice from the end
            newIDs = removedIDs
                .slice(0, groupHeadIndex) // First chunk is all layers up to top most selected one
                .concat(newGroupIDs) // Then our new group
                .concat(removedIDs.slice(groupHeadIndex)), // Then the rest
            updatedLayers = this.layers.withMutations(function (layers) {
                layers.set(groupID, groupHead);
                layers.set(groupEndID, groupEnd);
            }),
            newElementStructure = this.merge({
                layers: updatedLayers
            });

        // Add the new layers, and the new order
        newElementStructure = newElementStructure
            .updateSelection(Immutable.Set.of(groupID))
            .updateOrder(newIDs);

        return newElementStructure;
    };

    /**
     * Set the border radii of the given layers.
     *
     * @param {Immutable.Iteralble.<number>} layerIDs
     * @param {Radii} radii
     * @return {ElementStructure}
     */
    ElementStructure.prototype.setBorderRadii = function (layerIDs, radii) {
        var nextRadii = new Radii(radii),
            nextLayers = Immutable.Map(layerIDs.reduce(function (map, layerID) {
                return map.set(layerID, Immutable.Map({
                    radii: nextRadii
                }));
            }, new Map()));

        return this.mergeDeep({
            layers: nextLayers
        });
    };

    /**
     * Set basic properties of the fill at the given index of the given layers.
     *
     * @param {Immutable.Iterable.<number>} layerIDs
     * @param {number} fillIndex
     * @param {object} fillProperties
     * @return {ElementStructure}
     */
    ElementStructure.prototype.setFillProperties = function (layerIDs, fillIndex, fillProperties) {
        var nextLayers = Immutable.Map(layerIDs.reduce(function (map, layerID) {
            var layer = this.byID(layerID),
                fill = layer.fills.get(fillIndex);

            if (!fill) {
                throw new Error("Unable to set fill properties: no fill at index " + fillIndex);
            }

            var nextFill = fill.setFillProperties(fillProperties),
                nextLayer = layer.setIn(["fills", fillIndex], nextFill);

            return map.set(layerID, nextLayer);
        }, new Map(), this));

        return this.mergeDeep({
            layers: nextLayers
        });
    };

    /**
     * Add a new fill, described by a Photoshop "set" descriptor, to the given layers.
     *
     * @param {Immutable.Iterable.<number>} layerIDs
     * @param {object} setDescriptor
     * @return {ElementStructure}
     */
    ElementStructure.prototype.addFill = function (layerIDs, setDescriptor) {
        var nextFill = Fill.fromSetDescriptor(setDescriptor),
            nextLayers = Immutable.Map(layerIDs.reduce(function (map, layerID) {
                // FIXME: If we add a fill to a layer that already has one,
                // is the new fill necessarily appended?
                var layer = this.byID(layerID),
                    nextFills = layer.fills ?
                        layer.fills.push(nextFill) :
                        Immutable.List.of(nextFill);

                return map.set(layerID, Immutable.Map({
                    fills: nextFills
                }));
            }, new Map(), this));

        return this.mergeDeep({
            layers: nextLayers
        });
    };

    /**
     * Set basic properties of the stroke at the given index of the given layers.
     *
     * @param {Immutable.Iterable.<number>} layerIDs
     * @param {number} strokeIndex
     * @param {object} strokeProperties
     * @return {ElementStructure}
     */
    ElementStructure.prototype.setStrokeProperties = function (layerIDs, strokeIndex, strokeProperties) {
        var nextLayers = Immutable.Map(layerIDs.reduce(function (map, layerID) {
            var layer = this.byID(layerID),
                stroke = layer.strokes.get(strokeIndex);

            if (!stroke) {
                throw new Error("Unable to set stroke properties: no stroke at index " + strokeIndex);
            }

            var nextStroke = stroke.setStrokeProperties(strokeProperties),
                nextLayer = layer.setIn(["strokes", strokeIndex], nextStroke);

            return map.set(layerID, nextLayer);
        }, new Map(), this));

        return this.mergeDeep({
            layers: nextLayers
        });
    };

    /**
     * Add a new stroke, described by a Photoshop descriptor, to the given layers.
     * If strokeStyleDescriptor is a single object, it will be applied to all layers
     * otherwise it should be a List of descriptors which corresponds by index to the provided layerIDs
     *
     * @param {Immutable.Iterable.<number>} layerIDs
     * @param {number} strokeIndex
     * @param {object | Immutable.Iterable.<object>} strokeStyleDescriptor
     * @return {ElementStructure}
     */
    ElementStructure.prototype.addStroke = function (layerIDs, strokeIndex, strokeStyleDescriptor) {
        var isList = Immutable.List.isList(strokeStyleDescriptor);

        var getStroke = function (index) {
            return isList ?
                Stroke.fromStrokeStyleDescriptor(strokeStyleDescriptor.get(index)) :
                Stroke.fromStrokeStyleDescriptor(strokeStyleDescriptor);
        };

        var nextLayers = Immutable.Map(layerIDs.reduce(function (map, layerID, index) {
            var layer = this.byID(layerID),
                nextStroke = getStroke(index),
                nextStrokes = layer.strokes ?
                    layer.strokes.set(strokeIndex, nextStroke) :
                    Immutable.List.of(nextStroke);

            return map.set(layerID, Immutable.Map({
                strokes: nextStrokes
            }));
        }, new Map(), this));

        return this.mergeDeep({
            layers: nextLayers
        });
    };

    /**
     * Set basic properties of the layerEffect at the given index of the given layers.
     *
     * @param {Immutable.Iterable.<number>} layerIDs
     * @param {number | Immutable.List.<number>} layerEffectIndex index of effect, or per-layer List thereof
     * @param {string} layerEffectType type of layer effect
     * @param {object | Immutable.List.<object>} layerEffectProperties properties to merge, or per-layer List thereof
     * @return {ElementStructure}
     */
    ElementStructure.prototype.setLayerEffectProperties = function (layerIDs,
        layerEffectIndex, layerEffectType, layerEffectProperties) {
        // validate layerEffectType
        if (!Element.layerEffectTypes.has(layerEffectType)) {
            throw new Error("Invalid layerEffectType supplied");
        }

        var nextLayers = Immutable.Map(layerIDs.reduce(function (map, layerID, index) {
            var layer = this.byID(layerID),
                layerEffects = layer.getLayerEffectsByType(layerEffectType) || Immutable.List(),
                _layerEffectIndex,
                layerEffect,
                nextLayerEffect,
                newProps,
                nextLayer;

            _layerEffectIndex = Immutable.List.isList(layerEffectIndex) ?
                layerEffectIndex.get(index) : layerEffectIndex;
            _layerEffectIndex = Number.isFinite(_layerEffectIndex) ? _layerEffectIndex : layerEffects.size;

            newProps = Immutable.List.isList(layerEffectProperties) ?
                layerEffectProperties.get(index) : layerEffectProperties;
            layerEffect = layerEffects.get(_layerEffectIndex) || Element.newLayerEffectByType(layerEffectType);
            nextLayerEffect = layerEffect.merge(newProps);
            nextLayer = layer.setLayerEffectByType(layerEffectType, _layerEffectIndex, nextLayerEffect)
                .set("usedToHaveLayerEffect", true);

            return map.set(layerID, nextLayer);
        }.bind(this), new Map()));

        return this.mergeDeep({
            layers: nextLayers
        });
    };

    /**
     * Delete properties of the layerEffect at the given index of the given layers.
     *
     * @param {Immutable.Iterable.<number>} layerIDs
     * @param {number} deletedIndex index of effect
     * @param {string} layerEffectType type of layer effect
     * @return {ElementStructure}
     */
    ElementStructure.prototype.deleteLayerEffectProperties = function (layerIDs, deletedIndex, layerEffectType) {
        if (!Element.layerEffectTypes.has(layerEffectType)) {
            throw new Error("Invalid layerEffectType supplied");
        }

        var nextLayers = this.layers.map(function (layer) {
            var layerEffects = layer.getLayerEffectsByType(layerEffectType);
            var nextLayer = layer;
            var isSelectedLayer = layerIDs.indexOf(layer.id) !== -1;

            if (isSelectedLayer && layerEffects) {
                var nextLayerEffects = layerEffects.filter(function (layerEffect, layerEffectIndex) {
                    return layerEffectIndex !== deletedIndex;
                });
                nextLayer = layer.setLayerEffectsByType(layerEffectType, nextLayerEffects);
            }
            return nextLayer;
        });

        return this.set("layers", nextLayers);
    };

    /**
     * Deletes all the effects of given type in the layers
     *
     * @param {Immutable.Iterable.<number>} layerIDs
     * @param {string} layerEffectType
     * @return {ElementStructure} [description]
     */
    ElementStructure.prototype.deleteAllLayerEffects = function (layerIDs, layerEffectType) {
        if (!Element.layerEffectTypes.has(layerEffectType)) {
            throw new Error("Invalid layerEffectType supplied");
        }

        var nextLayers = this.layers.map(function (layer) {
            var layerEffects = layer.getLayerEffectsByType(layerEffectType);
            var nextLayer = layer;
            var isSelectedLayer = layerIDs.indexOf(layer.id) !== -1;

            if (isSelectedLayer && layerEffects) {
                var nextLayerEffects = Immutable.List();
                nextLayer = layer.setLayerEffectsByType(layerEffectType, nextLayerEffects);
            }
            return nextLayer;
        });

        return this.set("layers", nextLayers);
    };

    /**
     * Set basic text style properties at the given index of the given layers.
     *
     * @private
     * @param {string} styleProperty Either "characterStyle" or "paragraphStyle"
     * @param {Immutable.Iterable.<number>} layerIDs
     * @param {object} properties
     * @return {ElementStructure}
     */
    ElementStructure.prototype._setTextStyleProperties = function (styleProperty, layerIDs, properties) {
        var nextLayers = Immutable.Map(layerIDs.reduce(function (map, layerID) {
            var layer = this.byID(layerID),
                style = layer.text[styleProperty],
                nextStyle = style.merge(properties);

            // .set is used here instead of merge to eliminate the other styles
            var nextText = layer.text.set(styleProperty, nextStyle),
                nextLayer = layer.set("text", nextText);

            return map.set(layerID, nextLayer);
        }, new Map(), this));

        return this.set("layers", this.layers.merge(nextLayers));
    };

    /**
     * Set basic properties of the character style at the given index of the given layers.
     *
     * @param {Immutable.Iterable.<number>} layerIDs
     * @param {object} properties
     * @return {ElementStructure}
     */
    ElementStructure.prototype.setCharacterStyleProperties = function (layerIDs, properties) {
        return this._setTextStyleProperties("characterStyle", layerIDs, properties);
    };

    /**
     * Set basic properties of the paragraph style at the given index of the given layers.
     *
     * @param {Immutable.Iterable.<number>} layerIDs
     * @param {object} properties
     * @return {ElementStructure}
     */
    ElementStructure.prototype.setParagraphStyleProperties = function (layerIDs, properties) {
        return this._setTextStyleProperties("paragraphStyle", layerIDs, properties);
    };

    module.exports = ElementStructure;
});
