'use strict';
// Read raster dimensions without image-processing dependencies.
module.exports=function dimensions(b){
 if(b.subarray(1,4).toString()==='PNG')return [b.readUInt32BE(16),b.readUInt32BE(20)];
 if(b[0]===255&&b[1]===216){let i=2;while(i<b.length){if(b[i++]!==255)continue;let m=b[i++];if(m===216||m===217)continue;let n=b.readUInt16BE(i);if([192,193,194].includes(m))return [b.readUInt16BE(i+5),b.readUInt16BE(i+3)];i+=n;}}
 if(b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP'){
 const kind=b.subarray(12,16).toString();
 if(kind==='VP8X')return [1+b.readUIntLE(24,3),1+b.readUIntLE(27,3)];
 if(kind==='VP8 ')return [b.readUInt16LE(26)&16383,b.readUInt16LE(28)&16383];
 if(kind==='VP8L'){const v=b.readUInt32LE(21);return [1+(v&16383),1+((v>>>14)&16383)];}
 }
 throw Error('Unsupported thumbnail encoding');
};
