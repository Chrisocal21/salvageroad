(async () => {
const source=await (await fetch('/src/main.ts')).text();
const threeImport=source.match(/import \* as THREE from "([^"]+)"/);
if(!threeImport) throw Error('Could not locate the game renderer module');
const THREE=await import(threeImport[1]);
let car;
const updateScene=THREE.Scene.prototype.updateMatrixWorld;
THREE.Scene.prototype.updateMatrixWorld=function(...args){
  car=this.getObjectByName('El Cajon')||car;
  return updateScene.apply(this,args);
};
const updateCamera=THREE.PerspectiveCamera.prototype.updateMatrixWorld;
THREE.PerspectiveCamera.prototype.updateMatrixWorld=function(...args){
  if(car){
    const view=new URLSearchParams(location.search).get('reviewView');
    const positions={side:[7.5,1.05,0],rear:[-5,2.6,-6.5],trim:[2.2,1.3,-1.7]};
    const offset=new THREE.Vector3(...(positions[view]||[5,2.3,6.3])).applyQuaternion(car.quaternion);
    this.position.copy(car.position).add(offset);
    this.fov=42;this.updateProjectionMatrix();
    const target=new THREE.Vector3(0,view==='trim'?.72:.05,view==='trim'?-.25:0).applyQuaternion(car.quaternion).add(car.position);
    this.lookAt(target);
  }
  return updateCamera.apply(this,args);
};
document.querySelectorAll('body > :not(canvas)').forEach(e=>e.style.visibility='hidden');
})();
