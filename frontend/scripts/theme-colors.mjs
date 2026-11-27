import fs from 'node:fs';
import postcss from 'postcss';
const rgb=hex=>{let h=hex.slice(1);if(h.length<5)h=[...h].map(c=>c+c).join('');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16));};
const luminance=hex=>rgb(hex).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
function darkColor(hex,prop){const [r,g,b]=rgb(hex);const lum=luminance(hex);if(prop==='--green')return '#c5df9c';if(prop==='--border')return '#48503f';if(prop==='--lime')return '#c5df9c';if(prop==='--muted')return '#b9c1b2';if(prop==='color'||prop==='fill'||prop==='stroke'){
 if(r>g*1.25&&r>b*1.2)return '#f0b9a4';if(r>g*1.03&&g>b*1.13)return '#f3d293';return lum<.08?'#e5e8df':'#cbd3c2';
}if(prop.includes('border')||prop==='outline'||prop==='outline-color')return '#737d68';if(prop.includes('shadow'))return '#00000050';
 const next=lum>.5?'#191919':lum>.16?'#242424':'#121412';return hex.length===9?next+hex.slice(-2):next;}
for(const name of ['styles.css','training.css']){
 const path=new URL('../src/'+name,import.meta.url);const root=postcss.parse(fs.readFileSync(path,'utf8'));
 root.walkDecls(decl=>{if(decl.value.includes('light-dark(')||!/#(?:[a-f\d]{3,8})\b/i.test(decl.value))return;
 if(!/color|background|border|outline|shadow|fill|stroke|^--/.test(decl.prop))return;
 const selector=decl.parent.selector??'';
 const lightOnDark=/hero-text|hero-footer|auth-story|auth-brand|\.pill|\.art-label|\.line-icon|\.toast|\.primary|\.set-check\.checked|\.series-check|\.series-check\.checked/.test(selector);
 decl.value=decl.value.replace(/#[a-f\d]{3,8}\b/gi,hex=>{let light=hex;if(decl.prop==='color'&&!lightOnDark&&luminance(hex)>.18){let values=rgb(hex);while(1.05/(luminance('#'+values.map(v=>v.toString(16).padStart(2,'0')).join(''))+.05)<5.2)values=values.map(v=>Math.floor(v*.96));light='#'+values.map(v=>v.toString(16).padStart(2,'0')).join('');}return `light-dark(${light}, ${darkColor(hex,decl.prop)})`;});
 });
 root.walkDecls(decl=>{if(decl.value.includes('light-dark(')||!/color|background|border|outline|shadow|fill|stroke|^--/.test(decl.prop))return;decl.value=decl.value.replace(/\b(white|black)\b/g,name=>`light-dark(${name}, ${darkColor(name==='white'?'#ffffff':'#000000',decl.prop)})`);});
 fs.writeFileSync(path,root.toString());
}
