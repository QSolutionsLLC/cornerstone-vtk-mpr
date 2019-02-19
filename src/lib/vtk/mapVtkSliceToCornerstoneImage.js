// Inspiration: https://github.com/Kitware/vtk-js/blob/master/Sources/Filters/Cornerstone/ImageDataToCornerstoneImage/index.js

export default function(vtkSlice){
    
    const spacing = vtkSlice.getSpacing();
    const dimensions = vtkSlice.getDimensions();
    const scalars = vtkSlice.getPointData().getScalars();
    const dataRange = scalars.getRange(0);
    const rawData = scalars.getData();

    let pixelData = null;
    if (dimensions[2] === 1) {
      const scalarsData = scalars.getData();
      pixelData = scalarsData; // scalars.data;
    } else {
        // TODO: There is no slice index property here?
      const offset =
        vtkSlice.sliceIndex * dimensions[0] * dimensions[1] * rawData.BYTES_PER_ELEMENT;

      pixelData = new macro.TYPED_ARRAYS[(scalars.getDataType())](
        rawData.buffer,
        offset,
        dimensions[0] * dimensions[1]
      );
    }

    // const probablyPixelData = obliqueSlice.getPointData().getArrays()[0].getData();

    return {
      pixelData,

      //
      columnPixelSpacing: spacing[0],
      rows: dimensions[1],
      height: dimensions[1],

      //
      rowPixelSpacing: spacing[1],
      columns: dimensions[0],
      width: dimensions[0],

      //
      depth: dimensions[2],

      //
      intercept: 0,
      invert: false,
      minPixelValue: dataRange[0],
      maxPixelValue: dataRange[1],

      //
      sizeInBytes: pixelData.length * pixelData.BYTES_PER_ELEMENT,
      slope: 1,

      //
      windowCenter: Math.round((dataRange[0] + dataRange[1]) / 2),
      windowWidth: dataRange[1] - dataRange[0],
      decodeTimeInMS: 0,

      getPixelData() {
        return pixelData;
      },
    };
}