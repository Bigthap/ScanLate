let lastExtracted = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "SCAN_PAGE") {
        scanAndTrack();
    }
});

// Listen for updates from the Dashboard UI
window.addEventListener("message", (event) => {
    // Protect against "Extension context invalidated" errors
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.runtime) return;

    if (event.data && event.data.action === "UPDATE_CUSTOM_DOMAINS") {
        chrome.storage.local.set({ customDomains: event.data.domains.join(',') }, () => {
            console.log("Manga Tracker: Custom domains updated from dashboard!", event.data.domains);
        });
    }
});

// Run once on load
setTimeout(scanAndTrack, 2000);

async function scanAndTrack() {
    try {
        // Protect against "Extension context invalidated" errors
        if (typeof chrome === 'undefined' || !chrome.storage || !chrome.runtime) {
            return;
        }

        const hostname = window.location.hostname.toLowerCase();
        let shouldRun = hostname.includes('manga') || hostname.includes('anime') || hostname.includes('nekopost.net') || hostname.includes('read') || hostname.includes('toon');
        
        if (!shouldRun) {
            const storage = await chrome.storage.local.get('customDomains');
            if (storage.customDomains) {
                const domains = storage.customDomains.split(',').map(s => s.trim().toLowerCase());
                for (let d of domains) {
                    if (d && hostname.includes(d)) {
                        shouldRun = true;
                        break;
                    }
                }
            }
        }
        
        if (!shouldRun) return; // Skip tracking on this site

        const data = await extractData();
        if (data && data.chapterNumber) {
            const currentStr = JSON.stringify(data);
            if (lastExtracted !== currentStr) {
                lastExtracted = currentStr;
                chrome.runtime.sendMessage({ action: "SEND_TRACK_DATA", data: data });
            }
        }
    } catch(e) {
        console.error("Manga Tracker Scan Error", e);
    }
}

