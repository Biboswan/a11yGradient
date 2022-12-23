chrome.devtools.panels.create("A11y Gradient", "../assets/logo/icon16.png", "html/devtools.html");

const evalString = "$0.style.backgroundColor = 'red'";

function handleError(error) {
  if (error.isError) {
    console.log(`Devtools error: ${error.code}`);
  } else {
    console.log(`JavaScript error: ${error.value}`);
  }
}

let tabId;

chrome.tabs.query({currentWindow: true, active: true}, function(tabs){
    console.log('tabId',tabs[0].id);
    tabId=tabs[0].id;
});

function colorBorder (value) {
    console.log('qwwe',value);
    document.body.style.border = `${value}px solid green`;
}

async function handleMarker(e) {
    const { value } = e.target;
    console.log('val',value);
    console.log('chrome',chrome);
    //console.log('browser',browser);
    chrome.scripting.executeScript({
          target: {
            tabId,
          },
          args: [value],
          func: colorBorder
},(res,error) => { 
    console.log('err',error);
 });
}

document.querySelector('.marker-input').addEventListener('change',handleMarker);

const A11Y_CONTEXT = 'A11Y_CONTEXT';
const PANEL_INIT = `${A11Y_CONTEXT}_PANEL_INIT`;
const PANEL_REGISTER_FRAME = `${A11Y_CONTEXT}_REGISTER_FRAME`;
const UPDATE_SELECTED_ELEMENT = `${A11Y_CONTEXT}_UPDATE_SELECTED_ELEMENT`;

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
            const { selectedElement } = msg;
            updateElementSelected(selectedElement);
            break;
        }
    }
} );

// Announce to content.js that they should register with their frame urls.
port.postMessage( { type: PANEL_INIT } );

function updateElementSelected(node) {
    const elementDetails = document.querySelector('.element-selected');
    const closingTagIndex = node.indexOf('>');
    elementDetails.querySelector('summary').innerText=node.substr(0,closingTagIndex+1);
    elementDetails.querySelector('p').innerText=node.substring(closingTagIndex+1);
}
