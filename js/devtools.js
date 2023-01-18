import { messageTypes, getPortName } from './common.js';

const {
    PANEL_INIT,
    PANEL_REGISTER_FRAME,
    UPDATE_SELECTED_ELEMENT,
    SET_COLOR_CONTRAST,
    UPDATE_CONTRAST_COLOR,
    SET_MARKER_GAP,
    UPDATE_SHOULD_RUN_CONTRAST,
} = messageTypes;

let port, tabId;

chrome.devtools.panels.create(
    'A11y Gradient',
    '../assets/logo/icon16.png',
    'html/devtools.html',
    onPanelCreate
);

async function getCurrentTab() {
    const queryOptions = { active: true, lastFocusedWindow: true };
    // `tab` will either be a `tabs.Tab` instance or `undefined`.
    const [tab] = await chrome.tabs.query(queryOptions);

    return tab;
}

async function onPanelCreate() {
    tabId = (await getCurrentTab())?.id;
    if (!tabId) return;
    port = chrome.runtime.connect({ name: getPortName(tabId) });

    port.onMessage.addListener(function (msg) {
        switch (msg.type) {
            case PANEL_REGISTER_FRAME: {
                // Each frame should listen to onSelectionChanged events.
                console.log('PANEL_REGISTER_FRAME');
                chrome.devtools.panels.elements.onSelectionChanged.addListener(() =>
                    setSelectedElement(msg.url)
                );
                // Populate initial opening.
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
        }
    });

    // Announce to content.js that they should register with their frame urls.
    port.postMessage({ type: PANEL_INIT });
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
}

function handleChangeContrastAgainst(e) {
    port.postMessage({ type: SET_COLOR_CONTRAST, value: e.target.value });
}

function handleReset(e) {
    port.postMessage({ type: UPDATE_SHOULD_RUN_CONTRAST, value: false });
}

function handlePlay(e) {
    port.postMessage({ type: UPDATE_SHOULD_RUN_CONTRAST, value: true });
}

async function handleMarker(e) {
    const { value } = e.target;
    port.postMessage({ type: SET_MARKER_GAP, value });
    //     console.log('val',value);
    //     console.log('chrome',chrome);

    //     //console.log('browser',browser);
    //     chrome.scripting.executeScript({
    //           target: {
    //             tabId,
    //           },
    //           args: [value],
    //           func: colorBorder
    // },(res,error) => {
    //     console.log('err',error);
    //  });
}

function setSelectedElement(url) {
    console.log('abc', url);
    chrome.devtools.inspectedWindow.eval(
        'setSelectedElement($0)',
        {
            useContentScriptContext: true,
            frameURL: url,
        },
        (err, info) => {
            console.log('err', err);
            console.log('info', info);
        }
    );
}

window.addEventListener('DOMContentLoaded', () => {
    document.querySelector('.marker-input').addEventListener('change', handleMarker);
    document
        .querySelector('#color-contrast-radioContainer')
        .addEventListener('change', handleChangeContrastAgainst);
    document.querySelector('.reset').addEventListener('click', handleReset);
    document.querySelector('.play').addEventListener('click', handlePlay);
});
