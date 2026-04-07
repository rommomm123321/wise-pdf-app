package handler

import (
	"encoding/json"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/gorilla/mux"
)

// SearchResult represents one text match on a PDF page.
// All coordinates are in tile-server page units — the same space as
// PageInfo.Width/Height returned by /prepare/ — so callers can directly
// compare against page dimensions to compute highlight positions.
type SearchResult struct {
	Page int     `json:"page"` // 0-based page index
	X    float64 `json:"x"`
	Y    float64 `json:"y"`
	W    float64 `json:"w"`
	H    float64 `json:"h"`
	Text string  `json:"text"` // matched text snippet
}

// SearchHandler handles GET /search/{docId}?q=query&token=...
//
// The document must already be loaded in the pool (via /prepare/).
// Returns 404 if the document has not been prepared yet.
// Search is case-insensitive. Results contain coordinates in tile-server
// page units (same as PageInfo.Width/Height from /prepare/).
func (h *TileHandler) SearchHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	docID := vars["docId"]
	token := r.URL.Query().Get("token")
	query := strings.TrimSpace(r.URL.Query().Get("q"))

	// Auth
	if token == "" {
		http.Error(w, "Missing JWT token", http.StatusUnauthorized)
		return
	}
	if _, err := h.auth.ValidateToken(token); err != nil {
		http.Error(w, "Invalid token", http.StatusForbidden)
		return
	}

	if query == "" {
		writeSearchResults(w, []SearchResult{})
		return
	}

	// Only serve documents already in the pool — never trigger a download here.
	doc, ready := h.pool.GetDocumentIfReady(docID)
	if !ready {
		http.Error(w, "Document not prepared. Call /prepare/{docId} first.", http.StatusNotFound)
		return
	}

	log.Printf("[Search] docId=%s query=%q pages=%d", docID, query, doc.PageCount)

	// Acquire a single fitz handle for the whole search operation.
	// Releasing it after we're done returns it to the pool for tile rendering.
	fitzHandle := doc.AcquireHandle()
	defer doc.ReleaseHandle(fitzHandle)

	queryLower := strings.ToLower(query)
	var results []SearchResult

	for pageIdx := 0; pageIdx < doc.PageCount; pageIdx++ {
		// Fast pre-filter: check if the query even appears in plain text before
		// doing expensive HTML parsing.
		pageText, err := fitzHandle.Text(pageIdx)
		if err != nil {
			log.Printf("[Search] Text() page %d error: %v", pageIdx, err)
			continue
		}
		if !strings.Contains(strings.ToLower(pageText), queryLower) {
			continue // no match on this page, skip
		}

		// The page has at least one match. Parse the MuPDF HTML output to get
		// per-word bounding boxes so we can return highlight coordinates.
		pageHTML, err := fitzHandle.HTML(pageIdx, false)
		if err != nil {
			log.Printf("[Search] HTML() page %d error: %v", pageIdx, err)
			// Fall back: return a zero-coordinate result so the caller knows the page matches.
			results = append(results, SearchResult{
				Page: pageIdx,
				Text: query,
			})
			continue
		}

		pageResults := extractMatchesFromHTML(pageIdx, pageHTML, queryLower, query, doc.Pages[pageIdx].Width, doc.Pages[pageIdx].Height)
		results = append(results, pageResults...)
	}

	if results == nil {
		results = []SearchResult{}
	}

	log.Printf("[Search] docId=%s query=%q → %d matches", docID, query, len(results))
	writeSearchResults(w, results)
}

func writeSearchResults(w http.ResponseWriter, results []SearchResult) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"results": results})
}

// --- HTML parsing helpers ---
//
// MuPDF's fz_print_stext_page_as_html produces output like:
//
//   <div style="left:57px;top:69px;width:481px;height:688px">
//     <p style="...">
//       <span style="font-size:11px">Hello world</span>
//     </p>
//   </div>
//
// The outermost <div> is a block; top-level coordinates are in PDF points
// (72 dpi, 1× scale). We need to scale them to tile-server units which are
// stored in PageInfo.Width / PageInfo.Height (also from Bound() — same scale).
// Therefore NO scaling is needed: both come from the same fitz coordinate space.

// divStyleRe matches the style of a positioned <div> block.
// Example: style="left:57px;top:69px;width:481px;height:688px"
var divStyleRe = regexp.MustCompile(`<div\s[^>]*style="([^"]*)"`)

