/**
 * Real search for the generated sites.
 *
 * Same "one implementation, two runtimes" rule as `authRuntime.ts`: the Node
 * export, the local "Test Live Website" server and the PHP export all run this
 * code, so what you test locally is what you deploy.
 *
 * How it works
 *  - The rendered page is split into *top-level sections* (the elements the
 *    builder put on the page). Each section becomes one searchable document
 *    with a title (its first heading) and an anchor (`#wb-el-...`), so a result
 *    can jump straight to the matching block instead of dumping the whole page.
 *  - The document list is cached in `data/search-index.json`, keyed by a hash of
 *    the source HTML — editing the page rebuilds it, serving the site does not.
 *  - Queries are AND-ed (every term must appear), scored by where the term
 *    shows up (title beats body) and rendered with highlighted snippets.
 *
 * No dependencies: `node:fs`, `node:path`, `node:crypto` only.
 */

export const SEARCH_BACKEND = `
'use strict';
var fs = require('node:fs');
var path = require('node:path');
var crypto = require('node:crypto');

var MARKER = '<!--webcraft:search-results-->';
var VOID_TAGS = { area:1, base:1, br:1, col:1, embed:1, hr:1, img:1, input:1, link:1, meta:1, param:1, source:1, track:1, wbr:1 };
var SKIP_TAGS = { head:1, script:1, style:1, noscript:1, svg:1, title:1 };
var TAG_RE = /<(\\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
var STOP_WORDS = ('a an and are as at be but by for from has have he her his i in is it its of on or our '
  + 'she that the their they this to was we were will with you your').split(' ');

/* ------------------------------------------------------------------ text */

function escapeSearchHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}

/** Markup -> readable text. */
function stripTags(html) {
  return decodeEntities(
    String(html || '')
      .replace(/<script[\\s\\S]*?<\\/script>/gi, ' ')
      .replace(/<style[\\s\\S]*?<\\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/\\s+/g, ' ').trim();
}

function tokenize(value) {
  return String(value || '')
    .toLowerCase()
    .split(/[^a-z0-9_\\u00c0-\\uffff]+/)
    .filter(function (term) { return term.length > 1 && STOP_WORDS.indexOf(term) === -1; });
}

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  var count = 0;
  var index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

/* ------------------------------------------------------------- extraction */

/** Is this opening tag a section? Sections are the unit a visitor thinks in. */
function isSectionTag(tag) {
  return tag === 'section' || tag === 'article';
}

/** Is this opening tag a WebCraft element (the builder's own markup)? */
function isWebCraftTag(attrs) {
  var classMatch = attrs.match(/\\sclass="([^"]*)"/);
  return /\\bwb-element\\b|\\bwb-widget\\b|\\bwb-container\\b/.test(classMatch ? classMatch[1] : '');
}

function idOf(attrs) {
  var match = attrs.match(/\\sid="([^"]+)"/);
  return match ? match[1] : '';
}

/**
 * Split a rendered page into its searchable blocks.
 *
 * Rules, in the order they matter to a visitor:
 *  - a <section> is always a block, and it WINS over the block it sits in, so
 *    the page's outer wrapper section does not become one giant result;
 *  - any other WebCraft element starts a block only when no block is open,
 *    so a container that holds a section is the section, not a duplicate;
 *  - everything not inside an emitted block falls back to the page document.
 *
 * A tag walker rather than a regex split, because markup nests.
 */
function splitTopLevel(html) {
  var source = String(html || '');
  var blocks = [];
  var stack = [];
  var captureStart = -1;
  var captureId = '';
  var captureDepth = 0;
  var skipUntil = null;
  var skipDepth = 0;
  var match;

  TAG_RE.lastIndex = 0;
  while ((match = TAG_RE.exec(source))) {
    var closing = match[1] === '/';
    var tag = match[2].toLowerCase();
    var attrs = match[3] || '';
    var isVoid = !!VOID_TAGS[tag];
    var isOpen = !closing && !isVoid && !/\\/>$/.test(attrs);

    if (skipUntil) {
      if (isOpen && tag === skipUntil) skipDepth += 1;
      else if (closing && tag === skipUntil) {
        skipDepth -= 1;
        if (skipDepth === 0) skipUntil = null;
      }
      continue;
    }
    if (isOpen && SKIP_TAGS[tag]) { skipUntil = tag; skipDepth = 1; continue; }

    if (closing) {
      stack.pop();
      if (captureStart !== -1 && stack.length <= captureDepth) {
        blocks.push({
          id: captureId,
          start: captureStart,
          end: TAG_RE.lastIndex,
          html: source.slice(captureStart, TAG_RE.lastIndex),
        });
        captureStart = -1;
        captureId = '';
      }
      continue;
    }

    if (isOpen) {
      if (isSectionTag(tag) || (captureStart === -1 && isWebCraftTag(attrs))) {
        // A section always takes over: the wrapper it replaces keeps no block
        // of its own, its text simply falls through to the page document.
        captureStart = match.index;
        captureId = idOf(attrs);
        captureDepth = stack.length;
      }
      stack.push(tag);
    }
  }

  return blocks;
}

function firstHeading(html) {
  var match = String(html || '').match(/<h[1-6][^>]*>([\\s\\S]*?)<\\/h[1-6]>/i);
  return match ? stripTags(match[1]) : '';
}

/**
 * Turn a rendered page into the list of documents the index searches.
 * The "url" option prefixes every result link so a multi-page site works too.
 */
function extractDocuments(html, options) {
  var opts = options || {};
  var source = String(html || '');
  var baseUrl = String(opts.url || '');
  var pageTitle = stripTags((source.match(/<title[^>]*>([\\s\\S]*?)<\\/title>/i) || [])[1] || '');
  var blocks = splitTopLevel(source);

  var documents = blocks.map(function (block, position) {
    var text = stripTags(block.html);
    var title = firstHeading(block.html) || text.slice(0, 70) || 'Section ' + (position + 1);
    var anchor = block.id ? baseUrl + '#' + block.id : baseUrl;
    return {
      id: block.id || 'section-' + (position + 1),
      url: anchor,
      title: title.slice(0, 120),
      text: text.slice(0, 20000),
      tags: [pageTitle].filter(Boolean).join(' \\u00b7 '),
      order: position,
    };
  });

  // One more document for everything that is NOT inside a block (custom HTML,
  // stray links, the search box itself). Without this the page would duplicate
  // every section and pollute the results with a hit for any word on the page.
  var remainder = '';
  var cursor = 0;
  blocks.forEach(function (block) {
    remainder += source.slice(cursor, block.start);
    cursor = block.start + block.html.length;
  });
  remainder += source.slice(cursor);

  documents.unshift({
    id: 'page',
    url: baseUrl,
    title: pageTitle || 'This page',
    text: stripTags(remainder).slice(0, 20000),
    tags: '',
    order: -1,
  });

  return documents;
}

/* ----------------------------------------------------------------- search */

/**
 * Score one document against the query terms.
 * Returns null when a term is missing (AND semantics).
 */
function scoreDocument(doc, terms, phrase) {
  var title = String(doc.title || '').toLowerCase();
  var text = String(doc.text || '').toLowerCase();
  var haystack = title + ' \\n ' + text;
  var total = 0;

  for (var i = 0; i < terms.length; i += 1) {
    var term = terms[i];
    var inTitle = countOccurrences(title, term);
    var inText = countOccurrences(text, term);
    if (!inTitle && !inText) return null;
    total += inTitle * 8 + inText;
    if (title.indexOf(term) === 0) total += 12;
    else if (title.indexOf(term) !== -1) total += 4;
    if (text.indexOf(' ' + term) === 0 || text.indexOf('\\n' + term) !== -1) total += 1;
  }

  if (phrase.length > 1 && haystack.indexOf(phrase) !== -1) total += 10;
  return total;
}

/** A readable window of text around the first match, with <mark> highlights. */
function snippetFor(doc, terms) {
  var text = String(doc.text || '');
  var lower = text.toLowerCase();
  var at = -1;
  for (var i = 0; i < terms.length && at === -1; i += 1) at = lower.indexOf(terms[i]);

  var start = at === -1 ? 0 : Math.max(0, at - 70);
  var end = Math.min(text.length, start + 190);
  var slice = (start > 0 ? '\\u2026' : '') + text.slice(start, end).trim() + (end < text.length ? '\\u2026' : '');

  var html = escapeSearchHtml(slice);
  terms.forEach(function (term) {
    if (!term) return;
    html = html.replace(new RegExp('(' + term.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&') + ')', 'gi'), '<mark>$1</mark>');
  });
  // Highlighting <mark> inside escaped text is safe: no tags survived escaping.
  return html;
}

/* ------------------------------------------------------------------ index */

function createSearchIndex(options) {
  var opts = options || {};
  var dataDir = opts.dataDir || path.join(process.cwd(), 'data');
  var cacheFile = path.join(dataDir, 'search-index.json');
  var limit = opts.limit || 25;
  var cache = null;

  function readCache() {
    if (cache) return cache;
    try {
      var parsed = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      if (parsed && Array.isArray(parsed.documents)) { cache = parsed; return cache; }
    } catch (error) { /* no cache yet */ }
    cache = null;
    return null;
  }

  function writeCache(hash, documents) {
    cache = { hash: hash, builtAt: new Date().toISOString(), documents: documents };
    try {
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
    } catch (error) { /* a read-only disk just means no cache */ }
  }

  /**
   * Index a page. Rebuilds only when the markup actually changed, so repeated
   * requests cost one hash instead of a full parse.
   */
  function build(html, meta) {
    var info = meta || {};
    var hash = crypto.createHash('sha1').update(String(html || '')).digest('hex');
    var stored = readCache();
    if (stored && stored.hash === hash) return stored.documents;

    var documents = extractDocuments(html, { url: info.url || '' });
    writeCache(hash, documents);
    return documents;
  }

  function documents() {
    var stored = readCache();
    return stored ? stored.documents : [];
  }

  function search(query, searchOptions) {
    var settings = searchOptions || {};
    var terms = tokenize(query);
    if (!terms.length) return { query: String(query || ''), terms: terms, total: 0, results: [] };

    var phrase = String(query || '').trim().toLowerCase();
    var hits = [];
    documents().forEach(function (doc) {
      var score = scoreDocument(doc, terms, phrase);
      if (score === null) return;
      hits.push({
        id: doc.id,
        url: doc.url,
        title: doc.title,
        tags: doc.tags || '',
        score: score,
        snippet: snippetFor(doc, terms),
      });
    });

    hits.sort(function (a, b) { return b.score - a.score || a.title.localeCompare(b.title); });
    var capped = hits.slice(0, settings.limit || limit);
    return { query: String(query || ''), terms: terms, total: hits.length, results: capped };
  }

  function clear() {
    cache = null;
    try { if (fs.existsSync(cacheFile)) fs.unlinkSync(cacheFile); } catch (error) { /* ignore */ }
  }

  return {
    MARKER: MARKER,
    build: build,
    search: search,
    documents: documents,
    clear: clear,
    size: function () { return documents().length; }
  };
}

/* --------------------------------------------------------------- rendering */

/** The HTML that replaces <!--webcraft:search-results-->. */
function renderSearchResults(index, query, options) {
  var opts = options || {};
  var q = String(query || '').trim();
  if (!q) return '';

  var found = index.search(q, opts);
  var head = '<p class="wb-search__summary">' + (found.total === 1 ? '1 result' : found.total + ' results')
    + ' for \\u201c' + escapeSearchHtml(q) + '\\u201d</p>';

  if (!found.results.length) {
    return head + '<p class="wb-search__empty">Nothing matched. Try a shorter or different word.</p>';
  }

  var items = found.results.map(function (hit) {
    return '<li class="wb-search__result">'
      + '<a class="wb-search__result-title" href="' + escapeSearchHtml(hit.url) + '">' + escapeSearchHtml(hit.title) + '</a>'
      + (hit.tags ? '<span class="wb-search__result-tags">' + escapeSearchHtml(hit.tags) + '</span>' : '')
      + '<p class="wb-search__snippet">' + hit.snippet + '</p>'
      + '</li>';
  }).join('\\n');

  return head + '<ol class="wb-search__results">\\n' + items + '\\n</ol>';
}

/** Put the query back into the search box, so results survive without JS. */
function prefillSearchInputs(html, query) {
  return html.replace(/<input\\b[^>]*>/gi, function (tag) {
    if (tag.indexOf('wb-search__input') === -1) return tag;
    if (/\\svalue="[^"]*"/i.test(tag)) {
      return tag.replace(/\\svalue="[^"]*"/i, ' value="' + escapeSearchHtml(query) + '"');
    }
    return tag.replace(/\\s*\\/?>$/, function (end) {
      return ' value="' + escapeSearchHtml(query) + '"' + end;
    });
  });
}

/** Pull ?s= (or ?q=) out of a request URL. */
function searchQueryFrom(url) {
  var match = String(url || '').match(/[?&](?:s|q|search)=([^&#]*)/i);
  return match ? decodeURIComponent(match[1].replace(/\\+/g, ' ')).slice(0, 120) : '';
}

/**
 * Swap the marker in the page for real results. No marker (no search widget)
 * means the page is returned untouched; no query still clears the marker so the
 * internal comment never reaches the visitor.
 */
function renderSearch(html, index, query) {
  var source = String(html || '');
  if (source.indexOf(MARKER) === -1) return source;
  var q = String(query === undefined ? '' : query).trim();
  var body = q ? renderSearchResults(index, q) : '';
  return prefillSearchInputs(source.split(MARKER).join(body), q);
}

// Concatenated after the auth runtime in the same file, so merge, never assign.
Object.assign(module.exports, {
  SEARCH_MARKER: MARKER,
  createSearchIndex: createSearchIndex,
  extractDocuments: extractDocuments,
  renderSearch: renderSearch,
  renderSearchResults: renderSearchResults,
  searchQueryFrom: searchQueryFrom,
  prefillSearchInputs: prefillSearchInputs,
  tokenize: tokenize,
  stripTags: stripTags
});
`.trim();

