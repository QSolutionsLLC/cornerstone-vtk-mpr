import { mat4, vec3 } from 'gl-matrix';
import vtkImageReslice from 'vtk.js/Sources/Imaging/Core/ImageReslice';


// http://vtk.1045678.n5.nabble.com/vtkImageReslice-and-appending-slices-td5728537.html
// https://public.kitware.com/pipermail/vtkusers/2012-January/071996.html
// http://vtk.1045678.n5.nabble.com/vtkImageReslice-Rendering-slice-is-stretched-for-oblique-planes-if-no-OutputExtent-is-set-td5148691.html
// However, when you use vtkImageReslice to do oblique
// slices, I recommend that you always set the OutputExtent,
// OutputSpacing, and OutputOrigin for vtkImageReslice.
// The code that vtkImageReslice uses to "guess" these
// values is really only useful for orthogonal reslicing.
// https://vtkusers.public.kitware.narkive.com/HgihE8by/adjusting-vtkimagereslice-extent-when-slicing-a-volume


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
    const ipp = options.imagePositionPatient || "0,0,0";

    // Inputs to vec3
    const iopArray = iop.split(',').map(parseFloat);
    const rowCosinesVec3 = vec3.fromValues(iopArray[0], iopArray[1], iopArray[2]);
    const colCosinesVec3 = vec3.fromValues(iopArray[3], iopArray[4], iopArray[5]);
    const ippVec3 = ipp === "center"
        ? vtkVolume.centerIpp
        : ipp.split(',').map(parseFloat)

    // Maths
    // TODO: Move `computeTopLeftIpp` to tool(s)
    // TODO: MetaDataProvider to grab `volumeSpacing` and `volumeExtent` for a given volume?
    // const topLeftOfImageIPP = computeTopLeftIpp(rowCosinesVec3, colCosinesVec3, ippVec3, volumeSpacing, volumeExtent)
    const axes = _calculateRotationAxes(rowCosinesVec3, colCosinesVec3, ippVec3);
    // mat4.rotateX(axes, axes, options.rotation * Math.PI / 180);

    // Setup vtkImageReslice
    const imageReslice = vtkImageReslice.newInstance();
    imageReslice.setInputData(vtkImageData);                // Our volume
    imageReslice.setOutputDimensionality(2);                // We want a "slice", not a volume
    imageReslice.setBackgroundColor(255, 255, 255, 255);    // Black background
    imageReslice.setResliceAxes(axes);                      // Rotational Axes

    // Pull the lever!
    const outputSlice = imageReslice.getOutputData();
    const spacing = outputSlice.getSpacing();

    const result = {
        slice: outputSlice,
        metaData: {
            imagePlaneModule: {
                imagePositionPatient: [axes[12], axes[13], axes[14]],
                rowCosines: [axes[0], axes[1], axes[2]],
                columnCosines: [axes[4], axes[5], axes[6]],
                rowPixelSpacing: spacing[1],
                columnPixelSpacing: spacing[0],
                frameOfReferenceUID: "THIS-CAN-BE-ALMOST-ANYTHING"
            }
        }
    }

    // console.log("~~~~~~ RESULT:", result)

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