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
    const mprAxialSeriesElement = document.getElementById("axial-target");
    const mprCoronalSeriesElement = document.getElementById("coronal-target");
    const mprSagittalSeriesElement = document.getElementById("sagittal-target");

    // Display original series
    const seriesImageIds = appState.series[seriesNumber];
    const imageUrl = getUrlForImageId(seriesImageIds[0]);

    cornerstone.loadAndCacheImage(imageUrl).then(image => {
        cornerstone.displayImage(originalSeriesElement, image);
    });

    // Display MPR Slice
    const axialMprUrl = getMprUrl(0, 0, 0);
    const coronalMprUrl = getMprUrl(1, 0, 0);
    const sagittalMprUrl = getMprUrl(2, 0, 0);
    
    cornerstone.loadAndCacheImage(axialMprUrl).then(image => {
        cornerstone.displayImage(mprAxialSeriesElement, image);
    });
    cornerstone.loadAndCacheImage(coronalMprUrl).then(image => {
        cornerstone.displayImage(mprCoronalSeriesElement, image);
    });
    cornerstone.loadAndCacheImage(sagittalMprUrl).then(image => {
        cornerstone.displayImage(mprSagittalSeriesElement, image);
    });
}

kickstartApp();