import * as cornerstone from 'cornerstone-core';
//
import vtkDataArray from 'vtk.js/Sources/Common/Core/DataArray';
import vtkImageData from 'vtk.js/Sources/Common/DataModel/ImageData';
//
import insertSlice from '../data/insertSlice.js';
import getUrlForImageId from '../getUrlForImageId.js';
import getSliceIndex from  '../data/getSliceIndex.js';
import determineOrientation from '../data/determineOrientation.js';
import computeZAxis from '../data/computeZAxis.js';
import crossVectors from '../math/crossVectors.js';
import tryGetMetadataModuleAsync from '../tryGetMetadataModuleAsync.js';

/**
 * Note: This builds the vtk structure we need to move forward, but it does so using
 * only metadata for image ids in the series we're trying to create a volume for. That
 * mean's it's possible to do this step without having loaded any image data if we have
 * an alternate means for acquiring metadata
 *
 * @export
 * @param {*} seriesImageIds
 * @returns
 */
export default async function(seriesImageIds){
    const metaDataMap = await _getSeriesMetaDataMap(seriesImageIds);
    const {
        dimensions,
        orientation,
        multiComponent,
        spacing,
        zAxis,
        origin
    } = _calculateDimensions(metaDataMap)

    if (multiComponent) {
        throw new Error('Multi component image not supported by this plugin.')
    }

    const imageData = await _createVtkVolume(seriesImageIds, dimensions, spacing, zAxis);
    const imageDataObject = {
        imageIds: seriesImageIds,
        orientation,
        vtkImageData: imageData,
        origin,
        zAxis
    }

    return imageDataObject;
}

async function _createVtkVolume(seriesImageIds, dimensions, spacing, zAxis){

    const vtkVolume = vtkImageData.newInstance()
    const typedPixelArray = await _getTypedPixelArray(seriesImageIds[0], dimensions);
    const scalarArray = vtkDataArray.newInstance({
        name: 'Pixels',
        numberOfComponents: 1,
        values: typedPixelArray
    })

    // TODO: Is this a better place to set this?
    vtkVolume.setOrigin(zAxis.origin)
    vtkVolume.setDimensions(dimensions)
    vtkVolume.setSpacing(spacing)
    vtkVolume.getPointData().setScalars(scalarArray)

    // Add our slices
    for(let i = 0; i < seriesImageIds.length; i++){
        const imageId = seriesImageIds[i];
        const imageUrl = getUrlForImageId(imageId);
        const image = await cornerstone.loadAndCacheImage(imageUrl);
        const { imagePositionPatient } = await tryGetMetadataModuleAsync('imagePlaneModule', imageId);
        const sliceIndex = getSliceIndex(zAxis, imagePositionPatient);

        insertSlice(vtkVolume, image.getPixelData(), sliceIndex);
    }

    // TODO: We can accidentally create multiple volumes if we try to create one
    // Before a request for the same series has completed.
    // (You'll notice this logs 3x -- one for each initial MPR canvas, but 0x after any load has finished)
    // console.log('~~~~~~~~~~ VTK VOLUME:', vtkVolume);
    return vtkVolume;
}

async function _getTypedPixelArray(imageId, dimensions){
    const imagePixelModule = await tryGetMetadataModuleAsync('imagePixelModule', imageId);
    const { bitsAllocated, pixelRepresentation } = imagePixelModule;
    const signed = pixelRepresentation === 1

    if (bitsAllocated === 8) {
        if (signed) {
            throw new Error('8 Bit signed images are not yet supported by this plugin.');
        } else {
            throw new Error('8 Bit unsigned images are not yet supported by this plugin.');
        }
    }

    let typedPixelArray
    if(bitsAllocated === 16){
        // x, y, z
        typedPixelArray = signed
            ? new Int16Array(dimensions[0] * dimensions[1] * dimensions[2])
            : new Uint16Array(dimensions[0] * dimensions[1] * dimensions[2])
    }else{
        throw new Error(`Unssuported bit: ${bitsAllocated}`)
    }

    return typedPixelArray;
}

/**
 *
 *
 * @param {*} seriesImageIds
 */
async function _getSeriesMetaDataMap(seriesImageIds){
    const metaDataMap = new Map()

    for (let i = 0; i < seriesImageIds.length; i++) {
      const imageId = seriesImageIds[i];
      const metaData = await tryGetMetadataModuleAsync('imagePlaneModule', imageId);
      metaDataMap.set(imageId, metaData);
    }

    return metaDataMap;
}

function _calculateDimensions(metaDataMap){
    const imagePlaneModule = metaDataMap.values().next().value;

    const { rowCosines, columnCosines } = imagePlaneModule
    const crossProduct = crossVectors(columnCosines, rowCosines)
    const orientation = determineOrientation(crossProduct)
    const zAxis = computeZAxis(orientation, metaDataMap)

    const xSpacing = imagePlaneModule.columnPixelSpacing
    const ySpacing = imagePlaneModule.rowPixelSpacing
    const zSpacing = zAxis.spacing
    const xVoxels = imagePlaneModule.columns
    const yVoxels = imagePlaneModule.rows
    const zVoxels = metaDataMap.size

    // 3 === RGB?
    const multiComponent = imagePlaneModule.numberOfComponents > 1

    return {
        dimensions: [xVoxels, yVoxels, zVoxels],
        orientation,
        multiComponent,
        spacing: [xSpacing, ySpacing, zSpacing],
        origin: zAxis.origin,
        zAxis
    }
}
