const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const geometry=require('../../src/MedAnnotateApp.Presentation/wwwroot/js/annotationGeometry.js');

const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-7,`${actual} differs from ${expected}`);

function fixture(width=600,height=400){
  const imageCalls=[];
  const ctx=new Proxy({drawImage:(...args)=>imageCalls.push(args)},{get:(target,key)=>target[key]??(()=>{})});
  function element(tag){
    const listeners={},captures=new Set();
    return{tag,style:{},children:[],listeners,width:0,height:0,
      get clientWidth(){return Math.max(0,parseFloat(this.style.width)-4);},
      get clientHeight(){return Math.max(0,parseFloat(this.style.height)-4);},
      appendChild(child){this.children.push(child);child.parentElement=this;return child;},
      removeChild(child){this.children.splice(this.children.indexOf(child),1);child.parentElement=null;},
      querySelector(selector){return this.children.find(child=>child.tag===selector);},
      addEventListener(name,callback){(listeners[name]??=[]).push(callback);},
      removeEventListener(name,callback){listeners[name]=(listeners[name]??[]).filter(value=>value!==callback);},
      emit(name,event={}){for(const callback of listeners[name]??[])callback(event);},
      setAttribute(){},getContext:()=>ctx,
      setPointerCapture:id=>captures.add(id),hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id),
      getBoundingClientRect(){
        const left=parseFloat(this.style.left)||0,top=parseFloat(this.style.top)||0;
        const width=parseFloat(this.style.width)||0,height=parseFloat(this.style.height)||0;
        return{left,top,width,height,right:left+width,bottom:top+height};
      }
    };
  }
  let rect={left:80,top:120,width,height,right:80+width,bottom:120+height};
  const canvas=element('canvas');canvas.getBoundingClientRect=()=>rect;canvas.dispatchEvent=()=>{};
  const sourceImage={src:'fixture.svg',currentSrc:'fixture.svg',complete:true,naturalWidth:1200,naturalHeight:800,addEventListener:()=>{}};
  const column={clientWidth:width+8};
  const viewport={clientWidth:width+8,clientHeight:height+8};
  const imageContainer={style:{},closest:selector=>selector==='.image-viewport'?viewport:column};
  const container={style:{},parentElement:imageContainer,closest:()=>column};
  const elements={mainCanvas:canvas,sourceImage,canvasContainer:container,'image-container':imageContainer};
  const document={getElementById:id=>elements[id],createElement:element,body:element('body'),addEventListener:()=>{},removeEventListener:()=>{}};
  const window={addEventListener:()=>{},innerWidth:1400,devicePixelRatio:1};
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../../src/MedAnnotateApp.Presentation/wwwroot/js/canvas.js'),'utf8'),
    {window,document,AnnotationGeometry:geometry,structuredClone,CustomEvent:function(){},console});
  const manager=new window.CanvasManager('mainCanvas','sourceImage','canvasContainer');
  manager.setAnnotations([
    {type:'rectangle',cx:300,cy:250,width:200,height:100,rotation:Math.PI/6},
    {type:'freehand',points:[{x:600,y:400},{x:700,y:400},{x:650,y:500},{x:600,y:400}]}
  ]);
  const stored=manager.getAllAnnotationsJSON();let changes=0;manager.onAnnotationsChange=()=>{changes++;};
  manager.showLens();
  const event=(x,y,pointerId=7)=>({clientX:x,clientY:y,pointerId,button:0,preventDefault(){},stopPropagation(){}});
  const lensRect=()=>manager.lens.getBoundingClientRect();
  const center=()=>{const r=lensRect();return{x:r.left+r.width/2,y:r.top+r.height/2};};
  const emit=(name,x,y,pointerId=7)=>manager.lens.emit(name,event(x,y,pointerId));
  return{manager,canvas,event,emit,lensRect,center,stored,window,imageCalls,changes:()=>changes,rect:()=>rect,
    resize:(width,height)=>{rect={...rect,width,height,right:rect.left+width,bottom:rect.top+height};viewport.clientWidth=width+8;viewport.clientHeight=height+8;manager.resizeDisplay();}};
}

function unchanged(f){assert.equal(f.manager.getAllAnnotationsJSON(),f.stored);assert.equal(f.changes(),0);}
// The lens may hang over the image edge; its clip-path hides that part, so this is what the reader sees.
function visibleRect(f){
  const r=f.lensRect(),clip=f.manager.lens.style.clipPath;
  if(!clip)return r;
  const [top,right,bottom,left]=clip.match(/-?[\d.]+/g).map(Number).map(value=>Math.max(0,value));
  return{left:r.left+left,top:r.top+top,right:r.right-right,bottom:r.bottom-bottom};
}
function onImage(f){
  const v=visibleRect(f),image=f.rect(),c=f.center(),e=1e-6;
  assert.ok(v.left>=image.left-e&&v.top>=image.top-e&&v.right<=image.right+e&&v.bottom<=image.bottom+e,'only the image part of the lens is visible');
  assert.ok(c.x>=image.left-e&&c.x<=image.right+e&&c.y>=image.top-e&&c.y<=image.bottom+e,'the lens centre stays on the image');
}

