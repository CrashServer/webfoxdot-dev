// ── Mesh warp for output windows ──────────────────────────────────────────────
// Three warp modes, in increasing order of freedom:
//
//   "4pt"  — only the 4 corners are draggable.  The rest of the grid follows a
//            true projective (homography) map, so this is a real keystone
//            correction: straight lines in the source stay straight.
//   "edge" — every point along the outer edge is draggable, corners included.
//            The interior follows via a Coons patch, so a curved or bowed
//            screen edge bends the image smoothly instead of only at the rim.
//   "mesh" — every point of the N×N grid is draggable (full free-form warp).
//
// N (control points per side) is switchable at runtime and is used in all three
// modes: in "edge"/"mesh" it is the number of control points, and everywhere it
// is the triangle raster resolution — more subdivisions means a closer
// approximation of the projective/Coons map, at some fill cost.
//
// When every point sits at its regular-grid position (identity) the module
// short-circuits to a straight drawImage, so an unwarped output costs nothing.
// Otherwise it rasterises texture-mapped triangles in Canvas 2D — the same
// trick real mapping software uses.
//
// API mirror of attachWarp so outputs.js can hot-swap without changing its
// call sites:
//   createMeshWarp(win, canvas, W, H, color, onChange)
//   → { getCorners, setCorners, getMesh, setMesh, getMode, setMode,
//       getGridSize, setGridSize, setEditing, reset, destroy, drawMeshWarp }

export const WARP_MODES = ["4pt", "edge", "mesh"];
export const GRID_SIZES = [3, 5, 7, 9, 13, 17];

// ── Square → quad projective map ─────────────────────────────────────────────
// corners are [TL, TR, BR, BL], i.e. unit-square (0,0) (1,0) (1,1) (0,1).
// Returns f(u,v) → {x,y}.  A parallelogram makes g=h=0 and the map degrades to
// the exact affine one; a fully degenerate quad falls back to affine as well.
function quadMap(corners) {
    const [p0, p1, p2, p3] = corners;
    const x0=p0.x,y0=p0.y,x1=p1.x,y1=p1.y,x2=p2.x,y2=p2.y,x3=p3.x,y3=p3.y;
    const dx1=x1-x2,dx2=x3-x2,dx3=x0-x1+x2-x3;
    const dy1=y1-y2,dy2=y3-y2,dy3=y0-y1+y2-y3;
    let g=0,h=0;
    if (Math.abs(dx3)>1e-9||Math.abs(dy3)>1e-9){
        const det=dx1*dy2-dx2*dy1;
        if (Math.abs(det)>1e-12){ g=(dx3*dy2-dx2*dy3)/det; h=(dx1*dy3-dx3*dy1)/det; }
    }
    const a=x1-x0+g*x1,b=x3-x0+h*x3,c=x0;
    const d=y1-y0+g*y1,e=y3-y0+h*y3,f=y0;
    return (u,v)=>{
        let w=g*u+h*v+1;
        if (Math.abs(w)<1e-6) w=w<0?-1e-6:1e-6;
        return {x:(a*u+b*v+c)/w, y:(d*u+e*v+f)/w};
    };
}

// ── Affine triangle fill ──────────────────────────────────────────────────────
// Draws one texture-mapped triangle.  img is the source canvas/image; all
// u/v coords are in [0,1]; destination x/y are in canvas pixels.
// The clip polygon is expanded 0.75px outward from the centroid so adjacent
// triangles overlap slightly at their seam — this eliminates the 1-px gap
// that Canvas2D's anti-aliased clip edges would otherwise leave.
function drawTri(ctx, img, imgW, imgH, x0,y0,x1,y1,x2,y2, u0,v0,u1,v1,u2,v2) {
    const sx0=u0*imgW,sy0=v0*imgH,sx1=u1*imgW,sy1=v1*imgH,sx2=u2*imgW,sy2=v2*imgH;
    const d=sx0*(sy1-sy2)+sx1*(sy2-sy0)+sx2*(sy0-sy1);
    if (Math.abs(d)<1e-8) return;
    const a=(x0*(sy1-sy2)+x1*(sy2-sy0)+x2*(sy0-sy1))/d;
    const b=(x0*(sx2-sx1)+x1*(sx0-sx2)+x2*(sx1-sx0))/d;
    const c=(x0*(sx1*sy2-sx2*sy1)+x1*(sx2*sy0-sx0*sy2)+x2*(sx0*sy1-sx1*sy0))/d;
    const e=(y0*(sy1-sy2)+y1*(sy2-sy0)+y2*(sy0-sy1))/d;
    const f_=(y0*(sx2-sx1)+y1*(sx0-sx2)+y2*(sx1-sx0))/d;
    const g=(y0*(sx1*sy2-sx2*sy1)+y1*(sx2*sy0-sx0*sy2)+y2*(sx0*sy1-sx1*sy0))/d;
    // Expand clip boundary outward from centroid to cover seam gaps.
    const cx=(x0+x1+x2)/3, cy=(y0+y1+y2)/3;
    function ex(x,y){const dx=x-cx,dy=y-cy,l=Math.sqrt(dx*dx+dy*dy)||1;return[x+dx/l*0.75,y+dy/l*0.75];}
    const [ex0,ey0]=ex(x0,y0),[ex1,ey1]=ex(x1,y1),[ex2,ey2]=ex(x2,y2);
    ctx.save();
    ctx.beginPath();ctx.moveTo(ex0,ey0);ctx.lineTo(ex1,ey1);ctx.lineTo(ex2,ey2);ctx.closePath();ctx.clip();
    ctx.transform(a,e,b,f_,c,g);
    ctx.drawImage(img,0,0);
    ctx.restore();
}

