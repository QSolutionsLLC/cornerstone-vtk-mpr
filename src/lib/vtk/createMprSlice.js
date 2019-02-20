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

// Could be our PixelSpacing Issue:
// https://public.kitware.com/pipermail/vtkusers/2008-September/048181.html
export default function(vtkVolume, options = {}){
    const iop = options.imageOrientationPatient || "1,0,0,0,1,0";
    const ipp = options.imagePositionPatient || "0,0,0";

    const vtkImageData = vtkVolume.vtkImageData;
    const [xSpacing, ySpacing, zSpacing] = vtkImageData.getSpacing();
    const [xMin, xMax, yMin, yMax, zMin, zMax] = vtkImageData.getExtent();

    // SLICE SPACING/POSITION
    // Per volume; can probably add this to vtkImageData or meta for series/volume?
    const ippVec3 = ipp === "center"
        ? vtkVolume.centerIpp
        : ipp.split(',').map(parseFloat)

    const volumeSpacing = [xSpacing, ySpacing, zSpacing];
    const volumeExtent = [xMin, xMax, yMin, yMax, zMin, zMax];
    const iopArray = iop.split(',').map(parseFloat);
    const topLeftOfImageIPP = computeTopLeftIpp(iopArray, ippVec3, volumeSpacing, volumeExtent)

    const axes = _calculateRotationAxes(iopArray, topLeftOfImageIPP);

    const imageReslice = vtkImageReslice.newInstance();
    imageReslice.setInputData(vtkImageData);    // Our volume
    imageReslice.setOutputDimensionality(2);    // We want a "slice", not a volume
    imageReslice.setBackgroundColor(255, 255, 255, 255)

    // mat4.rotateX(axes, axes, options.rotation * Math.PI / 180);

    //console.log('AXES: ', axes)
    imageReslice.setResliceAxes(axes);

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

function computeTopLeftIpp(iopArray, centerIpp, spacing, extent) {
    const distance = vec3.fromValues(
      spacing[0] * extent[1],
      spacing[1] * extent[3],
      spacing[2] * extent[5]
    );
  
    const rowCosines = vec3.fromValues(
      iopArray[0], iopArray[1], iopArray[2]
    );
    const colCosines = vec3.fromValues(
      iopArray[3], iopArray[4], iopArray[5]
    );
  
    let colTranslate = vec3.create();
    vec3.multiply(colTranslate, colCosines, distance);
    vec3.scale(colTranslate, colTranslate, -0.5);
  
    let rowTranslate = vec3.create();
    vec3.multiply(rowTranslate, rowCosines, distance);
    vec3.scale(rowTranslate, rowTranslate, -0.5);
  
    const centerIppVec = vec3.fromValues(...centerIpp);
  
    const topLeftIpp = vec3.create();
    vec3.add(topLeftIpp, centerIppVec, colTranslate);
    vec3.add(topLeftIpp, topLeftIpp, rowTranslate);
  
    return topLeftIpp;
  }
  

function _calculateRotationAxes(iopArray, ippArray){
    const rowCosines = vec3.fromValues(
        iopArray[0], iopArray[1], iopArray[2]
    );
    const colCosines = vec3.fromValues(
        iopArray[3], iopArray[4], iopArray[5]
    );
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

// What values correspond to:
// https://public.kitware.com/pipermail/vtkusers/2012-November/077297.html
// http://nipy.org/nibabel/dicom/dicom_orientation.html
// ux, uy, uz, 0
// vx, vy, vz, 0
// wx, wy, wz, 0
// px, py, pz, 1
//
// ux, uy, uz, vx, vy, vz is from the "ImageOrientationPatient"
// w = cross_product(u,v)
// px, py, pz is from "ImagePositionPatient"
//
// Example values:
//
// ImagePositionPatient: [60.3642578125, 170.3642578125, -32]
// ImageOrientationPatient: [-1, 0, 0, 0, -1, 0]
// RowCosines: [-1, 0, 0]
// ColumnCosines: [0, -1, 0]

// https://public.kitware.com/pipermail/vtkusers/2013-January/078280.html
// the ResliceAxes matrix
// >defines a coordinate transformation that will be applied to the plane
// >Z=0 in order to generate an oblique plane that slices through your
// >input data.  A good way to think about it is that the 1st and 2nd
// >columns of the matrix are the basis vectors of the oblique plane, the
// >3rd column is the normal of the oblique plane, and the 4th column is
// >the "origin" of the oblique plane.  If you call SetOutputOrigin(0,0,0)
// >then the 4th column of the reslice matrix will precisely define the 3D
// >point at the corner of your oblique plane.

// r, r, r, r, // Basis vector      :: rotation
// r, r, r, r, // Basis vector      :: rotation
// r, r, r, r, // Normal of oblique :: rotation
// v, v, v, 1  // "origin" :: "translation"

// r -> rotation
// v -> vector length
