import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinnedModel } from 'three/addons/utils/SkeletonUtils.js';

const WORLD_SIZE = 3200;
const WORLD_HALF = WORLD_SIZE / 2;
const WORLD_SCALE = WORLD_SIZE / 4000;
const PLAYER_EYE_HEIGHT = 1.83;
const BIOME_BOUNDS = {
  valley: 430*WORLD_SCALE,
  firstMountain: 660*WORLD_SCALE,
  pineForest: 1240*WORLD_SCALE,
  secondMountain: 1480*WORLD_SCALE,
  worldEdge: WORLD_HALF
};
const treeData = [];
const treePlacements = [];
const treeCollisionGrid = new Map();
const treeLodChunks = [];
const treeWindUniform = { value: 0 };
const pendingTreeTemplates = new Map();
let landscapeReady = false;
const rockCollisionGrid = new Map();
const collisionSegments = [];
const kitchenState = {
  rawMeat: 0,
  cookedMeat: 0,
  fridgeOpen: false,
  fireLit: false,
  stoveOn: false,
  fridgeDoor: null,
  fireLight: null,
  flames: null,
  burnerMaterial: null
};
const ranchGateState = {
  centerX: 90,
  z: 108,
  width: 4,
  open: false,
  progress: 0,
  hinge: null
};
const TREE_COLLISION_CELL = 16;
const TREE_LOD_CELL = 640;
const TREE_LOD_UPDATE_INTERVAL = .5;
let treeLodUpdateTimer = 0;
const terrainAnchoredObjects = [];
let landscapeHeightGrid = null;
let landscapeGridSize = 0;
let landscapeGridOriginX = 0;
let landscapeGridOriginZ = 0;
let landscapeGridStep = 0;
let landscapeWorldBounds = null;
const wildlifeData = [];
const rayHitTargets = [];
let horseCollisionGroup = null;
const waterZones = [];
const waterTimeUniform={value:0};
const cabinState={
  centerX:90,centerZ:90,halfWidth:9.1,halfDepth:6.5,
  doorWidth:1.56,doorOpen:false,doorProgress:0,doorHinge:null,
  inside:true,transitioning:false,floorY:0,
  returnPosition:new THREE.Vector3(90,0,100.8),returnYaw:0,returnPitch:0
};
const CABIN_SCALE_XZ=1.3;
const CABIN_HEIGHT_SCALE=.7;
const CABIN_FRIDGE_LOCAL_X=3.4;
const CABIN_FRIDGE_LOCAL_Z=-4.05;
const CABIN_FRIDGE_APPROACH_LOCAL_Z=-2.65;
const CABIN_COOKTOP_LOCAL_X=-6;
const CABIN_COOKTOP_LOCAL_Z=-3;
const CABIN_COOKTOP_APPROACH_LOCAL_X=-4.45;
const CABIN_AMMO_LOCAL_X=-4.2;
const CABIN_AMMO_LOCAL_Z=.1;
const CABIN_SAFE_LOCAL_X=6.1;
const CABIN_SAFE_LOCAL_Z=-1.6;
const CABIN_LOCKER_LOCAL_X=6.1;
const CABIN_LOCKER_LOCAL_Z=2;
const cabinInteriorColliders=[];
const customizationOptions={
  character:{
    ranger:{label:'Ranger',tint:0xd9c8a4},
    rancher:{label:'Ranch hand',tint:0xb88762},
    guide:{label:'Trail guide',tint:0x9cae92}
  },
  horseCoat:{
    bay:{label:'Bay',tint:0xffffff},
    black:{label:'Dark bay',tint:0x514139},
    palomino:{label:'Palomino',tint:0xffdfa1},
    appaloosa:{label:'Appaloosa',tint:0xf7f5ed,absoluteWhite:true}
  },
  cabin:{
    pine:{label:'Pine lodge',wood:0x765034,siding:0x805a3b,roof:0x55463c},
    cedar:{label:'Weathered cedar',wood:0x75604a,siding:0x8c765e,roof:0x4d5148},
    timber:{label:'Dark timber',wood:0x49372a,siding:0x624936,roof:0x353b38}
  },
  dogBreed:{
    none:{label:'No dog'},
    retriever:{label:'Labrador retriever'},
    shepherd:{label:'German shepherd'},
    collie:{label:'Australian shepherd'},
    hound:{label:'Bloodhound'}
  }
};
const customizationState={character:'ranger',horseCoat:'bay',cabin:'pine',dogBreed:'none'};
const cabinThemeMaterials={wood:[],siding:[],roof:[]};
let kennelOpen=false;
let kennelPosition=null;
const dogTemplates={generic:null,shepherd:null,beagle:null};
const dogModelFailures=new Set();
const dogBreedModels={retriever:'generic',shepherd:'shepherd',collie:'generic',hound:'beagle'};
const dogCompanion={group:null,model:null,mixer:null,template:null,action:null,clipName:null,breed:'none',called:false,speed:0,stuckTime:0};
try{
  const savedOptions=JSON.parse(localStorage.getItem('wild-country-customization-v1')||'null');
  if(savedOptions&&typeof savedOptions==='object'){
    for(const key of Object.keys(customizationOptions)){
      if(Object.hasOwn(customizationOptions[key],savedOptions[key]))customizationState[key]=savedOptions[key];
    }
  }
}catch(error){
  console.warn('[Wild Country] Saved customization preferences could not be read:',error);
}
let awakeningShown=false;
let pendingDeerRacks=null;
const clock = new THREE.Clock();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9bbbd0);
scene.fog = new THREE.FogExp2(0x9bbbd0, 0.00052);
const cabinInteriorScene=new THREE.Scene();
cabinInteriorScene.background=new THREE.Color(0x36443c);
cabinInteriorScene.fog=new THREE.Fog(0x36443c,45,150);
cabinInteriorScene.add(new THREE.HemisphereLight(0xffe6bf,0x353c32,1.15));
const interiorFillLight=new THREE.DirectionalLight(0xffd49a,1.2);
interiorFillLight.position.set(-5,12,7);
cabinInteriorScene.add(interiorFillLight);

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 1800);
scene.add(camera);

// First-person rifle: a single textured CC0 GLB, never replaced by primitives.
const weapon=new THREE.Group();
const rifleModel=new THREE.Group();
weapon.add(rifleModel);
camera.add(weapon);
let rifleLoaded=false;
let rifleCarried=true;
let recoil=0;
const weaponIdlePosition=new THREE.Vector3(.58,-.40,-.98);
const weaponCarryPosition=new THREE.Vector3(.50,-.32,-.90);
const weaponSprintPosition=new THREE.Vector3(.58,-.47,-1.00);
const weaponAimPosition=new THREE.Vector3(-.018,-.01,-1.08);
const weaponPosition=new THREE.Vector3();
const weaponRotation=new THREE.Euler(-.14,-.12,-.045);
let weaponMotionTime=0;

const rifleLoader=new GLTFLoader();
function loadRifle(){
  rifleLoader.load('./assets/models/rifle.glb',gltf=>{
    try{
      const model=gltf.scene;
      model.updateMatrixWorld(true);
      const box=new THREE.Box3().setFromObject(model);
      if(box.isEmpty())throw new Error('Rifle GLB has no renderable geometry');
      const size=box.getSize(new THREE.Vector3());
      const maxLength=Math.max(size.x,size.y,size.z);
      if(maxLength<=0)throw new Error('Rifle GLB has zero dimensions');

      // Normalize the exported Quaternius rifle: rotate +90 degrees around Y because
      // this asset uses a +X barrel axis, then center it at the camera-weapon origin.
      model.rotation.y=Math.PI/2;
      model.updateMatrixWorld(true);
      model.scale.multiplyScalar(0.98/maxLength);
      model.updateMatrixWorld(true);
      const scaledBox=new THREE.Box3().setFromObject(model);
      const center=scaledBox.getCenter(new THREE.Vector3());
      model.position.sub(center);
      model.updateMatrixWorld(true);
      model.traverse(mesh=>{
        if(mesh.isMesh){
          mesh.castShadow=false;
          mesh.receiveShadow=false;
          mesh.renderOrder=10;
          mesh.frustumCulled=false;
          const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
          for(const material of materials){
            const name=material.name.toLowerCase();
            if(name==='black'){
              material.color.multiplyScalar(1.9);
              material.metalness=.12;
              material.roughness=.58;
            }else if(name==='green'){
              material.color.multiplyScalar(1.55);
              material.metalness=.08;
              material.roughness=.68;
            }else if(name==='darkmetal'){
              material.color.multiplyScalar(2.15);
              material.metalness=.55;
              material.roughness=.3;
            }else if(name==='grey'){
              material.color.multiplyScalar(2.1);
              material.metalness=.62;
              material.roughness=.27;
            }else if(name==='glass'){
              material.color.multiplyScalar(3);
              material.metalness=.08;
              material.roughness=.12;
              material.emissive.set(0x07131d);
              material.emissiveIntensity=.22;
            }
            material.depthTest=false;
            material.depthWrite=false;
          }
        }
      });
      rifleModel.add(model);
      window.__rifleDebug={box:scaledBox,sourceSize:size,sourceMax:maxLength,normalizedLength:0.78};
      console.info('[Wild Country] Rifle model loaded and normalized:',window.__rifleDebug);
      rifleLoaded=true;
    }catch(error){console.error('[Wild Country] Failed to prepare rifle.glb:',error);showMessage('Rifle model failed to load — see console');}
  },undefined,error=>{
    console.error('[Wild Country] Failed to load assets/models/rifle.glb:',error);
    showMessage('Rifle model failed to load — see console');
  });
}

weapon.position.copy(weaponIdlePosition);
weapon.rotation.copy(weaponRotation);
loadRifle();
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.08;
renderer.shadowMap.autoUpdate=true;
document.getElementById('game').appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xbfdcff, 0x405020, 1.25);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff4d2, 2.4);
sun.position.set(-180, 260, 100);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.bias=-0.00008;
sun.shadow.camera.left = sun.shadow.camera.bottom = -220;
sun.shadow.camera.right = sun.shadow.camera.top = 220;
sun.shadow.camera.far = 600;
scene.add(sun);

// Stable multi-frequency terrain noise. Every object that touches the ground
// uses this same function, so hills and movement remain consistent.
function smoothNoise(x,z){
  const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz;
  const sx=fx*fx*(3-2*fx),sz=fz*fz*(3-2*fz);
  function hash(a,b){let n=(a*374761393+b*668265263)&0x7fffffff;return ((n^(n>>13))*1274126177&0x7fffffff)/2147483647-.5;}
  const a=hash(ix,iz),b=hash(ix+1,iz),c=hash(ix,iz+1),d=hash(ix+1,iz+1);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a,b,sx),THREE.MathUtils.lerp(c,d,sx),sz);
}
function mountainPassFactor(angle){
  let nearest=Infinity;
  for(const passAngle of [0,Math.PI*.5,Math.PI,Math.PI*1.5]){
    const difference=Math.atan2(Math.sin(angle-passAngle),Math.cos(angle-passAngle));
    nearest=Math.min(nearest,Math.abs(difference));
  }
  const pass=1-THREE.MathUtils.smoothstep(nearest,.025,.13);
  return 1-.78*pass;
}
function mountainRangeHeight(x,z,radius,width,height,seed){
  const distance=Math.hypot(x,z);
  const angle=Math.atan2(z,x);
  const ridgeRadius=radius+smoothNoise(x*.012/WORLD_SCALE+seed,z*.012/WORLD_SCALE-seed)*54*WORLD_SCALE;
  const offset=(distance-ridgeRadius)/width;
  return height*Math.exp(-offset*offset)*mountainPassFactor(angle);
}
function proceduralTerrainHeight(x,z){
  const large=smoothNoise(x*.0024/WORLD_SCALE,z*.0024/WORLD_SCALE)*34;
  const hills=smoothNoise(x*.007/WORLD_SCALE,z*.007/WORLD_SCALE)*15;
  const detail=smoothNoise(x*.025/WORLD_SCALE,z*.025/WORLD_SCALE)*3.2;
  const pastureRoll=smoothNoise(x*.0034/WORLD_SCALE+7,z*.0034/WORLD_SCALE-11)*36+
    smoothNoise(x*.0105/WORLD_SCALE-19,z*.0105/WORLD_SCALE+5)*12;
  const ridge=Math.abs(smoothNoise(x*.0017/WORLD_SCALE-20,z*.0017/WORLD_SCALE+13))*-8;
  const valley=12*Math.exp(-(x*x+z*z*.55)/(30000*WORLD_SCALE*WORLD_SCALE));
  const firstRange=mountainRangeHeight(x,z,550*WORLD_SCALE,100*WORLD_SCALE,125,17);
  const secondRange=mountainRangeHeight(x,z,1370*WORLD_SCALE,145*WORLD_SCALE,175,43);
  return large+hills+detail+pastureRoll+ridge+valley+firstRange+secondRange-5;
}

function sampleLandscapeHeight(x,z){
  if(!landscapeHeightGrid)return null;
  const gx=(x-landscapeGridOriginX)/landscapeGridStep;
  const gz=(z-landscapeGridOriginZ)/landscapeGridStep;
  if(gx<0||gz<0||gx>landscapeGridSize-1||gz>landscapeGridSize-1)return null;
  const x0=Math.floor(gx),z0=Math.floor(gz);
  const x1=Math.min(landscapeGridSize-1,x0+1),z1=Math.min(landscapeGridSize-1,z0+1);
  const tx=gx-x0,tz=gz-z0;
  let total=0,weight=0;
  const h00=landscapeHeightGrid[z0*landscapeGridSize+x0];
  const h10=landscapeHeightGrid[z0*landscapeGridSize+x1];
  const h01=landscapeHeightGrid[z1*landscapeGridSize+x0];
  const h11=landscapeHeightGrid[z1*landscapeGridSize+x1];
  const w00=(1-tx)*(1-tz),w10=tx*(1-tz),w01=(1-tx)*tz,w11=tx*tz;
  if(Number.isFinite(h00)){total+=h00*w00;weight+=w00;}
  if(Number.isFinite(h10)){total+=h10*w10;weight+=w10;}
  if(Number.isFinite(h01)){total+=h01*w01;weight+=w01;}
  if(Number.isFinite(h11)){total+=h11*w11;weight+=w11;}
  return weight>0?total/weight:null;
}

function terrainHeight(x,z){
  const sampled=sampleLandscapeHeight(x,z);
  let ground;
  if(sampled===null)ground=proceduralTerrainHeight(x,z);
  else{
    const blend=landscapeEdgeBlend(x,z);
    ground=THREE.MathUtils.lerp(proceduralTerrainHeight(x,z),sampled,blend);
  }
  return ground;
}

function canTraverseTerrain(fromX,fromZ,toX,toZ,maxGrade=1.05){
  if(cabinState.inside)return true;
  const horizontalDistance=Math.hypot(toX-fromX,toZ-fromZ);
  if(horizontalDistance<.001)return true;
  const verticalDistance=Math.abs(terrainHeight(toX,toZ)-terrainHeight(fromX,fromZ));
  return verticalDistance<=horizontalDistance*maxGrade+.12;
}

function smoothLandscapeHeightGrid(){
  const length=landscapeHeightGrid.length;
  const pending=new Int32Array(length);
  let head=0,tail=0;
  for(let i=0;i<length;i++){
    if(Number.isFinite(landscapeHeightGrid[i]))pending[tail++]=i;
  }
  while(head<tail){
    const index=pending[head++];
    const x=index%landscapeGridSize,z=Math.floor(index/landscapeGridSize);
    const neighbors=[];
    if(x>0)neighbors.push(index-1);
    if(x+1<landscapeGridSize)neighbors.push(index+1);
    if(z>0)neighbors.push(index-landscapeGridSize);
    if(z+1<landscapeGridSize)neighbors.push(index+landscapeGridSize);
    for(const neighbor of neighbors){
      if(Number.isFinite(landscapeHeightGrid[neighbor]))continue;
      landscapeHeightGrid[neighbor]=landscapeHeightGrid[index];
      pending[tail++]=neighbor;
    }
  }

  for(let pass=0;pass<16;pass++){
    const smoothed=new Float32Array(length);
    for(let z=0;z<landscapeGridSize;z++){
      for(let x=0;x<landscapeGridSize;x++){
        const index=z*landscapeGridSize+x;
        const center=landscapeHeightGrid[index];
        let weighted=center*4,weight=4;
        for(const [dx,dz] of [[-1,0],[1,0],[0,-1],[0,1]]){
          const nx=x+dx,nz=z+dz;
          if(nx<0||nx>=landscapeGridSize||nz<0||nz>=landscapeGridSize)continue;
          weighted+=landscapeHeightGrid[nz*landscapeGridSize+nx];
          weight++;
        }
        smoothed[index]=weighted/weight;
      }
    }
    landscapeHeightGrid=smoothed;
  }
}

function registerTerrainAnchor(object,x,z,offset=0){
  terrainAnchoredObjects.push({object,x,z,offset});
}

function registerRockCollision(x,z,radius){
  const cellX=Math.floor(x/TREE_COLLISION_CELL),cellZ=Math.floor(z/TREE_COLLISION_CELL);
  const key=`${cellX}:${cellZ}`;
  if(!rockCollisionGrid.has(key))rockCollisionGrid.set(key,[]);
  rockCollisionGrid.get(key).push({x,z,radius});
}

function registerCollisionSegment(x1,z1,x2,z2,radius=.12){
  collisionSegments.push({x1,z1,x2,z2,radius});
}

function distanceToSegmentSquared(x,z,segment){
  const dx=segment.x2-segment.x1,dz=segment.z2-segment.z1;
  const lengthSquared=dx*dx+dz*dz;
  const t=lengthSquared===0?0:THREE.MathUtils.clamp(
    ((x-segment.x1)*dx+(z-segment.z1)*dz)/lengthSquared,0,1
  );
  const nearestX=segment.x1+t*dx,nearestZ=segment.z1+t*dz;
  return (x-nearestX)**2+(z-nearestZ)**2;
}

function landscapeEdgeBlend(x,z){
  if(!landscapeWorldBounds)return 0;
  const edgeDistance=Math.min(
    x-landscapeWorldBounds.minX,landscapeWorldBounds.maxX-x,
    z-landscapeWorldBounds.minZ,landscapeWorldBounds.maxZ-z
  );
  const t=THREE.MathUtils.clamp(edgeDistance/240,0,1);
  return t*t*(3-2*t);
}

function terrainLatticeNoise(x,y,gridSize){
  const ix=Math.floor(x),iy=Math.floor(y);
  const fx=x-ix,fy=y-iy;
  const sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
  const hash=(px,py)=>{
    let value=Math.imul((px%gridSize+gridSize)%gridSize,374761393);
    value=Math.imul(value^Math.imul((py%gridSize+gridSize)%gridSize,668265263),1274126177);
    return ((value^(value>>>13))>>>0)/4294967295;
  };
  const a=hash(ix,iy),b=hash(ix+1,iy),c=hash(ix,iy+1),d=hash(ix+1,iy+1);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(a,b,sx),
    THREE.MathUtils.lerp(c,d,sx),
    sy
  );
}

function makeTerrainSurfaceTile(kind,base,contrast){
  const size=256,canvas=document.createElement('canvas');
  canvas.width=canvas.height=size;
  const context=canvas.getContext('2d');
  const image=context.createImageData(size,size);
  const palettes={
    grass:[74,88,53],
    dirt:[93,72,49],
    mud:[57,56,45],
    gravel:[112,107,93],
    rock:[104,104,96],
    sand:[157,137,101],
    snow:[191,202,208]
  };
  const palette=palettes[kind];
  for(let y=0;y<size;y++){
    for(let x=0;x<size;x++){
      const broad=terrainLatticeNoise(x/size*5,y/size*5,5);
      const medium=terrainLatticeNoise(x/size*13,y/size*13,13);
      const fine=terrainLatticeNoise(x/size*31,y/size*31,31);
      const grain=terrainLatticeNoise(x/size*39,y/size*39,39);
      const mottling=(broad-.5)*.8+(medium-.5)*.42+(fine-.5)*.2+(grain-.5)*.09;
      const fleck=terrainLatticeNoise(x/size*76,y/size*76,76);
      const index=(y*size+x)*4;
      for(let channel=0;channel<3;channel++){
        let value=palette[channel]+mottling*contrast;
        if(kind==='grass'){
          const blade=Math.sin((x+y*.37)*.42+medium*5);
          value+=blade*4+(fleck>.965?(channel===1?10:-5):0);
        }else if(kind==='gravel'){
          value+=(fleck>.84?14:-4);
        }else if(kind==='rock'){
          value+=(fleck>.93?9:-2);
        }else if(kind==='snow'){
          value+=(fleck>.98?9:-3);
        }else if(kind==='dirt'||kind==='mud'||kind==='sand'){
          value+=(fleck>.975?8:-1);
        }
        image.data[index+channel]=THREE.MathUtils.clamp(value,0,255);
      }
      image.data[index+3]=255;
    }
  }
  context.putImageData(image,0,0);
  return canvas;
}

const terrainSurfaceKinds=[
  ['grass',74,88,53,46],
  ['dirt',93,72,49,42],
  ['mud',57,56,45,36],
  ['gravel',112,107,93,42],
  ['rock',104,104,96,39],
  ['sand',157,137,101,39],
  ['snow',191,202,208,27]
];
const terrainAtlasCanvas=document.createElement('canvas');
terrainAtlasCanvas.width=1024;
terrainAtlasCanvas.height=512;
const terrainAtlasContext=terrainAtlasCanvas.getContext('2d');
terrainSurfaceKinds.forEach(([kind,r,g,b,contrast],index)=>{
  const tile=makeTerrainSurfaceTile(kind,[r,g,b],contrast);
  terrainAtlasContext.drawImage(tile,(index%4)*256,Math.floor(index/4)*256);
});
const terrainAtlas=new THREE.CanvasTexture(terrainAtlasCanvas);
terrainAtlas.wrapS=terrainAtlas.wrapT=THREE.RepeatWrapping;
terrainAtlas.colorSpace=THREE.NoColorSpace;
terrainAtlas.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
terrainAtlas.generateMipmaps=true;

const terrainBumpCanvas=makeTerrainSurfaceTile('gravel',[127,127,127],38);
const terrainBumpContext=terrainBumpCanvas.getContext('2d');
const terrainBumpImage=terrainBumpContext.getImageData(0,0,256,256);
for(let index=0;index<terrainBumpImage.data.length;index+=4){
  const height=Math.round(
    terrainLatticeNoise(index/4%256/256*11,Math.floor(index/4/256)/256*11,11)*255
  );
  terrainBumpImage.data[index]=height;
  terrainBumpImage.data[index+1]=height;
  terrainBumpImage.data[index+2]=height;
}
terrainBumpContext.putImageData(terrainBumpImage,0,0);
const terrainBumpTexture=new THREE.CanvasTexture(terrainBumpCanvas);
terrainBumpTexture.wrapS=terrainBumpTexture.wrapT=THREE.RepeatWrapping;
terrainBumpTexture.repeat.set(WORLD_SIZE/8,WORLD_SIZE/8);
terrainBumpTexture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
const compiledTerrainShaders=[];
const terrainWaterUniforms={count:0,zones:Array.from({length:8},()=>new THREE.Vector4())};

function updateTerrainWaterUniforms(){
  terrainWaterUniforms.count=Math.min(waterZones.length,terrainWaterUniforms.zones.length);
  for(let index=0;index<terrainWaterUniforms.zones.length;index++){
    const zone=waterZones[index];
    terrainWaterUniforms.zones[index].set(
      zone?(zone.minX+zone.maxX)*.5:0,
      zone?(zone.minZ+zone.maxZ)*.5:0,
      zone?(zone.maxX-zone.minX)*.5:0,
      zone?(zone.maxZ-zone.minZ)*.5:0
    );
  }
  for(const shader of compiledTerrainShaders){
    shader.uniforms.uWildWaterZoneCount.value=terrainWaterUniforms.count;
    shader.uniforms.uWildWaterZones.value=terrainWaterUniforms.zones;
  }
}

