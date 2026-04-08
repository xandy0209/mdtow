const fs = require('fs');
const path = require('path');

const docxDir = path.join(__dirname, 'node_modules', 'docx', 'dist');

if (!fs.existsSync(docxDir)) {
  console.log('docx dist directory not found. Skipping patch.');
  process.exit(0);
}

const filesToPatch = [
  'index.cjs',
  'index.mjs',
  'index.umd.cjs',
  'index.iife.js'
];

filesToPatch.forEach(file => {
  const filePath = path.join(docxDir, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Patch createIndent
    if (content.includes('const createIndent = ({ start, end, left, right, hanging, firstLine })')) {
      content = content.replace(
        'const createIndent = ({ start, end, left, right, hanging, firstLine }) => new BuilderElement({',
        'const createIndent = ({ start, end, left, right, hanging, firstLine, firstLineChars }) => new BuilderElement({'
      );
      content = content.replace(
        'firstLine: { key: "w:firstLine", value: firstLine === void 0 ? void 0 : twipsMeasureValue(firstLine) }',
        'firstLine: { key: "w:firstLine", value: firstLine === void 0 ? void 0 : twipsMeasureValue(firstLine) },\n    firstLineChars: { key: "w:firstLineChars", value: firstLineChars }'
      );
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Patched ${file}`);
    }
  }
});

const dtsPath = path.join(docxDir, 'index.d.ts');
if (fs.existsSync(dtsPath)) {
  let content = fs.readFileSync(dtsPath, 'utf8');
  if (content.includes('readonly firstLine?: number | PositiveUniversalMeasure;')) {
    content = content.replace(
      'readonly firstLine?: number | PositiveUniversalMeasure;',
      'readonly firstLine?: number | PositiveUniversalMeasure;\n    readonly firstLineChars?: number;'
    );
    fs.writeFileSync(dtsPath, content, 'utf8');
    console.log('Patched index.d.ts');
  }
}
