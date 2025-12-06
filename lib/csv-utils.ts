
export function parseCSVLine(str: string): string[] {
    const arr = [];
    let quote = false;
    let col = "";
    for (let c = 0; c < str.length; c++) {
        const char = str[c];
        if (char === '"' && c + 1 < str.length && str[c + 1] === '"') {
            // Handle escaped double quotes "" -> "
            col += '"';
            c++;
        } else if (char === '"') {
            quote = !quote;
        } else if ((char === ',' || char === ';') && !quote) {
            arr.push(col.trim()); // Trim whitespace around delimiters? Maybe safest for this app.
            col = "";
        } else {
            col += char;
        }
    }
    arr.push(col.trim());
    return arr;
}
