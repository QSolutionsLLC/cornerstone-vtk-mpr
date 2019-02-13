import cornerstone from 'cornerstone-core';
//
import setupCornerstone from './setupCornerstone.js';
import appState from './appState.js';
import getUrlForImageId from './lib/getUrlForImageId.js';
import getMprUrl from './lib/getMprUrl.js';

async function kickstartApp(){

    // Setup
    const seriesNumber = 0;
    setupCornerstone(seriesNumber);

    const originalSeriesElement = document.getElementById("cornerstone-target");
    const mprSeriesElement = document.getElementById("mpr-target");

    // Display original series
    const seriesImageIds = appState.series[seriesNumber];
    const imageUrl = getUrlForImageId(seriesImageIds[0]);

    cornerstone.loadAndCacheImage(imageUrl).then(image => {
        cornerstone.displayImage(originalSeriesElement, image);
    });

    // Display MPR Slice
    const mprUrl = getMprUrl(45);
    
    cornerstone.loadAndCacheImage(mprUrl).then(image => {
        cornerstone.displayImage(mprSeriesElement, image);
    })
}

kickstartApp();