function addNaturalTerrainShader(material,withBump=false){
  if(material.userData.wildCountryTerrainShader)return;
  material.userData.wildCountryTerrainShader=true;
  if(withBump){
    material.bumpMap=terrainBumpTexture;
    material.bumpScale=.065;
  }
  material.onBeforeCompile=shader=>{
    shader.uniforms.uWildTerrainAtlas={value:terrainAtlas};
    shader.uniforms.uWildWaterZoneCount={value:terrainWaterUniforms.count};
    shader.uniforms.uWildWaterZones={value:terrainWaterUniforms.zones};
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>',`#include <common>
varying vec3 vWildWorldPosition;
varying vec3 vWildWorldNormal;`)
      .replace('#include <project_vertex>',`#include <project_vertex>
vWildWorldPosition=(modelMatrix*vec4(transformed,1.0)).xyz;
vWildWorldNormal=normalize(mat3(modelMatrix)*normal);`);
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>',`#include <common>
varying vec3 vWildWorldPosition;
varying vec3 vWildWorldNormal;
uniform sampler2D uWildTerrainAtlas;
uniform int uWildWaterZoneCount;
uniform vec4 uWildWaterZones[8];
vec3 wildSrgbToLinear(vec3 color){
  vec3 low=color/12.92;
  vec3 high=pow((color+0.055)/1.055,vec3(2.4));
  return mix(high,low,step(color,vec3(0.04045)));
}
float wildHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float wildNoise(vec2 p){
  vec2 i=floor(p),f=fract(p);
  f=f*f*(3.0-2.0*f);
  return mix(mix(wildHash(i),wildHash(i+vec2(1.0,0.0)),f.x),
    mix(wildHash(i+vec2(0.0,1.0)),wildHash(i+vec2(1.0,1.0)),f.x),f.y);
}
vec3 wildTerrainTile(vec2 worldUv,float tileIndex){
  float column=mod(tileIndex,4.0);
  float row=1.0-floor(tileIndex/4.0);
  vec2 withinTile=fract(worldUv)*0.985+0.0075;
  vec2 atlasUv=(vec2(column,row)+withinTile)/vec2(4.0,2.0);
  return wildSrgbToLinear(texture2D(uWildTerrainAtlas,atlasUv).rgb);
}`)
      .replace('#include <color_fragment>',`#include <color_fragment>
float broadVariation=wildNoise(vWildWorldPosition.xz*0.012);
float fineVariation=wildNoise(vWildWorldPosition.xz*0.11);
float slope=1.0-abs(normalize(vWildWorldNormal).y);
float elevation=smoothstep(78.0,155.0,vWildWorldPosition.y);
float woodland=smoothstep(280.0,470.0,length(vWildWorldPosition.xz))*
  (1.0-smoothstep(1160.0,1430.0,length(vWildWorldPosition.xz)));
float trailZ=vWildWorldPosition.x*0.18+
  sin(vWildWorldPosition.x*0.018)*28.0+
  8.0*sin(vWildWorldPosition.x*0.008);
float trailDistance=abs(vWildWorldPosition.z-trailZ+
  (wildNoise(vWildWorldPosition.xz*0.045)-0.5)*1.3);
float trailMask=1.0-smoothstep(2.0,4.1,trailDistance);
float shoreDistance=10000.0;
for(int i=0;i<8;i++){
  if(i<uWildWaterZoneCount){
    vec4 zone=uWildWaterZones[i];
    vec2 outside=max(abs(vWildWorldPosition.xz-zone.xy)-zone.zw,vec2(0.0));
    float signedDistance=length(outside)+min(max(
      abs(vWildWorldPosition.x-zone.x)-zone.z,
      abs(vWildWorldPosition.z-zone.y)-zone.w),0.0);
    shoreDistance=min(shoreDistance,signedDistance);
  }
}
float shoreMask=1.0-smoothstep(1.5,15.0,shoreDistance);
float wetness=1.0-smoothstep(2.0,8.0,shoreDistance);
float dryPatch=smoothstep(0.69,0.84,broadVariation+fineVariation*0.12);
float rockMask=max(smoothstep(0.23,0.61,slope)*(0.48+elevation*0.52),
  smoothstep(148.0,190.0,vWildWorldPosition.y)*0.45);
float snowMask=smoothstep(128.0,172.0,vWildWorldPosition.y)*
  (1.0-smoothstep(0.55,0.88,slope)*0.58);
float mudMask=max(wetness*0.82,woodland*smoothstep(0.66,0.84,fineVariation)*0.24);
float gravelMask=smoothstep(0.49,0.78,fineVariation)*0.34+
  smoothstep(0.12,0.3,slope)*0.18;
float sandMask=shoreMask*(1.0-wetness)*0.66;
float dirtMask=max(trailMask,dryPatch*0.32+woodland*0.12);
vec2 terrainUv=vWildWorldPosition.xz*0.045;
vec3 terrainColor=wildTerrainTile(terrainUv,0.0);
terrainColor=mix(terrainColor,wildTerrainTile(terrainUv,1.0),clamp(dirtMask,0.0,0.92));
terrainColor=mix(terrainColor,wildTerrainTile(terrainUv,2.0),clamp(mudMask,0.0,0.88));
terrainColor=mix(terrainColor,wildTerrainTile(terrainUv,3.0),clamp(gravelMask,0.0,0.62));
terrainColor=mix(terrainColor,wildTerrainTile(terrainUv,5.0),clamp(sandMask,0.0,0.78));
terrainColor=mix(terrainColor,wildTerrainTile(terrainUv,4.0),clamp(rockMask,0.0,0.94));
terrainColor=mix(terrainColor,wildTerrainTile(terrainUv,6.0),clamp(snowMask,0.0,0.96));
terrainColor*=mix(0.78,1.12,broadVariation)*mix(0.94,1.04,fineVariation);
diffuseColor.rgb=terrainColor;`);
  };
  material.customProgramCacheKey=()=> 'wild-country-layered-terrain-v5';
  const compile=material.onBeforeCompile;
  material.onBeforeCompile=shader=>{
    compile(shader);
    compiledTerrainShaders.push(shader);
  };
  material.needsUpdate=true;
}

function terrainSlopeAt(x,z){
  const sampleStep=1.5;
  const slopeX=(terrainHeight(x+sampleStep,z)-terrainHeight(x-sampleStep,z))/(sampleStep*2);
  const slopeZ=(terrainHeight(x,z+sampleStep)-terrainHeight(x,z-sampleStep))/(sampleStep*2);
  return Math.hypot(slopeX,slopeZ);
}

function isGroundCoverClear(x,z,radius){
  const trailZ=x*.18+Math.sin(x*.018)*28+8*Math.sin(x*.008);
  if(Math.abs(z-trailZ)<(radius>1?9:6))return false;
  if(Math.hypot(x-cabinState.centerX,z-cabinState.centerZ)<34+radius)return false;
  if(waterZones.some(zone=>
    x>=zone.minX-radius&&x<=zone.maxX+radius&&
    z>=zone.minZ-radius&&z<=zone.maxZ+radius
  ))return false;
  return !isBlocked(x,z,radius,null,false);
}

function isForestUnderstoryClear(x,z,radius){
  const trailZ=x*.18+Math.sin(x*.018)*28+8*Math.sin(x*.008);
  if(Math.abs(z-trailZ)<6||Math.hypot(x-cabinState.centerX,z-cabinState.centerZ)<34+radius)return false;
  if(waterZones.some(zone=>
    x>=zone.minX-radius&&x<=zone.maxX+radius&&
    z>=zone.minZ-radius&&z<=zone.maxZ+radius
  ))return false;
  const cellX=Math.floor(x/TREE_COLLISION_CELL),cellZ=Math.floor(z/TREE_COLLISION_CELL);
  for(let dx=-1;dx<=1;dx++){
    for(let dz=-1;dz<=1;dz++){
      for(const tree of treeCollisionGrid.get(`${cellX+dx}:${cellZ+dz}`)||[]){
        if(Math.hypot(x-tree.x,z-tree.z)<tree.radius+radius*.35)return false;
      }
    }
  }
  return true;
}

// Detailed terrain mesh with organic height variation.
const groundGeo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 600, 600);
groundGeo.rotateX(-Math.PI / 2);
const pos = groundGeo.attributes.position;
for(let i=0;i<pos.count;i++)pos.setY(i,terrainHeight(pos.getX(i),pos.getZ(i)));
groundGeo.computeVertexNormals();

const ground=new THREE.Mesh(groundGeo,new THREE.MeshStandardMaterial({
  color:0xffffff,roughness:.96,metalness:0
}));
addNaturalTerrainShader(ground.material,true);
ground.receiveShadow=true;ground.name='Natural terrain';scene.add(ground);

// Color terrain zones subtly by height and slope: grass in lowlands, soil on steep ridges.
const colors=new Float32Array(pos.count*3);
for(let i=0;i<pos.count;i++){
  const x=pos.getX(i),z=pos.getZ(i),y=pos.getY(i);
  const hx=terrainHeight(x+.75,z)-terrainHeight(x-.75,z),hz=terrainHeight(x,z+.75)-terrainHeight(x,z-.75);
  const slope=Math.sqrt(hx*hx+hz*hz)/1.5;
  const soil=Math.max(0,Math.min(.72,(slope-.08)*3.2+(y>32?(y-32)*.012:0)));
  const distance=Math.hypot(x,z);
  const palette=distance<BIOME_BOUNDS.valley
    ?[.95,.98,.85]
    :distance<BIOME_BOUNDS.firstMountain
      ?[.91,.94,.87]
      :distance<BIOME_BOUNDS.pineForest
        ?[.82,.94,.82]
        :distance<BIOME_BOUNDS.secondMountain
          ?[.92,.94,.87]
          :x>=0
            ?[.89,.96,.81]
            :[.94,.96,.86];
  colors[i*3]=palette[0]*(1-soil)+.72*soil;
  colors[i*3+1]=palette[1]*(1-soil)+.69*soil;
  colors[i*3+2]=palette[2]*(1-soil)+.58*soil;
}
groundGeo.setAttribute('color',new THREE.BufferAttribute(colors,3));ground.material.vertexColors=true;

function refreshGroundForLandscape(){
  const position=groundGeo.attributes.position;
  for(let i=0;i<position.count;i++){
    const x=position.getX(i),z=position.getZ(i);
    const sampled=sampleLandscapeHeight(x,z);
    const height=sampled??proceduralTerrainHeight(x,z);
    position.setY(i,height-.025);
    const hx=terrainHeight(x+2,z)-terrainHeight(x-2,z);
    const hz=terrainHeight(x,z+2)-terrainHeight(x,z-2);
    const slope=Math.min(1,Math.hypot(hx,hz)/4);
    const soil=THREE.MathUtils.clamp((slope-.08)*1.1+(height>46?(height-46)*.004:0),0,.72);
    const distance=Math.hypot(x,z);
    const palette=distance<BIOME_BOUNDS.valley
      ?[.95,.98,.85]
      :distance<BIOME_BOUNDS.firstMountain
        ?[.91,.94,.87]
        :distance<BIOME_BOUNDS.pineForest
          ?[.82,.94,.82]
          :distance<BIOME_BOUNDS.secondMountain
            ?[.92,.94,.87]
            :[.91,.96,.83];
    const colorIndex=i*3;
    colors[colorIndex]=palette[0]*(1-soil)+.72*soil;
    colors[colorIndex+1]=palette[1]*(1-soil)+.69*soil;
    colors[colorIndex+2]=palette[2]*(1-soil)+.58*soil;
  }
  position.needsUpdate=true;
  groundGeo.attributes.color.needsUpdate=true;
  groundGeo.computeVertexNormals();
  groundGeo.computeBoundingSphere();
}

function renderedGroundHeight(x,z){
  const segments=600,verticesPerSide=segments+1,step=WORLD_SIZE/segments;
  const gridX=THREE.MathUtils.clamp((x+WORLD_HALF)/step,0,segments);
  const gridZ=THREE.MathUtils.clamp((z+WORLD_HALF)/step,0,segments);
  const x0=Math.min(segments-1,Math.floor(gridX));
  const z0=Math.min(segments-1,Math.floor(gridZ));
  const tx=gridX-x0,tz=gridZ-z0;
  const heights=groundGeo.attributes.position;
  const h00=heights.getY(z0*verticesPerSide+x0);
  const h10=heights.getY(z0*verticesPerSide+x0+1);
  const h01=heights.getY((z0+1)*verticesPerSide+x0);
  const h11=heights.getY((z0+1)*verticesPerSide+x0+1);
  return tx+tz<=1
    ?h00+tx*(h10-h00)+tz*(h01-h00)
    :h11+(1-tz)*(h10-h11)+(1-tx)*(h01-h11);
}

function refreshTerrainAnchors(){
  for(const anchor of terrainAnchoredObjects){
    anchor.object.position.y=terrainHeight(anchor.x,anchor.z)+anchor.offset;
  }
  for(const instances of [grass,bushes,leafLitter,needleLitter]){
    const anchors=instances.userData.terrainAnchors;
    let visibleCount=0;
    for(let i=0;i<anchors.length;i++){
      const anchor=anchors[i];
      const matrix=new THREE.Matrix4();
      instances.getMatrixAt(i,matrix);
      const position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
      matrix.decompose(position,rotation,scale);
      const baseScale=new THREE.Vector3(...anchor.baseScale);
      const isGrass=instances===grass;
      const isBush=instances===bushes;
      const isLitter=instances===leafLitter||instances===needleLitter;
      const groundHeight=terrainHeight(anchor.x,anchor.z);
      const visible=terrainSlopeAt(anchor.x,anchor.z)<=(isGrass?.38:isBush?.58:.48)&&
        (isBush
          ?isForestUnderstoryClear(anchor.x,anchor.z,.65)
          :isGroundCoverClear(anchor.x,anchor.z,isGrass?.28:.12));
      const sampleStep=1.5;
      const normal=new THREE.Vector3(
        terrainHeight(anchor.x-sampleStep,anchor.z)-terrainHeight(anchor.x+sampleStep,anchor.z),
        sampleStep*2,
        terrainHeight(anchor.x,anchor.z-sampleStep)-terrainHeight(anchor.x,anchor.z+sampleStep)
      ).normalize();
      const groundAlignment=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),normal);
      const localYaw=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),anchor.yaw);
      rotation.copy(groundAlignment).multiply(localYaw);
      position.y=isGrass?groundHeight:isBush?groundHeight+baseScale.y*.32*.76:groundHeight+.025;
      if(visible)scale.copy(baseScale);
      else scale.setScalar(0);
      if(visible)visibleCount++;
      instances.setMatrixAt(i,matrix.compose(position,rotation,scale));
      anchor.baseY=groundHeight;
    }
    instances.userData.visibleGroundCoverCount=visibleCount;
    instances.instanceMatrix.needsUpdate=true;
    instances.computeBoundingSphere();
  }
  for(const object of scene.children){
    if(!object.isInstancedMesh||!object.userData.terrainAnchors||object===grass||object===bushes)continue;
    const anchors=object.userData.terrainAnchors;
    for(let i=0;i<anchors.length;i++){
      const anchor=anchors[i],matrix=new THREE.Matrix4();
      object.getMatrixAt(i,matrix);
      matrix.elements[13]+=terrainHeight(anchor.x,anchor.z)-anchor.baseY;
      anchor.baseY=terrainHeight(anchor.x,anchor.z);
      object.setMatrixAt(i,matrix);
    }
    object.instanceMatrix.needsUpdate=true;
    object.computeBoundingSphere();
  }
  const trailPositions=trailGeo.attributes.position;
  for(let i=0;i<trailPositions.count;i++){
    trailPositions.setY(i,terrainHeight(trailPositions.getX(i),trailPositions.getZ(i))+.08);
  }
  trailPositions.needsUpdate=true;
  trailGeo.computeVertexNormals();
  trailGeo.computeBoundingSphere();
}

function createGrassClumpGeometry(){
  const positions=[],indices=[];
  const bladeCount=5;
  for(let blade=0;blade<bladeCount;blade++){
    const angle=blade*Math.PI/bladeCount;
    const directionX=Math.cos(angle),directionZ=Math.sin(angle);
    const sideX=-directionZ,sideZ=directionX;
    const offset=.055*(blade%2===0?1:-1);
    const levels=[
      {height:0,width:.045,bend:0},
      {height:.42,width:.032,bend:.09},
      {height:.82,width:0,bend:.19}
    ];
    for(const level of levels){
      const centerX=directionX*(offset+level.bend);
      const centerZ=directionZ*(offset+level.bend);
      positions.push(
        centerX-sideX*level.width,level.height,centerZ-sideZ*level.width,
        centerX+sideX*level.width,level.height,centerZ+sideZ*level.width
      );
    }
    const base=blade*6;
    indices.push(base,base+1,base+2,base+1,base+3,base+2,
      base+2,base+3,base+4,base+3,base+5,base+4);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

// Each instance is a rooted clump of bent blades, rather than a cone that
// floats above the terrain. Anchors retain their original scale for filtering.
const grassGeo=createGrassClumpGeometry();
const grassWindUniform={value:0};
const dogGrassClearancePosition={value:new THREE.Vector3()};
const dogGrassClearanceRadius={value:0};
const grassMat=new THREE.MeshStandardMaterial({color:0x739951,roughness:1,side:THREE.DoubleSide});
grassMat.onBeforeCompile=shader=>{
  shader.uniforms.uWildWindTime=grassWindUniform;
  shader.uniforms.uDogGrassClearancePosition=dogGrassClearancePosition;
  shader.uniforms.uDogGrassClearanceRadius=dogGrassClearanceRadius;
  shader.vertexShader=shader.vertexShader
    .replace('#include <common>','#include <common>\nuniform float uWildWindTime;\nuniform vec3 uDogGrassClearancePosition;\nuniform float uDogGrassClearanceRadius;')
    .replace('#include <begin_vertex>',`#include <begin_vertex>
float windPhase=uWildWindTime*1.35+instanceMatrix[3].x*0.055+instanceMatrix[3].z*0.047;
transformed.x+=sin(windPhase+position.y*1.8)*position.y*0.055;
transformed.z+=cos(windPhase*0.73+position.y*1.4)*position.y*0.025;
float dogGrassDistance=distance(instanceMatrix[3].xz,uDogGrassClearancePosition.xz);
float dogGrassMask=1.0-smoothstep(uDogGrassClearanceRadius-0.2,uDogGrassClearanceRadius,dogGrassDistance);
transformed.y-=dogGrassMask;`);
};
grassMat.customProgramCacheKey=()=> 'wild-country-grass-wind-v1';
const grass=new THREE.InstancedMesh(grassGeo,grassMat,15000);
grass.receiveShadow=true;grass.castShadow=false;
const dummy=new THREE.Object3D();let grassIndex=0;
grass.userData.terrainAnchors=[];
for(let i=0;i<50000&&grassIndex<15000;i++){
  const distribution=Math.random();
  const span=distribution<.58?300:distribution<.86?1500*WORLD_SCALE:WORLD_SIZE-300;
  const x=(Math.random()-.5)*span,z=(Math.random()-.5)*span;
  if(Math.hypot(x,z)<22||terrainSlopeAt(x,z)>.38||!isGroundCoverClear(x,z,.28))continue;
  const y=terrainHeight(x,z),yaw=Math.random()*Math.PI*2;
  const baseScale=[.65+Math.random()*.9,.4+Math.random()*.45,.65+Math.random()*.9];
  dummy.position.set(x,y,z);
  dummy.rotation.set(0,yaw,0);
  dummy.scale.set(...baseScale);
  dummy.updateMatrix();
  grass.setMatrixAt(grassIndex,dummy.matrix);
  grass.userData.terrainAnchors.push({x,z,yaw,baseScale,baseY:y});
  grassIndex++;
}
grass.count=grassIndex;scene.add(grass);

// Instanced small fern/bush clusters.
const bushGeo=new THREE.IcosahedronGeometry(.32,1);const bushMat=new THREE.MeshStandardMaterial({color:0x3f6638,roughness:.95});
const bushes=new THREE.InstancedMesh(bushGeo,bushMat,750);bushes.castShadow=true;bushes.receiveShadow=true;let bushIndex=0;
bushes.userData.terrainAnchors=[];
for(let i=0;i<1400&&bushIndex<750;i++){
  const span=i%3===0?WORLD_SIZE-300:1600*WORLD_SCALE;
  const x=(Math.random()-.5)*span,z=(Math.random()-.5)*span;
  if(Math.hypot(x,z)<20||terrainSlopeAt(x,z)>.58||!isGroundCoverClear(x,z,.65))continue;
  const y=terrainHeight(x,z),yaw=Math.random()*Math.PI*2;
  const baseScale=[.55+Math.random()*1.7,.45+Math.random()*1.3,.55+Math.random()*1.7];
  dummy.position.set(x,y+baseScale[1]*.32*.76,z);
  dummy.rotation.set(0,yaw,0);
  dummy.scale.set(...baseScale);
  dummy.updateMatrix();
  bushes.setMatrixAt(bushIndex,dummy.matrix);
  bushes.userData.terrainAnchors.push({x,z,yaw,baseScale,baseY:y});
  registerRockCollision(x,z,Math.max(baseScale[0],baseScale[2])*.27);
  bushIndex++;
}
bushes.count=bushIndex;scene.add(bushes);

function makeLitterGeometry(width,depth){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([
    -width,0,0, 0,0,depth, width,0,0, 0,0,-depth
  ],3));
  geometry.setIndex([0,1,3,1,2,3]);
  geometry.computeVertexNormals();
  return geometry;
}

function createForestFloorLitter(count,geometry,colors){
  const material=new THREE.MeshStandardMaterial({
    color:0xffffff,roughness:1,side:THREE.DoubleSide
  });
  const instances=new THREE.InstancedMesh(geometry,material,count);
  instances.castShadow=false;
  instances.receiveShadow=false;
  instances.userData.terrainAnchors=[];
  const forestFloor=(x,z)=>{
    const distance=Math.hypot(x,z);
    return (distance>BIOME_BOUNDS.firstMountain+45&&distance<BIOME_BOUNDS.pineForest-35)||
      distance>BIOME_BOUNDS.secondMountain+20;
  };
  const dummy=new THREE.Object3D();
  let placed=0,attempts=0;
  while(placed<count&&attempts<count*14){
    attempts++;
    const x=(Math.random()-.5)*(WORLD_SIZE-100);
    const z=(Math.random()-.5)*(WORLD_SIZE-100);
    if(!forestFloor(x,z)||terrainSlopeAt(x,z)>.48||!isGroundCoverClear(x,z,.12))continue;
    const yaw=Math.random()*Math.PI*2;
    const scale=.45+Math.random()*1.25;
    const baseScale=[scale,.08+Math.random()*.05,scale];
    const y=terrainHeight(x,z);
    dummy.position.set(x,y+.025,z);
    dummy.rotation.set(0,yaw,0);
    dummy.scale.set(...baseScale);
    dummy.updateMatrix();
    instances.setMatrixAt(placed,dummy.matrix);
    instances.setColorAt(placed,new THREE.Color(colors[Math.floor(Math.random()*colors.length)]));
    instances.userData.terrainAnchors.push({x,z,yaw,baseScale,baseY:y});
    placed++;
  }
  instances.count=placed;
  instances.instanceMatrix.needsUpdate=true;
  if(instances.instanceColor)instances.instanceColor.needsUpdate=true;
  instances.computeBoundingSphere();
  scene.add(instances);
  return instances;
}

const leafLitter=createForestFloorLitter(
  1800,makeLitterGeometry(.16,.23),[0x5c462d,0x765633,0x8b6841,0x4e4934,0x9a7849]
);
const needleLitter=createForestFloorLitter(
  2600,makeLitterGeometry(.27,.025),[0x39402a,0x4c4a2d,0x6a5631,0x5d6338]
);

function registerTreePlacement(type,x,z,scale){
  const widthScale=.84+Math.random()*.32;
  const heightScale=.82+Math.random()*.38;
  const radius=1.15*scale*widthScale;
  if(Math.hypot(x-cabinState.centerX,z-cabinState.centerZ)<38)return false;
  if(terrainSlopeAt(x,z)>.78||!isGroundCoverClear(x,z,Math.max(1.5,radius)))return false;
  const tint=.92+Math.random()*.16;
  const tree={type,x,z,scale,widthScale,heightScale,tint,radius};
  tree.yaw=Math.random()*Math.PI*2;
  treePlacements.push(tree);
  treeData.push(tree);
  const cellX=Math.floor(x/TREE_COLLISION_CELL),cellZ=Math.floor(z/TREE_COLLISION_CELL);
  const key=`${cellX}:${cellZ}`;
  if(!treeCollisionGrid.has(key))treeCollisionGrid.set(key,[]);
  treeCollisionGrid.get(key).push(tree);
  return true;
}

function filterTreePlacementsForWater(){
  const originalCount=treePlacements.length;
  const valid=treePlacements.filter(tree=>{
    const clearance=tree.radius+1;
    return !waterZones.some(zone=>
      tree.x>=zone.minX-clearance&&tree.x<=zone.maxX+clearance&&
      tree.z>=zone.minZ-clearance&&tree.z<=zone.maxZ+clearance
    );
  });
  treePlacements.splice(0,treePlacements.length,...valid);
  treeData.splice(0,treeData.length,...valid);
  treeCollisionGrid.clear();
  for(const tree of valid){
    const cellX=Math.floor(tree.x/TREE_COLLISION_CELL),cellZ=Math.floor(tree.z/TREE_COLLISION_CELL);
    const key=`${cellX}:${cellZ}`;
    if(!treeCollisionGrid.has(key))treeCollisionGrid.set(key,[]);
    treeCollisionGrid.get(key).push(tree);
  }
  const removed=originalCount-valid.length;
  if(removed)console.info(`[Wild Country] Removed ${removed} tree placements inside mapped water zones.`);
}

function scatterTreeRegion(type,count,minRadius,maxRadius,accept=()=>true){
  const minSquared=minRadius*minRadius,maxSquared=maxRadius*maxRadius;
  let placed=0,attempts=0;
  while(placed<count&&attempts<count*5){
    attempts++;
    const angle=Math.random()*Math.PI*2;
    const radius=Math.sqrt(minSquared+Math.random()*(maxSquared-minSquared));
    const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
    if(!accept(x,z))continue;
    if(registerTreePlacement(type,x,z,.78+Math.random()*.62))placed++;
  }
}

function scatterTreeAcrossWorld(type,count){
  let placed=0,attempts=0;
  while(placed<count&&attempts<count*8){
    attempts++;
    const x=(Math.random()-.5)*(WORLD_SIZE-100);
    const z=(Math.random()-.5)*(WORLD_SIZE-100);
    if(registerTreePlacement(type,x,z,.78+Math.random()*.62))placed++;
  }
  console.info(`[Wild Country] Placed ${placed}/${count} world-wide ${type} trees.`);
}

for(let i=0;i<360;i++) {
  const x=(Math.random()-.5)*720*WORLD_SCALE,z=(Math.random()-.5)*720*WORLD_SCALE;
  if(Math.hypot(x,z)<32)continue;
  const meadow=1-Math.min(1,Math.exp(-(Math.abs(z-x*.18+8*Math.sin(x*.025)))/18));
  if(Math.random()>meadow*.72+.28)continue;
  registerTreePlacement('trees',x,z,.72+Math.random()*.62);
}
scatterTreeRegion('pine',900,BIOME_BOUNDS.firstMountain+70,BIOME_BOUNDS.pineForest-25);
scatterTreeRegion('spruce',180,BIOME_BOUNDS.firstMountain+70,BIOME_BOUNDS.pineForest-25);
scatterTreeRegion('fir',180,BIOME_BOUNDS.firstMountain+70,BIOME_BOUNDS.pineForest-25);
scatterTreeRegion('trees',1100,BIOME_BOUNDS.secondMountain+35,WORLD_HALF-45,(x)=>x>=0);
scatterTreeRegion('tree',1100,BIOME_BOUNDS.secondMountain+35,WORLD_HALF-45,(x)=>x<0);
scatterTreeRegion('oak',240,BIOME_BOUNDS.secondMountain+35,WORLD_HALF-45,(x)=>x>=0);
scatterTreeRegion('birch',240,BIOME_BOUNDS.secondMountain+35,WORLD_HALF-45,(x)=>x<0);
scatterTreeRegion('poplar',180,BIOME_BOUNDS.secondMountain+35,WORLD_HALF-45);
scatterTreeAcrossWorld('birch',5200);
scatterTreeRegion('birch',300,75,330);

// Natural winding dirt trail, built directly over the terrain height function.
const trailPositions=[],trailIndices=[],trailUvs=[];
function trailPoint(t){const x=t;return new THREE.Vector3(x,.25, x*.18+Math.sin(x*.018/WORLD_SCALE)*28*WORLD_SCALE+8*WORLD_SCALE*Math.sin(x*.008/WORLD_SCALE));}
const TRAIL_EXTENT=WORLD_HALF-45;
const trailSegments=900;
for(let i=0;i<=trailSegments;i++){
  const t=-TRAIL_EXTENT+i*(TRAIL_EXTENT*2/trailSegments),point=trailPoint(t);
  const ahead=trailPoint(Math.min(TRAIL_EXTENT,t+5)),direction=ahead.clone().sub(point).normalize();
  const side=new THREE.Vector3(-direction.z,0,direction.x).normalize();
  const width=2.1+.7*Math.sin(i*.11);
  for(const sign of [-1,1]){
    const p=point.clone().addScaledVector(side,sign*width);
    const y=terrainHeight(p.x,p.z)+.08;p.y=y;trailPositions.push(p.x,p.y,p.z);trailUvs.push(sign===-1?0:1,i/trailSegments);
  }
  if(i<trailSegments){const base=i*2;trailIndices.push(base,base+2,base+1,base+1,base+2,base+3);}
}
const trailGeo=new THREE.BufferGeometry();trailGeo.setAttribute('position',new THREE.Float32BufferAttribute(trailPositions,3));trailGeo.setAttribute('uv',new THREE.Float32BufferAttribute(trailUvs,2));trailGeo.setIndex(trailIndices);trailGeo.computeVertexNormals();
const trailMaterial=new THREE.MeshStandardMaterial({
  color:0xffffff,roughness:1,side:THREE.DoubleSide
});
addNaturalTerrainShader(trailMaterial);
const trail=new THREE.Mesh(trailGeo,trailMaterial);trail.receiveShadow=true;scene.add(trail);

// Rocks
const rockMat=new THREE.MeshStandardMaterial({color:0x777b72,roughness:.95});
for(let i=0;i<150;i++) {
  const x=(Math.random()-.5)*(WORLD_SIZE-300),z=(Math.random()-.5)*(WORLD_SIZE-300);
  const size=.5+Math.random()*2.8;
  const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(size,1),rockMat);
  rock.position.set(x,terrainHeight(x,z)+size*.12,z);rock.scale.set(1.1+Math.random(),.45+Math.random()*.45,.8+Math.random());
  rock.rotation.set(Math.random(),Math.random(),Math.random()); rock.castShadow=true;rock.receiveShadow=true;scene.add(rock);
  registerTerrainAnchor(rock,x,z,size*.12);
  registerRockCollision(x,z,size*Math.max(rock.scale.x,rock.scale.z)*.85);
}
const branchMat=new THREE.MeshStandardMaterial({color:0x58432e,roughness:1});
for(let i=0;i<65;i++){
  const x=(Math.random()-.5)*(WORLD_SIZE-300),z=(Math.random()-.5)*(WORLD_SIZE-300);
  const branch=new THREE.Mesh(new THREE.CylinderGeometry(.06,.13,1.8+Math.random()*2.2,7),branchMat);
  branch.position.set(x,terrainHeight(x,z)+.12,z);branch.rotation.set(.05,Math.random()*Math.PI,.55+(Math.random()-.5)*.35);branch.castShadow=true;branch.receiveShadow=true;scene.add(branch);
  registerTerrainAnchor(branch,x,z,.12);
  registerRockCollision(x,z,.55);
}

function addRanch(){
  const centerX=90,centerZ=90,halfWidth=20,halfDepth=18;
  const wood=new THREE.MeshStandardMaterial({color:0x68472f,roughness:.92});
  const darkWood=new THREE.MeshStandardMaterial({color:0x3e3025,roughness:.96});
  const roofMaterial=new THREE.MeshStandardMaterial({color:0x55463c,roughness:.9});
  cabinThemeMaterials.wood.push(wood,darkWood);
  cabinThemeMaterials.roof.push(roofMaterial);
  const postGeometry=new THREE.BoxGeometry(.2,1.45,.2);
  const railX=new THREE.BoxGeometry(4,.13,.16);
  const railZ=new THREE.BoxGeometry(.16,.13,4);
  for(const z of [centerZ-halfDepth,centerZ+halfDepth]){
    for(let x=centerX-halfWidth;x<=centerX+halfWidth;x+=4){
      if(z===centerZ+halfDepth&&Math.abs(x-centerX)<.01)continue;
      const post=new THREE.Mesh(postGeometry,wood);
      post.position.set(x,terrainHeight(x,z)+.72,z);post.castShadow=true;scene.add(post);
      registerTerrainAnchor(post,x,z,.72);
    }
    for(const y of [.48,1.05]){
      for(let x=centerX-halfWidth+2;x<centerX+halfWidth;x+=4){
        if(z===centerZ+halfDepth&&Math.abs(x-centerX)<5)continue;
        const rail=new THREE.Mesh(railX,wood);
        rail.position.set(x,terrainHeight(x,z)+y,z);rail.castShadow=true;scene.add(rail);
        registerTerrainAnchor(rail,x,z,y);
      }
    }
    if(z===centerZ-halfDepth)registerCollisionSegment(centerX-halfWidth,z,centerX+halfWidth,z,.16);
    else{
      registerCollisionSegment(centerX-halfWidth,z,centerX-ranchGateState.width/2,z,.16);
      registerCollisionSegment(centerX+ranchGateState.width/2,z,centerX+halfWidth,z,.16);
    }
  }
  for(const x of [centerX-halfWidth,centerX+halfWidth]){
    for(let z=centerZ-halfDepth+4;z<centerZ+halfDepth;z+=4){
      const post=new THREE.Mesh(postGeometry,wood);
      post.position.set(x,terrainHeight(x,z)+.72,z);post.castShadow=true;scene.add(post);
      registerTerrainAnchor(post,x,z,.72);
    }
    for(const y of [.48,1.05]){
      for(let z=centerZ-halfDepth+2;z<centerZ+halfDepth;z+=4){
        const rail=new THREE.Mesh(railZ,wood);
        rail.position.set(x,terrainHeight(x,z)+y,z);rail.castShadow=true;scene.add(rail);
        registerTerrainAnchor(rail,x,z,y);
      }
    }
    registerCollisionSegment(x,centerZ-halfDepth,x,centerZ+halfDepth,.16);
  }
  for(const x of [centerX-ranchGateState.width/2,centerX+ranchGateState.width/2]){
    const post=new THREE.Mesh(postGeometry,wood);
    post.position.set(x,terrainHeight(x,centerZ+halfDepth)+.72,centerZ+halfDepth);
    post.castShadow=true;
    scene.add(post);
    registerTerrainAnchor(post,x,centerZ+halfDepth,.72);
  }
  for(const x of [centerX-3,centerX+3]){
    for(const y of [.48,1.05]){
      const rail=new THREE.Mesh(new THREE.BoxGeometry(2,.13,.16),wood);
      rail.position.set(x,terrainHeight(x,centerZ+halfDepth)+y,centerZ+halfDepth);
      rail.castShadow=true;
      scene.add(rail);
      registerTerrainAnchor(rail,x,centerZ+halfDepth,y);
    }
  }

  const gateHinge=new THREE.Group();
  gateHinge.position.set(centerX-ranchGateState.width/2,terrainHeight(centerX,centerZ+halfDepth),centerZ+halfDepth);
  scene.add(gateHinge);
  const gateMaterial=wood.clone();
  const gateBeam=(geometry,x,y,z,rotationZ=0)=>{
    const beam=new THREE.Mesh(geometry,gateMaterial);
    beam.position.set(x,y,z);
    beam.rotation.z=rotationZ;
    beam.castShadow=true;
    beam.receiveShadow=true;
    gateHinge.add(beam);
    return beam;
  };
  for(const y of [.48,1.05])gateBeam(new THREE.BoxGeometry(ranchGateState.width,.13,.16),ranchGateState.width/2,y,0);
  gateBeam(new THREE.BoxGeometry(.16,1.45,.16),0,.72,0);
  gateBeam(new THREE.BoxGeometry(.16,1.45,.16),ranchGateState.width,.72,0);
  gateBeam(new THREE.BoxGeometry(4.2,.11,.14),ranchGateState.width/2,.77,0,Math.atan2(.48,ranchGateState.width));
  ranchGateState.hinge=gateHinge;
  registerTerrainAnchor(gateHinge,centerX,centerZ+halfDepth,0);

  const cabin=new THREE.Group();
  const floorY=terrainHeight(centerX,centerZ);
  cabinState.floorY=floorY;
  const cabinWood=new THREE.MeshStandardMaterial({color:0x765034,roughness:.88});
  const sidingMaterials=[
    new THREE.MeshStandardMaterial({color:0x805a3b,roughness:.9}),
    new THREE.MeshStandardMaterial({color:0x6f4c33,roughness:.92})
  ];
  cabinThemeMaterials.wood.push(cabinWood);
  cabinThemeMaterials.siding.push(...sidingMaterials);
  const trim=new THREE.MeshStandardMaterial({color:0x35251b,roughness:.82});
  const floorMat=new THREE.MeshStandardMaterial({color:0x8b6846,roughness:.94});
  const bedding=new THREE.MeshStandardMaterial({color:0x7d4835,roughness:.98});
  const glass=new THREE.MeshStandardMaterial({color:0x8ab4c2,roughness:.2,metalness:.08,transparent:true,opacity:.48,emissive:0x203945,emissiveIntensity:.2,side:THREE.DoubleSide});
  const addBox=(parent,geometry,material,x,y,z,rotationY=0)=>{
    const mesh=new THREE.Mesh(geometry,material);
    mesh.position.set(x,y,z);
    mesh.rotation.y=rotationY;
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    parent.add(mesh);
    return mesh;
  };
  addBox(cabin,new THREE.BoxGeometry(14.4,.4,10.4),floorMat,0,.4,0);
  for(let z=-4.5;z<=4.51;z+=.65){
    addBox(cabin,new THREE.BoxGeometry(13.9,.035,.035),trim,0,.62,z);
  }

  const wall=(x,y,z,width,height,depth,material=cabinWood)=>
    addBox(cabin,new THREE.BoxGeometry(width,height,depth),material,x,y,z);
  wall(0,3.5,-4.92,14,7,.22);
  wall(-3.8,3.5,4.92,6.4,7,.22);
  wall(3.8,3.5,4.92,6.4,7,.22);
  const doorHeight=2.45;
  const doorwayHeaderBottom=doorHeight/CABIN_HEIGHT_SCALE;
  wall(0,(7+doorwayHeaderBottom)/2,4.92,4,7-doorwayHeaderBottom,.22);
  for(const side of [-1,1]){
    wall(side*6.92,3.5,-3.25,.22,7,3.5);
    wall(side*6.92,3.5,3.25,.22,7,3.5);
    wall(side*6.92,1,.0,.22,2,3.5);
    wall(side*6.92,6.1,.0,.22,1.8,3.5);
    const windowFrame=new THREE.Group();
    windowFrame.name='Cabin window frame';
    windowFrame.position.set(side*6.79,4.2,0);
    windowFrame.scale.y=1/CABIN_HEIGHT_SCALE;
    cabin.add(windowFrame);
    addBox(windowFrame,new THREE.BoxGeometry(.12,2.55,3.05),glass,0,0,0);
    for(const z of [-1.62,1.62])addBox(windowFrame,new THREE.BoxGeometry(.22,2.9,.18),trim,0,0,z);
    for(const y of [-1.47,1.47])addBox(windowFrame,new THREE.BoxGeometry(.22,.18,3.3),trim,0,y,0);
    addBox(windowFrame,new THREE.BoxGeometry(.16,2.65,.12),trim,0,0,0);
    addBox(windowFrame,new THREE.BoxGeometry(.16,.12,3.1),trim,0,0,0);
  }
  let boardIndex=0;
  for(let y=.55;y<6.9;y+=.82){
    const material=sidingMaterials[boardIndex++%sidingMaterials.length];
    addBox(cabin,new THREE.BoxGeometry(13.85,.075,.075),material,0,y,-5.04);
    addBox(cabin,new THREE.BoxGeometry(13.85,.075,.075),material,0,y,-4.8);
    const frontHeader=y>=4.05;
    if(frontHeader){
      addBox(cabin,new THREE.BoxGeometry(13.85,.075,.075),material,0,y,5.04);
      addBox(cabin,new THREE.BoxGeometry(13.85,.075,.075),material,0,y,4.8);
    }else{
      for(const side of [-1,1]){
        addBox(cabin,new THREE.BoxGeometry(6.4,.075,.075),material,side*3.8,y,5.04);
        addBox(cabin,new THREE.BoxGeometry(6.4,.075,.075),material,side*3.8,y,4.8);
      }
    }
    for(const side of [-1,1]){
      for(const z of [-3.25,3.25]){
        addBox(cabin,new THREE.BoxGeometry(.075,.075,3.3),material,side*7.04,y,z);
        addBox(cabin,new THREE.BoxGeometry(.075,.075,3.3),material,side*6.8,y,z);
      }
    }
  }
  const gableGeometry=new THREE.BufferGeometry();
  gableGeometry.setAttribute('position',new THREE.Float32BufferAttribute([
    -5,7,0, 5,7,0, 0,9.1,0
  ],3));
  gableGeometry.setIndex([0,1,2]);
  gableGeometry.computeVertexNormals();
  const gableMaterial=cabinWood.clone();gableMaterial.side=THREE.DoubleSide;
  for(const x of [-6.91,6.91]){
    const gable=new THREE.Mesh(gableGeometry,gableMaterial);
    gable.position.x=x;gable.rotation.y=Math.PI/2;
    gable.castShadow=true;gable.receiveShadow=true;cabin.add(gable);
  }

  const doorHinge=new THREE.Group();
  doorHinge.name='Cabin entry door';
  doorHinge.position.set(-cabinState.doorWidth/2,0,5.04);
  doorHinge.scale.y=1/CABIN_HEIGHT_SCALE;
  cabin.add(doorHinge);
  const door=addBox(doorHinge,new THREE.BoxGeometry(cabinState.doorWidth,doorHeight,.24),darkWood,cabinState.doorWidth/2,doorHeight/2,0);
  addBox(doorHinge,new THREE.BoxGeometry(.08,doorHeight-.2,.06),cabinWood,.1,doorHeight/2,.15);
  addBox(doorHinge,new THREE.BoxGeometry(.08,doorHeight-.2,.06),cabinWood,1.1,doorHeight/2,.15);
  const knob=new THREE.Mesh(new THREE.SphereGeometry(.11,10,8),new THREE.MeshStandardMaterial({color:0xb39a61,metalness:.72,roughness:.28}));
  knob.position.set(1.05,doorHeight/2,.2);doorHinge.add(knob);
  for(const y of [.25,doorHeight-.25]){
    const hingePin=addBox(doorHinge,new THREE.BoxGeometry(.14,.28,.3),trim,0,y,-.04);
    hingePin.castShadow=false;
  }
  cabinState.doorHinge=doorHinge;
  cabinState.doorMesh=door;

  const roofA=addBox(cabin,new THREE.BoxGeometry(15,.34,5.8),roofMaterial,0,7.98,-2.5);
  roofA.rotation.x=-.423;
  const roofB=addBox(cabin,new THREE.BoxGeometry(15,.34,5.8),roofMaterial,0,7.98,2.5);
  roofB.rotation.x=.423;
  for(const x of [-7.3,7.3]){
    addBox(cabin,new THREE.BoxGeometry(.2,.25,10.4),trim,x,6.85,0);
  }
  for(const z of [-5.2,5.2]){
    addBox(cabin,new THREE.BoxGeometry(14.8,.22,.2),trim,0,6.85,z);
  }

  cabin.scale.y=.35;
  const furnishings=new THREE.Group();
  furnishings.name='Cabin furnishings';
  furnishings.scale.y=1/.35;
  cabin.add(furnishings);
  const bunk=new THREE.Group();
  bunk.position.set(-4.2,0,-1.55);
  furnishings.add(bunk);
  const frameMat=trim;
  for(const x of [-.9,.9]){
    for(const z of [-1.45,1.45]){
      addBox(bunk,new THREE.BoxGeometry(.13,2.25,.13),frameMat,x,1.125,z);
    }
  }
  for(const level of [.3,1.35]){
    addBox(bunk,new THREE.BoxGeometry(2,.16,3),frameMat,0,level,-.1);
    addBox(bunk,new THREE.BoxGeometry(1.86,.2,2.82),floorMat,0,level+.18,-.1);
    addBox(bunk,new THREE.BoxGeometry(1.82,.12,2.12),bedding,0,level+.34,.25);
    addBox(bunk,new THREE.BoxGeometry(.72,.12,.55),new THREE.MeshStandardMaterial({color:0xd6c6a9,roughness:1}),0,level+.46,-.92);
    addBox(bunk,new THREE.BoxGeometry(2,.36,.16),cabinWood,0,level+.26,-1.57);
    addBox(bunk,new THREE.BoxGeometry(2,.36,.16),cabinWood,0,level+.26,1.37);
  }
  for(let step=0;step<4;step++){
    const y=.35+step*.29;
    addBox(bunk,new THREE.BoxGeometry(.1,.1,.78),frameMat,1.08,y,1.25-step*.12);
  }
  cabinInteriorColliders.push({x:centerX-4.2*CABIN_SCALE_XZ,z:centerZ-1.55*CABIN_SCALE_XZ,radius:1.35*CABIN_SCALE_XZ});

  addBox(furnishings,new THREE.BoxGeometry(2.2,.12,1.15),cabinWood,1.5,.78,.5);
  for(const x of [.7,2.3])for(const z of [.15,.85])addBox(furnishings,new THREE.BoxGeometry(.12,.78,.12),trim,x,.39,z);
  addBox(furnishings,new THREE.BoxGeometry(1.7,.14,.75),trim,1.5,.48,3.8);
  for(const x of [.85,2.15])addBox(furnishings,new THREE.BoxGeometry(.12,.48,.12),trim,x,.24,3.8);
  addBox(furnishings,new THREE.BoxGeometry(.28,2.1,2.5),cabinWood,6.65,1.05,-2.7);
  for(const y of [.5,1.05,1.6])addBox(furnishings,new THREE.BoxGeometry(.36,.1,2.35),trim,6.45,y,-2.7);
  cabinInteriorColliders.push(
    {x:centerX+1.5*CABIN_SCALE_XZ,z:centerZ+.5*CABIN_SCALE_XZ,radius:1.2*CABIN_SCALE_XZ},
    {x:centerX+1.5*CABIN_SCALE_XZ,z:centerZ+3.8*CABIN_SCALE_XZ,radius:.75*CABIN_SCALE_XZ},
    {x:centerX+6.65*CABIN_SCALE_XZ,z:centerZ-2.7*CABIN_SCALE_XZ,radius:1.3*CABIN_SCALE_XZ}
  );

  addBox(furnishings,new THREE.BoxGeometry(6,.18,2.5),floorMat,0,.02,6.15);
  for(const x of [-2.5,2.5])addBox(furnishings,new THREE.BoxGeometry(.16,2.4,.16),trim,x,1.2,7.15);
  const lantern=new THREE.Group();
  lantern.position.set(2.8,2.15,4.68);
  furnishings.add(lantern);
  addBox(lantern,new THREE.BoxGeometry(.28,.48,.28),trim,0,0,0);
  const lanternGlass=new THREE.Mesh(new THREE.BoxGeometry(.17,.28,.17),new THREE.MeshStandardMaterial({color:0xf2bd69,emissive:0xf28b32,emissiveIntensity:1.6,transparent:true,opacity:.8}));
  lantern.add(lanternGlass);
  const cabinLight=new THREE.PointLight(0xffc478,3,10,2);
  cabinLight.position.set(-1.5,2.1,-.8);furnishings.add(cabinLight);

  const fridge=new THREE.Group();
  fridge.position.set(CABIN_FRIDGE_LOCAL_X,0,CABIN_FRIDGE_LOCAL_Z);
  furnishings.add(fridge);
  const appliance=new THREE.MeshStandardMaterial({color:0xc2c5bd,roughness:.45,metalness:.24});
  const fridgeInterior=new THREE.MeshStandardMaterial({color:0x272d2e,roughness:.84});
  addBox(fridge,new THREE.BoxGeometry(.92,1.72,.88),appliance,0,.86,0);
  addBox(fridge,new THREE.BoxGeometry(.78,1.56,.04),fridgeInterior,0,.86,.46);
  for(const y of [.4,.85,1.3])addBox(fridge,new THREE.BoxGeometry(.74,.045,.58),appliance,0,y,.27);
  const fridgeDoorHinge=new THREE.Group();
  fridgeDoorHinge.position.set(-.46,0,.47);
  fridge.add(fridgeDoorHinge);
  const fridgeDoor=addBox(fridgeDoorHinge,new THREE.BoxGeometry(.9,1.68,.09),appliance,.45,.86,0);
  addBox(fridgeDoorHinge,new THREE.BoxGeometry(.055,.55,.09),trim,.82,.85,.08);
  kitchenState.fridgeDoor=fridgeDoorHinge;
  kitchenState.fridgeMesh=fridge;
  cabinInteriorColliders.push({
    x:centerX+CABIN_FRIDGE_LOCAL_X*CABIN_SCALE_XZ,
    z:centerZ+CABIN_FRIDGE_LOCAL_Z*CABIN_SCALE_XZ,
    radius:.82*CABIN_SCALE_XZ
  });

  const fireplace=new THREE.Group();
  fireplace.position.set(0,0,-4.22);
  furnishings.add(fireplace);
  const stone=new THREE.MeshStandardMaterial({color:0x554e46,roughness:.96});
  addBox(fireplace,new THREE.BoxGeometry(1.65,1.25,.65),stone,0,.63,0);
  addBox(fireplace,new THREE.BoxGeometry(.95,.62,.08),trim,0,.48,.36);
  addBox(fireplace,new THREE.BoxGeometry(1.1,.12,.62),stone,0,.12,.18);
  addBox(fireplace,new THREE.BoxGeometry(.72,.1,.28),cabinWood,0,.26,.23);
  kitchenState.flames=new THREE.Group();
  fireplace.add(kitchenState.flames);
  for(let i=0;i<3;i++){
    const flame=new THREE.Mesh(
      new THREE.ConeGeometry(.16,.52,7),
      new THREE.MeshStandardMaterial({color:i===1?0xffb52e:0xf16a24,emissive:0xc94713,emissiveIntensity:0,transparent:true,opacity:.8})
    );
    flame.position.set((i-1)*.18,.54,.27);
    kitchenState.flames.add(flame);
  }
  kitchenState.flames.visible=false;
  kitchenState.fireLight=new THREE.PointLight(0xff8c32,0,7,2);
  kitchenState.fireLight.position.set(0,1.05,.75);
  fireplace.add(kitchenState.fireLight);
  cabinInteriorColliders.push({x:centerX,z:centerZ-4.1*CABIN_SCALE_XZ,radius:1.05*CABIN_SCALE_XZ});

  const ammoBox=new THREE.Group();
  ammoBox.name='Cabin ammunition box';
  ammoBox.position.set(CABIN_AMMO_LOCAL_X,0,CABIN_AMMO_LOCAL_Z);
  furnishings.add(ammoBox);
  const ammoCrate=new THREE.MeshStandardMaterial({color:0x3f4a38,roughness:.86});
  const ammoMetal=new THREE.MeshStandardMaterial({color:0x665b43,roughness:.58,metalness:.48});
  addBox(ammoBox,new THREE.BoxGeometry(.92,.48,.68),ammoCrate,0,.24,0);
  addBox(ammoBox,new THREE.BoxGeometry(.94,.07,.7),trim,0,.5,0);
  for(const x of [-.36,.36]){
    addBox(ammoBox,new THREE.BoxGeometry(.055,.54,.73),ammoMetal,x,.25,0);
  }
  addBox(ammoBox,new THREE.BoxGeometry(.42,.025,.025),ammoMetal,0,.54,.02);
  for(let i=0;i<3;i++){
    const round=new THREE.Mesh(
      new THREE.CylinderGeometry(.035,.035,.16,8),
      new THREE.MeshStandardMaterial({color:0xb39a61,metalness:.68,roughness:.32})
    );
    round.rotation.z=Math.PI/2;
    round.position.set(-.22+i*.22,.59,-.02);
    round.castShadow=true;
    ammoBox.add(round);
  }
  cabinInteriorColliders.push({
    x:centerX+CABIN_AMMO_LOCAL_X*CABIN_SCALE_XZ,
    z:centerZ+CABIN_AMMO_LOCAL_Z*CABIN_SCALE_XZ,
    radius:.62*CABIN_SCALE_XZ
  });

  const cabinSafe=new THREE.Group();
  cabinSafe.name='Cabin money safe';
  cabinSafe.position.set(CABIN_SAFE_LOCAL_X,0,CABIN_SAFE_LOCAL_Z);
  cabinSafe.rotation.y=-Math.PI/2;
  furnishings.add(cabinSafe);
  const safeBody=new THREE.MeshStandardMaterial({color:0x39464a,roughness:.48,metalness:.68});
  const safeTrim=new THREE.MeshStandardMaterial({color:0xb39a61,roughness:.34,metalness:.76});
  addBox(cabinSafe,new THREE.BoxGeometry(1.05,1.35,.86),safeBody,0,.68,0);
  addBox(cabinSafe,new THREE.BoxGeometry(.88,1.17,.08),safeTrim,0,.69,.48);
  addBox(cabinSafe,new THREE.BoxGeometry(.74,1.02,.06),safeBody,0,.69,.54);
  const safeDial=new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,.06,16),safeTrim);
  safeDial.rotation.x=Math.PI/2;
  safeDial.position.set(-.19,.7,.61);
  cabinSafe.add(safeDial);
  addBox(cabinSafe,new THREE.BoxGeometry(.08,.38,.07),safeTrim,.22,.69,.61);
  cabinInteriorColliders.push({
    x:centerX+CABIN_SAFE_LOCAL_X*CABIN_SCALE_XZ,
    z:centerZ+CABIN_SAFE_LOCAL_Z*CABIN_SCALE_XZ,
    radius:.62*CABIN_SCALE_XZ
  });

  const gunLocker=new THREE.Group();
  gunLocker.name='Cabin gun locker';
  gunLocker.position.set(CABIN_LOCKER_LOCAL_X,0,CABIN_LOCKER_LOCAL_Z);
  gunLocker.rotation.y=-Math.PI/2;
  furnishings.add(gunLocker);
  const lockerBody=new THREE.MeshStandardMaterial({color:0x343b37,roughness:.76,metalness:.28});
  addBox(gunLocker,new THREE.BoxGeometry(1.14,2.25,.78),lockerBody,0,1.125,0);
  addBox(gunLocker,new THREE.BoxGeometry(1.02,2.12,.08),trim,0,1.125,.43);
  addBox(gunLocker,new THREE.BoxGeometry(.07,1.84,.045),safeTrim,.39,1.125,.49);
  for(const y of [.35,1.9])addBox(gunLocker,new THREE.BoxGeometry(.78,.08,.08),safeTrim,0,y,.49);
  cabinInteriorColliders.push({
    x:centerX+CABIN_LOCKER_LOCAL_X*CABIN_SCALE_XZ,
    z:centerZ+CABIN_LOCKER_LOCAL_Z*CABIN_SCALE_XZ,
    radius:.62*CABIN_SCALE_XZ
  });

  const cooktop=new THREE.Group();
  cooktop.name='Cabin cooktop';
  cooktop.position.set(CABIN_COOKTOP_LOCAL_X,.88,CABIN_COOKTOP_LOCAL_Z);
  cooktop.rotation.y=Math.PI/2;
  furnishings.add(cooktop);
  const stoveBody=new THREE.MeshStandardMaterial({color:0x333735,roughness:.58,metalness:.45});
  const burnerMaterial=new THREE.MeshStandardMaterial({color:0x181a19,roughness:.8,metalness:.18});
  kitchenState.burnerMaterial=burnerMaterial;
  addBox(cooktop,new THREE.BoxGeometry(1.35,.18,.94),stoveBody,0,0,0);
  for(const x of [-.38,.38]){
    for(const z of [-.23,.23]){
      const burner=new THREE.Mesh(new THREE.TorusGeometry(.17,.035,6,16),burnerMaterial);
      burner.rotation.x=Math.PI/2;
      burner.position.set(x,.105,z);
      cooktop.add(burner);
    }
  }
  for(const x of [-.42,-.14,.14,.42]){
    const control=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.045,10),safeTrim);
    control.rotation.x=Math.PI/2;
    control.position.set(x,-.025,.49);
    cooktop.add(control);
  }
  cabinInteriorColliders.push({
    x:centerX+CABIN_COOKTOP_LOCAL_X*CABIN_SCALE_XZ,
    z:centerZ+CABIN_COOKTOP_LOCAL_Z*CABIN_SCALE_XZ,
    radius:.72*CABIN_SCALE_XZ
  });

  cabin.scale.x=CABIN_SCALE_XZ;
  cabin.scale.z=CABIN_SCALE_XZ;
  cabin.position.set(centerX,floorY,centerZ);
  const exteriorCabin=cabin.clone(true);
  exteriorCabin.scale.y=CABIN_HEIGHT_SCALE;
  exteriorCabin.traverse(object=>{
    if(object.name==='Cabin entry door'||object.name==='Cabin furnishings'){
      object.scale.y=1/CABIN_HEIGHT_SCALE;
    }
  });
  scene.add(exteriorCabin);
  registerTerrainAnchor(exteriorCabin,centerX,centerZ,0);
  cabin.scale.y=CABIN_HEIGHT_SCALE;
  cabin.position.y=floorY-.21;
  doorHinge.scale.y=1/CABIN_HEIGHT_SCALE;
  furnishings.scale.y=1/CABIN_HEIGHT_SCALE;
  furnishings.position.y=.21/CABIN_HEIGHT_SCALE;
  const warmRoomLight=new THREE.PointLight(0xffd39b,16,30,1.7);
  warmRoomLight.position.set(centerX,floorY+5.5,centerZ);
  cabinInteriorScene.add(warmRoomLight);
  registerTerrainAnchor(warmRoomLight,centerX,centerZ,5.5);
  const interiorThemeMaterials={wood:[],siding:[],roof:[]};
  cabin.traverse(object=>{
    if(!object.isMesh)return;
    const sourceMaterials=Array.isArray(object.material)?object.material:[object.material];
    const interiorMaterials=sourceMaterials.map(material=>{
      const interiorMaterial=material.clone();
      interiorMaterial.side=THREE.DoubleSide;
      if(cabinThemeMaterials.wood.includes(material))interiorThemeMaterials.wood.push(interiorMaterial);
      if(cabinThemeMaterials.siding.includes(material))interiorThemeMaterials.siding.push(interiorMaterial);
      if(cabinThemeMaterials.roof.includes(material))interiorThemeMaterials.roof.push(interiorMaterial);
      return interiorMaterial;
    });
    object.material=Array.isArray(object.material)?interiorMaterials:interiorMaterials[0];
  });
  cabinThemeMaterials.wood.push(...interiorThemeMaterials.wood);
  cabinThemeMaterials.siding.push(...interiorThemeMaterials.siding);
  cabinThemeMaterials.roof.push(...interiorThemeMaterials.roof);
  cabinInteriorScene.add(cabin);
  registerTerrainAnchor(cabin,centerX,centerZ,-.21);

  const doghouseX=centerX+15,doghouseZ=centerZ+10.5;
  const doghouse=new THREE.Group();
  doghouse.name='Ranch doghouse';
  doghouse.position.set(doghouseX,terrainHeight(doghouseX,doghouseZ),doghouseZ);
  const doghouseWood=new THREE.MeshStandardMaterial({color:0x60432f,roughness:.92});
  const doghouseRoof=new THREE.MeshStandardMaterial({color:0x39413a,roughness:.84});
  const doghouseTrim=new THREE.MeshStandardMaterial({color:0x30251d,roughness:.88});
  const doghouseBox=(geometry,material,x,y,z)=>{
    const mesh=new THREE.Mesh(geometry,material);
    mesh.position.set(x,y,z);
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    doghouse.add(mesh);
    return mesh;
  };
  doghouseBox(new THREE.BoxGeometry(1.7,.16,1.35),doghouseWood,0,.08,0);
  doghouseBox(new THREE.BoxGeometry(.14,1.05,1.35),doghouseWood,-.78,.6,0);
  doghouseBox(new THREE.BoxGeometry(.14,1.05,1.35),doghouseWood,.78,.6,0);
  doghouseBox(new THREE.BoxGeometry(1.7,1.05,.14),doghouseWood,0,.6,-.6);
  doghouseBox(new THREE.BoxGeometry(.42,.52,.08),doghouseTrim,0,.34,.61);
  const kennelRoofA=doghouseBox(new THREE.BoxGeometry(1.02,.12,1.65),doghouseRoof,-.4,1.16,0);
  kennelRoofA.rotation.z=-.42;
  const kennelRoofB=doghouseBox(new THREE.BoxGeometry(1.02,.12,1.65),doghouseRoof,.4,1.16,0);
  kennelRoofB.rotation.z=.42;
  const kennelSign=doghouseBox(new THREE.BoxGeometry(.72,.24,.055),doghouseTrim,0,.9,.69);
  kennelSign.name='Kennel sign';
  scene.add(doghouse);
  registerTerrainAnchor(doghouse,doghouseX,doghouseZ);
  // Leave the front of the doghouse open. Colliding the center point made
  // nearby players appear trapped behind the small structure.
  registerCollisionSegment(doghouseX-.75,doghouseZ-.55,doghouseX-.75,doghouseZ+.55,.16);
  registerCollisionSegment(doghouseX+.75,doghouseZ-.55,doghouseX+.75,doghouseZ+.55,.16);
  registerCollisionSegment(doghouseX-.75,doghouseZ-.55,doghouseX+.75,doghouseZ-.55,.16);
  kennelPosition=new THREE.Vector3(doghouseX,0,doghouseZ);
}

const loader=new GLTFLoader();
loader.load('./assets/models/low-poly-landscape.glb',gltf=>{
  try{
    const landscape=gltf.scene;
    const waterSurfaces=[];
    landscape.updateMatrixWorld(true);
    const sourceBounds=new THREE.Box3().setFromObject(landscape);
    if(sourceBounds.isEmpty())throw new Error('Landscape GLB has no renderable geometry');
    const center=sourceBounds.getCenter(new THREE.Vector3());
    const horizontalScale=155*WORLD_SCALE,verticalScale=22;
    landscape.scale.set(horizontalScale,verticalScale,horizontalScale);
    landscape.position.set(
      -center.x*horizontalScale,
      -sourceBounds.min.y*verticalScale,
      -center.z*horizontalScale
    );
    landscape.updateMatrixWorld(true);
    const worldBounds=new THREE.Box3().setFromObject(landscape);
    landscapeWorldBounds={
      minX:worldBounds.min.x,maxX:worldBounds.max.x,
      minZ:worldBounds.min.z,maxZ:worldBounds.max.z
    };

    landscape.traverse(node=>{
      if(!node.isMesh)return;
      node.geometry=node.geometry.clone();
      const positions=node.geometry.attributes.position;
      if(node.material?.name?.toLowerCase()==='blue'){
        node.userData.waterSurface=true;
        waterSurfaces.push(node);
        const waterMaterial=node.material;
        waterMaterial.roughness=.2;
        waterMaterial.metalness=.08;
        waterMaterial.onBeforeCompile=shader=>{
          shader.uniforms.uWildWaterTime=waterTimeUniform;
          shader.vertexShader=shader.vertexShader
            .replace('#include <common>','#include <common>\nuniform float uWildWaterTime;')
            .replace('#include <begin_vertex>',`#include <begin_vertex>
transformed.y+=sin(position.x*0.9+position.z*0.7+uWildWaterTime*1.35)*0.004;`);
        };
        waterMaterial.customProgramCacheKey=()=> 'wild-country-water-ripple-v1';
        node.geometry.computeBoundingBox();
        const waterCenter=node.geometry.boundingBox.getCenter(new THREE.Vector3());
        for(let i=0;i<positions.count;i++){
          positions.setX(i,waterCenter.x+(positions.getX(i)-waterCenter.x)*.12);
          positions.setZ(i,waterCenter.z+(positions.getZ(i)-waterCenter.z)*.12);
        }
        node.geometry.computeBoundingBox();
      }else{
        const materials=Array.isArray(node.material)?node.material:[node.material];
        for(const material of materials)addNaturalTerrainShader(material,true);
      }
      const inverse=node.matrixWorld.clone().invert();
      const worldPosition=new THREE.Vector3();
      for(let i=0;i<positions.count;i++){
        worldPosition.fromBufferAttribute(positions,i).applyMatrix4(node.matrixWorld);
        const edgeWeight=landscapeEdgeBlend(worldPosition.x,worldPosition.z);
        if(edgeWeight<1){
          const outerHeight=proceduralTerrainHeight(worldPosition.x,worldPosition.z);
          worldPosition.y=THREE.MathUtils.lerp(outerHeight,worldPosition.y,edgeWeight);
        }
        const rolling=smoothNoise(worldPosition.x*.0015,worldPosition.z*.0015)*36;
        const undulation=smoothNoise(worldPosition.x*.0048,worldPosition.z*.0048)*16;
        const groundDetail=smoothNoise(worldPosition.x*.016,worldPosition.z*.016)*3;
        worldPosition.y+=(rolling+undulation+groundDetail)*edgeWeight;
        worldPosition.applyMatrix4(inverse);
        positions.setXYZ(i,worldPosition.x,worldPosition.y,worldPosition.z);
      }
      positions.needsUpdate=true;
      node.geometry.computeVertexNormals();
      node.castShadow=false;
      node.receiveShadow=true;
    });
    landscape.updateMatrixWorld(true);
    for(const waterSurface of waterSurfaces){
      const bounds=new THREE.Box3().setFromObject(waterSurface);
      if(!bounds.isEmpty())waterZones.push({
        minX:bounds.min.x,maxX:bounds.max.x,minZ:bounds.min.z,maxZ:bounds.max.z
      });
    }
    updateTerrainWaterUniforms();
    document.querySelectorAll('[data-dog-breed]').forEach(button=>{
      button.addEventListener('click',()=>{
        applyCustomization('dogBreed',button.dataset.dogBreed);
        closeKennel();
        showMessage(`${customizationOptions.dogBreed[button.dataset.dogBreed].label} selected`);
      });
    });
    document.getElementById('closeKennel').addEventListener('click',closeKennel);
    updateCustomizationMenu();

    landscapeGridSize=401;
    landscapeGridOriginX=worldBounds.min.x;
    landscapeGridOriginZ=worldBounds.min.z;
    landscapeGridStep=Math.max(
      worldBounds.max.x-worldBounds.min.x,
      worldBounds.max.z-worldBounds.min.z
    )/(landscapeGridSize-1);
    landscapeHeightGrid=new Float32Array(landscapeGridSize*landscapeGridSize);
    landscapeHeightGrid.fill(NaN);
    const triangleA=new THREE.Vector3(),triangleB=new THREE.Vector3(),triangleC=new THREE.Vector3();
    landscape.traverse(node=>{
      if(!node.isMesh)return;
      const positions=node.geometry.attributes.position,index=node.geometry.index;
      const vertex=(i,target)=>target.fromBufferAttribute(positions,index?index.getX(i):i).applyMatrix4(node.matrixWorld);
      const triangleCount=(index?index.count:positions.count)/3;
      for(let triangle=0;triangle<triangleCount;triangle++){
        const first=triangle*3;
        vertex(first,triangleA);vertex(first+1,triangleB);vertex(first+2,triangleC);
        const denominator=(triangleB.z-triangleC.z)*(triangleA.x-triangleC.x)+
          (triangleC.x-triangleB.x)*(triangleA.z-triangleC.z);
        if(Math.abs(denominator)<1e-5)continue;
        const minX=Math.max(0,Math.floor((Math.min(triangleA.x,triangleB.x,triangleC.x)-landscapeGridOriginX)/landscapeGridStep));
        const maxX=Math.min(landscapeGridSize-1,Math.ceil((Math.max(triangleA.x,triangleB.x,triangleC.x)-landscapeGridOriginX)/landscapeGridStep));
        const minZ=Math.max(0,Math.floor((Math.min(triangleA.z,triangleB.z,triangleC.z)-landscapeGridOriginZ)/landscapeGridStep));
        const maxZ=Math.min(landscapeGridSize-1,Math.ceil((Math.max(triangleA.z,triangleB.z,triangleC.z)-landscapeGridOriginZ)/landscapeGridStep));
        for(let iz=minZ;iz<=maxZ;iz++){
          const z=landscapeGridOriginZ+iz*landscapeGridStep;
          for(let ix=minX;ix<=maxX;ix++){
            const x=landscapeGridOriginX+ix*landscapeGridStep;
            const wa=((triangleB.z-triangleC.z)*(x-triangleC.x)+(triangleC.x-triangleB.x)*(z-triangleC.z))/denominator;
            const wb=((triangleC.z-triangleA.z)*(x-triangleC.x)+(triangleA.x-triangleC.x)*(z-triangleC.z))/denominator;
            const wc=1-wa-wb;
            if(wa<-.0001||wb<-.0001||wc<-.0001)continue;
            const height=wa*triangleA.y+wb*triangleB.y+wc*triangleC.y;
            const sampleIndex=iz*landscapeGridSize+ix;
            if(!Number.isFinite(landscapeHeightGrid[sampleIndex])||height>landscapeHeightGrid[sampleIndex]){
              landscapeHeightGrid[sampleIndex]=height;
            }
          }
        }
      }
    });

    const rawSampleCount=landscapeHeightGrid.reduce((count,height)=>count+(Number.isFinite(height)?1:0),0);
    smoothLandscapeHeightGrid();
    landscape.name='Poly Pizza terrain height source';
    scene.add(landscape);
    for(const waterSurface of waterSurfaces)scene.attach(waterSurface);
    landscape.visible=false;
    refreshGroundForLandscape();
    refreshTerrainAnchors();
    syncCabinFloorToTerrain();
    horse.position.y=terrainHeight(horse.position.x,horse.position.z);
    for(const entry of wildlifeData)entry.group.position.y=wildlifeGroundHeight(entry.group);
    let minHeight=Infinity,maxHeight=-Infinity;
    for(const height of landscapeHeightGrid){
      if(!Number.isFinite(height))continue;
      minHeight=Math.min(minHeight,height);maxHeight=Math.max(maxHeight,height);
    }
    const centerSample=sampleLandscapeHeight(0,0);
    console.info(`[Wild Country] Integrated Poly Pizza terrain: ${rawSampleCount}/${landscapeHeightGrid.length} source height samples, filled and smoothed; ${minHeight.toFixed(1)}-${maxHeight.toFixed(1)} m. Ground cover: ${grass.userData.visibleGroundCoverCount}/${grass.count} grass clumps, ${bushes.userData.visibleGroundCoverCount}/${bushes.count} bushes.`);
  }catch(error){assetError('Low-poly landscape',error);}
  finally{activateTreeForest();}
},undefined,error=>{
  assetError('Low-poly landscape',error);
  refreshGroundForLandscape();
  activateTreeForest();
});
const treeAssets={
  trees:{path:'./assets/models/trees-quaternius.glb',height:10,label:'Quaternius Trees'},
  tree:{path:'./assets/models/tree-google.glb',height:11,label:'Poly by Google Tree'},
  pine:{path:'./assets/models/pine-trees-quaternius.glb',height:13,label:'Quaternius Pine Trees'},
  birch:{path:'./assets/models/birch-trees.glb',height:12,label:'Quaternius Birch Trees'},
  spruce:{path:'./assets/models/spruce-tree.glb',height:13,label:'Poly by Google Spruce'},
  fir:{path:'./assets/models/fir-tree.glb',height:13,label:'Poly by Google Fir'},
  oak:{path:'./assets/models/oak-tree.glb',height:12,label:'Poly by Google Oak'},
  poplar:{path:'./assets/models/poplar-tree.glb',height:12,label:'Poly by Google Poplar (Aspen-like)'}
};
function createBarkReliefTexture(){
  const size=256,canvas=document.createElement('canvas');
  canvas.width=canvas.height=size;
  const context=canvas.getContext('2d');
  const image=context.createImageData(size,size);
  for(let y=0;y<size;y++){
    for(let x=0;x<size;x++){
      const warp=terrainLatticeNoise(x/size*7,y/size*5,7);
      const grain=terrainLatticeNoise(x/size*41,y/size*41,41);
      const groove=Math.sin((x+warp*13)*.42);
      const height=THREE.MathUtils.clamp(128+groove*33+(grain-.5)*46,0,255);
      const index=(y*size+x)*4;
      image.data[index]=height;
      image.data[index+1]=height;
      image.data[index+2]=height;
      image.data[index+3]=255;
    }
  }
  context.putImageData(image,0,0);
  const texture=new THREE.CanvasTexture(canvas);
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
  return texture;
}
const barkReliefTexture=createBarkReliefTexture();
function addTreeWind(material){
  const swayScale=/bark|wood/i.test(material.name) ? .35 : 1;
  material.onBeforeCompile=shader=>{
    shader.uniforms.uTreeWindTime=treeWindUniform;
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nuniform float uTreeWindTime;')
      .replace('#include <begin_vertex>',`#include <begin_vertex>
float treeWindHeight=max(position.y,0.0);
float treeWindPhase=instanceMatrix[3].x*0.037+instanceMatrix[3].z*0.043;
float treeWindWave=sin(uTreeWindTime*0.48+treeWindPhase+position.x*0.17+position.z*0.11);
float treeWindWeight=smoothstep(0.0,2.0,treeWindHeight)*treeWindHeight;
transformed.x+=treeWindWave*treeWindWeight*${(.012*swayScale).toFixed(4)};
transformed.z+=cos(uTreeWindTime*0.39+treeWindPhase+position.x*0.12-position.z*0.16)*treeWindWeight*${(.006*swayScale).toFixed(4)};`);
  };
  material.customProgramCacheKey=()=> 'wild-country-tree-wind-v2';
}
function prepareTreeTemplate(gltf,targetHeight,label){
  const root=gltf.scene;
  root.updateMatrixWorld(true);
  const originalBounds=new THREE.Box3().setFromObject(root);
  if(originalBounds.isEmpty())throw new Error('Tree GLB has no renderable geometry');
  const originalSize=originalBounds.getSize(new THREE.Vector3());
  if(originalSize.y<=0)throw new Error('Tree GLB has zero height');
  root.scale.setScalar(targetHeight/originalSize.y);
  root.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(root);
  const center=bounds.getCenter(new THREE.Vector3());
  root.position.x-=center.x;
  root.position.y-=bounds.min.y;
  root.position.z-=center.z;
  root.updateMatrixWorld(true);
  root.traverse(node=>{
    if(node.isMesh){
      node.castShadow=false;
      node.receiveShadow=false;
      node.material=Array.isArray(node.material)
        ?node.material.map(material=>{
          const windMaterial=material.clone();
          if(/bark|wood/i.test(material.name)){
            windMaterial.bumpMap=barkReliefTexture;
            windMaterial.bumpScale=material.name.toLowerCase().includes('birch') ? .055 : .085;
            windMaterial.roughness=Math.max(windMaterial.roughness,.9);
          }
          addTreeWind(windMaterial);
          windMaterial.needsUpdate=true;
          return windMaterial;
        })
        :node.material.clone();
      if(!Array.isArray(node.material)){
        if(/bark|wood/i.test(node.material.name)){
          node.material.bumpMap=barkReliefTexture;
          node.material.bumpScale=.075;
          node.material.roughness=Math.max(node.material.roughness,.9);
        }
        addTreeWind(node.material);
        node.material.needsUpdate=true;
      }
    }
  });
  console.info(`[Wild Country] ${label} tree dimensions:`,{height:targetHeight,sourceDimensions:{x:originalSize.x,y:originalSize.y,z:originalSize.z}});
  return root;
}
function instanceTreeForest(root,type){
  const placements=treePlacements.filter(tree=>tree.type===type);
  if(!placements.length)return;
  root.updateMatrixWorld(true);
  const position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
  const offset=new THREE.Object3D();
  const variants=[];
  root.traverse(node=>{
    if(/^NormalTree_\d+$/.test(node.name))variants.push(node);
  });
  if(!variants.length)variants.push(root);
  const chunks=new Map();
  for(const tree of placements){
    const cellX=Math.floor(tree.x/TREE_LOD_CELL),cellZ=Math.floor(tree.z/TREE_LOD_CELL);
    const key=`${cellX}:${cellZ}`;
    if(!chunks.has(key))chunks.set(key,{cellX,cellZ,placements:[]});
    chunks.get(key).placements.push(tree);
  }
  const tiers=[
    {key:'near',density:1},
    {key:'medium',density:.3},
    {key:'far',density:.08}
  ];
  let meshCount=0;
  for(const chunk of chunks.values()){
    const lodGroups={};
    for(const tier of tiers){
      const group=new THREE.Group();
      group.name=`${treeAssets[type].label} ${tier.key} LOD`;
      group.visible=tier.key==='near';
      scene.add(group);
      lodGroups[tier.key]=group;
      for(let variantIndex=0;variantIndex<variants.length;variantIndex++){
        const variant=variants[variantIndex];
        const variantPlacements=chunk.placements.filter((tree,index)=>
          index%variants.length===variantIndex&&
          (tier.density===1||((Math.sin(tree.x*12.9898+tree.z*78.233)*43758.5453)%1+1)%1<tier.density)
        );
        if(!variantPlacements.length)continue;
        const bounds=new THREE.Box3().setFromObject(variant);
        const center=bounds.getCenter(new THREE.Vector3());
        const localize=new THREE.Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z);
        variant.traverse(node=>{
          if(!node.isMesh||node.isSkinnedMesh)return;
          const instances=new THREE.InstancedMesh(node.geometry,node.material,variantPlacements.length);
          instances.name=`${treeAssets[type].label} ${tier.key} instances`;
          instances.castShadow=false;
          instances.receiveShadow=false;
          instances.instanceMatrix.setUsage(THREE.StaticDrawUsage);
          instances.userData.terrainAnchors=variantPlacements.map(tree=>({
            x:tree.x,z:tree.z,baseY:renderedGroundHeight(tree.x,tree.z)
          }));
          const sourceTransform=localize.clone().multiply(node.matrixWorld);
          for(let i=0;i<variantPlacements.length;i++){
            const tree=variantPlacements[i];
            position.set(tree.x,renderedGroundHeight(tree.x,tree.z)-.04,tree.z);
            rotation.setFromAxisAngle(new THREE.Vector3(0,1,0),tree.yaw);
            scale.set(
              tree.scale*tree.widthScale,
              tree.scale*tree.heightScale,
              tree.scale*tree.widthScale
            );
            offset.matrix.compose(position,rotation,scale).multiply(sourceTransform);
            instances.setMatrixAt(i,offset.matrix);
            const tint=tree.tint;
            instances.setColorAt(i,new THREE.Color(tint,tint,tint));
          }
          if(instances.instanceColor)instances.instanceColor.needsUpdate=true;
          instances.computeBoundingSphere();
          group.add(instances);
          meshCount++;
        });
      }
    }
    treeLodChunks.push({
      x:(chunk.cellX+.5)*TREE_LOD_CELL,
      z:(chunk.cellZ+.5)*TREE_LOD_CELL,
      ...lodGroups
    });
  }
  if(!meshCount)throw new Error(`${treeAssets[type].label} GLB contains no static meshes`);
  console.info(`[Wild Country] Instanced ${placements.length} ${type} trees in ${chunks.size} terrain-aligned LOD cells.`);
}
function updateTreeLods(dt){
  treeLodUpdateTimer-=dt;
  if(treeLodUpdateTimer>0)return;
  treeLodUpdateTimer=TREE_LOD_UPDATE_INTERVAL;
  for(const chunk of treeLodChunks){
    const distance=Math.hypot(player.position.x-chunk.x,player.position.z-chunk.z);
    chunk.near.visible=distance<520;
    chunk.medium.visible=distance>=520&&distance<1120;
    chunk.far.visible=distance>=1120&&distance<2450;
  }
}
let forestDeadwoodCreated=false;
function addForestDeadwood(){
  if(forestDeadwoodCreated)return;
  forestDeadwoodCreated=true;
  const forestTrees=treePlacements.filter(tree=>
    tree.type!=='trees'||Math.hypot(tree.x,tree.z)>BIOME_BOUNDS.firstMountain
  );
  const targetCount=80;
  const geometry=new THREE.CylinderGeometry(.14,.2,1,9,3);
  const material=new THREE.MeshStandardMaterial({
    color:0xffffff,roughness:.96,bumpMap:barkReliefTexture,bumpScale:.06
  });
  const logs=new THREE.InstancedMesh(geometry,material,targetCount);
  logs.name='Forest fallen logs';
  logs.castShadow=true;
  logs.receiveShadow=true;
  logs.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  const up=new THREE.Vector3(0,1,0);
  const direction=new THREE.Vector3();
  const transform=new THREE.Object3D();
  let placed=0,attempts=0;
  while(placed<targetCount&&attempts<targetCount*40&&forestTrees.length){
    attempts++;
    const tree=forestTrees[Math.floor(Math.random()*forestTrees.length)];
    const angle=Math.random()*Math.PI*2;
    const length=2.2+Math.random()*3.8;
    const startX=tree.x+Math.cos(angle)*(tree.radius+1.4);
    const startZ=tree.z+Math.sin(angle)*(tree.radius+1.4);
    const endX=startX+Math.cos(angle)*length;
    const endZ=startZ+Math.sin(angle)*length;
    const middleX=(startX+endX)*.5,middleZ=(startZ+endZ)*.5;
    if(terrainSlopeAt(middleX,middleZ)>.38||
      !isForestUnderstoryClear(middleX,middleZ,.16)||
      !isForestUnderstoryClear(startX,startZ,.16)||
      !isForestUnderstoryClear(endX,endZ,.16))continue;
    const startY=renderedGroundHeight(startX,startZ),endY=renderedGroundHeight(endX,endZ);
    direction.set(endX-startX,endY-startY,endZ-startZ).normalize();
    transform.position.set(middleX,(startY+endY)*.5+.16,middleZ);
    transform.quaternion.setFromUnitVectors(up,direction);
    const radius=.12+Math.random()*.09;
    transform.scale.set(radius,length,radius);
    transform.updateMatrix();
    logs.setMatrixAt(placed,transform.matrix);
    const shade=.68+Math.random()*.26;
    logs.setColorAt(placed,new THREE.Color(shade,shade*.94,shade*.84));
    registerCollisionSegment(startX,startZ,endX,endZ,.16);
    placed++;
  }
  logs.count=placed;
  if(!placed)return;
  if(logs.instanceColor)logs.instanceColor.needsUpdate=true;
  logs.instanceMatrix.needsUpdate=true;
  logs.computeBoundingSphere();
  scene.add(logs);
  console.info(`[Wild Country] Added ${placed} terrain-aligned fallen logs to forest clearings.`);
}
function activateTreeForest(){
  if(landscapeReady)return;
  filterTreePlacementsForWater();
  addForestDeadwood();
  landscapeReady=true;
  for(const [type,root] of pendingTreeTemplates)instanceTreeForest(root,type);
  pendingTreeTemplates.clear();
}
function loadTreeAsset(type){
  const asset=treeAssets[type];
  loader.load(asset.path,gltf=>{
    try{
      const root=prepareTreeTemplate(gltf,asset.height,asset.label);
      if(landscapeReady)instanceTreeForest(root,type);
      else pendingTreeTemplates.set(type,root);
    }catch(error){assetError(asset.label,error);}
  },undefined,error=>assetError(asset.label,error));
}
for(const type of Object.keys(treeAssets))loadTreeAsset(type);
const animalTemplates={deer:null,stag:null,elk:null,cow:null,bull:null,horse:null};
let antlerTemplate=null;
let antlerAssetLoadFinished=false;
let deerPopulationSpawned=false;
const deerRackClasses=[
  {id:'1x1',points:1,chance:1/5},
  {id:'2x2',points:2,chance:1/10},
  {id:'3x3',points:3,chance:1/25},
  {id:'4x4',points:4,chance:1/40},
  {id:'5x5',points:5,chance:1/70}
];
const STAG_SPAWN_CHANCE=1/999;
function rollDeerRack(random=Math.random()){
  let roll=random;
  for(const rack of deerRackClasses){
    if(roll<rack.chance)return rack;
    roll-=rack.chance;
  }
  return {id:'none',points:0};
}
const antlerMaterial=new THREE.MeshStandardMaterial({color:0x94744f,roughness:.88});
function addAntlerBranch(group,points,radius){
  const curve=new THREE.CatmullRomCurve3(points);
  const branch=new THREE.Mesh(new THREE.TubeGeometry(curve,12,radius,6,false),antlerMaterial);
  branch.castShadow=true;
  branch.receiveShadow=true;
  group.add(branch);
}
function buildProceduralRack(points,individualSize){
  const rack=new THREE.Group();
  rack.position.set(0,.66*individualSize,-.44*individualSize);
  rack.scale.setScalar(individualSize);
  for(const side of [-1,1]){
    const beam=[
      new THREE.Vector3(side*.1,0,0),
      new THREE.Vector3(side*.17,.08,-.02),
      new THREE.Vector3(side*.24,.2,-.06),
      new THREE.Vector3(side*.24,.34,-.1),
      new THREE.Vector3(side*.18,.48,-.12)
    ];
    addAntlerBranch(rack,beam,.026);
    const mainDirection=beam[beam.length-1].clone().sub(beam[beam.length-2]).normalize();
    const mainTip=new THREE.Mesh(new THREE.ConeGeometry(.024,.09,6),antlerMaterial);
    mainTip.position.copy(beam[beam.length-1]).addScaledVector(mainDirection,.03);
    mainTip.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),mainDirection);
    mainTip.castShadow=true;
    rack.add(mainTip);
    for(let tine=0;tine<points-1;tine++){
      const start=beam[tine+1];
      const middle=start.clone().add(new THREE.Vector3(side*.035,.07,-.025));
      const tip=start.clone().add(new THREE.Vector3(side*.055,.17,-.045));
      addAntlerBranch(rack,[start,middle,tip],.019);
      const tineTip=new THREE.Mesh(new THREE.ConeGeometry(.019,.065,6),antlerMaterial);
      tineTip.position.copy(tip);
      tineTip.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),tip.clone().sub(middle).normalize());
      tineTip.castShadow=true;
      rack.add(tineTip);
    }
  }
  return rack;
}
function createDeerRack(points,individualSize){
  if(points===3&&antlerTemplate){
    const rack=antlerTemplate.clone(true);
    rack.rotation.y=Math.PI;
    const assetBounds=new THREE.Box3().setFromObject(rack);
    const scale=.035*individualSize;
    rack.scale.setScalar(scale);
    rack.position.set(0,(.66-assetBounds.min.y*.035)*individualSize,-.44*individualSize);
    rack.traverse(object=>{
      if(!object.isMesh)return;
      object.castShadow=true;
      object.receiveShadow=true;
      const materials=Array.isArray(object.material)?object.material:[object.material];
      object.material=Array.isArray(object.material)
        ?materials.map(material=>{const clone=material.clone();clone.color?.set(0x94744f);clone.roughness=.88;return clone;})
        :materials[0].clone();
      if(!Array.isArray(object.material)){object.material.color?.set(0x94744f);object.material.roughness=.88;}
    });
    return rack;
  }
  return buildProceduralRack(points,individualSize);
}
function attachRackToDeerModel(rack,rackParent,deathPose){
  deathPose.add(rack);
  deathPose.updateMatrixWorld(true);
  rackParent.attach(rack);
}
function setDeerRack(entry,rackId){
  const rackClass=deerRackClasses.find(rack=>rack.id===rackId);
  if(!rackClass&&rackId!=='none')return;
  const {group}=entry;
  const size=group.userData.individualSize;
  group.userData.antlerRack?.removeFromParent();
  group.userData.rackId=rackId;
  group.userData.rackPoints=rackClass?.points||0;
  group.userData.antlerRack=rackClass?.points
    ?createDeerRack(rackClass.points,size)
    :null;
  if(group.userData.antlerRack){
    attachRackToDeerModel(group.userData.antlerRack,group.userData.rackParent,group.userData.deathPose);
  }
}
function applySavedDeerRacks(){
  if(!pendingDeerRacks||!deerPopulationSpawned)return;
  for(const savedRack of pendingDeerRacks){
    const entry=wildlifeData.find(candidate=>candidate.id===savedRack.id&&candidate.species==='deer');
    if(entry)setDeerRack(entry,savedRack.rackId);
  }
  pendingDeerRacks=null;
}
const animalModelHeights={
  // Full upright model bounds in meters (including ears/antlers where present).
  deer:1.45,
  stag:2.1,
  elk:2.3,
  cow:1.6,
  bull:1.75,
  horse:2.35
};
const harvestedAnimalIds=new Set();
const mountedAnimalIds=new Set();
const harvestValues={deer:125,stag:290,elk:500};
let cash=0;
let selectedHarvestAnimal=null;
let harvestOpen=false;
const horse=new THREE.Group();
horseCollisionGroup=horse;
const rider=new THREE.Group();
const riderHandAnchors=[new THREE.Vector3(-.13,.91,-.22),new THREE.Vector3(.13,.91,-.22)];
let riderReady=false;
let riderGaitPhase=0;
let cameraTransitionTime=1;
const ridingReins=[];
horse.position.set(18,terrainHeight(18,22),22);
horse.rotation.y=2.3;
horse.userData.loaded=false;
scene.add(horse);
horse.add(rider);
rider.visible=false;

function assetError(label,error){
  console.error(`[Wild Country] Failed to load ${label} model:`,error);
  showMessage(`${label} model failed to load — see console`);
}

function normalizeModel(root,targetHeight){
  root.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(root);
  if(!Number.isFinite(box.min.y)||box.isEmpty())throw new Error('Model has no valid geometry bounds');
  const height=box.getSize(new THREE.Vector3()).y;
  if(height<=0)throw new Error('Model has zero height');
  const scale=targetHeight/height;
  root.scale.setScalar(scale);
  root.updateMatrixWorld(true);
  const scaledBox=new THREE.Box3().setFromObject(root);
  root.position.y-=scaledBox.min.y;
  root.updateMatrixWorld(true);
  return root;
}

function prepareTemplate(gltf,targetHeight,label){
  const root=gltf.scene;
  root.updateMatrixWorld(true);
  const rawBox=new THREE.Box3().setFromObject(root);
  const rawSize=rawBox.getSize(new THREE.Vector3());
  normalizeModel(root,targetHeight);
  root.updateMatrixWorld(true);
  const finalBox=new THREE.Box3().setFromObject(root);
  const finalSize=finalBox.getSize(new THREE.Vector3());
  console.info(`[Wild Country] ${label} dimensions:`,{
    rawHeight:rawSize.y,
    normalizedHeight:finalSize.y,
    normalizedScale:targetHeight/rawSize.y,
    sizeMeters:{x:finalSize.x,y:finalSize.y,z:finalSize.z}
  });
  root.traverse(mesh=>{
    if(mesh.isMesh){mesh.castShadow=true;mesh.receiveShadow=true;if(mesh.material){mesh.material.envMapIntensity=.35;}}
  });
  return {root,clips:gltf.animations||[],label};
}

function attachDogToActiveWorld(){
  if(!dogCompanion.group)return;
  const activeScene=cabinState.inside?cabinInteriorScene:scene;
  if(dogCompanion.group.parent!==activeScene){
    dogCompanion.group.removeFromParent();
    activeScene.add(dogCompanion.group);
  }
}

function updateDogGrassClearance(){
  const dog=dogCompanion.group;
  if(!dog||cabinState.inside||dog.parent!==scene){
    dogGrassClearanceRadius.value=0;
    return;
  }
  dogGrassClearancePosition.value.set(dog.position.x,0,dog.position.z);
  dogGrassClearanceRadius.value=1.15;
}

function placeDogBesidePlayer(){
  if(!dogCompanion.group)return;
  const actor=player.mounted?horse.position:player.position;
  const heading=player.mounted?horse.rotation.y:yaw;
  const candidates=[
    [actor.x-Math.sin(heading)*3.3+Math.cos(heading)*1.2,actor.z-Math.cos(heading)*3.3-Math.sin(heading)*1.2],
    [actor.x+Math.cos(heading)*1.8,actor.z-Math.sin(heading)*1.8],
    [actor.x-Math.cos(heading)*1.8,actor.z+Math.sin(heading)*1.8],
    [actor.x-Math.sin(heading)*2.2,actor.z-Math.cos(heading)*2.2],
    [actor.x+Math.sin(heading)*2.2,actor.z+Math.cos(heading)*2.2]
  ];
  const [x,z]=candidates.find(([candidateX,candidateZ])=>
    !isBlocked(candidateX,candidateZ,.32,dogCompanion.group)
  )||candidates[0];
  dogCompanion.group.position.set(
    x,
    cabinState.inside?cabinState.floorY:terrainHeight(x,z),
    z
  );
  dogCompanion.group.rotation.y=Math.atan2(actor.x-x,actor.z-z);
}

function selectDogCompanion(breed){
  if(breed==='none'){
    dogCompanion.mixer?.stopAllAction();
    dogCompanion.group?.removeFromParent();
    Object.assign(dogCompanion,{group:null,model:null,mixer:null,template:null,action:null,clipName:null,breed:'none',called:false,speed:0,stuckTime:0});
    updateDogGrassClearance();
    return;
  }
  const modelKey=dogBreedModels[breed];
  if(!modelKey)throw new Error(`No companion model mapping for dog breed: ${breed}`);
  const template=dogTemplates[modelKey];
  if(!template){
    dogCompanion.mixer?.stopAllAction();
    dogCompanion.group?.removeFromParent();
    Object.assign(dogCompanion,{group:null,model:null,mixer:null,template:null,action:null,clipName:null,breed,called:false,speed:0,stuckTime:0});
    updateDogGrassClearance();
    return;
  }
  if(dogCompanion.group&&dogCompanion.breed===breed)return;
  dogCompanion.mixer?.stopAllAction();
  dogCompanion.group?.removeFromParent();
  const group=new THREE.Group();
  group.name=`${customizationOptions.dogBreed[breed].label} companion`;
  const model=cloneSkinnedModel(template.root);
  model.name=`${group.name} model`;
  group.add(model);
  const neutralTransforms=[];
  model.traverse(object=>{
    neutralTransforms.push({
      object,
      position:object.position.clone(),
      quaternion:object.quaternion.clone(),
      scale:object.scale.clone()
    });
  });
  const mixer=template.clips.length?new THREE.AnimationMixer(model):null;
  Object.assign(dogCompanion,{group,model,mixer,template,action:null,clipName:null,neutralTransforms,breed,called:false,speed:0,stuckTime:0});
  attachDogToActiveWorld();
  if(cabinState.inside){
    placeDogBesidePlayer();
  }else if(kennelPosition){
    const x=kennelPosition.x,z=kennelPosition.z+1.6;
    group.position.set(x,terrainHeight(x,z),z);
  }else{
    placeDogBesidePlayer();
  }
  updateDogGrassClearance();
  console.info(`[Wild Country] Loaded ${customizationOptions.dogBreed[breed].label} companion model from ${template.label}.`);
}

function callDogCompanion(){
  if(customizationState.dogBreed==='none'){
    showMessage('Choose a dog at the ranch kennel before calling a companion');
    return;
  }
  if(!dogCompanion.group){
    const modelKey=dogBreedModels[customizationState.dogBreed];
    showMessage(dogModelFailures.has(modelKey)
      ?'Your selected dog model failed to load — see console for details'
      :'Your selected dog model is still loading');
    return;
  }
  dogCompanion.called=true;
  attachDogToActiveWorld();
  if(Math.hypot(dogCompanion.group.position.x-player.position.x,dogCompanion.group.position.z-player.position.z)<2.8){
    showMessage(`${customizationOptions.dogBreed[dogCompanion.breed].label} is here with you`);
  }else{
    showMessage(`You call ${customizationOptions.dogBreed[dogCompanion.breed].label} to follow`);
  }
}

function updateDogCompanion(dt){
  const group=dogCompanion.group;
  if(!group)return;
  attachDogToActiveWorld();
  if(!dogCompanion.called){
    group.position.y=cabinState.inside?cabinState.floorY:terrainHeight(group.position.x,group.position.z);
  }else{
    const actor=player.mounted?horse.position:player.position;
    const heading=player.mounted?horse.rotation.y:yaw;
    const targetX=actor.x-Math.sin(heading)*3.3+Math.cos(heading)*1.2;
    const targetZ=actor.z-Math.cos(heading)*3.3-Math.sin(heading)*1.2;
    const dx=targetX-group.position.x;
    const dz=targetZ-group.position.z;
    const distance=Math.hypot(dx,dz);
    const desiredSpeed=distance>.8?Math.min(8,3.8+distance*.22):0;
    dogCompanion.speed=THREE.MathUtils.damp(dogCompanion.speed,desiredSpeed,5,dt);
    if(distance>.8&&dogCompanion.speed>.05){
      const step=Math.min(distance-.65,dogCompanion.speed*dt);
      const startX=group.position.x,startZ=group.position.z;
      const directionX=dx/distance,directionZ=dz/distance;
      const candidates=[
        [startX+directionX*step,startZ+directionZ*step],
        [startX+(directionX*.5-directionZ*.866)*step,startZ+(directionZ*.5+directionX*.866)*step],
        [startX+(directionX*.5+directionZ*.866)*step,startZ+(directionZ*.5-directionX*.866)*step]
      ];
      const destination=candidates.find(([x,z])=>
        !isBlocked(x,z,.32,group)&&canTraverseTerrain(startX,startZ,x,z,.9)
      );
      if(destination){
        group.position.x=destination[0];
        group.position.z=destination[1];
        group.rotation.y=Math.atan2(destination[0]-startX,destination[1]-startZ);
        dogCompanion.stuckTime=0;
      }else{
        dogCompanion.stuckTime+=dt;
        if(dogCompanion.stuckTime>2&&distance>10){
          const safePoints=[
            [targetX,targetZ],
            [actor.x-Math.cos(heading)*1.8,actor.z+Math.sin(heading)*1.8],
            [actor.x+Math.cos(heading)*1.8,actor.z-Math.sin(heading)*1.8],
            [actor.x,actor.z]
          ];
          const safePoint=safePoints.find(([x,z])=>
            !isBlocked(x,z,.32,group)&&canTraverseTerrain(x,z,x,z,.9)
          );
          if(safePoint){
            group.position.x=safePoint[0];
            group.position.z=safePoint[1];
            dogCompanion.stuckTime=0;
          }
        }
      }
    }
    if(distance<=.8)group.rotation.y=Math.atan2(actor.x-group.position.x,actor.z-group.position.z);
    group.position.y=cabinState.inside?cabinState.floorY:terrainHeight(group.position.x,group.position.z);
  }
  const moving=dogCompanion.speed>.45;
  if(dogCompanion.mixer){
    const clips=dogCompanion.template.clips;
    const targetClip=moving?clips.find(clip=>/walk|run|trot/i.test(clip.name)):null;
    if(targetClip&&dogCompanion.clipName!==targetClip.name){
      const previous=dogCompanion.action;
      const next=dogCompanion.mixer.clipAction(targetClip);
      previous?.fadeOut(.2);
      next.reset().fadeIn(.2).play();
      dogCompanion.action=next;
      dogCompanion.clipName=targetClip.name;
    }else if(!moving&&dogCompanion.action){
      dogCompanion.mixer.stopAllAction();
      dogCompanion.mixer.update(0);
      for(const pose of dogCompanion.neutralTransforms){
        pose.object.position.copy(pose.position);
        pose.object.quaternion.copy(pose.quaternion);
        pose.object.scale.copy(pose.scale);
      }
      dogCompanion.action=null;
      dogCompanion.clipName=null;
    }
    dogCompanion.mixer.update(dt);
  }else if(dogCompanion.model){
    const gait=clock.elapsedTime*(moving?9:1.6);
    dogCompanion.model.position.y=moving?Math.abs(Math.sin(gait))*.045:0;
    dogCompanion.model.rotation.z=moving?Math.sin(gait)*.035:0;
  }
  updateDogGrassClearance();
}

function findClip(template,names,fallback='Idle'){
  for(const name of names){
    const target=name.toLowerCase();
    const exact=template.clips.find(clip=>clip.name.toLowerCase()===target);
    if(exact)return exact;
    const namespaced=template.clips.find(clip=>clip.name.toLowerCase().endsWith(`|${target}`));
    if(namespaced)return namespaced;
  }
  const fallbackClip=template.clips.find(c=>c.name===fallback);
  return fallbackClip||template.clips[0]||null;
}

function leatherMaterial(color=0x6b3d22,roughness=.62){
  return new THREE.MeshStandardMaterial({color,roughness,metalness:.04,side:THREE.DoubleSide});
}

function addHorseTack(model){
  if(!model)return;
  const tack=new THREE.Group();
  model.add(tack);

  const saddleAnchor=new THREE.Group();
  model.add(saddleAnchor);
  model.updateMatrixWorld(true);
  const bodyBounds=new THREE.Box3().setFromObject(model);
  const bodySize=bodyBounds.getSize(new THREE.Vector3());
  const torso=model.getObjectByName('Torso2')||model.getObjectByName('Torso3')||model.getObjectByName('Torso');
  const desiredBackWorld=new THREE.Vector3();
  if(torso)torso.getWorldPosition(desiredBackWorld);
  else desiredBackWorld.set(0,bodyBounds.max.y-bodySize.y*.24,0);

  const desiredBackLocal=model.worldToLocal(desiredBackWorld.clone());
  desiredBackLocal.y+=.18;
  const backY=desiredBackLocal.y;
  saddleAnchor.position.set(desiredBackLocal.x,backY,desiredBackLocal.z-.55);
  saddleAnchor.scale.setScalar(.62);

  const leather=leatherMaterial(0x704125,.58);
  const darkLeather=leatherMaterial(0x2d1811,.68);
  const blanket=new THREE.MeshStandardMaterial({color:0x7b3f31,roughness:.82,side:THREE.DoubleSide});
  const blanketShape=new THREE.Shape();
  blanketShape.moveTo(-.58,-.82);blanketShape.quadraticCurveTo(-.68,-.42,-.58,-.02);blanketShape.quadraticCurveTo(-.55,.58,-.42,.72);
  blanketShape.lineTo(.42,.72);blanketShape.quadraticCurveTo(.55,.58,.58,-.02);blanketShape.quadraticCurveTo(.68,-.42,.58,-.82);blanketShape.closePath();
  const blanketMesh=new THREE.Mesh(new THREE.ShapeGeometry(blanketShape,12),blanket);
  blanketMesh.rotation.x=-Math.PI/2;
  blanketMesh.position.set(0,.05,-.05);
  saddleAnchor.add(blanketMesh);

  const saddleMaterials=[];
  loader.load('./assets/models/saddle.glb',gltf=>{
    try{
      const saddleModel=gltf.scene;
      saddleModel.name='Western saddle';
      saddleModel.scale.setScalar(.4);
      saddleModel.position.set(0,.025,-.05);
      saddleModel.traverse(mesh=>{
        if(!mesh.isMesh)return;
        mesh.castShadow=true;
        mesh.receiveShadow=true;
        const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
        const cloned=materials.map(material=>material.clone());
        mesh.material=Array.isArray(mesh.material)?cloned:cloned[0];
        for(const material of cloned){
          if(material.color)saddleMaterials.push({material,base:material.color.clone()});
        }
      });
      saddleAnchor.add(saddleModel);
    }catch(error){assetError('Western saddle',error);}
  },undefined,error=>assetError('Western saddle',error));

  const neck=model.getObjectByName('Neck2')||model.getObjectByName('Neck1')||model.getObjectByName('Torso3')||model;
  const head=model.getObjectByName('Head')||neck;
  const bridle=new THREE.Group();tack.add(bridle);
  const headWorld=new THREE.Vector3(),neckWorld=new THREE.Vector3();
  head.getWorldPosition(headWorld);neck.getWorldPosition(neckWorld);
  model.updateMatrixWorld(true);
  const headLocal=model.worldToLocal(headWorld.clone());
  const neckLocal=model.worldToLocal(neckWorld.clone());
  const tube=(points,radius=.018)=>new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),14,radius,7,false),darkLeather);
  bridle.add(tube([neckLocal,headLocal.clone().add(new THREE.Vector3(-.18,.08,-.12)),headLocal.clone().add(new THREE.Vector3(-.18,.02,-.34))],.018));
  bridle.add(tube([neckLocal,headLocal.clone().add(new THREE.Vector3(.18,.08,-.12)),headLocal.clone().add(new THREE.Vector3(.18,.02,-.34))],.018));
  bridle.add(tube([headLocal.clone().add(new THREE.Vector3(-.22,.02,-.30)),headLocal.clone().add(new THREE.Vector3(0,-.08,-.38)),headLocal.clone().add(new THREE.Vector3(.22,.02,-.30))],.018));

  const reinsGroup=new THREE.Group();horse.add(reinsGroup);reinsGroup.visible=false;
  for(let i=0;i<2;i++){
    const rein=new THREE.Mesh(new THREE.BufferGeometry(),darkLeather);
    rein.frustumCulled=false;
    reinsGroup.add(rein);ridingReins.push(rein);
  }

  model.userData.horseTack={tack,bridle,bones:{torso,neck,head},saddleAnchor,blanketMesh,reinsGroup,leather,darkLeather,saddleMaterials};
  horse.userData.tack=model.userData.horseTack;
  window.__horseTackDebug={backY,saddlePosition:saddleAnchor.position.toArray(),bodyBounds:{size:bodySize.toArray(),min:bodyBounds.min.toArray(),max:bodyBounds.max.toArray()}};
  updateRiderSeat();
}

function deformCowboyToSeat(geometry){
  const position=geometry.getAttribute('position');
  geometry.computeBoundingBox();
  const bounds=geometry.boundingBox;
  const centerX=(bounds.min.x+bounds.max.x)*.5;
  const centerZ=(bounds.min.z+bounds.max.z)*.5;
  const height=bounds.max.y-bounds.min.y;
  const smoothstep=(a,b,value)=>{
    const t=THREE.MathUtils.clamp((value-a)/(b-a),0,1);
    return t*t*(3-2*t);
  };
  for(let i=0;i<position.count;i++){
    const x=position.getX(i)-centerX;
    const y=position.getY(i)-bounds.min.y;
    const z=position.getZ(i)-centerZ;
    const side=Math.sign(x)||1;
    let seatedX=x,seatedZ=z;
    if(y<height*.56&&Math.abs(x)>height*.045){
      const spread=smoothstep(height*.12,height*.48,y);
      seatedX=x*(1+.34*(1-spread));
      const thigh=smoothstep(height*.22,height*.48,y);
      const calf=1-smoothstep(height*.06,height*.27,y);
      seatedZ+=height*(.13*thigh-.035*calf);
    }else if(y>height*.43&&Math.abs(x)>height*.12){
      const armWeight=smoothstep(height*.12,height*.47,Math.abs(x))*
        (1-smoothstep(height*.76,height*.94,y));
      seatedX-=side*height*.34*armWeight;
      seatedYAdjust(geometry,i,-height*.09*armWeight);
      seatedZ-=height*.32*armWeight;
    }
    position.setXYZ(i,centerX+seatedX,position.getY(i),centerZ+seatedZ);
  }
  position.needsUpdate=true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  function seatedYAdjust(targetGeometry,index,offset){
    const attr=targetGeometry.getAttribute('position');
    attr.setY(index,attr.getY(index)+offset);
  }
}

function loadRancherRider(){
  loader.load('./assets/models/cowboy.glb',gltf=>{
    try{
      const source=gltf.scene;
      normalizeModel(source,1.58);
      source.updateMatrixWorld(true);
      const sourceMesh=[];
      source.traverse(node=>{if(node.isMesh)sourceMesh.push(node);});
      if(sourceMesh.length!==1)throw new Error(`Expected one cowboy mesh; found ${sourceMesh.length}`);
      const sourceNode=sourceMesh[0];
      const geometry=sourceNode.geometry.clone();
      geometry.applyMatrix4(sourceNode.matrixWorld);
      const bounds=new THREE.Box3().setFromBufferAttribute(geometry.getAttribute('position'));
      geometry.translate(
        -(bounds.min.x+bounds.max.x)*.5,
        -bounds.min.y,
        -(bounds.min.z+bounds.max.z)*.5
      );
      deformCowboyToSeat(geometry);
      const riderMaterials=(Array.isArray(sourceNode.material)?sourceNode.material:[sourceNode.material])
        .map(material=>material.clone());
      const cowboyMesh=new THREE.Mesh(
        geometry,
        Array.isArray(sourceNode.material)?riderMaterials:riderMaterials[0]
      );
      cowboyMesh.castShadow=true;
      cowboyMesh.receiveShadow=true;
      cowboyMesh.frustumCulled=false;
      rider.add(cowboyMesh);
      rider.userData.characterMaterials=riderMaterials
        .filter(material=>material.color)
        .map(material=>({material,base:material.color.clone()}));
      applyCharacterAppearance();
      rider.rotation.order='YXZ';
      rider.rotation.y=Math.PI;
      rider.visible=player.mounted;
      riderReady=true;
      updateRiderSeat();
    }catch(error){assetError('Rancher rider',error);}
  },undefined,error=>assetError('Rancher rider',error));
}

function updateRiderSeat(){
  horse.updateMatrixWorld(true);
  const tack=horse.userData.tack;
  if(tack?.saddleAnchor){
    const seatWorld=tack.saddleAnchor.localToWorld(new THREE.Vector3(0,.85,-.05));
    horse.worldToLocal(seatWorld);
    rider.position.copy(seatWorld);
    rider.position.y-=.83;
    return;
  }
  const box=new THREE.Box3().setFromObject(horse);
  const size=box.getSize(new THREE.Vector3());
  const center=box.getCenter(new THREE.Vector3());
  rider.position.set(center.x,box.max.y-.18,center.z-.03);
}

function updateRiderMotion(dt,turn,speed){
  if(!riderReady)return;
  riderGaitPhase+=dt*(speed>8?10:speed>1?6:1.6);
  updateRiderSeat();
  const movement=Math.min(1,Math.abs(speed)/13);
  rider.position.y+=Math.sin(riderGaitPhase*2)*(.008+.025*movement);
  rider.rotation.x=-.025-.055*movement;
  rider.rotation.z=THREE.MathUtils.clamp(-turn*.09,-.12,.12);

  const headWorld=new THREE.Vector3();
  const head=horse.userData.tack?.bones.head;
  if(head)head.getWorldPosition(headWorld);
  else headWorld.copy(horse.position).add(new THREE.Vector3(0,1.3,-.6).applyAxisAngle(new THREE.Vector3(0,1,0),horse.rotation.y));
  const headLocal=horse.worldToLocal(headWorld.clone());
  for(let i=0;i<ridingReins.length;i++){
    const handWorld=rider.localToWorld(riderHandAnchors[i].clone());
    const handLocal=horse.worldToLocal(handWorld);
    const side=i===0?-1:1;
    const points=[
      headLocal.clone().add(new THREE.Vector3(side*.1,-.08,-.18)),
      headLocal.clone().lerp(handLocal,.42).add(new THREE.Vector3(side*.05,.03,0)),
      handLocal.clone()
    ];
    const curve=new THREE.CatmullRomCurve3(points);
    const oldGeometry=ridingReins[i].geometry;
    ridingReins[i].geometry=new THREE.TubeGeometry(curve,14,.009,5,false);
    oldGeometry.dispose();
  }
}

const speciesInfo={
  deer:{label:'Mule deer',fleeDistance:17,fleeSpeed:7,normalSpeed:.85,hearing:28,sight:34},
  stag:{label:'Stag',fleeDistance:20,fleeSpeed:8,normalSpeed:.75,hearing:32,sight:38},
  elk:{label:'Elk',fleeDistance:23,fleeSpeed:7,normalSpeed:.45,hearing:36,sight:42},
  cow:{label:'Ranch cow',fleeDistance:12,fleeSpeed:4.5,normalSpeed:.45,hearing:22,sight:24},
  bull:{label:'Ranch bull',fleeDistance:15,fleeSpeed:5.5,normalSpeed:.55,hearing:28,sight:30}
};

function placeMountedTrophy(entry,index){
  const animal=entry.group;
  const x=82.35,z=82+(index%8)*2.25;
  animal.visible=true;
  animal.scale.setScalar(.68);
  animal.position.set(x,terrainHeight(x,z)+1.2,z);
  animal.rotation.set(0,Math.PI/2,0);
  animal.userData.mixer?.stopAllAction();
  animal.userData.action=null;
  animal.userData.clipName=null;
  animal.userData.deathPose.rotation.set(0,0,0);
  animal.userData.deathPose.position.y=0;
  setAnimation(animal.userData,animal.userData.template,['Idle']);
  if(!entry.trophyPlaque){
    const plaque=new THREE.Mesh(
      new THREE.BoxGeometry(.12,.72,.72),
      new THREE.MeshStandardMaterial({color:0x493326,roughness:.82})
    );
    plaque.position.set(82.92,terrainHeight(x,z)+1.55,z);
    plaque.rotation.y=Math.PI/2;
    plaque.castShadow=true;
    plaque.receiveShadow=true;
    scene.add(plaque);
    entry.trophyPlaque=plaque;
  }else{
    entry.trophyPlaque.position.set(82.92,terrainHeight(x,z)+1.55,z);
  }
}

function mountedTrophyIndex(id){
  return Array.from(mountedAnimalIds).indexOf(id);
}

function wildlifeGroundHeight(group){
  const x=group.position.x,z=group.position.z;
  const footRadius=.42;
  return Math.max(
    renderedGroundHeight(x-footRadius,z),
    renderedGroundHeight(x+footRadius,z),
    renderedGroundHeight(x,z-footRadius),
    renderedGroundHeight(x,z+footRadius)
  )+.06;
}

function makeAnimal(template, id, targetPosition, scale=1, species='deer', habitat=null,rack=species==='deer'?rollDeerRack():null){
  const group=new THREE.Group();
  const model=cloneSkinnedModel(template.root);
  const individualSize=1+(Math.random()-.5)*.08;
  model.scale.multiplyScalar(scale*individualSize);
  model.rotation.y=Math.PI; // Quaternius animal heads face +Z; game headings use local -Z.
  const deathPose=new THREE.Group();
  deathPose.position.y=0;
  model.position.y=0;
  deathPose.add(model);
  group.add(deathPose);
  const bodyBounds=new THREE.Box3().setFromObject(model);
  const rackParent=model.getObjectByName('Head')||model;
  const antlerRack=species==='deer'&&rack?.points
    ?createDeerRack(rack.points,individualSize)
    :null;
  if(antlerRack)attachRackToDeerModel(antlerRack,rackParent,deathPose);
  const mixer=new THREE.AnimationMixer(model);
  const idle=findClip(template,['Idle'],'Idle');
  const action=idle?mixer.clipAction(idle):null;
  if(action)action.play();
  group.position.set(targetPosition.x,0,targetPosition.z);
  group.updateMatrixWorld(true);
  const modelBounds=new THREE.Box3().setFromObject(group);
  if(modelBounds.isEmpty())throw new Error(`${speciesInfo[species].label} model has no groundable geometry`);
  const groundOffset=-modelBounds.min.y;
  group.userData.groundOffset=groundOffset;
  group.position.y=wildlifeGroundHeight(group);
  group.updateMatrixWorld(true);
  model.updateMatrixWorld(true);
  group.userData={
    health:100,alert:false,mixer,action,template,clipName:idle?.name||null,
    species,label:speciesInfo[species].label,state:'Wandering',
    observed:observedSpecies.has(species),phase:0,localBounds:bodyBounds,deathPose,model,groundOffset,
    rackId:species==='deer'?rack?.id||'none':null,
    rackPoints:species==='deer'?rack?.points||0:0,
    individualSize,antlerRack,rackParent
  };
  if(species==='elk'){
    console.info(`[Wild Country] Elk spawn grounded with ${groundOffset.toFixed(2)} m model-foot correction.`);
  }
  scene.add(group);
  model.traverse(mesh=>{if(mesh.isMesh){mesh.userData.animal=group;rayHitTargets.push(mesh);}});
  wildlifeData.push({
    group,angle:Math.random()*Math.PI*2,speed:speciesInfo[species].normalSpeed,
    changeTimer:2+Math.random()*4,id,species,habitat,fleeing:false,
    fleeCooldown:0,headTimer:8+Math.random()*15,headTimerRemaining:0,
    escaped:false,escaping:false
  });
  const entry=wildlifeData[wildlifeData.length-1];
  if(harvestedAnimalIds.has(id)){
    entry.dead=true;
    entry.harvested=true;
    group.visible=false;
    removeAnimalFromRayTargets(group);
  }else if(mountedAnimalIds.has(id)){
    entry.dead=true;
    entry.mountedTrophy=true;
    placeMountedTrophy(entry,mountedTrophyIndex(id));
    removeAnimalFromRayTargets(group);
  }
  return group;
}
function spawnDeerPopulation(){
  if(deerPopulationSpawned||!animalTemplates.deer||!antlerAssetLoadFinished)return;
  deerPopulationSpawned=true;
  try{
    for(let i=0;i<7;i++){
      const x=cabinState.centerX+(Math.random()-.5)*220*WORLD_SCALE;
      const z=cabinState.centerZ+(cabinState.halfDepth+24+Math.random()*110)*WORLD_SCALE;
      makeAnimal(
        animalTemplates.deer,`deer-${i}`,
        new THREE.Vector3(x,0,z),
        1,'deer',null,rollDeerRack()
      );
    }
    applySavedDeerRacks();
  }catch(error){assetError('Deer population',error);}
}

loader.load('./assets/models/deer.glb',gltf=>{
  try{
    animalTemplates.deer=prepareTemplate(gltf,animalModelHeights.deer,'Deer');
    spawnDeerPopulation();
  }catch(error){assetError('Deer',error);}
},undefined,error=>assetError('Deer',error));

loader.load('./assets/models/antlers.glb',gltf=>{
  antlerTemplate=gltf.scene;
  antlerAssetLoadFinished=true;
  spawnDeerPopulation();
},undefined,error=>{
  assetError('Deer antlers',error);
  antlerAssetLoadFinished=true;
  spawnDeerPopulation();
});

loader.load('./assets/models/stag.glb',gltf=>{
  try{
    animalTemplates.stag=prepareTemplate(gltf,animalModelHeights.stag,'Stag');
    for(let i=0;i<2;i++){
      if(Math.random()<STAG_SPAWN_CHANCE){
        makeAnimal(animalTemplates.stag,`stag-${i}`,new THREE.Vector3((125+i*22)*WORLD_SCALE,0,(-160-i*28)*WORLD_SCALE),1,'stag');
      }
    }
  }catch(error){assetError('Stag/elk',error);}
},undefined,error=>assetError('Stag/elk',error));

const ranchHabitat={minX:70,maxX:110,minZ:70,maxZ:108};
addRanch();
applyCabinAppearance();
loader.load('./assets/models/cow.glb',gltf=>{
  try{
    animalTemplates.cow=prepareTemplate(gltf,animalModelHeights.cow,'Cow');
    [[79,82],[96,84],[86,99]].forEach(([x,z],i)=>makeAnimal(
      animalTemplates.cow,`cow-${i}`,new THREE.Vector3(x,0,z),1,'cow',ranchHabitat
    ));
  }catch(error){assetError('Cow',error);}
},undefined,error=>assetError('Cow',error));

loader.load('./assets/models/bull.glb',gltf=>{
  try{
    animalTemplates.bull=prepareTemplate(gltf,animalModelHeights.bull,'Bull');
    makeAnimal(animalTemplates.bull,'bull-0',new THREE.Vector3(96,0,100),1,'bull',ranchHabitat);
  }catch(error){assetError('Bull',error);}
},undefined,error=>assetError('Bull',error));

loader.load('./assets/models/elk.glb',gltf=>{
  try{
    animalTemplates.elk=prepareTemplate(gltf,animalModelHeights.elk,'Elk');
    console.info('[Wild Country] Elk asset has no embedded animation clips; using the static source model.');
    const elkHabitat={
      minX:cabinState.centerX-150*WORLD_SCALE,
      maxX:cabinState.centerX+150*WORLD_SCALE,
      minZ:cabinState.centerZ-240*WORLD_SCALE,
      maxZ:cabinState.centerZ-(cabinState.halfDepth+18)*WORLD_SCALE
    };
    [[-55,-70],[55,-155]].forEach(([offsetX,offsetZ],i)=>{
      const x=cabinState.centerX+offsetX*WORLD_SCALE;
      const z=cabinState.centerZ+offsetZ*WORLD_SCALE;
      makeAnimal(
        animalTemplates.elk,`elk-${i}`,new THREE.Vector3(x,0,z),1,'elk',elkHabitat
      );
    });
  }catch(error){assetError('Elk',error);}
},undefined,error=>assetError('Elk',error));

loader.load('./assets/models/horse.glb',gltf=>{
  try{
    if(!gltf?.scene)throw new Error('Horse model returned no scene');
    // Tack removal is performed after cloning, so animation/data traversal
    // cannot be disturbed while the source scene is being prepared.
    // The full model includes the head and ears; its withers should sit around
    // real adult horse height. Tack stays relative to this normalized root.
    animalTemplates.horse=prepareTemplate(gltf,animalModelHeights.horse,'Horse');
    let model;
    try{model=cloneSkinnedModel(animalTemplates.horse.root);}catch(error){console.warn('[Wild Country] Skeleton clone unavailable; using a scene clone:',error);}
    if(!model)model=animalTemplates.horse.root.clone(true);
    if(!model)throw new Error('Horse model could not be cloned');
    horse.scale.set(1,1,1); // One scale source: normalized horse model. Tack stays relative to this root.
    model.rotation.y=Math.PI; // Match the horse model head to the game's local -Z movement direction.
    horse.add(model);
    const horseBodyBox=new THREE.Box3().setFromObject(model);
    const horseBodySize=horseBodyBox.getSize(new THREE.Vector3());
    horse.userData.mixer=new THREE.AnimationMixer(model);
    const idle=findClip(animalTemplates.horse,['Idle'],'Idle');
    horse.userData.action=idle?horse.userData.mixer.clipAction(idle):null;
    if(horse.userData.action){horse.userData.action.play();horse.userData.clipName=idle.name;}
    horse.userData.coatMaterials=[];
    model.traverse(mesh=>{
      if(!mesh.isMesh)return;
      mesh.userData.animal=horse;
      const name=(mesh.name||'').toLowerCase();
      const isEmbeddedTack=name.includes('saddle')||name.includes('blanket');
      const sourceMaterials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
      const clonedMaterials=sourceMaterials.map(material=>material.clone());
      mesh.material=Array.isArray(mesh.material)?clonedMaterials:clonedMaterials[0];
      for(const material of clonedMaterials){
        if(material.color&&!isEmbeddedTack)horse.userData.coatMaterials.push({material,base:material.color.clone()});
      }
    });
    applyHorseAppearance();
    const horseBox=new THREE.Box3().setFromObject(model);
    const horseBones=[];
    model.traverse(node=>{if(node.isBone)horseBones.push(node.name);});
    const torsoPosition=new THREE.Vector3();const neckPosition=new THREE.Vector3();const headPosition=new THREE.Vector3();
    (model.getObjectByName('Torso3')||model.getObjectByName('Torso'))?.getWorldPosition(torsoPosition);
    (model.getObjectByName('Neck2')||model.getObjectByName('Neck1'))?.getWorldPosition(neckPosition);
    model.getObjectByName('Head')?.getWorldPosition(headPosition);
    console.info('[Wild Country] Horse normalized bounds and bones:',horseBox.getSize(new THREE.Vector3()),horseBones);
    const torsoLocal=new THREE.Vector3(),neckLocal=new THREE.Vector3(),headLocal=new THREE.Vector3();
    const torsoBone=model.getObjectByName('Torso3')||model.getObjectByName('Torso');
    const neckBone=model.getObjectByName('Neck2')||model.getObjectByName('Neck1');
    const headBone=model.getObjectByName('Head');
    torsoLocal.copy(torsoBone?.position||new THREE.Vector3());neckLocal.copy(neckBone?.position||new THREE.Vector3());headLocal.copy(headBone?.position||new THREE.Vector3());
    console.info('[Wild Country] Horse key bone positions:',{torsoWorld:torsoPosition.toArray(),torsoLocal:torsoLocal.toArray(),neckLocal:neckLocal.toArray(),headLocal:headLocal.toArray()});
    window.__horseDebug={bodySize:horseBodySize.toArray(),bounds:horseBox,bones:horseBones,torso:torsoPosition.toArray(),torsoLocal:torsoLocal.toArray(),neckLocal:neckLocal.toArray(),headLocal:headLocal.toArray()};
    console.info('[Wild Country] Horse body scale before tack (meters):',{width:horseBodySize.x,height:horseBodySize.y,length:horseBodySize.z});
    addHorseTack(model);
    loadRancherRider();
    horse.userData.loaded=true;
  }catch(error){assetError('Horse',error);}
},undefined,error=>assetError('Horse',error));

// First-person player
const initialPlayerZ=cabinState.inside?cabinState.centerZ+cabinState.halfDepth-3:cabinState.centerZ+cabinState.halfDepth+4.3;
const initialPlayerFloor=cabinState.inside?cabinState.floorY:terrainHeight(cabinState.centerX,initialPlayerZ);
const player={position:new THREE.Vector3(cabinState.centerX,initialPlayerFloor+PLAYER_EYE_HEIGHT,initialPlayerZ),velocity:new THREE.Vector3(),yaw:0,verticalVelocity:0,onGround:true,mounted:false,mountType:null,mountAnimal:null};
let yaw=player.yaw,pitch=0;
camera.position.set(player.position.x,player.position.y-.7,player.position.z);
cameraTransitionTime=0;
attachCameraToActiveWorld();

const dogModelAssets=[
  {key:'generic',path:'./assets/models/dog-generic.glb',height:.86,label:'Poly by Google Dog'},
  {key:'shepherd',path:'./assets/models/dog-shepherd.glb',height:.9,label:'Quaternius German Shepard'},
  {key:'beagle',path:'./assets/models/dog-beagle.glb',height:.78,label:'Poly by Google Beagle'}
];
for(const asset of dogModelAssets){
  loader.load(asset.path,gltf=>{
    try{
      dogTemplates[asset.key]=prepareTemplate(gltf,asset.height,asset.label);
      if(customizationState.dogBreed!=='none'&&dogBreedModels[customizationState.dogBreed]===asset.key){
        selectDogCompanion(customizationState.dogBreed);
      }
    }catch(error){assetError(asset.label,error);}
  },undefined,error=>{
    dogModelFailures.add(asset.key);
    assetError(asset.label,error);
  });
}

function syncCabinFloorToTerrain(){
const previousFloor=cabinState.floorY;
cabinState.floorY=terrainHeight(cabinState.centerX,cabinState.centerZ);
const heightChange=cabinState.floorY-previousFloor;
if(cabinState.inside&&!player.mounted&&Number.isFinite(heightChange)){
  player.position.y+=heightChange;
  camera.position.y+=heightChange;
}
}

function updateCameraRotation() {
  camera.rotation.order='YXZ'; camera.rotation.y=yaw;camera.rotation.x=pitch;
}
updateCameraRotation();

let mountedCameraYawOffset=0;
let mountedCameraPitch=.18;

function updateMountedThirdPersonCamera(animal,targetHeight,distance){
  const target=new THREE.Vector3(animal.position.x,targetHeight,animal.position.z);
  const cameraYaw=animal.rotation.y+mountedCameraYawOffset;
  const horizontalDistance=distance*Math.cos(mountedCameraPitch);
  const desired=new THREE.Vector3(
    target.x+Math.sin(cameraYaw)*horizontalDistance,
    target.y+1.55+Math.sin(mountedCameraPitch)*distance,
    target.z+Math.cos(cameraYaw)*horizontalDistance
  );
  camera.position.lerp(desired,player.mountType==='horse'?cameraTransitionTime<.55?.18:1:.28);
  camera.lookAt(target);
}

function lookByDelta(dx,dy){
  if(!isPlaying())return;
  const sensitivity=.0024;
  if(player.mounted){
    mountedCameraYawOffset-=dx*sensitivity;
    mountedCameraPitch=Math.max(-.18,Math.min(.75,mountedCameraPitch-dy*sensitivity));
    return;
  }
  yaw-=dx*sensitivity;
  pitch=Math.max(-Math.PI/2+.05,Math.min(Math.PI/2-.05,pitch-dy*sensitivity));
  updateCameraRotation();
}

function updateKeyboardLook(dt){
  if(player.mounted)return;
  if(keys.ArrowLeft)yaw+=dt*1.35;
  if(keys.ArrowRight)yaw-=dt*1.35;
  if(keys.ArrowUp)pitch+=dt*.9;
  if(keys.ArrowDown)pitch-=dt*.9;
  pitch=Math.max(-Math.PI/2+.05,Math.min(Math.PI/2-.05,pitch));
  updateCameraRotation();
}

const keys={};
let gameStarted=false;
let hasPointerLock=false;
let mapOpen=false;
let gunStorageOpen=false;
let safeOpen=false;
let binocularsActive=false;
let controlsVisible=true;
let observedCount=0;
const observedSpecies=new Set();
addEventListener('keydown',e=>{
  keys[e.code]=true;
  if(e.code.startsWith('Arrow'))e.preventDefault();
  if(player.mounted&&player.mountType==='bull'&&player.mountAnimal&&
     ['ArrowLeft','ArrowRight'].includes(e.code)&&!e.repeat){
    registerBullBalanceInput(e.code);
    return;
  }
  if(harvestOpen){
    if(e.code==='Escape'){e.preventDefault();closeHarvestMenu();}
    return;
  }
  if(kitchenState.fridgeOpen){
    if(e.code==='Escape'||e.code==='KeyW'){e.preventDefault();closeFridge();}
    return;
  }
  if(gunStorageOpen){
    if(e.code==='Escape'){e.preventDefault();closeGunStorage();}
    return;
  }
  if(safeOpen){
    if(e.code==='Escape'){e.preventDefault();closeSafe();}
    return;
  }
  if(kennelOpen){
    if(e.code==='Escape'||(e.code==='KeyE'&&!e.repeat)){
      e.preventDefault();
      keys.KeyE=false;
      closeKennel();
    }
    return;
  }
  if(e.code==='KeyW'&&!e.repeat&&isPlaying()&&isNearFridge()){
    e.preventDefault();
    keys.KeyW=false;
    openFridge();
    return;
  }
  if(e.code==='KeyH'&&!e.repeat&&isPlaying()){
    e.preventDefault();
    openHarvestMenu();
    return;
  }
  if(e.code==='Digit1'&&!e.repeat&&isPlaying()){
    controlsVisible=!controlsVisible;
    document.getElementById('controls').classList.toggle('controls-hidden',!controlsVisible);
    showMessage(controlsVisible?'Controls shown':'Controls hidden');
    return;
  }
  if(e.code==='Enter'&&!overlay.classList.contains('hidden')&&
     (e.target===document.body||e.target===startButton)){
    e.preventDefault();
    beginExpedition();
  }
  if(e.code==='Escape'&&mapOpen){toggleMap();e.preventDefault();}
  else if(e.code==='Escape'&&gameStarted&&!document.pointerLockElement)showPauseMenu();
  if(e.code==='KeyM'&&gameStarted&&!e.repeat&&(isPlaying()||mapOpen))toggleMap();
  if(e.code==='KeyB'&&isPlaying()&&!e.repeat&&!mapOpen)toggleBinoculars();
  if(e.code==='KeyR'&&isPlaying()){
    if(isNearFireplace()){
      if(!kitchenState.fireLit){
        kitchenState.fireLit=true;
        kitchenState.flames.visible=true;
        kitchenState.fireLight.intensity=2.8;
        showMessage('You lit the cabin fire');
      }else showMessage('The cabin fire is already burning');
    }else reload();
  }
  if(e.code==='KeyE'&&isPlaying()){
    const safeDistance=Math.hypot(
      player.position.x-(cabinState.centerX+CABIN_SAFE_LOCAL_X*CABIN_SCALE_XZ),
      player.position.z-(cabinState.centerZ+CABIN_SAFE_LOCAL_Z*CABIN_SCALE_XZ)
    );
    const lockerDistance=Math.hypot(
      player.position.x-(cabinState.centerX+CABIN_LOCKER_LOCAL_X*CABIN_SCALE_XZ),
      player.position.z-(cabinState.centerZ+CABIN_LOCKER_LOCAL_Z*CABIN_SCALE_XZ)
    );
    if(isNearKennel()){
      openKennel();
    }else if(player.mounted){
      toggleMount();
    }else if(!player.mounted&&tryMountBull()){
    }else if(isNearCabinSafe()&&safeDistance<=lockerDistance){
      openSafe();
    }else if(isNearGunLocker()){
      openGunStorage();
    }else if(isNearBunk()){
      sleepInCabin();
    }else if(isNearCooktop()){
      useCooktop();
    }else if(isNearCabinDoor()){
      transitionCabin(!cabinState.inside);
    }else if(isNearAmmoBox()){
      resupplyAmmo();
    }else if(isNearFireplace()){
      useFireplace();
    }else if(isNearRanchGate()){
      ranchGateState.open=!ranchGateState.open;
      showMessage(ranchGateState.open?'Ranch gate opened':'Ranch gate closed');
    }else if(horse.userData.loaded&&horse.position.distanceTo(player.position)<4){
      toggleMount();
    }else if(customizationState.dogBreed!=='none'){
      callDogCompanion();
    }else toggleMount();
  }
  if(e.code==='F5'){e.preventDefault();saveExpedition();}
  if(e.code==='F9'){e.preventDefault();loadExpedition();}
  if(e.code==='KeyQ'&&!e.repeat&&isPlaying()){
    if(scopeActive){
      scopeMagnification=scopeMagnification===4?8:4;
      scopeMagnificationEl.textContent=`${scopeMagnification}×`;
      showMessage(`${scopeMagnification}× scope`);
    }else if(cabinState.inside){
      showMessage('Your horse cannot hear you from inside');
    }else if(player.mounted){
      showMessage('Your horse is already with you');
    }else{
      playHorseWhistleSound();
      horse.userData.comeToPlayer=true;
      horse.userData.recallBlockedTime=0;
      showMessage(horse.userData.loaded?'You whistle for your horse':'Your horse is still arriving');
    }
  }
});
addEventListener('keyup',e=>{keys[e.code]=false;});

const overlay=document.getElementById('overlay');
const startButton=document.getElementById('startButton');
function beginExpedition(){
  gameStarted=true;
  overlay.classList.add('hidden');
  startButton.textContent='Resume Expedition';
  document.getElementById('pauseActions').hidden=true;
  document.getElementById('menuHint').textContent='WASD to travel · Arrow keys to look · Press Enter to continue';
  if(!awakeningShown){
    awakeningShown=true;
    const note=document.getElementById('awakeningNote');
    note.classList.add('visible');
    clearTimeout(beginExpedition.awakeningTimer);
    beginExpedition.awakeningTimer=setTimeout(()=>note.classList.remove('visible'),4200);
  }
  if(typeof renderer.domElement.requestPointerLock!=='function'){
    showMessage('Pointer lock is unavailable; use the arrow keys to look around');
    return;
  }
  try{
    const request=renderer.domElement.requestPointerLock();
    if(request&&typeof request.catch==='function')request.catch(error=>{
      console.warn('[Wild Country] Pointer lock was denied; keyboard controls remain available.',error);
      showMessage('Mouse capture unavailable — use the arrow keys to look around');
    });
  }catch(error){
    console.warn('[Wild Country] Pointer lock could not be requested; keyboard controls remain available.',error);
    showMessage('Mouse capture unavailable — use the arrow keys to look around');
  }
}
function showPauseMenu(){
  if(!gameStarted)return;
  for(const key of Object.keys(keys))keys[key]=false;
  overlay.classList.remove('hidden');
  startButton.textContent='Resume Expedition';
  document.getElementById('pauseActions').hidden=false;
  document.getElementById('menuHint').textContent='Expedition paused · Customize your gear or resume when ready';
}
function isPlaying(){
  return gameStarted&&overlay.classList.contains('hidden')&&!mapOpen&&!harvestOpen&&
    !kitchenState.fridgeOpen&&!gunStorageOpen&&!safeOpen&&!kennelOpen&&!cabinState.transitioning;
}

function applyCharacterAppearance(){
  const choice=customizationOptions.character[customizationState.character];
  for(const entry of rider.userData.characterMaterials||[]){
    entry.material.color.copy(entry.base).multiply(new THREE.Color(choice.tint));
  }
}

function applyHorseAppearance(){
  const choice=customizationOptions.horseCoat[customizationState.horseCoat];
  const tint=new THREE.Color(choice.tint);
  for(const entry of horse.userData.coatMaterials||[]){
    if(choice.absoluteWhite){
      entry.material.color.setHex(choice.tint);
    }else{
      entry.material.color.copy(entry.base).multiply(tint);
    }
  }
}

function applyCabinAppearance(){
  const choice=customizationOptions.cabin[customizationState.cabin];
  for(const material of cabinThemeMaterials.wood)material.color.setHex(choice.wood);
  for(const material of cabinThemeMaterials.siding)material.color.setHex(choice.siding);
  for(const material of cabinThemeMaterials.roof)material.color.setHex(choice.roof);
}

function updateCustomizationMenu(){
  document.querySelectorAll('[data-choice]').forEach(button=>{
    button.classList.toggle(
      'selected',
      customizationState[button.dataset.choice]===button.dataset.value
    );
    button.setAttribute(
      'aria-pressed',
      String(customizationState[button.dataset.choice]===button.dataset.value)
    );
  });
  document.querySelectorAll('[data-dog-breed]').forEach(button=>{
    button.classList.toggle('selected',customizationState.dogBreed===button.dataset.dogBreed);
    button.setAttribute('aria-pressed',String(customizationState.dogBreed===button.dataset.dogBreed));
  });
}

function persistCustomization(){
  try{
    localStorage.setItem('wild-country-customization-v1',JSON.stringify(customizationState));
  }catch(error){
    console.error('[Wild Country] Could not save customization preferences:',error);
    showMessage('Customization could not be saved in browser storage');
  }
}

function applyCustomization(key,value){
  if(!Object.hasOwn(customizationOptions,key)||!Object.hasOwn(customizationOptions[key],value)){
    throw new Error(`Unknown customization choice: ${key}=${value}`);
  }
  customizationState[key]=value;
  if(key==='character')applyCharacterAppearance();
  if(key==='horseCoat')applyHorseAppearance();
  if(key==='cabin')applyCabinAppearance();
  if(key==='dogBreed')selectDogCompanion(value);
  updateCustomizationMenu();
  persistCustomization();
  if(gameStarted)saveExpedition();
  const settingName=key==='horseCoat'?'Horse coat':key==='dogBreed'?'Kennel breed':
    key==='cabin'?'Cabin finish':'Rider';
  const option=customizationOptions[key][value];
  showMessage(`${settingName}: ${option.label}`);
  updateKennelUI();
}

function applySavedCustomization(saved){
  if(saved&&typeof saved==='object'){
    for(const key of Object.keys(customizationOptions)){
      if(Object.hasOwn(customizationOptions[key],saved[key]))customizationState[key]=saved[key];
    }
  }
  applyCharacterAppearance();
  applyHorseAppearance();
  applyCabinAppearance();
  updateCustomizationMenu();
}

function updateKennelUI(){
  const selection=document.getElementById('kennelSelection');
  if(selection){
    selection.textContent=`Selected kennel breed: ${customizationOptions.dogBreed[customizationState.dogBreed].label}`;
  }
  updateCustomizationMenu();
}

function openKennel(){
  kennelOpen=true;
  const kennelOverlay=document.getElementById('kennelOverlay');
  kennelOverlay.classList.add('active');
  kennelOverlay.setAttribute('aria-hidden','false');
  updateKennelUI();
}

function closeKennel(){
  kennelOpen=false;
  const kennelOverlay=document.getElementById('kennelOverlay');
  kennelOverlay.classList.remove('active');
  kennelOverlay.setAttribute('aria-hidden','true');
  keys.KeyE=false;
  if(document.pointerLockElement===renderer.domElement){
    document.exitPointerLock?.();
  }
  if(kennelPosition){
    let exitX=kennelPosition.x;
    let exitZ=kennelPosition.z+3.0;
    if(isBlocked(exitX,exitZ,.32,player)){
      exitZ=kennelPosition.z-3.0;
    }
    player.position.set(exitX,terrainHeight(exitX,exitZ)+.02,exitZ);
    player.velocity.set(0,0,0);
    player.verticalVelocity=0;
    player.onGround=true;
    player.grounded=true;
    if(typeof updatePlayerFeet==='function')updatePlayerFeet();
  }
}

startButton.addEventListener('click',beginExpedition);
document.getElementById('saveMenuButton').addEventListener('click',saveExpedition);
document.getElementById('loadMenuButton').addEventListener('click',loadExpedition);
document.querySelectorAll('[data-choice]').forEach(button=>{
  button.addEventListener('click',()=>{
    applyCustomization(button.dataset.choice,button.dataset.value);
  });
});
document.addEventListener('pointerlockchange',()=>{
  if(document.pointerLockElement===renderer.domElement){
    hasPointerLock=true;
    if(gameStarted)overlay.classList.add('hidden');
  }else if(hasPointerLock){
    hasPointerLock=false;
    showPauseMenu();
  }
});
addEventListener('pointermove',e=>{
  if(hasPointerLock)lookByDelta(e.movementX,e.movementY);
  else if(e.buttons!==0)lookByDelta(e.movementX,e.movementY);
});
addEventListener('wheel',e=>{
  if(!isPlaying()||player.mounted)return;
  e.preventDefault();
  const lineScale=e.deltaMode===WheelEvent.DOM_DELTA_LINE?16:e.deltaMode===WheelEvent.DOM_DELTA_PAGE?innerHeight:1;
  lookByDelta(e.deltaX*lineScale,e.deltaY*lineScale);
},{passive:false});

const crosshair=document.getElementById('crosshair');
const scopeOverlay=document.getElementById('scopeOverlay');
const scopeMagnificationEl=document.getElementById('scopeMagnification');
let scopeActive=false;
let scopeMagnification=4;
function toggleScope(){
  if(!rifleCarried){
    showMessage('Your rifle is stored in the cabin locker');
    return;
  }
  if(!scopeActive&&binocularsActive){
    binocularsActive=false;
    fieldNotesEl.textContent='';
  }
  scopeActive=!scopeActive;
  if(scopeActive){
    scopeMagnification=4;
    scopeMagnificationEl.textContent='4×';
    showMessage('Scope raised — Q changes magnification');
  }else{
    scopeOverlay.classList.remove('active');
    showMessage('Scope lowered');
  }
  crosshair.classList.toggle('aiming',scopeActive);
}
addEventListener('mousedown',e=>{
  if(!isPlaying())return;
  e.preventDefault();
  if(e.button===0)shoot();
  if(e.button===2){
    const now=performance.now();
    if(now-lastRightClick<360)toggleScope();
    lastRightClick=now;
  }
});
addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('auxclick',e=>e.preventDefault());

let lastRightClick=0;
const SINGLE_SHOT_CAPACITY=1;
let ammo=SINGLE_SHOT_CAPACITY, reserve=15, reloading=false;
let lastGunshotTime=-Infinity;
const lastGunshotPosition=new THREE.Vector3();
const ammoEl=document.querySelector('#ammo b'),statusEl=document.getElementById('status'),messageEl=document.getElementById('message');
const fieldNotesEl=document.getElementById('fieldNotes');
const walletEl=document.getElementById('wallet');
const harvestOverlay=document.getElementById('harvestOverlay');
const harvestDetails=document.getElementById('harvestDetails');
const kitchenOverlay=document.getElementById('kitchenOverlay');
const kitchenInventory=document.getElementById('kitchenInventory');
const gunStorageOverlay=document.getElementById('gunStorageOverlay');
const gunStorageDetails=document.getElementById('gunStorageDetails');
const toggleStoredRifleButton=document.getElementById('toggleStoredRifle');
const safeOverlay=document.getElementById('safeOverlay');
const safeDetails=document.getElementById('safeDetails');
document.getElementById('sellAnimal').addEventListener('click',sellHarvest);
document.getElementById('mountAnimal').addEventListener('click',mountHarvest);
document.getElementById('storeMeat').addEventListener('click',storeMeatHarvest);
document.getElementById('closeHarvest').addEventListener('click',closeHarvestMenu);
document.getElementById('closeKitchen').addEventListener('click',closeFridge);
document.getElementById('closeGunStorage').addEventListener('click',closeGunStorage);
toggleStoredRifleButton.addEventListener('click',toggleRifleStorage);
document.getElementById('closeSafe').addEventListener('click',closeSafe);
const mapOverlay=document.getElementById('mapOverlay');
const mapCanvas=document.getElementById('mapCanvas');
const mapContext=mapCanvas.getContext('2d');
const observationRay=new THREE.Raycaster();
document.getElementById('closeMap').addEventListener('click',toggleMap);
function updateAmmo(){ammoEl.textContent=`${rifleCarried?'':'STORED · '}${ammo} / ${reserve}`;}
function showMessage(text){messageEl.textContent=text;messageEl.style.opacity='1';clearTimeout(showMessage.timer);showMessage.timer=setTimeout(()=>messageEl.style.opacity='0',1400);}

function resupplyAmmo(){
  if(reloading){showMessage('Finish reloading before using the ammo box');return;}
  if(ammo===SINGLE_SHOT_CAPACITY&&reserve>=15){showMessage('Ammunition is already full');return;}
  ammo=SINGLE_SHOT_CAPACITY;
  reserve=Math.max(reserve,15);
  updateAmmo();
  tone(320,.12,.06);
  showMessage('Ammo box resupplied your rifle · 5 / 15');
}

function isNearCabinDoor(){
  const doorX=cabinState.centerX;
  const doorZ=cabinState.centerZ+cabinState.halfDepth;
  return Math.hypot(player.position.x-doorX,player.position.z-doorZ)<(cabinState.inside?3.3:5.2);
}

function isNearRanchGate(){
  return !cabinState.inside&&Math.hypot(player.position.x-ranchGateState.centerX,player.position.z-ranchGateState.z)<5.5;
}

function isNearKennel(){
  return Boolean(kennelPosition)&&!cabinState.inside&&!player.mounted&&
    Math.hypot(player.position.x-kennelPosition.x,player.position.z-kennelPosition.z)<3.6;
}

function isNearFridge(){
  return cabinState.inside&&Math.hypot(
    player.position.x-(cabinState.centerX+CABIN_FRIDGE_LOCAL_X*CABIN_SCALE_XZ),
    player.position.z-(cabinState.centerZ+CABIN_FRIDGE_APPROACH_LOCAL_Z*CABIN_SCALE_XZ)
  )<3.2;
}

function isNearFireplace(){
  return cabinState.inside&&Math.hypot(player.position.x-cabinState.centerX,player.position.z-(cabinState.centerZ-4.1*CABIN_SCALE_XZ))<3.4;
}

function isNearAmmoBox(){
  return cabinState.inside&&Math.hypot(
    player.position.x-(cabinState.centerX+CABIN_AMMO_LOCAL_X*CABIN_SCALE_XZ),
    player.position.z-(cabinState.centerZ+CABIN_AMMO_LOCAL_Z*CABIN_SCALE_XZ)
  )<3.4;
}

function isNearCabinSafe(){
  return cabinState.inside&&Math.hypot(
    player.position.x-(cabinState.centerX+CABIN_SAFE_LOCAL_X*CABIN_SCALE_XZ),
    player.position.z-(cabinState.centerZ+CABIN_SAFE_LOCAL_Z*CABIN_SCALE_XZ)
  )<3;
}

function isNearGunLocker(){
  return cabinState.inside&&Math.hypot(
    player.position.x-(cabinState.centerX+CABIN_LOCKER_LOCAL_X*CABIN_SCALE_XZ),
    player.position.z-(cabinState.centerZ+CABIN_LOCKER_LOCAL_Z*CABIN_SCALE_XZ)
  )<3.2;
}

function isNearBunk(){
  return cabinState.inside&&Math.hypot(
    player.position.x-(cabinState.centerX-4.2*CABIN_SCALE_XZ),
    player.position.z-(cabinState.centerZ-1.55*CABIN_SCALE_XZ)
  )<3.2;
}

function isNearCooktop(){
  return cabinState.inside&&Math.hypot(
    player.position.x-(cabinState.centerX+CABIN_COOKTOP_APPROACH_LOCAL_X*CABIN_SCALE_XZ),
    player.position.z-(cabinState.centerZ+CABIN_COOKTOP_LOCAL_Z*CABIN_SCALE_XZ)
  )<3;
}

function attachCameraToActiveWorld(){
  const activeScene=cabinState.inside?cabinInteriorScene:scene;
  if(camera.parent!==activeScene){
    camera.removeFromParent();
    activeScene.add(camera);
  }
  attachDogToActiveWorld();
}

function transitionCabin(enter,fade=true){
  if(cabinState.transitioning||cabinState.inside===enter)return;
  const switchWorld=()=>{
    if(enter){
      cabinState.returnPosition.copy(player.position);
      cabinState.returnYaw=yaw;
      cabinState.returnPitch=pitch;
      cabinState.floorY=terrainHeight(cabinState.centerX,cabinState.centerZ);
      player.position.set(cabinState.centerX,cabinState.floorY+PLAYER_EYE_HEIGHT,cabinState.centerZ+cabinState.halfDepth-3);
      yaw=0;
      pitch=0;
    }else{
      player.position.copy(cabinState.returnPosition);
      player.position.y=terrainHeight(player.position.x,player.position.z)+PLAYER_EYE_HEIGHT;
      yaw=cabinState.returnYaw;
      pitch=cabinState.returnPitch;
    }
    cabinState.inside=enter;
    attachCameraToActiveWorld();
    placeDogBesidePlayer();
    cabinState.transitioning=false;
    player.onGround=true;
    player.verticalVelocity=0;
    camera.position.copy(player.position);
    updateCameraRotation();
    cameraTransitionTime=.55;
    showMessage(enter?'You step into the cabin':'You return to the ranch');
  };
  if(!fade){switchWorld();return;}
  cabinState.transitioning=true;
  const transitionOverlay=document.getElementById('cabinTransition');
  transitionOverlay.classList.add('active');
  setTimeout(()=>{
    switchWorld();
    requestAnimationFrame(()=>transitionOverlay.classList.remove('active'));
  },170);
}

function openFridge(){
  kitchenState.fridgeOpen=true;
  kitchenOverlay.classList.add('active');
  kitchenOverlay.setAttribute('aria-hidden','false');
  updateKitchenUI();
  showMessage('Fridge opened');
}

function closeFridge(){
  kitchenState.fridgeOpen=false;
  kitchenOverlay.classList.remove('active');
  kitchenOverlay.setAttribute('aria-hidden','true');
}

function updateKitchenUI(){
  kitchenInventory.textContent=`Raw beef: ${kitchenState.rawMeat} · Cooked beef: ${kitchenState.cookedMeat} · Cooktop ${kitchenState.stoveOn?'on':'off'}`;
}

function updateCooktopVisual(){
  if(!kitchenState.burnerMaterial)return;
  kitchenState.burnerMaterial.emissive.setHex(kitchenState.stoveOn?0xd33c10:0x000000);
  kitchenState.burnerMaterial.emissiveIntensity=kitchenState.stoveOn ? .8 : 0;
}

function openGunStorage(){
  gunStorageOpen=true;
  gunStorageOverlay.classList.add('active');
  gunStorageOverlay.setAttribute('aria-hidden','false');
  updateGunStorageUI();
}

function closeGunStorage(){
  gunStorageOpen=false;
  gunStorageOverlay.classList.remove('active');
  gunStorageOverlay.setAttribute('aria-hidden','true');
}

function updateGunStorageUI(){
  gunStorageDetails.textContent=rifleCarried
    ?`Hunting rifle · .30-06 · ${ammo} loaded / ${reserve} reserve`
    :'Hunting rifle · .30-06 · Stored in locker';
  toggleStoredRifleButton.textContent=rifleCarried?'Store hunting rifle':'Take hunting rifle';
}

function toggleRifleStorage(){
  rifleCarried=!rifleCarried;
  if(!rifleCarried){
    scopeActive=false;
    binocularsActive=false;
    scopeOverlay.classList.remove('active');
    crosshair.classList.remove('aiming');
    camera.fov=70;
    camera.updateProjectionMatrix();
  }
  updateAmmo();
  updateGunStorageUI();
  saveExpedition();
  showMessage(rifleCarried?'Hunting rifle taken from locker':'Hunting rifle stored safely');
}

function openSafe(){
  safeOpen=true;
  safeOverlay.classList.add('active');
  safeOverlay.setAttribute('aria-hidden','false');
  updateSafeUI();
}

function closeSafe(){
  safeOpen=false;
  safeOverlay.classList.remove('active');
  safeOverlay.setAttribute('aria-hidden','true');
}

function updateSafeUI(){
  if(safeDetails)safeDetails.textContent=`All expedition earnings are secured here. Safe balance: $${cash}.`;
}

function sleepInCabin(){
  dayTime=.27;
  updateDayNight(0);
  saveExpedition();
  showMessage('You rested until morning');
}

function useFireplace(){
  if(!kitchenState.fireLit){
    showMessage('Press R to light the fireplace');
  }else if(kitchenState.rawMeat>0){
    kitchenState.rawMeat--;
    kitchenState.cookedMeat++;
    updateKitchenUI();
    saveExpedition();
    showMessage('Beef cooked — press E again to eat');
  }else if(kitchenState.cookedMeat>0){
    kitchenState.cookedMeat--;
    updateKitchenUI();
    saveExpedition();
    showMessage('You ate a cooked beef meal');
  }else showMessage('No meat in the cabin fridge');
}

function useCooktop(){
  if(!kitchenState.stoveOn){
    kitchenState.stoveOn=true;
    updateCooktopVisual();
    updateKitchenUI();
    saveExpedition();
    showMessage('Cooktop switched on');
  }else if(kitchenState.rawMeat>0){
    kitchenState.rawMeat--;
    kitchenState.cookedMeat++;
    updateKitchenUI();
    saveExpedition();
    showMessage('Beef cooked on the stove');
  }else if(kitchenState.cookedMeat>0){
    kitchenState.cookedMeat--;
    updateKitchenUI();
    saveExpedition();
    showMessage('You ate a cooked beef meal');
  }else{
    kitchenState.stoveOn=false;
    updateCooktopVisual();
    updateKitchenUI();
    saveExpedition();
    showMessage('Cooktop switched off');
  }
}

function getWindLabel(){
  const directions=['N','NE','E','SE','S','SW','W','NW'];
  return directions[Math.round((dayTime*360+22.5)/45)%8];
}

function updateFieldNotes(){
  const direction=getWindLabel();
  if(player.mounted&&player.mountType==='bull'&&player.mountAnimal){
    const ride=player.mountAnimal.bullRide;
    fieldNotesEl.textContent=ride?.requiredSide
      ?`Bull bucks ${ride.requiredSide} · Press ${ride.requiredSide==='left'?'Right':'Left'} Arrow to hold on`
      :'Bull riding · Brace for the next buck · E to dismount';
    return;
  }
  if(binocularsActive){
    observationRay.setFromCamera(new THREE.Vector2(0,0),camera);
    const hit=observationRay.intersectObjects(rayHitTargets,false)[0];
    const animal=hit?.object.userData.animal;
    if(animal){
      const info=animal.userData;
      const distance=player.position.distanceTo(animal.position);
      if(!observedSpecies.has(info.species)){
        observedSpecies.add(info.species);
        for(const entry of wildlifeData){
          if(entry.species===info.species)entry.group.userData.observed=true;
        }
        observedCount=observedSpecies.size;
        showMessage(`Field note recorded: ${info.label}`);
      }
      const rackNote=info.species==='deer'?` · ${info.rackId==='none'?'No antlers':`${info.rackId} rack`}`:'';
      fieldNotesEl.textContent=`${info.label}${rackNote} · ${Math.round(distance)} m · ${info.state} · Wind ${direction}`;
    }else{
      fieldNotesEl.textContent=`Binoculars · ${observedCount} species recorded · Wind ${direction}`;
    }
    return;
  }
  const nearbyCarcass=cabinState.inside?null:findNearbyHarvestableAnimal();
  if(nearbyCarcass){
    fieldNotesEl.textContent=`${nearbyCarcass.group.userData.label} · H to harvest${nearbyCarcass.species==='cow'||nearbyCarcass.species==='bull'?' for fridge meat':` · $${harvestValues[nearbyCarcass.species]}`}`;
    return;
  }
  const nearbyBull=cabinState.inside?null:wildlifeData.find(entry=>
    entry.species==='bull'&&!entry.dead&&!entry.harvested&&!entry.mountedTrophy&&entry.group.visible&&
    Math.hypot(player.position.x-entry.group.position.x,player.position.z-entry.group.position.z)<6.5
  );
  if(nearbyBull){
    fieldNotesEl.textContent='E to ride bull · Counter its bucks with the opposite Arrow key';
    return;
  }
  if(isNearKennel()){
    fieldNotesEl.textContent=`E to open kennel · ${customizationOptions.dogBreed[customizationState.dogBreed].label}`;
    return;
  }
  const safeDistance=Math.hypot(
    player.position.x-(cabinState.centerX+CABIN_SAFE_LOCAL_X*CABIN_SCALE_XZ),
    player.position.z-(cabinState.centerZ+CABIN_SAFE_LOCAL_Z*CABIN_SCALE_XZ)
  );
  const lockerDistance=Math.hypot(
    player.position.x-(cabinState.centerX+CABIN_LOCKER_LOCAL_X*CABIN_SCALE_XZ),
    player.position.z-(cabinState.centerZ+CABIN_LOCKER_LOCAL_Z*CABIN_SCALE_XZ)
  );
  if(cabinState.inside&&safeDistance<3&&safeDistance<=lockerDistance){
    fieldNotesEl.textContent=`E to open safe · Cash $${cash}`;
    return;
  }
  if(cabinState.inside&&lockerDistance<3.2){
    fieldNotesEl.textContent=`E to ${rifleCarried?'store':'take'} hunting rifle`;
    return;
  }
  if(isNearBunk()){
    fieldNotesEl.textContent='E to sleep until morning';
    return;
  }
  if(isNearCooktop()){
    fieldNotesEl.textContent=`E to use cooktop · ${kitchenState.rawMeat} raw / ${kitchenState.cookedMeat} cooked`;
    return;
  }
  if(isNearFridge()){
    const dogHint=customizationState.dogBreed==='none'?'':` · E to call ${customizationOptions.dogBreed[customizationState.dogBreed].label}`;
    fieldNotesEl.textContent=`W to inspect fridge · Raw ${kitchenState.rawMeat} · Cooked ${kitchenState.cookedMeat}${dogHint}`;
    return;
  }
  if(isNearCabinDoor()){
    fieldNotesEl.textContent=cabinState.inside?'E to return outside':'E to enter cabin';
    return;
  }
  if(isNearAmmoBox()){
    fieldNotesEl.textContent=`E to resupply rifle · ${ammo} / ${reserve}`;
    return;
  }
  if(isNearFireplace()){
    fieldNotesEl.textContent=kitchenState.fireLit
      ?`E to cook or eat · Raw ${kitchenState.rawMeat} · Cooked ${kitchenState.cookedMeat}`
      :'R to light fireplace';
    return;
  }
  if(isNearRanchGate()){
    fieldNotesEl.textContent=`E to ${ranchGateState.open?'close':'open'} ranch gate`;
    return;
  }
  if(!cabinState.inside&&!player.mounted&&horse.userData.loaded&&horse.position.distanceTo(player.position)<4){
    fieldNotesEl.textContent='E to mount horse';
    return;
  }
  if(customizationState.dogBreed!=='none'){
    fieldNotesEl.textContent=`E to call ${customizationOptions.dogBreed[customizationState.dogBreed].label} · Wildlife observed: ${observedCount}/${Object.keys(speciesInfo).length} species · Wind ${direction}`;
    return;
  }
  fieldNotesEl.textContent=`Wildlife observed: ${observedCount}/${Object.keys(speciesInfo).length} species · Wind ${direction}`;
}

function updateCabinDoor(dt){
  const smoothProgress=(progress,target,rate)=>
    progress+(target-progress)*(1-Math.exp(-dt*rate));
  if(cabinState.doorHinge)cabinState.doorHinge.rotation.y=0;
  if(ranchGateState.hinge){
    ranchGateState.progress=smoothProgress(ranchGateState.progress,ranchGateState.open?1:0,11);
    const eased=ranchGateState.progress*ranchGateState.progress*(3-2*ranchGateState.progress);
    ranchGateState.hinge.rotation.y=-1.38*eased;
  }
  if(kitchenState.fridgeDoor){
    const target=kitchenState.fridgeOpen?-1.35:0;
    kitchenState.fridgeDoor.rotation.y=smoothProgress(kitchenState.fridgeDoor.rotation.y,target,9);
  }
  if(kitchenState.fireLit&&kitchenState.fireLight){
    const flicker=.88+Math.sin(clock.elapsedTime*13)*.08+Math.sin(clock.elapsedTime*21)*.04;
    kitchenState.fireLight.intensity=2.8*flicker;
    kitchenState.flames?.children.forEach((flame,index)=>{
      flame.scale.y=.8+flicker*.3+Math.sin(clock.elapsedTime*10+index)*.13;
      flame.material.emissiveIntensity=flicker;
    });
  }
}

function findNearbyHarvestableAnimal(){
  let nearest=null,nearestDistance=3.5;
  for(const entry of wildlifeData){
    if(!['deer','stag','elk','cow','bull'].includes(entry.species)||!entry.dead||entry.harvested||entry.mountedTrophy)continue;
    const distance=Math.hypot(player.position.x-entry.group.position.x,player.position.z-entry.group.position.z);
    if(distance<nearestDistance){nearest=entry;nearestDistance=distance;}
  }
  return nearest;
}

function closeHarvestMenu(){
  harvestOpen=false;
  selectedHarvestAnimal=null;
  harvestOverlay.classList.remove('active');
  harvestOverlay.setAttribute('aria-hidden','true');
}

function openHarvestMenu(){
  const entry=findNearbyHarvestableAnimal();
  if(!entry){showMessage('Move closer to a downed animal');return;}
  selectedHarvestAnimal=entry;
  const isLivestock=entry.species==='cow'||entry.species==='bull';
  const value=harvestValues[entry.species]||0;
  document.getElementById('harvestTitle').textContent=isLivestock?'Meat Harvest':`${entry.group.userData.label} Harvest`;
  harvestDetails.textContent=isLivestock
    ?`${entry.group.userData.label} meat will be stored in your cabin fridge.`
    :`${entry.group.userData.label}${entry.species==='deer'?` · ${entry.group.userData.rackId==='none'?'No antlers':`${entry.group.userData.rackId} rack`}`:''} · Harvest value $${value}`;
  document.getElementById('sellAnimal').textContent=`Harvest and sell for $${value}`;
  document.getElementById('sellAnimal').hidden=isLivestock;
  document.getElementById('mountAnimal').hidden=isLivestock;
  document.getElementById('storeMeat').hidden=!isLivestock;
  harvestOpen=true;
  harvestOverlay.classList.add('active');
  harvestOverlay.setAttribute('aria-hidden','false');
}

function storeMeatHarvest(){
  const entry=selectedHarvestAnimal;
  if(!entry||!entry.dead||entry.harvested||!['cow','bull'].includes(entry.species)){
    closeHarvestMenu();
    return;
  }
  entry.harvested=true;
  entry.group.visible=false;
  harvestedAnimalIds.add(entry.id);
  kitchenState.rawMeat++;
  updateKitchenUI();
  closeHarvestMenu();
  saveExpedition();
  showMessage('Beef stored in the cabin fridge');
}

function updateWallet(){
  walletEl.textContent=`Cash $${cash} · Trophies ${mountedAnimalIds.size}`;
}

function sellHarvest(){
  const entry=selectedHarvestAnimal;
  if(!entry||!entry.dead||entry.harvested||entry.mountedTrophy){closeHarvestMenu();return;}
  const value=harvestValues[entry.species];
  if(!value){closeHarvestMenu();throw new Error(`Missing harvest value for ${entry.species}`);}
  entry.harvested=true;
  entry.group.visible=false;
  harvestedAnimalIds.add(entry.id);
  cash+=value;
  updateWallet();
  closeHarvestMenu();
  saveExpedition();
  showMessage(`${entry.group.userData.label} harvested · +$${value}`);
}

function mountHarvest(){
  const entry=selectedHarvestAnimal;
  if(!entry||!entry.dead||entry.harvested||entry.mountedTrophy){closeHarvestMenu();return;}
  entry.mountedTrophy=true;
  mountedAnimalIds.add(entry.id);
  removeAnimalFromRayTargets(entry.group);
  placeMountedTrophy(entry,mountedTrophyIndex(entry.id));
  updateWallet();
  closeHarvestMenu();
  saveExpedition();
  showMessage(`${entry.group.userData.label} mounted outside the ranch cabin`);
}

function toggleBinoculars(){
  if(!binocularsActive&&scopeActive)toggleScope();
  binocularsActive=!binocularsActive;
  if(binocularsActive){
    if(scopeActive)toggleScope();
    showMessage('Binoculars raised — center an animal to record a field note');
  }else{
    fieldNotesEl.textContent='';
    showMessage('Binoculars lowered');
  }
}

function toggleMap(){
  mapOpen=!mapOpen;
  mapOverlay.classList.toggle('active',mapOpen);
  mapOverlay.setAttribute('aria-hidden',String(!mapOpen));
  if(mapOpen)drawMap();
}

function drawMap(){
  const {width,height}=mapCanvas;
  const ctx=mapContext;
  const margin=12;
  const scale=Math.min((width-margin*2)/WORLD_SIZE,(height-margin*2)/WORLD_SIZE);
  const px=x=>width/2+x*scale;
  const py=z=>height/2+z*scale;
  ctx.clearRect(0,0,width,height);
  ctx.fillStyle='#566b4a';
  ctx.fillRect(0,0,width,height);
  const fillBiome=(radius,color)=>{
    ctx.beginPath();
    ctx.arc(px(0),py(0),radius*scale,0,Math.PI*2);
    ctx.fillStyle=color;
    ctx.fill();
  };
  fillBiome(BIOME_BOUNDS.secondMountain,'#72776c');
  fillBiome(BIOME_BOUNDS.pineForest,'#38543e');
  fillBiome(BIOME_BOUNDS.firstMountain,'#77796c');
  fillBiome(BIOME_BOUNDS.valley,'#748760');
  ctx.strokeStyle='rgba(232,220,184,.22)';
  ctx.lineWidth=1;
  for(let i=0;i<=4;i++){
    const x=margin+i*(width-margin*2)/4,z=margin+i*(height-margin*2)/4;
    ctx.beginPath();ctx.moveTo(x,margin);ctx.lineTo(x,height-margin);ctx.stroke();
    ctx.beginPath();ctx.moveTo(margin,z);ctx.lineTo(width-margin,z);ctx.stroke();
  }
  ctx.beginPath();
  for(let t=-TRAIL_EXTENT;t<=TRAIL_EXTENT;t+=12){
    const point=trailPoint(t);
    if(t===-TRAIL_EXTENT)ctx.moveTo(px(point.x),py(point.z));
    else ctx.lineTo(px(point.x),py(point.z));
  }
  ctx.strokeStyle='#b9a17c';ctx.lineWidth=3;ctx.stroke();
  ctx.font='9px system-ui, sans-serif';
  ctx.textAlign='center';
  ctx.fillStyle='#f0ead8';
  ctx.fillText('HIGH COUNTRY',px(-100*WORLD_SCALE),py(130*WORLD_SCALE));
  ctx.fillText('FIRST RANGE',px(-510*WORLD_SCALE),py(-400*WORLD_SCALE));
  ctx.fillText('PINE FOREST',px(0),py(-950*WORLD_SCALE));
  ctx.fillText('SECOND RANGE',px(BIOME_BOUNDS.pineForest+80*WORLD_SCALE),py(350*WORLD_SCALE));
  ctx.fillText('OUTER WOODLANDS',px(0),py(-1720*WORLD_SCALE));
  ctx.fillStyle='#d5bc8d';
  ctx.fillRect(px(90)-4,py(88)-4,8,8);
  for(const entry of wildlifeData){
    ctx.beginPath();ctx.arc(px(entry.group.position.x),py(entry.group.position.z),entry.group.userData.observed?4:2.5,0,Math.PI*2);
    ctx.fillStyle=entry.group.userData.observed?'#f4d36a':'#d7e0cc';ctx.fill();
  }
  ctx.save();
  ctx.translate(px(horse.position.x),py(horse.position.z));
  ctx.rotate(-horse.rotation.y);
  ctx.fillStyle='#9d542c';ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(5,5);ctx.lineTo(-5,5);ctx.closePath();ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(px(player.position.x),py(player.position.z));
  ctx.rotate(-yaw);
  ctx.fillStyle='#f2f1e7';ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(5,5);ctx.lineTo(-5,5);ctx.closePath();ctx.fill();
  ctx.restore();
}

function saveExpedition(){
  try{
    const save={
      version:1,
      player:{x:player.position.x,z:player.position.z,yaw,pitch},
      insideCabin:cabinState.inside,
      cabinReturn:{
        x:cabinState.returnPosition.x,z:cabinState.returnPosition.z,
        yaw:cabinState.returnYaw,pitch:cabinState.returnPitch
      },
      horse:{x:horse.position.x,z:horse.position.z,yaw:horse.rotation.y},
      mounted:player.mounted&&player.mountType==='horse',
      ammo,reserve,dayTime,rifleCarried,
      customization:{...customizationState},
      kitchen:{stoveOn:kitchenState.stoveOn},
      observedSpecies:Array.from(observedSpecies),
      cash,harvestedDeerIds:Array.from(harvestedAnimalIds),mountedDeerIds:Array.from(mountedAnimalIds),
      deerRacks:wildlifeData
        .filter(entry=>entry.species==='deer')
        .map(entry=>({id:entry.id,rackId:entry.group.userData.rackId})),
      meat:{raw:kitchenState.rawMeat,cooked:kitchenState.cookedMeat}
    };
    localStorage.setItem('wild-country-save-v1',JSON.stringify(save));
    showMessage('Expedition saved');
  }catch(error){
    console.error('[Wild Country] Could not save expedition:',error);
    showMessage('Save failed — browser storage is unavailable');
  }
}

function loadExpedition(){
  try{
    const raw=localStorage.getItem('wild-country-save-v1');
    if(!raw){showMessage('No saved expedition found');return;}
    const save=JSON.parse(raw);
    if(!save||save.version!==1||!save.player||!save.horse)throw new Error('Save file has an unsupported format');
    applySavedCustomization(save.customization);
    persistCustomization();
    const bounded=(value,fallback)=>Number.isFinite(value)?THREE.MathUtils.clamp(value,-WORLD_HALF*.98,WORLD_HALF*.98):fallback;
    horse.position.set(bounded(save.horse.x,horse.position.x),0,bounded(save.horse.z,horse.position.z));
    horse.position.y=terrainHeight(horse.position.x,horse.position.z);
    horse.rotation.y=Number.isFinite(save.horse.yaw)?save.horse.yaw:horse.rotation.y;
    player.position.set(bounded(save.player.x,player.position.x),0,bounded(save.player.z,player.position.z));
    player.position.y=terrainHeight(player.position.x,player.position.z)+PLAYER_EYE_HEIGHT;
    player.yaw=yaw=Number.isFinite(save.player.yaw)?save.player.yaw:yaw;
    pitch=Number.isFinite(save.player.pitch)?THREE.MathUtils.clamp(save.player.pitch,-1.45,1.45):0;
    player.onGround=true;player.verticalVelocity=0;
    player.mounted=Boolean(save.mounted&&horse.userData.loaded);
    player.mountType=player.mounted?'horse':null;
    player.mountAnimal=null;
    rider.removeFromParent();
    horse.add(rider);
    rider.visible=player.mounted&&riderReady;
    if(horse.userData.tack?.reinsGroup)horse.userData.tack.reinsGroup.visible=player.mounted;
    const legacyCabinSave=!Object.hasOwn(save,'insideCabin')&&!player.mounted&&
      Math.abs(player.position.x-cabinState.centerX)<cabinState.halfWidth&&
      Math.abs(player.position.z-cabinState.centerZ)<cabinState.halfDepth;
    cabinState.inside=Boolean(save.insideCabin||legacyCabinSave)&&!player.mounted;
    cabinState.floorY=terrainHeight(cabinState.centerX,cabinState.centerZ);
    const fallbackOutsideZ=cabinState.centerZ+cabinState.halfDepth+4.3;
    cabinState.returnPosition.set(
      bounded(save.cabinReturn?.x,cabinState.centerX),
      terrainHeight(bounded(save.cabinReturn?.x,cabinState.centerX),bounded(save.cabinReturn?.z,fallbackOutsideZ))+PLAYER_EYE_HEIGHT,
      bounded(save.cabinReturn?.z,fallbackOutsideZ)
    );
    cabinState.returnYaw=Number.isFinite(save.cabinReturn?.yaw)?save.cabinReturn.yaw:0;
    cabinState.returnPitch=Number.isFinite(save.cabinReturn?.pitch)?THREE.MathUtils.clamp(save.cabinReturn.pitch,-1.45,1.45):0;
    if(cabinState.inside){
      const savedX=bounded(save.player.x,cabinState.centerX);
      const savedZ=bounded(save.player.z,cabinState.centerZ+cabinState.halfDepth-3);
      const savedInsideCabin=
        Math.abs(savedX-cabinState.centerX)<cabinState.halfWidth-.7&&
        Math.abs(savedZ-cabinState.centerZ)<cabinState.halfDepth-.7;
      if(savedInsideCabin){
        player.position.set(savedX,cabinState.floorY+PLAYER_EYE_HEIGHT,savedZ);
        yaw=Number.isFinite(save.player.yaw)?save.player.yaw:0;
        pitch=Number.isFinite(save.player.pitch)?THREE.MathUtils.clamp(save.player.pitch,-1.45,1.45):0;
      }else{
        player.position.set(cabinState.centerX,cabinState.floorY+PLAYER_EYE_HEIGHT,cabinState.centerZ+cabinState.halfDepth-3);
        yaw=0;pitch=0;
      }
    }
    attachCameraToActiveWorld();
    if(player.mounted)player.position.set(horse.position.x,horse.position.y+PLAYER_EYE_HEIGHT,horse.position.z);
    ammo=Number.isInteger(save.ammo)?THREE.MathUtils.clamp(save.ammo,0,SINGLE_SHOT_CAPACITY):ammo;
    reserve=Number.isInteger(save.reserve)?THREE.MathUtils.clamp(save.reserve,0,99):reserve;
    rifleCarried=typeof save.rifleCarried==='boolean'?save.rifleCarried:true;
    kitchenState.stoveOn=Boolean(save.kitchen?.stoveOn);
    updateCooktopVisual();
    if(Number.isFinite(save.dayTime))dayTime=((save.dayTime%1)+1)%1;
    pendingDeerRacks=Array.isArray(save.deerRacks)
      ?save.deerRacks.filter(rack=>
        rack&&typeof rack.id==='string'&&
        (rack.rackId==='none'||deerRackClasses.some(rackClass=>rackClass.id===rack.rackId))
      )
      :null;
    applySavedDeerRacks();
    observedSpecies.clear();
    for(const species of Array.isArray(save.observedSpecies)?save.observedSpecies:[]){
      if(speciesInfo[species])observedSpecies.add(species);
    }
    observedCount=observedSpecies.size;
    for(const entry of wildlifeData)entry.group.userData.observed=observedSpecies.has(entry.species);
    harvestedAnimalIds.clear();
    for(const id of Array.isArray(save.harvestedDeerIds)?save.harvestedDeerIds:[]){
      if(typeof id==='string'&&/^(deer|stag|elk|cow|bull)-\d+$/.test(id))harvestedAnimalIds.add(id);
    }
    mountedAnimalIds.clear();
    for(const id of Array.isArray(save.mountedDeerIds)?save.mountedDeerIds:[]){
      if(typeof id==='string'&&/^(deer|stag|elk)-\d+$/.test(id)&&!harvestedAnimalIds.has(id))mountedAnimalIds.add(id);
    }
    cash=Number.isSafeInteger(save.cash)?Math.max(0,save.cash):0;
    kitchenState.rawMeat=Number.isSafeInteger(save.meat?.raw)?Math.max(0,save.meat.raw):0;
    kitchenState.cookedMeat=Number.isSafeInteger(save.meat?.cooked)?Math.max(0,save.meat.cooked):0;
    updateKitchenUI();
    for(const entry of wildlifeData){
      entry.trophyPlaque?.removeFromParent();
      entry.trophyPlaque=null;
      entry.harvested=harvestedAnimalIds.has(entry.id);
      entry.mountedTrophy=mountedAnimalIds.has(entry.id);
      if(entry.harvested){
        entry.dead=true;
        entry.group.visible=false;
        removeAnimalFromRayTargets(entry.group);
      }else if(entry.mountedTrophy){
        entry.dead=true;
        removeAnimalFromRayTargets(entry.group);
        placeMountedTrophy(entry,mountedTrophyIndex(entry.id));
      }else{
        entry.group.visible=true;
        entry.group.scale.setScalar(1);
      }
    }
    updateAmmo();updateWallet();updateCameraRotation();
    if(save.mounted&&!horse.userData.loaded)showMessage('Expedition loaded; mount after the horse finishes loading');
    else showMessage('Expedition loaded');
  }catch(error){
    console.error('[Wild Country] Could not load expedition:',error);
    showMessage('Load failed — saved data is invalid');
  }
}

// Recorded wilderness and movement sounds
let audioCtx=null;
function audio(){if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();return audioCtx;}
const realAudioBuffers=new Map();
let horseHoofSource=null,horseHoofGain=null;
let elkBugleTimer=18;
async function loadRecordedAudio(name,url){
  try{
    const response=await fetch(url,{cache:'force-cache'});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const data=await response.arrayBuffer();
    const buffer=await audio().decodeAudioData(data.slice(0));
    realAudioBuffers.set(name,buffer);
  }catch(error){console.warn(`[Wild Country] Recorded sound failed: ${name}`,error);}
}
function playRecordedAudio(name,volume=.45,playbackRate=1,loop=false){
  const buffer=realAudioBuffers.get(name);
  if(!buffer)return null;
  const context=audio();
  if(context.state==='suspended')context.resume().catch(()=>{});
  const source=context.createBufferSource();
  const gain=context.createGain();
  source.buffer=buffer;source.loop=loop;source.playbackRate.value=playbackRate;
  gain.gain.setValueAtTime(volume,context.currentTime);
  source.connect(gain).connect(context.destination);
  source.start();
  return {source,gain};
}
function updateHorseHoofLoop(active,speed){
  if(!active||!realAudioBuffers.has('horse-gallop')){
    if(horseHoofSource){try{horseHoofSource.stop();}catch{}horseHoofSource=null;horseHoofGain=null;}
    return;
  }
  const absoluteSpeed=Math.abs(speed);
  const desiredVolume=Math.min(.32,.13+absoluteSpeed/55);
  const desiredRate=.72+Math.min(1,absoluteSpeed/13)*.33;
  if(!horseHoofSource){
    const loop=playRecordedAudio('horse-gallop',desiredVolume,desiredRate,true);
    if(loop){horseHoofSource=loop.source;horseHoofGain=loop.gain;}
  }else{
    const context=audio();
    horseHoofSource.playbackRate.setTargetAtTime(desiredRate,context.currentTime,.025);
    horseHoofGain.gain.setTargetAtTime(desiredVolume,context.currentTime,.025);
  }
}
for(const [name,url] of Object.entries({
  'footsteps-gravel':'./assets/audio/footsteps-gravel.mp3',
  'horse-gallop':'./assets/audio/horse-gallop.ogg',
  'elk-bugle':'./assets/audio/elk-bugle.ogg',
  'deer-call':'./assets/audio/deer-call.ogg',
  'rifle-shot':'./assets/audio/gun-shot.mp3',
  'gun-reload':'./assets/audio/gun-reload.mp3'
}))loadRecordedAudio(name,url);

function updateElkBugling(dt){
  elkBugleTimer-=dt;
  if(elkBugleTimer>0)return;
  elkBugleTimer=18+Math.random()*24;
  const elk=wildlifeData.find(entry=>entry.species==='elk'&&!entry.dead&&!entry.harvested&&entry.group.visible&&entry.group.position.distanceTo(player.position)<125);
  if(elk)playRecordedAudio('elk-bugle',.4,.82);
}

// Simple synthesized interface effects remain as fallbacks
function playHorseWhistleSound(){
  const context=audio();
  if(context.state==='suspended')context.resume().catch(error=>{
    console.warn('[Wild Country] Horse whistle audio could not resume:',error);
  });
  const start=context.currentTime+.015;
  for(const [offset,frequency] of [[0,1180],[.19,1480]]){
    const oscillator=context.createOscillator();
    const envelope=context.createGain();
    oscillator.type='sine';
    oscillator.frequency.setValueAtTime(frequency*.9,start+offset);
    oscillator.frequency.exponentialRampToValueAtTime(frequency,start+offset+.07);
    oscillator.frequency.exponentialRampToValueAtTime(frequency*.78,start+offset+.17);
    envelope.gain.setValueAtTime(.0001,start+offset);
    envelope.gain.exponentialRampToValueAtTime(.11,start+offset+.025);
    envelope.gain.exponentialRampToValueAtTime(.0001,start+offset+.19);
    oscillator.connect(envelope).connect(context.destination);
    oscillator.start(start+offset);
    oscillator.stop(start+offset+.2);
  }
}
function playAnimalDeathCall(species){
  if(species==='elk')return;
  if(species==='stag'){if(playRecordedAudio('elk-bugle',.48,1.12))return;}
  if(species==='deer'){if(playRecordedAudio('deer-call',.42,.92))return;}
  const context=audio();
  if(context.state==='suspended')context.resume().catch(error=>{
    console.warn('[Wild Country] Animal call audio could not resume:',error);
  });
  const profiles={
    deer:{type:'triangle',filter:1250,start:690,peak:520,end:360,duration:.72,partials:[1,2.1],volume:.12},
    elk:{type:'sawtooth',filter:1750,start:390,peak:1050,end:310,duration:1.28,partials:[1,1.52,2.03],volume:.085},
    stag:{type:'sawtooth',filter:620,start:205,peak:290,end:82,duration:.96,partials:[1,1.48,2.12],volume:.105},
    cow:{type:'sawtooth',filter:560,start:148,peak:192,end:88,duration:1.12,partials:[1,1.98,2.97],volume:.095},
    bull:{type:'sawtooth',filter:440,start:108,peak:142,end:62,duration:1.22,partials:[1,1.98,2.97],volume:.1}
  };
  const profile=profiles[species];
  if(!profile)return;
  const start=context.currentTime+.015;
  const end=start+profile.duration;
  const master=context.createGain();
  master.gain.setValueAtTime(.0001,start);
  master.gain.exponentialRampToValueAtTime(profile.volume,start+.055);
  master.gain.setValueAtTime(profile.volume*.78,start+profile.duration*.68);
  master.gain.exponentialRampToValueAtTime(.0001,end);
  master.connect(context.destination);
  for(const partial of profile.partials){
    const oscillator=context.createOscillator();
    const band=context.createBiquadFilter();
    const voice=context.createGain();
    const multiplier=partial===1?1:.28/partial;
    oscillator.type=profile.type;
    oscillator.frequency.setValueAtTime(profile.start*partial,start);
    oscillator.frequency.exponentialRampToValueAtTime(profile.peak*partial,start+profile.duration*.24);
    oscillator.frequency.exponentialRampToValueAtTime(profile.end*partial,end);
    band.type='lowpass';
    band.frequency.setValueAtTime(profile.filter,start);
    band.frequency.linearRampToValueAtTime(profile.filter*.72,end);
    voice.gain.value=multiplier;
    oscillator.connect(band).connect(voice).connect(master);
    oscillator.start(start);
    oscillator.stop(end+.02);
  }
}
function tone(freq,duration,volume=.08,type='sine') {const c=audio();const o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(volume,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+duration);o.connect(g).connect(c.destination);o.start();o.stop(c.currentTime+duration);}
let footstepTimer=0;
function footstep(sprinting=false){if(footstepTimer<=0){
  if(!playRecordedAudio('footsteps-gravel',sprinting?.16:.12,sprinting?1.18:.92))tone(72,.09,.025,'triangle');
  footstepTimer=sprinting?.28:.43;
}}
function gunshot(){
  const shot=playRecordedAudio('rifle-shot',1.25,1);
  if(shot)return;

  const c=audio();
  if(c.state==='suspended')c.resume().catch(()=>{});

  const now=c.currentTime;
  const master=c.createGain();
  master.gain.setValueAtTime(1.75,now);
  master.gain.exponentialRampToValueAtTime(.001,now+1.3);

  const compressor=c.createDynamicsCompressor();
  compressor.threshold.value=-8;
  compressor.knee.value=5;
  compressor.ratio.value=4;
  compressor.attack.value=.001;
  compressor.release.value=.28;
  master.connect(compressor).connect(c.destination);

  // Sharp muzzle crack.
  const crackLength=Math.floor(c.sampleRate*.42);
  const crackBuffer=c.createBuffer(1,crackLength,c.sampleRate);
  const crackData=crackBuffer.getChannelData(0);
  for(let i=0;i<crackLength;i++){
    const t=i/c.sampleRate;
    const pop=t<.018?Math.exp(-t*135):0;
    const hiss=Math.exp(-t*7)*(Math.random()*2-1);
    crackData[i]=pop*(Math.random()*2-1)+hiss*.72;
  }
  const crack=c.createBufferSource();
  crack.buffer=crackBuffer;
  const crackFilter=c.createBiquadFilter();
  crackFilter.type='bandpass';
  crackFilter.frequency.value=1100;
  crackFilter.Q.value=.32;
  const crackGain=c.createGain();
  crackGain.gain.setValueAtTime(2.2,now);
  crackGain.gain.exponentialRampToValueAtTime(.001,now+.38);
  crack.connect(crackFilter).connect(crackGain).connect(master);

  // Heavy pressure-wave boom.
  for(const [frequency,endFrequency,volume,duration] of [
    [118,31,1.85,.65], [72,22,1.95,.82], [43,18,2.25,1.05]
  ]){
    const oscillator=c.createOscillator();
    oscillator.type='sine';
    oscillator.frequency.setValueAtTime(frequency,now);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency,now+duration);
    const gain=c.createGain();
    gain.gain.setValueAtTime(.001,now);
    gain.gain.linearRampToValueAtTime(volume,now+.008);
    gain.gain.exponentialRampToValueAtTime(.001,now+duration);
    oscillator.connect(gain).connect(master);
    oscillator.start(now);oscillator.stop(now+duration+.05);
  }

  // Distorted cannon-like transient and low-frequency body.
  const transient=c.createOscillator();
  transient.type='square';
  transient.frequency.setValueAtTime(155,now);
  transient.frequency.exponentialRampToValueAtTime(48,now+.11);
  const transientGain=c.createGain();
  transientGain.gain.setValueAtTime(1.25,now);
  transientGain.gain.exponentialRampToValueAtTime(.001,now+.18);
  transient.connect(transientGain).connect(master);
  transient.start(now);transient.stop(now+.2);

  crack.start(now);
}
function reload(){
  if(!rifleCarried){showMessage('Your rifle is stored in the cabin locker');return;}
  if(reloading||ammo===SINGLE_SHOT_CAPACITY||reserve===0)return;
  reloading=true;showMessage('Reloading...');
  playRecordedAudio('gun-reload',1,1);
  setTimeout(()=>{ammo=SINGLE_SHOT_CAPACITY;reserve-=1;reloading=false;updateAmmo();},1200);
}

function playAnimalOneShot(entry,preferred){
  const {group}=entry;
  const clip=findClip(group.userData.template,preferred);
  if(!clip||!group.userData.mixer)return null;
  if(group.userData.action)group.userData.action.stop();
  const action=group.userData.mixer.clipAction(clip);
  action.reset().setLoop(THREE.LoopOnce,1);
  action.clampWhenFinished=true;
  action.play();
  group.userData.action=action;
  group.userData.clipName=clip.name;
  return clip;
}

function removeAnimalFromRayTargets(animal){
  for(let i=rayHitTargets.length-1;i>=0;i--){
    if(rayHitTargets[i].userData.animal===animal)rayHitTargets.splice(i,1);
  }
}

function startAnimalDeath(entry){
  const {group}=entry;
  playAnimalDeathCall(entry.species);
  entry.dead=true;
  entry.fleeing=false;
  entry.wounded=false;
  entry.speed=0;
  group.userData.health=0;
  group.userData.alert=false;
  group.userData.state='Down';
  removeAnimalFromRayTargets(group);
  group.position.y=wildlifeGroundHeight(group);
  if(!playAnimalOneShot(entry,['Death'])){
    group.userData.action?.stop();
    entry.deathAnimation={elapsed:0,duration:1.1,side:Math.random()<.5?-1:1};
    group.userData.deathPose.rotation.set(0,0,0);
    group.userData.deathPose.position.y=0;
  }
}

function startDeerPanic(entry){
  if(entry.dead||entry.wounded)return;
  entry.fleeing=true;
  entry.panic=true;
  entry.fleeTimer=6;
  entry.speed=29;
  entry.angle=Math.atan2(player.position.x-entry.group.position.x,player.position.z-entry.group.position.z);
  entry.group.userData.alert=true;
  entry.group.userData.state='Bolting';
}

function shoot(){
  if(!rifleCarried){showMessage('Your rifle is stored in the cabin locker');return;}
  if(binocularsActive){showMessage('Lower binoculars before using the rifle');return;}
  if(reloading)return;
  if(ammo<=0){showMessage('Empty — press R');tone(100,.05,.05,'square');return;}
  ammo--;updateAmmo();gunshot();recoil=.12;
  lastGunshotTime=performance.now()/1000;
  lastGunshotPosition.copy(player.position);
  const ray=new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(0,0),camera);
  const hit=ray.intersectObjects(rayHitTargets,false)[0];
  const animal=hit?.object.userData.animal||null;
  let result='Shot missed';
  if(animal){
    const entry=wildlifeData.find(item=>item.group===animal);
    if(entry&&!entry.dead){
      startAnimalDeath(entry);
      result=`${animal.userData.label} down`;
    }
  }
  const heardRange=speciesInfo.deer.hearing*2.7;
  for(const entry of wildlifeData){
    if(entry.species==='deer'&&entry.group!==animal&&
       entry.group.position.distanceTo(player.position)<heardRange){
      startDeerPanic(entry);
    }
  }
  showMessage(result);
}

function isBlocked(x,z,radius=.35,ignoreActor=null,checkCabinInterior=true) {
  if(checkCabinInterior&&cabinState.inside){
    const cabinX=x-cabinState.centerX,cabinZ=z-cabinState.centerZ;
    if(Math.abs(cabinX)>cabinState.halfWidth-radius||Math.abs(cabinZ)>cabinState.halfDepth-radius)return true;
    for(const obstacle of cabinInteriorColliders){
      if(Math.hypot(x-obstacle.x,z-obstacle.z)<radius+obstacle.radius)return true;
    }
    return false;
  }
  if(Math.abs(x)>WORLD_HALF*.98||Math.abs(z)>WORLD_HALF*.98)return true;
  for(const segment of collisionSegments){
    if(distanceToSegmentSquared(x,z,segment)<(radius+segment.radius)**2)return true;
  }
  if(ranchGateState.hinge){
    const angle=ranchGateState.hinge.rotation.y;
    const x1=ranchGateState.centerX-ranchGateState.width/2,z1=ranchGateState.z;
    const gateSegment={
      x1,z1,
      x2:x1+ranchGateState.width*Math.cos(angle),
      z2:z1-ranchGateState.width*Math.sin(angle),
      radius:.16
    };
    if(distanceToSegmentSquared(x,z,gateSegment)<(radius+gateSegment.radius)**2)return true;
  }
  const cabinX=x-cabinState.centerX,cabinZ=z-cabinState.centerZ;
  const nearCabinWall=(
    Math.abs(Math.abs(cabinX)-cabinState.halfWidth)<radius+.12&&
    Math.abs(cabinZ)<cabinState.halfDepth+radius
  )||(
    Math.abs(Math.abs(cabinZ)-cabinState.halfDepth)<radius+.12&&
    Math.abs(cabinX)<cabinState.halfWidth+radius
  );
  const openDoorPassage=cabinZ>0&&cabinState.doorOpen&&cabinState.doorProgress>.94&&
    Math.abs(cabinZ-cabinState.halfDepth)<radius+.12&&
    Math.abs(cabinX)<cabinState.doorWidth/2-radius;
  if(nearCabinWall&&!openDoorPassage)return true;
  if(cabinState.doorHinge&&cabinState.doorProgress<.97){
    const angle=cabinState.doorHinge.rotation.y;
    const doorX=cabinState.centerX-cabinState.doorWidth/2;
    const doorZ=cabinState.centerZ+cabinState.halfDepth+.04;
    const doorSegment={
      x1:doorX,z1:doorZ,
      x2:doorX+cabinState.doorWidth*Math.cos(angle),
      z2:doorZ-cabinState.doorWidth*Math.sin(angle),
      radius:.12
    };
    if(distanceToSegmentSquared(x,z,doorSegment)<(radius+doorSegment.radius)**2)return true;
  }
  const cellX=Math.floor(x/TREE_COLLISION_CELL),cellZ=Math.floor(z/TREE_COLLISION_CELL);
  const range=Math.ceil((radius+2.5)/TREE_COLLISION_CELL);
  for(let dx=-range;dx<=range;dx++){
    for(let dz=-range;dz<=range;dz++){
      const nearby=treeCollisionGrid.get(`${cellX+dx}:${cellZ+dz}`);
      if(nearby){
        for(const tree of nearby){
          if(Math.hypot(x-tree.x,z-tree.z)<tree.radius+radius)return true;
        }
      }
      const rocks=rockCollisionGrid.get(`${cellX+dx}:${cellZ+dz}`);
      if(rocks){
        for(const rock of rocks){
          if(Math.hypot(x-rock.x,z-rock.z)<rock.radius+radius)return true;
        }
      }
    }
  }
  for(const entry of wildlifeData){
    if(entry.group===ignoreActor||!entry.group.visible)continue;
    const bodyRadius=(entry.species==='cow'||entry.species==='bull')?0.78:
      entry.species==='horse'?0.9:(entry.species==='elk'||entry.species==='stag')?0.65:0.48;
    if(Math.hypot(x-entry.group.position.x,z-entry.group.position.z)<radius+bodyRadius)return true;
  }
  if(horseCollisionGroup&&horseCollisionGroup!==ignoreActor&&horseCollisionGroup.userData.loaded&&
     Math.hypot(x-horseCollisionGroup.position.x,z-horseCollisionGroup.position.z)<radius+1.05)return true;
  return false;
}

function movePlayer(dt){
  if(player.mounted)return;
  footstepTimer-=dt;
  const forward=(keys.KeyW?1:0)-(keys.KeyS?1:0),side=(keys.KeyD?1:0)-(keys.KeyA?1:0);
  const sprint=keys.ShiftLeft||keys.ShiftRight;
  const speed=(sprint?10:6)*(forward!==0&&side!==0?.707:1);
  const f=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
  const r=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
  const move=new THREE.Vector3();move.addScaledVector(f,forward).addScaledVector(r,side);if(move.lengthSq()>0)move.normalize().multiplyScalar(speed*dt);
  const startX=player.position.x,startZ=player.position.z;
  let nx=startX+move.x,nz=startZ+move.z;
  if(isBlocked(nx,startZ))nx=startX;
  if(isBlocked(nx,nz))nz=startZ;
  if(!canTraverseTerrain(startX,startZ,nx,nz)){
    const xOnly=!isBlocked(startX+move.x,startZ)&&canTraverseTerrain(startX,startZ,startX+move.x,startZ);
    const zOnly=!isBlocked(startX,startZ+move.z)&&canTraverseTerrain(startX,startZ,startX,startZ+move.z);
    if(xOnly){nx=startX+move.x;nz=startZ;}
    else if(zOnly){nx=startX;nz=startZ+move.z;}
    else{nx=startX;nz=startZ;}
  }
  player.position.x=nx;
  player.position.z=nz;
  if(move.lengthSq()>0 && player.onGround) footstep(sprint);
  const groundY=(cabinState.inside?cabinState.floorY:terrainHeight(player.position.x,player.position.z))+PLAYER_EYE_HEIGHT;
  if(player.onGround&&keys.Space){player.verticalVelocity=7.2;player.onGround=false;}
  if(!player.onGround){
    player.verticalVelocity-=18*dt;
    player.position.y+=player.verticalVelocity*dt;
    const cabinFloorY=cabinState.inside?cabinState.floorY:terrainHeight(cabinState.centerX,cabinState.centerZ);
    if(player.position.x>cabinState.centerX-cabinState.halfWidth&&
       player.position.x<cabinState.centerX+cabinState.halfWidth&&
       player.position.z>cabinState.centerZ-cabinState.halfDepth&&
       player.position.z<cabinState.centerZ+cabinState.halfDepth&&
       player.position.y>cabinFloorY+(cabinState.inside?5.7:2.32)){
      player.position.y=cabinFloorY+(cabinState.inside?5.7:2.32);
      player.verticalVelocity=0;
    }
    if(player.position.y<=groundY){player.position.y=groundY;player.verticalVelocity=0;player.onGround=true;}
  }
  else player.position.y=THREE.MathUtils.damp(player.position.y,groundY,16,dt);
}

function toggleMount(){
  if(cabinState.inside){showMessage('You cannot ride inside the cabin');return;}
  if(player.mounted){
    if(player.mountType==='bull'){
      dismountBull(false);
      return;
    }
    const side=new THREE.Vector3(Math.cos(horse.rotation.y),0,-Math.sin(horse.rotation.y));
    const candidates=[side.clone(),side.clone().negate(),new THREE.Vector3(0,0,1),new THREE.Vector3(0,0,-1)];
    const dismount=candidates.map(direction=>horse.position.clone().addScaledVector(direction,2.4))
      .find(position=>!isBlocked(position.x,position.z,.35,horse));
    if(!dismount){showMessage('No safe room to dismount here');return;}
    player.mounted=false;player.mountType=null;player.mountAnimal=null;cameraTransitionTime=0;rider.visible=false;
    if(horse.userData.tack?.reinsGroup)horse.userData.tack.reinsGroup.visible=false;
    horse.userData.speed=0;
    player.position.copy(dismount);
    player.position.y=terrainHeight(player.position.x,player.position.z)+PLAYER_EYE_HEIGHT;
    showMessage('Dismounted');
    return;
  }
  if(!horse.userData.loaded){showMessage('Horse model is still loading');return;}
  if(horse.position.distanceTo(player.position)<4){player.mounted=true;player.mountType='horse';cameraTransitionTime=0;rider.visible=riderReady;if(horse.userData.tack?.reinsGroup)horse.userData.tack.reinsGroup.visible=true;mountedCameraYawOffset=0;mountedCameraPitch=.18;yaw=horse.rotation.y;pitch=0.05;updateCameraRotation();showMessage('Mounted — hold Shift to gallop');}
  else showMessage('Move closer to the horse');
}

function tryMountBull(){
  if(cabinState.inside||player.mounted)return false;
  const bull=wildlifeData
    .filter(entry=>entry.species==='bull'&&!entry.dead&&!entry.harvested&&!entry.mountedTrophy&&entry.group.visible)
    .sort((a,b)=>a.group.position.distanceToSquared(player.position)-b.group.position.distanceToSquared(player.position))[0];
  if(!bull||Math.hypot(bull.group.position.x-player.position.x,bull.group.position.z-player.position.z)>6.5)return false;

  player.mounted=true;
  player.mountType='bull';
  player.mountAnimal=bull;
  bull.bullRide={timer:.9,requiredSide:null,responseTime:0,successfulBraces:0,elapsed:0,baseYaw:bull.group.rotation.y};
  rider.removeFromParent();
  bull.group.add(rider);
  rider.position.set(0,.72,0);
  rider.rotation.set(0,Math.PI,0);
  rider.visible=riderReady;
  cameraTransitionTime=0;
  mountedCameraYawOffset=0;
  mountedCameraPitch=.18;
  yaw=bull.group.rotation.y;
  pitch=.04;
  updateCameraRotation();
  bull.group.userData.state='Buckling';
  showMessage('You grabbed the bull! Counter each buck with the opposite Arrow key');
  return true;
}

function registerBullBalanceInput(code){
  const ride=player.mountAnimal?.bullRide;
  if(!ride?.requiredSide)return;
  const expectedCode=ride.requiredSide==='left'?'ArrowRight':'ArrowLeft';
  if(code===expectedCode){
    ride.requiredSide=null;
    ride.timer=.85+Math.random()*.7;
    ride.successfulBraces++;
    showMessage(`You held on · ${ride.successfulBraces} buck${ride.successfulBraces===1?'':'s'} survived`);
  }else{
    dismountBull(true);
  }
}

function dismountBull(thrownOff){
  const entry=player.mountAnimal;
  if(!entry)return;
  const animal=entry.group;
  const ride=entry.bullRide;
  const direction=animal.rotation.y;
  const knockback=thrownOff?2.2:1.55;
  player.mounted=false;
  player.mountType=null;
  player.mountAnimal=null;
  cameraTransitionTime=0;
  rider.removeFromParent();
  horse.add(rider);
  rider.position.set(0,0,0);
  rider.rotation.set(0,Math.PI,0);
  rider.visible=false;
  animal.rotation.set(0,direction,0);
  animal.position.y=wildlifeGroundHeight(animal);
  entry.angle=direction;
  entry.speed=speciesInfo.bull.normalSpeed;
  entry.fleeing=true;
  entry.fleeTimer=2.2;
  entry.fleeCooldown=7;
  entry.group.userData.state='Fleeing';
  delete entry.bullRide;
  player.position.set(
    animal.position.x-Math.sin(direction)*knockback,
    animal.position.y+PLAYER_EYE_HEIGHT,
    animal.position.z-Math.cos(direction)*knockback
  );
  player.verticalVelocity=thrownOff?4.8:0;
  player.onGround=!thrownOff;
  if(thrownOff)showMessage('The bull bucked you off!');
  else showMessage('You dismounted the bull');
}

function updateBullRide(dt){
  const entry=player.mountAnimal;
  const ride=entry?.bullRide;
  if(!entry||!ride)return;
  const animal=entry.group;
  const now=clock.elapsedTime;
  if(keys.ArrowUp)mountedCameraPitch=Math.min(.75,mountedCameraPitch+dt*.55);
  if(keys.ArrowDown)mountedCameraPitch=Math.max(-.18,mountedCameraPitch-dt*.55);
  ride.elapsed+=dt;
  ride.timer-=dt;
  if(!ride.requiredSide&&ride.timer<=0){
    ride.requiredSide=Math.random()<.5?'left':'right';
    ride.responseTime=1.15;
    ride.buckTime=0;
    showMessage(`The bull bucks ${ride.requiredSide}! Press the opposite arrow`);
  }
  if(ride.requiredSide){
    ride.responseTime-=dt;
    ride.buckTime+=dt;
    if(ride.responseTime<=0){
      dismountBull(true);
      return;
    }
    const buck=Math.sin(ride.buckTime*17);
    animal.rotation.set(.24+buck*.16,ride.baseYaw+Math.sin(ride.buckTime*8)*.16,.22*Math.sin(ride.buckTime*13));
    animal.position.y=terrainHeight(animal.position.x,animal.position.z)+Math.max(0,Math.sin(ride.buckTime*12))*.28;
  }else{
    animal.rotation.x=THREE.MathUtils.damp(animal.rotation.x,0,8,dt);
    animal.rotation.y=THREE.MathUtils.damp(animal.rotation.y,ride.baseYaw,5,dt);
    animal.rotation.z=THREE.MathUtils.damp(animal.rotation.z,0,8,dt);
    animal.position.y=THREE.MathUtils.damp(animal.position.y,terrainHeight(animal.position.x,animal.position.z),10,dt);
  }
  if(animal.userData.mixer){
    setAnimation(animal.userData,animal.userData.template,['Idle']);
    animal.userData.mixer.update(dt);
  }
  rider.position.y=.72+(ride.requiredSide?Math.abs(Math.sin(now*18))*.12:Math.sin(now*3)*.025);
  yaw=ride.baseYaw;
  player.position.set(animal.position.x,animal.position.y+PLAYER_EYE_HEIGHT,animal.position.z);
  rider.visible=riderReady;
  updateMountedThirdPersonCamera(animal,animal.position.y+1.65,5.0);
  statusEl.textContent=`Bull ride · ${ride.successfulBraces} buck${ride.successfulBraces===1?'':'s'} survived`;
}

function setAnimation(userData,template,preferred){
  if(!userData.mixer||!template)return;
  const clip=findClip(template,preferred);
  if(!clip||clip.name===userData.clipName)return;
  const next=userData.mixer.clipAction(clip);
  if(userData.action)userData.action.fadeOut(.18);
  next.reset().fadeIn(.18).play();userData.action=next;userData.clipName=clip.name;
}

function findHorseMove(startX,startZ,targetX,targetZ,radius=1.05,maxGrade=.95){
  let x=startX,z=startZ;
  const distance=Math.hypot(targetX-startX,targetZ-startZ);
  const steps=Math.max(1,Math.ceil(distance/.35));
  let moved=false;
  for(let step=1;step<=steps;step++){
    const nextX=startX+(targetX-startX)*step/steps;
    const nextZ=startZ+(targetZ-startZ)*step/steps;
    const canMoveTo=(candidateX,candidateZ)=>
      !isBlocked(candidateX,candidateZ,radius,horse)&&
      canTraverseTerrain(x,z,candidateX,candidateZ,maxGrade);
    if(canMoveTo(nextX,nextZ)){
      x=nextX;z=nextZ;moved=true;
      continue;
    }
    const xOnly=Math.abs(nextX-x)>=Math.abs(nextZ-z);
    const axisCandidates=xOnly
      ?[[nextX,z],[x,nextZ]]
      :[[x,nextZ],[nextX,z]];
    const slide=axisCandidates.find(([candidateX,candidateZ])=>
      (Math.abs(candidateX-x)+Math.abs(candidateZ-z)>.001)&&canMoveTo(candidateX,candidateZ)
    );
    if(slide){
      [x,z]=slide;
      moved=true;
    }
  }
  return {x,z,moved};
}

function updateHorse(dt){
  if(!player.mounted)return;
  if(player.mountType==='bull'){
    updateBullRide(dt);
    return;
  }
  const forward=(keys.KeyW?1:0)-(keys.KeyS?1:0),turn=(keys.KeyA?1:0)-(keys.KeyD?1:0)+(keys.ArrowLeft?1:0)-(keys.ArrowRight?1:0);
  if(keys.ArrowUp)mountedCameraPitch=Math.min(.75,mountedCameraPitch+dt*.55);
  if(keys.ArrowDown)mountedCameraPitch=Math.max(-.18,mountedCameraPitch-dt*.55);
  const gallop=(keys.ShiftLeft||keys.ShiftRight)&&forward>0;
  const targetSpeed=forward*(gallop?13:6);
  horse.userData.speed=THREE.MathUtils.damp(horse.userData.speed||0,targetSpeed,targetSpeed===0?3.2:2.1,dt);
  const speed=horse.userData.speed;
  horse.rotation.y+=turn*dt*(gallop?1.45:1.05)*Math.max(.3,Math.abs(speed)/6);
  yaw=horse.rotation.y;
  let horseActuallyMoved=false;
  if(Math.abs(speed)>.01){
    const startX=horse.position.x,startZ=horse.position.z;
    const nextX=startX-Math.sin(horse.rotation.y)*speed*dt;
    const nextZ=startZ-Math.cos(horse.rotation.y)*speed*dt;
    const moved=findHorseMove(startX,startZ,nextX,nextZ);
    horse.position.x=moved.x;
    horse.position.z=moved.z;
    horseActuallyMoved=moved.moved;
    if(!moved.moved)horse.userData.speed=0;
  }
  horse.position.y=THREE.MathUtils.damp(
    horse.position.y,terrainHeight(horse.position.x,horse.position.z),14,dt
  );
  if(horse.userData.mixer){
    setAnimation(horse.userData,animalTemplates.horse,Math.abs(speed)<.25?['Idle']:Math.abs(speed)>8?['Gallop']:['Walk']);
    horse.userData.mixer.timeScale=Math.abs(speed)<.25?0:Math.min(1.65,Math.max(.7,Math.abs(speed)/6));
  }
  if(horse.userData.mixer)horse.userData.mixer.update(dt);
  player.position.set(horse.position.x,horse.position.y+PLAYER_EYE_HEIGHT,horse.position.z);
  updateRiderMotion(dt,turn,speed);
  rider.visible=riderReady;
  updateHorseHoofLoop(horseActuallyMoved && Math.abs(speed)>0.25,speed);
  updateMountedThirdPersonCamera(horse,horse.position.y+2.05,7.0);
  cameraTransitionTime+=dt;
  statusEl.textContent=Math.abs(speed)>8?'Galloping':Math.abs(speed)>.25?'Riding':'Stopped';
}

function updateHorseRecall(dt){
  if(player.mounted||cabinState.inside||!horse.userData.comeToPlayer)return;
  if(!horse.userData.loaded)return;
  const dx=player.position.x-horse.position.x;
  const dz=player.position.z-horse.position.z;
  const distance=Math.hypot(dx,dz);
  const stopDistance=3.4;
  if(distance<=stopDistance){
    horse.userData.speed=THREE.MathUtils.damp(horse.userData.speed||0,0,4,dt);
    if(horse.userData.mixer){
      setAnimation(horse.userData,animalTemplates.horse,['Idle']);
      horse.userData.mixer.timeScale=1;
      horse.userData.mixer.update(dt);
    }
    horse.userData.comeToPlayer=false;
    showMessage('Your horse has arrived');
    return;
  }

  const bearing=Math.atan2(-dx,-dz);
  const offsets=[0,.45,-.45,.9,-.9,1.45,-1.45,2.1,-2.1,Math.PI];
  const travelSpeed=distance>60?11:8;
  const step=Math.min(distance-stopDistance,travelSpeed*dt);
  let best=null;
  for(const offset of offsets){
    const heading=bearing+offset;
    const nextX=horse.position.x-Math.sin(heading)*step;
    const nextZ=horse.position.z-Math.cos(heading)*step;
    const candidate=findHorseMove(horse.position.x,horse.position.z,nextX,nextZ);
    if(!candidate.moved)continue;
    const remaining=Math.hypot(player.position.x-candidate.x,player.position.z-candidate.z);
    const score=remaining+Math.abs(offset)*.35;
    if(!best||score<best.score)best={heading,nextX:candidate.x,nextZ:candidate.z,score};
  }
  if(!best){
    horse.userData.recallBlockedTime=(horse.userData.recallBlockedTime||0)+dt;
    horse.userData.speed=0;
    return;
  }
  horse.userData.recallBlockedTime=0;
  horse.rotation.y=THREE.MathUtils.damp(horse.rotation.y,best.heading,5,dt);
  horse.position.x=best.nextX;
  horse.position.z=best.nextZ;
  horse.position.y=THREE.MathUtils.damp(horse.position.y,terrainHeight(best.nextX,best.nextZ),12,dt);
  horse.userData.speed=travelSpeed;
  if(horse.userData.mixer){
    setAnimation(horse.userData,animalTemplates.horse,['Gallop','Run','Walk']);
    horse.userData.mixer.timeScale=Math.min(1.7,Math.max(.75,travelSpeed/6));
    horse.userData.mixer.update(dt);
  }
}

function updateWildlife(dt){
  const now=performance.now()/1000;
  const moving=keys.KeyW||keys.KeyA||keys.KeyS||keys.KeyD;
  const sprinting=keys.ShiftLeft||keys.ShiftRight;
  const noiseRange=player.mounted?(moving?34:10):(sprinting&&moving?24:moving?13:4);
  const playerForward=new THREE.Vector2(-Math.sin(yaw),-Math.cos(yaw));
  const windAngle=dayTime*Math.PI*2;
  const wind=new THREE.Vector2(Math.cos(windAngle),Math.sin(windAngle));

  for(const d of wildlifeData){
    const animal=d.group;
    if(d.dead){
      if(animal.userData.mixer)animal.userData.mixer.update(dt);
      animal.position.y=wildlifeGroundHeight(animal);
      if(animal.userData.model){
        animal.userData.model.position.y=0;
      }
      if(d.deathAnimation){
        const animation=d.deathAnimation;
        animation.elapsed=Math.min(animation.duration,animation.elapsed+dt);
        const progress=animation.elapsed/animation.duration;
        const ease=progress*progress*(3-2*progress);
        animal.userData.deathPose.rotation.z=animation.side*1.22*ease;
        animal.userData.deathPose.position.y=0;
      }
      continue;
    }
    if(player.mounted&&player.mountType==='bull'&&player.mountAnimal===d)continue;
    const info=speciesInfo[d.species];
    const dx=animal.position.x-player.position.x;
    const dz=animal.position.z-player.position.z;
    const playerDistance=Math.hypot(dx,dz);
    const towardAnimal=new THREE.Vector2(dx,dz);
    if(playerDistance>0)towardAnimal.multiplyScalar(1/playerDistance);
    const inView=playerForward.dot(towardAnimal)>.05&&playerDistance<info.sight;
    const heardMovement=playerDistance<noiseRange;
    const scentCarriedDownwind=playerDistance<18&&towardAnimal.dot(wind)>.55;
    const heardGunshot=now-lastGunshotTime<8&&animal.position.distanceTo(lastGunshotPosition)<info.hearing*2.7;
    const detected=inView||heardMovement||scentCarriedDownwind||heardGunshot;

    d.fleeCooldown=Math.max(0,d.fleeCooldown-dt);
    d.headTimer-=dt;
    d.headTimerRemaining=Math.max(0,d.headTimerRemaining-dt);
    d.hitReactionTimer=Math.max(0,(d.hitReactionTimer||0)-dt);

    if(d.species==='bull'&&!player.mounted&&playerDistance<7){
      d.fleeing=false;
      d.speed=0;
      d.angle=Math.atan2(-dx,-dz);
      animal.rotation.y=d.angle;
      animal.position.y=wildlifeGroundHeight(animal);
      animal.userData.state='Agitated';
      if(animal.userData.mixer){
        setAnimation(animal.userData,animal.userData.template,['Idle']);
        animal.userData.mixer.update(dt);
      }
      continue;
    }

    if(detected&&!d.fleeing&&d.fleeCooldown===0&&playerDistance<info.fleeDistance*2.5){
      d.fleeing=true;
      d.fleeTimer=heardGunshot?5:3.3;
      d.speed=info.fleeSpeed;
      animal.userData.state='Fleeing';
    }

    if(d.fleeing){
      d.fleeTimer-=dt;
      if(d.fleeTimer<=0||(!d.panic&&!d.wounded&&playerDistance>info.fleeDistance*2.5)){
        d.fleeing=false;
        d.panic=false;
        d.fleeCooldown=10;
        animal.userData.alert=false;
        animal.userData.state=d.wounded?'Wounded — limping':'Wandering';
        d.angle=Math.random()*Math.PI*2;
        d.changeTimer=3+Math.random()*5;
        d.speed=d.wounded?info.normalSpeed*.4:info.normalSpeed;
      }
    }
    animal.userData.alert=d.fleeing;

    if(d.fleeing){
      d.angle=Math.atan2(-dx,-dz);
      if(d.panic)d.speed=29;
      else if(d.wounded)d.speed=5.5;
    }else{
      d.changeTimer-=dt;
      if(d.changeTimer<=0){
        d.angle+=((Math.random()-.5)*Math.PI);
        d.changeTimer=4+Math.random()*7;
        d.speed=info.normalSpeed*(.65+Math.random()*.7);
        animal.userData.state='Wandering';
      }
      if(d.wounded){
        d.speed=info.normalSpeed*.4;
        animal.userData.state='Wounded — limping';
      }else if(d.headTimer<=0&&d.speed<info.normalSpeed*.45){
        d.speed=0;
        animal.userData.state='Grazing';
        d.headTimer=8+Math.random()*12;
        d.changeTimer=2+Math.random()*3;
      }else if(d.headTimer<=0){
        d.speed=0;
        animal.userData.state='Resting';
        d.headTimer=6+Math.random()*9;
        d.changeTimer=2+Math.random()*3;
      }
    }

    if((d.species==='cow'||d.species==='bull')&&ranchGateState.open&&!d.escaped)d.escaping=true;
    if(d.escaping){
      if(!ranchGateState.open)d.escaping=false;
      else{
        d.angle=Math.atan2(
          -(ranchGateState.centerX-animal.position.x),
          -(ranchGateState.z+2-animal.position.z)
        );
        d.speed=8.5;
        animal.userData.state='Running for the open gate';
      }
    }
    animal.rotation.y=d.angle;
    const speed=d.speed*dt;
    const nx=animal.position.x-Math.sin(d.angle)*speed;
    const nz=animal.position.z-Math.cos(d.angle)*speed;
    const insideHabitat=d.escaped||d.escaping||!d.habitat||
      (nx>=d.habitat.minX&&nx<=d.habitat.maxX&&nz>=d.habitat.minZ&&nz<=d.habitat.maxZ);
    if(Math.abs(nx)<WORLD_SIZE*.48&&Math.abs(nz)<WORLD_SIZE*.48&&insideHabitat&&!isBlocked(nx,nz,.7,animal)){
      animal.position.x=nx;
      animal.position.z=nz;
    }else{
      d.angle+=Math.PI*.7;
      d.changeTimer=2;
    }
    if(d.escaping&&animal.position.z>ranchGateState.z+1.6&&
       Math.abs(animal.position.x-ranchGateState.centerX)<ranchGateState.width/2+.5){
      d.escaping=false;
      d.escaped=true;
      d.habitat=null;
      animal.userData.state='Escaped the ranch';
    }
    animal.position.y=wildlifeGroundHeight(animal);
    animal.userData.phase+=dt*(d.fleeing?8:3);

    if(animal.userData.mixer&&(playerDistance<140||d.hitReactionTimer>0)){
      animal.userData.mixer.timeScale=1;
      if(d.hitReactionTimer>0){
        animal.userData.mixer.update(dt);
      }else if(d.wounded){
        setAnimation(animal.userData,animal.userData.template,['Gallop_Jump','Gallop','Walk']);
        animal.userData.mixer.update(dt);
        if(d.woundedLeg){
          d.woundedLeg.rotation.x+=.65+Math.sin(now*7)*.12;
        }
      }else if(d.fleeing){
        setAnimation(animal.userData,animal.userData.template,['Gallop','Run']);
        animal.userData.mixer.update(dt);
      }else if(d.speed>info.normalSpeed*.55){
        setAnimation(animal.userData,animal.userData.template,['Walk','WalkSlow']);
        animal.userData.mixer.update(dt);
      }else{
        setAnimation(animal.userData,animal.userData.template,['Eating','Idle_Headlow','Idle_2','Idle']);
        animal.userData.mixer.update(dt);
      }
    }else if(animal.userData.mixer){
      animal.userData.mixer.timeScale=0;
    }
  }
}

let dayTime=.32;
const DAY_NIGHT_CYCLE_SECONDS=2400;
function updateDayNight(dt){
  dayTime=(dayTime+dt/DAY_NIGHT_CYCLE_SECONDS)%1;
  const sunAngle=dayTime*Math.PI*2;
  sun.position.set(Math.cos(sunAngle)*300*WORLD_SCALE,Math.sin(sunAngle)*300,100*WORLD_SCALE);
  const sunHeight=Math.sin(sunAngle);
  const daylight=THREE.MathUtils.clamp((sunHeight+.38)/1.38,0.08,1);
  sun.intensity=daylight*2;
  hemi.intensity=.25+daylight*.9;
  const sky=new THREE.Color();
  sky.setHSL(.58,.38,.12+daylight*.58);
  scene.background=sky;
  scene.fog.color.copy(sky);
  scene.fog.density=.00058+(.00018*(1-daylight));
}

let fieldNotesTimer=0;
function updateWeaponPose(dt){
  weaponMotionTime+=dt;
  const moving=keys.KeyW||keys.KeyA||keys.KeyS||keys.KeyD;
  const sprinting=moving&&(keys.ShiftLeft||keys.ShiftRight);
  const aiming=scopeActive;
  const basePosition=aiming?weaponAimPosition:sprinting?weaponSprintPosition:moving?weaponCarryPosition:weaponIdlePosition;
  const gaitRate=sprinting?12:moving?7.5:1.7;
  const gait=weaponMotionTime*gaitRate;
  const swayScale=aiming?(sprinting?.003:.0018):sprinting?.012:moving?.006:.0025;
  const reloadWave=reloading?Math.sin(performance.now()*.012):0;
  const reloadDrop=reloading?Math.max(0,reloadWave)*-.12:0;
  const swayX=Math.sin(gait*.5)*swayScale;
  const swayY=sprinting?-Math.abs(Math.sin(gait))*swayScale:Math.sin(gait*2)*swayScale*.55;
  const swayZ=Math.cos(gait*.5)*swayScale*.45;
  const targetX=basePosition.x+swayX;
  const targetY=basePosition.y+swayY+reloadDrop;
  const targetZ=basePosition.z+swayZ+recoil;
  const blend=1-Math.exp(-dt*(aiming?10:7.5));

  weapon.position.x+=(targetX-weapon.position.x)*blend;
  weapon.position.y+=(targetY-weapon.position.y)*blend;
  weapon.position.z+=(targetZ-weapon.position.z)*blend;
  const targetRotationX=(aiming?-.005:sprinting?-.19:moving?-.065:-.14)+recoil*.9+Math.sin(gait)*swayScale*.55;
  const targetRotationY=aiming?0:-.12+Math.sin(gait*.5)*swayScale*.4;
  const targetRotationZ=(aiming?0:sprinting?-.025:moving?-.035:-.045)+Math.cos(gait*.5)*swayScale+reloadWave*-.16;
  weapon.rotation.x+=(targetRotationX-weapon.rotation.x)*blend;
  weapon.rotation.y+=(targetRotationY-weapon.rotation.y)*blend;
  weapon.rotation.z+=(targetRotationZ-weapon.rotation.z)*blend;
  const targetScale=aiming?.22:1;
  weapon.scale.setScalar(weapon.scale.x+(targetScale-weapon.scale.x)*blend);
  recoil=Math.max(0,recoil-dt*.72);
}

function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);
  grassWindUniform.value+=dt;
  waterTimeUniform.value+=dt;
  treeWindUniform.value+=dt;
  updateTreeLods(dt);
  updateCabinDoor(dt);
  if(isPlaying()){
    if(!cabinState.inside){updateWildlife(dt);updateElkBugling(dt);updateDayNight(dt);}
    updateKeyboardLook(dt);
    if(!player.mounted){
      movePlayer(dt);
      if(!cabinState.inside)updateHorseRecall(dt);
      if(cameraTransitionTime<.55){
        const blend=1-Math.exp(-dt*5);
        camera.position.lerp(player.position,blend);
        const targetRotation=new THREE.Euler(pitch,yaw,0,'YXZ');
        camera.quaternion.slerp(new THREE.Quaternion().setFromEuler(targetRotation),blend);
        cameraTransitionTime+=dt;
      }else{
        camera.position.copy(player.position);
        updateCameraRotation();
      }
    }
    else {updateHorse(dt);}
    if(!player.mounted||player.mountType!=='horse')updateHorseHoofLoop(false,0);
    updateDogCompanion(dt);
    fieldNotesTimer-=dt;
    if(fieldNotesTimer<=0){updateFieldNotes();fieldNotesTimer=.25;}
  }
  const binocularFov=binocularsActive?12:70;
  const desiredFov=scopeActive?(70/scopeMagnification):binocularFov;
  camera.fov+=(desiredFov-camera.fov)*Math.min(1,dt*8);
  camera.updateProjectionMatrix();
  scopeOverlay.classList.toggle('active',scopeActive);
  crosshair.classList.toggle('aiming',scopeActive);
  crosshair.style.display=scopeActive||player.mounted?'none':'';
  weapon.visible=rifleLoaded&&rifleCarried&&!player.mounted&&!scopeActive&&!binocularsActive;
  updateWeaponPose(dt);
  if(!player.mounted)statusEl.textContent='';
  renderer.render(cabinState.inside?cabinInteriorScene:scene,camera);
}
animate();

addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
updateAmmo();
updateWallet();
