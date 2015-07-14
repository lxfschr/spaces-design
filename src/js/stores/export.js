/*
 * Copyright (c) 2015 Adobe Systems Incorporated. All rights reserved.
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

    var Fluxxor = require("fluxxor"),
        Immutable = require("immutable");

    var DocumentExports = require("js/models/documentexports"),
        events = require("../events"),
        log = require("js/util/log");

    var ExportStore = Fluxxor.createStore({

        /**
         * Map of export assets, keyed by the document ID
         * @type {Immutable.Map<number, DocumentExports>}
         */
        _documentExportsMap: null,

        /**
         * Loads saved preferences from local storage and binds flux actions.
         */
        initialize: function () {
            this._documentExportsMap = new Immutable.Map();
            
            // TODO listen for delete doc/layer?
            this.bindActions(
                events.RESET, this._deleteExports,
                events.export.ASSET_CHANGED, this._assetUpdated,
                events.document.DOCUMENT_UPDATED, this._documentUpdated
            );
        },

        documentHasExports: function (documentID) {
            return this._documentExportsMap.has(documentID);
        },

        getDocumentExports: function (documentID) {
            return this._documentExportsMap.get(documentID);
        },

        _documentUpdated: function (payload) {
            var documentID = payload.document.documentID,
                documentExports = DocumentExports.fromDescriptors(payload);

            this._documentExportsMap = this._documentExportsMap.set(documentID, documentExports);
        },

        /**
         * Insert/Update export assets for the given document
         *
         * @see  models/DocumentExports
         * @private
         * @param {{documentID: !number, documentExports: DocumentExports}} payload 
         */
        _assetUpdated: function (payload) {
            log.debug("asset payload, %s", JSON.stringify(payload, null, "  "));
            var documentID = payload.documentID,
                documentExports = payload.documentExports;

            if (!documentID) {
                throw new Error ("Can not update an asset without a valid documentID (%s)", documentID);
            } else if (!documentExports || (!documentExports.rootExports && !documentExports.layerExportsMap)) {
                throw new Error ("Can not update an asset without a valid documentExports: %O", documentExports);
            }

            var curDocumentExports = this.getDocumentExports(documentID) || new DocumentExports(),
                nextDocumentExports = curDocumentExports.fancyMerge(documentExports);

            if (!curDocumentExports.equals(nextDocumentExports)) {
                this._documentExportsMap = this._documentExportsMap.set(documentID, nextDocumentExports);
                this.emit("change");
            }
        },

        _deleteExports: function () {
            this._documentExportsMap = new Immutable.Map();
        }
    });

    module.exports = ExportStore;
});
