<?php
/**
 * RE-VERSE — Shared helper functions
 */

/**
 * Truncate a title to a hard character limit, always appending "..."
 * (anchored directly to the last visible character) when cut short.
 */
function truncate_title(string $title, int $limit): string
{
    $title = trim($title);
    if (mb_strlen($title) <= $limit) {
        return $title;
    }
    return rtrim(mb_substr($title, 0, $limit)) . '...';
}

/**
 * Truncate a description. $min is the point after which we're allowed to
 * cut — anything under $min characters is shown in full, untouched.
 */
function truncate_description(string $desc, int $min): string
{
    $desc = trim($desc);
    if (mb_strlen($desc) <= $min) {
        return $desc;
    }
    return rtrim(mb_substr($desc, 0, $min)) . '...';
}

/** Popular section: 30-char title limit. */
function popular_title(string $title): string
{
    return truncate_title($title, 30);
}

/** Latest release section: 80-char title limit. */
function latest_release_title(string $title): string
{
    return truncate_title($title, 80);
}

/** Latest release section: description shown in full up to 200 chars, then "...". */
function latest_release_description(string $desc): string
{
    return truncate_description($desc, 200);
}

/** Novel detail page: 300-char title limit. */
function novel_page_title(string $title): string
{
    return truncate_title($title, 300);
}

/** Novel detail page: description shown in full up to 2000 chars, then "...". */
function novel_page_description(string $desc): string
{
    return truncate_description($desc, 2000);
}

/** MM/DD/YY date format used across the wireframe, e.g. 12/21/26 */
function format_updated_date(string $mysqlDatetime): string
{
    $ts = strtotime($mysqlDatetime);
    return date('m/d/y', $ts);
}

/** Builds the "100 CHAPTERS, 10 COLLECTIONS  ONGOING  12/21/26  Japanese" meta line. */
function series_meta_line(array $series): string
{
    $chapters    = (int)($series['chapter_count'] ?? 0);
    $collections = (int)($series['collection_count'] ?? 0);
    $status      = strtoupper($series['status'] ?? '');
    $updated     = format_updated_date($series['updated_at']);
    $identity    = $series['identity'] ? ucfirst($series['identity']) : '';

    $parts = [
        $chapters . ' CHAPTERS, ' . $collections . ' COLLECTIONS',
        $status,
        $updated,
        $identity,
    ];

    return implode('  ', array_filter($parts));
}

function h(?string $value): string
{
    return htmlspecialchars($value ?? '', ENT_QUOTES, 'UTF-8');
}

function redirect(string $path): never
{
    header('Location: ' . $path);
    exit;
}
