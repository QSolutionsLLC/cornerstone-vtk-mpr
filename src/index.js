import cornerstone from 'cornerstone-core';
//
import setupCornerstone from './setupCornerstone.js';
import appState from './appState.js';
import getUrlForImageId from './lib/getUrlForImageId.js';
import getMprUrl from './lib/getMprUrl.js';

import { mat4 } from 'gl-matrix';

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
    //const coronalMprUrl = getMprUrl(1, 0, 0);
    //const sagittalMprUrl = getMprUrl(2, 0, 0);

    // ~~ AXIAL
    // Image orientation patient (IOP)
    const axial = mat4.create();
    const axialIop = new Float32Array([
        axial[0], axial[1], axial[2],
        axial[4], axial[5], axial[6]
    ]);
    const axialIopAsString = axialIop.join();
    const axialIppAsString = "";

    const axialMprUrl = getMprUrl(axialIopAsString, axialIppAsString);
    console.log('axialMprImageUrl: ', axialMprUrl)
    
    cornerstone.loadAndCacheImage(axialMprUrl).then(image => {
        cornerstone.displayImage(mprAxialSeriesElement, image);
    });

    // ~~ CORONAL
    // Image orientation patient (IOP)
    const coronalIop = new Float32Array([
        1, 0, 0,
        0, 0, -1
    ]);
    const coronalIopAsString = coronalIop.join();
    const coronalIppAsString = "";

    const coronalMprUrl = getMprUrl(coronalIopAsString, coronalIppAsString);
    console.log('coronalMprImageUrl: ', coronalMprUrl)

    cornerstone.loadAndCacheImage(coronalMprUrl).then(image => {
        cornerstone.displayImage(mprCoronalSeriesElement, image);
    });


    // ~~ SAGITTAL
    // Image orientation patient (IOP)
    const sagittalIop = new Float32Array([
        0, 1, 0,
        0, 0, -1
    ]);
    const sagittalIopAsString = sagittalIop.join();
    const sagittalIppAsString = "";

    const sagittalMprUrl = getMprUrl(sagittalIopAsString, sagittalIppAsString);
    console.log('sagittalMprImageUrl: ', sagittalMprUrl)

    cornerstone.loadAndCacheImage(sagittalMprUrl).then(image => {
        cornerstone.displayImage(mprSagittalSeriesElement, image);
    });
}

kickstartApp();



// const _planeAxes = [
//     // Axial
//     // 1, 0, 0, 0,
//     // 0, 1, 0, 0,
//     // 0, 0, 1, 0,
//     // 0, 0, 0, 1   // 0, 1, slice
//     mat4.create(),
//     // Coronal
//     mat4.fromValues(
//         1, 0, 0, 0,
//         0, 0, -1, 0,
//         0, 1, 0, 0,
//         0, 0, 0, 1), // 0, slice, 2
//     // Sagittal
//     mat4.fromValues(
//         0, 1, 0, 0, 
//         0, 0, -1, 0,
//         -1, 0, 0, 0,
//         0, 0, 0, 1), // slice, 1, 2 
//     // Oblique
//     mat4.fromValues(
//         1, 0, 0, 0,
//         0, 0.866025, 0.5, 0,
//         0, -0.5, 0.866025, 0,
//         0, 0, 0, 1) // 0, 1, 2
// ]