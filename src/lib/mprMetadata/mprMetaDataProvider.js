import mprMetaDataStore from './mprMetaDataStore.js';



function provider(moduleName, imageId) {
    const meta = mprMetaDataStore.get(imageId);
    
    if(!meta){
        return;
    }

    if(moduleName === "imagePlaneModule"){
        const imagePlaneModule = meta.imagePlaneModule;
        return imagePlaneModule;
    }

    return;
}

export default provider;
