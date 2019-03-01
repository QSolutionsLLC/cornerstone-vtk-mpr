import { mat4, vec3 } from 'gl-matrix';
import vtkImageReslice from 'vtk.js/Sources/Imaging/Core/ImageReslice';

/**
 *
 * @function createMprSlice
 *
 * @param {Object} vtkVolume
 * @param {vtkImageData} vtkVolume.vtkImageData
 * @param {Vec3} vtkVolume.centerIpp
 * @param {Object} [options={}]
 * @param {String} [options.imageOrientationPatient]
 * @param {String} [options.imagePositionPatient]
 * 
 * @returns {Object} - {slice, metaData}
 */
export default function(vtkVolume, options = {}){
    // Input
    const vtkImageData = vtkVolume.vtkImageData;
    const iop = options.imageOrientationPatient || "1,0,0,0,1,0";
    const ipp = options.imagePositionPatient || "0,0,0"; // Top Left of slice

    // Find our position in ZED, and our reslice axes
    const iopArray = iop.split(',').map(parseFloat);
    const rowCosinesVec3 = vec3.fromValues(iopArray[0], iopArray[1], iopArray[2]);
    const colCosinesVec3 = vec3.fromValues(iopArray[3], iopArray[4], iopArray[5]);
    const ippVec3 = ipp === "center"
        ? vtkVolume.centerIpp
        : ipp.split(',').map(parseFloat)

    let zedCosinesVec3 = vec3.create()
    vec3.cross(zedCosinesVec3, rowCosinesVec3, colCosinesVec3);
    
    const [x0, y0, z0] = vtkImageData.getOrigin();
    const [xSpacing, ySpacing, zSpacing] = vtkImageData.getSpacing();
    const [xMin, xMax, yMin, yMax, zMin, zMax] = vtkImageData.getExtent();
    
    //const xStart = x0 + xSpacing * (xMax - xMin);
    //const yStart = y0 + ySpacing * (yMax - yMin);
    const zStart = z0 + zSpacing * (zMax - zMin); // Inverted z for vtk??
    console.log(zStart)
    console.log(z0, zSpacing, zMax, zMin)

    // const centerOfVolume = vec3.fromValues(
    //     x0 + xSpacing * 0.5 * (xMin + xMax),
    //     y0 + ySpacing * 0.5 * (yMin + yMax),
    //     z0 + zSpacing * 0.5 * (zMin + zMax)
    // )

    // "origin"
    // --> x0, y0, zStart
    // almost like a "volume offset"?
    // This is the zAxis we set as the volume origin in `createVtkVolumeAsync`
    // NOTE: Applying rotation of 360 degrees to sagittal and coronal fixes reference lines
    // IE. clicking the blue handle 36 times.
    console.log('~~ pre: ', ippVec3)
    console.log('~~ zed: ', zedCosinesVec3.join())
    const position = vec3.fromValues(
        (zedCosinesVec3[0] * -1 * (ippVec3[0] - x0)) + x0,
        (zedCosinesVec3[1] * (ippVec3[1] - y0)) + y0,
        (zedCosinesVec3[2] * (ippVec3[2] - zStart)) + zStart);
    // Have to allow negative for when we rotate?
    // const position = vec3.fromValues(
    //     zedCosinesVec3[0] * -1 * ippVec3[0],
    //     zedCosinesVec3[1] * ippVec3[1],
    //     zStart + zedCosinesVec3[2] * (ippVec3[2] - zStart))
    console.log('~~ pst: ', position)
    console.log('~~~~~');

    // Maths
    // TODO: MetaDataProvider to grab `volumeSpacing` and `volumeExtent` for a given volume?
    const axes = _calculateRotationAxes(rowCosinesVec3, colCosinesVec3, position);
    
    // Setup vtkImageReslice
    const imageReslice = vtkImageReslice.newInstance();
    imageReslice.setInputData(vtkImageData);                // Our volume
    imageReslice.setOutputDimensionality(2);                // We want a "slice", not a volume
    imageReslice.setBackgroundColor(255, 255, 255, 255);    // Black background
    imageReslice.setResliceAxes(axes);                      // Rotational Axes

    // Pull the lever!
    const outputSlice = imageReslice.getOutputData();
    const spacing = outputSlice.getSpacing();
    const dimensions = outputSlice.getDimensions();

    const result = {
        slice: outputSlice,
        metaData: {
            imagePlaneModule: {
                imageOrientationPatient: [
                    axes[0], axes[1], axes[2],
                    axes[4], axes[5], axes[6]
                ],
                imagePositionPatient: [axes[12], axes[13], axes[14]],
                rowCosines: [axes[0], axes[1], axes[2]],
                columnCosines: [axes[4], axes[5], axes[6]],
                rowPixelSpacing: spacing[1],
                columnPixelSpacing: spacing[0],
                frameOfReferenceUID: "THIS-CAN-BE-ALMOST-ANYTHING",
                columns: dimensions[0],
                rows: dimensions[1]
            }
        }
    }

    return result;
}
  

/**
 * Creates a 4x4 matrix that vtk can use as a "rotation matrix". The values
 * correspond to:
 * 
 * ux, uy, uz, 0
 * vx, vy, vz, 0
 * wx, wy, wz, 0
 * px, py, pz, 1
 * 
 * ux, uy, uz, vx, vy, vz - "ImageOrientationPatient"
 * w - cross_product(u,v)
 * px, py, pz - "ImagePositionPatient"
 * 
 * ImagePositionPatient: [60.3642578125, 170.3642578125, -32]
 * ImageOrientationPatient: [-1, 0, 0, 0, -1, 0]
 * RowCosines: [-1, 0, 0]
 * ColumnCosines: [0, -1, 0]
 * 
 * Reference: https://public.kitware.com/pipermail/vtkusers/2012-November/077297.html
 * Reference: http://nipy.org/nibabel/dicom/dicom_orientation.html
 *
 * @param {Float32Array} rowCosines
 * @param {Float32Array} colCosines
 * @param {Float32Array} ippArray
 * @returns {Mat4} - 4x4 Rotation Matrix
 */
function _calculateRotationAxes(rowCosines, colCosines, ippArray){
    let wCrossProd = vec3.create()
    vec3.cross(wCrossProd, rowCosines, colCosines);

    const axes = mat4.fromValues(
        rowCosines[0], rowCosines[1], rowCosines[2], 0,
        colCosines[0], colCosines[1], colCosines[2], 0,
        wCrossProd[0], wCrossProd[1], wCrossProd[2], 0,
        ippArray[0], ippArray[1], ippArray[2], 1
    )

    return axes;
}