import * as cornerstone from 'cornerstone-core';
import { import as csTools, store } from 'cornerstone-tools';
import getMprUrl from './lib/getMprUrl.js';
import { vec3 } from 'gl-matrix';

const BaseTool = csTools('base/BaseTool')

/**
 * @public
 * @class MprMouseWheelTool
 * @memberof Tools
 *
 * @classdesc Updates MPR degree rotation on scroll
 * @extends Tools.Base.BaseTool
 */
export default class MprMouseWheelTool extends BaseTool {
  constructor(configuration = {}) {
    const defaultConfig = {
      name: 'MprMouseWheel',
      supportedInteractionTypes: ['MouseWheel'],
    };
    const initialConfiguration = Object.assign(defaultConfig, configuration);

    super(initialConfiguration);

    this.initialConfiguration = initialConfiguration;
  }

  mouseWheelCallback(evt) {
    const { direction: images, element } = evt.detail;
    const { loop, allowSkipping, invert } = this.configuration;
    const direction = invert ? -images : images;
    const dir = direction > 0 ? 1 : -1;
    //

    const image = cornerstone.getImage(element)
    const imagePlane = cornerstone.metaData.get('imagePlaneModule', image.imageId)

    // TODO: Use pixel spacing to determine best "step size"
    // Ideally, minimum value where we would see pixel change
    const stepSize = 1.5;
    const iop = imagePlane.imageOrientationPatient
    const rowCosines = vec3.fromValues(iop[0], iop[1], iop[2])
    const colCosines = vec3.fromValues(iop[3], iop[4], iop[5])
    let zedCosines = vec3.create();

    vec3.cross(zedCosines, rowCosines, colCosines)

    // Update position in the Zed direction
    let ipp = imagePlane.imagePositionPatient.slice();
    ipp[0] = ipp[0] + (zedCosines[0] * stepSize * dir);
    ipp[1] = ipp[1] + (zedCosines[1] * stepSize * dir);
    ipp[2] = ipp[2] + (zedCosines[2] * stepSize * dir);

    const iopString = imagePlane.rowCosines.concat(imagePlane.columnCosines).join()
    const ippString = new Float32Array(ipp).join()
    const mprImageUrl = getMprUrl(iopString, ippString);

    cornerstone.loadAndCacheImage(mprImageUrl).then(image => {
        cornerstone.displayImage(element, image);
        _updateAllMprEnabledElements();
    })
  }
}

/**
 *
 *
 */
function _updateAllMprEnabledElements(){
  store.state.enabledElements.forEach(refElement => {
    const refImage = cornerstone.getImage(refElement)

    if(refImage && refImage.imageId.includes('mpr')){
      cornerstone.updateImage(refElement);
    }
  });
}