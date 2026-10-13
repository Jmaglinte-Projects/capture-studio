// Geometry is shared by drawing and picking so annotations move where they appear.
export function arrowPolygon(mark){
 const length=Math.hypot(mark.w,mark.h);if(length<.01)return [];
 const ux=mark.w/length,uy=mark.h/length,nx=-uy,ny=ux;
 const head=Math.min(length*.45,Math.max(16,mark.width*6));
 const neck={x:mark.x+ux*(length-head),y:mark.y+uy*(length-head)};
 const shaft=Math.min(head*.3,Math.max(1.5,mark.width*1.1)),wing=Math.min(head*.65,Math.max(6,mark.width*3.2));
 return [{x:mark.x,y:mark.y},{x:neck.x+nx*shaft,y:neck.y+ny*shaft},{x:neck.x+nx*wing,y:neck.y+ny*wing},{x:mark.x+mark.w,y:mark.y+mark.h},{x:neck.x-nx*wing,y:neck.y-ny*wing},{x:neck.x-nx*shaft,y:neck.y-ny*shaft}];
}
export function segmentDistance(p,a,b){
 const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
 const t=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length)):0;
 return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
}
export function polygonHit(point,points,pad=0){
 let inside=false;
 for(let i=0,j=points.length-1;i<points.length;j=i++){
  const a=points[i],b=points[j];if(segmentDistance(point,a,b)<=pad)return true;
  if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
 }
 return inside;
}
