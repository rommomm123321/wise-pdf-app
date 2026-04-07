const fs = require('fs');
const file = 'src/pages/DocumentViewPage_temp.tsx';

let content = fs.readFileSync(file, 'utf8');

const target = `    if (tileViewerRef.current) {
      const worldX = matchCenterX;
      const worldY = pageWorldY + matchCenterY;

      tileViewerRef.current.navigateTo(worldX, worldY, TARGET_ZOOM);
    } else {
      // Fallback: at least jump to the right page
      handleJumpToPage(match.pageIndex + 1);
    }`;

const replacement = `    if (tileViewerRef.current) {
      const cx = (match.x || 0) + (match.width || 0) / 2;
      const cy = (match.y || 0) + (match.height || 0) / 2;
      tileViewerRef.current.navigateToPagePoint(pageIdx, cx, cy, TARGET_ZOOM);
    } else {
      // Fallback: at least jump to the right page
      handleJumpToPage(pageIdx + 1);
    }`;

content = content.replace(target, replacement);

// Fallback in case of \r\n newline mismatches
const targetCRLF = target.replace(/\n/g, '\r\n');
const replacementCRLF = replacement.replace(/\n/g, '\r\n');
content = content.replace(targetCRLF, replacementCRLF);

fs.writeFileSync(file, content);
console.log("File patched successfully!");