// ── Main export ───────────────────────────────────────────────────────────────
export function createMeshWarp(win, canvas, W, H, color="4fd1ff", onChange=null) {
    const doc = win.document;
    canvas.style.transformOrigin = "0 0";
    canvas.style.position = "absolute";
    canvas.style.left = "0"; canvas.style.top = "0";
    doc.body.style.position = "relative";

    let N = 5;               // control points per side
    let grid = makeIdentityGrid(N);   // row-major grid[row][col], normalised {x,y}
    let editing = false;
    let mode = "mesh";       // "4pt" | "edge" | "mesh"
    let handles = [];

    function makeIdentityGrid(n) {
        const g = [];
        for (let r=0;r<n;r++){g[r]=[];for(let c=0;c<n;c++) g[r][c]={x:c/(n-1),y:r/(n-1)};}
        return g;
    }

    // Every point within 0.001 of its regular-grid position → the warp is a no-op.
    function isIdentity() {
        for (let r=0;r<N;r++) for (let c=0;c<N;c++) {
            if (Math.abs(grid[r][c].x-c/(N-1))>0.001||Math.abs(grid[r][c].y-r/(N-1))>0.001) return false;
        }
        return true;
    }

    // Which points the user may drag in the current mode.  The others are
    // derived by reproject().
    function isFree(r,c){
        if (mode==="4pt")  return (r===0||r===N-1)&&(c===0||c===N-1);
        if (mode==="edge") return r===0||r===N-1||c===0||c===N-1;
        return true;
    }

    // Recompute the derived points from the free ones.  Called after every drag
    // and on any mode / grid-size change, so `grid` is always the single truth
    // that rendering, serialisation and the overlay all read.
    function reproject(){
        if (mode==="mesh") return;
        if (mode==="4pt"){
            const f=quadMap(cornerList());
            for (let r=0;r<N;r++) for (let c=0;c<N;c++){
                if (!isFree(r,c)) grid[r][c]=f(c/(N-1),r/(N-1));
            }
            return;
        }
        // "edge": Coons patch — the interior is blended from the four edge
        // curves, minus the bilinear surface of the corners.
        const TL=grid[0][0],TR=grid[0][N-1],BL=grid[N-1][0],BR=grid[N-1][N-1];
        for (let r=1;r<N-1;r++) for (let c=1;c<N-1;c++){
            const s=r/(N-1),t=c/(N-1);
            const T=grid[0][c],B=grid[N-1][c],L=grid[r][0],R=grid[r][N-1];
            grid[r][c]={
                x:(1-s)*T.x+s*B.x+(1-t)*L.x+t*R.x
                  -((1-s)*(1-t)*TL.x+(1-s)*t*TR.x+s*(1-t)*BL.x+s*t*BR.x),
                y:(1-s)*T.y+s*B.y+(1-t)*L.y+t*R.y
                  -((1-s)*(1-t)*TL.y+(1-s)*t*TR.y+s*(1-t)*BL.y+s*t*BR.y),
            };
        }
    }

    function cornerList(){
        return [{...grid[0][0]},{...grid[0][N-1]},{...grid[N-1][N-1]},{...grid[N-1][0]}];
    }

    // Bilinear sample of a control net, used to carry an existing warp across a
    // grid-size change (piecewise-linear, so the shape is preserved at the old
    // control points and interpolated between them).
    function sampleNet(g,n,u,v){
        const fx=Math.max(0,Math.min(1,u))*(n-1), fy=Math.max(0,Math.min(1,v))*(n-1);
        const c0=Math.max(0,Math.min(n-2,Math.floor(fx))), r0=Math.max(0,Math.min(n-2,Math.floor(fy)));
        const tx=fx-c0, ty=fy-r0;
        const lerp=(p,q,t)=>({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t});
        return lerp(lerp(g[r0][c0],g[r0][c0+1],tx), lerp(g[r0+1][c0],g[r0+1][c0+1],tx), ty);
    }

    function boxSize(){return{w:canvas.offsetWidth||W,h:canvas.offsetHeight||H};}

    // ── Drag handles ─────────────────────────────────────────────────────────
    // Rebuilt whenever N changes.  They live in the output window's document,
    // not the parent's, and stay hidden until editing = true.
    function buildHandles(){
        for (const {el} of handles) el.remove();
        handles = [];
        for (let r=0;r<N;r++) for (let c=0;c<N;c++) {
            const el = doc.createElement("div");
            el.style.cssText = `position:absolute;width:16px;height:16px;margin:-8px;border-radius:50%;background:${color};cursor:grab;display:none;z-index:10;touch-action:none;border:2px solid #000;`;
            doc.body.appendChild(el);
            const row=r,col=c;
            el.addEventListener("pointerdown",(e)=>{
                e.preventDefault();
                el.setPointerCapture(e.pointerId);
                el.style.cursor="grabbing";
                const move=(ev)=>{
                    const {w:bw,h:bh}=boxSize();
                    grid[row][col]={
                        x:Math.max(-2,Math.min(3,ev.clientX/bw)),
                        y:Math.max(-2,Math.min(3,ev.clientY/bh)),
                    };
                    reproject();
                    positionHandles();
                };
                const up=()=>{
                    el.style.cursor="grab";
                    el.removeEventListener("pointermove",move);
                    el.removeEventListener("pointerup",up);
                    applyCSS();
                    notify();
                };
                el.addEventListener("pointermove",move);
                el.addEventListener("pointerup",up);
            });
            handles.push({el,row,col});
        }
    }

    // Place handle divs at the current grid-point pixel positions.
    function positionHandles(){
        const {w:bw,h:bh}=boxSize();
        for (const {el,row,col} of handles){
            el.style.left=(grid[row][col].x*bw)+"px";
            el.style.top =(grid[row][col].y*bh)+"px";
        }
    }

    // All modes render in canvas space (drawMeshWarp), so the canvas element
    // itself never carries a CSS transform — it is already full-screen.
    function applyCSS(){
        canvas.style.transform="none";
        positionHandles();
    }

    function notify(){ if (onChange) onChange(); }

    function setEditing(on){
        editing=on;
        for (const {el,row,col} of handles) el.style.display=on&&isFree(row,col)?"block":"none";
        if (on) positionHandles();
    }

    function setMode(m){
        if (!WARP_MODES.includes(m)||m===mode) return;
        mode=m;
        reproject();   // dropping to a simpler mode discards the freedom it removes
        applyCSS();
        setEditing(editing);   // refresh handle visibility
        notify();
    }
    function getMode(){ return mode; }

    function getGridSize(){ return N; }

    function setGridSize(n){
        n=Math.max(2,Math.min(33,Math.round(n)));
        if (n===N) return;
        const old=grid, oldN=N;
        N=n;
        grid=makeIdentityGrid(N);
        for (let r=0;r<N;r++) for (let c=0;c<N;c++) grid[r][c]=sampleNet(old,oldN,c/(N-1),r/(N-1));
        buildHandles();
        reproject();
        applyCSS();
        setEditing(editing);
        notify();
    }

    // ── Render ────────────────────────────────────────────────────────────────
    // outputs.js calls this once per frame per surface with the source canvas.
    function drawMeshWarp(ctx, srcImg){
        if (isIdentity()){
            ctx.drawImage(srcImg,0,0,W,H);
        } else {
            // Triangle-rasterise the (N-1)×(N-1) quad grid.  drawTri clips to
            // each triangle, so no pixel escapes the warped outline.
            for (let r=0;r<N-1;r++) for (let c=0;c<N-1;c++){
                const tl=grid[r][c],tr=grid[r][c+1],bl=grid[r+1][c],br=grid[r+1][c+1];
                const u0=c/(N-1),v0=r/(N-1),u1=(c+1)/(N-1),v1=(r+1)/(N-1);
                drawTri(ctx,srcImg,W,H, tl.x*W,tl.y*H, tr.x*W,tr.y*H, br.x*W,br.y*H, u0,v0,u1,v0,u1,v1);
                drawTri(ctx,srcImg,W,H, tl.x*W,tl.y*H, br.x*W,br.y*H, bl.x*W,bl.y*H, u0,v0,u1,v1,u0,v1);
            }
        }
        if (editing) drawOverlay(ctx);
    }

    // Construction lines: the full subdivision grid, so alignment is visible
    // even where the points aren't draggable in the current mode.
    function drawOverlay(ctx){
        ctx.save();
        ctx.strokeStyle="rgba(255,255,255,0.55)";
        ctx.lineWidth=1;
        ctx.setLineDash([4,4]);
        for (let r=0;r<N;r++){
            ctx.beginPath();
            for (let c=0;c<N;c++){
                const p=grid[r][c];
                if (c===0) ctx.moveTo(p.x*W,p.y*H); else ctx.lineTo(p.x*W,p.y*H);
            }
            ctx.stroke();
        }
        for (let c=0;c<N;c++){
            ctx.beginPath();
            for (let r=0;r<N;r++){
                const p=grid[r][c];
                if (r===0) ctx.moveTo(p.x*W,p.y*H); else ctx.lineTo(p.x*W,p.y*H);
            }
            ctx.stroke();
        }
        ctx.restore();
    }

    // ── Compat: getCorners / setCorners (4 outer corners) ────────────────────
    function getCorners(){ return cornerList(); }

    // Used for saves made before the mesh existed, where the 4 corners were a
    // keystone: fill the whole grid from the projective map they imply.
    function setCorners(c){
        if (!c||c.length!==4) return;
        const f=quadMap(c);
        for (let r=0;r<N;r++) for (let cc=0;cc<N;cc++) grid[r][cc]=f(cc/(N-1),r/(N-1));
        applyCSS();
    }

    // ── getMesh / setMesh ─────────────────────────────────────────────────────
    // Serialises as a flat row-major array of N*N {x,y}; N is recovered from the
    // length on load, so old 25-point (5×5) saves still restore exactly.
    function getMesh(){
        const out=[];
        for (let r=0;r<N;r++) for (let c=0;c<N;c++) out.push({...grid[r][c]});
        return out;
    }

    function setMesh(flat){
        if (!Array.isArray(flat)) return;
        const n=Math.round(Math.sqrt(flat.length));
        if (n<2||n*n!==flat.length) return;
        if (n!==N){ N=n; buildHandles(); }
        grid=makeIdentityGrid(N);
        let i=0;
        for (let r=0;r<N;r++) for (let c=0;c<N;c++) grid[r][c]={...flat[i++]};
        applyCSS();
        setEditing(editing);
    }

    function reset(){
        grid=makeIdentityGrid(N);
        applyCSS();
        notify();
    }

    function destroy(){
        for (const {el} of handles) el.remove();
        handles=[];
    }

    // Keyboard: W toggles edit; while editing, M cycles mode, [ / ] change grid
    // size, R resets.  The listener is per-surface, so these act on every
    // surface in the window at once — which is what you want when aligning.
    win.addEventListener("keydown",(e)=>{
        const k=e.key.toLowerCase();
        if (k==="w"){ setEditing(!editing); return; }
        if (!editing) return;
        if (k==="r") reset();
        else if (k==="m") setMode(WARP_MODES[(WARP_MODES.indexOf(mode)+1)%WARP_MODES.length]);
        else if (e.key==="["||e.key==="]"){
            // Step through the preset sizes, snapping to the nearest one first.
            const dir=e.key==="]"?1:-1;
            let i=GRID_SIZES.findIndex((s)=>s>=N);
            if (i<0){                       // N is above every preset
                if (dir>0) return;
                i=GRID_SIZES.length;
            }
            if (GRID_SIZES[i]===N||dir<0) i+=dir;
            setGridSize(GRID_SIZES[Math.max(0,Math.min(GRID_SIZES.length-1,i))]);
        }
    });
    win.addEventListener("resize",applyCSS);
    doc.addEventListener("fullscreenchange",applyCSS);
    const HINT=" — W warp · M mode · [ ] grid · R reset";
    if (!doc.title.includes(HINT)) doc.title+=HINT;

    buildHandles();
    applyCSS();
    return { getCorners, setCorners, getMesh, setMesh, setEditing, reset, destroy,
             drawMeshWarp, setMode, getMode, getGridSize, setGridSize, isIdentity };
}