test('all eight circular border directions resize outward and inward around a fixed center',()=>{
  for(let i=0;i<8;i++)for(const delta of [10,-10]){
    const f=fixture(),center=f.center(),radius=f.lensRect().width/2;
    const angle=i*Math.PI/4,point=distance=>({x:center.x+Math.cos(angle)*distance,y:center.y+Math.sin(angle)*distance});
    const start=point(radius-1),end=point(radius-1+delta);
    f.emit('pointerdown',start.x,start.y);
    assert.equal(f.manager.isResizingLens,true,`direction ${i} must recognize the visible circular border`);
    assert.equal(f.manager.draggingLens,false);
    f.emit('pointermove',end.x,end.y);
    near(f.lensRect().width,150+2*delta);near(f.lensRect().height,150+2*delta);
    near(f.center().x,center.x);near(f.center().y,center.y);
    f.emit('pointerup',end.x,end.y);assert.equal(f.manager.isResizingLens,false);
    unchanged(f);
  }
});

test('inside dragging moves the lens while the circular edge gives directional resizing cursors',()=>{
  const f=fixture(),center=f.center();
  f.emit('pointermove',center.x,center.y);assert.match(f.manager.lens.style.cursor,/move|grab/);
  f.emit('pointerdown',center.x,center.y);
  assert.equal(f.manager.draggingLens,true);assert.equal(f.manager.isResizingLens,false);
  f.emit('pointermove',center.x+30,center.y+40);
  near(f.center().x,center.x+30);near(f.center().y,center.y+40);near(f.lensRect().width,150);
  f.emit('pointerup',center.x+30,center.y+40);
  const shifted=f.center(),radius=f.lensRect().width/2-1;
  for(const [angle,cursor]of [[0,'ew-resize'],[Math.PI/2,'ns-resize'],[Math.PI/4,'nwse-resize'],[3*Math.PI/4,'nesw-resize']]){
    f.emit('pointermove',shifted.x+Math.cos(angle)*radius,shifted.y+Math.sin(angle)*radius);
    assert.equal(f.manager.lens.style.cursor,cursor);
  }
  unchanged(f);
});

test('lens sizing respects minimum, maximum and images smaller than the ordinary minimum',()=>{
  const f=fixture(),center=f.center();
  f.emit('pointerdown',center.x+74,center.y);
  f.emit('pointermove',center.x+500,center.y);near(f.lensRect().width,400,'the smaller image side caps the lens');
  f.emit('pointermove',center.x+1,center.y);near(f.lensRect().width,75);
  f.emit('pointerup',center.x+1,center.y);unchanged(f);
  const small=fixture(60,40),smallCenter=small.center();
  assert.ok(small.lensRect().width<=40);
  small.emit('pointerdown',smallCenter.x+small.lensRect().width/2-1,smallCenter.y);
  small.emit('pointermove',smallCenter.x+500,smallCenter.y);assert.ok(small.lensRect().width<=40);
  small.emit('pointermove',smallCenter.x+1,smallCenter.y);assert.ok(small.lensRect().width<=40);
  small.emit('pointerup',smallCenter.x+1,smallCenter.y);
  onImage(small);
  unchanged(small);
  const large=fixture(1400,1000),largeCenter=large.center();
  large.emit('pointerdown',largeCenter.x+74,largeCenter.y);
  large.emit('pointermove',largeCenter.x+900,largeCenter.y);near(large.lensRect().width,600,'large images stop at 600px');
  large.emit('pointerup',largeCenter.x+900,largeCenter.y);unchanged(large);
});

test('pointer release, cancellation and lost capture stop both resizing and dragging',()=>{
  for(const finish of ['pointerup','pointercancel','lostpointercapture'])for(const edge of [false,true]){
    const f=fixture(),center=f.center(),lens=f.manager.lens;
    const start={x:center.x+(edge?74:0),y:center.y};
    f.emit('pointerdown',start.x,start.y);assert.equal(lens.hasPointerCapture(7),true);
    f.emit('pointermove',start.x+10,start.y+10);
    f.emit(finish,start.x+10,start.y+10);
    assert.equal(f.manager.draggingLens,false);assert.equal(f.manager.isResizingLens,false);
    const before=f.lensRect();
    f.emit('pointermove',start.x+100,start.y+100);
    assert.deepEqual(f.lensRect(),before,`${finish} must not leave a stale ${edge?'resize':'drag'} interaction`);
    unchanged(f);
  }
});

