let _selectedElement;
const A11Y_CONTEXT_CONTENT = 'A11Y_CONTEXT_CONTENT';
const A11Y_CONTEXT = 'A11Y_CONTEXT';
const PANEL_INIT = `${A11Y_CONTEXT}_PANEL_INIT`;
const PANEL_REGISTER_FRAME = `${A11Y_CONTEXT}_REGISTER_FRAME`;
const UPDATE_SELECTED_ELEMENT = `${A11Y_CONTEXT}_UPDATE_SELECTED_ELEMENT`;

//const port = chrome.runtime.connect( { name: A11Y_CONTEXT_CONTENT } );

function createMessage(element) {
    console.log('elem',element);
    console.log('elem:',element.nodeType);
    if (!element || element.nodeType !== 1 ) {
		return { type: UPDATE_SELECTED_ELEMENT, selectedElement: {} };
	}
    console.log('elem:',element);
	return {
        type: UPDATE_SELECTED_ELEMENT,
        selectedElement: element.outerHTML,
    };
}

function setSelectedElement(element) {
    // If the selected element is the same, let handlers in other iframe contexts handle it instead.
	if (_selectedElement === undefined || element !== _selectedElement) {
		_selectedElement = element;
		chrome.runtime.sendMessage(createMessage(element));
	}
}

chrome.runtime.onMessage.addListener(function ( message ) {
	if ( message.type === PANEL_INIT) {
		chrome.runtime.sendMessage( { type: PANEL_REGISTER_FRAME, url: window.location.href } );
	}
} );
