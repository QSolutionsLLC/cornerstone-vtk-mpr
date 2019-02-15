# cornerstone-vtk-mpr

## Commands

- `npm run build`: Bundled output
- `npm run dev`: Active development; preview at `http://localhost:9000`

## Resources

I used a number of resources to assist in setting up this repository. I'll try
to catalogue them here for others to reference.

### VTK

- [Matrices Refresher][matrices-refresher]
- [vtk.js w/ ES6 Imports][vtk-js-setup]
- [OHIF VTK Plugin][ohif-vtk-plugin]
- [Arbitrary Oblique Slice][arbitrary-oblique-slice]

### `vtkImageReslice` Examples

- [vtk Reslice Example][vtk-reslice-example]
- [Example #2][vtk-reslice-example-2]
- [Python][python-example]

---

[vtk-js-setup]: https://kitware.github.io/vtk-js/docs/intro_vtk_as_es6_dependency.html
[ohif-vtk-plugin]: https://github.com/OHIF/VTKPlugin
[vtk-reslice-example]: https://public.kitware.com/pipermail/vtkusers/2010-April/059673.html
[vtk-reslice-example-2]: https://vtk.org/gitweb?p=VTK.git;a=blob;f=Examples/ImageProcessing/Cxx/ImageSlicing.cxx
[matrices-refresher]: http://www.opengl-tutorial.org/beginners-tutorials/tutorial-3-matrices/
[arbitrary-oblique-slice]: https://public.kitware.com/pipermail/vtkusers/2009-October/054073.html
[python-example]: https://github.com/Kitware/VTK/blob/6b559c65bb90614fb02eb6d1b9e3f0fca3fe4b0b/Examples/ImageProcessing/Python/ImageSlicing.py