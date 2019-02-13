// Song & dance
import Hammer from "hammerjs";
import dicomParser from "dicom-parser";
import * as cornerstone from "cornerstone-core";
import * as cornerstoneMath from "cornerstone-math";
import * as cornerstoneWADOImageLoader from "cornerstone-wado-image-loader";
import * as cornerstoneTools from "cornerstone-tools";

//
import mprImageLoader from './mprImageLoader.js'
import appState from './appState.js';

export default function() {

    _setPeerDependencies();
    _initWadoImageLoader();
    _initCornerstoneTools();
    cornerstone.registerImageLoader('mpr', mprImageLoader)

    const originalSeriesElement = document.getElementById("cornerstone-target");
    const mprSeriesElement = document.getElementById("mpr-target");
    
    cornerstone.enable(originalSeriesElement, {
        renderer: "webgl"
    });

    cornerstone.enable(mprSeriesElement, {
        renderer: "webgl"
    });
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

    const WwwcTool = cornerstoneTools.WwwcTool;
    // const OverlayTool = cornerstoneTools.OverlayTool;
    cornerstoneTools.addTool(WwwcTool);
    // cornerstoneTools.addTool(OverlayTool);

    cornerstoneTools.setToolActive("Wwwc", { mouseButtonMask: 1 });
    // cornerstoneTools.setToolEnabled("Overlay", {});
}