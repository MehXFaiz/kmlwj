const fs = require('fs');
const path = require('path');

const dirs = ['./src/views', './src/components/common', './src/components/theme', './src/layouts'];
let changedFiles = 0;

for (const dir of dirs) {
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx') || f.endsWith('.tsx'));
  
  for (const file of files) {
    const p = path.join(dir, file);
    let content = fs.readFileSync(p, 'utf8');
    const original = content;
    
    // Replace specific patterns known to cause issues
    content = content.replace(/bg-white\s+dark:bg-/g, 'bg-');
    content = content.replace(/bg-white\s+dark:/g, '');
    
    // Replace `border-[color]-[num] dark:border-[color]-[num]` with just the dark version
    content = content.replace(/border-[a-z]+-\d{2,3}(?:\/\d+)?\s+dark:(border-[a-z]+-\d{2,3}(?:\/\d+)?)/g, '$1');
    content = content.replace(/bg-[a-z]+-\d{2,3}(?:\/\d+)?\s+dark:(bg-[a-z]+-\d{2,3}(?:\/\d+)?)/g, '$1');
    content = content.replace(/text-[a-z]+-\d{2,3}(?:\/\d+)?\s+dark:(text-[a-z]+-\d{2,3}(?:\/\d+)?)/g, '$1');
    content = content.replace(/shadow-[a-z]+(?:\/\d+)?\s+dark:(shadow-[a-z]+(?:\/\d+)?)/g, '$1');
    content = content.replace(/shadow-sm\s+dark:shadow-none/g, 'shadow-none');

    // Remove standalone dark: from any remaining variants
    content = content.replace(/dark:/g, '');

    if (content !== original) {
      fs.writeFileSync(p, content);
      changedFiles++;
      console.log('Updated ' + p);
    }
  }
}

console.log('Total files changed: ' + changedFiles);
