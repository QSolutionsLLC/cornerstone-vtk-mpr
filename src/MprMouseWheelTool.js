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

    this.rotation = 45;
  }

  mouseWheelCallback(evt) {
    const { direction: images, element } = evt.detail;
    const { loop, allowSkipping, invert } = this.configuration;
    const direction = invert ? -images : images;

    if(direction > 0){
        this.rotation++;
        if(this.rotation >= 360) { this.rotation = 0; }
    }else{
        this.rotation--;
        if(this.rotation < 0){ this.rotation = 359; }
    }

    const imageUrl = getMprUrl(this.rotation)
    cornerstone.loadAndCacheImage(imageUrl).then(image => {
        cornerstone.displayImage(element, image);
        // Slices are coming out with different heights
        // This adjust viewport to fit image
        cornerstone.reset(element); 
    })

    // const viewport = cornerstone.getViewport(element);
    // console.log(viewport);
  }
}