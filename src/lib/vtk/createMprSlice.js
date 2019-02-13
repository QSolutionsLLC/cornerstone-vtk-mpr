import { mat4 } from 'gl-matrix';
import vtkImageReslice from 'vtk.js/Sources/Imaging/Core/ImageReslice';

export default function(vtkImageData, options = {}){
    options.rotation = options.rotation || 45;

    vtkImageData.setOrigin(0, 0, 0);

    const imageReslice = vtkImageReslice.newInstance();
    imageReslice.setInputData(vtkImageData);    // Our volume
    imageReslice.setOutputDimensionality(2);    // We want a "slice", not a volume
    imageReslice.setBackgroundColor(255, 255, 255, 255)
    imageReslice.setWrap(true)

    const axes = mat4.create();
    mat4.rotateX(axes, axes, options.rotation * Math.PI / 180);
    imageReslice.setResliceAxes(axes);

    const obliqueSlice = imageReslice.getOutputData();

    return obliqueSlice;
}