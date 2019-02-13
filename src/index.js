import setupCornerstone from './setupCornerstone.js';
import appState from './appState.js';
import createVtkImageDataObject from './createVtkImageDataObject.js';

async function kickstartApp(){

    setupCornerstone();

    const seriesNumber = 0;
    const seriesIds = appState.studies[seriesNumber];

    const vtkVolume = await createVtkImageDataObject(seriesIds);
    console.log('vtkVolume: ', vtkVolume);
}

kickstartApp();