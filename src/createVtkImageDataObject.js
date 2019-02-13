import vtkDataArray from 'vtk.js/Sources/Common/Core/DataArray';
import vtkImageData from 'vtk.js/Sources/Common/DataModel/ImageData';
//
import determineOrientation from './lib/data/determineOrientation.js';
import computeZAxis from './lib/data/computeZAxis.js';
import crossVectors from './lib/math/crossVectors.js';
import tryGetMetadataModuleAsync from './lib/tryGetMetadataModuleAsync.js';

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
    const imagePixelModule = await tryGetMetadataModuleAsync('imagePixelModule', seriesImageIds[0]);
    if(!imagePixelModule){
        throw new Error(`Unable to retrieve imagePixelModule for: ${seriesImageIds[0]}`)
    }
    const { bitsAllocated, pixelRepresentation } = imagePixelModule;
    const metaDataMap = await _getSeriesMetaDataMap(seriesImageIds);
    const {
        dimensions,
        orientation,
        multiComponent,
        spacing,
        zAxis
    } = _calculateDimensions(metaDataMap)
    const signed = pixelRepresentation === 1

    if (multiComponent) {
        throw new Error('Multi component image not supported by this plugin.')
    }
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

    const scalarArray = vtkDataArray.newInstance({
        name: 'Pixels',
        numberOfComponents: 1,
        values: typedPixelArray
    })

    const imageData = vtkImageData.newInstance()

    imageData.setDimensions(dimensions)
    imageData.setSpacing(spacing)
    imageData.getPointData().setScalars(scalarArray)

    const imageDataObject = {
        imageIds: seriesImageIds,
        dimensions,
        spacing,
        orientation,
        vtkImageData: imageData,
        metaDataMap,
        zAxis,
        loaded: false
    }

    return imageDataObject;
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
        zAxis
    }
}