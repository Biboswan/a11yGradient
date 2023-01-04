let _selectedElement;
let _markerGap='15';
let _colorContrastType='text-color';
let contrastColor;
const COLOR_TRANSPARENT = ['rgba(0,0,0,0)','transparent'];
let canvas;

let shouldRunContrast=0;

const A11Y_CONTEXT = 'A11Y_CONTEXT';
const PANEL_INIT = `${A11Y_CONTEXT}_PANEL_INIT`;
const PANEL_REGISTER_FRAME = `${A11Y_CONTEXT}_REGISTER_FRAME`;
const UPDATE_SELECTED_ELEMENT = `${A11Y_CONTEXT}_UPDATE_SELECTED_ELEMENT`;
const SET_COLOR_CONTRAST = `${A11Y_CONTEXT}_SET_COLOR_CONTRAST`;
const UPDATE_CONTRAST_COLOR = `${A11Y_CONTEXT}_UPDATE_CONTRAST_COLOR`;
const SET_MARKER_GAP = `${A11Y_CONTEXT}_SET_MARKER_GAP`;
const UPDATE_SHOULD_RUN_CONTRAST = `${A11Y_CONTEXT}_UPDATE_SHOULD_RUN_CONTRAST`;

const colorTypeToStyle = {
	'text-color':'color',
	'text-border': '-webkit-text-stroke-color',
	'border-color': 'border-color'
};

function colorForElement(element, what) {
    let color = null;
    let w = element.ownerDocument.defaultView;
    while (element) {
        color = w.getComputedStyle(element).getPropertyValue(what);
        if (color && !COLOR_TRANSPARENT.includes(color)) {
            break;
        }
        element = element.parentElement;
    }
    return color;
}

//Find the nearest parent element which decides its background color or background-image
function findBgElement(element) {
	let color = null;
    let w = element.ownerDocument.defaultView;
    while (element) {
        color = w.getComputedStyle(element).getPropertyValue('background-color');
        if (color && !COLOR_TRANSPARENT.includes(color)) {
            return { element, backgroundColor: color }
        }

		color = w.getComputedStyle(element).getPropertyValue('background-image');
		if (color!=='none') {
			return { element, backgroundImage: color }
		}
        element = element.parentElement;
    }
    return null;
}

function createMessageForSelectedElement(element) {
    if (!element || element.nodeType !== 1 ) {
		return { type: UPDATE_SELECTED_ELEMENT, selectedElement: {} };
	}

	return {
        type: UPDATE_SELECTED_ELEMENT,
        selectedElement: element.outerHTML,
		color: contrastColor
    };
}

function setSelectedElement(element) {
    // If the selected element is the same, let handlers in other iframe contexts handle it instead.
	if (_selectedElement === undefined || element !== _selectedElement) {
		_selectedElement = element;
		contrastColor = colorForElement(_selectedElement,colorTypeToStyle[_colorContrastType]);
		chrome.runtime.sendMessage(createMessageForSelectedElement(element));
	}
}

function setColorContrastType(colorContrastType) {
	_colorContrastType=colorContrastType;
	if (!selectedElement) return;

	switch(_colorContrastType) {
		case 'text-color':
			contrastColor = colorForElement(_selectedElement,colorTypeToStyle['text-color']);
			break;
		case 'text-border':
			contrastColor = colorForElement(_selectedElement,colorTypeToStyle['-webkit-text-stroke-color']);
			break;
		case 'element-border':
			contrastColor = colorForElement(_selectedElement,colorTypeToStyle['border-color']);
			break;
	}
}

function setMarkerGap(markerGap) {
	_markerGap=markerGap;
}

function getOffset(el) {
	const rect = el.getBoundingClientRect();
	return {
	  left: rect.left + window.scrollX,
	  top: rect.top + window.scrollY
	};
  }
  

function play() {
	shouldRunContrast=1;
	const { element: parentBgElement, backgroundColor, backgroundImage } = colorContrastType !=='element-border' ?
	findBgElement(_selectedElement) : findBgElement(_selectedElement.parentElement);
    canvas = document.createElement('canvas');
	const context = canvas.getContext('2d');

	const sourceWidth = parentBgElement.clientWidth;
    const sourceHeight = parentBgElement.clientHeight;

	canvas.width = sourceWidth;
    canvas.height = sourceHeight;
    canvas.style.height = sourceHeight + "px";
    canvas.style.width = sourceWidth + "px";
	if (backgroundColor) {
	 	canvas.style.backgroundColor = backgroundColor;
	} else {
		canvas.style.backgroundImage = backgroundImage;
	}
	// const { left, top } = getOffset(parentBgElement);
}

function reset() {
	shouldRunContrast=0;
}

chrome.runtime.onMessage.addListener(function ( message ) {
	switch(message.type) {
		case PANEL_INIT: 
			chrome.runtime.sendMessage( { type: PANEL_REGISTER_FRAME, url: window.location.href } );
			break;
		case SET_COLOR_CONTRAST:
			setColorContrastType(message.value);
			chrome.runtime.sendMessage( { type: UPDATE_CONTRAST_COLOR, color: contrastColor } );
			break;
		case SET_MARKER_GAP:
			setMarkerGap(message.value)
			break;
		case UPDATE_SHOULD_RUN_CONTRAST:
			const { value } = message;
			if (value===true) {
				play();
			} else {
				reset();
			}
			break;
	}
});
