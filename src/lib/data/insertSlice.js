import computeImageDataIncrements from './computeImageDataIncrements.js';
import computeIndex from './computeIndex.js';

export default function(vtkVolume, pixelData, sliceIndex){
    const datasetDefinition = vtkVolume.get('extent', 'spacing', 'origin')
    const scalars = vtkVolume.getPointData().getScalars()
    // TODO number of components.
    const increments = computeImageDataIncrements(vtkVolume, 1)
    const scalarData = scalars.getData()
    const indexXYZ = [0, 0, sliceIndex]
    let pixelIndex = 0
  
    for (let row = 0; row <= datasetDefinition.extent[3]; row++) {
      indexXYZ[1] = row
      for (let col = 0; col <= datasetDefinition.extent[1]; col++) {
        indexXYZ[0] = col
  
        const destIdx = computeIndex(
          datasetDefinition.extent,
          increments,
          indexXYZ
        )
        scalarData[destIdx] = pixelData[pixelIndex++]
      }
    }
    vtkVolume.modified()
}