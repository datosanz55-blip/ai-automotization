#!/usr/bin/env python3
"""Сборка страниц сайта из src/ в корень проекта.

Каждая страница — файл src/pages/<имя>.html. В начале файла — настройки
до строки «---», ниже — содержимое страницы:

    title: Тарифы
    description: Описание для поисковиков
    nav: tariffs
    scripts: globe
    ---
    <section>…</section>

В содержимом и в общих блоках можно подключать файлы из src/partials
конструкцией {{> имя}}. Запуск: python3 build.py
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / "src"
PARTIALS = SRC / "partials"
PAGES = SRC / "pages"

# Пункты главного меню: ключ, ссылка, подпись
NAV = [
    ("about", "about.html", "О компании"),
    ("services", "services.html", "Услуги"),
    ("tariffs", "tariffs.html", "Тарифы"),
    ("works", "works.html", "Работы"),
    ("drivers", "drivers.html", "Водителям"),
    ("contacts", "contacts.html", "Контакты"),
]

EXTRA_SCRIPTS = {
    "globe": ['<script src="assets/js/land-dots.js" defer></script>',
              '<script src="assets/js/globe.js" defer></script>'],
}


def partial(name):
    return (PARTIALS / f"{name}.html").read_text(encoding="utf-8")


def include(text, depth=0):
    if depth > 5:
        raise RuntimeError("Слишком глубокая вложенность {{> …}}")
    return re.sub(r"\{\{>\s*([\w-]+)\s*\}\}", lambda m: include(partial(m.group(1)), depth + 1), text)


def parse(path):
    raw = path.read_text(encoding="utf-8")
    head, sep, body = raw.partition("\n---\n")
    if not sep:
        raise RuntimeError(f"{path.name}: нет строки «---» после настроек")
    meta = {}
    for line in head.splitlines():
        if line.strip():
            key, _, value = line.partition(":")
            meta[key.strip()] = value.strip()
    return meta, body


def nav_html(active):
    links = []
    for key, href, label in NAV:
        current = ' aria-current="page"' if key == active else ""
        links.append(f'<a href="{href}"{current}>{label}</a>')
    return "\n      ".join(links)


def render(name, meta, body):
    layout = include(partial("layout"))
    scripts = []
    for s in filter(None, (x.strip() for x in meta.get("scripts", "").split(","))):
        scripts.extend(EXTRA_SCRIPTS[s])
    page_url = "" if name == "index" else f"{name}.html"
    values = {
        "title": meta["title"],
        "description": meta.get("description", ""),
        "canonical": f"https://uralsmt.ru/{page_url}",
        "og_image": meta.get("og_image", "assets/img/about-lineup.webp"),
        "page": name,
        "nav": nav_html(meta.get("nav", "")),
        "content": include(body),
        "scripts": "\n".join(scripts),
        "head_extra": partial(meta["head_extra"]) if meta.get("head_extra") else "",
    }
    html = layout
    for key, value in values.items():
        html = html.replace("{{" + key + "}}", value)
    leftover = re.findall(r"\{\{[^}]*\}\}", html)
    if leftover:
        raise RuntimeError(f"{name}: не подставлено {leftover}")
    return html


def main():
    for path in sorted(PAGES.glob("*.html")):
        meta, body = parse(path)
        out = ROOT / path.name
        out.write_text(render(path.stem, meta, body), encoding="utf-8")
        print("собрано:", out.name)


if __name__ == "__main__":
    main()
