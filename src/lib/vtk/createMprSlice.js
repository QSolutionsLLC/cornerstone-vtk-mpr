import { mat4, vec3 } from 'gl-matrix';
import vtkImageReslice from 'vtk.js/Sources/Imaging/Core/ImageReslice';

// Could be our PixelSpacing Issue:
// https://cmake.org/pipermail/igstk-developers/2005-November/000507.html
export default function(vtkVolume, options = {}){
    let iop = options.imageOrientationPatient || "1,0,0,0,1,0";
    let ipp = options.imagePositionPatient || "0,0,0";

    const origin = vtkVolume.origin;
    const vtkImageData = vtkVolume.vtkImageData;

    //console.log('origin', origin)
    //vtkImageData.setOrigin(100, 100, 0);
    /// vtkImageData.setOrigin(origin[0], origin[1], origin[2]);

    // http://vtk.1045678.n5.nabble.com/vtkImageReslice-and-appending-slices-td5728537.html
    // https://public.kitware.com/pipermail/vtkusers/2012-January/071996.html
    // http://vtk.1045678.n5.nabble.com/vtkImageReslice-Rendering-slice-is-stretched-for-oblique-planes-if-no-OutputExtent-is-set-td5148691.html
    // However, when you use vtkImageReslice to do oblique 
    // slices, I recommend that you always set the OutputExtent, 
    // OutputSpacing, and OutputOrigin for vtkImageReslice. 
    // The code that vtkImageReslice uses to "guess" these 
    // values is really only useful for orthogonal reslicing. 
    // https://vtkusers.public.kitware.narkive.com/HgihE8by/adjusting-vtkimagereslice-extent-when-slicing-a-volume

    const [x0, y0, z0] = vtkImageData.getOrigin();
    const [xSpacing, ySpacing, zSpacing] = vtkImageData.getSpacing();
    const [xMin, xMax, yMin, yMax, zMin, zMax] = vtkImageData.getExtent();

    // console.log(x0, y0, z0);
    // console.log(xSpacing, ySpacing, zSpacing);
    // console.log(xMin, xMax, yMin, yMax, zMin, zMax);

    // SLICE SPACING/POSITION
    // Per volume; can probably add this to vtkImageData or meta for series/volume?
    if(ipp === "center"){
        
        const centerOfVolume = []
        centerOfVolume[0] = x0 + xSpacing * 0.5 * (xMin + xMax); 
        centerOfVolume[1] = y0 + ySpacing * 0.5 * (yMin + yMax); 
        centerOfVolume[2] = z0 + zSpacing * 0.5 * (zMin + zMax);

        ipp = centerOfVolume.join();
    }

    const axes = _calculateRotationAxes(iop, ipp); //cov); // ipp);

    const imageReslice = vtkImageReslice.newInstance();
    imageReslice.setInputData(vtkImageData);    // Our volume
    imageReslice.setOutputDimensionality(2);    // We want a "slice", not a volume
    imageReslice.setBackgroundColor(255, 255, 255, 255)

    // mat4.rotateX(axes, axes, options.rotation * Math.PI / 180);

    // https://public.kitware.com/pipermail/vtkusers/2008-September/048181.html
    // https://kitware.github.io/vtk-js/api/Common_Core_MatrixBuilder.html
    // setElement(int i, int j, double value)
    // https://vtk.org/doc/nightly/html/classvtkMatrix4x4.html#a6413522a56a1b78889db95a7427cb439
    // Axial
    // Set the point through which to slice
    // Similar to: https://vtk.org/doc/nightly/html/classvtkImageReslice.html#details
    // `setResliceAxesOrigin(x, y, z)`
    // the first three elements of the final column of the ResliceAxes matrix).


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

function _calculateRotationAxes(iop, ipp){
    const iopArray = iop.split(',').map(parseFloat);
    const ippArray = ipp.split(',').map(parseFloat);
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