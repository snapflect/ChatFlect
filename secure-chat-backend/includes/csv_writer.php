<?php
// includes/csv_writer.php
// Epic 53: Safe CSV Generator
// Handles escaping to prevent CSV Injection (Formula Injection)

class CsvWriter
{
    private $output;

    public function __construct($outputStream = 'php://output')
    {
        $this->output = fopen($outputStream, 'w');
        // BOM for Excel UTF-8
        fprintf($this->output, chr(0xEF) . chr(0xBB) . chr(0xBF));
    }

    public function writeHeader($headers)
    {
        fputcsv($this->output, $headers);
    }

    public function writeRow($row)
    {
        // Sanitize fields to prevent formula injection
        $safeRow = array_map([$this, 'sanitizeField'], $row);
        fputcsv($this->output, $safeRow);
    }

    private function sanitizeField($field)
    {
        if (is_string($field)) {
            // Prevent Excel from executing formulas starting with =, +, -, @
            if (preg_match('/^[=+\-@]/', $field)) {
                return "'" . $field;
            }
        }
        return $field;
    }

    public function close()
    {
        fclose($this->output);
    }
}
