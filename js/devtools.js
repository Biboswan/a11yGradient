import { messageTypes, getPortName } from './common.js';
import {SpectrumGraphBuilder } from './utils.js';

const {
    PANEL_INIT,
    PANEL_REGISTER_FRAME,
    UPDATE_SELECTED_ELEMENT,
    SET_COLOR_CONTRAST,
    UPDATE_CONTRAST_COLOR,
    SET_MARKER_GAP,
    UPDATE_SHOULD_RUN_CONTRAST,
    UPDATE_MARKER_HOVERED,
    UPDATE_CONTRAST_SPECTRUM_GRAPH
} = messageTypes;

let port, tabId, contrastColor;
let selectionChangedListeners = new Set();
let reconnectAttempts = 0;

const MAX_RECONNECT_ATTEMPTS = 3;

chrome.devtools.panels.create(
    'A11y Gradient',
    '../assets/logo/icon16.png',
    'html/devtools.html',
    onPanelCreate
);

// Cache DOM elements
const elements = {
    bgColor: document.querySelector('#hovered-bgColor'),
    cr: document.querySelector('#hovered-contrast-ratio'),
    hoverAA: document.querySelector('#hovered-aa'),
    hoverAAA: document.querySelector('#hovered-aaa'),
    markerInput: document.querySelector('.marker-input'),
    colorContrastRadio: document.querySelector('#color-contrast-radioContainer'),
    resetButton: document.querySelector('.reset'),
    playButton: document.querySelector('.play'),
    contrastGraph: document.querySelector('.contrast-graph')
};

const spectrumGraphBuilder = new SpectrumGraphBuilder(elements.contrastGraph);

async function getCurrentTab() {
    const queryOptions = { active: true, lastFocusedWindow: true };
    // `tab` will either be a `tabs.Tab` instance or `undefined`.
    const [tab] = await chrome.tabs.query(queryOptions);

    return tab;
}

function cleanupPort() {
    if (port) {
        port.onMessage.removeListener(handlePortMessage);
        port.disconnect();
        port = null;
    }
}

function handlePortMessage(msg) {
    switch (msg.type) {
        case PANEL_REGISTER_FRAME: {
            const onSelectionChanged = () => setSelectedElement(msg.url);
            chrome.devtools.panels.elements.onSelectionChanged.addListener(onSelectionChanged);
            selectionChangedListeners.add(onSelectionChanged);
            setSelectedElement(msg.url);
            break;
        }

        case UPDATE_SELECTED_ELEMENT: {
            const { selectedElement, color } = msg;
            updateElementSelected(selectedElement);
            updateContrastColor(color);
            break;
        }

        case UPDATE_CONTRAST_COLOR: {
            const { color } = msg;
            updateContrastColor(color);
            break;
        }

        case UPDATE_MARKER_HOVERED: {
            const { hex, WCAG_AA, WCAG_AAA, contrastRatio } = msg;
            updateMarkerHovered(hex, WCAG_AA, WCAG_AAA, contrastRatio);
            break;
        }

        case UPDATE_CONTRAST_SPECTRUM_GRAPH: {
            const { pixelColorAtMarkerPoint, accessibilityBackgroundBoundary, fontSize } = msg;
            updateContrastSpectrumGraph(pixelColorAtMarkerPoint, accessibilityBackgroundBoundary, fontSize);
            break;
        }
    }
}

function connectPort() {
    port = chrome.runtime.connect({ name: getPortName(tabId) });
    
    port.onDisconnect.addListener(() => {
        if (chrome.runtime.lastError || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            console.error('Port disconnected permanently');
            return;
        }
        reconnectAttempts++;
        setTimeout(connectPort, 1000 * reconnectAttempts); // Exponential backoff
    });

    port.onMessage.addListener(handlePortMessage);

    // Announce to content.js that they should register with their frame urls.
    port.postMessage({ type: PANEL_INIT });
}

async function onPanelCreate() {
    cleanupPort();
    
    tabId = (await getCurrentTab())?.id;
    if (!tabId) {
        console.error('No active tab found');
        return;
    }

    connectPort();
}

function updateMarkerHovered(hex, WCAG_AA, WCAG_AAA, contrastRatio) {
    elements.bgColor.style.backgroundColor = `#${hex}`;
    elements.cr.innerText = contrastRatio;
    elements.hoverAA.innerHTML = `<img src="${chrome.runtime.getURL('assets/icons/' + (WCAG_AA ? 'check.svg' : 'times.svg'))}"/>`;
    elements.hoverAAA.innerHTML = `<img src="${chrome.runtime.getURL('assets/icons/' + (WCAG_AAA ? 'check.svg' : 'times.svg'))}"/>`;
}

