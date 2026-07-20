// Encodes/decodes a PoseManager's exported state ({ poses, speed }) into a
// URL-safe string, and reads one back out of the page's current URL hash.
// Usage:
//   buildShareUrl(poses.export())        -> full shareable URL string
//   readPoseDataFromUrl()                -> parsed { poses, speed } or null

function toBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    return btoa(binary);
}

function fromBase64(base64) {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}

export function encodePoseData(data) {
    return encodeURIComponent(toBase64(JSON.stringify(data)));
}

export function decodePoseData(encoded) {
    try {
        return JSON.parse(fromBase64(decodeURIComponent(encoded)));
    } catch (err) {
        console.warn('urlSharing: failed to decode pose data from URL', err);
        return null;
    }
}

export function buildShareUrl(data) {
    const encoded = encodePoseData(data);
    const url = new URL(window.location.href);
    url.hash = `pose=${encoded}`;
    return url.toString();
}

export function readPoseDataFromUrl() {
    const hash = window.location.hash;
    if (!hash) return null;
    const match = hash.match(/pose=([^&]+)/);
    if (!match) return null;
    return decodePoseData(match[1]);
}