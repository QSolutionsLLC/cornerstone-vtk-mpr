// Song & dance
import Hammer from "hammerjs";
import dicomParser from "dicom-parser";
import * as cornerstone from "cornerstone-core";
import * as cornerstoneMath from "cornerstone-math";
import * as cornerstoneWADOImageLoader from "cornerstone-wado-image-loader";
import * as cornerstoneTools from "cornerstone-tools";


export default function() {

    _setPeerDependencies();
    _initWadoImageLoader();
    _initCornerstoneTools();

    const element = document.getElementById("cornerstone-target");
    
    cornerstone.enable(element, {
        renderer: "webgl"
    });

    const scheme = 'wadouri';
    const base = 'http://localhost:9000/studies';
    const studyNumber = 0;
    const instanceId = '1.2.276.0.2783747.3.1884891181217187201810190834285294.100.1.dcm';

    const imageId = `${scheme}:${base}/${studyNumber}/${instanceId}`

    cornerstone.loadImage(imageId).then(image => {
        cornerstone.displayImage(element, image);
    });

    // cornerstone.registerImageLoader('mpr', loadMprImage)
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