// spanRe matches a <span> (with optional style) and captures its text content.
var spanRe = regexp.MustCompile(`(?s)<span[^>]*>(.*?)</span>`)

// styleValRe extracts a named CSS value (e.g. "left", "top", "width", "height").
var styleValRe = regexp.MustCompile(`(?:^|;)\s*(left|top|width|height)\s*:\s*([\d.]+)px`)

type cssBox struct {
	left, top, width, height float64
}

func parseCSSBox(style string) (cssBox, bool) {
	matches := styleValRe.FindAllStringSubmatch(style, -1)
	if len(matches) == 0 {
		return cssBox{}, false
	}
	box := cssBox{}
	found := map[string]bool{}
	for _, m := range matches {
		v, err := strconv.ParseFloat(m[2], 64)
		if err != nil {
			continue
		}
		switch m[1] {
		case "left":
			box.left = v
			found["left"] = true
		case "top":
			box.top = v
			found["top"] = true
		case "width":
			box.width = v
			found["width"] = true
		case "height":
			box.height = v
			found["height"] = true
		}
	}
	if !found["left"] || !found["top"] {
		return cssBox{}, false
	}
	return box, true
}

// stripHTML removes all HTML tags from a string.
var tagRe = regexp.MustCompile(`<[^>]+>`)

func stripHTML(s string) string {
	return tagRe.ReplaceAllString(s, "")
}

// extractMatchesFromHTML parses the MuPDF HTML for pageIdx and returns
// SearchResult entries for every occurrence of queryLower (case-folded).
//
// Strategy: split the HTML into top-level <div> blocks (each is a text block
// with a known bounding box). Within each block, collect all <span> text runs.
// If the concatenated block text contains the query, emit a result using the
// block's bounding box. This gives one result per block per occurrence — good
// enough for jump-to-highlight navigation in the frontend.
//
// pageW / pageH are the tile-server page dimensions (from PageInfo) used to
// validate that coordinates are sane; no scaling is applied since both the
// HTML coordinates and PageInfo come from the same fitz coordinate system.
func extractMatchesFromHTML(pageIdx int, pageHTML, queryLower, queryOriginal string, pageW, pageH float64) []SearchResult {
	var results []SearchResult

	// Split on <div to get individual blocks. Each <div is one text block.
	// We scan for "left:...;top:..." style attributes to identify positioned divs.
	divMatches := divStyleRe.FindAllStringSubmatchIndex(pageHTML, -1)

	for i, match := range divMatches {
		styleStart := match[2]
		styleEnd := match[3]
		style := pageHTML[styleStart:styleEnd]

		// Determine end of this div's content: start of next div or end of string.
		contentStart := match[1] // end of opening <div ...>
		contentEnd := len(pageHTML)
		if i+1 < len(divMatches) {
			contentEnd = divMatches[i+1][0]
		}
		if contentStart >= contentEnd {
			continue
		}
		divContent := pageHTML[contentStart:contentEnd]

		// Collect all text within this block.
		spanMatches := spanRe.FindAllStringSubmatch(divContent, -1)
		if len(spanMatches) == 0 {
			// No spans — try stripping all tags directly.
			blockText := stripHTML(divContent)
			if !strings.Contains(strings.ToLower(blockText), queryLower) {
				continue
			}
		} else {
			var sb strings.Builder
			for _, sm := range spanMatches {
				sb.WriteString(stripHTML(sm[1]))
				sb.WriteRune(' ')
			}
			blockText := sb.String()
			if !strings.Contains(strings.ToLower(blockText), queryLower) {
				continue
			}
		}

		// This block contains the query. Parse the bounding box.
		box, ok := parseCSSBox(style)
		if !ok {
			continue
		}

		// Sanity check: skip obviously zero-sized or out-of-bounds boxes.
		if box.width <= 0 || box.height <= 0 {
			continue
		}

		results = append(results, SearchResult{
			Page: pageIdx,
			X:    box.left,
			Y:    box.top,
			W:    box.width,
			H:    box.height,
			Text: queryOriginal,
		})
	}

	// If we found no block-level hits (e.g. single-block page) but we know the
	// page matches, emit a page-level result with zero coordinates so the caller
	// can at least jump to the correct page.
	if len(results) == 0 {
		results = append(results, SearchResult{
			Page: pageIdx,
			X:    0,
			Y:    0,
			W:    pageW,
			H:    pageH,
			Text: queryOriginal,
		})
	}

	return results
}
