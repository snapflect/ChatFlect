const fs = require('fs');
const path = 'roadmap_reader/word/document.xml';

try {
    const xml = fs.readFileSync(path, 'utf8');
    // Simple tag stripper
    const text = xml.replace(/<[^>]+>/g, ' ');
    // Normalize spaces
    const clean = text.replace(/\s+/g, ' ');

    // Search
    const search = "Epic 80";
    const index = clean.indexOf(search);

    if (index === -1) {
        console.log("Could not find 'Epic 80'. Printing first 500 chars:");
        console.log(clean.substring(0, 500));

        // Try 'Phase 13'
        const p13 = clean.indexOf("Phase 13");
        if (p13 !== -1) {
            console.log("\nFound 'Phase 13'. Printing context:");
            console.log(clean.substring(p13, p13 + 3000));
        }
    } else {
        console.log("Found 'Epic 80'. Printing context:");
        console.log(clean.substring(index, index + 3000));
    }
} catch (e) {
    console.error(e);
}
