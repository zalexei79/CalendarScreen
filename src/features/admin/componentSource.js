export function matchSource(candidates, paths) {
  for (const source of Array.isArray(candidates) ? candidates.slice(0,12) : []) {
    if(typeof source?.file !== 'string' || source.file.length>1000 || source.file.includes('..'))continue;
    const file=source.file.replaceAll('\\','/').toLowerCase();
    const found=paths.find(path=>file===path.toLowerCase() || file.endsWith('/'+path.toLowerCase()));
    if(found)return {path:found,line:Number.isInteger(source.line) && source.line>0 ? source.line : null};
  }
  return null;
}