async function extractData() {
    const rawUrl = window.location.href;
    const url = decodeURIComponent(rawUrl);
    const hostname = window.location.hostname.replace('www.', '');
    
    let title = "";
    let chapter = "";
    let slug = "";
    let mainUrl = "";
    let imgUrl = "";

    // 0. Explicit Exclusions (Do not track main pages)
    if (hostname.includes("nekopost.net") && url.includes("/project/")) {
        return null;
    }

    // 0.1 Specific Site Handlers
    if (hostname.includes("nekopost.net")) {
        const parts = url.split('?')[0].split('/');
        if (parts.includes("manga") || parts.includes("novel") || parts.includes("doujin")) {
            const typeIndex = parts.findIndex(p => p === "manga" || p === "novel" || p === "doujin");
            if (typeIndex !== -1 && parts.length > typeIndex + 2) {
                slug = parts[typeIndex + 1];
                chapter = parts[typeIndex + 2];
                mainUrl = `https://www.nekopost.net/project/${slug}`;
                
                const titleEl = document.querySelector('a[href*="/project/"]');
                if (titleEl) {
                    title = titleEl.innerText.trim();
                } else {
                    title = `Nekopost Project ${slug}`; // Fallback
                }
                
                // Nekopost usually uses this CDN format
                imgUrl = `https://www.osemocphoto.com/collectManga/${slug}/${slug}_cover.jpg`;
            }
        }
    } else if (hostname.includes("anime-seven.com")) {
        // e.g. https://www.anime-seven.com/play/228851/...
        if (url.includes('/play/')) {
            const titleEl = document.querySelector('.panel-heading .panel-title');
            if (titleEl) {
                const fullText = titleEl.innerText.replace(/&nbsp;/g, ' ').trim();
                const match = fullText.match(/(.*?)\s*ตอนที่\s*(\d+(?:\.\d+)?)/i);
                if (match) {
                    title = match[1].trim();
                    chapter = match[2];
                } else {
                    title = fullText;
                }
            }
            
            // Try to find mainUrl from breadcrumbs or links
            const mainLink = document.querySelector('a[href^="https://www.anime-seven.com/"][href$="/"]');
            if (mainLink && mainLink.href.match(/\/\d+\/$/)) {
                mainUrl = mainLink.href;
            }
        }
        
        // Try to get image if it's on the page
        const thumbEl = document.querySelector('img.thumbnail.img-responsive');
        if (thumbEl) {
            imgUrl = thumbEl.src;
        }
    } else if (hostname.includes("readtoon.com")) {
        // e.g. https://readtoon.com/content/the-legendary-mechanic/1
        const parts = url.split('?')[0].replace(/\/$/, '').split('/');
        if (parts.includes("content") && parts.length >= 5) {
            const contentIndex = parts.indexOf("content");
            slug = parts[contentIndex + 1];
            chapter = parts[contentIndex + 2];
            mainUrl = `${window.location.origin}/content/${slug}`;
            
            // Extract title from chapter title if possible
            const h1 = document.querySelector('h1');
            if (h1) {
                title = h1.innerText.replace(chapter, '').trim();
            } else {
                title = document.title.split('|')[0].trim();
            }
        }
    }

    // 1. URL Parse Fallback setup
    const urlMatch = url.match(/\/([a-z0-9%_\-\s]+?)[_\-\s\/](?:chapter|ตอนที่|ch|ep)?[_\-\s\/]?(\d+(?:\.\d+)?)\/?$/i);
    if (urlMatch) {
        slug = urlMatch[1];
        chapter = urlMatch[2];
    } else {
        const fallbackMatch = url.match(/\/([a-z0-9%\-\s]+)-(\d+(?:\.\d+)?)\/?$/i);
        if (fallbackMatch) {
            slug = fallbackMatch[1];
            chapter = fallbackMatch[2];
        }
    }

    // 2. Try JSON-LD
    const ldScripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (let script of ldScripts) {
        try {
            const ld = JSON.parse(script.innerText);
            if (ld && ld.headline) {
                const hl = ld.headline.toLowerCase();
                const chMatch = hl.match(/(?:chapter|ตอนที่|ch|ep)\s*(\d+(?:\.\d+)?)/i);
                if (chMatch) chapter = chMatch[1];
            }
        } catch(e) {}
    }

    // 3. Try Breadcrumbs (Very reliable for Madara/MangaThemesia)
    const breadcrumbs = document.querySelectorAll('.c-breadcrumb li a, .breadcrumb li a, .breadcrumb span a, .ts-breadcrumb li a, .ts-breadcrumb span a, .allc a');
    if (breadcrumbs.length >= 1) {
        for (let i = breadcrumbs.length - 1; i >= 0; i--) {
            const text = breadcrumbs[i].innerText.trim();
            const href = breadcrumbs[i].href;
            
            if (text && text.toLowerCase() !== "home" && text !== "หน้าแรก" && text.toLowerCase() !== "all chapters") {
                // Skip if this breadcrumb points to the current page (e.g. it's the chapter link itself)
                const cleanHref = href.split('?')[0].split('#')[0].replace(/\/$/, '');
                const cleanCurrent = window.location.href.split('?')[0].split('#')[0].replace(/\/$/, '');
                if (cleanHref === cleanCurrent) continue;
                
                // Skip if explicitly marked as chapter
                if (text.match(/(?:chapter|ตอนที่|ch|ep)\s*\d+/i)) continue;

                title = text;
                mainUrl = href;
                break;
            }
        }
    }

    // 4. Try H1 or specific site headings
    if (!chapter || !title) {
        const h1 = document.querySelector('h1, .movie-heading span');
        if (h1) {
            const h1Text = h1.innerText.trim();
            const chMatch = h1Text.match(/(?:chapter|ตอนที่|ch|ep)\s*(\d+(?:\.\d+)?)/i);
            if (chMatch && !chapter) chapter = chMatch[1];
            if (!title) {
                let tempTitle = h1Text.replace(/(?:chapter|ตอนที่|ch|ep)\s*(\d+(?:\.\d+)?).*$/i, '').trim();
                tempTitle = tempTitle.replace(/[-:]\s*$/, '').trim();
                if (!tempTitle.includes("อ่านมังงะ") && !tempTitle.includes("อ่านการ์ตูน") && !tempTitle.includes("ดูอนิเมะ")) {
                    title = tempTitle;
                }
            }
        }
    }
    
    if ((!title || title.includes("อ่านมังงะ") || title.includes("อ่านการ์ตูน")) && slug) {
        title = decodeURIComponent(slug).replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    if (!slug && title) {
        slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    }

    if (!title || !chapter) return null;

    // Fetch Main Page to get True Cover (Skip if already found by specific handler)
    if (mainUrl && !imgUrl) {
        try {
            let fetchUrl = mainUrl;
            try {
                const parsedUrl = new URL(mainUrl);
                if (parsedUrl.origin !== window.location.origin) {
                    fetchUrl = window.location.origin + parsedUrl.pathname + parsedUrl.search + parsedUrl.hash;
                }
            } catch (e) {}

            const res = await fetch(fetchUrl);
            if (res.ok) {
                const html = await res.text();
                const doc = new DOMParser().parseFromString(html, 'text/html');
                
                const coverSelectors = [
                    '.summary_image img', 
                    '.sarea .thumb img', 
                    '.bigcontent .thumb img', 
                    '.animefull .thumb img', 
                    '.infox .thumb img', 
                    '.manga-info .thumb img',
                    '.main-info .thumb img',
                    '.comic-info .thumb img',
                    '.thumb img', 
                    '.imgholder img', 
                    '.comic-cover img',
                    '.ts-post-image',
                    'img[class*="object-cover"][class*="shadow-lg"]',
                    'img[src*="nobuild.pro"]'
                ];

                let thumb = null;
                for (let sel of coverSelectors) {
                    thumb = doc.querySelector(sel);
                    if (thumb) break;
                }

                if (thumb) {
                    let rawSrc = thumb.getAttribute('data-src') || thumb.getAttribute('data-lazy-src') || thumb.getAttribute('src');
                    if (rawSrc) imgUrl = new URL(rawSrc, mainUrl).href;
                }
                
                if (!imgUrl) {
                    const ogImg = doc.querySelector('meta[property="og:image"]');
                    if (ogImg && ogImg.content) {
                        imgUrl = new URL(ogImg.content, mainUrl).href;
                    }
                }
            }
        } catch(e) {
            console.warn("Manga Tracker: Failed to fetch main page for cover", e);
        }
    }

    // Fallback to current page
    if (!imgUrl) {
        const ogImg = document.querySelector('meta[property="og:image"]');
        if (ogImg && ogImg.content) {
            imgUrl = new URL(ogImg.content, window.location.href).href;
        } else {
            const coverSelectors = [
                '.summary_image img', 
                '.sarea .thumb img', 
                '.bigcontent .thumb img', 
                '.animefull .thumb img', 
                '.infox .thumb img', 
                '.manga-info .thumb img',
                '.main-info .thumb img',
                '.comic-info .thumb img',
                '.thumb img', 
                '.imgholder img', 
                '.comic-cover img',
                '.ts-post-image',
                'img[class*="object-cover"][class*="shadow-lg"]',
                'img[src*="nobuild.pro"]'
            ];

            let thumb = null;
            for (let sel of coverSelectors) {
                thumb = document.querySelector(sel);
                if (thumb) break;
            }

            if (thumb) {
                let rawSrc = thumb.getAttribute('data-src') || thumb.getAttribute('data-lazy-src') || thumb.getAttribute('src');
                if (rawSrc) imgUrl = new URL(rawSrc, window.location.href).href;
            }
        }
    }

    let coverBase64 = "";
    if (imgUrl && hostname.includes("readtoon.com")) {
        try {
            const imgRes = await fetch(imgUrl);
            if (imgRes.ok) {
                const blob = await imgRes.blob();
                coverBase64 = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                });
            }
        } catch(e) {
            console.warn("Failed to fetch cover base64 in content script", e);
        }
    }

    return {
        title: title,
        slug: slug,
        source: hostname,
        mainUrl: mainUrl || "",
        chapterNumber: chapter,
        chapterTitle: document.title,
        chapterUrl: rawUrl,
        coverUrl: imgUrl,
        coverBase64: coverBase64,
        sortKey: generateSortKey(chapter)
    };
}

function generateSortKey(chapterStr) {
    const parts = chapterStr.split('.');
    const major = parts[0].padStart(10, '0');
    const minor = parts.length > 1 ? parts[1].padEnd(10, '0') : '0000000000';
    return `${major}.${minor}`;
}
