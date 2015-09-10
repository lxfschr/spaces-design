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
    var log = require("js/util/log");

    /**
     * A node in the layer tree structure.
     * 
     * @constructor
     */
    var SceneTreeNode = Immutable.Record({
        /**
         * Node ID
         *
         * @type {number}
         */
        id: null,

        /**
         * Node IDs of immediate children
         *
         * @type {Immutable.Iterable<number>}
         */
        children: null,

        /**
         * Node ID of parent
         *
         * @type {Immutable.Iterable<number>}
         */
        parent: null,

        /**
         * Depth of the node in the scene tree hierarchy
         *
         * @type {number}
         */
        depth: null
    });

    /**
     * Create a tree of nodes from an order list of Element models. Returns
     * a Map of all element IDs to their corresponding ElementNode, as well as an
     * ordered list of tree roots.
     * 
     * @param {Immutable.Iterable<Element>} elements
     * @return {{roots: Immutable.List<SceneTreeNode>, nodes: Immutable.Map.<number, SceneTreeNode>}}
     */
    SceneTreeNode.fromElements = function (elements) {
        var nodes = new Map();
        var makeSceneTreeNodes = function (parent, index, depth) {
            var roots = [],
                node,
                element,
                nodeID,
                elementKind,
                children,
                previousSize;

            while (index >= 0) {
                element = elements.get(index--);
                nodeID = element.index;
                elementKind = element.kind;
                if (elementKind === elementLib.elementKinds.GROUP || element.isParent) {
                    previousSize = nodes.size;
                    children = makeSceneTreeNodes(nodeID, index, depth + 1);
                    index -= (nodes.size - previousSize);
                } else {
                    children = null;
                }

                node = new SceneTreeNode({
                    id: nodeID,
                    children: children,
                    parent: parent,
                    depth: depth
                });

                nodes.set(nodeID, node);
                roots.push(node);

                if (elementKind === elementLib.elementKinds.GROUPEND) {
                    break;
                }
            }

            return Immutable.List(roots);
        };
        var roots = makeSceneTreeNodes(null, elements.size - 1, 0);
        return {
            roots: roots,
            nodes: Immutable.Map(nodes)
        };
    };

    module.exports = SceneTreeNode;
});
