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
    var noflo = require("noflo");

    var log = require("js/util/log");

    /**
     * A model of the Photoshop layer structure.
     *
     * @constructor
     */
    var SceneGraph = Immutable.Record({
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
        materials: null,

        /**
         * All map objects indexed by map id.
         *
         * @type {Immutable.Map.<number, Element>}
         */
        maps: null
    });

    /**
     * Construct a SceneGraph model from Photoshop document and layer descriptor.
     *
     * @param {List<Element>} sceneNodes
     * @return {SceneGraph}
     */
    SceneGraph.fromSceneNodes = function (sceneNodes) {
        log.debug("Immutable: " + Immutable);
        log.debug("noflo: " + noflo);
        log.debug("sceneNodes: " + sceneNodes);
        /*var graph;

        graph = noflo.graph.createGraph("linecount");

        graph.addNode("ReadFile", "ReadFile");

        graph.addNode("SplitbyLines", "SplitStr");

        graph.addNode("CountLines", "Counter");

        graph.addNode("Display", "Output");

        graph.addEdge("ReadFile", "out", "SplitbyLines", "in");

        graph.addEdge("SplitbyLines", "out", "CountLines", "in");

        graph.addEdge("CountLines", "count", "Display", "in");

        graph.addInitial("scenegraph.js", "ReadFile", "in");

        log.debug(" graph: " + JSON.stringify(graph));

        noflo.createNetwork(graph, function(network) {
            console.log("Graph loaded");
            console.log(network);
        });*/

        var countJSON = {
            "baseDir": "/node_modules/",
            "properties": {
                "name": "Count lines in a file"
            },
            "processes": {
                "ReadFile": {
                    "component": "ReadFile",
                    "metadata": {
                        "display": {
                            "x": 91,
                            "y": 154
                        }
                    }
                },
                "SplitbyLines": {
                    "component": "SplitStr",
                    "metadata": {
                        "display": {
                            "x": 209,
                            "y": 414
                        }
                    }
                },
                "CountLines": {
                    "component": "Counter",
                    "metadata": {
                        "display": {
                            "x": 206,
                            "y": 750
                        }
                    }
                },
                "Display": {
                    "component": "Output",
                    "metadata": {
                        "display": {
                            "x": 71,
                            "y": 1003
                        }
                    }
                }
            },
            "connections": [
                {
                    "src": {
                        "process": "ReadFile",
                        "port": "out"
                    },
                    "tgt": {
                        "process": "SplitbyLines",
                        "port": "in"
                    }
                },
                {
                    "src": {
                        "process": "ReadFile",
                        "port": "error"
                    },
                    "tgt": {
                        "process": "Display",
                        "port": "in"
                    }
                },
                {
                    "src": {
                        "process": "SplitbyLines",
                        "port": "out"
                    },
                    "tgt": {
                        "process": "CountLines",
                        "port": "in"
                    }
                },
                {
                    "src": {
                        "process": "CountLines",
                        "port": "count"
                    },
                    "tgt": {
                        "process": "Display",
                        "port": "in"
                    }
                },
                {
                    "data": "package.json",
                    "tgt": {
                        "process": "ReadFile",
                        "port": "in"
                    }
                }
            ]
        };
        noflo.graph.loadJSON(countJSON, function (graph) {
            log.debug(" Graph loaded");
            log.debug(graph);
            noflo.createNetwork(graph, function (network) {
                log.debug(" Network loaded");
                log.debug(network);
            });
        });

        return new SceneGraph({
            elements: null,
            index: null,
            materials: null,
            maps: null
        });
    };

    module.exports = SceneGraph;
});
