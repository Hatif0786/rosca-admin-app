const fs = require('fs');
const code = fs.readFileSync('src/screens/CommitteeDetailScreen.js', 'utf8');

const stack = [];
const lines = code.split('\n');

for (let l = 0; l < lines.length; l++) {
  const line = lines[l];
  for (let c = 0; c < line.length; c++) {
    const char = line[c];
    if (char === '{' || char === '(' || char === '[') {
      stack.push({ char, line: l + 1, col: c + 1 });
    } else if (char === '}' || char === ')' || char === ']') {
      if (stack.length === 0) {
        console.log(`Extra closing bracket "${char}" at line ${l + 1}, column ${c + 1}`);
      } else {
        const top = stack.pop();
        const expected = top.char === '{' ? '}' : top.char === '(' ? ')' : ']';
        if (char !== expected) {
          console.log(`Mismatch: Expected "${expected}" to close "${top.char}" opened at line ${top.line}, col ${top.col}, but got "${char}" at line ${l + 1}, col ${c + 1}`);
        }
      }
    }
  }
}

if (stack.length > 0) {
  console.log(`Unbalanced brackets left: ${stack.length} unclosed.`);
  stack.forEach(item => {
    console.log(`  "${item.char}" opened at line ${item.line}, column ${item.col}`);
  });
} else {
  console.log("SUCCESS: All brackets and braces are 100% balanced!");
}
