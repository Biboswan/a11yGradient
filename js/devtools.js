chrome.devtools.panels.create("A11y Gradient", "../assets/logo/icon16.png", "html/devtools.html");

const evalString = "$0.style.backgroundColor = 'red'";

const A11Y_CONTEXT = 'A11Y_CONTEXT';
const PANEL_INIT = `${A11Y_CONTEXT}_PANEL_INIT`;
const PANEL_REGISTER_FRAME = `${A11Y_CONTEXT}_REGISTER_FRAME`;
const UPDATE_SELECTED_ELEMENT = `${A11Y_CONTEXT}_UPDATE_SELECTED_ELEMENT`;
const SET_COLOR_CONTRAST = `${A11Y_CONTEXT}_SET_COLOR_CONTRAST`;
const UPDATE_CONTRAST_COLOR = `${A11Y_CONTEXT}_UPDATE_CONTRAST_COLOR`;
const SET_MARKER_GAP = `${A11Y_CONTEXT}_SET_MARKER_GAP`;
const UPDATE_SHOULD_RUN_CONTRAST = `${A11Y_CONTEXT}_UPDATE_SHOULD_RUN_CONTRAST`;
let tabId;

chrome.tabs.query({currentWindow: true, active: true}, function(tabs){
    console.log('tabId',tabs[0].id);
    tabId=tabs[0].id;
});

function handleError(error) {
  if (error.isError) {
    console.log(`Devtools error: ${error.code}`);
  } else {
    console.log(`JavaScript error: ${error.value}`);
  }
}


function colorBorder (value) {
    console.log('qwwe',value);
    document.body.style.border = `${value}px solid green`;
}

function updateElementSelected(node) {
    const elementDetails = document.querySelector('.element-selected');
    const closingTagIndex = node.indexOf('>');
    elementDetails.querySelector('summary').innerText=node.substr(0,closingTagIndex+1);
    elementDetails.querySelector('p').innerText=node.substring(closingTagIndex+1);
}

function updateContrastColor(color) {
    const container = document.querySelector(".contrast-color-display-container");
    const displayBox = document.querySelector("#contrast-color-display");
    const displayBoxLabel = document.querySelector("#contrast-color-display-label");
    displayBox.style.backgroundColor  = color;
    displayBoxLabel.innerText = color;
    container.style.display = 'flex';
}

function handleChangeContrastAgainst(e) {
    port.postMessage( { type: SET_COLOR_CONTRAST, value: e.target.value } );
}

function handleReset(e) {
    port.postMessage( { type: UPDATE_SHOULD_RUN_CONTRAST, value: false } );
}

function handlePlay(e) {
    port.postMessage( { type: UPDATE_SHOULD_RUN_CONTRAST, value: true } );
}

document.querySelector('.marker-input').addEventListener('change',handleMarker);
document.querySelector('#color-contrast-radioContainer').addEventListener('change', handleChangeContrastAgainst);
document.querySelector('.reset').addEventListener('click',handleReset);
document.querySelector('.play').addEventListener('click',handlePlay);

async function handleMarker(e) {
    const { value } = e.target;
    port.postMessage( { type: SET_MARKER_GAP, value } );
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

const port = chrome.runtime.connect( { name: A11Y_CONTEXT } );
port.onMessage.addListener( function ( msg ) {
    switch (msg.type) {
        case PANEL_REGISTER_FRAME: {
            // Each frame should listen to onSelectionChanged events.
            chrome.devtools.panels.elements.onSelectionChanged.addListener(
                () => {
                    chrome.devtools.inspectedWindow.eval( "setSelectedElement($0)", {
                        useContentScriptContext: true,
                        frameURL: msg.url
                    } );
                }
            );
            // Populate initial opening.
            chrome.devtools.inspectedWindow.eval( "setSelectedElement($0)", {
                useContentScriptContext: true,
                frameURL: msg.url
            } );
            break;
        }

        case UPDATE_SELECTED_ELEMENT: {
            const { selectedElement, color } = msg;
            updateElementSelected(selectedElement);
            updateContrastColor(color);
            break;
        }

        case UPDATE_CONTRAST_COLOR:  {
            const { color  } = msg;
            updateContrastColor(color);
            break;
        }
    }
} );

// Announce to content.js that they should register with their frame urls.
port.postMessage( { type: PANEL_INIT } );
