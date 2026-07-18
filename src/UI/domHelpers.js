export function el(tag, className) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    return e;
}

export function label(text) {
    const l = el('span', 'mn-label');
    l.textContent = text;
    return l;
}

export function btn(text, onClick) {
    const b = el('button', 'mn-btn');
    b.textContent = text;
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
}

export function divider() {
    return el('div', 'mn-divider');
}