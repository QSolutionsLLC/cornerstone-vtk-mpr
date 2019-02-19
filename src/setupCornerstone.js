// Song & dance
import Hammer from "hammerjs";
import dicomParser from "dicom-parser";
import * as cornerstone from "cornerstone-core";
import * as cornerstoneMath from "cornerstone-math";
import * as cornerstoneWADOImageLoader from "cornerstone-wado-image-loader";
import * as cornerstoneTools from "cornerstone-tools";

//
import appState from './appState.js';
import getUrlForImageId from './lib/getUrlForImageId.js';
import mprMetaDataProvider from './lib/mprMetadata/mprMetaDataProvider.js';
import mprImageLoader from './mprImageLoader.js'
import MprMouseWheelTool from './MprMouseWheelTool.js';

export default function(seriesNumber) {

    _setPeerDependencies();
    _initWadoImageLoader();
    _initCornerstoneTools();
    cornerstone.registerImageLoader('mpr', mprImageLoader)
    cornerstone.metaData.addProvider(mprMetaDataProvider);

    // Enable Elements
    const originalSeriesElement = document.getElementById("cornerstone-target");
    const mprAxialSeriesElement = document.getElementById("axial-target");
    const mprCoronalSeriesElement = document.getElementById("coronal-target");
    const mprSagittalSeriesElement = document.getElementById("sagittal-target");
    
    cornerstone.enable(originalSeriesElement, {
        renderer: "webgl"
    });

    cornerstone.enable(mprAxialSeriesElement, {
        renderer: "webgl"
    });

    cornerstone.enable(mprCoronalSeriesElement, {
        renderer: "webgl"
    });

    cornerstone.enable(mprSagittalSeriesElement, {
        renderer: "webgl"
    });

    _setOriginalSeriesStackState(seriesNumber, originalSeriesElement);

    // Element Specific Tools
    cornerstoneTools.setToolActiveForElement(originalSeriesElement, "StackScrollMouseWheel", {});
    cornerstoneTools.setToolActiveForElement(mprAxialSeriesElement, "MprMouseWheel", { plane: 0 });
    cornerstoneTools.setToolActiveForElement(mprCoronalSeriesElement, "MprMouseWheel", { plane: 1 });
    cornerstoneTools.setToolActiveForElement(mprSagittalSeriesElement, "MprMouseWheel", { plane: 2 });
}

function _setPeerDependencies(){
    cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
    cornerstoneWADOImageLoader.external.dicomParser = dicomParser;
    cornerstoneTools.external.cornerstoneMath = cornerstoneMath;
    cornerstoneTools.external.cornerstone = cornerstone;
    cornerstoneTools.external.Hammer = Hammer;
}

function _initWadoImageLoader(){
    const config = {
        webWorkerPath: '/assets/cornerstoneWADOImageLoaderWebWorker.js',
        taskConfiguration: {
            decodeTask: {
            codecsPath: '/assets/cornerstoneWADOImageLoaderCodecs.js'
            }
        }
    };
    
    cornerstoneWADOImageLoader.webWorkerManager.initialize(config);
}

function _initCornerstoneTools(){
    cornerstoneTools.init({
        globalToolSyncEnabled: true
    });

    // Grab Tool Classes
    const WwwcTool = cornerstoneTools.WwwcTool;
    const PanTool = cornerstoneTools.PanTool;
    const PanMultiTouchTool = cornerstoneTools.PanMultiTouchTool;
    const StackScrollMouseWheelTool = cornerstoneTools.StackScrollMouseWheelTool;
    const ZoomTool = cornerstoneTools.ZoomTool;
    const ZoomTouchPinchTool = cornerstoneTools.ZoomTouchPinchTool;
    const ZoomMouseWheelTool = cornerstoneTools.ZoomMouseWheelTool;

    // Add them
    cornerstoneTools.addTool(PanTool);
    cornerstoneTools.addTool(ZoomTool);
    cornerstoneTools.addTool(WwwcTool);
    cornerstoneTools.addTool(PanMultiTouchTool);
    cornerstoneTools.addTool(StackScrollMouseWheelTool);
    cornerstoneTools.addTool(ZoomTouchPinchTool);
    cornerstoneTools.addTool(ZoomMouseWheelTool);
    cornerstoneTools.addTool(MprMouseWheelTool);

    // Set tool modes
    cornerstoneTools.setToolActive("Pan", { mouseButtonMask: 4 }); // Middle
    cornerstoneTools.setToolActive("Zoom", { mouseButtonMask: 2 }); // Right
    cornerstoneTools.setToolActive("Wwwc", { mouseButtonMask: 1 }); // Left & Touch
    cornerstoneTools.setToolActive("PanMultiTouch", {});
    cornerstoneTools.setToolActive("ZoomTouchPinch", {});
}

function _setOriginalSeriesStackState(seriesNumber, originalSeriesElement){
    const seriesImageIds = appState.series[seriesNumber];
    cornerstoneTools.addStackStateManager(originalSeriesElement, [
        'stack'
    ])
    const allImageIds = seriesImageIds.map(id => getUrlForImageId(id));

    const canvasStack = {
        currentImageIdIndex: 0,
        imageIds: allImageIds,
    }

    cornerstoneTools.clearToolState(originalSeriesElement, 'stack')
    cornerstoneTools.addToolState(originalSeriesElement, 'stack', canvasStack)

}