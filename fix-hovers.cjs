const fs = require('fs');
const path = require('path');

const dirs = ['./src/views', './src/components/common', './src/components/theme', './src/layouts'];

for (const dir of dirs) {
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx') || f.endsWith('.tsx'));
  
  for (const file of files) {
    const p = path.join(dir, file);
    let content = fs.readFileSync(p, 'utf8');
    const original = content;
    
    // Clean up duplicated hover/focus classes that resulted from stripping dark:
    // e.g. hover:border-slate-300 hover:border-slate-700/80 -> hover:border-slate-700/80
    content = content.replace(/hover:border-[a-z]+-\d{2,3}(?:\/\d+)?\s+hover:(border-[a-z]+-\d{2,3}(?:\/\d+)?)/g, 'hover:$1');
    content = content.replace(/hover:bg-[a-z]+-\d{2,3}(?:\/\d+)?\s+hover:(bg-[a-z]+-\d{2,3}(?:\/\d+)?)/g, 'hover:$1');
    content = content.replace(/hover:text-[a-z]+-\d{2,3}(?:\/\d+)?\s+hover:(text-[a-z]+-\d{2,3}(?:\/\d+)?)/g, 'hover:$1');
    content = content.replace(/hover:shadow-[a-z]+(?:\/\d+)?\s+hover:(shadow-[a-z]+(?:\/\d+)?)/g, 'hover:$1');
    
    content = content.replace(/focus:border-[a-z]+-\d{2,3}(?:\/\d+)?\s+focus:(border-[a-z]+-\d{2,3}(?:\/\d+)?)/g, 'focus:$1');
    content = content.replace(/focus:ring-[a-z]+-\d{2,3}(?:\/\d+)?\s+focus:(ring-[a-z]+-\d{2,3}(?:\/\d+)?)/g, 'focus:$1');

    if (content !== original) {
      fs.writeFileSync(p, content);
      console.log('Cleaned up hovers in ' + p);
    }
  }
}