function updateElementSelected(node) {
    const elementDetails = document.querySelector('.element-selected');
    const closingTagIndex = node.indexOf('>');
    elementDetails.querySelector('summary').innerText = node.substr(0, closingTagIndex + 1);
    elementDetails.querySelector('p').innerText = node.substring(closingTagIndex + 1);
}

function updateContrastColor(color) {
    const container = document.querySelector('.contrast-color-display-container');
    const displayBox = document.querySelector('#contrast-color-display');
    const displayBoxLabel = document.querySelector('#contrast-color-display-label');
    displayBox.style.backgroundColor = color;
    displayBoxLabel.innerText = color;
    container.style.display = 'flex';
    contrastColor = color;
}

function handleChangeContrastAgainst(e) {
    port.postMessage({ type: SET_COLOR_CONTRAST, value: e.target.value });
}

function handleReset(e) {
    elements.bgColor.style.backgroundColor = 'transparent';
    elements.cr.innerHTML = '';
    elements.hoverAA.innerHTML = '';
    elements.hoverAAA.innerHTML = '';
    
    spectrumGraphBuilder.reset();
    
    port.postMessage({ type: UPDATE_SHOULD_RUN_CONTRAST, value: false });
}

function updateContrastSpectrumGraph(pixelColorAtMarkerPoint, accessibilityBackgroundBoundary, fontSize) {
    if (!accessibilityBackgroundBoundary || !pixelColorAtMarkerPoint) return;

    spectrumGraphBuilder.reset();
    spectrumGraphBuilder.createBaseGradient(contrastColor);
    spectrumGraphBuilder.setFontSize(fontSize);
    
    // Get boundary points and calculate scale factors
    const { 
        topLeft,
        topRight,
        bottomLeft,
    } = accessibilityBackgroundBoundary;
    
    // Filter points within boundary
    const boundaryPoints = pixelColorAtMarkerPoint.filter(pixel => {
        const { x, y } = pixel;
        return x >= topLeft.x && x <= topRight.x && 
               y >= topLeft.y && y <= bottomLeft.y;
    });

    const cacheColors = new Set();

    // Draw contrast lines for each color point
    boundaryPoints.forEach(pixel => {
        const { color } = pixel;
        if (cacheColors.has(color)) return;
        cacheColors.add(color);
        const { aa, aaa } = spectrumGraphBuilder.getContrastLines(color);
        
        // Draw AA line
        if (aa && aa.length > 0) {
            spectrumGraphBuilder.drawContrastLine(aa, 'rgba(255, 255, 255, 0.7)');
        }
        
        // Draw AAA line
        if (aaa && aaa.length > 0) {
            spectrumGraphBuilder.drawContrastLine(aaa, 'rgba(255, 255, 0, 0.7)');
        }
    });
}

function handlePlay(e) {
    port.postMessage({ type: UPDATE_SHOULD_RUN_CONTRAST, value: true });
}

function handleMarker(e) {
    const { value } = e.target;

    port.postMessage({ type: SET_MARKER_GAP, value });
}

function setSelectedElement(url) {
    chrome.devtools.inspectedWindow.eval(
        'setSelectedElement($0)',
        {
            useContentScriptContext: true,
            frameURL: url,
        },
        (err, info) => {
            err && console.error('err', err);
            info && console.log('info', info);
        }
    );
}

// Cleanup function to remove all listeners
function cleanup() {
    // Clean up port first
    cleanupPort();
    
    // Clean up selection change listeners
    if (selectionChangedListeners) {
        selectionChangedListeners.forEach(listener => {
            chrome.devtools.panels.elements.onSelectionChanged.removeListener(listener);
        });
        selectionChangedListeners.clear();
    }
    
    // Clean up DOM event listeners if elements exist
    if (elements) {
        elements.markerInput?.removeEventListener('change', handleMarker);
        elements.colorContrastRadio?.removeEventListener('change', handleChangeContrastAgainst);
        elements.resetButton?.removeEventListener('click', handleReset);
        elements.playButton?.removeEventListener('click', handlePlay);
    }

    // Reset canvas if it exists
    spectrumGraphBuilder.reset();
}

window.addEventListener('unload', cleanup);

window.addEventListener('DOMContentLoaded', () => {
    elements.markerInput?.addEventListener('change', handleMarker);
    elements.colorContrastRadio?.addEventListener('change', handleChangeContrastAgainst);
    elements.resetButton?.addEventListener('click', handleReset);
    elements.playButton?.addEventListener('click', handlePlay);
});
