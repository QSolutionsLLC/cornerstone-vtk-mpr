import appState from './../../appState.js';
import createVtkVolumeAsync from './createVtkVolumeAsync.js'

export default async function(seriesNumber){
    let vtkVolume = appState.vtkVolumes[seriesNumber];
    if(!vtkVolume){
        vtkVolume = await createVtkVolumeAsync(appState.series[seriesNumber]);
        appState.vtkVolumes[seriesNumber] = vtkVolume;
    }
    return vtkVolume;
}