test('unrelated pointers and secondary mouse buttons cannot take over a lens gesture',()=>{
  const f=fixture(),center=f.center();
  f.manager.lens.emit('pointerdown',{...f.event(center.x,center.y),button:2});
  assert.equal(f.manager.draggingLens,false);assert.equal(f.manager.isResizingLens,false);
  f.emit('pointerdown',center.x+74,center.y);
  const before=f.lensRect();
  f.emit('pointermove',center.x+150,center.y,9);assert.deepEqual(f.lensRect(),before);
  f.emit('pointerup',center.x+150,center.y,9);assert.equal(f.manager.isResizingLens,true);
  f.emit('pointermove',center.x+84,center.y);near(f.lensRect().width,170);
  f.emit('pointerup',center.x+84,center.y);unchanged(f);
});

test('closing and reopening the lens clears a captured gesture without changing research geometry',()=>{
  const f=fixture(),center=f.center(),oldLens=f.manager.lens;
  f.emit('pointerdown',center.x+74,center.y);f.emit('pointermove',center.x+84,center.y);
  assert.equal(oldLens.hasPointerCapture(7),true);assert.equal(f.manager.isResizingLens,true);
  f.manager.hideLens();
  assert.equal(f.manager.usingLens,false);assert.equal(f.manager.lens,null);
  assert.equal(f.manager.draggingLens,false);assert.equal(f.manager.isResizingLens,false);
  assert.equal(oldLens.hasPointerCapture(7),false);
  f.manager.showLens();const before=f.lensRect();
  f.emit('pointermove',center.x+140,center.y+100);assert.deepEqual(f.lensRect(),before);
  unchanged(f);
});

test('a high-DPI lens keeps fourfold visual magnification and the original annotation backing dimensions',()=>{
  const f=fixture();f.window.devicePixelRatio=2;f.imageCalls.length=0;
  f.manager.updateLens();
  const lensCanvas=f.manager.lens.querySelector('canvas'),contentSize=f.lensRect().width-4;
  near(lensCanvas.width,contentSize*2);near(lensCanvas.height,contentSize*2);
  const draw=f.imageCalls.find(args=>args[0]===f.canvas);
  assert.ok(draw,'the lens should sample the original image canvas');
  near(draw[3],contentSize*1200/600/4);near(draw[4],contentSize*800/400/4);
  near(draw[7],contentSize);near(draw[8],contentSize);
  assert.equal(f.canvas.width,1200);assert.equal(f.canvas.height,800);unchanged(f);
});

test('display resizing keeps the visible lens on the image without changing original coordinates',()=>{
  const f=fixture();
  for(const [width,height]of [[180,120],[60,40],[600,400]]){
    f.resize(width,height);
    assert.ok(f.lensRect().width<=Math.min(600,width,height));
    onImage(f);
    assert.equal(f.canvas.width,1200);assert.equal(f.canvas.height,800);unchanged(f);
  }
});

test('a large lens reaches every image border, marks the exact edge point and covers nothing outside the image',()=>{
  const f=fixture(),image=f.rect(),start=f.center();
  f.emit('pointerdown',start.x+74,start.y);f.emit('pointermove',start.x+500,start.y);f.emit('pointerup',start.x+500,start.y);
  near(f.lensRect().width,400);
  const content=400-4,source=content/4*2;
  for(const [x,y]of [[image.left-50,image.top-50],[image.right+80,image.bottom+5],[image.left,image.top+200],[image.left+300,image.bottom]]){
    const from=f.center();
    f.emit('pointerdown',from.x,from.y);f.emit('pointermove',x,y);f.emit('pointerup',x,y);
    const c=f.center();
    near(c.x,Math.min(Math.max(x,image.left),image.right));near(c.y,Math.min(Math.max(y,image.top),image.bottom));
    assert.notEqual(f.manager.lens.style.clipPath,'');
    onImage(f);
    // Only the on-image part is sampled, placed so the image point under the centre sits under the crosshair.
    const draw=f.imageCalls.filter(args=>args[0]===f.canvas).at(-1);
    const pointX=(c.x-image.left)*2,pointY=(c.y-image.top)*2;
    near(draw[5],(draw[1]-(pointX-source/2))*content/source);near(draw[6],(draw[2]-(pointY-source/2))*content/source);
    near(draw[7],draw[3]*content/source);near(draw[8],draw[4]*content/source);
    assert.ok(draw[1]>=0&&draw[2]>=0&&draw[1]+draw[3]<=1200+1e-6&&draw[2]+draw[4]<=800+1e-6);
  }
  const from=f.center();
  f.emit('pointerdown',from.x,from.y);f.emit('pointermove',image.left+300,image.top+200);f.emit('pointerup',image.left+300,image.top+200);
  assert.equal(f.manager.lens.style.clipPath,'','a lens fully on the image is not clipped');
  unchanged(f);
});
