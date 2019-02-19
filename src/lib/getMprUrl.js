const scheme = 'mpr';
const seriesNumber = 0;

export default function(imageOrientationPatient, imagePosititionPatient = ""){
    return `${scheme}:${seriesNumber}:${imageOrientationPatient}:${imagePosititionPatient}`
}