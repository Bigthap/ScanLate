// ScanLate v3 - MAIN World Hook
// This script is injected directly into the page's execution context (MAIN world) 
// to intercept canvas drawing operations before they happen.

(function() {
    if (window._scanlateHooked) return;
    window._scanlateHooked = true;

    console.log("⚡ ScanLate Hook Injected: Bypassing Canvas Protections...");

    // Hook CanvasRenderingContext2D.prototype.drawImage
    // Websites like comix.to draw images to canvas without CORS headers, which taints the canvas
    // preventing our content script from reading it. By hooking drawImage, we can extract
    // the original image URL and pass it to the content script via a data attribute.
    const origDrawImage = CanvasRenderingContext2D.prototype.drawImage;
    
    CanvasRenderingContext2D.prototype.drawImage = function(image, ...args) {
        try {
            // Check if the source is an image element with a valid URL
            if (image && (image instanceof HTMLImageElement || image.tagName === 'IMG') && image.src) {
                // Ignore data URIs as they don't need CORS bypass
                if (!image.src.startsWith('data:')) {
                    this.canvas.setAttribute('data-original-src', image.src);
                }
            }
        } catch (e) {
            // Failsafe: never break the original site's rendering
            console.warn("ScanLate Hook: Error capturing image src", e);
        }
        
        // Call the original drawImage function
        return origDrawImage.apply(this, [image, ...args]);
    };
})();
