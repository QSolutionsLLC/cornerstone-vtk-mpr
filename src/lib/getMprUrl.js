const scheme = 'mpr';
const seriesNumber = 0;

export default function(plane, angle, sliceDelta){
    return `${scheme}:${seriesNumber}:${plane}:${angle}:${sliceDelta}`
}