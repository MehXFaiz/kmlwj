/**
 * Debug HallBooking parsing
 */

import fs from 'fs';
import path from 'path';

function parseValue(val: string): any {
  if (!val || val === 'NULL') return null;
  if (val === 'true') return true;
  if (val === 'false') return false;

  // Remove quotes if present
  if (
    (val.startsWith("'") && val.endsWith("'")) ||
    (val.startsWith('"') && val.endsWith('"'))
  ) {
    val = val.slice(1, -1);
    // Handle escaped quotes
    val = val.replace(/\\'/g, "'").replace(/\\"/g, '"');
  }

  // Try to parse as number
  if (/^-?\d+$/.test(val)) {
    return parseInt(val, 10);
  }
  if (/^-?\d+\.\d+$/.test(val)) {
    return parseFloat(val);
  }

  return val;
}

function parseRow(rowStr: string, columns: string[]): Record<string, any> {
  const row: Record<string, any> = {};
  const values: any[] = [];

  // Remove parentheses
  rowStr = rowStr.replace(/^\(/, '').replace(/\)$/, '');

  // Parse values - handle quoted strings with commas
  let currentValue = '';
  let inQuote = false;
  let quoteChar = '';
  let i = 0;

  while (i < rowStr.length) {
    const char = rowStr[i];
    const prevChar = i > 0 ? rowStr[i - 1] : '';

    if (prevChar !== '\\' && (char === "'" || char === '"')) {
      if (!inQuote) {
        inQuote = true;
        quoteChar = char;
        currentValue += char;
      } else if (char === quoteChar) {
        inQuote = false;
        currentValue += char;
      } else {
        currentValue += char;
      }
    } else if (char === ',' && !inQuote) {
      values.push(parseValue(currentValue.trim()));
      currentValue = '';
    } else {
      currentValue += char;
    }

    i++;
  }

  // Last value
  if (currentValue.trim()) {
    values.push(parseValue(currentValue.trim()));
  }

  // Map to columns
  for (let i = 0; i < columns.length; i++) {
    row[columns[i]] = values[i] ?? null;
  }

  return row;
}

function parseInsertStatement(table: string, statement: string): any[] {
  try {
    // Extract column names
    const colMatch = statement.match(/\((.*?)\)\s*VALUES/);
    if (!colMatch) return [];

    const columns = colMatch[1]
      .split(',')
      .map((c) => c.trim().replace(/`/g, ''));

    // Extract VALUES clause
    const valueMatch = statement.match(/VALUES\s+([\s\S]*?);$/);
    if (!valueMatch) return [];

    const valueStr = valueMatch[1].trim();
    const records: any[] = [];

    // Split rows carefully, handling escaped quotes
    let currentRow = '';
    let depth = 0;
    let inQuote = false;
    let quoteChar = '';
    let i = 0;
    let rowIndex = 0;

    while (i < valueStr.length) {
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

          // Found end of row (depth back to 0)
          if (depth === 0) {
            currentRow += char;
            
            // Look ahead for comma (might have whitespace)
            let j = i + 1;
            while (j < valueStr.length && /\s/.test(valueStr[j])) {
              j++;
            }
            
            // If next non-whitespace is comma or end of statement, we're done with this row
            if (j >= valueStr.length || valueStr[j] === ',') {
              try {
                const row = parseRow(currentRow, columns);
                records.push(row);
                console.log(`Row ${rowIndex}: ✓ (ID: ${row.id})`);
              } catch (error) {
                console.log(`Row ${rowIndex}: ✗ ERROR - ${error}`);
              }
              rowIndex++;
              currentRow = '';
              i = j; // Skip to after comma
              if (valueStr[i] === ',') i++;
              continue;
            }
          }
        }
      }

      currentRow += char;
      i++;
    }

    // Handle last row
    if (currentRow.trim()) {
      try {
        const row = parseRow(currentRow.trim(), columns);
        records.push(row);
        console.log(`Row ${rowIndex}: ✓ (ID: ${row.id})`);
      } catch (error) {
        console.log(`Row ${rowIndex}: ✗ ERROR - ${error}`);
      }
    }

    return records;
  } catch (error) {
    console.error(`Error parsing ${table}:`, error);
    return [];
  }
}

async function debugHallBooking() {
  const sqlFilePath = path.join(process.cwd(), 'kmlwj.sql');
  const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

  const hallBookingMatch = sqlContent.match(/INSERT INTO `HallBooking`[^;]*;/i);

  if (hallBookingMatch) {
    const statement = hallBookingMatch[0];
    console.log('Parsing HallBooking...\n');
    const records = parseInsertStatement('HallBooking', statement);
    console.log(`\nTotal records parsed: ${records.length}`);
  }
}

debugHallBooking().catch(console.error);
