/**
 * Debug script to check SQL parsing
 */

import fs from 'fs';
import path from 'path';

async function debugParsing() {
  const sqlFilePath = path.join(process.cwd(), 'kmlwj.sql');
  const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

  // Extract IncomeCategory and HallBooking statements
  const incomeCategoryMatch = sqlContent.match(/INSERT INTO `IncomeCategory`[^;]*;/i);
  const hallBookingMatch = sqlContent.match(/INSERT INTO `HallBooking`[^;]*;/i);

  if (incomeCategoryMatch) {
    const statement = incomeCategoryMatch[0];
    console.log('IncomeCategory INSERT Statement:');
    console.log('Length:', statement.length);
    console.log('First 500 chars:', statement.substring(0, 500));
    console.log('Last 500 chars:', statement.substring(statement.length - 500));
    
    // Count rows
    const valueMatch = statement.match(/VALUES\s+([\s\S]*?);$/);
    if (valueMatch) {
      const valueStr = valueMatch[1];
      // Count opening parentheses at depth 0
      let depth = 0;
      let rowCount = 0;
      let inQuote = false;
      let quoteChar = '';
      
      for (let i = 0; i < valueStr.length; i++) {
        const char = valueStr[i];
        const prevChar = i > 0 ? valueStr[i - 1] : '';
        
        if ((char === "'" || char === '"') && prevChar !== '\\') {
          if (!inQuote) {
            inQuote = true;
            quoteChar = char;
          } else if (char === quoteChar) {
            inQuote = false;
          }
        }
        
        if (!inQuote) {
          if (char === '(') depth++;
          if (char === ')') {
            depth--;
            if (depth === 0) rowCount++;
          }
        }
      }
      console.log('Row count:', rowCount);
    }
  }

  console.log('\n---\n');

  if (hallBookingMatch) {
    const statement = hallBookingMatch[0];
    console.log('HallBooking INSERT Statement:');
    console.log('Length:', statement.length);
    console.log('First 500 chars:', statement.substring(0, 500));
    console.log('Last 500 chars:', statement.substring(statement.length - 500));
    
    // Count rows
    const valueMatch = statement.match(/VALUES\s+([\s\S]*?);$/);
    if (valueMatch) {
      const valueStr = valueMatch[1];
      // Count opening parentheses at depth 0
      let depth = 0;
      let rowCount = 0;
      let inQuote = false;
      let quoteChar = '';
      
      for (let i = 0; i < valueStr.length; i++) {
        const char = valueStr[i];
        const prevChar = i > 0 ? valueStr[i - 1] : '';
        
        if ((char === "'" || char === '"') && prevChar !== '\\') {
          if (!inQuote) {
            inQuote = true;
            quoteChar = char;
          } else if (char === quoteChar) {
            inQuote = false;
          }
        }
        
        if (!inQuote) {
          if (char === '(') depth++;
          if (char === ')') {
            depth--;
            if (depth === 0) rowCount++;
          }
        }
      }
      console.log('Row count:', rowCount);
    }
  }
}

debugParsing().catch(console.error);
