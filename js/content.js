import ColorContrastChecker from 'color-contrast-checker';
import { messageTypes } from './common.js';

let _selectedElement;
let _markerGap = '15';
let _colorContrastType = 'text-color';
let contrastColor;
const COLOR_TRANSPARENT = ['rgba(0, 0, 0, 0)', 'transparent'];
let canvas;

let shouldRunContrast = 0;

const {
    PANEL_INIT,
    PANEL_REGISTER_FRAME,
    UPDATE_SELECTED_ELEMENT,
    SET_COLOR_CONTRAST,
    UPDATE_CONTRAST_COLOR,
    SET_MARKER_GAP,
    UPDATE_SHOULD_RUN_CONTRAST,
} = messageTypes;

const colorTypeToStyle = {
    'text-color': 'color',
    'text-border': '-webkit-text-stroke-color',
    'border-color': 'border-color',
};

const ccc = new ColorContrastChecker();

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
        console.log('c', color);
        if (color && !COLOR_TRANSPARENT.includes(color)) {
            return { element, backgroundColor: color };
        }

        color = w.getComputedStyle(element).getPropertyValue('background-image');
        console.log('c', color);
        if (color !== 'none') {
            return { element, backgroundImage: color };
        }
        element = element.parentElement;
    }
    return null;
}

function createMessageForSelectedElement(element) {
    if (!element || element.nodeType !== 1) {
        return { type: UPDATE_SELECTED_ELEMENT, selectedElement: {} };
    }

    console.log('UPDATE_SELECTED_ELEMENT', element);
    return {
        type: UPDATE_SELECTED_ELEMENT,
        selectedElement: element.outerHTML,
        color: contrastColor,
    };
}

function setSelectedElement(element) {
    if (!element) return;
    // If the selected element is the same, let handlers in other iframe contexts handle it instead.
    if (_selectedElement === undefined || element !== _selectedElement) {
        _selectedElement = element;
        contrastColor = colorForElement(_selectedElement, colorTypeToStyle[_colorContrastType]);
        console.log('contrast', contrastColor);
        chrome.runtime.sendMessage(createMessageForSelectedElement(element));
    }
}

function setColorContrastType(colorContrastType) {
    _colorContrastType = colorContrastType;
    if (!_selectedElement) return;

    switch (_colorContrastType) {
        case 'text-color':
            contrastColor = colorForElement(_selectedElement, colorTypeToStyle['text-color']);
            break;
        case 'text-border':
            contrastColor = colorForElement(
                _selectedElement,
                colorTypeToStyle['-webkit-text-stroke-color']
            );
            break;
        case 'element-border':
            contrastColor = colorForElement(_selectedElement, colorTypeToStyle['border-color']);
            break;
    }
}

function setMarkerGap(markerGap) {
    _markerGap = markerGap;
}

function getOffset(el) {
    const rect = el.getBoundingClientRect();
    return {
        left: rect.left + window.scrollX,
        top: rect.top + window.scrollY,
    };
}

function findColorContrastRatios(canvas) {
    const gap = Number.parseInt(_markerGap);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let xmax = canvas.width;
    let ymax = canvas.height;
    const contrastRatios = [];
    const w = _selectedElement?.ownerDocument.defaultView;
    const fontSize = w.getComputedStyle(_selectedElement).getPropertyValue('font-size');
    console.log('fs', fontSize);
    for (let y = 0; y <= ymax; y = y + gap) {
        contrastRatios.push([]);
        let lastIndex = contrastRatios.length - 1;
        for (let x = 0; x <= xmax; x = x + gap) {
            const [r, g, b, a] = ctx.getImageData(x, y, 1, 1).data;
            console.log('r', r);
            contrastRatios[lastIndex].push([r, g, b, a]);
        }
    }
    console.log(contrastRatios);
    return contrastRatios;
}

function play() {
    shouldRunContrast = 1;
    const { element: parentBgElement, backgroundColor, backgroundImage } =
        _colorContrastType !== 'element-border'
            ? findBgElement(_selectedElement)
            : findBgElement(_selectedElement.parentElement);
    canvas = document.createElement('canvas');
    const sourceWidth = parentBgElement.clientWidth;
    const sourceHeight = parentBgElement.clientHeight;

    canvas.width = sourceWidth;
    canvas.height = sourceHeight;
    canvas.style.height = sourceHeight + 'px';
    canvas.style.width = sourceWidth + 'px';
    if (backgroundColor) {
        console.log('bg', backgroundColor);
        canvas.style.backgroundColor = backgroundColor;
    } else {
        console.log('bg', backgroundImage);
        canvas.style.backgroundImage = backgroundImage;
    }

    const contrastRatios = findColorContrastRatios(canvas);
    // const { left, top } = getOffset(parentBgElement);
}

function reset() {
    shouldRunContrast = 0;
}

chrome.runtime.onMessage.addListener(function (message) {
    switch (message.type) {
        case PANEL_INIT:
            console.log('init');
            chrome.runtime.sendMessage({ type: PANEL_REGISTER_FRAME, url: window.location.href });
            break;
        case SET_COLOR_CONTRAST:
            console.log('SET_COLOR_CONTRAST', message.value);
            setColorContrastType(message.value);
            chrome.runtime.sendMessage({ type: UPDATE_CONTRAST_COLOR, color: contrastColor });
            break;
        case SET_MARKER_GAP:
            setMarkerGap(message.value);
            break;
        case UPDATE_SHOULD_RUN_CONTRAST:
            const { image } = message;
            if (image) {
                play();
            } else {
                reset();
            }
            break;
    }
});

/* 
Webpack changes the name of the function and also is scoped inside an IIFE.
Hence chrome.devtools.inspectedWindow in devtools was not able to call this function 
*/
window.setSelectedElement = setSelectedElement;
