<?php
/**
 * WebCraft Pro search.
 *
 * Mirrors the Node backend: the page is split into top-level sections, cached
 * in data/search-index.json, and searched with AND semantics and title-weighted
 * scoring. No database and no extensions required.
 */

define('WEBCRAFT_SEARCH_MARKER', '<!--webcraft:search-results-->');

function wb_strip_tags($html) {
    $text = preg_replace('#<(script|style)[^>]*>.*?</\1>#is', ' ', (string) $html);
    $text = preg_replace('/<[^>]+>/', ' ', $text);
    $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    return trim(preg_replace('/\s+/u', ' ', $text));
}

function wb_search_tokens($value) {
    $stop = array('a','an','and','are','as','at','be','but','by','for','from','has','have','he','her','his','i','in','is','it','its','of','on','or','our','she','that','the','their','they','this','to','was','we','were','will','with','you','your');
    $parts = preg_split('/[^a-z0-9]+/u', strtolower((string) $value), -1, PREG_SPLIT_NO_EMPTY);
    return array_values(array_filter($parts, function ($term) use ($stop) {
        return strlen($term) > 1 && !in_array($term, $stop, true);
    }));
}

function wb_occurrences($haystack, $needle) {
    if ($needle === '') {
        return 0;
    }
    return substr_count(strtolower($haystack), strtolower($needle));
}

/** Is this opening tag the start of a searchable block? */
/** Is this opening tag a section? Sections are the unit a visitor thinks in. */
function wb_search_is_section($tag) {
    return $tag === 'section' || $tag === 'article';
}

/** Is this opening tag a WebCraft element (the builder's own markup)? */
function wb_search_is_webcraft($attrs) {
    return preg_match('/\bwb-element\b|\bwb-widget\b|\bwb-container\b/', $attrs) === 1;
}

/**
 * Split the rendered page into its searchable blocks: a <section> always wins
 * over the block it sits in, any other WebCraft element starts a block only
 * when none is open, and everything else falls through to the page document.
 */
function wb_search_blocks($html) {
    $source = (string) $html;
    $blocks = array();
    $stack = array();
    $captureStart = -1;
    $captureId = '';
    $captureDepth = 0;
    $skip = null;
    $skipDepth = 0;

    preg_match_all('~<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|\x27[^\x27]*\x27|[^>"\x27])*)>~', $source, $matches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE);

    foreach ($matches as $match) {
        $closing = $match[1][0] === '/';
        $tag = strtolower($match[2][0]);
        $attrs = $match[3][0];
        $start = $match[0][1];
        $end = $start + strlen($match[0][0]);

        $void = in_array($tag, array('area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'), true);
        $open = !$closing && !$void && substr(rtrim($attrs), -2) !== '/>';

        if ($skip !== null) {
            if ($open && $tag === $skip) {
                $skipDepth++;
            } elseif ($closing && $tag === $skip) {
                $skipDepth--;
                if ($skipDepth === 0) {
                    $skip = null;
                }
            }
            continue;
        }

        if ($open && in_array($tag, array('head','script','style','noscript','svg','title'), true)) {
            $skip = $tag;
            $skipDepth = 1;
            continue;
        }

        if ($closing) {
            array_pop($stack);
            if ($captureStart !== -1 && count($stack) <= $captureDepth) {
                $blocks[] = array(
                    'id'    => $captureId,
                    'start' => $captureStart,
                    'html'  => substr($source, $captureStart, $end - $captureStart),
                );
                $captureStart = -1;
                $captureId = '';
            }
            continue;
        }

        if ($open) {
            if (wb_search_is_section($tag) || ($captureStart === -1 && wb_search_is_webcraft($attrs))) {
                $captureStart = $start;
                $captureId = preg_match('/\sid="([^"]+)"/', $attrs, $m) ? $m[1] : '';
                $captureDepth = count($stack);
            }
            $stack[] = $tag;
        }
    }

    return $blocks;
}

function wb_search_extract($html, $baseUrl = '') {
    $source = (string) $html;
    $title = '';
    if (preg_match('/<title[^>]*>(.*?)<\/title>/is', $source, $m)) {
        $title = wb_strip_tags($m[1]);
    }

    $blocks = wb_search_blocks($source);
    $documents = array();
    $position = 0;
    foreach ($blocks as $block) {
        $text = wb_strip_tags($block['html']);
        $heading = preg_match('/<h[1-6][^>]*>(.*?)<\/h[1-6]>/is', $block['html'], $m) ? wb_strip_tags($m[1]) : '';
        $documents[] = array(
            'id'    => $block['id'] !== '' ? $block['id'] : 'section-' . ($position + 1),
            'url'   => $baseUrl . ($block['id'] !== '' ? '#' . $block['id'] : ''),
            'title' => substr($heading !== '' ? $heading : ($text !== '' ? $text : 'Section ' . ($position + 1)), 0, 120),
            'text'  => substr($text, 0, 20000),
            'tags'  => $title !== '' ? $title : '',
            'order' => $position,
        );
        $position++;
    }

    // Everything that is NOT inside a block. Without this the page document
    // would duplicate every section and match any word on the page.
    $remainder = '';
    $cursor = 0;
    foreach ($blocks as $block) {
        $remainder .= substr($source, $cursor, $block['start'] - $cursor);
        $cursor = $block['start'] + strlen($block['html']);
    }
    $remainder .= substr($source, $cursor);

    array_unshift($documents, array(
        'id'    => 'page',
        'url'   => $baseUrl,
        'title' => $title !== '' ? $title : 'This page',
        'text'  => substr(wb_strip_tags($remainder), 0, 20000),
        'tags'  => '',
        'order' => -1,
    ));

    return $documents;
}

