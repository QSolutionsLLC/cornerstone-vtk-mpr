const scheme = 'wadouri';
const base = 'http://localhost:9000/studies';
const studyNumber = 0;

export default function(imageId){
    return `${scheme}:${base}/${studyNumber}/${imageId}`
}