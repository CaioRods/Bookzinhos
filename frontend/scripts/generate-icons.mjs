/** Installation artwork master: public/icon-1024.png, supplied by the app owner.
 * Keep logo.svg as the separate interface wordmark. Run npm run icons to resize
 * the master and synchronize PWA, Apple and Expo assets without redrawing it.
 */
import sharp from 'sharp';
import {copyFileSync,mkdirSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const publicDir=join(root,'public'),source=join(publicDir,'icon-1024.png');
const nativeDir=join(root,'..','assets');
mkdirSync(nativeDir,{recursive:true});
for(const [name,size] of [['icon-192',192],['icon-512',512],['icon-install-1024',1024],['apple-touch-icon',180],['favicon-64',64]]){
 const file=join(publicDir,`${name}-v6.png`);
 // Safari adds an inset system tile for transparent images. The installation
 // artwork must be opaque and full-bleed, with no additional canvas padding.
 // https://webkit.org/blog/14787/webkit-features-in-safari-17-2/
 await sharp(source).flatten({background:'#bfa995'}).resize(size,size).png().toFile(file);
 if(name!=='icon-install-1024')copyFileSync(file,join(publicDir,`${name}.png`));
 console.log(`✓ ${name}-v6.png (${size}×${size})`);
}
// Android may crop to a circle. Keep the book inside the maskable safe area.
const foreground=await sharp(source).resize(716,716).png().toBuffer();
await sharp({create:{width:1024,height:1024,channels:4,background:'#00000000'}}).composite([{input:foreground,left:154,top:154}]).png().toFile(join(nativeDir,'adaptive-icon.png'));
for(const [from,to] of [['icon-1024.png','icon.png'],['icon-512-v6.png','splash.png'],['favicon-64-v6.png','favicon.png']])copyFileSync(join(publicDir,from),join(nativeDir,to));

for(const name of ['manifest-v4.json','manifest-v5.json','manifest-v6.json'])copyFileSync(join(publicDir,'manifest.json'),join(publicDir,name));