function wb_search_index($html, $baseUrl = '') {
    $file = WB_DATA_DIR . '/search-index.json';
    $hash = hash('sha1', (string) $html);

    if (is_file($file)) {
        $stored = json_decode((string) @file_get_contents($file), true);
        if (is_array($stored) && isset($stored['hash']) && $stored['hash'] === $hash && isset($stored['documents'])) {
            return $stored['documents'];
        }
    }

    $documents = wb_search_extract($html, $baseUrl);
    @file_put_contents($file, json_encode(array(
        'hash'      => $hash,
        'builtAt'   => date('c'),
        'documents' => $documents,
    )));
    return $documents;
}

function wb_search_query($documents, $query, $limit = 25) {
    $terms = wb_search_tokens($query);
    if (!$terms) {
        return array();
    }
    $phrase = strtolower(trim((string) $query));
    $hits = array();

    foreach ($documents as $doc) {
        $title = strtolower($doc['title']);
        $text = strtolower($doc['text']);
        $score = 0;
        $matched = true;

        foreach ($terms as $term) {
            $inTitle = wb_occurrences($title, $term);
            $inText = wb_occurrences($text, $term);
            if ($inTitle === 0 && $inText === 0) {
                $matched = false;
                break;
            }
            $score += $inTitle * 8 + $inText;
            if (strpos($title, $term) === 0) {
                $score += 12;
            } elseif (strpos($title, $term) !== false) {
                $score += 4;
            }
        }
        if (!$matched) {
            continue;
        }
        if (count($terms) > 1 && strpos($title . ' ' . $text, $phrase) !== false) {
            $score += 10;
        }

        $hits[] = array('score' => $score, 'doc' => $doc);
    }

    usort($hits, function ($a, $b) {
        return $b['score'] === $a['score'] ? strcmp($a['doc']['title'], $b['doc']['title']) : $b['score'] - $a['score'];
    });

    return array_slice($hits, 0, $limit);
}

function wb_search_snippet($doc, $terms) {
    $text = $doc['text'];
    $lower = strtolower($text);
    $at = false;
    foreach ($terms as $term) {
        $found = strpos($lower, $term);
        if ($found !== false && ($at === false || $found < $at)) {
            $at = $found;
        }
    }
    $start = $at === false ? 0 : max(0, $at - 70);
    $slice = ($start > 0 ? "\u{2026}" : '') . trim(substr($text, $start, 190)) . ($start + 190 < strlen($text) ? "\u{2026}" : '');

    $html = htmlspecialchars($slice, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    foreach ($terms as $term) {
        $html = preg_replace_callback('/(' . preg_quote($term, '/') . ')/iu', function ($m) {
            return '<mark>' . $m[1] . '</mark>';
        }, $html);
    }
    return $html;
}

function wb_render_search_results($documents, $query, $limit = 25) {
    $q = trim((string) $query);
    if ($q === '') {
        return '';
    }
    $hits = wb_search_query($documents, $q, $limit);
    $total = count($hits);
    $summary = '<p class="wb-search__summary">' . ($total === 1 ? '1 result' : $total . ' results')
        . ' for \u{201C}' . htmlspecialchars($q, ENT_QUOTES, 'UTF-8') . '\u{201D}</p>';

    if (!$total) {
        return $summary . '<p class="wb-search__empty">Nothing matched. Try a shorter or different word.</p>';
    }

    $items = '';
    foreach ($hits as $hit) {
        $doc = $hit['doc'];
        $items .= '<li class="wb-search__result">'
            . '<a class="wb-search__result-title" href="' . htmlspecialchars($doc['url'], ENT_QUOTES, 'UTF-8') . '">'
            . htmlspecialchars($doc['title'], ENT_QUOTES, 'UTF-8') . '</a>'
            . ($doc['tags'] !== '' ? '<span class="wb-search__result-tags">' . htmlspecialchars($doc['tags'], ENT_QUOTES, 'UTF-8') . '</span>' : '')
            . '<p class="wb-search__snippet">' . wb_search_snippet($doc, wb_search_tokens($q)) . '</p>'
            . '</li>';
    }

    return $summary . "<ol class=\"wb-search__results\">\n" . $items . "\n</ol>";
}

/**
 * Replace the marker with real results for ?s=...
 *
 * $html is the page to render into; $indexSource is what to index (pass the raw
 * markup so the session panel is not searchable). With no query the marker is
 * still cleared, so the internal comment never reaches the visitor.
 */
/** Put the query back into the search box, so results survive without JS. */
function wb_prefill_search($html, $query)
{
    return preg_replace_callback('/<input\b[^>]*>/i', function ($tag) {
        if (strpos($tag[0], 'wb-search__input') === false) {
            return $tag[0];
        }
        $safe = htmlspecialchars($query, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        if (preg_match('/\svalue="[^"]*"/i', $tag[0])) {
            return preg_replace('/\svalue="[^"]*"/i', ' value="' . $safe . '"', $tag[0]);
        }
        return preg_replace('/\s*\/?>$/', ' value="' . $safe . '"$0', $tag[0]);
    }, $html);
}

function wb_render_search($html, $baseUrl = '', $indexSource = null) {
    $html = (string) $html;
    if (strpos($html, WEBCRAFT_SEARCH_MARKER) === false) {
        return $html;
    }
    $query = isset($_GET['s']) ? (string) $_GET['s'] : (isset($_GET['q']) ? (string) $_GET['q'] : '');
    $query = substr(trim($query), 0, 120);
    $documents = wb_search_index($indexSource === null ? $html : $indexSource, $baseUrl);
    $html = str_replace(
        WEBCRAFT_SEARCH_MARKER,
        $query === '' ? '' : wb_render_search_results($documents, $query),
        $html
    );
    return $query === '' ? $html : wb_prefill_search($html, $query);
}
