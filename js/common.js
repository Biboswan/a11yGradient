export const A11Y_CONTEXT = 'A11Y_CONTEXT';
const PANEL_INIT = `${A11Y_CONTEXT}_PANEL_INIT`;
const PANEL_REGISTER_FRAME = `${A11Y_CONTEXT}_REGISTER_FRAME`;
const UPDATE_SELECTED_ELEMENT = `${A11Y_CONTEXT}_UPDATE_SELECTED_ELEMENT`;
const SET_COLOR_CONTRAST = `${A11Y_CONTEXT}_SET_COLOR_CONTRAST`;
const UPDATE_CONTRAST_COLOR = `${A11Y_CONTEXT}_UPDATE_CONTRAST_COLOR`;
const SET_MARKER_GAP = `${A11Y_CONTEXT}_SET_MARKER_GAP`;
const UPDATE_SHOULD_RUN_CONTRAST = `${A11Y_CONTEXT}_UPDATE_SHOULD_RUN_CONTRAST`;
const UPDATE_MARKER_HOVERED = `${A11Y_CONTEXT}_UPDATE_MARKER_HOVERED`;
const UPDATE_CONTRAST_SPECTRUM_GRAPH = `${A11Y_CONTEXT}_UPDATE_CONTRAST_SPECTRUM_GRAPH`; 

export const messageTypes = {
    PANEL_INIT,
    PANEL_REGISTER_FRAME,
    UPDATE_SELECTED_ELEMENT,
    SET_COLOR_CONTRAST,
    UPDATE_CONTRAST_COLOR,
    SET_MARKER_GAP,
    UPDATE_SHOULD_RUN_CONTRAST,
    UPDATE_MARKER_HOVERED,
    UPDATE_CONTRAST_SPECTRUM_GRAPH
};

export const getPortName = id => `${A11Y_CONTEXT}:${id}`;

export function isLargeFont(fontSize, fontWeight) {
    const boldWeights = ['bold', 'bolder', '600', '700', '800', '900'];

    const fontSizePx = parseFloat(fontSize.replace('px', ''));
    const isBold =
        boldWeights.indexOf(fontWeight) !== -1 || (!isNaN(fontWeight) && Number(fontWeight) >= 600);

    const fontSizePt = (fontSizePx * 72) / 96;
    if (isBold) {
        return fontSizePt >= 14;
    }
    return fontSizePt >= 18;
}

const contrastThresholds = {
    largeFont: { aa: 3.0, aaa: 4.5 },
    normalFont: { aa: 4.5, aaa: 7.0 },
};

export function getContrastThreshold(fontSize, fontWeight) {
    if (isLargeFont(fontSize, fontWeight)) {
        return contrastThresholds.largeFont;
    }
    return contrastThresholds.normalFont;
}
