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

    var Promise = require("bluebird"),
        CCLibraries = require("cclibraries");

    var descriptor = require("adapter/ps/descriptor"),
        docAdapter = require("adapter/lib/document"),
        libraryAdapter = require("adapter/lib/libraries");

    var events = require("../events"),
        locks = require("../locks");

    /**
     * Uploads the selected single layer to the current library
     *
     * Achieves this by:
     *  - Creates a new element in the library
     *  - Calls PS to export the layer to a temporary location
     *  - Passes the temporary path to libraries API to update layer's content
     *  - Tells Photoshop the location of the content
     *  - Updates the document
     *
     * Eventually, we'll need this to accept layer(s), library, and be more flexible
     * Also, we definitely need to get rid of the update document call, but this is 0.1
     *
     * @return {Promise}
     */
    var createElementFromSelectedLayer = function () {
        var appStore = this.flux.store("application"),
            libStore = this.flux.store("library"),
            currentDocument = appStore.getCurrentDocument(),
            currentLibrary = libStore.getCurrentLibrary(),
            currentLayers = currentDocument.layers.selected;

        if (!currentLibrary || currentLayers.count() !== 1) {
            return Promise.resolve();
        }

        var currentLayer = currentLayers.first(),
            IMAGE_ELEMENT_TYPE = "application/vnd.adobe.element.image+dcx",
            REPRESENTATION_TYPE = "image/vnd.adobe.photoshop";

        currentLibrary.beginOperation();

        var newElement = currentLibrary.createElement(currentLayer.name, IMAGE_ELEMENT_TYPE),
            representation = newElement.createRepresentation(REPRESENTATION_TYPE, "primary"),
            previewSize = {
                w: 248,
                h: 188
            };

        // FIXME: Mac/Win temporary locations!
        var exportObj = libraryAdapter.exportLayer("/tmp/", "/tmp/preview.png",
            currentLayer.name, previewSize);

        return descriptor.playObject(exportObj)
            .bind(this)
            .then(function (saveData) {
                var path = saveData.in._path;

                return Promise.fromNode(function (cb) {
                    representation.updateContentFromPath(path, false, cb);
                });
            }).finally(function () {
                currentLibrary.endOperation();
            }).then(function () {
                var newRepresentation = newElement.getPrimaryRepresentation();
                return Promise.fromNode(function (cb) {
                    newRepresentation.getContentPath(cb);
                });
            }).then(function (path) {
                var createObj = libraryAdapter.createElement(currentDocument.id, currentLayer.id, newElement, path);
                return descriptor.playObject(createObj);
            }).then(function () {
                // FIXME: Find a way around this update Document
                this.flux.actions.documents.updateDocument();
            }).then(function () {
                var payload = {
                    library: currentLibrary,
                    element: newElement,
                    document: currentDocument,
                    layers: currentLayer
                };
                // WE ONLY LINK IF THE LAYER WAS A SMART OBJECT
                return this.dispatchAsync(events.libraries.ELEMENT_CREATED_AND_LINKED, payload);
            });
    };
    createElementFromSelectedLayer.reads = [locks.JS_DOC, locks.JS_LIBRARIES, locks.CC_LIBRARIES];
    createElementFromSelectedLayer.writes = [locks.JS_LIBRARIES];

    /**
     * Places the selected asset in the document as a cloud linked smart object
     *  - Gets the path to the content from libraries
     *  - Sends the path to Photoshop with a place command
     *
     * Right now, this only works with image assets, for other types of assets we'll need
     * different actions and handlers.
     *
     * @param {AdobeLibraryElement} element
     *
     * @return {Promise}
     */
    var createLayerFromElement = function (element) {
        var appStore = this.flux.store("application"),
            libStore = this.flux.store("library"),
            currentDocument = appStore.getCurrentDocument(),
            currentLibrary = libStore.getCurrentLibrary();

        if (!currentDocument || !currentLibrary) {
            return Promise.resolve();
        }

        var docRef = docAdapter.referenceBy.id(currentDocument.id),
            location = { x: 100, y: 100 },
            representation = element.getPrimaryRepresentation();

        return Promise.fromNode(function (cb) {
            representation.getContentPath(cb);
        }).then(function (path) {
            var placeObj = libraryAdapter.placeElement(docRef, element, path, location);

            return descriptor.playObject(placeObj);
        });
    };
    createLayerFromElement.reads = [locks.JS_LIBRARIES, locks.JS_DOC];
    createLayerFromElement.writes = [locks.JS_LIBRARIES, locks.JS_DOC];

    /**
     * Marks the given library ID as the active one
     *
     * @param {string} id
     *
     * @return {Promise}
     */
    var selectLibrary = function (id) {
        return this.dispatchAsync(events.libraries.LIBRARY_SELECTED, { id: id });
    };
    selectLibrary.reads = [];
    selectLibrary.writes = [locks.JS_LIBRARIES];

    /**
     * Creates a new library with the given name
     *
     * @param {string} name
     * @return {Promise.<Library>} Resolves to the created library
     */
    var createLibrary = function (name) {
        var libStore = this.flux.store("library"),
            libraryCollection = libStore.getLibraryCollection(),
            newLibrary = libraryCollection.createLibrary(name);

        return this.dispatchAsync(events.libraries.LIBRARY_CREATED, { library: newLibrary })
            .then(function () {
                return newLibrary;
            });
    };
    createLibrary.reads = [];
    createLibrary.writes = [locks.CC_LIBRARIES, locks.JS_LIBRARIES];

    /** 
     * Removes the current library from the collection
     *
     * @return {Promise}
     */
    var removeCurrentLibrary = function () {
        var libStore = this.flux.store("library"),
            libraryCollection = libStore.getLibraryCollection(),
            currentLibrary = libStore.getCurrentLibrary();

        if (!libraryCollection || !currentLibrary) {
            return Promise.resolve();
        }

        var payload = {
            id: currentLibrary.id
        };

        return Promise.fromNode(function (cb) {
            libraryCollection.removeLibrary(currentLibrary, cb);
        }).bind(this).then(function () {
            return this.dispatchAsync(events.libraries.LIBRARY_REMOVED, payload);
        });
    };
    removeCurrentLibrary.reads = [locks.CC_LIBRARIES, locks.JS_LIBRARIES];
    removeCurrentLibrary.writes = [locks.CC_LIBRARIES, locks.JS_LIBRARIES];

    var beforeStartup = function () {
        var preferences = this.flux.store("preferences").getState(),
            librariesEnabled = preferences.get("librariesEnabled", false);

        if (!librariesEnabled) {
            return Promise.resolve();
        }

        var dependencies = {
            // Photoshop on startup will grab the port of the CC Library process and expose it to us
            vulcanCall: function (requestType, requestPayload, responseType, callback) {
                descriptor.getProperty("application", "designSpaceLibrariesIMSInfo")
                    .then(function (imsInfo) {
                        var port = imsInfo.port;

                        callback(JSON.stringify({ port: port }));
                    });
            }
        };

        // SHARED_LOCAL_STORAGE flag forces websocket use
        CCLibraries.configure(dependencies, {
            SHARED_LOCAL_STORAGE: true,
            ELEMENT_TYPE_FILTERS: [
                "application/vnd.adobe.element.color+dcx",
                "application/vnd.adobe.element.image+dcx",
                "application/vnd.adobe.element.characterstyle+dcx",
                "application/vnd.adobe.element.layerstyle+dcx"
            ]
        });

        return Promise.resolve();
    };
    beforeStartup.reads = [];
    beforeStartup.writes = [locks.JS_LIBRARIES];

    /**
     * After startup, load the libraries
     *
     * @return {Promise}
     */
    var afterStartup = function () {
        var preferences = this.flux.store("preferences").getState(),
            librariesEnabled = preferences.get("librariesEnabled", false);

        if (!librariesEnabled) {
            return Promise.resolve();
        }

        var libraryCollection = CCLibraries.getLoadedCollections();

        if (!libraryCollection || !libraryCollection[0]) {
            return this.dispatchAsync(events.libraries.CONNECTION_FAILED);
        }

        // FIXME: Do we eventually need to handle other collections?
        var payload = {
            libraries: libraryCollection[0].libraries,
            collection: libraryCollection[0]
        };
        return this.dispatchAsync(events.libraries.LIBRARIES_UPDATED, payload);
    };
    afterStartup.reads = [locks.JS_LIBRARIES];
    afterStartup.writes = [locks.JS_LIBRARIES];


    exports.beforeStartup = beforeStartup;
    exports.afterStartup = afterStartup;
    
    exports.createLibrary = createLibrary;
    exports.selectLibrary = selectLibrary;
    exports.removeCurrentLibrary = removeCurrentLibrary;

    exports.createElementFromSelectedLayer = createElementFromSelectedLayer;
    exports.createLayerFromElement = createLayerFromElement;
});