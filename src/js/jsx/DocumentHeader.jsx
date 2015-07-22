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
        StoreWatchMixin = Fluxxor.StoreWatchMixin,
        classnames = require("classnames");
    
    var strings = require("i18n!nls/strings");

    var DocumentHeader = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("application", "document")],

        getInitialState: function () {
            return {};
        },

        /**
         * Get the active document from flux and add it to the state.
         */
        getStateFromFlux: function () {
            var applicationStore = this.getFlux().store("application"),
                applicationState = applicationStore.getState(),
                documentIDs = applicationState.documentIDs,
                document = applicationStore.getCurrentDocument(),
                count = applicationStore.getDocumentCount();

            return {
                document: document,
                documentIDs: documentIDs,
                count: count
            };
        },

        componentWillReceiveProps: function () {
            this.setState({
                headerWidth: React.findDOMNode(this).clientWidth
            });
        },

        componentDidMount: function () {
            var currentTab = window.document.querySelector(".document-title.current");
            if (currentTab) {
                currentTab.scrollIntoViewIfNeeded();
            }
        },
        
        componentDidUpdate: function () {
            var currentTab = window.document.querySelector(".document-title.current");
            if (currentTab) {
                currentTab.scrollIntoViewIfNeeded();
            }
        },

        _handleTabClick: function (documentID) {
            var selectedDoc = this.getFlux().store("document").getDocument(documentID);
            if (selectedDoc) {
                this.getFlux().actions.documents.selectDocument(selectedDoc);
            }
        },

        render: function () {
            var documentStore = this.getFlux().store("document"),
                document = this.state.document,
                warning = document && document.unsupported && (
                    <span
                        title={strings.TOOLTIPS.UNSUPPORTED_FEATURES}
                        className="document-controls__unsupported">
                        !
                    </span>
                );

            var containerClassName = classnames({
                "document-container": true,
                "document-container__withdoc": !!document
            });

            var tabStyles = {};

            // If we have lots of open documents, let's get back some space
            if (this.state.headerWidth / this.state.documentIDs.size < 60) {
                tabStyles.fontSize = "1.4rem";
                tabStyles.paddingLeft = "1rem";
            }
            
            var documentTabs = this.state.documentIDs.map(function (docID) {
                var doc = documentStore.getDocument(docID);
                return (
                    <div
                        className={classnames({
                            "document-title": true,
                            "current": docID === document.id
                        })}
                        style={tabStyles}
                        title={doc.name}
                        key={"docheader" + docID}
                        onClick={this._handleTabClick.bind(this, docID)}>
                        {doc.dirty ? "•" : ""}
                        {doc.name}
                        {warning}
                    </div>
                );
            }, this);

            return (
                <div className={containerClassName} >
                    <div className="document-header" ref="tabContainer">
                            {documentTabs}
                    </div>
                </div>
            );
        }
    });

    module.exports = DocumentHeader;
});
