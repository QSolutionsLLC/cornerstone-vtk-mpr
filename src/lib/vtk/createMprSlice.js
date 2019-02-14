import { mat4, vec4 } from 'gl-matrix';
import vtkImageReslice from 'vtk.js/Sources/Imaging/Core/ImageReslice';

// Python Example: https://gitlab.kitware.com/vtk/vtk/blob/c13eb8658928b10db8c073b53081183b8ce60fd2/Examples/ImageProcessing/Cxx/ImageSlicing.cxx
// https://public.kitware.com/pipermail/vtkusers/2010-April/059673.html
export default function(vtkImageData, options = {}){
    options.rotation = options.rotation || 45;
    options.sliceDelta = options.sliceDelta || 1;

        //vtkImageData.setOrigin(0, 0, 0);
    // vtkImageData.setOrigin(300, 0, 0);
    vtkImageData.setOrigin(0, 0, 0);

    console.log(vtkImageData)

    const [x0, y0, z0] = vtkImageData.getOrigin();
    const [xSpacing, ySpacing, zSpacing] = vtkImageData.getSpacing();
    const [xMin, xMax, yMin, yMax, zMin, zMax] = vtkImageData.getExtent();

    // SLICE SPACING/POSITION
    const centerOfVolume = []
    centerOfVolume[0] = x0 + xSpacing * 0.5 * (xMin + xMax); 
    centerOfVolume[1] = y0 + ySpacing * 0.5 * (yMin + yMax); 
    centerOfVolume[2] = z0 + zSpacing * 0.5 * (zMin + zMax); 
    const sliceCenterPoint = [
        0.0,
        0.0,
        zSpacing * options.sliceDelta,
        1.0
    ]
    let multiplied = [];
    vec4.mul(multiplied, sliceCenterPoint, centerOfVolume);
    console.log('multiplied', multiplied)
    // MultiplyPoint
    // (point,center)


    console.log('origin: ', x0, y0, z0)
    console.log('spacing: ', xSpacing, ySpacing, zSpacing)
    console.log('extent: ', xMin, xMax, yMin, yMax, zMin, zMax)
    console.log(centerOfVolume)

    const imageReslice = vtkImageReslice.newInstance();
    imageReslice.setInputData(vtkImageData);    // Our volume
    imageReslice.setOutputDimensionality(2);    // We want a "slice", not a volume
    imageReslice.setBackgroundColor(255, 255, 255, 255)
    // imageReslice.setWrap(true)

    //const axes = mat4.create();
    //mat4.rotateX(axes, axes, options.rotation * Math.PI / 180);

    // https://public.kitware.com/pipermail/vtkusers/2008-September/048181.html
    // https://kitware.github.io/vtk-js/api/Common_Core_MatrixBuilder.html
    // setElement(int i, int j, double value)
    // https://vtk.org/doc/nightly/html/classvtkMatrix4x4.html#a6413522a56a1b78889db95a7427cb439
    // Axial

    // My matrices may be rotated oddly because I used Float32Array instead of a matrix class
    // Note: In the example, it's the last item in each row that needs updated
    const axialAxes = new Float32Array([
        1, 0, 0, 0, // Column 1
        0, 1, 0, 0, // Column 2
        0, 0, 1, 0, // Column 3
        centerOfVolume[0], centerOfVolume[1], centerOfVolume[2], 1 // 0, 1, slice
    ]);

    // n rows -->
    // m columns V
    // const coronalAxes = new Float32Array([ 
    //     1, 0, 0, 0, // 0
    //     0, 0, 1, 0, // slice
    //     0,-1, 0, 0, // 2
    //     0, 0, 0, 1
    // ]); 

    const coronalAxes = mat4.fromValues(
        1, 0, 0, 0, // Column 1
        0, 0, -1, 0, // Column 2
        0, 1, 0, 0, // Column 3
        centerOfVolume[0], centerOfVolume[1], centerOfVolume[2], 1 // 0, slice, 1
    )


    // Set the point through which to slice
    // Similar to: https://vtk.org/doc/nightly/html/classvtkImageReslice.html#details
    // `setResliceAxesOrigin(x, y, z)`
    // the first three elements of the final column of the ResliceAxes matrix).
    // const sagittalAxes = new Float32Array([ 
    //    0, 0, -1, 0, // slice
    //    1, 0, 0, 0, // 1
    //    0, -1, 0, 0, // 2
    //    0, 0, 0, 1 
    // ]); 

    const sagittalAxes = new Float32Array([ 
        0, 1, 0, 0, 
        0, 0, -1, 0,
        -1, 0, 0, 0,
        centerOfVolume[0], centerOfVolume[1], centerOfVolume[2], 1  // slice, 1, 2
     ]); 


    //static double obliqueElements[16] = {
    //         1, 0, 0, 0,  // 0
    //         0, 0.866025, -0.5, 0,    // 1
    //         0, 0.5, 0.866025, 0, // 2
    //         0, 0, 0, 1 };


    console.log(coronalAxes)
    imageReslice.setResliceAxes(coronalAxes);

    const obliqueSlice = imageReslice.getOutputData();

    return obliqueSlice;
}