/** PHP twin of the runtime above — same extraction, same scoring, same markup. */
export const PHP_SEARCH = `<?php
/**
 * WebCraft Pro search.
 *
 * Mirrors the Node backend: the page is split into top-level sections, cached
 * in data/search-index.json, and searched with AND semantics and title-weighted
 * scoring. No database and no extensions required.
 */

define('WEBCRAFT_SEARCH_MARKER', '<!--webcraft:search-results-->');

function wb_strip_tags($html) {
    $text = preg_replace('#<(script|style)[^>]*>.*?</\\1>#is', ' ', (string) $html);
    $text = preg_replace('/<[^>]+>/', ' ', $text);
    $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    return trim(preg_replace('/\\s+/u', ' ', $text));
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
    return preg_match('/\\bwb-element\\b|\\bwb-widget\\b|\\bwb-container\\b/', $attrs) === 1;
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

    preg_match_all('~<(\\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|\\x27[^\\x27]*\\x27|[^>"\\x27])*)>~', $source, $matches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE);

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
                $captureId = preg_match('/\\sid="([^"]+)"/', $attrs, $m) ? $m[1] : '';
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
    if (preg_match('/<title[^>]*>(.*?)<\\/title>/is', $source, $m)) {
        $title = wb_strip_tags($m[1]);
    }

    $blocks = wb_search_blocks($source);
    $documents = array();
    $position = 0;
    foreach ($blocks as $block) {
        $text = wb_strip_tags($block['html']);
        $heading = preg_match('/<h[1-6][^>]*>(.*?)<\\/h[1-6]>/is', $block['html'], $m) ? wb_strip_tags($m[1]) : '';
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
    $slice = ($start > 0 ? "\\u{2026}" : '') . trim(substr($text, $start, 190)) . ($start + 190 < strlen($text) ? "\\u{2026}" : '');

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
        . ' for \\u{201C}' . htmlspecialchars($q, ENT_QUOTES, 'UTF-8') . '\\u{201D}</p>';

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

    return $summary . "<ol class=\\"wb-search__results\\">\\n" . $items . "\\n</ol>";
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
    return preg_replace_callback('/<input\\b[^>]*>/i', function ($tag) {
        if (strpos($tag[0], 'wb-search__input') === false) {
            return $tag[0];
        }
        $safe = htmlspecialchars($query, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        if (preg_match('/\\svalue="[^"]*"/i', $tag[0])) {
            return preg_replace('/\\svalue="[^"]*"/i', ' value="' . $safe . '"', $tag[0]);
        }
        return preg_replace('/\\s*\\/?>$/', ' value="' . $safe . '"$0', $tag[0]);
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
`.trim();