<?php
// cron/generate_transparency_report.php
// Epic 56: Monthly Transparency Report Generator

require_once __DIR__ . '/../includes/db_connect.php';
require_once __DIR__ . '/../includes/transparency_report_engine.php';

echo "Generating Transparency Report...\n";

// Generate for LAST MONTH
$start = date('Y-m-01', strtotime('first day of last month'));
$end = date('Y-m-t', strtotime('last month'));

echo "Period: $start to $end\n";

$engine = new TransparencyReportEngine($pdo);
$stats = $engine->generateReport($start, $end);
$id = $engine->saveReport($stats);

echo "Report Generated: ID $id\n";
