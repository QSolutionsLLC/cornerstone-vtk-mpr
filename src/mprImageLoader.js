import createMprSlice from './lib/vtk/createMprSlice.js';
import tryGetVtkVolumeForSeriesNumber from './lib/vtk/tryGetVtkVolumeForSeriesNumber.js';
import mapVtkSliceToCornerstoneImage from './lib/vtk/mapVtkSliceToCornerstoneImage.js';

export default function(imageId){
    const imageLoadObject = {
        promise: undefined,
        cancelFn: undefined,
        decacheData: undefined
    }

    imageLoadObject.promise = createImage(imageId);

    return imageLoadObject;
}

async function createImage(imageId){
    const [scheme, seriesNumber, degRotation] = imageId.split(':');
    const vtkVolume = await tryGetVtkVolumeForSeriesNumber(seriesNumber);

    const vtkSlice = createMprSlice(vtkVolume.vtkImageData, { rotation: degRotation });
    const mappedSlice = mapVtkSliceToCornerstoneImage(vtkSlice);

    const image = {
        imageId,
        color: false,
        columnPixelSpacing: mappedSlice.columnPixelSpacing, // 0.271484375,
        rowPixelSpacing: mappedSlice.rowPixelSpacing, // 0.271484375,
        columns: mappedSlice.columns,
        width: mappedSlice.width,
        height: mappedSlice.height,
        rows: mappedSlice.rows,
        intercept: 0, // -1024,
        invert: false,
        getPixelData: () => mappedSlice.pixelData,
        minPixelValue: mappedSlice.minPixelValue, // min,
        maxPixelValue: mappedSlice.maxPixelValue, // max,
        sizeInBytes: mappedSlice.sizeInBytes, // generatedImage.pixelData.length,
        slope: 1,
        windowCenter:  mappedSlice.windowCenter, // undefined,
        windowWidth: mappedSlice.windowWidth, // undefined,
        decodeTimeInMS: 0,
        floatPixelData: undefined,
        isMpr: true,
      };

    // set the ww/wc to cover the dynamic range of the image if no values are supplied
    if (image.windowCenter === undefined || image.windowWidth === undefined) {
        const maxVoi = image.maxPixelValue * image.slope + image.intercept
        const minVoi = image.minPixelValue * image.slope + image.intercept

        image.windowWidth = maxVoi - minVoi
        image.windowCenter = (maxVoi + minVoi) / 2
    }

    console.log('~~ CREATE IMAGE: ', image)

    return image;
}

/**
 * Calculate the minimum and maximum values in an Array
 *
 * @param {Number[]} storedPixelData
 * @return {{min: Number, max: Number}}
 */
function getMinMax (storedPixelData) {
    // we always calculate the min max values since they are not always
    // present in DICOM and we don't want to trust them anyway as cornerstone
    // depends on us providing reliable values for these
    let min = storedPixelData[0];
    let max = storedPixelData[0];
    let storedPixel;
    const numPixels = storedPixelData.length;
  
    for (let index = 1; index < numPixels; index++) {
      storedPixel = storedPixelData[index];
      min = Math.min(min, storedPixel);
      max = Math.max(max, storedPixel);
    }
  
    return {
      min,
      max
    };
  }
  