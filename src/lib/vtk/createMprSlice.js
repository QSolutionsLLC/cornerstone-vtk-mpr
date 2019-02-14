import { mat4, vec4 } from 'gl-matrix';
import vtkImageReslice from 'vtk.js/Sources/Imaging/Core/ImageReslice';

// Python Example: https://gitlab.kitware.com/vtk/vtk/blob/c13eb8658928b10db8c073b53081183b8ce60fd2/Examples/ImageProcessing/Cxx/ImageSlicing.cxx
// https://public.kitware.com/pipermail/vtkusers/2010-April/059673.html
export default function(vtkImageData, options = {}){
    options.plane = options.plane || 0;
    options.rotation = options.rotation || 0;
    options.sliceDelta = options.sliceDelta || 0;

    vtkImageData.setOrigin(0, 0, 0);

    const [x0, y0, z0] = vtkImageData.getOrigin();
    const [xSpacing, ySpacing, zSpacing] = vtkImageData.getSpacing();
    const [xMin, xMax, yMin, yMax, zMin, zMax] = vtkImageData.getExtent();

    // SLICE SPACING/POSITION
    const centerOfVolume = []
    centerOfVolume[0] = x0 + xSpacing * 0.5 * (xMin + xMax); 
    centerOfVolume[1] = y0 + ySpacing * 0.5 * (yMin + yMax); 
    centerOfVolume[2] = z0 + zSpacing * 0.5 * (zMin + zMax);

    const sliceDelta = zSpacing * options.sliceDelta
    console.log('sliceDelta: ', sliceDelta)

    // Update "sliceIndex"
    // We'll need a more dynamic way to apply this for obliques/arbitrary rotation?
    // if(options.plane === 0){
    //     // Axial
    //     centerOfVolume[2] += sliceDelta;
    // }else if(options.plane === 1){
    //     // Coronal
    //     centerOfVolume[1] += sliceDelta;
    // }else{
    //     // Sagittal
    //     centerOfVolume[0] += sliceDelta;
    // }

    // These may all need to be changed if our axes change?
    centerOfVolume[0] += options.sliceDelta * xSpacing;
    centerOfVolume[1] += options.sliceDelta * ySpacing;
    centerOfVolume[2] += options.sliceDelta * zSpacing; // axial


    let axes = mat4.clone(_planeAxes[options.plane]);
    axes[12] = centerOfVolume[0]
    axes[13] = centerOfVolume[1]
    axes[14] = centerOfVolume[2]

    // const sliceCenterPoint = [
    //     0.0,
    //     0.0,
    //     zSpacing * options.sliceDelta,
    //     1.0
    // ]
    // let multiplied = [];
    // vec4.mul(multiplied, sliceCenterPoint, centerOfVolume);
    // console.log('multiplied', multiplied)


    console.log('options: ', options)
    console.log('origin: ', x0, y0, z0)
    console.log('spacing: ', xSpacing, ySpacing, zSpacing)
    console.log('extent: ', xMin, xMax, yMin, yMax, zMin, zMax)
    console.log('center: ' ,centerOfVolume)

    const imageReslice = vtkImageReslice.newInstance();
    imageReslice.setInputData(vtkImageData);    // Our volume
    imageReslice.setOutputDimensionality(2);    // We want a "slice", not a volume
    imageReslice.setBackgroundColor(255, 255, 255, 255)

    //mat4.rotateX(axes, axes, options.rotation * Math.PI / 180);

    // https://public.kitware.com/pipermail/vtkusers/2008-September/048181.html
    // https://kitware.github.io/vtk-js/api/Common_Core_MatrixBuilder.html
    // setElement(int i, int j, double value)
    // https://vtk.org/doc/nightly/html/classvtkMatrix4x4.html#a6413522a56a1b78889db95a7427cb439
    // Axial
    // Set the point through which to slice
    // Similar to: https://vtk.org/doc/nightly/html/classvtkImageReslice.html#details
    // `setResliceAxesOrigin(x, y, z)`
    // the first three elements of the final column of the ResliceAxes matrix).


    console.log(axes)
    imageReslice.setResliceAxes(axes);

    const obliqueSlice = imageReslice.getOutputData();

    return obliqueSlice;
}

const _planeAxes = [
    // Axial
    mat4.create(), // 0, 1, slice
    // Coronal
    mat4.fromValues(
        1, 0, 0, 0,
        0, 0, -1, 0,
        0, 1, 0, 0,
        0, 0, 0, 1), // 0, slice, 2
    // Sagittal
    mat4.fromValues(
        0, 1, 0, 0, 
        0, 0, -1, 0,
        -1, 0, 0, 0,
        0, 0, 0, 1), // slice, 1, 2 
    // Oblique
    mat4.fromValues(
        1, 0, 0, 0,
        0, 0.866025, 0.5, 0,
        0, -0.5, 0.866025, 0,
        0, 0, 0, 1) // 0, 1, 2
]