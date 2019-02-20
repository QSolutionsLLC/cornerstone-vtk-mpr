import * as cornerstone from 'cornerstone-core';
import { import as csTools } from 'cornerstone-tools';

import getMprUrl from './lib/getMprUrl.js';

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
    //

    const image = cornerstone.getImage(element)
    const imagePlane = cornerstone.metaData.get('imagePlaneModule', image.imageId)

    // TODO: Best way to determine increment?
    // TODO: Add key+value to MPR image's `imagePlaneModule` in `createMprSlice`
    // TODO: Best way to determine IPP bounds?
    const ipp = direction > 0 
      ? imagePlane.imagePositionPatient.map(x => x + 1.5)
      : imagePlane.imagePositionPatient.map(x => x - 1.5)
    
    const iopString = imagePlane.rowCosines.concat(imagePlane.columnCosines).join()
    const ippString = new Float32Array(ipp).join()
    const mprImageUrl = getMprUrl(iopString, ippString);

    cornerstone.loadAndCacheImage(mprImageUrl).then(image => {
        cornerstone.displayImage(element, image);
    })
  }
}