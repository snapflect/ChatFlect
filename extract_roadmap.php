<?php
$xml = file_get_contents('roadmap_reader/word/document.xml');
$clean = strip_tags($xml); // Remove XML tags to search purely in text

// Find Start of Epic 80
$pos = strpos($clean, 'Epic 80');
if ($pos === false) {
    // Try separate if tags split it
    // But strip_tags should join them if they are adjacent text nodes.
    // Let's search for "Phase 13" and print everything after.
    $pos = strpos($clean, 'Phase 13');
}

if ($pos === false) {
    echo "Could not find Epic 80 or Phase 13.\n";
    // Echo first 500 chars to see what's up
    echo substr($clean, 0, 500);
} else {
    // Print 2000 chars from that point
    echo substr($clean, $pos, 4000);
}
?>